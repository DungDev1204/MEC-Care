import { useEffect, useState } from 'react';
import { Apple, Bell, BookOpen, Check, Download, Smartphone, ArrowRight, ArrowUpRight, LoaderCircle } from 'lucide-react';
import { AccountNavigation } from '../components/AccountNavigation';
import { useResource, useToast } from '../lib/hooks';
import { disablePush, enablePush, isInstalled, isIOS, pushSupported, serviceWorker, getInstallPrompt, clearInstallPrompt, type PushConfig, type InstallPrompt } from '../lib/pwa';
import { appName, isAdminApp, isAdminPage, type AppConfig } from '../lib/app-mode';
import { FormError } from '../components/ui';
import { InstallGuide } from '../components/InstallGuide';
import { useSession } from '../session';

export function AccountSettings({ embedded = false }: { embedded?: boolean }) {
  const { isAdmin } = useSession(); const site = useResource<AppConfig>('/app/config');
  const adminElsewhere = isAdmin && !isAdminApp() && (!!site.data?.adminUrl || !isAdminPage()); const name = isAdmin ? 'Clienté Admin' : 'Clienté';
  const adminInstallUrl = site.data?.adminUrl ? site.data.adminUrl + '/admin?tab=device' : new URL('/admin?tab=device', window.location.origin).href;
  const [guideOpen, setGuideOpen] = useState(false);
  const config = useResource<PushConfig>('/api/push/config'); const [subscribed, setSubscribed] = useState(false); const [busy, setBusy] = useState(''); const [error, setError] = useState('');
  const [installed, setInstalled] = useState(isInstalled()); const [prompt, setPrompt] = useState<InstallPrompt | undefined>(getInstallPrompt); const toast = useToast();
  useEffect(() => {
    setPrompt(getInstallPrompt());
    if (pushSupported()) serviceWorker().then(r => r.pushManager.getSubscription()).then(s => setSubscribed(!!s && Notification.permission === 'granted')).catch(() => {});
    const install = () => setPrompt(getInstallPrompt()); const installed = () => { setInstalled(true); setPrompt(undefined); clearInstallPrompt(); };
    window.addEventListener('install-prompt-ready', install); window.addEventListener('appinstalled', installed);
    return () => { window.removeEventListener('install-prompt-ready', install); window.removeEventListener('appinstalled', installed); };
  }, []);
  async function push() {
    setBusy('push'); setError('');
    try { if (subscribed) { await disablePush(); setSubscribed(false); toast('Đã tắt thông báo trên thiết bị này.'); } else { await enablePush(config.data!); setSubscribed(true); toast(isAdmin ? 'Đã bật thông báo đơn hàng trên thiết bị này.' : 'Đã bật lời nhắc trên thiết bị này.'); } }
    catch (e) { setError((e as Error).message); } finally { setBusy(''); }
  }
  async function install() {
    const current = getInstallPrompt(); if (!current) { setGuideOpen(true); return; }
    setBusy('install'); setError('');
    try { await current.prompt(); const choice = await current.userChoice; if (choice.outcome === 'dismissed') setGuideOpen(true); }
    catch (e) { setError((e as Error).message); setGuideOpen(true); }
    finally { setPrompt(undefined); clearInstallPrompt(); setBusy(''); }
  }
  const needsHomeScreen = isIOS() && !installed;
  return <>
    {!embedded && <><section className="page-heading"><div><span className="eyebrow">KHÔNG GIAN CỦA BẠN</span><h1>Cài đặt<span className="title-dot">.</span></h1><p>Thiết lập để mỗi lời nhắc luôn đến đúng nơi.</p></div></section><AccountNavigation/></>}
    <div className="account-settings device-settings">
      <section className="panel setting-card"><div className="setting-icon"><Smartphone size={25} strokeWidth={1.4}/></div><div className="setting-body">
        <div className="setting-heading"><h2>{name} trên màn hình chính</h2>{installed && !adminElsewhere && <span className="status purchased"><i/>Đang mở ứng dụng</span>}</div>
        <p>{isAdmin ? 'Biểu tượng Admin riêng, mở thẳng trang quản trị để kiểm tra và duyệt đơn hàng.' : 'Mở nhanh bằng biểu tượng riêng, với không gian rộng hơn cho việc chăm sóc khách hàng.'}</p>
        {adminElsewhere && <div className="setting-hint">Mở đường dẫn Admin bên dưới bằng Safari hoặc Chrome trên điện thoại, đăng nhập admin rồi cài từ trang đó.</div>}
        {site.error && adminElsewhere && <FormError message={site.error}/>}
        {isAdmin && !site.loading && !site.error && !site.data?.adminUrl && <div className="setting-hint">Nếu đã cài Clienté, dùng menu trình duyệt để thêm biểu tượng Clienté Admin.</div>}
        <div className="install-platform-preview"><span><Apple size={18}/> iPhone / iOS <small>Safari</small></span><span><Smartphone size={18}/> Android / Samsung <small>Chrome</small></span></div>
        <p className="install-guide-caption">Hướng dẫn từng bước, có hình minh họa vị trí cần bấm.</p>
        <div className="install-card-actions">
          {adminElsewhere && !site.loading && <a className="button primary" href={adminInstallUrl} target={site.data?.adminUrl ? '_blank' : undefined} rel={site.data?.adminUrl ? 'noopener noreferrer' : undefined}><ArrowUpRight size={16}/> Mở trang cài Clienté Admin</a>}
          {!adminElsewhere && !installed && prompt && <button type="button" className="button primary" disabled={!!busy || isAdmin && site.loading} onClick={install}>{busy === 'install' ? <LoaderCircle size={16} className="spin"/> : <Download size={16}/>} Cài {name}</button>}
          <button type="button" className="button secondary" onClick={() => setGuideOpen(true)}><BookOpen size={16}/> Hướng dẫn cài đặt<ArrowRight size={15}/></button>
        </div>
        {adminElsewhere && !site.loading && <small className="admin-app-address">{adminInstallUrl}</small>}
      </div></section>
      <section className="panel setting-card"><div className="setting-icon"><Bell size={24} strokeWidth={1.4}/></div><div className="setting-body">
        <div className="setting-heading"><h2>{isAdmin ? 'Thông báo đơn hàng trên điện thoại' : 'Lời nhắc trên thiết bị'}</h2><span className={`status ${subscribed && config.data?.enabled ? 'purchased' : ''}`}><i/>{subscribed && config.data?.enabled ? 'Đã bật' : 'Chưa bật'}</span></div>
        <p>{isAdmin ? 'Nhận thông báo khi khách báo đã chuyển khoản, kể cả khi bạn không mở ứng dụng. Bấm thông báo để mở đúng đơn cần duyệt.' : 'Nhận thông báo khi lịch chăm sóc đến hạn, kể cả khi bạn không mở Clienté.'}</p>
        {config.error ? <FormError message={config.error}/> : !config.loading && !config.data?.enabled ? <div className="setting-hint">{isAdmin ? 'Máy chủ chưa bật thông báo thật. Chuông trong ứng dụng vẫn hiển thị đơn chờ duyệt.' : 'Môi trường hiện tại chưa bật thông báo thật. Bạn vẫn có thể tạo và quản lý lịch chăm sóc.'}</div> : needsHomeScreen ? <div className="setting-hint">Trên iPhone: mở bằng Safari → Chia sẻ → Thêm vào Màn hình chính. Sau đó mở {appName()} từ biểu tượng và bật thông báo.</div> : !pushSupported() ? <div className="setting-hint">Mở bằng trình duyệt hỗ trợ qua HTTPS để bật thông báo.</div> : null}
        <button className="button primary" disabled={!!busy || config.loading || !!config.error || !config.data?.enabled || needsHomeScreen || !pushSupported()} onClick={push}>{busy === 'push' ? <LoaderCircle className="spin" size={16}/> : subscribed ? <Check size={16}/> : <Bell size={16}/>} {subscribed ? 'Tắt trên thiết bị này' : 'Bật thông báo'}</button>
        <small>Thông báo cần mạng và quyền trên thiết bị. Cài đặt Không làm phiền có thể ảnh hưởng việc hiển thị.</small>
      </div></section><FormError message={error}/>
    </div>
    {guideOpen && <InstallGuide onClose={() => setGuideOpen(false)} installed={installed && !adminElsewhere} pushEnabled={config.data?.enabled} admin={isAdmin} adminInstallUrl={adminInstallUrl}/>}
  </>;
}
