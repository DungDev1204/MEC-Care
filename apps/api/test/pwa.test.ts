import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { readConfig } from '../src/config.js';
import { Database } from '../src/db.js';
import { createApp } from '../src/app.js';
import { hashPassword } from '../src/auth.js';

const env = { APP_ENV: 'Testing', DB_SERVER: 'unused', DB_NAME: 'unused', DB_USER: 'unused', DB_PASSWORD: 'test-only', ADMIN_APP_URL: 'https://admin.example.test', USER_APP_URL: 'https://care.example.test' };
async function fixture(overrides: Record<string, string> = {}) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'cliente-pwa-'));
  const config = readConfig(path.join(directory, '.env'), { ...env, ...overrides }); config.reviewDatabase = ':memory:'; config.webRoot = path.join(directory, 'web');
  await fs.cp(new URL('../../web/public/', import.meta.url), config.webRoot, { recursive: true });
  await fs.copyFile(new URL('../../web/index.html', import.meta.url), path.join(config.webRoot, 'index.html'));
  const db = await Database.connect(config); const app = createApp(db, config);
  return { db, app, close: async () => { await db.close(); await fs.rm(directory, { recursive: true, force: true }); } };
}

test('Admin and user origins deliver separate app identities, icons and launch pages on the first response', async () => {
  const f = await fixture(); try {
    const get = (url: string, admin = true) => request(f.app).get(url).set('Host', admin ? 'admin.example.test' : 'care.example.test');
    for (const url of ['/', '/admin?tab=device', '/index.html', '/login']) {
      const admin = await get(url); assert.equal(admin.status, 200); assert.match(admin.text, /data-app-mode="admin"/); assert.match(admin.text, /apple-mobile-web-app-title" content="Clienté Admin"/); assert.match(admin.text, /apple-touch-icon" href="\/admin-icon-192.png"/); assert.match(admin.headers['cache-control'], /no-cache/);
      assert.match(admin.text, /rel="manifest" href="\/manifest.webmanifest"/);
      const user = await get(url, false); assert.equal(user.status, 200); assert.doesNotMatch(user.text, /data-app-mode="admin"/);
      if (url.startsWith('/admin')) {
        assert.match(user.text, /apple-touch-icon" href="\/admin-icon-192.png"/); assert.match(user.text, /rel="manifest" href="\/admin-manifest.webmanifest"/);
      } else assert.match(user.text, /apple-touch-icon" href="\/icon-192.png"/);
    }
    const adminManifest = JSON.parse((await get('/manifest.webmanifest')).text); const userManifest = JSON.parse((await get('/manifest.webmanifest', false)).text);
    assert.equal(adminManifest.name, 'Clienté Admin'); assert.equal(adminManifest.id, '/admin'); assert.equal(adminManifest.start_url, '/admin?tab=orders'); assert.equal(userManifest.id, '/'); assert.equal(userManifest.start_url, '/launch');
    assert.equal(JSON.parse((await get('/admin-manifest.webmanifest')).text).scope, '/');
    const sharedManifest = await get('/admin-manifest.webmanifest', false); assert.equal(JSON.parse(sharedManifest.text).scope, '/admin'); assert.match(sharedManifest.headers['cache-control'], /no-cache/);
    for (const icon of adminManifest.icons) {
      const result = await get(icon.src); assert.equal(result.status, 200); assert.equal(result.headers['content-type'], 'image/png');
      assert.equal(result.body.readUInt32BE(16), Number(icon.sizes.split('x')[0])); assert.equal(result.body.readUInt32BE(20), Number(icon.sizes.split('x')[1]));
    }
    assert.deepEqual((await get('/app/config')).body, { mode: 'admin', adminUrl: env.ADMIN_APP_URL, userUrl: env.USER_APP_URL });
    assert.equal((await get('/app/config', false)).body.mode, 'user');
    assert.equal((await request(f.app).get('/manifest.webmanifest').set('Host', 'unknown.example.test')).status, 400);
  } finally { await f.close(); }
});

test('Shared host Admin routes and local login returns deliver Admin presentation without changing host identity', async () => {
  const f = await fixture({ ADMIN_APP_URL: '', USER_APP_URL: '', ALLOWED_HOSTS: 'care.example.test' }); try {
    const get = (url: string) => request(f.app).get(url).set('Host', 'care.example.test');
    const loginReturn = (target: string) => `/login?return=${encodeURIComponent(target)}`;
    for (const url of ['/admin', '/admin?tab=device', '/admin/', '/admin/settings', loginReturn('/admin?tab=device')]) {
      const result = await get(url); assert.equal(result.status, 200); assert.doesNotMatch(result.text, /data-app-mode="admin"/);
      assert.match(result.text, /<title>Clienté Admin · Quản trị<\/title>/); assert.match(result.text, /apple-mobile-web-app-title" content="Clienté Admin"/);
      assert.match(result.text, /rel="icon"[^>]*href="\/admin-icon.svg"/); assert.match(result.text, /apple-touch-icon" href="\/admin-icon-192.png"/);
      assert.match(result.text, /rel="manifest" href="\/admin-manifest.webmanifest"/); assert.match(result.headers['cache-control'], /no-cache/);
    }
    for (const url of ['/', '/index.html', '/login', '/administrator', '/admin-tools', loginReturn('/customers'), loginReturn('/administrator'), loginReturn('//other.example.test/admin'), loginReturn('https://other.example.test/admin'), loginReturn('/admin/../customers'), loginReturn('/\\other.example.test/admin')]) {
      const result = await get(url); assert.equal(result.status, 200); assert.doesNotMatch(result.text, /data-app-mode="admin"/); assert.doesNotMatch(result.text, /Clienté Admin/);
      assert.match(result.text, /apple-touch-icon" href="\/icon-192.png"/); assert.match(result.text, /rel="manifest" href="\/manifest.webmanifest"/);
    }
    assert.deepEqual((await get('/app/config')).body, { mode: 'user', adminUrl: '', userUrl: '' });
    const adminManifest = await get('/admin-manifest.webmanifest'); const manifest = JSON.parse(adminManifest.text);
    assert.equal(manifest.name, 'Clienté Admin'); assert.equal(manifest.id, '/admin'); assert.equal(manifest.start_url, '/admin?tab=orders'); assert.equal(manifest.scope, '/admin'); assert.match(adminManifest.headers['cache-control'], /no-cache/);
    assert.equal(JSON.parse((await get('/manifest.webmanifest')).text).id, '/');
    const worker = await get('/sw.js'); assert.doesNotMatch(worker.text, /admin-icon-192/); assert.match(worker.text, /\/agenda/);
    await f.db.insert('Employees', { id: randomUUID(), username: 'member', email: 'member@example.test', displayName: 'Shared host member', enabled: true, emailVerified: true, isAdmin: false, passwordHash: await hashPassword('Test123!'), phone: '' });
    const login = await request(f.app).post('/auth/login').set('Host', 'care.example.test').send({ username: 'member', password: 'Test123!' }); assert.equal(login.status, 200); assert.equal(login.body.isAdmin, false);
    const headers = { Host: 'care.example.test', Authorization: `Bearer ${login.body.token}` };
    assert.equal((await request(f.app).get('/api/session').set(headers)).status, 200);
    assert.equal((await request(f.app).get('/api/admin/orders').set(headers)).status, 403);
    assert.equal((await request(f.app).get('/api/admin/subscription-settings').set(headers)).status, 403);
  } finally { await f.close(); }
});

test('Admin app rejects ordinary users without issuing a session; existing user app sign-in still works', async () => {
  const f = await fixture(); try {
    for (const isAdmin of [false, true]) await f.db.insert('Employees', { id: randomUUID(), username: isAdmin ? 'admin' : 'member', email: `${isAdmin ? 'admin' : 'member'}@example.test`, displayName: 'PWA test', enabled: true, emailVerified: true, isAdmin, passwordHash: await hashPassword('Test123!'), phone: '' });
    const login = (username: string, admin = true) => request(f.app).post('/auth/login').set('Host', admin ? 'admin.example.test' : 'care.example.test').send({ username, password: 'Test123!' });
    const denied = await login('member'); assert.equal(denied.status, 403); assert.equal(denied.headers['set-cookie'], undefined); assert.equal((await f.db.rows('Sessions')).length, 0);
    const member = await login('member', false); assert.equal(member.status, 200);
    assert.equal((await request(f.app).get('/api/session').set('Host', 'admin.example.test').set('Authorization', `Bearer ${member.body.token}`)).status, 403);
    const admin = await login('admin'); assert.equal(admin.status, 200); assert.equal(admin.body.isAdmin, true);
    assert.doesNotMatch(admin.headers['set-cookie'][0], /Domain=/i);
    assert.equal((await request(f.app).get('/api/admin/orders').set('Host', 'admin.example.test').set('Authorization', `Bearer ${admin.body.token}`)).status, 200);
    assert.equal((await request(f.app).post('/api/admin/order-notifications/read').set('Host', 'admin.example.test').set('Origin', env.USER_APP_URL).set('Authorization', `Bearer ${admin.body.token}`).send({})).status, 403);
  } finally { await f.close(); }
});

test('Admin push uses its own icon and opens the order on the Admin origin', async () => {
  const f = await fixture(); try {
    const script = (await request(f.app).get('/sw.js').set('Host', 'admin.example.test')).text;
    const handlers: Record<string, (event: any) => void> = {}; const shown: any[] = []; const opened: string[] = [];
    vm.runInNewContext(script, { URL, self: { location: { origin: env.ADMIN_APP_URL }, addEventListener: (type: string, handler: (event: any) => void) => { handlers[type] = handler; }, registration: { showNotification: async (title: string, options: any) => { shown.push({ title, options }); } }, clients: { matchAll: async () => [], openWindow: async (url: string) => { opened.push(url); } } } });
    let completion: Promise<unknown> = Promise.resolve();
    handlers.push({ data: { json: () => ({ title: 'Đơn mới', url: '/admin?tab=orders&order=DH123', tag: 'order-DH123' }) }, waitUntil: (promise: Promise<unknown>) => { completion = promise; } }); await completion;
    assert.equal(shown[0].options.icon, '/admin-icon-192.png'); assert.equal(shown[0].options.data.url, `${env.ADMIN_APP_URL}/admin?tab=orders&order=DH123`);
    handlers.notificationclick({ notification: { close: () => {}, data: shown[0].options.data }, waitUntil: (promise: Promise<unknown>) => { completion = promise; } }); await completion;
    assert.equal(opened[0], shown[0].options.data.url);
    handlers.push({ data: { json: () => ({ url: 'https://other.example.test/' }) }, waitUntil: (promise: Promise<unknown>) => { completion = promise; } }); await completion;
    assert.equal(shown[1].options.data.url, `${env.ADMIN_APP_URL}/admin?tab=orders`);
    const userScript = (await request(f.app).get('/sw.js').set('Host', 'care.example.test')).text; assert.doesNotMatch(userScript, /admin-icon-192/); assert.match(userScript, /\/agenda/);
  } finally { await f.close(); }
});

test('PWA origin configuration rejects mixed, insecure production and wildcard hosts', () => {
  assert.throws(() => readConfig('missing-env', { ...env, USER_APP_URL: '' }), /separate hostnames/);
  assert.throws(() => readConfig('missing-env', { ...env, ADMIN_APP_URL: env.USER_APP_URL + ':9999' }), /separate hostnames/);
  for (const url of ['https://*/', 'https://admin.example.test/admin', 'https://user:pass@admin.example.test/', 'http://admin.example.test']) assert.throws(() => readConfig('missing-env', { ...env, APP_ENV: 'Production', ADMIN_APP_URL: url }));
});
