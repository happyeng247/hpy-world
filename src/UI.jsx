import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowUpRight, Check, Loader2, X } from 'lucide-react';

export function Flower({ className = '', size = 30 }) {
  return <svg width={size} height={size} className={className} viewBox="0 0 60 60" fill="none" aria-hidden="true"><g fill="currentColor"><ellipse cx="30" cy="16" rx="9" ry="15"/><ellipse cx="30" cy="44" rx="9" ry="15"/><ellipse cx="16" cy="30" rx="15" ry="9"/><ellipse cx="44" cy="30" rx="15" ry="9"/><ellipse cx="20" cy="20" rx="9" ry="13" transform="rotate(-45 20 20)"/><ellipse cx="40" cy="40" rx="9" ry="13" transform="rotate(-45 40 40)"/><ellipse cx="40" cy="20" rx="9" ry="13" transform="rotate(45 40 20)"/><ellipse cx="20" cy="40" rx="9" ry="13" transform="rotate(45 20 40)"/></g><circle cx="30" cy="30" r="7" fill="var(--paper, #f7f5ef)"/></svg>;
}

export function PageHeading({ eyebrow, title, children, onBack }) {
  return <header className="page-heading">{onBack && <button className="text-button back-button" onClick={onBack}><ArrowLeft size={16}/> All ways to explore</button>}<div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{children && <p>{children}</p>}</header>;
}

export function SaveButton({ onSave, disabled = false, label = 'Keep this reflection' }) {
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  return <div className="save-control"><button className={`button dark ${saved ? 'saved' : ''}`} disabled={disabled || busy || saved} onClick={async () => {
    setBusy(true); setError('');
    try { await onSave(); setSaved(true); setTimeout(() => setSaved(false), 2500); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }}>{busy ? <Loader2 size={17} className="spin"/> : saved ? <Check size={17}/> : null}{saved ? 'Kept in your journal' : label}{!busy && !saved && <ArrowUpRight size={17}/>}</button>{error && <p role="alert" className="error-text">{error}</p>}<p className="save-journey-note">Saved reflections join your private journey review.</p></div>;
}

let openModalCount = 0;
let bodyOverflowBeforeModals = '';
const isAvailable = element => Boolean(element?.isConnected && !element.closest('[inert]') && element.getClientRects().length);
const topDialog = () => [...document.querySelectorAll('[role="dialog"][aria-modal="true"]')].filter(isAvailable).at(-1);
const modalControls = element => [...element.querySelectorAll('button, input, textarea, select, a[href], [tabindex], [contenteditable="true"]')]
  .filter(control => control.tabIndex >= 0 && !control.matches(':disabled') && isAvailable(control));

export function Modal({ title, children, onClose, className = '' }) {
  const ref = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement;
    const el = ref.current;
    if (openModalCount === 0) bodyOverflowBeforeModals = document.body.style.overflow;
    openModalCount += 1;
    document.body.style.overflow = 'hidden';
    // DOM order also handles a child dialog whose effect runs before its parent.
    if (topDialog() === el) (modalControls(el)[0] || el).focus({ preventScroll: true });
    const key = e => {
      // A practice can have its own dialog, or be inert beneath shared support.
      // Only the visible dialog above it should receive Escape and trap Tab.
      if (topDialog() !== el) return;
      if (e.key === 'Escape') {
        e.preventDefault(); e.stopImmediatePropagation(); onCloseRef.current();
      } else if (e.key === 'Tab') {
        const items = modalControls(el);
        const first = items[0], last = items[items.length - 1];
        if (!first) { e.preventDefault(); el.focus(); return; }
        const active = document.activeElement;
        if (!el.contains(active)) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
        else if (e.shiftKey && (active === first || active === el)) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('keydown', key);
      openModalCount -= 1;
      if (openModalCount === 0) document.body.style.overflow = bodyOverflowBeforeModals;
      // Wait for replacement dialogs and inert changes in this commit before
      // restoring focus; never steal it from a newly opened dialog.
      queueMicrotask(() => {
        const top = topDialog();
        if (isAvailable(previous) && (!top || top.contains(previous))) previous.focus({ preventScroll: true });
        else if (top && !top.contains(document.activeElement)) (modalControls(top)[0] || top).focus({ preventScroll: true });
      });
    };
  }, []);
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget && topDialog() === ref.current) onClose(); }}><section ref={ref} className={`modal ${className}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}><div className="modal-header"><h2>{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={20}/></button></div>{children}</section></div>;
}
