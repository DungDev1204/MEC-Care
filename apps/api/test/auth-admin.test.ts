import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { DateTime } from 'luxon';
import { Database } from '../src/db.js';
import { readConfig } from '../src/config.js';
import { createApp } from '../src/app.js';
import { hashPassword, hash, verifyPassword } from '../src/auth.js';
import { HttpError } from '../src/validation.js';
import { runCycle } from '../src/push.js';
import { assignLegacyUsernames } from '../src/auth-schema.js';

async function fixture(failMail = false) {
  const config = readConfig('missing-test-env', { APP_ENV: 'Testing', DB_SERVER: 'unused', DB_USER: 'unused', DB_PASSWORD: 'test', DB_NAME: 'unused' });
  config.reviewDatabase = ':memory:'; const db = await Database.connect(config); const mail: { email: string; code: string }[] = [];
  const app = createApp(db, config, async (email, code) => { if (failMail) throw new HttpError(503, 'Email unavailable'); mail.push({ email, code }); });
  async function seed(email: string, isAdmin = false) {
    const user = await db.insert('Employees', { id: randomUUID(), email, displayName: email.split('@')[0], passwordHash: await hashPassword('123456'), enabled: true, isAdmin, emailVerified: true, activeUntil: null, phone: '' });
    const result = await request(app).post('/auth/login').send({ email, password: '123456' }); assert.equal(result.status, 200);
    return { ...user, token: result.body.token };
  }
  return { app, db, mail, seed };
}
const signup = (app: ReturnType<typeof createApp>, username = 'alice', email = `${username}@example.test`) => request(app).post('/auth/register').send({ username, email, password: '123456' });
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

