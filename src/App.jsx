import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, BookOpen, Check, ChevronRight, Compass, Flower2, Hand, Heart, Home, LockKeyhole, Menu, MessageCircle, Orbit, RotateCcw, Settings2, ShieldCheck, Sparkles, Sprout, X } from 'lucide-react';
import { api } from './api';
import { Flower, Modal } from './UI';
import { Brand, BrandMark } from './Brand';
import { THEMES, THEME_INVITATIONS } from './content';
import { ChatMode, CompassMode, ReplayMode, SkillsMode, WisdomMode, LandscapeMode, JournalMode } from './Modes';

const Landscape = lazy(() => import('./Landscape'));
const WorldExperience = lazy(() => import('./world/WorldExperience'));
export const MODES = [
  { id: 'talk', name: 'Talk it through', eyebrow: 'LET IT OUT', text: 'Untangle what’s on your mind, one good question at a time.', icon: MessageCircle, color: 'peach', meta: 'A conversation with yourself', badge: 'START ANYWHERE' },
  { id: 'landscape', name: 'Your inner world', eyebrow: 'CHANGE YOUR PERSPECTIVE', text: 'Wander a little landscape. See what’s asking for your attention.', icon: Orbit, color: 'lilac', meta: 'An interactive 3D space', badge: 'A LITTLE DIFFERENT' },
  { id: 'compass', name: 'Meet your becoming', eyebrow: 'FIND YOUR DIRECTION', text: 'Explore the qualities you want to bring into ordinary moments.', icon: Compass, color: 'lime', meta: 'Values & your next small step' },
  { id: 'replay', name: 'The rehearsal room', eyebrow: 'TRY A DIFFERENT WAY', text: 'Revisit a tricky moment. Make room for a response that feels like you.', icon: RotateCcw, color: 'blue', meta: 'Real-life relationship practice' },
  { id: 'skills', name: 'A little steadier', eyebrow: 'BUILD YOUR TOOLKIT', text: 'Practice slowing down, finding words, and holding your own feelings.', icon: Hand, color: 'yellow', meta: 'DBT & other therapy skills' },
  { id: 'wisdom', name: 'The wisdom grove', eyebrow: 'MAKE SPACE FOR MEANING', text: 'Meet ancient ideas with fresh questions about your everyday life.', icon: Flower2, color: 'rose', meta: 'Reflections from Hindu philosophy' },
];

const MOOD_CHOICES = [
  { id: 'heavy', label: 'Heavy', face: '╭', color: '#bacad0' },
  { id: 'tangled', label: 'Tangled', face: '~', color: '#c4b8d3' },
  { id: 'inbetween', label: 'In-between', face: '—', color: '#eac895' },
  { id: 'okay', label: 'Okay', face: '⌣', color: '#b9c596' },
  { id: 'open', label: 'Open', face: '◡', color: '#e5a18a' },
];

function MoodFace({ mood, small = false }) {
  return <span className={`mood-face ${small ? 'small' : ''}`} style={{ background: mood.color }} aria-hidden="true"><span className="eyes"><i/><i/></span><span className={`mouth ${mood.id}`}>{mood.face}</span></span>;
}

