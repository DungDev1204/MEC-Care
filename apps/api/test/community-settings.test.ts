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
import { hashPassword } from '../src/auth.js';

const bankSettings = { bankCode: '970422', bankName: 'MB', accountNumber: '0000000000', accountName: 'TEST ACCOUNT', monthlyPrice: 200000 };
const telegramUrl = 'https://t.me/MecCareCommunity';
const legacyZaloUrl = 'https://zalo.me/0000000000';
const headers = (token: string) => ({ Authorization: `Bearer ${token}` });
function testConfig(database = ':memory:') {
  const config = readConfig('missing-community-settings-test-env', { APP_ENV: 'Testing', DB_SERVER: 'unused', DB_NAME: 'unused', DB_USER: 'unused', DB_PASSWORD: 'test' });
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
  const admin = await seed('admin', { isAdmin: true }); const pending = await seed('pending');
  const update = (telegramCommunityUrl: string) => request(app).put('/api/admin/community-settings').set(admin.headers).send({ telegramCommunityUrl });
  const read = (account = pending) => request(app).get('/api/community-settings').set(account.headers);
  const payment = (body: Row) => request(app).put('/api/admin/payment-settings').set(admin.headers).send({ ...bankSettings, ...body });
  const createOrder = (account = pending) => request(app).post('/api/orders').set(account.headers).send({});
  return { app, db, config, seed, admin, pending, update, read, payment, createOrder };
}

test('community link is available to signed-in pending and expired users, with admin-only editing and account restrictions', async () => {
  const f = await fixture(); try {
    const expired = await f.seed('expired', { accessGranted: true, activeUntil: new Date(Date.now() - 60000) });
    assert.equal((await request(f.app).get('/api/community-settings')).status, 401);
    for (const method of ['get', 'put'] as const) {
      const anonymous = request(f.app)[method]('/api/admin/community-settings');
      assert.equal((await (method === 'put' ? anonymous.send({ telegramCommunityUrl: telegramUrl }) : anonymous)).status, 401);
      for (const account of [f.pending, expired]) {
        const ordinary = request(f.app)[method]('/api/admin/community-settings').set(account.headers);
        assert.equal((await (method === 'put' ? ordinary.send({ telegramCommunityUrl: telegramUrl }) : ordinary)).status, 403);
      }
    }
    assert.deepEqual((await f.read()).body, { telegramCommunityUrl: '' });
    assert.deepEqual((await request(f.app).get('/api/admin/community-settings').set(f.admin.headers)).body, { telegramCommunityUrl: '' });
    await f.update(telegramUrl).expect(200);
    for (const account of [f.pending, expired, f.admin]) {
      const link = await f.read(account); assert.equal(link.status, 200); assert.deepEqual(link.body, { telegramCommunityUrl: telegramUrl });
    }
    assert.equal((await request(f.app).get('/api/customers').set(f.pending.headers)).body.code, 'SUBSCRIPTION_REQUIRED');
    await f.db.update('Employees', { enabled: false }, 'Id=@id', { id: f.pending.id });
    await f.db.update('Employees', { emailVerified: false }, 'Id=@id', { id: expired.id });
    assert.equal((await f.read()).status, 401); assert.equal((await f.read(expired)).status, 401);
  } finally { await f.db.close(); }
});

test('community edits accept Telegram group and invite links, immediately update existing sessions and support clearing', async () => {
  const f = await fixture(); try {
    const links = [telegramUrl, 'https://t.me/+AbCdEfgh0123456789_-', 'https://t.me/joinchat/AbCdEfgh0123456789_-'];
    for (const link of links) {
      const saved = await f.update(` ${link} `); assert.equal(saved.status, 200); assert.deepEqual(saved.body, { telegramCommunityUrl: link });
      assert.deepEqual((await f.read()).body, { telegramCommunityUrl: link });
    }
    const cleared = await f.update(''); assert.equal(cleared.status, 200); assert.deepEqual(cleared.body, { telegramCommunityUrl: '' });
    assert.deepEqual((await f.read()).body, { telegramCommunityUrl: '' });
    const audit = await f.db.rows('AdminAudit', 'Action=@action', { action: 'community_settings' }, 'CreatedAt, Id');
    assert.equal(audit.length, 4); assert.ok(audit.every(row => row.actorId === f.admin.id && row.targetId === null));
    assert.deepEqual(audit.map(row => JSON.parse(row.details).telegramCommunityUrl).sort(), [...links, ''].sort());
    assert.equal((await f.db.rows('Sessions')).length, 2);
  } finally { await f.db.close(); }
});

