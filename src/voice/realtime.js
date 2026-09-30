const MAX_TRANSCRIPT_ITEMS = 100;
const MAX_TRANSCRIPT_TEXT = 12000;

export function reduceTranscript(current, event) {
  if (!event || typeof event !== 'object') return current;
  let id = event.item_id, role, value, final = false, append = false;
  if (event.type === 'input_audio_buffer.speech_started') role = 'user';
  else if (['conversation.item.created', 'conversation.item.added', 'response.output_item.added'].includes(event.type)) {
    id = event.item?.id;
    role = event.item?.role;
    if (!['user', 'assistant'].includes(role)) return current;
  } else if (event.type === 'conversation.item.input_audio_transcription.delta') {
    role = 'user'; value = event.delta; append = true;
  } else if (event.type === 'conversation.item.input_audio_transcription.completed') {
    role = 'user'; value = event.transcript; final = true;
  } else if (['response.output_audio_transcript.delta', 'response.output_text.delta'].includes(event.type)) {
    role = 'assistant'; value = event.delta; append = true;
  } else if (['response.output_audio_transcript.done', 'response.output_text.done'].includes(event.type)) {
    role = 'assistant'; value = event.transcript ?? event.text; final = true;
  } else return current;
  if (typeof id !== 'string' || !id || id.length > 200 || (value !== undefined && typeof value !== 'string')) return current;
  const index = current.findIndex(item => item.id === id);
  const old = index >= 0 ? current[index] : { id, role, text: '', final: false };
  if (old.final && append) return current;
  const next = { ...old, role, final: old.final || final,
    text: value === undefined ? old.text : (append ? old.text + value : value).slice(0, MAX_TRANSCRIPT_TEXT),
  };
  return (index >= 0 ? current.map((item, i) => i === index ? next : item) : [...current, next]).slice(-MAX_TRANSCRIPT_ITEMS);
}

export function voiceErrorMessage(error) {
  if (error?.name === 'NotAllowedError' || error?.name === 'SecurityError') return 'Microphone access wasn’t allowed. You can enable it in your browser settings or keep reflecting in writing.';
  if (error?.name === 'NotFoundError') return 'No microphone was found. Connect one, or keep reflecting in writing.';
  if (error?.name === 'NotReadableError') return 'The microphone is busy or unavailable. Close another app using it and try again.';
  if (error?.status === 401) return 'Your app session ended. Unlock your space again to continue.';
  if ([429, 503].includes(error?.status)) return error.message;
  return 'The voice connection didn’t finish. Your written takeaway is still here; you can try again.';
}

