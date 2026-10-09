import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import request from 'supertest';
import { Database, type Row } from '../src/db.js';
import { readConfig } from '../src/config.js';
import { createApp } from '../src/app.js';
import { hash, hashPassword } from '../src/auth.js';
import { runCycle } from '../src/push.js';

const paymentSettings = { bankCode: '970422', bankName: 'MB', accountNumber: '0000000000', accountName: 'TEST ACCOUNT', monthlyPrice: 200000, zaloUrl: 'https://zalo.me/0000000000' };
const headers = (token: string) => ({ Authorization: `Bearer ${token}` });
function testConfig(database = ':memory:') {
  const config = readConfig('missing-subscription-settings-test-env', { APP_ENV: 'Testing', DB_SERVER: 'unused', DB_NAME: 'unused', DB_USER: 'unused', DB_PASSWORD: 'test' });
  config.reviewDatabase = database;
  return config;
}
async function fixture() {
  const config = testConfig(); const db = await Database.connect(config); const app = createApp(db, config, async () => {});
  const passwordHash = await hashPassword('123456');
  async function seed(username: string, changes: Row = {}) {
    const user = await db.insert('Employees', { id: randomUUID(), username, email: `${username}@example.test`, displayName: username,
      enabled: true, emailVerified: true, isAdmin: false, accessGranted: false, activeUntil: null, passwordHash, ...changes });
    const login = await request(app).post('/auth/login').send({ username, password: '123456' }); assert.equal(login.status, 200);
    return { ...user, token: login.body.token, headers: headers(login.body.token) };
  }
  const admin = await seed('admin', { isAdmin: true });
  const toggle = (subscriptionEnabled: boolean) => request(app).put('/api/admin/subscription-settings').set(admin.headers).send({ subscriptionEnabled });
  return { app, db, config, seed, admin, toggle };
}

test('subscription settings default to required, reject unauthorized or invalid changes and preserve registration settings', async () => {
  const f = await fixture(); try {
    const user = await f.seed('ordinary');
    assert.equal((await request(f.app).get('/api/admin/subscription-settings').set(f.admin.headers)).body.subscriptionEnabled, true);
    for (const method of ['get', 'put'] as const) {
      const anonymous = request(f.app)[method]('/api/admin/subscription-settings');
      assert.equal((await (method === 'put' ? anonymous.send({ subscriptionEnabled: false }) : anonymous)).status, 401);
      const ordinary = request(f.app)[method]('/api/admin/subscription-settings').set(user.headers);
      assert.equal((await (method === 'put' ? ordinary.send({ subscriptionEnabled: false }) : ordinary)).status, 403);
    }
    for (const input of [{}, { subscriptionEnabled: 'false' }, { subscriptionEnabled: 0 }, { subscriptionEnabled: null }]) {
      assert.equal((await request(f.app).put('/api/admin/subscription-settings').set(f.admin.headers).send(input)).status, 400);
    }
    assert.equal((await request(f.app).get('/api/admin/subscription-settings').set(f.admin.headers)).body.subscriptionEnabled, true);
    await request(f.app).put('/api/admin/settings').set(f.admin.headers).send({ registrationEnabled: false, defaultActivationMonths: 3 }).expect(200);
    const disabled = await f.toggle(false); assert.equal(disabled.status, 200); assert.equal(disabled.body.subscriptionEnabled, false);
    const settings = (await request(f.app).get('/api/admin/settings').set(f.admin.headers)).body;
    assert.equal(settings.registrationEnabled, false); assert.equal(settings.defaultActivationMonths, 3); assert.equal(settings.subscriptionEnabled, false);
    await request(f.app).put('/api/admin/settings').set(f.admin.headers).send({ registrationEnabled: true, defaultActivationMonths: 2 }).expect(200);
    assert.equal((await request(f.app).get('/api/admin/subscription-settings').set(f.admin.headers)).body.subscriptionEnabled, false);
    await f.toggle(true).expect(200);
    const restored = (await request(f.app).get('/api/admin/settings').set(f.admin.headers)).body;
    assert.equal(restored.registrationEnabled, true); assert.equal(restored.defaultActivationMonths, 2);
  } finally { await f.db.close(); }
});