test('invalid community payloads and unsafe destinations leave the saved link and audit history intact', async () => {
  const f = await fixture(); try {
    await f.update(telegramUrl).expect(200);
    const before = await f.db.rows('SystemSettings'); const audit = await f.db.rows('AdminAudit');
    const invalidUrls = [
      'not-a-url', 'http://t.me/MecCareCommunity', 'javascript:alert(1)', 'https://discord.gg/MecCare', 'https://support.example.test/contact',
      'https://t.me.evil.test/MecCareCommunity', 'https://t.me@evil.test/MecCareCommunity', 'https://user:password@t.me/MecCareCommunity',
      'https://t.me:443/MecCareCommunity', 'https://t.me:8443/MecCareCommunity', 'https://t.me/MecCareCommunity?start=test',
      'https://t.me/MecCareCommunity#test', 'https://t.me/oldgroup/../MecCareCommunity', 'https://t.me/oldgroup/%2e%2e/MecCareCommunity',
      'https://t.me/share/url', 'https://t.me/addstickers/TestPack', 'https://t.me/proxy', 'https://t.me/login', 'https://t.me/iv',
      'https://t.me/s/MecCareCommunity', 'https://t.me/c/123456/10', 'https://t.me/joinchat', 'https://t.me/', 'https://t.me/+' + 'a'.repeat(301)
    ];
    const invalidPayloads = [{}, { telegramCommunityUrl: null }, { telegramCommunityUrl: false }, { telegramCommunityUrl: 10 },
      { telegramCommunityUrl: telegramUrl, subscriptionEnabled: false }, { telegramCommunityUrl: telegramUrl, registrationEnabled: false },
      ...invalidUrls.map(telegramCommunityUrl => ({ telegramCommunityUrl }))];
    for (const body of invalidPayloads) {
      const rejected = await request(f.app).put('/api/admin/community-settings').set(f.admin.headers).send(body);
      assert.equal(rejected.status, 400, JSON.stringify(body));
    }
    assert.deepEqual(await f.db.rows('SystemSettings'), before); assert.deepEqual(await f.db.rows('AdminAudit'), audit);
    assert.deepEqual((await f.read()).body, { telegramCommunityUrl: telegramUrl });
  } finally { await f.db.close(); }
});

test('community settings remain independent of registration, subscription enforcement and payment contact settings', async () => {
  const f = await fixture(); try {
    await f.update(telegramUrl).expect(200);
    let authSettings = (await request(f.app).get('/api/admin/settings').set(f.admin.headers)).body;
    assert.equal(authSettings.registrationEnabled, true); assert.equal(authSettings.defaultActivationMonths, 1); assert.equal(authSettings.subscriptionEnabled, true);
    await request(f.app).put('/api/admin/settings').set(f.admin.headers).send({ registrationEnabled: false, defaultActivationMonths: 4 }).expect(200);
    await request(f.app).put('/api/admin/subscription-settings').set(f.admin.headers).send({ subscriptionEnabled: false }).expect(200);
    await f.payment({ contactUrl: 'https://support.example.test/contact' }).expect(200);
    assert.deepEqual((await f.read()).body, { telegramCommunityUrl: telegramUrl });
    const paymentBefore = await f.db.rows('PaymentSettings'); const employeesBefore = await f.db.rows('Employees', '1=1', {}, 'Id');
    const changedLink = 'https://t.me/+ChangedGroup0123456'; await f.update(changedLink).expect(200);
    authSettings = (await request(f.app).get('/api/admin/settings').set(f.admin.headers)).body;
    assert.equal(authSettings.registrationEnabled, false); assert.equal(authSettings.defaultActivationMonths, 4); assert.equal(authSettings.subscriptionEnabled, false);
    assert.deepEqual(await f.db.rows('PaymentSettings'), paymentBefore); assert.deepEqual(await f.db.rows('Employees', '1=1', {}, 'Id'), employeesBefore);
    assert.equal((await request(f.app).get('/auth/registration/config')).body.registrationEnabled, false);
    assert.equal((await request(f.app).get('/api/session').set(f.pending.headers)).body.canUseApp, true);
    await f.update('').expect(200);
    assert.equal((await request(f.app).get('/api/admin/payment-settings').set(f.admin.headers)).body.settings.contactUrl, 'https://support.example.test/contact');
  } finally { await f.db.close(); }
});

