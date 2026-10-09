import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ShieldCheck, Search, UsersRound, Settings, RefreshCw, Megaphone, ReceiptText, CreditCard, Smartphone, BadgeCheck, MessageCircle } from 'lucide-react';
import { post, put, request } from '../lib/api';
import { useSession } from '../session';
import { FormError, Loading, Modal } from '../components/ui';
import { useToast } from '../lib/hooks';
import { AdminAnnouncements } from './AdminAnnouncements';
import { Orders } from './Orders';
import { AdminPaymentSettings } from './AdminPaymentSettings';
import { AccountSettings } from './AccountSettings';
import { AdminSubscriptionSettings } from './AdminSubscriptionSettings';
import { AdminCommunitySettings } from './AdminCommunitySettings';

type User = { id: string; userCode: string; email: string; username: string | null; displayName: string; isAdmin: boolean; enabled: boolean; emailVerified: boolean; activeUntil: string | null; status: string; subscriptionRequestedAt: string | null };
type SettingsData = { registrationEnabled: boolean; defaultActivationMonths: number; smtpConfigured: boolean; smtpSender: string; pushEnabled: boolean };
const labels: Record<string, string> = { admin: 'Quản trị viên', active: 'Đang hoạt động', inactive: 'Đã khóa', pending: 'Chưa có gói', expired: 'Hết hạn' };
const date = (value: string | null) => value ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(value)) : 'Không giới hạn';