function Gate({ onUnlock, expired }) {
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  return <main className="gate"><a href="#" className="brand gate-brand" aria-label="HPY home"><Brand/></a><div className="hpy-gate-art" aria-hidden="true"><div className="hpy-orbit-ring"/><img src="/brand/hpy-orb-hero.png" width="531" height="511" alt=""/><i className="hpy-orbit-dot"/><span>ROOM FOR EVERY VERSION OF YOU.</span></div><section className="gate-card"><span className="eyebrow">YOUR OWN LITTLE CORNER OF HPY</span><h1>You can be<br/>a work in progress.</h1><p>{expired ? 'Your session ended. Unlock to return to your draft.' : 'Come as you are. There’s room for all of it.'}</p><form onSubmit={async e => {
    e.preventDefault(); setBusy(true); setError('');
    try { await api('/unlock', { method: 'POST', body: { passcode } }); setPasscode(''); onUnlock(); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }}><label htmlFor="passcode">Your passcode</label><div className="password-wrap"><LockKeyhole size={18}/><input id="passcode" type={show ? 'text' : 'password'} autoComplete="current-password" value={passcode} onChange={e => setPasscode(e.target.value)} placeholder="A little key to your space" required maxLength={200}/><button type="button" className="text-button" aria-pressed={show} onClick={() => setShow(!show)}>{show ? 'Hide' : 'Show'}</button></div>{error && <p role="alert" className="error-text">{error}</p>}<button className="button dark" disabled={busy}>{busy ? 'Opening your space…' : 'Step inside'}<ArrowRight size={18}/></button></form><div className="gate-foot"><ShieldCheck size={14}/> Passcode protected. Yours to explore.</div></section><div className="gate-bottom">A little curiosity. A little courage. A little closer to yourself.</div></main>;
}

function HomePage({ go, startChat, entries, preferences }) {
  const [mood, setMood] = useState(null);
  const [note, setNote] = useState('');
  const [promptIndex, setPromptIndex] = useState(0);
  const prompts = ['What would being on your own side look like today?', 'What feeling could you make a little more room for?', 'Where could curiosity take the place of certainty?', 'What matters to you, even when things are messy?'];
  return <>
    <section className="home-hero"><div className="hero-copy"><div className="eyebrow"><span className="tiny-spark">✳</span> A PRACTICE, NOT A PERFECT VERSION</div><h1>A little closer<br/>to <span className="serif-italic">yourself.</span><svg className="title-scribble" viewBox="0 0 215 15" aria-hidden="true"><path d="M3 9 Q102 -4 207 6 M35 13 Q112 3 177 9"/></svg></h1><p>A playful space to feel, reflect, and find your way.<br className="desktop-break"/> No right answers. Just room to grow.</p><button className="button dark" onClick={() => go('world')}>Wander your world<ArrowUpRight size={17}/></button><span className="hero-footnote">Start wherever you are. Take the time you need.</span></div><div className="hero-landscape"><Suspense fallback={<div className="landscape-loading"><Flower size={70}/></div>}><Landscape compact onSelect={() => go('world')}/></Suspense><span className="hero-orbit-label">YOUR OWN LITTLE UNIVERSE</span><button className="explore-orbit" onClick={() => go('world')} aria-label="Enter your walkable world"><ArrowUpRight size={21}/></button><span className="hero-annotation">a little space<br/>to just be <svg width="40" height="30" viewBox="0 0 40 30" aria-hidden="true"><path d="M2 3 Q8 24 35 17 M29 12 L36 18 L28 23" fill="none" stroke="currentColor" strokeWidth="1.4"/></svg></span></div></section>
    <section className={`checkin ${mood ? 'expanded' : ''}`} aria-label="Emotional check-in"><div className="checkin-title"><span className="eyebrow">FIRST, A SMALL CHECK-IN</span><h2>What’s the weather inside?</h2><p>Any kind of day is welcome here.</p></div><div className="mood-choices">{MOOD_CHOICES.map(item => <button key={item.id} className={`mood-choice ${mood === item.id ? 'selected' : ''}`} aria-pressed={mood === item.id} onClick={() => setMood(item.id)}><MoodFace mood={item}/><span>{item.label}</span></button>)}</div>{mood && <div className="checkin-note"><label className="sr-only" htmlFor="checkin-note">Anything behind that feeling?</label><input id="checkin-note" placeholder="Anything behind that feeling? A few words, if you like…" value={note} maxLength={1000} onChange={e => setNote(e.target.value)}/><button className="text-button" onClick={() => startChat(`I’m feeling ${MOOD_CHOICES.find(x => x.id === mood).label.toLowerCase()} today.${note ? ` ${note}` : ''}`)}>Make room for this<ArrowRight size={16}/></button></div>}</section>
    {preferences.themes?.length > 0 && <div className="personal-doors"><span className="eyebrow">A FEW DOORS YOU CHOSE</span><div className="chips">{THEMES.filter(t => preferences.themes.includes(t.id)).map(t => <button className="chip" key={t.id} onClick={() => startChat(THEME_INVITATIONS[t.id], 'question', t.id)}>{t.label}<ArrowUpRight size={13}/></button>)}</div></div>}
    <section className="modes-section"><div className="section-title"><div><span className="eyebrow">FOLLOW YOUR CURIOSITY</span><h2>There’s more than one way in.</h2></div><span className="section-note">Pick what feels right today <span>↙</span></span></div><div className="mode-grid">{MODES.map(mode => <button key={mode.id} onClick={() => go(mode.id)} className={`mode-card ${mode.color}`}><div className="mode-card-top"><span className="mode-icon"><mode.icon size={25} strokeWidth={1.5}/></span>{mode.badge && <span className="mode-badge">{mode.badge}</span>}<ArrowUpRight className="card-arrow" size={21}/></div><div><span className="card-eyebrow">{mode.eyebrow}</span><h3>{mode.name}</h3><p>{mode.text}</p></div><div className="mode-meta"><span className="tiny-dot"/>{mode.meta}</div></button>)}</div></section>
    <section className="pocket-prompt"><div className="pocket-symbol"><Sparkles size={29} strokeWidth={1.2}/></div><div><span className="eyebrow">A QUESTION TO CARRY WITH YOU</span><h2>{prompts[promptIndex]}</h2><button className="text-button" onClick={() => startChat(prompts[promptIndex], 'question')}>Sit with this<ArrowUpRight size={15}/></button></div><button className="icon-button" onClick={() => setPromptIndex((promptIndex + 1) % prompts.length)} aria-label="Another question"><RotateCcw size={18}/></button></section>
    <footer className="home-footer"><BrandMark size={21}/><p>Growing isn’t a straight line. You’re allowed to take the scenic route.</p><span>{entries.length ? `${entries.length} reflection${entries.length === 1 ? '' : 's'} kept` : 'A little more you. With HPY.'}</span></footer>
  </>;
}

function Preferences({ initial, onSave, onClose }) {
  const [name, setName] = useState(initial.name || '');
  const [themes, setThemes] = useState(initial.themes || []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return <Modal title="Make yourself at home" onClose={onClose}><p className="muted">Only you get to decide what growth means here.</p><label className="field-label" htmlFor="preferred-name">What would you like to be called? <span>(optional)</span></label><input className="input" id="preferred-name" value={name} maxLength={60} onChange={e => setName(e.target.value)} placeholder="Your name"/><label className="field-label">What’s on your mind lately?</label><div className="chips">{THEMES.map(theme => <button className={`chip ${themes.includes(theme.id) ? 'active' : ''}`} key={theme.id} aria-pressed={themes.includes(theme.id)} onClick={() => setThemes(themes.includes(theme.id) ? themes.filter(x => x !== theme.id) : [...themes, theme.id])}>{theme.label}</button>)}</div><p className="small muted">These are invitations you choose, not labels assigned to you.</p>{error && <p className="error-text" role="alert">{error}</p>}<button className="button dark" disabled={busy} onClick={async () => { setBusy(true); try { await onSave({ ...initial, name: name.trim(), themes }); onClose(); } catch (e) { setError(e.message); } finally { setBusy(false); } }}>Save my preferences<Check size={16}/></button></Modal>;
}

function PauseSpace({ onClose }) {
  const [playing, setPlaying] = useState(true);
  const [grounding, setGrounding] = useState(false);
  return <Modal title="Nothing to solve for a moment." className="pause-modal" onClose={onClose}><p>Let this be a small pause. Follow a comfortable breath, or simply watch the circle.</p><div className={`breath-orb ${playing ? '' : 'paused'}`} aria-hidden="true"><div/><span>just here.</span></div><button className="text-button" onClick={() => setPlaying(!playing)}>{playing ? 'Pause the movement' : 'Let it move'}</button><div className="grounding-card"><button className="text-button" onClick={() => setGrounding(!grounding)}>Prefer something grounded?<ChevronRight size={16} className={grounding ? 'rotate90' : ''}/></button>{grounding && <p>What are three things you can see? Two points where your body meets a surface? One sound you can hear? You can skip anything that doesn’t feel comfortable.</p>}</div><button className="button dark" onClick={onClose}>Come back when you’re ready<ArrowRight size={16}/></button></Modal>;
}

function Support({ onClose }) {
  return <Modal title="You deserve real support, too." onClose={onClose}><p>This is a reflection and skills practice space. It isn’t therapy, a diagnosis, or a crisis service. Its prompts are scripted and can miss what you mean.</p><div className="support-box"><h3>If you might act on thoughts of harm</h3><p>Reach someone who can be with you now. If there’s immediate danger, call your local emergency number or go to an emergency department.</p><a className="button dark" href="tel:988">US & Canada: call 988<ArrowUpRight size={16}/></a><a href="https://findahelpline.com/" target="_blank" rel="noreferrer" className="text-button">Find support in your country<ArrowUpRight size={16}/></a><p className="small">In the US, you can also text 988 or <a href="https://988lifeline.org/" target="_blank" rel="noreferrer">chat with the 988 Lifeline</a>. In Canada, you can <a href="https://988.ca/" target="_blank" rel="noreferrer">call or text 988</a>.</p></div><p className="small muted">For ongoing patterns or relationship distress, a qualified therapist or a trusted person can offer the context and care an app cannot.</p></Modal>;
}

function Privacy({ onClose }) {
  return <Modal title="Your space, with clear boundaries." onClose={onClose}><div className="privacy-item"><ShieldCheck/><div><h3>A real passcode gate</h3><p>Access is checked by the server. Your passcode isn’t included in the website’s client code.</p></div></div><div className="privacy-item"><BookOpen/><div><h3>You choose what stays</h3><p>Reflections stay in the current page until you choose “Keep this reflection.” Saved entries are encrypted on this app’s server. You can export or delete them in your journal. Unsaved drafts disappear when you lock or refresh.</p></div></div><div className="privacy-item"><MessageCircle/><div><h3>Questions, without a hidden AI service</h3><p>Text reflection uses a local, scripted prompt engine. Your writing is not sent to an AI provider. Optional voice typing uses your browser’s speech service, which may process audio online.</p></div></div><p className="small muted">This is a shared-passcode space, not an individual account. Anyone with the passcode can access its saved journal. Server administrators can access the encryption key. Use HTTPS if you publish it online.</p></Modal>;
}

export default function App() {
  const [auth, setAuth] = useState(null);
  const [expired, setExpired] = useState(false);
  const [sessionError, setSessionError] = useState('');
  const [route, setRoute] = useState('world');
  const [entries, setEntries] = useState([]);
  const [preferences, setPreferences] = useState({ themes: [], values: [] });
  const [dialog, setDialog] = useState(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 740px)').matches);
  const sidebarRef = useRef(null);
  const menuRef = useRef(null);
  const [toast, setToast] = useState('');
  const [chatSeed, setChatSeed] = useState({ text: '', key: 0 });
  const [drafts, setDrafts] = useState({});
  const [loadError, setLoadError] = useState('');
  const checkSession = () => { setSessionError(''); api('/session').then(x => setAuth(x.authenticated)).catch(e => setSessionError(e.message)); };
  useEffect(checkSession, []);
  useEffect(() => { const mq = window.matchMedia('(max-width: 740px)'); const change = () => { setIsMobile(mq.matches); if (!mq.matches) setMobileNav(false); }; mq.addEventListener('change', change); return () => mq.removeEventListener('change', change); }, []);
  useEffect(() => { if (!mobileNav || !isMobile) return; sidebarRef.current?.querySelector('button')?.focus(); const close = e => { if (e.key === 'Escape') { setMobileNav(false); menuRef.current?.focus(); } }; document.addEventListener('keydown', close); return () => document.removeEventListener('keydown', close); }, [mobileNav, isMobile]);
  useEffect(() => { const expire = () => { setExpired(true); setAuth(false); setDialog(null); }; window.addEventListener('becoming:session-ended', expire); return () => window.removeEventListener('becoming:session-ended', expire); }, []);
  useEffect(() => {
    if (auth) window.scrollTo({ top: 0, behavior: 'instant' });
    if (auth) Promise.all([api('/journal'), api('/preferences')]).then(([j, p]) => { setEntries(j.entries || []); setPreferences(p.preferences || p); setLoadError(''); }).catch(e => { if (e.status === 401) setAuth(false); else setLoadError(e.message); });
  }, [auth]);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(''), 4200); return () => clearTimeout(t); } }, [toast]);
  const openDialog = id => { setMobileNav(false); setDialog(id); };
  const go = id => { setRoute(id); setMobileNav(false); window.scrollTo({ top: 0, behavior: 'instant' }); };
  const startChat = (text, kind = 'message', theme = null) => { if (text) setChatSeed({ text, kind, theme, key: Date.now() }); go('talk'); };
  const updateDraft = (id, value) => setDrafts(d => ({ ...d, [id]: value }));
  const save = async entry => {
    try { const result = await api('/journal', { method: 'POST', body: entry }); setEntries(old => [result.entry, ...old]); setToast('A small piece of your becoming, kept.'); return result.entry; }
    catch (e) { if (e.status === 401) { setToast('Your session has ended. Unlock to continue.'); setAuth(false); } throw e; }
  };
  const savePreferences = async value => { const result = await api('/preferences', { method: 'POST', body: value }); setPreferences(result.preferences || value); };
  const lock = async () => { try { await api('/lock', { method: 'POST' }); setAuth(false); setExpired(false); setDrafts({}); setEntries([]); setPreferences({ themes: [], values: [] }); setChatSeed({ text: '', key: 0 }); setRoute('world'); setDialog(null); } catch(e) { setToast(e.message); } };
  if (auth === null) return <main className="loading-screen"><BrandMark size={36}/><p>{sessionError || 'Making a little space…'}</p>{sessionError && <button className="button dark" onClick={checkSession}>Try again</button>}</main>;
  if (!auth) return <Gate expired={expired} onUnlock={() => { setAuth(true); setExpired(false); }}/>;
  const activeMode = MODES.find(x => x.id === route);
  const modeProps = { onSave: save, go, preferences, onPreferences: savePreferences, draft: drafts[route], setDraft: value => updateDraft(route, value), onSupport: () => setDialog('support') };
  const sharedOverlays = <>{toast && <div className="toast" role="status"><Check size={16}/>{toast}</div>}{dialog === 'preferences' && <Preferences initial={preferences} onSave={savePreferences} onClose={() => setDialog(null)}/>}{dialog === 'pause' && <PauseSpace onClose={() => setDialog(null)}/>}{dialog === 'support' && <Support onClose={() => setDialog(null)}/>}{dialog === 'privacy' && <Privacy onClose={() => setDialog(null)}/>}</>;
  const renderActivity = (id, close, navigate) => {
    const activityProps = { ...modeProps, draft: drafts[id], setDraft: value => updateDraft(id, value), go: target => target === 'home' || target === 'world' ? close() : navigate(target) };
    if (id === 'talk') return <ChatMode {...activityProps} seed={chatSeed}/>;
    if (id === 'landscape') return <LandscapeMode {...activityProps}/>;
    if (id === 'compass') return <CompassMode {...activityProps}/>;
    if (id === 'replay') return <ReplayMode {...activityProps}/>;
    if (id === 'skills') return <SkillsMode {...activityProps}/>;
    if (id === 'wisdom') return <WisdomMode {...activityProps}/>;
    if (id === 'journal') return <JournalMode {...activityProps} entries={entries} setEntries={setEntries}/>;
    return null;
  };
  if (route === 'world') return <div className="world-shell"><div inert={Boolean(dialog)}><Suspense fallback={<main className="loading-screen"><BrandMark size={40}/><p>Your world is taking shape…</p></main>}><WorldExperience draft={drafts.world} onDraft={value => updateDraft('world', value)} onSave={save} renderActivity={renderActivity} name={preferences.name} loadError={loadError} externalPaused={Boolean(dialog)} onOverview={() => go('home')} onLock={lock} onPreferences={() => openDialog('preferences')} onPause={() => openDialog('pause')} onSupport={() => openDialog('support')} onPrivacy={() => openDialog('privacy')}/></Suspense></div>{sharedOverlays}</div>;
  return <div className="app-shell"><a className="skip-link" href="#main-content">Skip to content</a>{mobileNav && <div className="nav-backdrop" onClick={() => setMobileNav(false)}/>}<aside ref={sidebarRef} inert={isMobile && !mobileNav} className={`sidebar ${mobileNav ? 'mobile-open' : ''}`}><button className="brand" onClick={() => go('home')} aria-label="HPY home"><Brand/></button><button className="icon-button mobile-nav-close" aria-label="Close navigation" onClick={() => { setMobileNav(false); menuRef.current?.focus(); }}><X size={18}/></button><div className="sidebar-tagline">your space for becoming</div><nav aria-label="Main navigation"><button className="nav-item" onClick={() => go('world')}><Orbit size={18}/><span>Wander your world</span><ArrowUpRight size={14}/></button><button className={`nav-item home-item ${route === 'home' ? 'active' : ''}`} onClick={() => go('home')}><Home size={18}/><span>All sections</span>{route === 'home' && <span className="active-dot"/>}</button><div className="nav-label">WAYS TO EXPLORE</div>{MODES.map(mode => <button key={mode.id} className={`nav-item ${route === mode.id ? 'active' : ''}`} onClick={() => go(mode.id)} aria-current={route === mode.id ? 'page' : undefined}><mode.icon size={18} strokeWidth={1.6}/><span>{mode.name}</span>{route === mode.id && <span className="active-dot"/>}</button>)}<div className="nav-divider"/><button className={`nav-item ${route === 'journal' ? 'active' : ''}`} onClick={() => go('journal')}><BookOpen size={18}/><span>My little journal</span>{entries.length > 0 && <span className="count-pill">{entries.length}</span>}</button></nav><div className="sidebar-bottom"><button className="pause-card" onClick={() => openDialog('pause')}><span className="pause-icon"><Sprout size={22} strokeWidth={1.4}/></span><strong>A moment to arrive</strong><span>No figuring it out. Just a pause.</span><ArrowUpRight size={17}/></button><div className="sidebar-footer"><button className="text-button" onClick={() => openDialog('privacy')}><LockKeyhole size={13}/> Your private corner</button><button className="text-button support-link" onClick={() => openDialog('support')}>Need support?</button></div></div></aside><div className="main-shell" inert={isMobile && mobileNav}><header className="topbar"><div className="topbar-breadcrumb"><button ref={menuRef} className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setMobileNav(true)}><Menu size={21}/></button><span className="mobile-brand" role="img" aria-label="HPY"><Brand/></span><span className="status-dot"/><span className="topbar-greeting">{preferences.name ? `A little space for ${preferences.name}` : 'A little space for you'}</span>{route !== 'home' && <><ChevronRight size={13}/><span className="breadcrumb-current">{activeMode?.name || 'My little journal'}</span></>}</div><div className="topbar-actions"><span className="no-rush"><span>✧</span> There’s no rush.</span><button className="icon-button" aria-label="Personalize your space" onClick={() => openDialog('preferences')}><Settings2 size={17}/></button><button className="icon-button topbar-support" aria-label="Need support?" onClick={() => openDialog('support')}><Heart size={17}/></button><button className="icon-button" aria-label="Lock your space" onClick={lock}><LockKeyhole size={17}/></button><button className="avatar" aria-label="Your preferences" onClick={() => openDialog('preferences')}>{preferences.name ? preferences.name[0].toUpperCase() : <BrandMark size={25}/>}</button></div></header><main id="main-content" className={`main-content route-${route}`}><div className="content-inner">{loadError && <div role="alert" className="error-banner">Your saved space couldn’t load: {loadError} <button className="text-button" onClick={() => { setAuth(null); checkSession(); }}>Reconnect</button></div>}{route === 'home' && <HomePage go={go} startChat={startChat} entries={entries} preferences={preferences}/>}{route === 'talk' && <ChatMode {...modeProps} seed={chatSeed}/>}{route === 'landscape' && <LandscapeMode {...modeProps}/>}{route === 'compass' && <CompassMode {...modeProps}/>}{route === 'replay' && <ReplayMode {...modeProps}/>}{route === 'skills' && <SkillsMode {...modeProps}/>}{route === 'wisdom' && <WisdomMode {...modeProps}/>}{route === 'journal' && <JournalMode {...modeProps} entries={entries} setEntries={setEntries} go={go} onSave={save}/>}</div></main></div>{sharedOverlays}</div>;
}
