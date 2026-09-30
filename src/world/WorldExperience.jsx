import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Check, Compass, Flower2, Footprints, HelpCircle, Layers, LockKeyhole, Map as MapIcon, Maximize2, Mic, Minus, MoreHorizontal, Move, Pause, Plus, RotateCcw, Settings2, ShieldCheck, Sparkles } from 'lucide-react';
import { Brand, BrandMark } from '../Brand';
import { Modal } from '../UI';
import WorldCanvas from './WorldCanvas';
import Encounter from './Encounter';
import { ENCOUNTERS } from './encounters';
import { WORLD_STATIONS } from './environment';
import { getWorld, WORLD_CHAPTERS } from '../journey/catalog';
import { useJourney } from '../journey/useJourney';
import JourneyPanel from '../journey/JourneyPanel';
import VoiceCompanion from '../voice/VoiceCompanion';
import './world.css';

const COLORS = [{ name: 'Lilac', value: '#b590d0' }, { name: 'Coral', value: '#df917a' }, { name: 'Moss', value: '#829f72' }, { name: 'Sky', value: '#7ca5c3' }];
const INITIAL_SCENE = { position: { x: 0, z: 14 }, nearest: null, projected: [], walking: false, destination: null };
const TOUCH_LAYOUT = '(any-pointer: coarse), (max-width: 700px), (max-height: 500px) and (max-width: 1000px)';

function IslandMap({ position, visited, selected, onSelect, miniature = false }) {
  const point = (x, z) => ({ x: 100 + x * 2.15, y: 101 + z * 2.15 });
  const player = point(position.x, position.z);
  return <svg className={`world-island-map ${miniature ? 'miniature' : ''}`} viewBox="0 0 200 200" role="img" aria-label="Island map showing your position and six places">
    <defs><radialGradient id={miniature ? 'sea-mini' : 'sea-full'}><stop stopColor="#c7e5de"/><stop offset="1" stopColor="#a9cfd0"/></radialGradient></defs>
    <rect width="200" height="200" rx="100" fill={`url(#${miniature ? 'sea-mini' : 'sea-full'})`}/>
    <path d="M103 16C129 12 145 33 160 46S187 81 181 114S155 159 132 174S87 187 56 169S19 129 20 96S43 48 63 31S82 20 103 16Z" fill="#e9d7b2" stroke="#f0e4c9" strokeWidth="5"/>
    <path d="M103 22C127 18 142 40 157 52S180 84 174 113S148 155 128 167S88 179 60 163S25 129 28 98S47 53 66 37S84 27 103 22Z" fill="#b2c68d"/>
    <g fill="none" stroke="#eee0ba" strokeWidth={miniature ? '3' : '4'} strokeLinecap="round"><path d="M100 131L74 118L55 86L74 52L100 67L147 82L126 120L100 131L100 67M74 118L126 120M55 86L100 67"/></g>
    <g fill="#83a46e" opacity=".6"><circle cx="47" cy="120" r="12"/><circle cx="144" cy="141" r="13"/><circle cx="125" cy="43" r="9"/><circle cx="52" cy="63" r="8"/></g>
    {WORLD_STATIONS.map(s => { const p = point(s.x, s.z); return <g key={s.id} transform={`translate(${p.x},${p.y})`} className={onSelect ? 'map-place' : ''} onClick={onSelect ? () => onSelect(s.id) : undefined}>
      {selected === s.id && <circle r="11" fill="none" stroke="#775486" strokeWidth="1.5"/>}
      <circle r={miniature ? '4.5' : '7'} fill={visited.includes(s.id) ? '#775486' : '#fffaf0'} stroke="#fffaf0" strokeWidth="2"/>
      {!miniature && <text textAnchor="middle" y="2.6" fontSize="7" fill={visited.includes(s.id) ? '#fff' : '#745d76'}>{WORLD_STATIONS.indexOf(s) + 1}</text>}
    </g>; })}
    <circle cx={player.x} cy={player.y} r={miniature ? '5' : '5.5'} fill="#ef9679" stroke="white" strokeWidth="2"/>
    <text x="100" y="11" textAnchor="middle" fontSize="7" fill="#527170">N</text>
  </svg>;
}

