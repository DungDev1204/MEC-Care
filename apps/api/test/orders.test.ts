import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { DateTime } from 'luxon';
import { randomUUID } from 'node:crypto';
import { Database } from '../src/db.js';
import { readConfig } from '../src/config.js';
import { createApp } from '../src/app.js';
import { hash, hashPassword } from '../src/auth.js';
import { assignUserCodes } from '../src/user-code.js';
import { renewalAllowed, subscriptionExpiry } from '../src/subscription-dates.js';
import { runCycle } from '../src/push.js';

const settings = { bankCode: '970422', bankName: 'MB', accountNumber: '0000000000', accountName: 'NGUOI NHAN THU', monthlyPrice: 200000, zaloUrl: 'https://zalo.me/0000000000' };
async function fixture() {
  const config = readConfig('missing-order-test-env', { APP_ENV: 'Testing', DB_SERVER: 'unused', DB_NAME: 'unused', DB_USER: 'unused', DB_PASSWORD: 'test' });
  config.reviewDatabase = ':memory:'; const db = await Database.connect(config); const app = createApp(db, config, async () => {});
  const seed = async (username: string, admin = false, activeUntil: string | null = null) => {
    const user = await db.insert('Employees', { id: randomUUID(), username, email: `${username}@example.test`, displayName: username, enabled: true, isAdmin: admin,
      emailVerified: true, phone: '', accessGranted: admin || !!activeUntil, activeUntil, passwordHash: await hashPassword('123456') });
    const login = await request(app).post('/auth/login').send({ username, password: '123456' }); assert.equal(login.status, 200);
    return { ...user, token: login.body.token, headers: { Authorization: `Bearer ${login.body.token}` } };
  };
  const admin = await seed('admin', true); const buyer = await seed('buyer');
  assert.equal((await request(app).put('/api/admin/payment-settings').set(admin.headers).send(settings)).status, 200);
  const create = (user = buyer) => request(app).post('/api/orders').set(user.headers).send({});
  const report = (id: string, user = buyer) => request(app).post(`/api/orders/${id}/report`).set(user.headers).send({});
  const approve = (id: string, reference: string) => request(app).post(`/api/admin/orders/${id}/review`).set(admin.headers).send({ action: 'approve', transactionReference: reference });
  return { app, db, seed, admin, buyer, create, report, approve };
}

test('Vietnam month ends and renewal opens only at midnight of expiry day', () => {
  const now = DateTime.fromISO('2026-10-08T09:00:00Z');
  assert.equal(subscriptionExpiry(null, 1, now), '2026-11-08T16:59:59.999Z');
  assert.equal(subscriptionExpiry('2026-11-08T16:59:59.999Z', 1, now), '2026-12-08T16:59:59.999Z');
  assert.equal(subscriptionExpiry('2026-10-01T16:59:59.999Z', 1, now), '2026-11-08T16:59:59.999Z');
  assert.equal(subscriptionExpiry(null, 1, DateTime.fromISO('2027-01-31T09:00:00Z')), '2027-02-28T16:59:59.999Z');
  const user = { accessGranted: true, activeUntil: '2026-11-08T16:59:59.999Z' };
  assert.equal(renewalAllowed(user, DateTime.fromISO('2026-11-07T16:59:59.999Z')), false);
  assert.equal(renewalAllowed(user, DateTime.fromISO('2026-11-07T17:00:00Z')), true);
  assert.equal(renewalAllowed(user, DateTime.fromISO('2026-11-10T00:00:00Z')), true);
  assert.equal(renewalAllowed({ accessGranted: false }, now), true);
  assert.equal(renewalAllowed({ accessGranted: true, activeUntil: null }, now), false);
});

test('public IDs are unique, stable and backfilled without changing passwords', async () => {
  const f = await fixture(); try {
    assert.match(f.buyer.userCode, /^[A-Z0-9]{10}$/); assert.match(f.buyer.userCode, /\d/); assert.match(f.buyer.userCode, /[A-Z]/);
    assert.notEqual(f.buyer.userCode, f.admin.userCode);
    await f.db.update('Employees', { userCode: null }, 'Id=@id', { id: f.buyer.id }); await assignUserCodes(f.db);
    const first = (await f.db.one('Employees', 'Id=@id', { id: f.buyer.id }))!; await assignUserCodes(f.db);
    const second = (await f.db.one('Employees', 'Id=@id', { id: f.buyer.id }))!;
    assert.equal(second.userCode, first.userCode); assert.equal(second.passwordHash, f.buyer.passwordHash);
    assert.equal((await request(f.app).get('/api/account').set(f.buyer.headers)).body.userCode, first.userCode);
  } finally { await f.db.close(); }
});

