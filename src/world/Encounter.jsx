import React, { useEffect, useId, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, X } from 'lucide-react';
import { SaveButton } from '../UI';
import { ENCOUNTERS } from './encounters';

function EncounterCard({ stationId, onClose, onDeepPractice, onSave, onComplete, completed, draft, onDraft }) {
  const encounter = ENCOUNTERS[stationId];
  const [data, setData] = useState(() => ({
    answers: encounter.steps.map((_, i) => typeof draft?.answers?.[i] === 'string' ? draft.answers[i].slice(0, 2000) : ''),
    step: Math.max(0, Math.min(encounter.steps.length - 1, Number.isInteger(draft?.step) ? draft.step : 0)),
    done: Boolean(draft?.done),
  }));
  const panelRef = useRef(null);
  const questionRef = useRef(null);
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const questionId = `${baseId}-question`;
  const noteId = `${baseId}-note`;
  const step = encounter.steps[data.step];
  const hasWords = data.answers.some(answer => answer.trim());
  const lastStep = data.step === encounter.steps.length - 1;

  const update = patch => {
    const next = { ...data, ...patch };
    setData(next);
    onDraft?.(next);
  };

  useEffect(() => {
    const previous = document.activeElement;
    return () => {
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    questionRef.current?.focus({ preventScroll: true });
  }, [data.step, data.done]);

  const keyDown = event => {
    // The world must not receive navigation keys while a reflection is open.
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
    if (event.key === 'Tab') {
      const focusable = [...panelRef.current.querySelectorAll('button:not([disabled]), textarea:not([disabled]), a[href]')];
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === questionRef.current)) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first?.focus();
      }
    }
  };

  const advance = () => update(lastStep ? { done: true } : { step: data.step + 1 });
  const saveReflection = () => onSave({
    title: `${encounter.title} · A small discovery`,
    mode: stationId,
    body: encounter.steps.map((item, i) => `${item.prompt}\n\n${data.answers[i].trim() || 'A question left open.'}`).join('\n\n—\n\n'),
  });

  return <section ref={panelRef} className="world-encounter" data-station={stationId} role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={keyDown} onKeyUp={event => event.stopPropagation()}>
    <header className="world-encounter-header">
      <span className="world-encounter-eyebrow">{completed ? <><Check size={13} aria-hidden="true"/> A place you’ve paused</> : 'A small invitation'}</span>
      <button type="button" className="icon-button world-encounter-close" aria-label="Close invitation and return to the world" onClick={onClose}><X size={19}/></button>
    </header>
    <h2 id={titleId}>{encounter.title}</h2>
    <p className="world-encounter-subtitle">{encounter.subtitle}</p>
    {!data.done ? <>
      <p className="world-encounter-invitation">{encounter.invitation}</p>
      <div className="world-encounter-progress" aria-label={`Question ${data.step + 1} of ${encounter.steps.length}`}>
        {encounter.steps.map((_, i) => <span key={i} className={i === data.step ? 'current' : i < data.step ? 'passed' : ''} aria-hidden="true"/>)}
        <small>{String(data.step + 1).padStart(2, '0')} / {String(encounter.steps.length).padStart(2, '0')}</small>
      </div>
      <h3 className="world-encounter-question" id={questionId} ref={questionRef} tabIndex={-1}>{step.prompt}</h3>
      <textarea className="textarea world-encounter-input" aria-labelledby={questionId} aria-describedby={noteId} placeholder={step.placeholder} value={data.answers[data.step]} maxLength={2000} rows={3} onChange={event => {
        const answers = [...data.answers];
        answers[data.step] = event.target.value;
        update({ answers });
      }}/>
      <p className="world-encounter-note" id={noteId}>A few words, or simply a moment to notice. Saving is your choice.</p>
      <div className="world-encounter-actions">
        {data.step > 0 && <button type="button" className="text-button" onClick={() => update({ step: data.step - 1 })}><ArrowLeft size={14}/> Back</button>}
        <button type="button" className="button dark" disabled={!data.answers[data.step].trim()} onClick={advance}>{lastStep ? 'Gather this moment' : 'Keep exploring'}<ArrowRight size={16}/></button>
      </div>
      <button type="button" className="text-button world-encounter-skip" onClick={advance}>Let it be a question<ArrowRight size={14}/></button>
    </> : <>
      <h3 className="world-encounter-question" ref={questionRef} tabIndex={-1}>A little something to carry.</h3>
      <p className="world-encounter-invitation">{encounter.completion}</p>
      {hasWords && <div className="world-encounter-summary">{encounter.steps.map((item, i) => data.answers[i].trim() && <div key={i}><span>{item.prompt}</span><p>{data.answers[i]}</p></div>)}</div>}
      <div className="world-encounter-actions world-encounter-finish">
        <button type="button" className="button dark" onClick={() => { onComplete?.(stationId); onClose(); }}>Carry this with me<ArrowRight size={16}/></button>
        {hasWords && <SaveButton onSave={saveReflection} label="Keep these words"/>}
      </div>
      <button type="button" className="text-button world-encounter-skip" onClick={() => update({ done: false, step: 0 })}><ArrowLeft size={14}/> Revisit my words</button>
      <p className="world-encounter-note">{hasWords ? 'Your words stay in this session unless you choose to keep them in your journal.' : 'No words needed. You can leave with an open question.'}</p>
    </>}
    <button type="button" className="text-button world-encounter-deep" onClick={() => onDeepPractice(stationId)}>{encounter.deepLabel}<ArrowUpRight size={15}/></button>
  </section>;
}

export default function Encounter(props) {
  if (!ENCOUNTERS[props.stationId]) return null;
  return <EncounterCard key={props.stationId} {...props}/>;
}