function Joystick({ controller, disabled }) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const pointer = useRef(null);
  const stop = useCallback(event => {
    const active = pointer.current;
    // A second finger must not take over or release the movement finger.
    if (typeof event?.pointerId === 'number' && event.pointerId !== active?.id) return;
    pointer.current = null;
    if (active?.element.hasPointerCapture(active.id)) active.element.releasePointerCapture(active.id);
    setOffset({ x: 0, y: 0 });
    controller.current?.setMovement({ x: 0, y: 0, active: false });
  }, [controller]);
  useEffect(() => { if (disabled) stop(); }, [disabled, stop]);
  useEffect(() => {
    const visibility = () => { if (document.hidden) stop(); };
    window.addEventListener('blur', stop);
    document.addEventListener('visibilitychange', visibility);
    return () => { window.removeEventListener('blur', stop); document.removeEventListener('visibilitychange', visibility); stop(); };
  }, [stop]);
  const move = event => {
    if (pointer.current?.id !== event.pointerId) return;
    const box = event.currentTarget.getBoundingClientRect();
    const dx = event.clientX - box.left - box.width / 2, dy = event.clientY - box.top - box.height / 2;
    const radius = Math.max(20, (box.width - 48) / 2);
    const distance = Math.hypot(dx, dy), scale = Math.max(1, distance / radius);
    setOffset({ x: dx / scale, y: dy / scale });
    const strength = Math.max(0, (Math.min(1, distance / radius) - 0.12) / 0.88);
    controller.current?.setMovement({ x: distance ? dx / distance * strength : 0, y: distance ? -dy / distance * strength : 0, active: true });
  };
  return <div className="world-joystick-wrap"><button type="button" className="world-joystick" aria-label="Movement joystick: drag in the direction you want to walk" disabled={disabled}
    onPointerDown={e => {
      if (disabled || pointer.current || (e.pointerType === 'mouse' && e.button !== 0)) return;
      e.preventDefault();
      pointer.current = { id: e.pointerId, element: e.currentTarget };
      e.currentTarget.setPointerCapture(e.pointerId); move(e);
    }} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop}>
    <span className="joystick-cross"/><span className="joystick-thumb" style={{ transform: `translate(${offset.x}px,${offset.y}px)` }}><Move size={23}/></span>
  </button><span>Drag to move</span></div>;
}

function ControlInstructions({ touch }) {
  const rows = touch ? [
    ['Move', 'Drag the joystick with your thumb. Let go to stop.'],
    ['Look', 'Swipe left or right across the world. You can look while walking.'],
    ['Zoom', 'Pinch with two fingers, or tap the + and − camera buttons.'],
    ['Tap', 'Tap open ground to walk there. Tap a nearby place’s invitation to explore.'],
    ['Map', 'Pick a place and tap Walk here, or use Open practice to go straight in.'],
  ] : [
    ['W A S D', 'or arrow keys to move'], ['Click', 'on the ground to walk there'],
    ['Drag', 'the world to look around'], ['Scroll', 'to move the camera closer'],
    ['E', 'to explore a nearby place'], ['Shift', 'to run a little'], ['Space', 'for a little hop'],
  ];
  return <div className="world-controls">{rows.map(([label, text]) => <div key={label}>{touch ? <span className="world-control-label">{label}</span> : <kbd>{label}</kbd>}<span>{text}</span></div>)}</div>;
}