export function Admin() {
  const { isAdmin } = useSession();
  if (!isAdmin) return <div className="empty"><h1>Không có quyền truy cập.</h1><p>Trang này dành cho quản trị viên.</p><Link className="button primary" to="/">Về trang khách hàng</Link></div>;
  return <AdminContent/>;
}
function AdminContent() {
  const [params, setParams] = useSearchParams(); const tab = params.get('tab') || 'users';
  const setTab = (value: string) => setParams(value === 'users' ? {} : { tab: value });
  const [users, setUsers] = useState<User[]>([]); const [total, setTotal] = useState(0);
  const [search, setSearch] = useState(''); const [query, setQuery] = useState(''); const [page, setPage] = useState(1); const [revision, setRevision] = useState(0);
  const [status, setStatus] = useState('');
  const [settings, setSettings] = useState<SettingsData | null>(null); const [error, setError] = useState(''); const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false); const [selection, setSelection] = useState<{ user: User; enabled: boolean } | null>(null); const [months, setMonths] = useState(1); const [actionError, setActionError] = useState(''); const toast = useToast();
  useEffect(() => {
    const c = new AbortController(); setLoading(true); setError('');
    Promise.all([request<{ users: User[]; total: number }>(`/api/admin/users?search=${encodeURIComponent(query)}&status=${status}&page=${page}`, { signal: c.signal }), request<SettingsData>('/api/admin/settings', { signal: c.signal })])
      .then(([result, config]) => { if (!c.signal.aborted) { setUsers(result.users); setTotal(result.total); setSettings(config); } })
      .catch(err => { if (!c.signal.aborted) setError(err.message); }).finally(() => { if (!c.signal.aborted) setLoading(false); });
    return () => c.abort();
  }, [query, status, page, revision]);
  async function activation(e: FormEvent) {
    e.preventDefault(); if (!selection) return; setSaving(true); setActionError('');
    try { await post(`/api/admin/users/${selection.user.id}/activation`, { enabled: selection.enabled, months }); toast(selection.enabled ? 'Đã kích hoạt / gia hạn tài khoản.' : 'Đã khóa tài khoản và kết thúc các phiên đăng nhập.'); setSelection(null); setRevision(v => v + 1); }
    catch (err) { setActionError((err as Error).message); } finally { setSaving(false); }
  }
  async function saveSettings(e: FormEvent) {
    e.preventDefault(); if (!settings) return; setSaving(true); setError('');
    try { await put('/api/admin/settings', { registrationEnabled: settings.registrationEnabled, defaultActivationMonths: settings.defaultActivationMonths }); toast('Đã lưu cài đặt hệ thống.'); }
    catch (err) { setError((err as Error).message); } finally { setSaving(false); }
  }
  function select(user: User, enabled: boolean) { setSelection({ user, enabled }); setMonths(settings?.defaultActivationMonths || 1); setActionError(''); }
  return <div className="admin-page">
    <header className="admin-heading"><div><span className="eyebrow">CLIENTÉ / ADMIN</span><h1>Quản trị hệ thống</h1><p>Quản lý đơn hàng, thanh toán và thời hạn sử dụng.</p></div><ShieldCheck size={32}/></header>
    <nav className="admin-tabs" aria-label="Mục quản trị"><button className={`button ${tab === 'orders' ? 'primary' : 'secondary'}`} aria-pressed={tab === 'orders'} onClick={() => setTab('orders')}><ReceiptText size={18}/> Đơn hàng</button><button className={`button ${tab === 'subscription' ? 'primary' : 'secondary'}`} aria-pressed={tab === 'subscription'} onClick={() => setTab('subscription')}><BadgeCheck size={18}/> Gói đăng ký</button><button className={`button ${tab === 'payment' ? 'primary' : 'secondary'}`} aria-pressed={tab === 'payment'} onClick={() => setTab('payment')}><CreditCard size={18}/> Thanh toán</button><button className={`button ${tab === 'community' ? 'primary' : 'secondary'}`} aria-pressed={tab === 'community'} onClick={() => setTab('community')}><MessageCircle size={18}/> Cộng đồng</button><button className={`button ${tab === 'device' ? 'primary' : 'secondary'}`} aria-pressed={tab === 'device'} onClick={() => setTab('device')}><Smartphone size={18}/> Ứng dụng & thông báo</button><button className={`button ${tab === 'users' ? 'primary' : 'secondary'}`} aria-pressed={tab === 'users'} onClick={() => setTab('users')}><UsersRound size={18}/> Người dùng</button><button className={`button ${tab === 'announcements' ? 'primary' : 'secondary'}`} aria-pressed={tab === 'announcements'} onClick={() => setTab('announcements')}><Megaphone size={18}/> Thông báo</button><button className={`button ${tab === 'settings' ? 'primary' : 'secondary'}`} aria-pressed={tab === 'settings'} onClick={() => setTab('settings')}><Settings size={18}/> Cài đặt nâng cao</button></nav>
    <FormError message={error}/>{error && <button className="text-button" onClick={() => setRevision(v => v + 1)}>Thử tải lại</button>}
    {tab === 'orders' ? <Orders admin/> : tab === 'subscription' ? <AdminSubscriptionSettings/> : tab === 'payment' ? <AdminPaymentSettings/> : tab === 'community' ? <AdminCommunitySettings/> : tab === 'device' ? <AccountSettings embedded/> : tab === 'announcements' ? <AdminAnnouncements/> : loading ? <Loading/> : tab === 'users' ? <section className="panel admin-users">
      <div className="admin-toolbar"><form onSubmit={e => { e.preventDefault(); setQuery(search.trim()); setPage(1); }}><label className="sr-only" htmlFor="admin-search">Tìm người dùng</label><input id="admin-search" type="search" maxLength={100} placeholder="ID, email, username hoặc tên" value={search} onChange={e => setSearch(e.target.value)}/><button className="button secondary" type="submit"><Search size={17}/> Tìm</button></form><span>{total} người dùng</span><button className="icon-button" aria-label="Tải lại danh sách" onClick={() => setRevision(v => v + 1)}><RefreshCw size={18}/></button></div>
      <div className="admin-user-filters"><label>Trạng thái người dùng<select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}><option value="">Tất cả trạng thái</option>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div><div className="admin-table-scroll"><table className="admin-table"><thead><tr><th>Người dùng</th><th>Trạng thái</th><th>Hạn sử dụng (giờ VN)</th><th>Thao tác</th></tr></thead><tbody>{users.map(user => <tr key={user.id}><td><strong>{user.username || user.displayName || 'Tài khoản cũ'}</strong><span>{user.email}</span><small>ID: {user.userCode}</small><small>{user.emailVerified ? 'Email đã xác minh' : 'Email chưa xác minh'}</small>{user.subscriptionRequestedAt && <small className="admin-request-label">Đã yêu cầu đăng ký gói</small>}</td><td><span className={`admin-status status-${user.status}`}>{labels[user.status]}</span></td><td>{!user.activeUntil && user.status !== 'active' && user.status !== 'admin' ? 'Chưa đặt thời hạn' : date(user.activeUntil)}</td><td>{user.isAdmin ? <span className="muted-label">QUẢN TRỊ VIÊN</span> : <div className="admin-user-actions"><button className="button secondary" onClick={() => select(user, true)}>Cấp thời hạn thủ công</button>{user.enabled && <button className="button secondary danger" onClick={() => select(user, false)}>Khóa</button>}</div>}</td></tr>)}</tbody></table></div>
      {users.length === 0 && <p className="admin-empty">Chưa có người dùng phù hợp.</p>}
      <footer className="admin-pagination"><button className="button secondary" disabled={page <= 1} onClick={() => setPage(v => v - 1)}>Trang trước</button><span>Trang {page} / {Math.max(1, Math.ceil(total / 50))}</span><button className="button secondary" disabled={page * 50 >= total} onClick={() => setPage(v => v + 1)}>Trang sau</button></footer>
    </section> : settings && <section className="panel admin-settings"><h2>Cài đặt nâng cao</h2><form onSubmit={saveSettings}><fieldset disabled={saving}>
      <label className="admin-toggle"><input type="checkbox" checked={settings.registrationEnabled} onChange={e => setSettings({ ...settings, registrationEnabled: e.target.checked })}/><span>Mở đăng ký người dùng mới</span></label><p className="auth-field-hint">Người dùng cần xác minh email sau khi tạo tài khoản. Yêu cầu đăng ký gói được quản lý tại mục Gói đăng ký.</p>
      <label>Thời hạn kích hoạt mặc định<select value={settings.defaultActivationMonths} onChange={e => setSettings({ ...settings, defaultActivationMonths: Number(e.target.value) })}>{Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1} tháng</option>)}</select></label>
    </fieldset><button className="button primary" disabled={saving}>{saving ? 'Đang lưu…' : 'Lưu cài đặt'}</button></form><div className="admin-system-info"><h3>Dịch vụ hệ thống</h3><p>Email xác minh: <strong>{settings.smtpConfigured ? 'Đã cấu hình' : 'Chưa cấu hình'}</strong></p><p>Email gửi: {settings.smtpSender || 'Chưa đặt'}</p><p>Thông báo: {settings.pushEnabled ? 'Đang bật' : 'Đang tắt'}</p><p className="auth-field-hint">Cấu hình SMTP và thông báo được quản lý trên máy chủ. Duyệt thanh toán mua hoặc gia hạn gói tại mục Đơn hàng.</p></div></section>}
    {selection && <Modal title={selection.enabled ? 'Kích hoạt / gia hạn tài khoản' : 'Khóa tài khoản'} subtitle={selection.user.email} busy={saving} onClose={() => setSelection(null)}><form onSubmit={activation}>
      {selection.enabled ? <><p>Cấp thời hạn thủ công không ghi nhận thanh toán. Để duyệt tiền mua gói, dùng mục Đơn hàng. Thời hạn cộng từ ngày hết hạn hoặc hôm nay và kết thúc lúc 23:59:59 giờ Việt Nam.</p><label>Số tháng<select value={months} disabled={saving} onChange={e => setMonths(Number(e.target.value))}>{Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1} tháng</option>)}</select></label></> : <p>Tài khoản sẽ ngừng truy cập ngay. Các phiên đăng nhập và thông báo hiện tại sẽ bị tắt.</p>}
      <FormError message={actionError}/><footer className="form-actions"><button className="button secondary" type="button" disabled={saving} onClick={() => setSelection(null)}>Hủy</button><button className="button primary" disabled={saving}>{saving ? 'Đang lưu…' : selection.enabled ? 'Xác nhận kích hoạt' : 'Xác nhận khóa'}</button></footer>
    </form></Modal>}
  </div>;
}
