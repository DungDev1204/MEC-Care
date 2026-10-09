import { useCallback, useEffect, useState } from 'react';
import { request } from './api';

export function useLiveResource<T>(url: string, intervalMs = 10000) {
  const [data, setData] = useState<T>(); const [error, setError] = useState(''); const [loading, setLoading] = useState(true); const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    let stopped = false; let controller: AbortController | undefined;
    setData(undefined); setLoading(true);
    const refresh = async () => {
      controller?.abort(); controller = new AbortController(); const signal = controller.signal;
      try { const result = await request<T>(url, { signal }); if (!stopped && !signal.aborted) { setData(result); setError(''); } }
      catch (err) { if (!stopped && !signal.aborted) setError((err as Error).message); }
      finally { if (!stopped && !signal.aborted) setLoading(false); }
    };
    void refresh(); const timer = window.setInterval(() => { if (navigator.onLine) void refresh(); }, intervalMs);
    const update = () => { if (!document.hidden) void refresh(); };
    window.addEventListener('online', update); document.addEventListener('visibilitychange', update);
    return () => { stopped = true; controller?.abort(); clearInterval(timer); window.removeEventListener('online', update); document.removeEventListener('visibilitychange', update); };
  }, [url, intervalMs, revision]);
  return { data, error, loading, reload };
}
