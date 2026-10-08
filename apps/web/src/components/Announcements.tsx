import { useEffect, useState } from 'react';
import { Megaphone } from 'lucide-react';
import { request, post } from '../lib/api';
import { formatTime } from '../lib/utils';
import type { Announcement } from '../lib/announcements';
import { Modal, FormError } from './ui';

export function Announcements() {
  const [items, setItems] = useState<Announcement[]>([]); const [seen, setSeen] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController(); let loading = false;
    const load = async () => {
      if (loading || document.visibilityState === 'hidden') return;
      loading = true;
      try { const data = await request<Announcement[]>('/api/announcements', { signal: controller.signal }); if (!controller.signal.aborted) setItems(data); }
      catch { /* Notices must not prevent users from opening their workspace. */ }
      finally { loading = false; }
    };
    void load(); const timer = window.setInterval(() => void load(), 60000);
    window.addEventListener('focus', load); document.addEventListener('visibilitychange', load);
    return () => { controller.abort(); clearInterval(timer); window.removeEventListener('focus', load); document.removeEventListener('visibilitychange', load); };
  }, []);
  const current = items.find(a => !seen.has(a.id) && Date.parse(a.startsAt) <= Date.now() && Date.parse(a.endsAt) > Date.now());
  useEffect(() => {
    setError(''); if (!current) return;
    const timer = window.setTimeout(() => setItems(list => list.filter(a => Date.parse(a.endsAt) > Date.now())), Math.min(2147483647, Math.max(1, Date.parse(current.endsAt) - Date.now())));
    return () => clearTimeout(timer);
  }, [current?.id, current?.endsAt]);
  function close() { if (current) setSeen(previous => new Set(previous).add(current.id)); }
  async function hide() {
    if (!current) return; setBusy(true); setError('');
    try { await post(`/api/announcements/${current.id}/dismiss`, {}); setSeen(previous => new Set(previous).add(current.id)); }
    catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  if (!current) return null;
  return <Modal key={current.id} title={current.title} eyebrow="CLIENTÉ / THÔNG BÁO" icon={<Megaphone size={23}/>} className="announcement-dialog" subtitle={`Hiển thị đến ${formatTime(current.endsAt)}`} busy={busy} onClose={close}>
    <div className="announcement-content">{current.content}</div><FormError message={error}/><div className="announcement-actions"><button className="button secondary" disabled={busy} onClick={hide}>{busy ? 'Đang lưu…' : 'Không hiện lại thông báo này'}</button><button className="button primary" data-dialog-initial-focus disabled={busy} onClick={close}>Đóng</button></div>
  </Modal>;
}
