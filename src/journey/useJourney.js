import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';

export function useJourney() {
  const [journey, setJourney] = useState(null);
  const [error, setError] = useState('');
  const mounted = useRef(false);
  const queue = useRef(Promise.resolve());
  const latest = useRef(null);
  const request = useCallback((path, body, method = 'POST') => {
    // Serialize snapshots so a slow visit cannot replace a newer completion.
    const operation = queue.current.then(async () => {
      if (!mounted.current) throw new Error('Your space has closed. Unlock to continue.');
      const result = await api(path, { method, ...(body === undefined ? {} : { body }) });
      if (result.journey && mounted.current) {
        latest.current = result.journey;
        setJourney(result.journey);
        setError('');
      }
      return result;
    });
    queue.current = operation.catch(() => {});
    return operation;
  }, []);
  const refresh = useCallback(() => request('/journey', undefined, 'GET').catch(err => { if (mounted.current) setError(err.message); }), [request]);
  useEffect(() => { mounted.current = true; refresh(); return () => { mounted.current = false; }; }, [refresh]);
  useEffect(() => { window.addEventListener('hpy:journey-changed', refresh); return () => window.removeEventListener('hpy:journey-changed', refresh); }, [refresh]);
  useEffect(() => {
    if (journey?.assessment.status !== 'pending') return;
    const timer = setTimeout(refresh, 3500);
    return () => clearTimeout(timer);
  }, [journey, refresh]);
  return { journey, latest, error, request, refresh };
}