test('legacy settings gain an empty community link and preserve both saved links across database reconnect', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'cliente-community-settings-')); const config = testConfig(path.join(directory, 'legacy.db'));
  let db: Database | undefined;
  try {
    const legacy = new DatabaseSync(config.reviewDatabase);
    legacy.exec("CREATE TABLE SystemSettings (Id TEXT PRIMARY KEY, RegistrationEnabled INTEGER, DefaultActivationMonths INTEGER, SubscriptionEnabled INTEGER); INSERT INTO SystemSettings VALUES ('auth', 0, 4, 0)");
    legacy.close(); db = await Database.connect(config);
    const app = createApp(db, config, async () => {}); const passwordHash = await hashPassword('123456');
    await db.insert('Employees', { id: randomUUID(), username: 'admin', email: 'admin@example.test', enabled: true, isAdmin: true, passwordHash });
    await db.insert('Employees', { id: randomUUID(), username: 'pending', email: 'pending@example.test', enabled: true, accessGranted: false, passwordHash });
    await db.insert('PaymentSettings', { id: 'payment', ...bankSettings, zaloUrl: legacyZaloUrl });
    const admin = await request(app).post('/auth/login').send({ username: 'admin', password: '123456' }); assert.equal(admin.status, 200);
    const pending = await request(app).post('/auth/login').send({ username: 'pending', password: '123456' }); assert.equal(pending.status, 200);
    assert.deepEqual((await request(app).get('/api/community-settings').set(headers(pending.body.token))).body, { telegramCommunityUrl: '' });
    assert.equal((await request(app).get('/api/admin/payment-settings').set(headers(admin.body.token))).body.settings.contactUrl, legacyZaloUrl);
    await request(app).put('/api/admin/community-settings').set(headers(admin.body.token)).send({ telegramCommunityUrl: telegramUrl }).expect(200);
    await request(app).put('/api/admin/payment-settings').set(headers(admin.body.token)).send({ ...bankSettings, contactUrl: 'https://support.example.test/contact' }).expect(200);
    const savedSettings = await db.rows('SystemSettings'); const savedPayment = await db.rows('PaymentSettings');
    await db.close(); db = await Database.connect(config); const reopened = createApp(db, config, async () => {});
    assert.deepEqual(await db.rows('SystemSettings'), savedSettings); assert.deepEqual(await db.rows('PaymentSettings'), savedPayment);
    assert.deepEqual((await request(reopened).get('/api/community-settings').set(headers(pending.body.token))).body, { telegramCommunityUrl: telegramUrl });
    const authSettings = (await request(reopened).get('/api/admin/settings').set(headers(admin.body.token))).body;
    assert.equal(authSettings.registrationEnabled, false); assert.equal(authSettings.defaultActivationMonths, 4); assert.equal(authSettings.subscriptionEnabled, false);
    assert.equal((await request(reopened).get('/api/admin/payment-settings').set(headers(admin.body.token))).body.settings.contactUrl, 'https://support.example.test/contact');
  } finally {
    await db?.close(); assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()));
    await rm(directory, { recursive: true, force: true });
  }
});

test('payment contacts accept generic HTTPS and clearing, preserve the legacy alias and reject unsafe destinations without changes', async () => {
  const f = await fixture(); try {
    await f.payment({ zaloUrl: legacyZaloUrl }).expect(200);
    assert.equal((await request(f.app).get('/api/admin/payment-settings').set(f.admin.headers)).body.settings.contactUrl, legacyZaloUrl);
    for (const contactUrl of ['https://t.me/MecCareSupport', 'https://support.example.test/contact', '']) {
      const saved = await f.payment({ contactUrl }); assert.equal(saved.status, 200);
      assert.equal(saved.body.settings.contactUrl, contactUrl); assert.equal(saved.body.settings.zaloUrl, contactUrl);
      assert.equal((await f.db.one('PaymentSettings', 'Id=@id', { id: 'payment' }))!.zaloUrl, contactUrl);
      assert.equal((await request(f.app).get('/api/subscription').set(f.pending.headers)).body.settings.contactUrl, contactUrl);
    }
    await f.payment({}).expect(200);
    assert.equal((await request(f.app).get('/api/admin/payment-settings').set(f.admin.headers)).body.settings.contactUrl, '');
    await f.payment({ contactUrl: '', zaloUrl: legacyZaloUrl }).expect(200);
    assert.equal((await request(f.app).get('/api/admin/payment-settings').set(f.admin.headers)).body.settings.contactUrl, '');
    await f.payment({ contactUrl: 'https://support.example.test/contact', zaloUrl: legacyZaloUrl }).expect(200);
    const before = await f.db.rows('PaymentSettings'); const audit = await f.db.rows('AdminAudit');
    for (const contactUrl of ['javascript:alert(1)', 'http://support.example.test/contact', 'https://user:password@support.example.test/contact',
      'https://user@support.example.test/contact', '//support.example.test/contact', 'not-a-url', 'https://support.example.test/' + 'a'.repeat(201)]) {
      assert.equal((await f.payment({ contactUrl })).status, 400, contactUrl);
    }
    assert.deepEqual(await f.db.rows('PaymentSettings'), before); assert.deepEqual(await f.db.rows('AdminAudit'), audit);
    const ordinary = await request(f.app).put('/api/admin/payment-settings').set(f.pending.headers).send({ ...bankSettings, contactUrl: telegramUrl });
    assert.equal(ordinary.status, 403);
  } finally { await f.db.close(); }
});

