import test from 'node:test';
import assert from 'node:assert/strict';
import { createVoiceConnection, reduceTranscript } from './realtime.js';

const OFFER = 'v=0\r\no=browser\r\n', ANSWER = 'v=0\r\no=provider\r\n';
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };

function harness(overrides = {}) {
  const track = { enabled: true, stopped: 0, stop() { this.stopped += 1; } };
  const stream = { getTracks: () => [track], getAudioTracks: () => [track] };
  const states = [], errors = [], transcripts = [], playback = [], peers = [], timers = new Map();
  let nextTimer = 0, mediaRequests = 0, signal;
  const eventTarget = new EventTarget(), visibilityTarget = new EventTarget();
  visibilityTarget.hidden = false;
  const audioElement = { srcObject: null, paused: 0, play: async () => {}, pause() { this.paused += 1; } };
  class Peer {
    constructor() { peers.push(this); this.connectionState = 'new'; this.closed = 0; }
    addTrack(track, stream) { this.track = track; this.stream = stream; }
    createDataChannel(name) { this.channelName = name; return this.channel = { sent: [], closed: 0, send(value) { this.sent.push(value); }, close() { this.closed += 1; } }; }
    async createOffer() { return { type: 'offer', sdp: OFFER }; }
    async setLocalDescription(value) { this.localDescription = value; }
    async setRemoteDescription(value) { this.remoteDescription = value; }
    close() { this.closed += 1; this.connectionState = 'closed'; }
  }
  const connection = createVoiceConnection({
    audioElement, eventTarget, visibilityTarget, PeerConnection: Peer,
    mediaDevices: { getUserMedia: async options => { mediaRequests += 1; assert.equal(options.video, false); return stream; } },
    negotiate: async (sdp, options) => { assert.equal(sdp, OFFER); signal = options.signal; return { sdp: ANSWER }; },
    onState: value => states.push(value), onError: value => errors.push(value), onTranscript: value => transcripts.push(value), onPlaybackBlocked: value => playback.push(value),
    setTimer: (callback, delay) => { const id = ++nextTimer; timers.set(id, { callback, delay }); return id; }, clearTimer: id => timers.delete(id),
    ...overrides,
  });
  return { connection, track, stream, states, errors, transcripts, playback, peers, timers, eventTarget, visibilityTarget, audioElement,
    get mediaRequests() { return mediaRequests; }, get signal() { return signal; },
    fireTimer(delay) { const found = [...timers].find(([, value]) => value.delay === delay); assert.ok(found, `Expected timer for ${delay}`); timers.delete(found[0]); found[1].callback(); },
  };
}

test('transcripts retain conversation order when user transcription finishes after an AI response', () => {
  let lines = [];
  for (const event of [
    { type: 'input_audio_buffer.speech_started', item_id: 'user-1' },
    { type: 'response.output_item.added', item: { id: 'ai-1', role: 'assistant' } },
    { type: 'response.output_audio_transcript.delta', item_id: 'ai-1', delta: 'What feels ' },
    { type: 'response.output_audio_transcript.delta', item_id: 'ai-1', delta: 'possible?' },
    { type: 'conversation.item.input_audio_transcription.completed', item_id: 'user-1', transcript: 'I need a pause.' },
    { type: 'response.output_audio_transcript.done', item_id: 'ai-1', transcript: 'What feels possible?' },
    { type: 'response.output_audio_transcript.delta', item_id: 'ai-1', delta: 'late duplicate' },
  ]) lines = reduceTranscript(lines, event);
  assert.deepEqual(lines, [{ id: 'user-1', role: 'user', text: 'I need a pause.', final: true }, { id: 'ai-1', role: 'assistant', text: 'What feels possible?', final: true }]);
});

test('transcript reducer ignores malformed protocol events and bounds in-memory transcript size', () => {
  const start = [];
  for (const event of [null, { type: 'response.output_text.delta', delta: 'missing ID' }, { type: 'response.output_text.delta', item_id: 'x', delta: {} }, { type: 'conversation.item.created', item: { id: 'x', role: 'system' } }]) assert.equal(reduceTranscript(start, event), start);
  let lines = [];
  for (let i = 0; i < 110; i += 1) lines = reduceTranscript(lines, { type: 'conversation.item.input_audio_transcription.completed', item_id: `user-${i}`, transcript: 'x'.repeat(15000) });
  assert.equal(lines.length, 100);
  assert.equal(lines[0].id, 'user-10');
  assert.equal(lines.at(-1).text.length, 12000);
});

test('a connection requests no microphone until start, negotiates SDP, and cleans all resources on stop', async () => {
  const h = harness();
  assert.equal(h.mediaRequests, 0);
  assert.equal(await h.connection.start(), true);
  assert.equal(h.mediaRequests, 1);
  assert.equal(await h.connection.start(), false, 'one controller cannot start twice');
  const peer = h.peers[0];
  assert.deepEqual(peer.remoteDescription, { type: 'answer', sdp: ANSWER });
  assert.equal(peer.channelName, 'oai-events');
  peer.channel.onopen();
  assert.deepEqual(h.states, ['connecting', 'live']);
  assert.equal(JSON.parse(peer.channel.sent[0]).type, 'response.create');
  h.connection.setMuted(true); assert.equal(h.track.enabled, false);
  h.connection.setMuted(false); assert.equal(h.track.enabled, true);
  h.connection.stop(); h.connection.stop();
  assert.equal(h.track.stopped, 1);
  assert.equal(peer.closed, 1); assert.equal(peer.channel.closed, 1);
  assert.equal(h.signal.aborted, true); assert.equal(h.timers.size, 0);
  assert.equal(h.audioElement.srcObject, null);
  h.eventTarget.dispatchEvent(new Event('pagehide'));
  assert.equal(h.states.at(-1), 'stopped');
});

