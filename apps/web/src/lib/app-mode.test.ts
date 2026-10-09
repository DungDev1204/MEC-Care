import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appIcon, appName, isAdminApp, isAdminPage, syncAppIdentity } from './app-mode';
import { captureInstallPrompt, clearInstallPrompt, getInstallPrompt } from './pwa';

const origin = 'https://care.example.test';
function location(path: string) { Reflect.set(window, 'location', new URL(path, origin)); }
function headNode(initial: Record<string, string>) {
  const attributes = { ...initial };
  return {
    getAttribute: (name: string) => attributes[name] ?? null,
    setAttribute: (name: string, value: string) => { attributes[name] = value; },
    get href() { return new URL(attributes.href || '/', origin).href; }
  };
}
beforeEach(() => {
  vi.stubGlobal('window', { location: new URL(origin), dispatchEvent: vi.fn() });
  vi.stubGlobal('document', { documentElement: { dataset: { appMode: 'user' } }, querySelector: vi.fn(() => null) });
});
afterEach(() => { clearInstallPrompt(); vi.unstubAllGlobals(); });

describe('Admin page identity on a shared origin', () => {
  it('shows the Admin identity while keeping host mode user', () => {
    location('/admin?tab=device');
    expect(isAdminPage()).toBe(true); expect(isAdminApp()).toBe(false);
    expect(appName()).toBe('Clienté Admin'); expect(appIcon()).toBe('/admin-icon.svg');
    location('/customers');
    expect(isAdminPage()).toBe(false); expect(appName()).toBe('Clienté'); expect(appIcon()).toBe('/icon.svg');
  });
  it('recognizes safe local login returns after URL normalization', () => {
    for (const target of ['/admin', '/admin?tab=device', '/admin/orders']) {
      location(`/login?return=${encodeURIComponent(target)}`); expect(isAdminPage()).toBe(true);
    }
    for (const target of ['//other.example.test/admin', 'https://other.example.test/admin', '/admin/../customers', '/administrator', '/admin\\other', '/admin\nother']) {
      location(`/login?return=${encodeURIComponent(target)}`); expect(isAdminPage()).toBe(false);
    }
  });
  it('retains Admin presentation throughout a dedicated Admin origin', () => {
    document.documentElement.dataset.appMode = 'admin'; location('/login');
    expect(isAdminApp()).toBe(true); expect(isAdminPage()).toBe(true); expect(appName()).toBe('Clienté Admin');
    location('/customers'); expect(isAdminPage()).toBe(true);
  });
  it('restores user metadata after leaving Admin without mutating host mode', () => {
    const manifest = headNode({ href: '/manifest.webmanifest' });
    const icon = headNode({ href: '/icon.svg' }); const touch = headNode({ href: '/icon-192.png' });
    const title = headNode({ content: 'Clienté' });
    const nodes: Record<string, ReturnType<typeof headNode>> = { 'link[rel="manifest"]': manifest, 'link[rel="icon"]': icon, 'link[rel="apple-touch-icon"]': touch, 'meta[name="apple-mobile-web-app-title"]': title };
    vi.mocked(document.querySelector).mockImplementation(selector => nodes[String(selector)] as unknown as Element || null);
    location('/admin'); expect(syncAppIdentity()).toBe(true);
    expect(manifest.getAttribute('href')).toBe('/admin-manifest.webmanifest');
    expect(icon.getAttribute('href')).toBe('/admin-icon.svg'); expect(touch.getAttribute('href')).toBe('/admin-icon-192.png');
    expect(title.getAttribute('content')).toBe('Clienté Admin'); expect(isAdminApp()).toBe(false);
    location('/customers'); expect(syncAppIdentity()).toBe(true);
    expect(manifest.getAttribute('href')).toBe('/manifest.webmanifest'); expect(icon.getAttribute('href')).toBe('/icon.svg'); expect(title.getAttribute('content')).toBe('Clienté');
    document.documentElement.dataset.appMode = 'admin'; location('/admin'); expect(syncAppIdentity()).toBe(false);
    expect(manifest.getAttribute('href')).toBe('/manifest.webmanifest');
  });
  it('does not offer an install prompt captured for another manifest', () => {
    const manifest = headNode({ href: '/manifest.webmanifest' });
    vi.mocked(document.querySelector).mockImplementation(() => manifest as unknown as Element);
    const prompt = new Event('beforeinstallprompt'); captureInstallPrompt(prompt);
    expect(getInstallPrompt()).toBe(prompt);
    manifest.setAttribute('href', '/admin-manifest.webmanifest'); expect(getInstallPrompt()).toBeUndefined();
    clearInstallPrompt(); manifest.setAttribute('href', '/manifest.webmanifest'); expect(getInstallPrompt()).toBeUndefined();
  });
});