test('orders snapshot their contact destination independently of subsequent payment and community changes', async () => {
  const f = await fixture(); try {
    const second = await f.seed('second'); const third = await f.seed('third');
    await f.payment({ zaloUrl: legacyZaloUrl }).expect(200);
    const old = await f.createOrder(); assert.equal(old.status, 200); assert.equal(old.body.contactUrl, legacyZaloUrl);
    const oldSnapshot = await f.db.one('PurchaseOrders', 'Id=@id', { id: old.body.id });
    await f.payment({ contactUrl: 'https://support.example.test/contact' }).expect(200); await f.update(telegramUrl).expect(200);
    const generic = await f.createOrder(second); assert.equal(generic.status, 200); assert.equal(generic.body.contactUrl, 'https://support.example.test/contact');
    await f.payment({ contactUrl: '' }).expect(200); await f.update('https://t.me/+AnotherGroup0123456').expect(200);
    const empty = await f.createOrder(third); assert.equal(empty.status, 200); assert.equal(empty.body.contactUrl, '');
    assert.equal((await f.createOrder()).body.contactUrl, legacyZaloUrl);
    assert.deepEqual(await f.db.one('PurchaseOrders', 'Id=@id', { id: old.body.id }), oldSnapshot);
    for (const [account, order, contactUrl] of [[f.pending, old.body, legacyZaloUrl], [second, generic.body, 'https://support.example.test/contact'], [third, empty.body, '']] as const) {
      const detail = await request(f.app).get(`/api/orders/${order.id}`).set(account.headers); assert.equal(detail.status, 200); assert.equal(detail.body.contactUrl, contactUrl);
      const list = await request(f.app).get('/api/orders').set(account.headers); assert.equal(list.body.orders[0].contactUrl, contactUrl);
      const subscription = await request(f.app).get('/api/subscription').set(account.headers);
      assert.equal(subscription.body.settings.contactUrl, ''); assert.equal(subscription.body.openOrder.contactUrl, contactUrl);
    }
    const reported = await request(f.app).post(`/api/orders/${old.body.id}/report`).set(f.pending.headers).send({}); assert.equal(reported.status, 200); assert.equal(reported.body.contactUrl, legacyZaloUrl);
    const approved = await request(f.app).post(`/api/admin/orders/${old.body.id}/review`).set(f.admin.headers).send({ action: 'approve', transactionReference: 'CONTACT-SNAPSHOT-001' });
    assert.equal(approved.status, 200); assert.equal(approved.body.contactUrl, legacyZaloUrl);
    const cancelled = await request(f.app).post(`/api/orders/${generic.body.id}/cancel`).set(second.headers).send({});
    assert.equal(cancelled.status, 200); assert.equal(cancelled.body.contactUrl, 'https://support.example.test/contact');
    const adminList = await request(f.app).get('/api/admin/orders').set(f.admin.headers);
    assert.equal(adminList.body.orders.find((order: Row) => order.id === old.body.id).contactUrl, legacyZaloUrl);
    const adminDetail = await request(f.app).get(`/api/admin/orders/${old.body.id}`).set(f.admin.headers);
    assert.equal(adminDetail.body.contactUrl, legacyZaloUrl);
  } finally { await f.db.close(); }
});