test('creating/reopening an order is idempotent and snapshots settings; only expiry-day renewal is allowed', async () => {
  const f = await fixture(); try {
    const results = await Promise.all([f.create(), f.create(), f.create()]); assert.ok(results.every(r => r.status === 200));
    const order = results[0].body; assert.ok(results.every(r => r.body.id === order.id)); assert.equal((await f.db.rows('PurchaseOrders')).length, 1);
    assert.ok(order.transferContent.includes(order.userCode)); assert.ok(order.transferContent.includes(order.code));
    await request(f.app).put('/api/admin/payment-settings').set(f.admin.headers).send({ ...settings, monthlyPrice: 300000, accountNumber: '1111111111' });
    assert.equal((await f.create()).body.amount, 200000); assert.equal((await f.create()).body.accountNumber, settings.accountNumber);
    const tomorrow = await f.seed('tomorrow', false, DateTime.now().setZone('Asia/Ho_Chi_Minh').plus({ days: 1 }).endOf('day').toUTC().toISO());
    assert.equal((await f.create(tomorrow)).status, 409);
    const due = await f.seed('due', false, DateTime.now().setZone('Asia/Ho_Chi_Minh').endOf('day').toUTC().toISO());
    assert.equal((await f.create(due)).status, 200);
    const expired = await f.seed('expired', false, new Date(Date.now() - 60000).toISOString()); assert.equal((await f.create(expired)).status, 200);
    assert.equal((await request(f.app).get('/api/orders').set(expired.headers)).status, 200);
  } finally { await f.db.close(); }
});

test('reporting never grants access; repeated approval grants once and cannot reuse a bank reference', async () => {
  const f = await fixture(); try {
    const order = (await f.create()).body;
    assert.equal((await f.approve(order.id, 'TX-001')).status, 409);
    const reports = await Promise.all([f.report(order.id), f.report(order.id)]); assert.ok(reports.every(r => r.status === 200));
    assert.equal((await f.db.rows('AdminOrderNotifications')).length, 1);
    assert.equal((await request(f.app).get('/api/session').set(f.buyer.headers)).body.canUseApp, false);
    const results = await Promise.all([f.approve(order.id, 'tx-001'), f.approve(order.id, 'tx-001')]); assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
    const completed = (await f.db.one('PurchaseOrders', 'Id=@id', { id: order.id }))!;
    assert.equal(completed.paymentState, 'paid'); assert.equal(completed.transactionReference, 'TX-001'); assert.ok(completed.paidAt);
    assert.equal((await request(f.app).get('/api/session').set(f.buyer.headers)).body.canUseApp, true);
    assert.equal((await f.db.rows('AdminAudit', 'Action=@action', { action: 'order_approve' })).length, 1);
    const secondBuyer = await f.seed('second'); const second = (await f.create(secondBuyer)).body; await f.report(second.id, secondBuyer);
    assert.equal((await f.approve(second.id, 'TX-001')).status, 409);
    assert.equal((await f.db.one('Employees', 'Id=@id', { id: secondBuyer.id }))!.accessGranted, false);
    const detail = await request(f.app).get(`/api/orders/${order.id}`).set(f.buyer.headers); assert.equal(detail.body.history.length, 2);
  } finally { await f.db.close(); }
});

test('orders and settings enforce ownership, searchable pagination and Vietnam date filters', async () => {
  const f = await fixture(); try {
    const order = (await f.create()).body; const other = await f.seed('other');
    const filtered = async (state: string, paymentState: string) => request(f.app).get(`/api/admin/orders?state=${state}&paymentState=${paymentState}`).set(f.admin.headers);
    assert.equal((await filtered('pending_payment', 'unconfirmed')).body.total, 1);
    assert.equal((await filtered('completed', 'paid')).body.total, 0);
    await f.report(order.id);
    assert.equal((await filtered('pending_payment', 'unconfirmed')).body.total, 0);
    assert.equal((await filtered('pending_review', 'reviewing')).body.orders[0].id, order.id);
    for (const endpoint of ['/api/admin/orders', '/api/admin/payment-settings', '/api/admin/order-notifications']) assert.equal((await request(f.app).get(endpoint).set(f.buyer.headers)).status, 403);
    assert.equal((await request(f.app).get(`/api/orders/${order.id}`).set(other.headers)).status, 404);
    assert.equal((await f.report(order.id, other)).status, 404);
    assert.equal((await request(f.app).get('/api/orders').set(other.headers)).body.total, 0);
    for (const search of [order.code, order.userCode, order.username]) assert.equal((await request(f.app).get(`/api/admin/orders?search=${search}`).set(f.admin.headers)).body.total, 1);
    const day = DateTime.now().setZone('Asia/Ho_Chi_Minh').toISODate();
    assert.equal((await request(f.app).get(`/api/orders?from=${day}&to=${day}`).set(f.buyer.headers)).body.total, 1);
    assert.equal((await request(f.app).get('/api/orders?from=2026-02-31').set(f.buyer.headers)).status, 400);
    assert.equal((await request(f.app).get('/api/orders?page=0').set(f.buyer.headers)).status, 400);
    assert.equal((await request(f.app).put('/api/admin/payment-settings').set(f.buyer.headers).send(settings)).status, 403);
    assert.equal((await request(f.app).put('/api/admin/payment-settings').set(f.admin.headers).send({ ...settings, zaloUrl: 'https://evil.test/' })).status, 400);
  } finally { await f.db.close(); }
});

