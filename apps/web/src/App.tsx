import { useCallback, useEffect, useState } from 'react';
import { BrowserRouter, Link, NavLink, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { Bell, CalendarDays, ChevronRight, HeartHandshake, UsersRound, WifiOff } from 'lucide-react';
import { request } from './lib/api';
import { useOnline, useToast } from './lib/hooks';
import { formatDate, loginDestination } from './lib/utils';
import { clearInstallPrompt, serviceWorker, syncPush } from './lib/pwa';
import { SessionContext, useSession, type Session, type AccessStatus } from './session';
import { FormError, Loading } from './components/ui';
import { Login } from './pages/Login';
import { Admin } from './pages/Admin';
import { Subscription } from './pages/Subscription';
import { Customers } from './pages/Customers';
import { Profile } from './pages/Profile';
import { Agenda } from './pages/Agenda';
import { Account } from './pages/Account';
import { AccountSettings } from './pages/AccountSettings';
import { AdvancedSettings } from './pages/AdvancedSettings';
import { AvatarMenu } from './components/AvatarMenu';
import { LogoutDialog } from './components/LogoutDialog';
import { Announcements } from './components/Announcements';
import { Orders } from './pages/Orders';
import { AdminOrderNotifications } from './components/AdminOrderNotifications';
import { appIcon, appName, isAdminApp, isAdminPath, syncAppIdentity } from './lib/app-mode';
import { CommunityLink } from './components/CommunityLink';

export default function App() {
  const [canUseApp, setCanUseApp] = useState(false); const [accessStatus, setAccessStatus] = useState<AccessStatus>('pending'); const [isAdmin, setIsAdmin] = useState(false); const [email, setEmail] = useState<string | null>(null); const [displayName, setDisplayName] = useState(''); const [loading, setLoading] = useState(true); const [review, setReview] = useState(false); const [connectionError, setConnectionError] = useState(''); const [retry, setRetry] = useState(0); const toast = useToast();
  const setAccess = useCallback((canUse: boolean, status: AccessStatus) => { setCanUseApp(canUse); setAccessStatus(status); }, []);
  const applySession = useCallback((s: Session) => { setEmail(s.email); setDisplayName(s.displayName); setIsAdmin(s.isAdmin); setAccess(s.canUseApp, s.accessStatus); }, [setAccess]);
  const refreshSession = useCallback(async () => { applySession(await request<Session>('/api/session')); }, [applySession]);
  useEffect(() => { const controller = new AbortController(); setLoading(true); setConnectionError(''); request<Session>('/api/session', { signal: controller.signal }).then(s => { setEmail(s.email); setDisplayName(s.displayName); setIsAdmin(s.isAdmin); setAccess(s.canUseApp, s.accessStatus); }).catch(e => { if (!controller.signal.aborted && e.status !== 401) setConnectionError(e.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); }); request<{ mode: string }>('/health', { signal: controller.signal }).then(h => setReview(h.mode === 'review')).catch(() => {}); return () => controller.abort(); }, [retry, setAccess]);
  useEffect(() => { const expired = () => { setEmail(null); setDisplayName(''); setIsAdmin(false); setAccess(false, 'pending'); }; window.addEventListener('session-expired', expired); return () => window.removeEventListener('session-expired', expired); }, [setAccess]);
  useEffect(() => { const blocked = (e: Event) => setAccess(false, (e as CustomEvent).detail?.accessStatus === 'expired' ? 'expired' : 'pending'); window.addEventListener('subscription-required', blocked); return () => window.removeEventListener('subscription-required', blocked); }, [setAccess]);
  useEffect(() => {
    if (!email) return;
    let controller: AbortController | undefined;
    const update = () => {
      if (document.hidden || !navigator.onLine) return;
      controller?.abort(); controller = new AbortController(); const signal = controller.signal;
      void request<Session>('/api/session', { signal }).then(s => { if (!signal.aborted) applySession(s); }).catch(() => {});
    };
    const timer = window.setInterval(update, 10000);
    window.addEventListener('focus', update); window.addEventListener('online', update); document.addEventListener('visibilitychange', update);
    return () => { controller?.abort(); clearInterval(timer); window.removeEventListener('focus', update); window.removeEventListener('online', update); document.removeEventListener('visibilitychange', update); };
  }, [email, applySession]);
  useEffect(() => { if (window.isSecureContext && 'serviceWorker' in navigator) serviceWorker().catch(() => {}); }, []);
  useEffect(() => { if (!email) setIsAdmin(false); if (email && canUseApp) syncPush().catch(() => toast('Chưa đồng bộ được thông báo. Kiểm tra trong Tài khoản.')); }, [email, canUseApp, toast]);
  if (loading) return <div className="boot"><Brand/><Loading/></div>;
  if (connectionError) return <div className="boot"><Brand/><FormError message={connectionError}/><button className="button primary" onClick={() => setRetry(v => v + 1)}>Kết nối lại</button></div>;
  return <SessionContext.Provider value={{ email, setEmail, displayName, setDisplayName, isAdmin, setIsAdmin, canUseApp, accessStatus, setAccess, refreshSession }}><BrowserRouter><AppIdentity/><Routes><Route path="/login" element={email ? <AuthenticatedRedirect/> : <Login key="login" review={review}/>}/><Route path="/register" element={isAdminApp() ? <Navigate to="/login" replace/> : email ? <AuthenticatedRedirect/> : <Login key="register" review={review} register/>}/><Route element={email ? <Layout review={review}/> : <LoginRedirect/>}><Route path="admin" element={<Admin/>}/><Route element={<PlanAccess/>}><Route index element={<HomePage/>}/><Route path="customers" element={<Customers/>}/><Route path="customers/:id" element={<Profile/>}/><Route path="agenda" element={<Agenda/>}/><Route path="account/settings" element={<AccountSettings/>}/><Route path="account/advanced" element={<AdvancedSettings/>}/></Route><Route path="launch" element={<LaunchPage/>}/><Route path="subscription" element={<SubscriptionPage/>}/><Route path="orders" element={<Orders/>}/><Route path="account" element={<Account/>}/><Route path="*" element={<NotFound/>}/></Route></Routes></BrowserRouter></SessionContext.Provider>;
}
function AppIdentity() {
  const location = useLocation();
  useEffect(() => { if (syncAppIdentity()) clearInstallPrompt(); }, [location.pathname, location.search]);
  return null;
}
function LoginRedirect() { const location = useLocation(); return <Navigate to={`/login?return=${encodeURIComponent(location.pathname + location.search)}`} replace/>; }
function Brand() { return <div className="brand"><img src={appIcon()} alt=""/><span>{appName()}<span className="brand-period">.</span></span></div>; }
function Layout({ review }: { review: boolean }) {
  const [logoutOpen, setLogoutOpen] = useState(false); const location = useLocation(); const online = useOnline(); const { isAdmin, accessStatus } = useSession();
  const admin = isAdminPath(location.pathname);
  const section = admin ? 'Admin' : location.pathname === '/subscription' ? accessStatus === 'expired' ? 'Gia hạn gói' : 'Đăng ký gói' : location.pathname.startsWith('/orders') ? 'Đơn mua của tôi' : location.pathname.startsWith('/agenda') ? 'Lịch chăm sóc' : location.pathname === '/account/advanced' ? 'Cài đặt nâng cao' : location.pathname === '/account/settings' ? 'Cài đặt' : location.pathname.startsWith('/account') ? 'Thông tin cá nhân' : 'Khách hàng';
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); document.title = `${appName()} · ${section}`; }, [location.pathname, section]);
  return <div className={`app-shell ${admin ? 'admin-shell' : ''}`}><a className="skip-link" href="#main">Đến nội dung chính</a>{!admin && <aside className="sidebar"><Link className="brand-link" to="/" aria-label="Clienté — Danh sách khách"><Brand/></Link><span className="sidebar-caption">THE ART OF CLIENT CARE</span><div className="sidebar-rule"/><span className="nav-label">KHÔNG GIAN LÀM VIỆC</span><nav aria-label="Điều hướng chính"><NavLink to={isAdmin ? "/customers" : "/"} end className={({ isActive }) => isActive || location.pathname.startsWith('/customers/') ? 'active' : ''}><UsersRound size={19}/><span>Khách hàng</span><ChevronRight size={14}/></NavLink><NavLink to="/agenda"><CalendarDays size={19}/><span>Lịch chăm sóc</span><ChevronRight size={14}/></NavLink></nav><div className="sidebar-message"><HeartHandshake size={25} strokeWidth={1.2}/><p>Sự quan tâm tốt đẹp<br/>luôn được ghi nhớ.</p><span>YOUR RELATIONSHIPS MATTER</span></div><AvatarMenu variant="sidebar" onLogout={() => setLogoutOpen(true)}/></aside>}<div className="main-shell"><header className="topbar">{admin ? <Link className="admin-brand" to="/admin"><Brand/></Link> : <><div className="breadcrumb"><span>Không gian của bạn</span><ChevronRight size={12}/><strong>{section}</strong></div><Link className="mobile-brand" to="/"><Brand/></Link></>}<div className="topbar-actions">{isAdmin && <AdminOrderNotifications review={review}/>}<span className="today-label">{formatDate(new Date().toISOString())}</span>{admin ? <Link to="/customers" className="button secondary admin-back">Về ứng dụng</Link> : <Link to="/agenda" className="icon-button" aria-label="Mở lịch nhắc"><Bell size={19}/></Link>}<AvatarMenu variant="top" onLogout={() => setLogoutOpen(true)}/></div></header>{review && <div className="review-banner"><span>REVIEW</span> Dữ liệu và ngân hàng mẫu · Không chuyển tiền thật · Web Push thật đang tắt</div>}{!online && <div className="offline-banner" role="status"><WifiOff size={16}/> Đang ngoại tuyến. Kết nối lại để lưu các thay đổi.</div>}<main id="main" tabIndex={-1}><Outlet/></main><footer className="app-footer"><span>Clienté <span>·</span> Những mối quan hệ bền lâu.</span><div className="app-footer-actions">{!admin && <CommunityLink/>}<span className="app-footer-caption">CHĂM SÓC BẰNG SỰ THẤU HIỂU</span></div></footer></div>{!admin && <nav className="mobile-nav" aria-label="Điều hướng điện thoại"><NavLink to={isAdmin ? "/customers" : "/"} end className={({ isActive }) => isActive || location.pathname.startsWith('/customers/') ? 'active' : ''}><UsersRound size={20}/><span>Khách hàng</span></NavLink><NavLink to="/agenda"><CalendarDays size={20}/><span>Lịch chăm sóc</span></NavLink><AvatarMenu variant="mobile" onLogout={() => setLogoutOpen(true)}/></nav>}{!admin && <Announcements/>}{logoutOpen && <LogoutDialog onClose={() => setLogoutOpen(false)}/>}</div>;
}
function NotFound() { return <div className="empty"><h1>Trang này chưa có.</h1><p>Trở về danh sách để tiếp tục chăm sóc khách hàng.</p><Link to="/" className="button primary">Danh sách khách hàng</Link></div>; }

function AuthenticatedRedirect() { const session = useSession(); const location = useLocation(); const target = new URLSearchParams(location.search).get('return'); return <Navigate to={loginDestination(session, target)} replace/>; }

function LaunchPage() { const session = useSession(); return <Navigate to={loginDestination(session, null)} replace/>; }
function HomePage() { const { isAdmin } = useSession(); return isAdmin ? <Navigate to="/admin" replace/> : <Customers/>; }

function PlanAccess() { const { canUseApp } = useSession(); return canUseApp ? <Outlet/> : <Navigate to="/subscription" replace/>; }
function SubscriptionPage() { const { canUseApp } = useSession(); return canUseApp ? <Navigate to="/" replace/> : <Subscription/>; }
