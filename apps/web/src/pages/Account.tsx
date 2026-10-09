import { useState, type FormEvent } from 'react';
import { Check, LoaderCircle, LockKeyhole, ShieldCheck, UserRound } from 'lucide-react';
import { AccountNavigation } from '../components/AccountNavigation';
import { Avatar, ErrorState, FormError, Loading } from '../components/ui';
import { put } from '../lib/api';
import type { AccountInfo } from '../lib/account';
import { useResource, useToast } from '../lib/hooks';
import { useSession } from '../session';
export function Account() {
  const account = useResource<AccountInfo>('/api/account');
  return <><section className="page-heading"><div><span className="eyebrow">KHÔNG GIAN CỦA BẠN</span><h1>Thông tin cá nhân<span className="title-dot">.</span></h1><p>Một hồ sơ của bạn, trên mọi thiết bị.</p></div></section><AccountNavigation/>
    {account.loading ? <Loading/> : account.error ? <ErrorState message={account.error} retry={account.reload}/> : account.data && <PersonalInfo account={account.data}/>}
  </>;
}
function PersonalInfo({ account }: { account: AccountInfo }) {
  const { setDisplayName } = useSession(); const toast = useToast();
  const [name, setName] = useState(account.displayName); const [phone, setPhone] = useState(account.phone);
  const [saved, setSaved] = useState({ name: account.displayName, phone: account.phone });
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const changed = name !== saved.name || phone !== saved.phone;
  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const result = await put<Pick<AccountInfo, 'email' | 'displayName' | 'phone'>>('/api/account', { displayName: name, phone });
      setName(result.displayName); setPhone(result.phone); setSaved({ name: result.displayName, phone: result.phone });
      setDisplayName(result.displayName); toast('Đã cập nhật thông tin cá nhân.');
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <div className="personal-layout">
    <section className="panel personal-summary"><Avatar name={saved.name || account.email.split('@')[0]} large/><span className="eyebrow">HỒ SƠ CÁ NHÂN</span><h2>{saved.name || 'Tài khoản của bạn'}</h2><p className="personal-email">{account.email}</p><div className="personal-stat-list"><div><strong>{account.customers}</strong><span>Khách hàng</span></div><div><strong>{account.contacts}</strong><span>Lần chăm sóc</span></div><div><strong>{account.reminders}</strong><span>Lịch đang bật</span></div></div><div className="account-privacy"><ShieldCheck size={22}/><p>Danh sách khách và lịch chăm sóc được lưu riêng theo tài khoản của bạn.</p></div></section>
    <section className="panel personal-form"><div className="setting-heading"><h2><UserRound size={20}/> Thông tin của bạn</h2><span className="muted-label">HỒ SƠ RIÊNG</span></div><p>Tên hiển thị sẽ xuất hiện trong menu tài khoản.</p><form onSubmit={save}><fieldset disabled={busy}><label>Tên hiển thị<input required maxLength={200} autoComplete="name" placeholder="Nhập họ tên của bạn" value={name} onChange={e => setName(e.target.value)}/></label><label>Số điện thoại <span className="optional-label">(không bắt buộc)</span><input type="tel" maxLength={32} autoComplete="tel" placeholder="Ví dụ: 090 123 4567" value={phone} onChange={e => setPhone(e.target.value)}/></label><label>ID người dùng<input value={account.userCode} readOnly/></label><label>Username<input value={account.username || ''} readOnly autoComplete="username"/></label><label>Email xác minh<input type="email" value={account.email} readOnly aria-describedby="email-help"/></label><small id="email-help" className="account-field-hint"><LockKeyhole size={14}/> Email dùng để xác minh tài khoản của bạn.</small></fieldset><FormError message={error}/><footer className="personal-form-actions"><span>{changed ? 'Bạn có thay đổi chưa lưu.' : 'Thông tin đã lưu.'}</span><button className="button primary" type="submit" disabled={busy || !changed}>{busy ? <LoaderCircle className="spin" size={16}/> : <Check size={16}/>} {busy ? 'Đang lưu…' : 'Lưu thay đổi'}</button></footer></form></section>
  </div>;
}
