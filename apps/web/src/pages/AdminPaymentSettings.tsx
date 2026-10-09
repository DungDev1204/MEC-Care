import { useState, type FormEvent } from 'react';
import { CreditCard, Save } from 'lucide-react';
import { useResource, useToast } from '../lib/hooks';
import { put } from '../lib/api';
import { banks } from '../lib/banks';
import type { PaymentSettings } from '../lib/orders';
import { FormError, Loading } from '../components/ui';

export function AdminPaymentSettings() {
  const resource = useResource<{ settings: PaymentSettings | null }>('/api/admin/payment-settings');
  return resource.loading ? <Loading/> : resource.error ? <FormError message={resource.error}/> : <PaymentForm initial={resource.data?.settings || null}/>;
}
function PaymentForm({ initial }: { initial: PaymentSettings | null }) {
  const [value, setValue] = useState<PaymentSettings>(initial || { bankCode: '', bankName: '', accountNumber: '', accountName: '', monthlyPrice: 0, contactUrl: '' });
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const toast = useToast();
  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try { await put('/api/admin/payment-settings', { bankCode: value.bankCode, bankName: value.bankName, accountNumber: value.accountNumber, accountName: value.accountName, monthlyPrice: value.monthlyPrice, contactUrl: value.contactUrl.trim() }); toast('Đã lưu thông tin thanh toán. Đơn đã tạo vẫn giữ thông tin cũ.'); }
    catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  return <section className="panel admin-payment-settings"><div className="setting-heading"><h2><CreditCard size={22}/> Thanh toán & hỗ trợ</h2></div><p>Thông tin này được hiển thị khi khách mua hoặc gia hạn gói. Đơn đã tạo giữ nguyên số tiền và tài khoản nhận.</p><form onSubmit={save}><fieldset disabled={busy}>
    <label>Ngân hàng nhận tiền <b>*</b><select required value={value.bankCode} onChange={e => { const bank = banks.find(bank => bank.bin === e.target.value); setValue({ ...value, bankCode: e.target.value, bankName: bank ? `${bank.shortName} · ${bank.name}`.slice(0, 100) : '' }); }}><option value="">Chọn ngân hàng</option>{banks.map(bank => <option key={bank.bin} value={bank.bin}>{bank.shortName} — {bank.name}</option>)}</select></label>
    <div className="form-grid"><label>Số tài khoản <b>*</b><input required inputMode="numeric" pattern="[0-9]{6,32}" maxLength={32} value={value.accountNumber} onChange={e => setValue({ ...value, accountNumber: e.target.value })} placeholder="Nhập đúng số tài khoản nhận"/></label><label>Tên chủ tài khoản <b>*</b><input required minLength={5} maxLength={50} value={value.accountName} onChange={e => setValue({ ...value, accountName: e.target.value.toUpperCase() })} placeholder="TEN CHU TAI KHOAN"/></label></div>
    <div className="form-grid"><label>Giá gói 1 tháng (VND) <b>*</b><input required type="number" min={1000} max={100000000} step={1000} value={value.monthlyPrice || ''} onChange={e => setValue({ ...value, monthlyPrice: Number(e.target.value) })} placeholder="Nhập giá bán"/></label><label>Đường dẫn liên hệ admin <span className="optional-label">(không bắt buộc)</span><input type="url" maxLength={200} value={value.contactUrl} onChange={e => setValue({ ...value, contactUrl: e.target.value })} placeholder="https://t.me/ten_admin" aria-describedby="admin-contact-hint"/><small className="auth-field-hint" id="admin-contact-hint">Dùng đường dẫn HTTPS. Để trống để ẩn nút liên hệ với admin.</small></label></div>
    </fieldset><FormError message={error}/><button className="button primary" disabled={busy}><Save size={17}/>{busy ? 'Đang lưu…' : 'Lưu thông tin thanh toán'}</button></form></section>;
}
