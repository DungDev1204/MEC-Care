import { useState } from 'react';
import { Check, Clock3, HeartHandshake, RefreshCw, ArrowRight, LoaderCircle } from 'lucide-react';
import { useSession, type AccessStatus } from '../session';
import { useResource } from '../lib/hooks';
import { post } from '../lib/api';
import { formatDate } from '../lib/utils';
import { FormError, Loading } from '../components/ui';

type SubscriptionInfo = { accessStatus: AccessStatus; activeUntil: string | null; requestedAt: string | null };
export function Subscription() {
  const { displayName, accessStatus, refreshSession } = useSession();
  const subscription = useResource<SubscriptionInfo>('/api/subscription');
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [message, setMessage] = useState('');
  const expired = accessStatus === 'expired';
  async function registerPlan() {
    setBusy(true); setError('');
    try { const result = await post<{ message: string }>('/api/subscription/request'); setMessage(result.message); subscription.reload(); }
    catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  async function checkPlan() {
    setBusy(true); setError('');
    try { await refreshSession(); subscription.reload(); }
    catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  return <div className="subscription-page"><header className="page-heading"><div><span className="eyebrow">KHÔNG GIAN CỦA BẠN</span><h1>Chào {displayName || 'bạn'}<span className="title-dot">.</span></h1><p>Tài khoản của bạn đã sẵn sàng. Bắt đầu hành trình chăm sóc khách hàng cùng Clienté.</p></div></header>
    <section className="panel subscription-panel" aria-labelledby="subscription-title"><span className="subscription-icon"><HeartHandshake size={34} strokeWidth={1.3}/></span><span className="eyebrow">CLIENTÉ / GÓI SỬ DỤNG</span><h2 id="subscription-title">{expired ? 'Gia hạn gói để tiếp tục.' : 'Đăng ký gói để sử dụng.'}</h2>
      <p>{expired ? 'Gói của bạn đã hết hạn. Đăng ký gia hạn để tiếp tục quản lý khách hàng và lịch chăm sóc.' : 'Bạn đã đăng nhập thành công. Đăng ký gói để mở các chức năng quản lý và chăm sóc khách hàng.'}</p>
      {expired && subscription.data?.activeUntil && <span className="subscription-expiry">Gói hết hạn ngày {formatDate(subscription.data.activeUntil)}</span>}
      <div className="subscription-plan"><div><strong>Gói chăm sóc khách hàng</strong><span><Clock3 size={16}/> Thời hạn 1 tháng</span></div><ul><li><Check size={17}/> Quản lý hồ sơ và hình ảnh khách hàng</li><li><Check size={17}/> Ghi nhận lịch sử chăm sóc</li><li><Check size={17}/> Lịch nhắc và thông báo</li></ul></div>
      <FormError message={error || subscription.error}/>{subscription.loading ? <Loading/> : <>
        {(message || subscription.data?.requestedAt) && <p className="auth-success" role="status">{message || 'Đã gửi yêu cầu đăng ký gói. Quản trị viên sẽ liên hệ và kích hoạt gói của bạn.'}</p>}
        <div className="subscription-actions"><button className="button primary" disabled={busy || !!subscription.data?.requestedAt || !!subscription.error} onClick={registerPlan}>{busy ? <LoaderCircle className="spin" size={18}/> : <ArrowRight size={18}/>} {subscription.data?.requestedAt ? 'Đã gửi yêu cầu' : expired ? 'Đăng ký gia hạn 1 tháng' : 'Đăng ký gói 1 tháng'}</button><button className="button secondary" disabled={busy} onClick={checkPlan}><RefreshCw size={16}/> Kiểm tra gói</button></div><small className="subscription-hint">Gửi yêu cầu để quản trị viên liên hệ và kích hoạt gói. Bạn có thể cập nhật thông tin cá nhân trong menu tài khoản.</small>
      </>}
    </section>
  </div>;
}