test('toggle applies immediately to existing sessions while preserving paid dates, pending status and unlimited access', async () => {
  const f = await fixture(); try {
    const pending = await f.seed('pending');
    const expired = await f.seed('expired', { accessGranted: true, activeUntil: new Date(Date.now() - 86400000) });
    const active = await f.seed('active', { accessGranted: true, activeUntil: new Date(Date.now() + 86400000) });
    const unlimited = await f.seed('unlimited', { accessGranted: true });
    const accounts = [[pending, 'pending'], [expired, 'expired'], [active, 'active'], [unlimited, 'active'], [f.admin, 'active']] as const;
    const before = await f.db.rows('Employees', '1=1', {}, 'Username');
    const sessions = await f.db.rows('Sessions', '1=1', {}, 'Id');
    const customer = await f.db.insert('Customers', { id: randomUUID(), ownerId: pending.id, name: 'Existing customer', updatedAt: new Date() });
    for (const enabled of [true, false, true, false, true]) {
      await f.toggle(enabled).expect(200);
      for (const [account, status] of accounts) {
        const canUseApp = !enabled || status === 'active';
        const session = await request(f.app).get('/api/session').set(account.headers); assert.equal(session.status, 200);
        assert.equal(session.body.subscriptionEnabled, enabled); assert.equal(session.body.accessStatus, status); assert.equal(session.body.canUseApp, canUseApp);
        const subscription = await request(f.app).get('/api/subscription').set(account.headers); assert.equal(subscription.status, 200);
        assert.equal(subscription.body.subscriptionEnabled, enabled); assert.equal(subscription.body.accessStatus, status); assert.equal(subscription.body.canUseApp, canUseApp);
        if (!enabled) assert.equal(subscription.body.canPurchase, false);
        const customers = await request(f.app).get('/api/customers').set(account.headers);
        assert.equal(customers.status, canUseApp ? 200 : 403);
        if (!canUseApp) assert.equal(customers.body.code, 'SUBSCRIPTION_REQUIRED');
        if (account === pending && canUseApp) assert.ok(customers.body.some((c: Row) => c.id === customer.id));
      }
    }
    assert.deepEqual(await f.db.rows('Employees', '1=1', {}, 'Username'), before);
    assert.deepEqual(await f.db.rows('Sessions', '1=1', {}, 'Id'), sessions);
    await f.toggle(false).expect(200);
    const login = await request(f.app).post('/auth/login').send({ username: pending.username, password: '123456' });
    assert.equal(login.status, 200); assert.equal(login.body.subscriptionEnabled, false); assert.equal(login.body.accessStatus, 'pending'); assert.equal(login.body.canUseApp, true);
    const backup = await request(f.app).get('/api/account/backup?includePhotos=false').set(headers(login.body.token));
    assert.equal(backup.status, 200); assert.match(backup.headers['content-disposition'], /\.zip/);
    await f.toggle(true).expect(200);
    const denied = await request(f.app).get('/api/account/backup?includePhotos=false').set(headers(login.body.token));
    assert.equal(denied.status, 403); assert.equal(denied.body.code, 'SUBSCRIPTION_REQUIRED');
  } finally { await f.db.close(); }
});

test('free access still requires sign-in, an enabled account and verified email', async () => {
  const f = await fixture(); try {
    const locked = await f.seed('locked'); const unverified = await f.seed('unverified');
    await f.toggle(false).expect(200);
    await f.db.update('Employees', { enabled: false }, 'Id=@id', { id: locked.id });
    await f.db.update('Employees', { emailVerified: false }, 'Id=@id', { id: unverified.id });
    for (const endpoint of ['/api/session', '/api/subscription', '/api/customers', '/api/account/backup']) {
      assert.equal((await request(f.app).get(endpoint)).status, 401);
      for (const account of [locked, unverified]) assert.equal((await request(f.app).get(endpoint).set(account.headers)).status, 401);
    }
    for (const account of [locked, unverified]) {
      assert.equal((await request(f.app).post('/auth/login').send({ username: account.username, password: '123456' })).status, 403);
    }
  } finally { await f.db.close(); }
});

