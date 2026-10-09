import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Check, LoaderCircle } from 'lucide-react';
import { post } from '../lib/api';
import { useResource } from '../lib/hooks';
import { useLiveResource } from '../lib/live-resource';
import { orderDate } from '../lib/orders';
import { disablePush, enablePush, pushSupported, serviceWorker, type PushConfig } from '../lib/pwa';
import { FormError } from './ui';
import { appIcon, appName } from '../lib/app-mode';

type NotificationItem = { id: string; orderCode: string; createdAt: string; readAt: string | null };
export function AdminOrderNotifications({ review }: { review: boolean }) {
  const resource = useLiveResource<{ notifications: NotificationItem[]; unread: number }>('/api/admin/order-notifications', 5000);
  const config = useResource<PushConfig>('/api/push/config'); const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false); const [enabled, setEnabled] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  useEffect(() => { if (pushSupported()) void serviceWorker().then(r => r.pushManager.getSubscription()).then(s => setEnabled(!!s && Notification.permission === 'granted')).catch(() => {}); }, []);
  useEffect(() => { const update = () => resource.reload(); window.addEventListener('admin-orders-changed', update); return () => window.removeEventListener('admin-orders-changed', update); }, [resource.reload]);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', close); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', key); };
  }, [open]);
  async function markRead(id?: string) {
    try { await post('/api/admin/order-notifications/read', id ? { id } : {}); resource.reload(); }
    catch (err) { setError((err as Error).message); }
  }
  async function togglePush() {
    setBusy(true); setError('');
    try {
      if (enabled) { await disablePush(); setEnabled(false); }
      else { await enablePush(config.data!); setEnabled(true); }
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  async function testNotification() {
    setBusy(true); setError('');
    try {
      if (!pushSupported()) throw new Error('Trình duyệt này chưa hỗ trợ thông báo.');
      if (await Notification.requestPermission() !== 'granted') throw new Error('Hãy cấp quyền thông báo trong trình duyệt.');
      const registration = await serviceWorker();
      await registration.showNotification(`${appName()} · Thông báo thử`, { body: 'Đơn mẫu đã báo chuyển khoản. Đây là thông báo review.', icon: appIcon(true), tag: 'cliente-review-order', data: { url: '/admin?tab=orders' } });
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  const count = resource.data?.unread || 0;
  return <div className="admin-notifications" ref={root}><button className="icon-button notification-bell" type="button" aria-label={`Thông báo đơn hàng${count ? `: ${count} chưa đọc` : ''}`} aria-expanded={open} onClick={() => setOpen(value => !value)}><Bell size={20}/>{count > 0 && <span className="notification-count">{count > 99 ? '99+' : count}</span>}</button>
    {open && <div className="notification-panel"><div className="notification-heading"><strong>Thông báo đơn hàng</strong><button className="text-button" disabled={!count} onClick={() => void markRead()}>Đọc tất cả</button></div><FormError message={error || resource.error}/>
      <div className="notification-list">{resource.data?.notifications.length ? resource.data.notifications.map(item => <Link key={item.id} className={!item.readAt ? 'unread' : ''} to={`/admin?tab=orders&order=${encodeURIComponent(item.orderCode)}`} onClick={() => { void markRead(item.id); setOpen(false); }}><span><Bell size={16}/></span><div><strong>Đơn {item.orderCode}</strong><p>Khách đã báo chuyển khoản. Mở để đối soát.</p><small>{orderDate(item.createdAt)}</small></div></Link>) : <p className="notification-empty">Chưa có thông báo đơn hàng.</p>}</div>
      <div className="notification-device"><strong>Thông báo trên thiết bị</strong><p>{review ? 'Bản review dùng đơn mẫu; bạn có thể thử hiển thị trên thanh thông báo.' : 'Nhận đơn chờ duyệt trên thanh thông báo, kể cả khi không mở ứng dụng.'}</p>{review ? <button className="button secondary" disabled={busy || !pushSupported()} onClick={testNotification}><Bell size={16}/> Thử thông báo</button> : <><button className="button secondary" disabled={busy || config.loading || !!config.error || !config.data?.enabled || !pushSupported()} onClick={togglePush}>{busy ? <LoaderCircle size={16} className="spin"/> : enabled ? <Check size={16}/> : <Bell size={16}/>} {enabled ? 'Tắt trên thiết bị này' : 'Bật thông báo trên thiết bị'}</button>{!config.data?.enabled && <small>Máy chủ chưa bật Web Push.</small>}{!pushSupported() && <small>Cần trình duyệt hỗ trợ qua HTTPS. Trên iPhone, mở Clienté từ Màn hình chính.</small>}</>}<Link className="text-button notification-device-link" to="/admin?tab=device" onClick={() => setOpen(false)}>Cài ứng dụng & thông báo</Link></div>
    </div>}
  </div>;
}
