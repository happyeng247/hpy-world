import React, { useEffect, useId, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, Check, ChevronDown, Download, Flower2, KeyRound, Loader2, LockKeyhole, Mic, Moon, RefreshCw, Sprout, Sun, Trash2 } from 'lucide-react';
import { Modal } from '../UI';
import { api } from '../api';
import { REGION_IDS, WORLD_CHAPTERS, getWorld } from './catalog';
import './journey.css';

const WORLD_ICONS = { arrival: Sprout, practice: Moon, integration: Sun };
const REGION_NAMES = { talk: 'Listening Cove', landscape: 'Mirror Pool', compass: 'Compass Hill', replay: 'Rehearsal Theatre', skills: 'Stillwater Garden', wisdom: 'Wisdom Grove' };
const SOURCES = { encounter: 'Guided encounter', voice: 'Voice reflection', reflection: 'Your reflection' };
const dateLabel = value => {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

function ReviewList({ title, items, empty, className = '', evidenceForPattern, excerptLimit = 1500 }) {
  return <div className={`journey-review-list ${className}`}><h4>{title}</h4>{items?.length ? <ul>{items.map((item, index) => {
    const evidence = evidenceForPattern?.(index);
    return <li key={index}>{item}{evidence && <details className="journey-pattern-evidence"><summary>Supporting saved words<ChevronDown size={15}/></summary>{evidence.length ? evidence.map(insight => <blockquote key={insight.id}><div><span>{SOURCES[insight.source] || 'Saved insight'}</span><time dateTime={insight.createdAt}>Saved {dateLabel(insight.createdAt)}</time></div><p>{String(insight.text || '').slice(0, excerptLimit).trim()}{(insight.text || '').length > excerptLimit ? '…' : ''}</p></blockquote>) : <p className="journey-help">A matching saved insight is no longer available in this journey.</p>}</details>}</li>;
  })}</ul> : <p className="journey-help">{empty}</p>}</div>;
}

export default function JourneyPanel({ journey, onAction, onSelectWorld, onClose, onVoice, focusConnection = false }) {
  const [busy, setBusy] = useState('');
  const busyRef = useRef(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [insightText, setInsightText] = useState('');
  const [shown, setShown] = useState(20);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [connection, setConnection] = useState(null);
  const [connectionError, setConnectionError] = useState('');
  const [connectionLoading, setConnectionLoading] = useState(true);
  const [apiKey, setApiKey] = useState('');
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [connectionOpen, setConnectionOpen] = useState(focusConnection);
  const connectionSection = useRef(null);
  useEffect(() => { if (focusConnection && !connectionLoading) connectionSection.current?.scrollIntoView({ block: 'start' }); }, [focusConnection, connectionLoading]);
  const mounted = useRef(true);
  const id = useId();
  const insights = journey?.insights || [];
  const assessment = journey?.assessment || {};
  const isAi = assessment.source === 'ai';
  const aiEnabled = Boolean(journey?.aiReviewEnabled);
  const reviewPending = assessment.status === 'pending';
  const excerptLimit = Number.isInteger(assessment.maxInsightCharacters) ? Math.min(1500, Math.max(1, assessment.maxInsightCharacters)) : 1500;
  const evidenceForPattern = index => {
    const cited = assessment.patternEvidence?.find(item => item.patternIndex === index)?.insightIds || [];
    return [...new Set(cited)].filter(insightId => assessment.evidenceIds?.includes(insightId))
      .map(insightId => insights.find(insight => insight.id === insightId)).filter(Boolean);
  };

  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    api('/voice/status').then(result => { if (!cancelled) setConnection(result); })
      .catch(err => { if (!cancelled) setConnectionError(err.message || 'The connection status could not be checked.'); })
      .finally(() => { if (!cancelled) setConnectionLoading(false); });
    return () => { cancelled = true; mounted.current = false; };
  }, []);

  const run = async (name, action, message = '') => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(name); setError(''); setNotice('');
    try {
      const result = await action();
      if (mounted.current && message) setNotice(message);
      return result;
    } catch (err) {
      if (mounted.current) setError(err.message || 'That didn’t finish. Please try again.');
    } finally {
      busyRef.current = false;
      if (mounted.current) setBusy('');
    }
  };

  const refreshConnection = () => run('connection-status', async () => {
    setConnectionError(''); setConnectionLoading(true);
    try { const result = await api('/voice/status'); if (mounted.current) setConnection(result); }
    finally { if (mounted.current) setConnectionLoading(false); }
  });

  const saveInsight = event => {
    event.preventDefault();
    const text = insightText.trim();
    if (!text) return;
    run('save-insight', async () => {
      await onAction('/journey/insights', { source: 'reflection', text, ...(journey?.activeWorldId ? { worldId: journey.activeWorldId } : {}) });
      if (mounted.current) setInsightText('');
    }, 'Your insight is part of your journey now.');
  };

  const exportJourney = () => run('export', async () => {
    const exported = await onAction('/journey/export', undefined, 'GET');
    const url = URL.createObjectURL(new Blob([JSON.stringify(exported, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url; link.download = `hpy-journey-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, 'Your journey export is ready. Keep the downloaded file somewhere private.');

  const configureKey = event => {
    event.preventDefault();
    if (!apiKey.trim()) return;
    run('connect', async () => {
      const result = await api('/voice/config', { method: 'PUT', body: { apiKey: apiKey.trim() } });
      if (mounted.current) { setApiKey(''); setConnection(result); setConnectionError(''); }
    }, 'The project key is configured on this app’s host.');
  };

  if (!journey) return <Modal title="Your journey, unfolding." className="world-journey" onClose={onClose}><p className="journey-review-status" role="status"><Loader2 size={18} className="spin"/>Opening your saved journey…</p></Modal>;

  return <Modal title="Your journey, unfolding." className="world-journey" onClose={onClose}>
    <div className="journey-intro"><div><span className="journey-kicker">THREE WORLDS · YOUR OWN PACE</span><h3>A little practice.<br/><em>A little more possibility.</em></h3><p>Explore a place, keep what you notice, and return with another question.</p></div><div className="journey-kept"><Flower2 size={25}/><strong>{insights.length}</strong><span>insight{insights.length === 1 ? '' : 's'} kept</span></div></div>
    {error && <p className="journey-message error" role="alert">{error}</p>}
    {notice && <p className="journey-message" role="status"><Check size={17}/>{notice}</p>}

    <section className="journey-section" aria-labelledby={`${id}-worlds`}>
      <div className="journey-section-heading"><div><span className="journey-kicker">FOLLOW THE PATH</span><h3 id={`${id}-worlds`}>Your worlds</h3></div></div>
      <div className="journey-world-grid">{WORLD_CHAPTERS.map((world, index) => {
        const progress = journey?.worlds?.find(item => item.id === world.id);
        const unlocked = Boolean(progress?.unlocked);
        const active = journey?.activeWorldId === world.id;
        const completed = REGION_IDS.filter(region => progress?.completed?.includes(region)).length;
        const Icon = WORLD_ICONS[world.id] || Sprout;
        return <article className={`journey-world-card theme-${world.theme} ${active ? 'is-active' : ''} ${unlocked ? '' : 'is-locked'}`} key={world.id}>
          <div className="journey-world-art" aria-hidden="true"><i/><i/><i/><span><Icon size={35} strokeWidth={1.3}/></span></div>
          <div className="journey-world-copy"><div className="journey-world-meta"><span>WORLD {world.level}</span><span>{active ? 'You are here' : unlocked ? 'Open to explore' : <><LockKeyhole size={12}/>Opens next</>}</span></div><h4>{world.title}</h4><p className="journey-world-subtitle">{world.subtitle}</p><p>{world.description}</p><div className="journey-world-progress"><span>{completed} of 6 modules complete</span><div aria-hidden="true">{REGION_IDS.map(region => <i key={region} className={progress?.completed?.includes(region) ? 'complete' : ''}/>)}</div></div>
            {unlocked ? <button type="button" className="journey-button world-select" disabled={Boolean(busy)} onClick={() => run(`world-${world.id}`, () => onSelectWorld(world.id))}>{busy === `world-${world.id}` ? <Loader2 size={17} className="spin"/> : <Icon size={17}/>}<span>{active ? 'Return to this world' : 'Enter this world'}</span><ArrowRight size={17}/></button> : <p className="journey-world-lock"><LockKeyhole size={15}/>Complete the six modules in {WORLD_CHAPTERS[index - 1]?.title || 'the previous world'} to open this world.</p>}
          </div>
        </article>;
      })}</div>
      <p className="journey-help">Each world opens after the six modules before it. Return to any open world whenever you like.</p>
    </section>

    <section className="journey-section" aria-labelledby={`${id}-reflection`}>
      <div className="journey-section-heading"><div><span className="journey-kicker">LOOK BACK WITH CURIOSITY</span><h3 id={`${id}-reflection`}>What your notes might be saying</h3></div><span className="journey-source">{isAi ? 'AI-generated reflection' : 'Local word-based observations'}</span></div>
      <div className="journey-review-intro"><p>{assessment.summary || 'Keep an insight when you want it to become part of your ongoing reflection.'}</p><span className="journey-help">Based on {Number.isFinite(assessment.evidenceCount) ? assessment.evidenceCount : 0} saved insight{assessment.evidenceCount === 1 ? '' : 's'}{assessment.updatedAt ? ` · ${isAi ? 'Reviewed' : 'Updated'} ${dateLabel(assessment.updatedAt)}` : ''}</span>{isAi && <p className="journey-help journey-review-scope">AI review considers the latest up to 24 saved insights, using excerpts of up to {excerptLimit.toLocaleString()} characters each. The supporting dates show when notes were saved, which may differ from when events happened.</p>}</div>
      {reviewPending && <p className="journey-review-status" role="status"><Loader2 size={17} className="spin"/>Your AI reflection is being prepared. The observations shown here are local.</p>}
      {(assessment.status === 'unavailable' || assessment.status === 'error') && <p className="journey-review-status" role="status">{assessment.reviewNote || 'AI review is unavailable right now. Your saved insights and local observations are still here.'}</p>}
      {assessment.reviewNote && !['unavailable', 'error'].includes(assessment.status) && <p className="journey-help">{assessment.reviewNote}</p>}
      <div className="journey-review-grid"><ReviewList title="Possible patterns" items={assessment.patterns} evidenceForPattern={isAi ? evidenceForPattern : undefined} excerptLimit={excerptLimit} empty="There isn’t a pattern to name yet. You can keep noticing."/><ReviewList title="Actions visible in your notes" items={assessment.strengths} empty="This will draw only on the words you choose to save."/><ReviewList title="Questions worth carrying" items={assessment.nextQuestions} empty="What would you like to stay curious about?" className="journey-review-questions"/></div>
      <p className="journey-help">These are tentative reflections on saved words. Keep what fits, question what doesn’t, and leave room for your own reading.</p>
      <div className="journey-consent-box"><label className="journey-consent" htmlFor={`${id}-ai`}><input id={`${id}-ai`} type="checkbox" checked={aiEnabled} disabled={Boolean(busy)} onChange={event => { const enabled = event.target.checked; run('ai-settings', () => onAction('/journey/settings', { aiReviewEnabled: enabled }), enabled ? 'AI review is enabled for your saved insights.' : 'Future AI reviews are switched off.'); }}/><span><strong>Let OpenAI help me reflect on my saved insights</strong><span>When a project key is configured, enabling sends excerpts from your latest up to 24 saved insights to OpenAI, with up to 1,500 characters from each. New saves and changes automatically trigger another review of this latest selection. You can switch off future reviews at any time.</span></span></label><div className="journey-consent-actions"><p>{connectionLoading ? 'Checking whether AI is configured…' : connection?.configured ? 'A project key is configured. AI reviews use its API billing.' : 'AI needs a project key. Local observations remain available.'}</p><button type="button" className="journey-button" disabled={Boolean(busy) || !aiEnabled || !connection?.configured || !insights.length || reviewPending} onClick={() => run('review', () => onAction('/journey/review', {}), 'Your saved insights have been queued for review.')}><RefreshCw size={17} className={busy === 'review' ? 'spin' : ''}/>{busy === 'review' ? 'Requesting review…' : 'Review my saved insights'}</button>{reviewPending && <button type="button" className="journey-link" disabled={Boolean(busy)} onClick={() => run('refresh-review', () => onAction('/journey', undefined, 'GET'))}>Check for the latest reflection<RefreshCw size={14}/></button>}</div></div>
    </section>

    <section className="journey-section" aria-labelledby={`${id}-insights`}>
      <div className="journey-section-heading"><div><span className="journey-kicker">A FEW THINGS WORTH KEEPING</span><h3 id={`${id}-insights`}>Your saved insights</h3></div><button type="button" className="journey-link" disabled={Boolean(busy)} onClick={exportJourney}><Download size={17}/>{busy === 'export' ? 'Preparing…' : 'Export journey'}</button></div>
      <form className="journey-new-insight" onSubmit={saveInsight}><label htmlFor={`${id}-note`}>Anything you’d like to notice here?</label><textarea id={`${id}-note`} rows={4} maxLength={12000} disabled={busy === 'save-insight'} value={insightText} onChange={event => setInsightText(event.target.value)} placeholder="A moment, something you’re learning, a question you want to return to…"/><div><p className="journey-help">Only keep what you want included in your journey{aiEnabled ? ' and shared with OpenAI for review' : ''}.</p><button type="submit" className="journey-button primary" disabled={Boolean(busy) || !insightText.trim()}>{busy === 'save-insight' ? <Loader2 size={17} className="spin"/> : <Flower2 size={17}/>}Keep this insight</button></div>{onVoice && <button type="button" className="journey-link" disabled={Boolean(busy)} onClick={onVoice}><Mic size={17}/>Prefer to talk it through?<ArrowRight size={15}/></button>}</form>
      {!insights.length ? <div className="journey-empty"><Sprout size={28}/><h4>A little space for what you discover.</h4><p>Your saved encounter takeaways, voice reflections, and notes will gather here.</p></div> : <div className="journey-insight-list">{insights.slice(0, shown).map(insight => <details className="journey-insight" key={insight.id}><summary><span className="journey-insight-meta"><span>{SOURCES[insight.source] || 'Saved insight'}</span><time dateTime={insight.createdAt}>{dateLabel(insight.createdAt)}</time></span><strong>{(insight.takeaway || insight.text || '').slice(0, 170)}{(insight.takeaway || insight.text || '').length > 170 ? '…' : ''}</strong>{insight.worldId && <span className="journey-insight-place">{getWorld(insight.worldId)?.title || insight.worldId}{insight.regionId ? ` · ${REGION_NAMES[insight.regionId] || insight.regionId}` : ''}</span>}<ChevronDown size={19}/></summary><div className="journey-insight-content"><p>{insight.text}</p>{confirmDelete === insight.id ? <div className="journey-delete-confirm"><p>Delete this saved insight? It will leave your history and future reviews. Completed modules stay completed.</p>{insight.journalEntryId && <p className="journey-linked-note">The original journal entry remains until you delete it separately in your journal.</p>}<div><button type="button" className="journey-button danger" disabled={Boolean(busy)} onClick={() => run(`delete-${insight.id}`, async () => { await onAction(`/journey/insights/${encodeURIComponent(insight.id)}`, undefined, 'DELETE'); if (mounted.current) setConfirmDelete(null); }, 'The insight has been deleted.')}><Trash2 size={16}/>{busy === `delete-${insight.id}` ? 'Deleting…' : 'Yes, delete this insight'}</button><button type="button" className="journey-link" disabled={Boolean(busy)} onClick={() => setConfirmDelete(null)}>Keep it</button></div></div> : <button type="button" className="journey-link danger" disabled={Boolean(busy)} onClick={() => setConfirmDelete(insight.id)}><Trash2 size={15}/>Delete this insight</button>}</div></details>)}</div>}
      {insights.length > shown && <button type="button" className="journey-button journey-show-more" onClick={() => setShown(value => value + 20)}>Show more insights<span>{insights.length - shown} more</span><ChevronDown size={16}/></button>}
    </section>

    <details className="journey-connection" ref={connectionSection} open={connectionOpen} onToggle={event => setConnectionOpen(event.currentTarget.open)}><summary><KeyRound size={20}/><span><strong>OpenAI connection</strong><small>{connectionLoading ? 'Checking this app’s connection…' : connection?.configured ? 'Project key configured on this host' : 'Optional · connect your own project key'}</small></span><ChevronDown size={18}/></summary><div className="journey-connection-content">
      <p>An OpenAI project API key with API billing enabled is required for voice and AI review. <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer">Manage project API keys<ArrowUpRight size={14}/></a></p>
      {connectionError && <p className="journey-message error" role="alert">{connectionError}</p>}
      {!connection && !connectionLoading && <button type="button" className="journey-button" disabled={Boolean(busy)} onClick={refreshConnection}><RefreshCw size={16}/>Check connection again</button>}
      {connection?.canConfigure && connection.source !== 'environment' && <form className="journey-key-form" onSubmit={configureKey}><label htmlFor={`${id}-project-key`}>{connection.configured ? 'Replace the project API key' : 'Project API key'}</label><input id={`${id}-project-key`} name="project-api-key" type="password" autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false} disabled={busy === 'connect'} value={apiKey} maxLength={520} onChange={event => setApiKey(event.target.value)} placeholder="sk-…"/><p className="journey-help">Saved encrypted on this app’s host. This field is cleared after saving; the key is not stored in browser storage.</p><button type="submit" className="journey-button" disabled={Boolean(busy) || !apiKey.trim()}>{busy === 'connect' ? <Loader2 size={17} className="spin"/> : <KeyRound size={17}/>}Save project key</button></form>}
      {connection && !connection.canConfigure && !connection.configured && <p className="journey-help">To connect a key, open this app at its localhost address and use these journey settings, or set the deployment’s <code>OPENAI_API_KEY</code> secret.</p>}
      {connection?.source === 'environment' && <p className="journey-help">The project key is managed by this deployment. Update its secret to change or remove it.</p>}
      {connection?.canConfigure && connection.configured && connection.source === 'host' && <div className="journey-disconnect">{confirmDisconnect ? <><p>Remove this host’s saved project key? Voice and AI review will be unavailable until a key is connected again.</p><div><button type="button" className="journey-button danger" disabled={Boolean(busy)} onClick={() => run('disconnect', async () => { const result = await api('/voice/config', { method: 'DELETE' }); if (mounted.current) { setConnection(result); setConfirmDisconnect(false); setApiKey(''); } }, 'The host’s saved project key has been removed.')}>Remove the project key</button><button type="button" className="journey-link" disabled={Boolean(busy)} onClick={() => setConfirmDisconnect(false)}>Keep connected</button></div></> : <button type="button" className="journey-link danger" disabled={Boolean(busy)} onClick={() => setConfirmDisconnect(true)}>Remove saved project key</button>}</div>}
      {connection?.configured && <details className="journey-model-details"><summary>Connection details</summary><dl>{[['Voice model', connection.realtimeModel], ['Review model', connection.reviewModel], ['Transcription model', connection.transcriptionModel]].filter(([, value]) => value).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><p className="journey-help">A configured key is not a guarantee of provider availability or model access. A connection error will be shown if a request cannot complete.</p></details>}
    </div></details>
  </Modal>;
}
