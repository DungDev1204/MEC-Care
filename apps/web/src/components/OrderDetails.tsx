import { useEffect, useState, type FormEvent } from 'react';
import { Check, Copy, ExternalLink, LoaderCircle } from 'lucide-react';
import { post } from '../lib/api';
import { useLiveResource } from '../lib/live-resource';
import { expiryDate, money, orderDate, orderLabels, paymentLabels, qrUrl, type Order } from '../lib/orders';
import { useToast } from '../lib/hooks';
import { useSession } from '../session';
import { FormError, Loading, Modal } from './ui';

export function OrderDetails({ id, admin = false, onClose, onChanged }: { id: string; admin?: boolean; onClose: () => void; onChanged: () => void }) {
  const resource = useLiveResource<Order>(`${admin ? '/api/admin' : '/api'}/orders/${id}`, 5000);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [reference, setReference] = useState('');
  const [reason, setReason] = useState(''); const [action, setAction] = useState('approve'); const [confirmed, setConfirmed] = useState(false);
  const [now, setNow] = useState(Date.now()); const [qrFailed, setQrFailed] = useState(false); const toast = useToast(); const { refreshSession } = useSession();
  const order = resource.data;
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => { if (!admin && order?.state === 'completed') void refreshSession().catch(() => {}); }, [admin, order?.state, refreshSession]);
  useEffect(() => { if (order?.transactionReference) setReference(order.transactionReference); }, [order?.transactionReference]);
  useEffect(() => { if (order?.paymentState === 'received_issue' && action === 'reject') { setAction('payment_issue'); setConfirmed(false); } }, [order?.paymentState, action]);
  async function copy(value: string) { try { await navigator.clipboard.writeText(value); toast('Đã sao chép.'); } catch { toast('Hãy chọn và sao chép nội dung được hiển thị.'); } }
  async function userAction(kind: 'report' | 'cancel') {
    setBusy(true); setError('');
    try { await post(`/api/orders/${id}/${kind}`); resource.reload(); onChanged(); toast(kind === 'report' ? 'Đã báo chuyển khoản. Admin sẽ kiểm tra tiền.' : 'Đã hủy đơn.'); }
    catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  async function review(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      await post(`/api/admin/orders/${id}/review`, { action, ...(action !== 'reject' ? { transactionReference: reference } : {}), ...(action !== 'approve' ? { reason } : {}) });
      resource.reload(); onChanged(); setConfirmed(false); toast(action === 'approve' ? 'Đã xác nhận tiền và cấp thời hạn sử dụng.' : 'Đã cập nhật kết quả đối soát.');
      window.dispatchEvent(new Event('admin-orders-changed'));
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  const waited = order?.reportedAt ? Math.max(0, now - Date.parse(order.reportedAt)) : 0;
  const waiting = order?.state === 'pending_review';
  const reviewable = order && ['pending_review','rejected','payment_issue'].includes(order.state);
  return <Modal title={admin ? 'Đối soát đơn hàng' : 'Chi tiết đơn mua'} eyebrow={`CLIENTÉ / ${admin ? 'ADMIN' : 'ĐƠN MUA'}`} subtitle={order?.code} onClose={onClose} busy={busy} wide className="order-modal">
    <div className="order-scroll" tabIndex={0} role="region" aria-label="Chi tiết thanh toán">
      <FormError message={error || resource.error}/>{resource.loading ? <Loading/> : order && <>
        <div className="order-detail-heading"><span className={`order-badge order-${order.state}`}>{orderLabels[order.state]}</span><strong>{money(order.amount)}<small>Gói {order.months} tháng</small></strong></div>
        <dl className="order-facts"><div><dt>ID người dùng</dt><dd>{order.userCode}</dd></div><div><dt>Username</dt><dd>{order.username}</dd></div><div><dt>Ngày tạo đơn</dt><dd>{orderDate(order.createdAt)}</dd></div><div><dt>Ngày xác nhận tiền</dt><dd>{orderDate(order.paidAt)}</dd></div>{admin && <div><dt>Thanh toán</dt><dd>{paymentLabels[order.paymentState]}</dd></div>}</dl>
        {!admin && ['pending_payment','rejected'].includes(order.state) && <div className="payment-instructions">
          <div className="payment-qr">{!qrFailed ? <img src={qrUrl(order)} alt={`QR chuyển khoản cho đơn ${order.code}`} onError={() => setQrFailed(true)}/> : <p>Chưa tải được QR. Bạn có thể chuyển khoản theo thông tin bên cạnh.</p>}</div>
          <div><h3>Thông tin chuyển khoản</h3><dl className="payment-bank"><div><dt>Ngân hàng</dt><dd>{order.bankName}</dd></div><div><dt>Số tài khoản</dt><dd>{order.accountNumber}<button type="button" className="icon-button" aria-label="Sao chép số tài khoản" onClick={() => copy(order.accountNumber)}><Copy size={15}/></button></dd></div><div><dt>Chủ tài khoản</dt><dd>{order.accountName}</dd></div><div><dt>Nội dung chuyển khoản</dt><dd className="transfer-content">{order.transferContent}<button type="button" className="icon-button" aria-label="Sao chép nội dung chuyển khoản" onClick={() => copy(order.transferContent)}><Copy size={15}/></button></dd></div></dl><p className="field-note">Chuyển đúng {money(order.amount)} và giữ nguyên nội dung để admin đối soát. Nếu đã chuyển tiền, hãy báo xác nhận thay vì hủy đơn.</p></div>
        </div>}
        {waiting && <div className="order-waiting" role="status"><LoaderCircle size={23} className="spin"/><div><strong>Đang chờ admin xác nhận</strong><p>Khách đã báo chuyển khoản lúc {orderDate(order.reportedAt)}. {admin ? 'Kiểm tra giao dịch ngân hàng trước khi cấp gói.' : `Thời gian chờ: ${Math.floor(waited / 60000)} phút ${Math.floor(waited / 1000) % 60} giây. Dự kiến xử lý trong 10 phút.`}</p>{!admin && waited >= 600000 && <p>Đã quá 10 phút. Hãy liên hệ với admin và cung cấp mã đơn <strong>{order.code}</strong>. Đơn vẫn được giữ để xử lý.</p>}</div></div>}
        {order.rejectionReason && <div className="order-reason"><strong>Kết quả đối soát</strong><p>{order.rejectionReason}</p>{!admin && (order.state === 'rejected' ? <p>Nếu bạn đã chuyển tiền, hãy liên hệ với admin và cung cấp mã đơn <strong>{order.code}</strong>, hoặc bấm báo chuyển khoản lại để kiểm tra chính đơn này.</p> : order.state === 'payment_issue' && <p>Hãy liên hệ với admin và cung cấp mã đơn <strong>{order.code}</strong> để xử lý sai lệch thanh toán.</p>)}</div>}
        {order.activeAfter && <div className="auth-success"><Check size={20}/><div><strong>Đã kích hoạt / gia hạn thành công</strong><p>Gói có hiệu lực đến {expiryDate(order.activeAfter)} (giờ Việt Nam).</p></div></div>}
        {admin && <dl className="order-facts"><div><dt>Nội dung chuyển khoản</dt><dd>{order.transferContent}</dd></div><div><dt>Mã giao dịch</dt><dd>{order.transactionReference || '—'}</dd></div><div><dt>Người duyệt</dt><dd>{order.reviewerName || '—'}</dd></div><div><dt>Ngày duyệt</dt><dd>{orderDate(order.reviewedAt)}</dd></div><div><dt>Hạn trước khi cấp gói</dt><dd>{order.activeBefore ? expiryDate(order.activeBefore) : '—'}</dd></div><div><dt>Hạn sau khi cấp gói</dt><dd>{order.activeAfter ? expiryDate(order.activeAfter) : '—'}</dd></div></dl>}
        {admin && reviewable && <form id="order-review-form" className="order-review-form" onSubmit={review}><fieldset disabled={busy}>
          <h3>Xác nhận kết quả ngân hàng</h3><label>Cách xử lý<select value={action} onChange={e => { setAction(e.target.value); setConfirmed(false); }}><option value="approve">Đã nhận đủ tiền — kích hoạt / gia hạn</option><option value="payment_issue">Đã nhận tiền — cần xử lý sai lệch</option>{order.paymentState !== 'received_issue' && <option value="reject">Chưa xác nhận được tiền — từ chối</option>}</select></label>
          {action !== 'reject' && <label>Mã giao dịch ngân hàng <b>*</b><input required minLength={3} maxLength={100} value={reference} onChange={e => setReference(e.target.value)} placeholder="Nhập mã giao dịch để tránh ghi nhận trùng"/></label>}
          {action !== 'approve' && <label>Lý do đối soát <b>*</b><textarea required minLength={5} maxLength={500} rows={3} value={reason} onChange={e => setReason(e.target.value)} placeholder="Ghi rõ kết quả kiểm tra để khách biết cách xử lý"/></label>}
          <label className="check order-confirm-check"><input required type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}/> Tôi đã đối chiếu giao dịch thực tế với mã đơn, ID và số tiền.</label>
        </fieldset></form>}
        {!!order.history?.length && <div className="order-history"><h3>Lịch sử xử lý</h3>{order.history.map((item, index) => <div key={`${item.createdAt}-${index}`}><span>{orderDate(item.createdAt)}</span><p>{({ order_report: 'Khách báo đã chuyển khoản', order_cancel: 'Khách hủy đơn chưa chuyển tiền', order_approve: 'Admin xác nhận tiền và cấp gói', order_reject: 'Admin từ chối sau đối soát', order_payment_issue: 'Admin ghi nhận tiền có sai lệch' } as Record<string, string>)[item.action] || item.action}{item.reason && ` · ${item.reason}`}</p></div>)}</div>}
      </>}
    </div>
    <footer className="form-actions order-modal-actions"><button className="button secondary" type="button" disabled={busy} onClick={onClose}>Đóng</button>{order && <>
      {!admin && order.state === 'pending_payment' && <button className="button secondary" type="button" disabled={busy} onClick={() => userAction('cancel')}>Hủy đơn chưa chuyển tiền</button>}
      {!admin && ['pending_payment','rejected'].includes(order.state) && <button className="button primary" type="button" disabled={busy} onClick={() => userAction('report')}>{busy ? 'Đang gửi…' : 'Tôi đã chuyển khoản'}</button>}
      {!admin && order.contactUrl && (waiting || ['rejected','payment_issue'].includes(order.state)) && <a className="button secondary" href={order.contactUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={16}/> Liên hệ với admin</a>}
      {admin && reviewable && <button className="button primary" form="order-review-form" disabled={busy || !confirmed}>{busy ? 'Đang lưu…' : action === 'approve' ? 'Xác nhận tiền và cấp gói' : 'Lưu kết quả đối soát'}</button>}
    </>}</footer>
  </Modal>;
}