test('six-digit email OTP creates a verified user who can sign in without subscription or admin rights', async () => {
  const f = await fixture(); try {
    const begin = await request(f.app).post('/auth/register').send({ username: ' Alice_01 ', email: ' ALICE@EXAMPLE.TEST ', password: '123456', isAdmin: true, enabled: true });
    assert.equal(begin.status, 202); assert.equal(begin.headers['set-cookie'], undefined); assert.equal(begin.body.token, undefined);
    assert.equal(f.mail[0].email, 'alice@example.test'); assert.match(f.mail[0].code, /^\d{6}$/); assert.equal((await f.db.rows('Employees')).length, 0);
    const p = await f.db.one('Registrations', 'Id=@id', { id: begin.body.registrationId });
    assert.notEqual(p!.codeHash, f.mail[0].code); assert.ok(await verifyPassword(f.mail[0].code, p!.codeHash));
    assert.equal((await request(f.app).post('/auth/register/verify').send({ registrationId: p!.id, code: '00000' })).status, 400);
    const verified = await request(f.app).post('/auth/register/verify').send({ registrationId: p!.id, code: f.mail[0].code });
    assert.equal(verified.status, 201); assert.equal(verified.body.status, 'pendingActivation'); assert.equal(verified.headers['set-cookie'], undefined);
    const u = (await f.db.rows('Employees'))[0]; assert.equal(u.username, 'alice_01'); assert.equal(u.enabled, true); assert.equal(u.accessGranted, false); assert.equal(u.emailVerified, true); assert.equal(u.isAdmin, false);
    assert.equal((await f.db.rows('Registrations')).length, 0);
    assert.equal((await request(f.app).post('/auth/register/verify').send({ registrationId: p!.id, code: f.mail[0].code })).status, 400);
    const login = await request(f.app).post('/auth/login').send({ username: 'alice_01', password: '123456' });
    assert.equal(login.status, 200); assert.equal(login.body.canUseApp, false); assert.equal(login.body.accessStatus, 'pending');
    assert.equal((await request(f.app).get('/api/customers').set(auth(login.body.token))).status, 403);
    assert.equal((await signup(f.app, 'alice_01', 'different@example.test')).status, 409);
  } finally { await f.db.close(); }
});
test('signup rejects short passwords and invalid usernames and reserves the existing admin address', async () => {
  const f = await fixture(); try {
    assert.equal((await request(f.app).post('/auth/register').send({ username: 'abc', email: 'a@example.test', password: '12345' })).status, 400);
    assert.equal((await signup(f.app, 'bad username')).status, 400);
    assert.equal((await signup(f.app, 'admin', 'admin@admin.com')).status, 409);
    assert.equal(f.mail.length, 0);
  } finally { await f.db.close(); }
});
test('expired codes, five wrong attempts, unknown challenges and immediate resends are rejected', async () => {
  const f = await fixture(); try {
    const begin = await signup(f.app); const id = begin.body.registrationId;
    assert.equal((await request(f.app).post('/auth/register/resend').send({ registrationId: id })).status, 429);
    assert.equal((await request(f.app).post('/auth/register/resend').send({ registrationId: randomUUID() })).status, 400);
    const wrong = f.mail[0].code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) assert.equal((await request(f.app).post('/auth/register/verify').send({ registrationId: id, code: wrong })).status, 400);
    assert.equal((await f.db.one('Registrations', 'Id=@id', { id }))!.attempts, 5);
    assert.equal((await request(f.app).post('/auth/register/verify').send({ registrationId: id, code: f.mail[0].code })).status, 400);
    assert.equal((await request(f.app).post('/auth/register/resend').send({ registrationId: id })).status, 400);
    const second = await signup(f.app, 'bob');
    await f.db.update('Registrations', { expiresAt: new Date(Date.now() - 1000) }, 'Id=@id', { id: second.body.registrationId });
    assert.equal((await request(f.app).post('/auth/register/verify').send({ registrationId: second.body.registrationId, code: f.mail[1].code })).status, 400);
    assert.equal((await f.db.rows('Employees')).length, 0);
  } finally { await f.db.close(); }
});
test('resend rotates the code and retains the failed attempt budget', async () => {
  const f = await fixture(); try {
    const begin = await signup(f.app); const id = begin.body.registrationId;
    await f.db.update('Registrations', { sentAt: new Date(Date.now() - 61000), attempts: 3 }, 'Id=@id', { id });
    assert.equal((await request(f.app).post('/auth/register/resend').send({ registrationId: id })).status, 200);
    const p = await f.db.one('Registrations', 'Id=@id', { id }); assert.equal(p!.attempts, 3); assert.equal(p!.sends, 2);
    assert.ok(await verifyPassword(f.mail[1].code, p!.codeHash));
    if (f.mail[0].code !== f.mail[1].code) assert.equal(await verifyPassword(f.mail[0].code, p!.codeHash), false);
  } finally { await f.db.close(); }
});
test('failed SMTP leaves no user or unusable pending registration', async () => {
  const f = await fixture(true); try {
    assert.equal((await signup(f.app)).status, 503); assert.equal((await f.db.rows('Employees')).length, 0); assert.equal((await f.db.rows('Registrations')).length, 0);
  } finally { await f.db.close(); }
});
test('admin activates monthly access, renews from expiry and immediately revokes sessions and devices', async () => {
  const f = await fixture(); try {
    const admin = await f.seed('admin@admin.com', true); const begin = await signup(f.app);
    await request(f.app).post('/auth/register/verify').send({ registrationId: begin.body.registrationId, code: f.mail[0].code });
    const u = await f.db.one('Employees', 'Email=@email', { email: 'alice@example.test' });
    const activate = (enabled: boolean, months = 1) => request(f.app).post(`/api/admin/users/${u!.id}/activation`).set(auth(admin.token)).send({ enabled, months });
    const first = await activate(true); assert.equal(first.status, 200); assert.equal(first.body.status, 'active'); assert.ok(Date.parse(first.body.activeUntil) > Date.now());
    const second = await activate(true); assert.equal(second.body.activeUntil, DateTime.fromISO(first.body.activeUntil, { zone: 'utc' }).plus({ months: 1 }).toISO());
    const login = await request(f.app).post('/auth/login').send({ email: u!.email, password: '123456' }); assert.equal(login.status, 200);
    const session = await f.db.one('Sessions', 'TokenHash=@hash', { hash: hash(login.body.token) });
    await f.db.insert('Devices', { id: randomUUID(), ownerId: u!.id, sessionId: session!.id, enabled: true });
    assert.equal((await request(f.app).get('/api/session').set(auth(login.body.token))).status, 200);
    assert.equal((await activate(false)).status, 200);
    assert.equal((await request(f.app).get('/api/session').set(auth(login.body.token))).status, 401);
    assert.equal((await f.db.rows('Devices'))[0].enabled, false);
    await activate(true);
    assert.equal((await request(f.app).get('/api/session').set(auth(login.body.token))).status, 401);
    assert.equal((await f.db.rows('AdminAudit')).length, 4);
    assert.equal((await request(f.app).post(`/api/admin/users/${admin.id}/activation`).set(auth(admin.token)).send({ enabled: false })).status, 409);
  } finally { await f.db.close(); }
});
test('expired subscribers can sign in to renew, while customer data, files and push remain blocked', async () => {
  const f = await fixture(); try {
    const u = await f.seed('alice@example.test');
    const c = await f.db.insert('Customers', { id: randomUUID(), ownerId: u.id, name: 'Private', updatedAt: new Date() });
    const r = await f.db.insert('Reminders', { id: randomUUID(), customerId: c.id, active: true, repeat: 'once' });
    await f.db.insert('Occurrences', { id: randomUUID(), reminderId: r.id, state: 'pending', notifyAt: new Date(Date.now() - 1000), originalAt: new Date(), revision: 1 });
    const session = await f.db.one('Sessions', 'TokenHash=@hash', { hash: hash(u.token) });
    await f.db.insert('Devices', { id: randomUUID(), ownerId: u.id, sessionId: session!.id, enabled: true, endpoint: 'https://fcm.googleapis.com/send/test' });
    await f.db.update('Employees', { activeUntil: new Date(Date.now() - 1000) }, 'Id=@id', { id: u.id });
    const login = await request(f.app).post('/auth/login').send({ email: u.email, password: '123456' });
    assert.equal(login.status, 200); assert.equal(login.body.accessStatus, 'expired'); assert.equal(login.body.canUseApp, false);
    assert.equal((await request(f.app).get('/api/session').set(auth(u.token))).status, 200);
    assert.equal((await request(f.app).get('/api/account').set(auth(u.token))).status, 200);
    for (const url of ['/api/customers', '/api/account/backup', `/api/photos/${randomUUID()}/file`]) {
      const result = await request(f.app).get(url).set(auth(u.token)); assert.equal(result.status, 403); assert.equal(result.body.code, 'SUBSCRIPTION_REQUIRED');
    }
    let sends = 0; await runCycle(f.db, async () => { sends++; }); assert.equal(sends, 0);
    assert.equal((await f.db.rows('Deliveries')).length, 0);
  } finally { await f.db.close(); }
});
test('admin APIs reject normal users and return paginated public fields and persistent settings only', async () => {
  const f = await fixture(); try {
    const admin = await f.seed('admin@admin.com', true); const normal = await f.seed('normal@example.test');
    assert.equal((await request(f.app).get('/api/admin/users')).status, 401);
    assert.equal((await request(f.app).get('/api/admin/users').set(auth(normal.token))).status, 403);
    assert.equal((await request(f.app).put('/api/admin/settings').set(auth(normal.token)).send({ registrationEnabled: false, defaultActivationMonths: 1 })).status, 403);
    assert.equal((await request(f.app).post(`/api/admin/users/${normal.id}/activation`).set(auth(normal.token)).send({ enabled: true })).status, 403);
    const list = await request(f.app).get('/api/admin/users?search=normal&page=1').set(auth(admin.token));
    assert.equal(list.status, 200); assert.equal(list.body.total, 1); assert.equal(list.body.users[0].email, normal.email);
    assert.equal(list.body.users[0].passwordHash, undefined); assert.equal(list.body.users[0].token, undefined);
    assert.equal((await request(f.app).get('/api/admin/users?page=0').set(auth(admin.token))).status, 400);
    assert.equal((await request(f.app).post(`/api/admin/users/${normal.id}/activation`).set(auth(admin.token)).send({ enabled: true, months: 0 })).status, 400);
    assert.equal((await request(f.app).put('/api/admin/settings').set(auth(admin.token)).send({ registrationEnabled: false, defaultActivationMonths: 2 })).status, 200);
    assert.equal((await signup(f.app)).status, 403);
    const config = await request(f.app).get('/api/admin/settings').set(auth(admin.token));
    assert.equal(config.body.registrationEnabled, false); assert.equal(config.body.defaultActivationMonths, 2); assert.equal(config.body.smtpPass, undefined);
    assert.equal((await request(f.app).get('/auth/registration/config')).body.registrationEnabled, false);
    await request(f.app).put('/api/admin/settings').set(auth(admin.token)).send({ registrationEnabled: true, defaultActivationMonths: 2 });
    const activation = await request(f.app).post(`/api/admin/users/${normal.id}/activation`).set(auth(admin.token)).send({ enabled: true });
    assert.equal(activation.status, 200); assert.ok(Date.parse(activation.body.activeUntil) > DateTime.utc().plus({ months: 1 }).toMillis());
  } finally { await f.db.close(); }
});
test('concurrent OTP verification creates exactly one user and consumes the challenge once', async () => {
  const f = await fixture(); try {
    const begin = await signup(f.app); const input = { registrationId: begin.body.registrationId, code: f.mail[0].code };
    const results = await Promise.all([request(f.app).post('/auth/register/verify').send(input), request(f.app).post('/auth/register/verify').send(input)]);
    assert.deepEqual(results.map(r => r.status).sort(), [201, 400]); assert.equal((await f.db.rows('Employees')).length, 1);
  } finally { await f.db.close(); }
});
test('verified accounts sign in using normalized usernames and exactly six password characters', async () => {
  const f = await fixture(); try {
    const begin = await signup(f.app, 'quick_user');
    assert.equal(begin.status, 202);
    assert.equal((await request(f.app).post('/auth/register/verify').send({ registrationId: begin.body.registrationId, code: f.mail[0].code })).status, 201);
    const pending = await request(f.app).post('/auth/login').send({ username: 'quick_user', password: '123456' }); assert.equal(pending.status, 200); assert.equal(pending.body.canUseApp, false);
    await f.db.update('Employees', { enabled: true, accessGranted: true, activeUntil: new Date(Date.now() + 86400000) }, 'Username=@username', { username: 'quick_user' });
    const result = await request(f.app).post('/auth/login').send({ username: ' QUICK_USER ', password: '123456' });
    assert.equal(result.status, 200); assert.equal(result.body.username, 'quick_user'); assert.equal(result.body.email, 'quick_user@example.test');
    assert.equal((await request(f.app).get('/api/account').set(auth(result.body.token))).body.username, 'quick_user');
    assert.equal((await request(f.app).post('/auth/login').send({ username: 'quick_user', password: 'wrong-password' })).status, 401);
    assert.equal((await request(f.app).post('/auth/login').send({ username: 'unknown_user', password: '123456' })).status, 401);
    assert.equal((await request(f.app).post('/auth/login').send({ password: '123456' })).status, 400);
    assert.equal((await request(f.app).post('/auth/login').send({ email: 'quick_user@example.test', password: '123456' })).status, 200);
  } finally { await f.db.close(); }
});
test('plan requests are idempotent, visible to admin and unlock the existing session only after activation', async () => {
  const f = await fixture(); try {
    const admin = await f.seed('admin@admin.com', true); const begin = await signup(f.app, 'subscriber');
    await request(f.app).post('/auth/register/verify').send({ registrationId: begin.body.registrationId, code: f.mail[0].code });
    const login = await request(f.app).post('/auth/login').send({ username: 'subscriber', password: '123456' }); assert.equal(login.status, 200);
    const headers = auth(login.body.token);
    const info = await request(f.app).get('/api/subscription').set(headers); assert.equal(info.body.accessStatus, 'pending'); assert.equal(info.body.requestedAt, null);
    assert.equal((await request(f.app).get('/api/session').set(headers)).body.canUseApp, false);
    assert.equal((await request(f.app).get('/api/account').set(headers)).status, 200);
    assert.equal((await request(f.app).post('/api/customers').set(headers).send({})).body.code, 'SUBSCRIPTION_REQUIRED');
    assert.equal((await request(f.app).get('/api/push/config').set(headers)).status, 403);
    const first = await request(f.app).post('/api/subscription/request').set(headers).send({}); assert.equal(first.status, 200);
    const second = await request(f.app).post('/api/subscription/request').set(headers).send({}); assert.equal(second.body.requestedAt, first.body.requestedAt);
    assert.equal((await f.db.rows('SubscriptionRequests')).length, 1);
    const list = await request(f.app).get('/api/admin/users?search=subscriber').set(auth(admin.token));
    const u = list.body.users[0]; assert.equal(u.status, 'pending'); assert.equal(u.subscriptionRequestedAt, first.body.requestedAt);
    assert.equal((await request(f.app).post(`/api/admin/users/${u.id}/activation`).set(auth(admin.token)).send({ enabled: true, months: 1 })).status, 200);
    assert.equal((await request(f.app).get('/api/session').set(headers)).body.canUseApp, true);
    assert.equal((await request(f.app).get('/api/customers').set(headers)).status, 200);
    assert.equal((await f.db.rows('SubscriptionRequests'))[0].state, 'fulfilled');
    assert.equal((await request(f.app).post('/api/subscription/request').set(headers).send({})).status, 409);
    await f.db.update('Employees', { activeUntil: new Date(Date.now() - 1000) }, 'Id=@id', { id: u.id });
    assert.equal((await request(f.app).get('/api/session').set(headers)).body.canUseApp, false);
    assert.equal((await request(f.app).post('/api/subscription/request').set(headers).send({})).status, 200);
    assert.equal((await f.db.rows('SubscriptionRequests')).length, 1);
    await request(f.app).post(`/api/admin/users/${u.id}/activation`).set(auth(admin.token)).send({ enabled: false });
    assert.equal((await request(f.app).get('/api/session').set(headers)).status, 401);
    assert.equal((await request(f.app).post('/auth/login').send({ username: 'subscriber', password: '123456' })).status, 403);
  } finally { await f.db.close(); }
});
test('legacy username migration preserves passwords and existing usernames and resolves email-prefix collisions', async () => {
  const f = await fixture(); try {
    const admin = await f.seed('admin@admin.com', true); const first = await f.seed('same@example.test'); const second = await f.seed('same@other.test');
    await f.db.update('Employees', { username: 'same' }, 'Id=@id', { id: first.id });
    const before = await f.db.rows('Employees');
    const assigned = await assignLegacyUsernames(f.db); assert.equal(assigned.length, 2);
    assert.equal((await f.db.one('Employees', 'Id=@id', { id: admin.id }))!.username, 'admin');
    assert.equal((await f.db.one('Employees', 'Id=@id', { id: second.id }))!.username, 'same_1');
    for (const old of before) { const current = await f.db.one('Employees', 'Id=@id', { id: old.id }); assert.equal(current!.passwordHash, old.passwordHash); assert.equal(current!.enabled, old.enabled); }
    assert.equal((await assignLegacyUsernames(f.db)).length, 0);
    const login = await request(f.app).post('/auth/login').send({ username: 'admin', password: '123456' });
    assert.equal(login.status, 200); assert.equal(login.body.isAdmin, true);
  } finally { await f.db.close(); }
});
