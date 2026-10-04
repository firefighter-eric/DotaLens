import { useEffect, useState } from 'react';
import { loadItemCatalog } from '../services/catalog.js';

export function useItemCatalog(enabled) {
  const [resource, setResource] = useState({ status: 'idle', data: [], error: null });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!enabled) return undefined;
    let active = true;
    setResource({ status: 'loading', data: [], error: null });
    loadItemCatalog().then(
      (data) => { if (active) setResource({ status: 'success', data, error: null }); },
      (error) => { if (active) setResource({ status: 'error', data: [], error }); }
    );
    return () => { active = false; };
  }, [enabled, attempt]);
  return { ...resource, retry: () => setAttempt((value) => value + 1) };
}
