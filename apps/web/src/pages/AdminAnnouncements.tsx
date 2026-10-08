import { useState, type FormEvent } from 'react';
import { Megaphone, Send, RefreshCw } from 'lucide-react';
import { post } from '../lib/api';
import { useResource, useToast } from '../lib/hooks';
import { localDateTime, formatTime } from '../lib/utils';
import type { AdminAnnouncement } from '../lib/announcements';
import { FormError, Loading, Modal } from '../components/ui';

const initial = () => ({ title: '', content: '', startsAt: localDateTime(), endsAt: localDateTime(new Date(Date.now() + 7 * 86400000)) });
const labels = { scheduled: 'Đã lên lịch', active: 'Đang hiển thị', expired: 'Đã hết hạn', disabled: 'Đã dừng' };
export function AdminAnnouncements() {
  const list = useResource<AdminAnnouncement[]>('/api/admin/announcements'); const toast = useToast();
  const [draft, setDraft] = useState(initial); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [stopping, setStopping] = useState<AdminAnnouncement | null>(null);
  async function publish(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      await post('/api/admin/announcements', { title: draft.title, content: draft.content,
        startsAt: new Date(`${draft.startsAt}+07:00`).toISOString(), endsAt: new Date(`${draft.endsAt}+07:00`).toISOString() });
      setDraft(initial()); list.reload(); toast('Đã lưu lịch thông báo cho toàn thể người dùng.');
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  async function stop(e: FormEvent) {
    e.preventDefault(); if (!stopping) return; setBusy(true); setError('');
    try { await post(`/api/admin/announcements/${stopping.id}/stop`, {}); setStopping(null); list.reload(); toast('Đã dừng hiển thị thông báo.'); }
    catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  return <div className="admin-announcements"><section className="panel announcement-editor"><h2><Megaphone size={20}/> Thông báo đến người dùng</h2><p className="muted">Hiển thị hộp thoại cho tất cả tài khoản khi mở ứng dụng, trong thời gian bạn chọn.</p>
    <form onSubmit={publish}><fieldset disabled={busy}><label>Tiêu đề<input maxLength={120} placeholder="Thông báo từ quản trị viên" value={draft.title} onChange={e => setDraft(v => ({ ...v, title: e.target.value }))}/></label>
      <label>Nội dung <b>*</b><textarea required rows={5} maxLength={5000} placeholder="Nhập nội dung cần thông báo…" value={draft.content} onChange={e => setDraft(v => ({ ...v, content: e.target.value }))}/></label>
      <div className="form-grid"><label>Bắt đầu hiển thị <b>*</b><input type="datetime-local" required value={draft.startsAt} onChange={e => setDraft(v => ({ ...v, startsAt: e.target.value }))}/></label><label>Kết thúc hiển thị <b>*</b><input type="datetime-local" required min={draft.startsAt} value={draft.endsAt} onChange={e => setDraft(v => ({ ...v, endsAt: e.target.value }))}/></label></div>
      <p className="auth-field-hint">Giờ Việt Nam (UTC+7). Người dùng có thể chọn không hiện lại từng thông báo.</p></fieldset>
      {!stopping && <FormError message={error}/>}<button className="button primary" disabled={busy}><Send size={17}/>{busy ? 'Đang lưu…' : 'Gửi / lên lịch thông báo'}</button></form>
  </section><section className="panel announcement-history"><header><h2>Thông báo đã tạo</h2><button className="icon-button" aria-label="Tải lại thông báo" onClick={list.reload}><RefreshCw size={17}/></button></header>
    <FormError message={list.error}/>{list.loading ? <Loading/> : list.data?.length ? list.data.map(item => <article key={item.id}><div className="announcement-item-heading"><strong>{item.title}</strong><span className={`admin-status status-${item.status}`}>{labels[item.status]}</span></div><p className="announcement-content">{item.content}</p><div className="announcement-window"><span>Từ {formatTime(item.startsAt)}</span><span>Đến {formatTime(item.endsAt)}</span></div>{item.enabled && item.status !== 'expired' && <button className="text-button danger" disabled={busy} onClick={() => { setError(''); setStopping(item); }}>Dừng hiển thị</button>}</article>) : <p className="admin-empty">Chưa có thông báo.</p>}
  </section>{stopping && <Modal title="Dừng hiển thị thông báo?" eyebrow="CLIENTÉ / ADMIN" subtitle={stopping.title} busy={busy} onClose={() => setStopping(null)}><form onSubmit={stop}><p>Thông báo sẽ không xuất hiện khi người dùng mở ứng dụng. Lịch sử vẫn được giữ.</p><FormError message={error}/><footer className="form-actions"><button type="button" className="button secondary" disabled={busy} onClick={() => setStopping(null)}>Hủy</button><button className="button primary" disabled={busy}>{busy ? 'Đang lưu…' : 'Dừng hiển thị'}</button></footer></form></Modal>}</div>;
}