// Owns every microphone track, timer and connection for one conversation.
// Dependencies are injectable so lifecycle tests never open a microphone.
export function createVoiceConnection({
  negotiate, audioElement, onTranscript = () => {}, onState = () => {}, onError = () => {}, onPlaybackBlocked = () => {},
  mediaDevices = globalThis.navigator?.mediaDevices, PeerConnection = globalThis.RTCPeerConnection, MediaStreamClass = globalThis.MediaStream,
  eventTarget = globalThis.window, visibilityTarget = globalThis.document,
  maxDurationMs = 10 * 60 * 1000, connectionTimeoutMs = 35000,
  setTimer = globalThis.setTimeout, clearTimer = globalThis.clearTimeout, now = Date.now,
} = {}) {
  let peer, channel, localStream, closed = false, started = false, live = false;
  let setupTimer, durationTimer, disconnectedTimer, expiryTimer;
  const abort = new AbortController();
  const stopTracks = stream => stream?.getTracks?.().forEach(track => { try { track.stop(); } catch { /* Already stopped. */ } });
  function stop(reason = 'stopped') {
    if (closed) return;
    closed = true;
    abort.abort();
    for (const timer of [setupTimer, durationTimer, disconnectedTimer, expiryTimer]) if (timer !== undefined) clearTimer(timer);
    eventTarget?.removeEventListener('pagehide', leavePage);
    eventTarget?.removeEventListener('becoming:session-ended', sessionEnded);
    visibilityTarget?.removeEventListener('visibilitychange', visibilityChanged);
    stopTracks(localStream);
    if (channel) { channel.onopen = null; channel.onmessage = null; channel.onclose = null; channel.onerror = null; try { channel.close(); } catch { /* Already closed. */ } }
    if (peer) { peer.ontrack = null; peer.onconnectionstatechange = null; try { peer.close(); } catch { /* Already closed. */ } }
    if (audioElement) { audioElement.pause?.(); audioElement.srcObject = null; }
    onState(reason);
  }
  function fail(error) {
    if (closed) return;
    stop('error'); onError(voiceErrorMessage(error));
  }
  function leavePage() { stop('left-page'); }
  function sessionEnded() { stop('session-ended'); }
  function visibilityChanged() { if (visibilityTarget?.hidden) stop('left-page'); }
  async function playAudio() {
    if (closed || !audioElement) return;
    try { await audioElement.play(); if (!closed) onPlaybackBlocked(false); }
    catch { if (!closed) onPlaybackBlocked(true); }
  }
  return {
    async start() {
      if (started || closed) return false;
      started = true;
      if (!mediaDevices?.getUserMedia || !PeerConnection || typeof negotiate !== 'function') {
        fail(new Error('unsupported')); return false;
      }
      eventTarget?.addEventListener('pagehide', leavePage);
      eventTarget?.addEventListener('becoming:session-ended', sessionEnded);
      visibilityTarget?.addEventListener('visibilitychange', visibilityChanged);
      onState('connecting');
      setupTimer = setTimer(() => fail(new Error('timeout')), connectionTimeoutMs);
      try {
        const stream = await mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
        if (closed) { stopTracks(stream); return false; }
        localStream = stream;
        peer = new PeerConnection();
        peer.ontrack = event => {
          if (closed || !audioElement) return;
          audioElement.srcObject = event.streams?.[0] ?? (MediaStreamClass && event.track ? new MediaStreamClass([event.track]) : null);
          playAudio();
        };
        for (const track of stream.getAudioTracks()) peer.addTrack(track, stream);
        channel = peer.createDataChannel('oai-events');
        channel.onmessage = message => {
          if (closed || typeof message.data !== 'string' || message.data.length > 100000) return;
          let event; try { event = JSON.parse(message.data); } catch { return; }
          if (!event || typeof event !== 'object' || Array.isArray(event)) return;
          if (event.type === 'error') { fail(new Error('provider-event')); return; }
          onTranscript(event);
        };
        channel.onopen = () => {
          if (closed || live) return;
          live = true; clearTimer(setupTimer);
          durationTimer = setTimer(() => stop('time-limit'), maxDurationMs);
          onState('live');
          try { channel.send(JSON.stringify({ type: 'response.create', response: { instructions: 'Briefly introduce yourself as an AI reflection companion. Ask one gentle opening question related to the current place. Do not claim to know anything about the person yet.' } })); }
          catch (error) { fail(error); }
        };
        channel.onclose = () => { if (!closed) fail(new Error('channel-closed')); };
        channel.onerror = () => fail(new Error('channel-error'));
        peer.onconnectionstatechange = () => {
          if (closed) return;
          if (peer.connectionState === 'failed' || peer.connectionState === 'closed') fail(new Error('connection-failed'));
          else if (peer.connectionState === 'disconnected') {
            if (disconnectedTimer === undefined) disconnectedTimer = setTimer(() => fail(new Error('connection-lost')), 6000);
          } else if (peer.connectionState === 'connected' && disconnectedTimer !== undefined) { clearTimer(disconnectedTimer); disconnectedTimer = undefined; }
        };
        const offer = await peer.createOffer();
        if (closed) return false;
        await peer.setLocalDescription(offer);
        if (closed) return false;
        const answer = await negotiate(peer.localDescription?.sdp || offer.sdp, { signal: abort.signal });
        if (closed) return false;
        if (typeof answer?.sdp !== 'string' || !/^v=0(?:\r?\n)/.test(answer.sdp)) throw new Error('invalid-answer');
        if (Number.isFinite(answer.sessionExpiresAt)) {
          const remaining = answer.sessionExpiresAt - now();
          if (remaining <= 0) { stop('session-ended'); return false; }
          expiryTimer = setTimer(sessionEnded, Math.min(remaining, 2147483647));
        }
        await peer.setRemoteDescription({ type: 'answer', sdp: answer.sdp });
        return !closed;
      } catch (error) { if (!closed) fail(error); return false; }
    },
    stop,
    setMuted(muted) { if (!closed) localStream?.getAudioTracks?.().forEach(track => { track.enabled = !muted; }); },
    playAudio,
    get closed() { return closed; },
  };
}
