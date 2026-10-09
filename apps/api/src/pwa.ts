import fs from 'node:fs';
import path from 'node:path';
import { Router, type Request } from 'express';
import type { Config } from './config.js';

export function isAdminApp(req: Request, config: Config) {
  const hostname = (req.headers.host || '').replace(/:\d+$/, '').toLowerCase();
  return !!config.apps.adminUrl && hostname === new URL(config.apps.adminUrl).hostname;
}

const isAdminPath = (pathname: string) => pathname === '/admin' || pathname.startsWith('/admin/');
export function isAdminPage(req: Request, config: Config) {
  if (isAdminApp(req, config) || isAdminPath(req.path)) return true;
  const target = req.query.return;
  if (req.path !== '/login' || typeof target !== 'string' || !target.startsWith('/') || target.startsWith('//') || /[\\\s\u0000-\u001f\u007f]/.test(target)) return false;
  try { const url = new URL(target, 'https://cliente.local'); return url.origin === 'https://cliente.local' && isAdminPath(url.pathname); } catch { return false; }
}

export function pwaRouter(config: Config) {
  const router = Router();
  router.get('/app/config', (req, res) => { res.set('Cache-Control', 'no-store').json({ mode: isAdminApp(req, config) ? 'admin' : 'user', ...config.apps }); });
  router.get('/manifest.webmanifest', (req, res) => {
    res.set('Cache-Control', 'no-cache').type('application/manifest+json').sendFile(path.join(config.webRoot, isAdminApp(req, config) ? 'admin-manifest.webmanifest' : 'manifest.webmanifest'));
  });
  router.get('/admin-manifest.webmanifest', (req, res) => {
    const file = path.join(config.webRoot, 'admin-manifest.webmanifest');
    if (!fs.existsSync(file)) { res.sendStatus(404); return; }
    const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!isAdminApp(req, config)) manifest.scope = '/admin';
    res.set('Cache-Control', 'no-cache').type('application/manifest+json').send(JSON.stringify(manifest));
  });
  router.get('/sw.js', (req, res, next) => {
    const file = path.join(config.webRoot, 'sw.js'); if (!fs.existsSync(file)) { next(); return; }
    let script = fs.readFileSync(file, 'utf8');
    if (isAdminApp(req, config)) script = script.replaceAll('cliente-shell-v2', 'cliente-shell-admin-v1').replaceAll('/icon-192.png', '/admin-icon-192.png').replaceAll('/agenda', '/admin?tab=orders').replaceAll("'Clienté'", "'Clienté Admin'").replaceAll('Bạn có lịch chăm sóc đến hạn.', 'Có đơn hàng cần kiểm tra.');
    res.set('Cache-Control', 'no-cache').type('application/javascript').send(script);
  });
  return router;
}

export function appHtml(config: Config, adminApp: boolean, adminPage = adminApp) {
  const file = path.join(config.webRoot, 'index.html'); if (!fs.existsSync(file)) return null;
  const html = fs.readFileSync(file, 'utf8');
  if (!adminPage) return html;
  const branded = adminApp ? html.replace('<html ', '<html data-app-mode="admin" ') : html;
  return branded
    .replace(/(<meta name="apple-mobile-web-app-title" content=")[^"]*/, '$1Clienté Admin')
    .replace(/(<meta name="description" content=")[^"]*/, '$1Clienté Admin — Quản lý người dùng, đơn hàng và thanh toán.')
    .replace('/icon.svg', '/admin-icon.svg').replace('/icon-192.png', '/admin-icon-192.png')
    .replace('href="/manifest.webmanifest"', adminApp ? 'href="/manifest.webmanifest"' : 'href="/admin-manifest.webmanifest"')
    .replace(/<title>[^<]*<\/title>/, '<title>Clienté Admin · Quản trị</title>');
}
