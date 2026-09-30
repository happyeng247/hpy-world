import React, { useEffect, useRef, useState } from 'react';
import { Check, Mic, MicOff, RefreshCw, Square, Volume2 } from 'lucide-react';
import { api } from '../api.js';
import { Modal } from '../UI.jsx';
import { getModule, getWorld } from '../journey/catalog.js';
import { createVoiceConnection, reduceTranscript } from './realtime.js';
import './voice.css';

export default function VoiceCompanion({ worldId = 'arrival', regionId = 'talk', onSaveInsight, onClose, onSetup }) {
  const [availability, setAvailability] = useState(null), [statusError, setStatusError] = useState('');
  const [consent, setConsent] = useState(false), [phase, setPhase] = useState('idle'), [muted, setMuted] = useState(false);
  const [transcript, setTranscript] = useState([]), [takeaway, setTakeaway] = useState('');
  const [error, setError] = useState(''), [saveState, setSaveState] = useState('idle'), [playbackBlocked, setPlaybackBlocked] = useState(false), [seconds, setSeconds] = useState(0);
  const audio = useRef(null), connection = useRef(null), mounted = useRef(true), startedAt = useRef(0);
  const place = getModule(worldId, regionId), world = getWorld(worldId);
  const active = phase === 'live' || phase === 'connecting';
  const supported = Boolean(globalThis.isSecureContext && globalThis.navigator?.mediaDevices?.getUserMedia && globalThis.RTCPeerConnection);
  async function checkAvailability(signal) {
    setStatusError(''); setAvailability(null);
    try { const result = await api('/voice/status', { signal }); if (mounted.current) setAvailability(result); }
    catch (cause) { if (mounted.current && cause.name !== 'AbortError') setStatusError(cause.message); }
  }
  useEffect(() => {
    mounted.current = true; const controller = new AbortController(); checkAvailability(controller.signal);
    return () => { mounted.current = false; controller.abort(); connection.current?.stop(); };
  }, []);
  useEffect(() => {
    if (phase !== 'live') return;
    const interval = setInterval(() => setSeconds(Math.floor((Date.now() - startedAt.current) / 1000)), 1000);
    return () => clearInterval(interval);
  }, [phase]);
  useEffect(() => () => connection.current?.stop(), [worldId, regionId]);
  function close() { connection.current?.stop(); onClose(); }
  async function start() {
    if (!consent || !availability?.configured || !supported || active) return;
    connection.current?.stop(); setError(''); setTranscript([]); setMuted(false); setPlaybackBlocked(false); setSeconds(0);
    const call = createVoiceConnection({
      audioElement: audio.current,
      negotiate: (sdp, options) => api('/voice/session', { method: 'POST', body: { sdp, worldId, regionId }, signal: options.signal }),
      onState: value => { if (mounted.current) { if (value === 'live') startedAt.current = Date.now(); setPhase(value); } },
      onTranscript: event => { if (mounted.current) setTranscript(previous => reduceTranscript(previous, event)); },
      onError: message => { if (mounted.current) setError(message); },
      onPlaybackBlocked: value => { if (mounted.current) setPlaybackBlocked(value); },
    });
    connection.current = call; await call.start();
  }
  async function save() {
    if (!takeaway.trim() || !onSaveInsight || saveState === 'saving') return;
    setSaveState('saving'); setError('');
    try { await onSaveInsight({ worldId, regionId, text: takeaway.trim(), source: 'voice' }); if (mounted.current) setSaveState('saved'); }
    catch (cause) { if (mounted.current) { setError(cause.message || 'That takeaway could not be saved.'); setSaveState('idle'); } }
  }
  const status = phase === 'live' ? (muted ? 'Microphone muted' : 'Listening · you can interrupt')
    : phase === 'connecting' ? 'Connecting your microphone…' : phase === 'time-limit' ? 'Ten minutes reached · your microphone is off'
      : phase === 'session-ended' ? 'Your app session ended · microphone off' : phase === 'left-page' ? 'Voice stopped when you left · microphone off'
        : phase === 'stopped' ? 'Conversation ended · microphone off' : phase === 'error' ? 'Connection ended · microphone off' : 'Your microphone is off';
  return <Modal title="A little room to talk" className="voice-dialog" onClose={close}>
    <div className="voice-place"><span>{world?.title || 'Your world'}</span><strong>{place?.title || 'A place to reflect'}</strong></div>
    <audio ref={audio} autoPlay playsInline className="voice-audio"/>
    <div className={`voice-orb ${phase === 'live' && !muted ? 'is-listening' : ''}`} aria-hidden="true"><Mic size={30}/></div>
    <p className="voice-status" role="status">{status}{phase === 'live' && <span>{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')} / 10:00</span>}</p>
    {!supported && <p className="voice-notice">Voice needs a browser with microphone support on HTTPS or localhost. You can still write an insight below.</p>}
    {!availability && !statusError && <p className="voice-fineprint" role="status">Checking the AI connection…</p>}
    {availability?.configured === false && <div className="voice-notice"><strong>Connect voice when you’re ready.</strong><p>This app needs an OpenAI connection before you can talk. Writing and saving insights still work.</p>{onSetup && <button className="button" onClick={onSetup}>Set up AI connection</button>}<button className="text-button" onClick={() => checkAvailability()}><RefreshCw size={14}/>Check connection again</button></div>}
    {statusError && <div className="voice-notice" role="alert"><p>{statusError}</p><button className="text-button" onClick={() => checkAvailability()}>Try checking again</button></div>}
    {!active && <div className="voice-consent"><p>This is an AI voice, here to ask questions and explore with you. It can misunderstand you; your judgment stays yours.</p><label><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)}/><span>I agree to send my microphone audio to OpenAI for this conversation.</span></label><p className="voice-fineprint">HPY keeps this transcript in memory until this dialog closes. Only a takeaway you choose to save enters your journey. OpenAI processes audio under its <a href="https://developers.openai.com/api/docs/guides/your-data" target="_blank" rel="noreferrer">API data policies</a>. API usage may incur charges. Sessions stop after ten minutes.</p></div>}
    <div className="voice-actions">{active ? <><button className="button" disabled={phase !== 'live'} aria-pressed={muted} onClick={() => { const next = !muted; connection.current?.setMuted(next); setMuted(next); }}>{muted ? <MicOff size={17}/> : <Mic size={17}/>} {muted ? 'Unmute microphone' : 'Mute microphone'}</button><button className="button dark" onClick={() => connection.current?.stop()}><Square size={15}/>Stop talking</button></> : <button className="button dark" disabled={!consent || !availability?.configured || !supported} onClick={start}><Mic size={17}/>{transcript.length ? 'Start a new conversation' : 'Start voice conversation'}</button>}</div>
    {playbackBlocked && active && <button className="button voice-play" onClick={() => connection.current?.playAudio()}><Volume2 size={17}/>Tap to hear the AI voice</button>}
    {error && <p className="error-text" role="alert">{error}</p>}
    <details className="voice-transcript"><summary>Conversation transcript <span>It may contain mistakes.</span></summary><div className="voice-lines" aria-live="off">{transcript.filter(item => item.text).map(item => <article key={item.id} className={`voice-line ${item.role}`}><span>{item.role === 'user' ? 'You' : 'AI companion'}</span><p>{item.text}</p>{item.role === 'user' && item.final && <button className="text-button" disabled={saveState === 'saving'} onClick={() => { setTakeaway(item.text.slice(0, 5000)); setSaveState('idle'); }}>Use this thought in my takeaway</button>}</article>)}{!transcript.some(item => item.text) && <p className="muted">Your words will appear here while you talk.</p>}</div></details>
    <div className="voice-takeaway"><label htmlFor="voice-takeaway">What would you like to carry with you?</label><p>Edit a thought from the conversation, or write something in your own words.</p><textarea id="voice-takeaway" rows={4} maxLength={5000} disabled={saveState === 'saving'} value={takeaway} onChange={event => { setTakeaway(event.target.value); setSaveState('idle'); }} placeholder="Something I noticed…"/><button className="button dark" disabled={!takeaway.trim() || !onSaveInsight || saveState === 'saving' || saveState === 'saved'} onClick={save}>{saveState === 'saved' ? <Check size={17}/> : null}{saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Insight saved' : 'Save this insight'}</button><span className="voice-fineprint">The full transcript is never saved by this button.</span></div>
  </Modal>;
}
