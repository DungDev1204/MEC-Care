import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Clock3, HeartHandshake, RefreshCw, ArrowRight, LoaderCircle } from 'lucide-react';
import { useSession } from '../session';
import { useLiveResource } from '../lib/live-resource';
import { expiryDate, money, orderDate, type Order, type SubscriptionInfo } from '../lib/orders';
import { post } from '../lib/api';
import { OrderDetails } from '../components/OrderDetails';
import { FormError, Loading } from '../components/ui';

export function Subscription({ embedded = false }: { embedded?: boolean }) {
  const { displayName, accessStatus, canUseApp, refreshSession } = useSession(); const resource = useLiveResource<SubscriptionInfo>('/api/subscription', 5000);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [selection, setSelection] = useState<string | null>(null);
  const data = resource.data; const active = data?.accessStatus === 'active'; const expired = data?.accessStatus === 'expired'; const unrestricted = data?.subscriptionEnabled === false;
  useEffect(() => { if (data && (data.accessStatus !== accessStatus || data.canUseApp !== canUseApp)) void refreshSession().catch(() => {}); }, [data?.accessStatus, data?.canUseApp, accessStatus, canUseApp, refreshSession]);
  async function purchase() {
    if (data?.openOrder) { setSelection(data.openOrder.id); return; }
    setBusy(true); setError('');
    try { const order = await post<Order>('/api/orders'); setSelection(order.id); resource.reload(); }
    catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  return <div className={`subscription-page ${embedded ? 'subscription-embedded' : ''}`}>
    {!embedded && <header className="page-heading"><div><span className="eyebrow">KHÔNG GIAN CỦA BẠN</span><h1>Chào {displayName || 'bạn'}<span className="title-dot">.</span></h1><p>Quản lý gói sử dụng và tiếp tục hành trình chăm sóc khách hàng.</p></div></header>}
    <section className="panel subscription-panel" aria-labelledby="subscription-title"><span className="subscription-icon"><HeartHandshake size={34} strokeWidth={1.3}/></span><span className="eyebrow">CLIENTÉ / GÓI SỬ DỤNG</span><h2 id="subscription-title">{unrestricted ? 'Bạn có thể sử dụng bình thường.' : active ? 'Gói của bạn đang hoạt động.' : expired ? 'Gia hạn để tiếp tục.' : 'Đăng ký gói sử dụng.'}</h2>
      {data && <div className="subscription-account"><span>ID của bạn <strong>{data.userCode}</strong></span>{data.activeUntil && <span>Hết hạn <strong>{expiryDate(data.activeUntil)}</strong><small>Giờ Việt Nam</small></span>}</div>}
      {!unrestricted && <div className="subscription-plan"><div><strong>Gói chăm sóc khách hàng</strong><span><Clock3 size={16}/> Thời hạn 1 tháng{data?.settings && <b className="subscription-price">{money(data.settings.monthlyPrice)}</b>}</span></div><ul><li><Check size={17}/> Quản lý hồ sơ và hình ảnh khách hàng</li><li><Check size={17}/> Ghi nhận lịch sử chăm sóc</li><li><Check size={17}/> Lịch nhắc và thông báo</li></ul></div>}
      <FormError message={error || resource.error}/>{resource.loading ? <Loading/> : data && <>
        {data.openOrder && <p className="auth-success">Bạn có một đơn đang xử lý: <strong>{data.openOrder.code}</strong>. Mở đơn để xem thanh toán và kết quả đối soát.</p>}
        {unrestricted ? <p className="field-note">Ứng dụng đang mở cho mọi người dùng đã xác minh email. Bạn không cần đăng ký gói để sử dụng.</p> : !data.canPurchase && !data.openOrder && <p className="field-note">{data.renewalOpensAt ? `Bạn có thể gia hạn từ ${orderDate(data.renewalOpensAt)} (giờ Việt Nam).` : 'Tài khoản đang được cấp quyền không giới hạn.'}</p>}
        {!unrestricted && !data.settings && !data.openOrder && <p className="field-note">Admin chưa cấu hình thanh toán. Vui lòng liên hệ người quản trị.</p>}
        <div className="subscription-actions">{(!unrestricted || data.openOrder) && <button className="button primary" disabled={busy || !!resource.error || !data.openOrder && (!data.canPurchase || !data.settings)} onClick={purchase}>{busy ? <LoaderCircle className="spin" size={18}/> : <ArrowRight size={18}/>} {data.openOrder ? 'Xem đơn đang xử lý' : active ? 'Thanh toán gia hạn' : expired ? 'Thanh toán gia hạn 1 tháng' : 'Thanh toán gói 1 tháng'}</button>}{unrestricted && <Link to="/customers" className="button primary"><ArrowRight size={18}/> Vào ứng dụng</Link>}<button className="button secondary" disabled={busy} onClick={() => { resource.reload(); void refreshSession().catch(err => setError(err.message)); }}><RefreshCw size={16}/> {unrestricted ? 'Kiểm tra trạng thái' : 'Kiểm tra gói'}</button>{!embedded && <Link to="/orders" className="button secondary">Đơn mua của tôi</Link>}</div>
        <small className="subscription-hint">{unrestricted ? 'Các gói đã đăng ký và ngày hết hạn vẫn được giữ nguyên.' : 'Chuyển khoản theo mã đơn. Gói được cấp sau khi admin xác nhận tiền. Gia hạn mở từ ngày hết hạn.'}</small>
      </>}
    </section>{selection && <OrderDetails id={selection} onClose={() => setSelection(null)} onChanged={resource.reload}/>}
  </div>;
}