export default function WorldExperience({ draft, onDraft, onSave, renderActivity, onOverview, onLock, onPreferences, onPause, onSupport, onPrivacy, externalPaused, name, loadError }) {
  const [touchControls, setTouchControls] = useState(() => window.matchMedia(TOUCH_LAYOUT).matches);
  useEffect(() => {
    const query = window.matchMedia(TOUCH_LAYOUT);
    const update = () => setTouchControls(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  const { journey, latest: journeyRef, error: journeyError, request: journeyAction, refresh: refreshJourney } = useJourney();
  const worldId = journey?.activeWorldId || 'arrival';
  const chapter = getWorld(worldId) || WORLD_CHAPTERS[0];
  const [localProgress, setProgress] = useState(() => ({ entered: false, color: COLORS[0].value, reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches, encounters: {}, ...draft }));
  const worldProgress = journey?.worlds.find(world => world.id === worldId);
  const progress = { ...localProgress, visited: worldProgress?.visited || [], completed: worldProgress?.completed || [] };
  const progressRef = useRef(localProgress), onDraftRef = useRef(onDraft);
  onDraftRef.current = onDraft;
  const updateProgress = useCallback(patch => { const next = { ...progressRef.current, ...patch }; progressRef.current = next; setProgress(next); onDraftRef.current?.(next); }, []);
  const controller = useRef(null);
  const sceneElement = useRef(null);
  const [scene, setScene] = useState(INITIAL_SCENE);
  const [readyWorldId, setReadyWorldId] = useState(null);
  const ready = readyWorldId === worldId;
  const [error, setError] = useState(false);
  const [panel, setPanel] = useState(() => new URLSearchParams(window.location.search).get('setup') === 'openai' ? 'connection' : null);
  const [encounter, setEncounter] = useState(null);
  const [activity, setActivity] = useState(null);
  const [selected, setSelected] = useState('talk');
  const [pendingTravel, setPendingTravel] = useState(null);
  const [notice, setNotice] = useState('');
  const [voiceRegion, setVoiceRegion] = useState(null);
  const visitsInFlight = useRef(new Map());
  const overlayOpen = !!(panel || encounter || activity || voiceRegion || externalPaused);
  const paused = !progress.entered || !journey || overlayOpen || error;
  useEffect(() => {
    if (paused) return;
    const frame = requestAnimationFrame(() => sceneElement.current?.querySelector('canvas')?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [paused]);
  const closePanel = () => setPanel(null);
  const enter = () => { updateProgress({ entered: true }); controller.current?.resetView(); };
  const visit = useCallback(id => {
    if (journeyRef.current?.worlds.find(world => world.id === worldId)?.visited.includes(id)) return Promise.resolve();
    const key = `${worldId}:${id}`;
    if (visitsInFlight.current.has(key)) return visitsInFlight.current.get(key);
    const operation = journeyAction('/journey/visit', { worldId, regionId: id }).finally(() => visitsInFlight.current.delete(key));
    visitsInFlight.current.set(key, operation);
    return operation;
  }, [worldId, journeyAction, journeyRef]);
  const discover = useCallback(id => { visit(id).catch(err => setNotice(err.message)); }, [visit]);
  const interact = useCallback(async id => {
    if (!ENCOUNTERS[id]) return;
    setPanel(null); setEncounter(id);
    try { await visit(id); } catch (err) { setNotice(err.message); }
  }, [visit]);
  const complete = async (id, data) => {
    await visit(id);
    if (journeyRef.current?.worlds.find(world => world.id === worldId)?.completed.includes(id)) {
      await journeyAction('/journey/insights', { worldId, regionId: id, source: 'reflection', text: [...data.answers.filter(Boolean), `My takeaway: ${data.takeaway}`, data.nextStep && `My next step: ${data.nextStep}`].filter(Boolean).join('\n\n') });
      setNotice('A new insight, kept in your journey.');
      return;
    }
    const result = await journeyAction('/journey/complete', { worldId, regionId: id, ...data });
    const completeWorld = result.journey.worlds.find(world => world.id === worldId);
    const nextWorld = WORLD_CHAPTERS[chapter.level];
    setNotice(completeWorld.completed.length === 6 && nextWorld ? `${nextWorld.title} is open. Visit My journey to step inside.` : 'A flower for your reflection. Your insight is saved.');
  };
  const selectWorld = async id => {
    if (id === worldId) { setPanel(null); return; }
    await journeyAction('/journey/world', { worldId: id });
    setReadyWorldId(null); setError(false); setScene(INITIAL_SCENE); setPendingTravel(null);
    setPanel(null); setEncounter(null); setActivity(null); updateProgress({ entered: true });
  };
  const openVoice = (id = 'talk') => { setPanel(null); setEncounter(null); setVoiceRegion(id); };
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 4500); return () => clearTimeout(timer); }, [notice]);
  useEffect(() => {
    if (!pendingTravel || paused || !ready) return;
    if (!controller.current?.travelTo(pendingTravel)) setNotice('That path is out of reach. Try walking a little closer.');
    setPendingTravel(null);
  }, [pendingTravel, paused, ready]);
  const travel = id => { setPanel(null); setEncounter(null); setActivity(null); updateProgress({ entered: true }); setPendingTravel(id); };
  const openActivity = id => { setPanel(null); setEncounter(null); setActivity(id); };
  const station = WORLD_STATIONS.find(s => s.id === selected);
  const near = typeof scene.nearest === 'string' ? WORLD_STATIONS.find(s => s.id === scene.nearest) : scene.nearest;

  return <main className={`world-experience ${progress.entered ? 'has-entered' : 'is-arriving'} ${progress.reducedMotion ? 'reduced-motion' : ''} ${touchControls ? 'has-touch-controls' : ''}`} aria-label="HPY: your world" onPointerDownCapture={event => { if (event.pointerType === 'touch') setTouchControls(true); }}>
    <div className="world-scene" ref={sceneElement} inert={paused}>{journey && <WorldCanvas key={worldId} worldId={worldId} ref={controller} paused={paused} reducedMotion={progress.reducedMotion} characterColor={progress.color} completed={progress.completed} onUpdate={setScene} onInteract={interact} onDiscover={discover} onReady={() => setReadyWorldId(worldId)} onError={() => setError(true)}/>}</div>
    <div className="world-vignette" aria-hidden="true"/>
    <div className="world-hud" inert={overlayOpen}>
      <header className="world-topbar"><button className="world-brand" aria-label="HPY world menu" onClick={() => setPanel('menu')}><Brand/><span>{chapter.title}</span></button>
        <nav className="world-top-actions" aria-label="World navigation"><button className="world-tool" aria-label="My journey and worlds" onClick={() => setPanel('journey')}><Layers size={18}/><span>My journey</span></button><button className="world-tool" aria-label="Voice companion" onClick={() => openVoice(near?.id || 'talk')}><Mic size={18}/><span>Voice</span></button><button className="world-tool" aria-label="Map" onClick={() => setPanel('map')}><MapIcon size={17}/><span>Map</span></button><button className="world-tool" aria-label="Journal" onClick={() => openActivity('journal')}><BookOpen size={17}/><span>Journal</span></button><button className="world-tool world-tool-round" aria-label="World settings and other sections" onClick={() => setPanel('menu')}><MoreHorizontal size={21}/></button></nav>
      </header>
      {progress.entered && <>
        <div className="world-discoveries"><span className="world-discovery-icon"><Compass size={19}/></span><div><span>WORLD {chapter.level} · {chapter.subtitle.toUpperCase()}</span><p>{progress.completed.length} of 6 modules complete</p></div><div className="world-discovery-dots" aria-label={`${progress.completed.length} moment${progress.completed.length === 1 ? '' : 's'} carried`}>{WORLD_STATIONS.map(s => <span key={s.id} title={`${s.label}${progress.completed.includes(s.id) ? ' · moment carried' : ''}`} className={progress.completed.includes(s.id) ? 'carried' : progress.visited.includes(s.id) ? 'found' : ''}>{progress.completed.includes(s.id) ? <Flower2 size={12}/> : null}</span>)}</div></div>
        {!error && <div className="world-place-labels" aria-label="Nearby places">{(scene.projected || []).filter(p => p.visible && p.distance < 32 && p.y > 230).sort((a, b) => a.distance - b.distance).slice(0, 3).map(p => { const place = WORLD_STATIONS.find(s => s.id === p.id); if (!place) return null; return <button key={p.id} className={`world-place-label ${near?.id === p.id ? 'near' : ''}`} style={{ left: p.x, top: p.y }} onClick={() => near?.id === p.id ? interact(p.id) : travel(p.id)} aria-label={`${near?.id === p.id ? 'Explore' : 'Walk to'} ${place.label}`}><span className="world-place-marker">{progress.completed.includes(p.id) ? <Flower2 size={15}/> : <Sparkles size={13}/>}</span><span>{place.label}</span></button>; })}</div>}
        <div className="world-bottom-left"><button className="world-help" onClick={() => setPanel('help')}><HelpCircle size={16}/><span>{touchControls ? 'Controls' : 'How to wander'}</span></button><div className="world-key-hints"><kbd>W A S D</kbd><span>move</span><i/>click to walk<i/>drag to look</div></div>
        <button className="world-minimap" onClick={() => setPanel('map')} aria-label="Open island map"><IslandMap position={scene.position} visited={progress.visited} miniature/><span>Island map <ArrowRight size={12}/></span></button>
        {!error && <Joystick controller={controller} disabled={paused}/>}
        {!error && <div className="world-touch-camera"><p>Swipe to look<br/>Pinch to zoom</p><div className="world-camera-buttons" role="group" aria-label="Camera controls"><button aria-label="Zoom out" title="Zoom out" disabled={paused} onClick={() => controller.current?.zoomBy(2)}><Minus size={21}/></button><button aria-label="Reset camera view" title="Reset camera view" disabled={paused} onClick={() => controller.current?.resetView()}><RotateCcw size={20}/></button><button aria-label="Zoom in" title="Zoom in" disabled={paused} onClick={() => controller.current?.zoomBy(-2)}><Plus size={21}/></button></div></div>}
        {!error && <div className="world-interact-area">{near ? <button className="world-interact" onClick={() => interact(near.id)}><span className="interact-key">E</span><span><small>{near.label}</small>{chapter.modules[near.id]?.activityLabel || 'Explore this place'}</span><ArrowRight size={18}/></button> : scene.walking && <div className="world-walking"><Footprints size={15}/>{scene.destination ? `On your way to ${WORLD_STATIONS.find(s => s.id === scene.destination)?.label || 'a new place'}` : 'Taking the scenic route'}</div>}</div>}
        <p className="sr-only" aria-live="off">Your position: {scene.position.x.toFixed(1)}, {scene.position.z.toFixed(1)}. {near ? `Near ${near.label}. ${touchControls ? 'Tap its invitation to explore.' : 'Press E to explore.'}` : 'Use the map to walk to a place.'}</p>
      </>}
      {!progress.entered && !error && <section className="world-welcome"><span className="world-kicker"><span/>YOUR WORLD, AT YOUR PACE</span><h1>{name ? `Hey ${name}.` : 'Come as you are.'}<br/><em>Wander a little.</em></h1><p>Three worlds. Six places in each. Save a small discovery from each module to open the next chapter of your journey.</p><button className="world-enter" disabled={!ready} onClick={enter}>{ready ? 'Let’s wander' : 'Growing your world…'}<ArrowRight size={19}/></button><span className="world-welcome-foot">{touchControls ? 'Drag to move. Swipe to look. Take your time.' : 'An unfolding journey. At your own pace.'}</span></section>}
      {!ready && !error && <div className="world-loading" role="status"><BrandMark size={40}/><span>A little world is taking shape…</span></div>}
      {error && <section className="world-fallback"><BrandMark size={48}/><h1>The world couldn’t open here.</h1><p>You can still visit every practice. Try a browser with WebGL enabled when you’d like to wander.</p><button className="button dark" onClick={onOverview}>Explore the sections<ArrowRight size={16}/></button></section>}
    </div>
    {notice && !overlayOpen && progress.entered && <div className="world-notice" role="status"><Flower2 size={15}/>{notice}</div>}
    {journeyError && <div className="world-load-error" role="alert">Your journey couldn’t load: {journeyError} <button className="text-button" onClick={refreshJourney}>Try again</button></div>}
    {loadError && <div className="world-load-error" role="alert">Your saved reflections couldn’t load: {loadError}</div>}
    {panel === 'map' && <Modal title="Where shall we wander?" className="world-map-dialog" onClose={closePanel}><p>Follow a path, or open a practice wherever you are.</p><div className="world-map-layout"><IslandMap position={scene.position} visited={progress.visited} selected={selected} onSelect={setSelected}/><div className="world-map-list">{WORLD_STATIONS.map((s, i) => <button key={s.id} className={selected === s.id ? 'selected' : ''} onClick={() => setSelected(s.id)}><span>{progress.completed.includes(s.id) ? <Flower2 size={14}/> : `0${i + 1}`}</span><div><strong>{s.label}</strong><small>{chapter.modules[s.id].subtitle}</small></div>{selected === s.id && <ArrowRight size={16}/>}</button>)}</div></div><div className="world-map-choice"><div><span className="world-kicker">LET CURIOSITY LEAD</span><h3>{station.label}</h3></div><button className="button dark" disabled={error || !ready} onClick={() => travel(selected)}><Footprints size={17}/>Walk here</button><button className="text-button" onClick={() => interact(selected)}>Open module<ArrowRight size={14}/></button></div><p className="world-map-foot">The coral dot is you. Flowers mark completed modules, saved across visits.</p></Modal>}
    {panel === 'help' && <Modal title="Take the scenic route." className="world-help-dialog" onClose={closePanel}><p>There’s no score to chase. Go somewhere that feels interesting, and pause there for a question.</p><ControlInstructions touch={touchControls}/><p className="small">The map can guide your walk or take you straight into a practice. Reflections are only saved when you choose.</p><button className="button dark" onClick={closePanel}>Back to wandering<ArrowRight size={16}/></button></Modal>}
    {panel === 'menu' && <Modal title="Make this world yours." className="world-menu-dialog" onClose={closePanel}><span className="world-kicker">YOUR LITTLE TRAVELER</span><div className="world-color-options">{COLORS.map(c => <button key={c.name} aria-label={`${c.name} jacket`} aria-pressed={progress.color === c.value} style={{ '--jacket': c.value }} onClick={() => updateProgress({ color: c.value })}>{progress.color === c.value && <Check size={18}/>}</button>)}<span>A color for today</span></div><label className="world-motion-option"><input type="checkbox" checked={progress.reducedMotion} onChange={e => updateProgress({ reducedMotion: e.target.checked })}/><span>Gentler motion<small>Quieter scenery and instant camera adjustments</small></span></label><div className="world-menu-items"><button onClick={() => openActivity('journal')}><BookOpen size={18}/>My journal<ArrowRight size={15}/></button><button onClick={() => setPanel('journey')}><Layers size={18}/>My journey & other worlds<ArrowRight size={15}/></button><button onClick={() => openVoice()}><Mic size={18}/>Talk with my AI companion<ArrowRight size={15}/></button><button onClick={() => { controller.current?.resetView(); closePanel(); }}><Maximize2 size={18}/>Reset my view<ArrowRight size={15}/></button><button onClick={() => { closePanel(); onPause(); }}><Pause size={18}/>Take a small pause<ArrowRight size={15}/></button><button onClick={() => { closePanel(); onPreferences(); }}><Settings2 size={18}/>My name & what I’m practicing<ArrowRight size={15}/></button><button onClick={onOverview}><Layers size={18}/>Browse all sections<ArrowRight size={15}/></button><button onClick={() => setPanel('help')}><HelpCircle size={18}/>Movement & controls<ArrowRight size={15}/></button><button onClick={() => { closePanel(); onPrivacy(); }}><ShieldCheck size={18}/>Privacy & my reflections<ArrowRight size={15}/></button><button onClick={() => { closePanel(); onSupport(); }}><Flower2 size={18}/>Find real-world support<ArrowRight size={15}/></button><button onClick={onLock}><LockKeyhole size={18}/>Lock my space<ArrowRight size={15}/></button></div><p className="small muted">Your discoveries and completed modules are saved. Your private journey keeps the reflections and insights you choose to save. Unsaved words stay in this page.</p></Modal>}
    {encounter && <div className="world-encounter-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setEncounter(null); }}><Encounter worldId={worldId} module={chapter.modules[encounter]} stationId={encounter} onClose={() => setEncounter(null)} onDeepPractice={openActivity} onSave={onSave} onVoice={() => openVoice(encounter)} onComplete={complete} completed={progress.completed.includes(encounter)} draft={progress.encounters[`${worldId}:${encounter}`]} onDraft={value => updateProgress({ encounters: { ...progressRef.current.encounters, [`${worldId}:${encounter}`]: value } })}/></div>}
    {['journey', 'connection'].includes(panel) && journey && <JourneyPanel focusConnection={panel === 'connection'} journey={journey} onAction={journeyAction} onSelectWorld={selectWorld} onClose={closePanel} onVoice={() => openVoice()}/>}
    {voiceRegion && <VoiceCompanion worldId={worldId} regionId={voiceRegion} onClose={() => setVoiceRegion(null)} onSetup={() => { setVoiceRegion(null); setPanel('connection'); }} onSaveInsight={async insight => { await journeyAction('/journey/insights', insight); setNotice('Your voice takeaway is kept in your journey.'); }}/>}
    {activity && <Modal title={activity === 'journal' ? 'Things you chose to keep' : ENCOUNTERS[activity]?.title || 'A little room to practice'} className="world-activity" onClose={() => setActivity(null)}><button className="text-button world-back" onClick={() => setActivity(null)}><ArrowLeft size={15}/>Back to the world</button>{renderActivity(activity, () => setActivity(null), setActivity)}</Modal>}
  </main>;
}
