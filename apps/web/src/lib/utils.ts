export const zone = 'Asia/Ho_Chi_Minh';
export const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
export function localDateTime(date = new Date()) {
  const p = new Intl.DateTimeFormat('sv-SE', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
  return p.replace(' ', 'T');
}
export const today = () => localDateTime().slice(0, 10);
export const formatDate = (value?: string | null) => value ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeZone: zone }).format(new Date(value)) : 'Chưa bổ sung';
export const formatTime = (value: string) => new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short', timeZone: zone }).format(new Date(value.includes('Z') || /[+-]\d\d:\d\d$/.test(value) ? value : `${value}+07:00`));
export const clockTime = (value: string) => new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: zone }).format(new Date(value));
export function age(birth?: string | null, at = today()) { if (!birth) return null; const [y, m, d] = birth.split('-').map(Number); const [ty, tm, td] = at.split('-').map(Number); return ty - y - (tm < m || (tm === m && td < d) ? 1 : 0); }
export const initials = (name: string) => name.split(' · ')[0].split(/\s+/).filter(Boolean).slice(-2).map(s => s[0]).join('').toUpperCase();
export const relativeContact = (date?: string | null) => { if (!date) return 'Chưa liên hệ'; const days = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 86400000)); return days === 0 ? 'Hôm nay' : days === 1 ? 'Hôm qua' : `${days} ngày trước`; };
export const safeReturn = (value: string | null) => value?.startsWith('/') && !value.startsWith('//') && !/[\\\u0000-\u001f\u007f]/.test(value) && !value.startsWith('/login') && !value.startsWith('/register') ? value : '/';
export function loginDestination(session: { isAdmin: boolean; canUseApp: boolean }, target: string | null) {
  if (!session.isAdmin && !session.canUseApp) return '/subscription';
  return target ? safeReturn(target) : session.isAdmin ? '/admin' : '/';
}
