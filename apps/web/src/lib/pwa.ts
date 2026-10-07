import { post, request } from './api';
export type PushConfig = { enabled: boolean; publicKey: string | null };
export const isInstalled = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
export const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
export const pushSupported = () => window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
export async function serviceWorker() {
  if (!window.isSecureContext || !('serviceWorker' in navigator)) throw new Error('Thông báo cần đường dẫn HTTPS.');
  await navigator.serviceWorker.register('/sw.js');
  return await Promise.race([navigator.serviceWorker.ready, new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Chưa sẵn sàng nhận thông báo. Tải lại trang rồi thử lại.')), 12000))]);
}
export async function enablePush(config: PushConfig) {
  if (!config.enabled || !config.publicKey) throw new Error('Thông báo chưa được bật cho môi trường này. Lịch chăm sóc vẫn được lưu.');
  if (isIOS() && !isInstalled()) throw new Error('Trên iPhone, thêm Clienté vào Màn hình chính bằng Safari, rồi mở từ biểu tượng để bật thông báo.');
  if (!pushSupported()) throw new Error('Hãy mở bằng Safari trên iPhone hoặc Chrome/Samsung Internet qua HTTPS.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Chưa được cấp quyền thông báo. Bạn có thể bật lại trong cài đặt trình duyệt.');
  const registration = await serviceWorker();
  const raw = atob(config.publicKey.replace(/-/g, '+').replace(/_/g, '/')); const key = new Uint8Array(raw.length); for (let i = 0; i < raw.length; i++) key[i] = raw.charCodeAt(i);
  const subscription = await registration.pushManager.getSubscription() || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  await post('/api/push/subscribe', subscription.toJSON());
}
export async function disablePush() { const registration = await serviceWorker(); const subscription = await registration.pushManager.getSubscription(); if (subscription) { await post('/api/push/unsubscribe', { endpoint: subscription.endpoint }); await subscription.unsubscribe(); } const notifications = await registration.getNotifications(); notifications.forEach(n => n.close()); }
export async function syncPush() {
  if (!pushSupported() || Notification.permission !== 'granted') return;
  const config = await request<PushConfig>('/api/push/config'); if (!config.enabled) return;
  const registration = await serviceWorker(); const subscription = await registration.pushManager.getSubscription(); if (subscription) await post('/api/push/subscribe', subscription.toJSON());
}
export type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
let installPrompt: InstallPrompt | undefined;
export const getInstallPrompt = () => installPrompt;
export function captureInstallPrompt(event: Event) { event.preventDefault(); installPrompt = event as InstallPrompt; window.dispatchEvent(new Event('install-prompt-ready')); }
export function clearInstallPrompt() { installPrompt = undefined; }