test('legacy SQLite settings migrate to required access and a changed policy survives database reconnect', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'cliente-subscription-settings-'));
  const config = testConfig(path.join(directory, 'legacy.db')); let db: Database | undefined;
  try {
    const legacy = new DatabaseSync(config.reviewDatabase);
    legacy.exec("CREATE TABLE SystemSettings (Id TEXT PRIMARY KEY, RegistrationEnabled INTEGER, DefaultActivationMonths INTEGER); INSERT INTO SystemSettings VALUES ('auth', 0, 4)");
    legacy.close();
    db = await Database.connect(config);
    const app = createApp(db, config, async () => {}); const passwordHash = await hashPassword('123456');
    const admin = await db.insert('Employees', { id: randomUUID(), username: 'admin', email: 'admin@example.test', enabled: true, isAdmin: true, passwordHash });
    await db.insert('Employees', { id: randomUUID(), username: 'pending', email: 'pending@example.test', enabled: true, accessGranted: false, passwordHash });
    const login = await request(app).post('/auth/login').send({ username: admin.username, password: '123456' }); assert.equal(login.status, 200);
    assert.equal((await request(app).get('/api/admin/subscription-settings').set(headers(login.body.token))).body.subscriptionEnabled, true);
    await request(app).put('/api/admin/subscription-settings').set(headers(login.body.token)).send({ subscriptionEnabled: false }).expect(200);
    await db.close(); db = await Database.connect(config);
    const reopened = createApp(db, config, async () => {});
    const settings = (await request(reopened).get('/api/admin/settings').set(headers(login.body.token))).body;
    assert.equal(settings.subscriptionEnabled, false); assert.equal(settings.registrationEnabled, false); assert.equal(settings.defaultActivationMonths, 4);
    const pending = await request(reopened).post('/auth/login').send({ username: 'pending', password: '123456' });
    assert.equal(pending.status, 200); assert.equal(pending.body.subscriptionEnabled, false); assert.equal(pending.body.canUseApp, true);
    assert.equal((await request(reopened).get('/api/customers').set(headers(pending.body.token))).status, 200);
  } finally {
    await db?.close();
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()));
    await rm(directory, { recursive: true, force: true });
  }
});