test('closing while microphone permission is pending stops a late microphone stream without negotiating', async () => {
  let allow, negotiated = false;
  const track = { stopped: 0, stop() { this.stopped += 1; } };
  const h = harness({ mediaDevices: { getUserMedia: () => new Promise(resolve => { allow = resolve; }) }, negotiate: async () => { negotiated = true; } });
  const starting = h.connection.start();
  h.connection.stop();
  allow({ getTracks: () => [track] });
  assert.equal(await starting, false);
  assert.equal(track.stopped, 1); assert.equal(negotiated, false); assert.equal(h.peers.length, 0);
});

test('negotiation failures and denied permissions never leave an open microphone', async () => {
  const denied = harness({ mediaDevices: { getUserMedia: async () => { throw Object.assign(new Error('raw details'), { name: 'NotAllowedError' }); } } });
  assert.equal(await denied.connection.start(), false);
  assert.match(denied.errors[0], /Microphone access wasn’t allowed/);
  assert.equal(denied.timers.size, 0);
  const failed = harness({ negotiate: async () => { throw new Error('raw key must not appear'); } });
  assert.equal(await failed.connection.start(), false);
  assert.equal(failed.track.stopped, 1); assert.equal(failed.peers[0].closed, 1); assert.equal(failed.timers.size, 0);
  assert.doesNotMatch(failed.errors[0], /raw key/);
});

test('stopping while server negotiation is pending aborts it and ignores a late answer', async () => {
  let finish, signal;
  const h = harness({ negotiate: (_sdp, options) => { signal = options.signal; return new Promise(resolve => { finish = resolve; }); } });
  const starting = h.connection.start();
  await flush(); await flush();
  h.connection.stop();
  assert.equal(signal.aborted, true);
  finish({ sdp: ANSWER });
  assert.equal(await starting, false);
  assert.equal(h.peers[0].remoteDescription, undefined); assert.equal(h.track.stopped, 1);
});

test('ten-minute limit, app expiry, pagehide, and hidden page each shut down audio', async () => {
  for (const reason of ['time-limit', 'session-ended', 'pagehide', 'hidden']) {
    const h = harness(); await h.connection.start(); h.peers[0].channel.onopen();
    if (reason === 'time-limit') h.fireTimer(600000);
    else if (reason === 'session-ended') h.eventTarget.dispatchEvent(new Event('becoming:session-ended'));
    else if (reason === 'pagehide') h.eventTarget.dispatchEvent(new Event('pagehide'));
    else { h.visibilityTarget.hidden = true; h.visibilityTarget.dispatchEvent(new Event('visibilitychange')); }
    assert.equal(h.connection.closed, true); assert.equal(h.track.stopped, 1); assert.equal(h.timers.size, 0);
    assert.equal(h.states.at(-1), ['pagehide', 'hidden'].includes(reason) ? 'left-page' : reason);
  }
});

test('voice is stopped at the authenticated server session expiry even while WebRTC stays connected', async () => {
  const h = harness({ now: () => 10000, negotiate: async () => ({ sdp: ANSWER, sessionExpiresAt: 14000 }) });
  await h.connection.start(); h.peers[0].channel.onopen(); h.fireTimer(4000);
  assert.equal(h.states.at(-1), 'session-ended'); assert.equal(h.track.stopped, 1);
  const expired = harness({ now: () => 10000, negotiate: async () => ({ sdp: ANSWER, sessionExpiresAt: 9999 }) });
  assert.equal(await expired.connection.start(), false);
  assert.equal(expired.states.at(-1), 'session-ended'); assert.equal(expired.peers[0].remoteDescription, undefined);
});

test('connection timeout and unrecovered network loss stop the microphone; short reconnection cancels timeout', async () => {
  const h = harness(); await h.connection.start(); h.fireTimer(35000);
  assert.equal(h.track.stopped, 1); assert.equal(h.states.at(-1), 'error');
  const recovered = harness(); await recovered.connection.start();
  const peer = recovered.peers[0]; peer.channel.onopen(); peer.connectionState = 'disconnected'; peer.onconnectionstatechange();
  peer.connectionState = 'connected'; peer.onconnectionstatechange();
  assert.ok(![...recovered.timers.values()].some(timer => timer.delay === 6000));
  peer.connectionState = 'disconnected'; peer.onconnectionstatechange(); recovered.fireTimer(6000);
  assert.equal(recovered.track.stopped, 1); assert.equal(recovered.timers.size, 0);
});

test('malformed data-channel messages are ignored, provider errors end the call, autoplay has a retry path', async () => {
  const h = harness(); await h.connection.start();
  const peer = h.peers[0];
  for (const data of ['{not json', 'null', '[]', '23', 23]) peer.channel.onmessage({ data });
  peer.channel.onmessage({ data: JSON.stringify({ type: 'response.output_audio_transcript.delta', item_id: 'ai', delta: 'Hello' }) });
  assert.equal(h.transcripts.length, 1);
  h.audioElement.play = async () => { throw new Error('autoplay blocked'); };
  peer.ontrack({ streams: [h.stream] }); await flush();
  assert.equal(h.audioElement.srcObject, h.stream); assert.equal(h.playback.at(-1), true);
  h.audioElement.play = async () => {};
  await h.connection.playAudio(); assert.equal(h.playback.at(-1), false);
  peer.channel.onmessage({ data: JSON.stringify({ type: 'error', error: { message: 'private provider info' } }) });
  assert.equal(h.track.stopped, 1); assert.doesNotMatch(h.errors[0], /private provider/);
});
