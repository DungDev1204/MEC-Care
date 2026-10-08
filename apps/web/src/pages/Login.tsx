import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, HeartHandshake, LoaderCircle, LockKeyhole, MailCheck } from 'lucide-react';
import { post, request } from '../lib/api';
import { safeReturn } from '../lib/utils';
import { useSession, type Session } from '../session';
import { FormError } from '../components/ui';

function Brand() { return <div className="brand"><img src="/icon.svg" alt=""/><span>Clienté<span className="brand-period">.</span></span></div>; }
type Pending = { registrationId: string; email: string; resendAfterSeconds: number };
export function Login({ review, register = false }: { review: boolean; register?: boolean }) {
  const [username, setUsername] = useState(''); const [confirmation, setConfirmation] = useState('');
  const [email, setEmailInput] = useState(''); const [loginName, setLoginName] = useState(''); const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [pending, setPending] = useState<Pending | null>(null); const [code, setCode] = useState('');
  const [verified, setVerified] = useState(false); const [cooldown, setCooldown] = useState(0); const [message, setMessage] = useState('');
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const { setEmail, setDisplayName, setIsAdmin, setAccess } = useSession(); const [params] = useSearchParams(); const navigate = useNavigate();
  useEffect(() => { if (register) request<{ registrationEnabled: boolean }>('/auth/registration/config').then(s => setRegistrationEnabled(s.registrationEnabled)).catch(() => {}); }, [register]);
  useEffect(() => { if (cooldown <= 0) return; const timer = setTimeout(() => setCooldown(v => v - 1), 1000); return () => clearTimeout(timer); }, [cooldown]);
  async function submit(e: FormEvent) {
    e.preventDefault(); setError(''); setMessage('');
    if (register && !pending && password !== confirmation) { setError('Mật khẩu nhập lại chưa khớp.'); return; }
    setBusy(true);
    try {
      if (register && pending) {
        const result = await post<{ message: string }>('/auth/register/verify', { registrationId: pending.registrationId, code });
        setVerified(true); setMessage(result.message); setPassword(''); setConfirmation(''); setCode('');
      } else if (register) {
        const result = await post<Pending>('/auth/register', { username, email, password });
        setPending(result); setCooldown(result.resendAfterSeconds);
      } else {
        const result = await post<Session>('/auth/login', { username: loginName, password });
        setEmail(result.email); setDisplayName(result.displayName); setIsAdmin(result.isAdmin); setAccess(result.canUseApp, result.accessStatus);
        navigate(params.get('return') ? safeReturn(params.get('return')) : result.isAdmin ? '/admin' : '/', { replace: true });
      }
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  async function resend() {
    setBusy(true); setError(''); setMessage('');
    try { const result = await post<{ message: string; resendAfterSeconds: number }>('/auth/register/resend', { registrationId: pending!.registrationId }); setCooldown(result.resendAfterSeconds); setCode(''); setMessage(result.message); }
    catch (err) { setError((err as Error).message); setCooldown(60); } finally { setBusy(false); }
  }
  return <div className="login-page">
    <section className="login-story"><Brand/><span className="login-story-label">THE ART OF CLIENT CARE</span>
      <div className="login-story-content"><span className="eyebrow">MỖI MỐI QUAN HỆ, MỘT HÀNH TRÌNH</span><h1>Sự quan tâm.<br/>Dấu ấn dài lâu.</h1><p>Một không gian tinh gọn để ghi nhớ khách hàng,<br className="desktop-only"/> chăm sóc đúng lúc và đồng hành sau mỗi chuyến xe.</p><div className="login-illustration" aria-hidden="true"><svg viewBox="0 0 600 200"><path d="M-40 198C120 198 60 50 285 50S530 175 670 20"/><path d="M-40 214C130 214 80 65 285 65S510 190 670 36"/><path d="M-40 182C100 182 40 35 285 35S550 160 670 4"/><circle cx="285" cy="49" r="16"/><circle cx="285" cy="49" r="6"/><path d="M-20 150h650" className="illustration-baseline"/></svg><span>MỌI HÀNH TRÌNH ĐỀU BẮT ĐẦU TỪ MỘT KẾT NỐI.</span></div></div><div className="login-story-footer"><span>CLIENTÉ / PERSONAL CLIENT CARE</span><HeartHandshake size={21} strokeWidth={1.1}/></div>
    </section>
    <section className="login-form-side"><div className="login-form-wrap"><div className="mobile-login-brand"><Brand/></div>
      <span className="eyebrow">{verified ? 'ĐÃ XÁC MINH EMAIL' : pending ? 'XÁC MINH EMAIL' : register ? 'BẮT ĐẦU MỘT HÀNH TRÌNH' : 'CHÀO MỪNG TRỞ LẠI'}</span>
      <h2>{verified ? 'Đăng ký thành công.' : pending ? 'Kiểm tra email của bạn.' : register ? <>Không gian riêng.<br/>Kết nối bền lâu.</> : <>Tiếp nối những<br/>mối quan hệ tốt đẹp.</>}</h2>
      <p>{verified ? 'Đăng nhập bằng username để đăng ký gói sử dụng.' : pending ? <>Nhập mã 6 số đã gửi tới <strong>{pending.email}</strong>. Mã có hiệu lực 10 phút.</> : register ? 'Tạo username, xác minh email rồi đăng nhập để đăng ký gói.' : 'Đăng nhập để mở không gian của bạn.'}</p>
      {review && !register && <div className="login-review"><span className="review-label">REVIEW</span> Môi trường thử với dữ liệu hư cấu.<button className="text-button" onClick={() => { setLoginName('review@clientstudio.local'); setPassword('Review123!'); }}>Điền tài khoản thử <ArrowRight size={14}/></button></div>}
      {register && !registrationEnabled && !verified && <FormError message="Đăng ký mới đang tạm đóng. Vui lòng liên hệ quản trị viên."/>}
      {message && <p className="auth-success" role="status"><MailCheck size={18}/>{message}</p>}
      {!verified && <form onSubmit={submit}><fieldset disabled={busy || register && !registrationEnabled}>
        {pending ? <label key="otp">Mã xác minh<input className="otp-input" autoFocus required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} placeholder="000000" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}/></label> : <>
          {register && <label>Username<input autoFocus required autoComplete="username" minLength={3} maxLength={32} pattern="[a-zA-Z0-9_]{3,32}" placeholder="Ví dụ: minh_anh" value={username} onChange={e => setUsername(e.target.value)}/><small className="auth-field-hint">3–32 ký tự: chữ không dấu, số hoặc dấu gạch dưới.</small></label>}
          {register ? <label>Email<input required type="email" autoComplete="email" maxLength={254} placeholder="ban@congty.vn" value={email} onChange={e => setEmailInput(e.target.value)}/><small className="auth-field-hint">Email dùng để xác minh tài khoản.</small></label> : <label>Username<input autoFocus required type="text" autoComplete="username" maxLength={254} placeholder="Nhập username của bạn" value={loginName} onChange={e => setLoginName(e.target.value)}/></label>}
          <label>Mật khẩu<div className="password-field"><input required type={visible ? 'text' : 'password'} autoComplete={register ? 'new-password' : 'current-password'} minLength={register ? 6 : undefined} maxLength={256} placeholder="Nhập mật khẩu của bạn" value={password} onChange={e => setPassword(e.target.value)}/><button type="button" className="icon-button" aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} onClick={() => setVisible(v => !v)}>{visible ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div>{register && <small className="auth-field-hint">Ít nhất 6 ký tự.</small>}</label>
          {register && <label>Nhập lại mật khẩu<input required type={visible ? 'text' : 'password'} autoComplete="new-password" minLength={6} maxLength={256} placeholder="Nhập lại mật khẩu" value={confirmation} onChange={e => setConfirmation(e.target.value)}/></label>}
        </>}
      </fieldset><FormError message={error}/><button type="submit" className="button primary login-submit" disabled={busy || register && !registrationEnabled}>{busy && <LoaderCircle className="spin" size={18}/>} {busy ? 'Đang xử lý…' : pending ? 'Xác minh email' : register ? 'Gửi mã xác minh' : 'Vào không gian của bạn'}<ArrowRight size={18}/></button></form>}
      {pending && !verified && <div className="otp-actions"><button className="text-button" disabled={busy || cooldown > 0 || !registrationEnabled} onClick={resend}>{cooldown > 0 ? `Gửi lại mã sau ${cooldown}s` : 'Gửi lại mã'}</button><button className="text-button" disabled={busy} onClick={() => { setPending(null); setError(''); setMessage(''); setCode(''); }}>Đổi thông tin đăng ký</button></div>}
      <div className="login-secure"><LockKeyhole size={16}/><span>Hồ sơ riêng. Kết nối an toàn.</span></div><div className="auth-switch"><span>{register ? 'Đã có tài khoản?' : 'Chưa có tài khoản?'}</span><Link className="text-button" to={`${register ? '/login' : '/register'}?return=${encodeURIComponent(safeReturn(params.get('return')))}`}>{register ? 'Đăng nhập' : 'Tạo tài khoản'}<ArrowRight size={14}/></Link></div>
    </div><footer>Chăm sóc khách hàng, bằng sự thấu hiểu.</footer></section>
  </div>;
}