test('disabled subscriptions stop new purchases while existing payment reports and approvals preserve entitlements', async () => {
  const f = await fixture(); try {
    const buyer = await f.seed('buyer'); const newcomer = await f.seed('newcomer');
    await request(f.app).put('/api/admin/payment-settings').set(f.admin.headers).send(paymentSettings).expect(200);
    const created = await request(f.app).post('/api/orders').set(buyer.headers).send({}); assert.equal(created.status, 200);
    const legacy = await request(f.app).post('/api/subscription/request').set(buyer.headers).send({}); assert.equal(legacy.status, 200);
    await f.toggle(false).expect(200);
    for (const endpoint of ['/api/orders', '/api/subscription/request']) {
      const denied = await request(f.app).post(endpoint).set(newcomer.headers).send({});
      assert.equal(denied.status, 409); assert.equal(denied.body.code, 'SUBSCRIPTION_DISABLED');
    }
    assert.equal((await f.db.rows('PurchaseOrders')).length, 1); assert.equal((await f.db.rows('SubscriptionRequests')).length, 1);
    const info = await request(f.app).get('/api/subscription').set(buyer.headers);
    assert.equal(info.body.openOrder.id, created.body.id); assert.equal(info.body.requestedAt, legacy.body.requestedAt); assert.equal(info.body.canPurchase, false);
    await request(f.app).get(`/api/orders/${created.body.id}`).set(buyer.headers).expect(200);
    await request(f.app).post(`/api/orders/${created.body.id}/report`).set(buyer.headers).send({}).expect(200);
    await request(f.app).post(`/api/admin/orders/${created.body.id}/review`).set(f.admin.headers).send({ action: 'approve', transactionReference: 'TOGGLE-PAID-001' }).expect(200);
    const paid = (await f.db.one('PurchaseOrders', 'Id=@id', { id: created.body.id }))!;
    const account = (await f.db.one('Employees', 'Id=@id', { id: buyer.id }))!;
    assert.equal(paid.paymentState, 'paid'); assert.equal(account.accessGranted, true); assert.ok(Date.parse(account.activeUntil) > Date.now());
    for (const enabled of [true, false, true]) {
      await f.toggle(enabled).expect(200);
      const session = await request(f.app).get('/api/session').set(buyer.headers);
      assert.equal(session.body.canUseApp, true); assert.equal(session.body.accessStatus, 'active'); assert.equal(session.body.activeUntil, account.activeUntil);
      await request(f.app).get('/api/customers').set(buyer.headers).expect(200);
    }
    assert.deepEqual(await f.db.one('Employees', 'Id=@id', { id: buyer.id }), account);
    assert.deepEqual(await f.db.one('PurchaseOrders', 'Id=@id', { id: created.body.id }), paid);
    assert.equal((await request(f.app).post('/api/orders').set(newcomer.headers).send({})).status, 200);
  } finally { await f.db.close(); }
});

test('free access delivers due reminders for pending and expired users but never locked or unverified accounts', async () => {
  const f = await fixture(); try {
    const pending = await f.seed('pending'); const expired = await f.seed('expired', { accessGranted: true, activeUntil: new Date(Date.now() - 60000) });
    const locked = await f.seed('locked'); const unverified = await f.seed('unverified');
    const reminders = [];
    for (const account of [pending, expired, locked, unverified]) {
      const customer = await f.db.insert('Customers', { id: randomUUID(), ownerId: account.id, name: account.username, updatedAt: new Date() });
      const reminder = await f.db.insert('Reminders', { id: randomUUID(), customerId: customer.id, active: true, repeat: 'once' }); reminders.push(reminder);
      await f.db.insert('Occurrences', { id: randomUUID(), reminderId: reminder.id, state: 'pending', notifyAt: new Date(Date.now() - 1000), originalAt: new Date(), revision: 1 });
      const session = (await f.db.one('Sessions', 'TokenHash=@hash', { hash: hash(account.token) }))!;
      await f.db.insert('Devices', { id: randomUUID(), ownerId: account.id, sessionId: session.id, enabled: true, endpoint: `https://fcm.googleapis.com/send/${account.username}` });
    }
    await f.db.update('Employees', { enabled: false }, 'Id=@id', { id: locked.id });
    await f.db.update('Employees', { emailVerified: false }, 'Id=@id', { id: unverified.id });
    const sent: string[] = []; const send = async (device: Row) => { sent.push(device.ownerId); };
    await runCycle(f.db, send); assert.equal(sent.length, 0);
    await f.toggle(false).expect(200); await runCycle(f.db, send);
    assert.deepEqual(sent.sort(), [pending.id, expired.id].sort());
    await runCycle(f.db, send); assert.equal(sent.length, 2);
    await f.db.insert('Occurrences', { id: randomUUID(), reminderId: reminders[0].id, state: 'pending', notifyAt: new Date(Date.now() - 1000), originalAt: new Date(Date.now() + 1000), revision: 1 });
    await f.toggle(true).expect(200); await runCycle(f.db, send); assert.equal(sent.length, 2);
    await f.toggle(false).expect(200); await runCycle(f.db, send); assert.equal(sent.length, 3);
  } finally { await f.db.close(); }
});