test('cancel, rejection, discrepancies and account locks preserve money and audit history', async () => {
  const f = await fixture(); try {
    const first = (await f.create()).body; assert.equal((await request(f.app).post(`/api/orders/${first.id}/cancel`).set(f.buyer.headers).send({})).status, 200);
    const order = (await f.create()).body; assert.notEqual(order.id, first.id); await f.report(order.id);
    assert.equal((await request(f.app).post(`/api/orders/${order.id}/cancel`).set(f.buyer.headers).send({})).status, 409);
    const review = (body: object) => request(f.app).post(`/api/admin/orders/${order.id}/review`).set(f.admin.headers).send(body);
    assert.equal((await review({ action: 'reject', reason: 'Chưa tìm thấy giao dịch' })).status, 200);
    assert.equal((await f.create()).body.id, order.id); assert.equal((await f.report(order.id)).status, 200);
    assert.equal((await review({ action: 'payment_issue', reason: 'Khách chuyển thiếu tiền', transactionReference: 'TX-ISSUE' })).status, 200);
    assert.equal((await review({ action: 'reject', reason: 'Chưa có tiền' })).status, 409);
    assert.equal((await f.approve(order.id, 'DIFFERENT-TX')).status, 409);
    await f.db.update('Employees', { enabled: false }, 'Id=@id', { id: f.buyer.id }); assert.equal((await f.approve(order.id, 'TX-ISSUE')).status, 409);
    assert.equal((await f.db.one('PurchaseOrders', 'Id=@id', { id: order.id }))!.paymentState, 'received_issue');
    await f.db.update('Employees', { enabled: true }, 'Id=@id', { id: f.buyer.id }); assert.equal((await f.approve(order.id, 'TX-ISSUE')).status, 200);
  } finally { await f.db.close(); }
});

test('admin order notifications persist, deliver once and respect device/session/admin ownership', async () => {
  const f = await fixture(); try {
    const session = (await f.db.one('Sessions', 'TokenHash=@hash', { hash: hash(f.admin.token) }))!;
    const device = await f.db.insert('Devices', { id: randomUUID(), ownerId: f.admin.id, sessionId: session.id, enabled: true, pushToken: 'admin-test', endpoint: 'https://fcm.googleapis.com/send/order-test', p256dh: 'test', authKey: 'test' });
    const order = (await f.create()).body; await f.report(order.id);
    const feed = await request(f.app).get('/api/admin/order-notifications').set(f.admin.headers); assert.equal(feed.body.unread, 1);
    const sent: string[] = []; await runCycle(f.db, async (_device, payload) => { sent.push(payload); }); await runCycle(f.db, async (_device, payload) => { sent.push(payload); });
    assert.equal(sent.length, 1); assert.ok(JSON.parse(sent[0]).url.includes(order.code)); assert.ok(!sent[0].includes(f.buyer.email));
    assert.equal((await f.db.rows('OrderPushDeliveries'))[0].state, 'providerAccepted');
    await request(f.app).post('/api/admin/order-notifications/read').set(f.admin.headers).send({ id: feed.body.notifications[0].id });
    assert.equal((await request(f.app).get('/api/admin/order-notifications').set(f.admin.headers)).body.unread, 0);
    await f.db.remove('OrderPushDeliveries', 'DeviceId=@id', { id: device.id });
    await f.db.update('AdminOrderNotifications', { readAt: null }, 'OrderId=@id', { id: order.id });
    await f.db.update('Sessions', { expiresAt: new Date(Date.now() - 1) }, 'Id=@id', { id: session.id });
    await runCycle(f.db, async (_device, payload) => { sent.push(payload); }); assert.equal(sent.length, 1);
    await f.db.update('Sessions', { expiresAt: new Date(Date.now() + 60000) }, 'Id=@id', { id: session.id });
    await f.db.update('Employees', { isAdmin: false }, 'Id=@id', { id: f.admin.id });
    await runCycle(f.db, async (_device, payload) => { sent.push(payload); }); assert.equal(sent.length, 1);
  } finally { await f.db.close(); }
});
