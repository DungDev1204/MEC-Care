import { safeReturn } from './utils';

export type AppConfig = { mode: 'user' | 'admin'; adminUrl: string; userUrl: string };
export const isAdminApp = () => document.documentElement.dataset.appMode === 'admin';
export const isAdminPath = (pathname: string) => pathname === '/admin' || pathname.startsWith('/admin/');
export function isAdminPage() {
  if (isAdminApp() || isAdminPath(window.location.pathname)) return true;
  if (window.location.pathname !== '/login') return false;
  const target = safeReturn(new URLSearchParams(window.location.search).get('return'));
  return isAdminPath(new URL(target, window.location.origin).pathname);
}
export const appName = () => isAdminPage() ? 'Clienté Admin' : 'Clienté';
export const appIcon = (png = false) => `/${isAdminPage() ? 'admin-' : ''}icon${png ? '-192.png' : '.svg'}`;
export function syncAppIdentity() {
  const manifest = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  const manifestUrl = isAdminPage() && !isAdminApp() ? '/admin-manifest.webmanifest' : '/manifest.webmanifest';
  const manifestChanged = !!manifest && manifest.getAttribute('href') !== manifestUrl;
  document.querySelector<HTMLLinkElement>('link[rel="icon"]')?.setAttribute('href', appIcon());
  document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]')?.setAttribute('href', appIcon(true));
  document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]')?.setAttribute('content', appName());
  document.querySelector<HTMLMetaElement>('meta[name="description"]')?.setAttribute('content', isAdminPage() ? 'Clienté Admin — Quản lý người dùng, đơn hàng và thanh toán.' : 'Clienté — không gian chăm sóc khách hàng xe sang của bạn.');
  if (manifestChanged) manifest.setAttribute('href', manifestUrl);
  return manifestChanged;
}
