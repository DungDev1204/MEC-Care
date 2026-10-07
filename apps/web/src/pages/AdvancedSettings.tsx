import { useState } from 'react';
import { Archive, Check, Download, Image, LoaderCircle, ShieldCheck } from 'lucide-react';
import { AccountNavigation } from '../components/AccountNavigation';
import { ErrorState, FormError, Loading } from '../components/ui';
import { downloadBackup, type AccountInfo } from '../lib/account';
import { useResource, useToast } from '../lib/hooks';
export function AdvancedSettings() {
  const account = useResource<AccountInfo>('/api/account'); const toast = useToast();
  const [includePhotos, setIncludePhotos] = useState(true); const [busy, setBusy] = useState(false);
  const [error, setError] = useState(''); const [exported, setExported] = useState('');
  async function backup() {
    setBusy(true); setError(''); setExported('');
    try { await downloadBackup(includePhotos); setExported(new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })); toast('Bản sao đã sẵn sàng tải xuống.'); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <><section className="page-heading"><div><span className="eyebrow">DỮ LIỆU & BẢO VỆ</span><h1>Cài đặt nâng cao<span className="title-dot">.</span></h1><p>Giữ một bản sao cho những mối quan hệ bạn chăm sóc.</p></div></section><AccountNavigation/>
    {account.loading ? <Loading/> : account.error ? <ErrorState message={account.error} retry={account.reload}/> : account.data && <div className="advanced-layout">
      <section className="panel backup-card"><div className="backup-heading"><div className="setting-icon"><Archive size={26} strokeWidth={1.4}/></div><div><span className="eyebrow">BẢN SAO CÁ NHÂN</span><h2>Sao lưu dữ liệu</h2><p>Tải dữ liệu hiện tại của tài khoản thành một tệp ZIP.</p></div><span className="backup-format">ZIP</span></div><div className="backup-stats"><div><strong>{account.data.customers}</strong><span>Khách hàng & xe</span></div><div><strong>{account.data.contacts}</strong><span>Lần chăm sóc</span></div><div><strong>{account.data.photos}</strong><span>Ảnh trong hồ sơ</span></div></div><p className="backup-description">Bản sao gồm thông tin cá nhân, hồ sơ khách, xe, lịch sử chăm sóc và các lịch nhắc, kể cả lịch đã hoàn thành.</p><label className="backup-photo-option"><input type="checkbox" checked={includePhotos} disabled={busy} onChange={e => setIncludePhotos(e.target.checked)}/><Image size={21}/><span><strong>Kèm ảnh trong hồ sơ</strong><small>Bao gồm ảnh đại diện khách và album. Có thể cần thêm thời gian tải.</small></span></label><FormError message={error}/><div className="backup-actions"><button className="button primary" type="button" disabled={busy} onClick={backup}>{busy ? <LoaderCircle size={17} className="spin"/> : <Download size={17}/>} {busy ? 'Đang tạo bản sao…' : 'Tải bản sao ZIP'}</button><span className="account-field-hint">{includePhotos ? 'Dữ liệu và ảnh' : 'Chỉ dữ liệu, không kèm tệp ảnh'}</span></div>{exported && <p className="backup-success" role="status"><Check size={17}/> Bản sao sẵn sàng · {exported}. Kiểm tra mục tải xuống trên thiết bị.</p>}</section>
      <aside className="panel backup-note"><ShieldCheck size={28} strokeWidth={1.3}/><h2>Dữ liệu thuộc về bạn</h2><p>Bản sao chỉ chứa dữ liệu của tài khoản đang đăng nhập.</p><p>Lưu tệp ở nơi riêng tư vì bản sao có thông tin khách hàng.</p><div className="backup-note-rule"/><h3>Cần khôi phục dữ liệu?</h3><p>Giữ lại tệp ZIP và liên hệ quản trị để được hỗ trợ. Sao lưu và khôi phục toàn bộ hệ thống thuộc phần quản trị.</p></aside>
    </div>}
  </>;
}
