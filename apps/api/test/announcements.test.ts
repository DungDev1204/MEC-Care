import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { Database } from '../src/db.js';
import { readConfig } from '../src/config.js';
import { createApp } from '../src/app.js';
import { hashPassword } from '../src/auth.js';

async function fixture() {
  const config = readConfig('missing-test-env', { APP_ENV: 'Testing', DB_SERVER: 'unused', DB_USER: 'unused', DB_PASSWORD: 'test', DB_NAME: 'unused' });
  config.reviewDatabase = ':memory:'; const db = await Database.connect(config); const app = createApp(db, config, async () => {});
  const passwordHash = await hashPassword('123456');
  async function seed(username: string, isAdmin = false, accessGranted = true) {
    const user = await db.insert('Employees', { id: randomUUID(), email: `${username}@example.test`, username, displayName: username, passwordHash, enabled: true, emailVerified: true, isAdmin, accessGranted });
    const login = await request(app).post('/auth/login').send({ username, password: '123456' }); assert.equal(login.status, 200);
    return { ...user, headers: { Authorization: `Bearer ${login.body.token}` } };
  }
  const admin = await seed('admin', true); const user = await seed('user'); const pending = await seed('pending', false, false);
  const body = (change = {}) => ({ title: 'Thông báo mới', content: 'Nội dung cho mọi người.\nDòng thứ hai.', startsAt: new Date(Date.now() - 60000).toISOString(), endsAt: new Date(Date.now() + 3600000).toISOString(), ...change });
  const create = (change = {}) => request(app).post('/api/admin/announcements').set(admin.headers).send(body(change));
  return { app, db, seed, admin, user, pending, body, create };
}

test('announcements require sign-in and only administrators can publish, list management history or stop notices', async () => {
  const f = await fixture(); try {
    assert.equal((await request(f.app).get('/api/announcements')).status, 401);
    for (const method of ['get', 'post'] as const) {
      const req = request(f.app)[method]('/api/admin/announcements').set(f.user.headers);
      assert.equal((await (method === 'post' ? req.send(f.body({ isAdmin: true })) : req)).status, 403);
    }
    const item = await f.create(); assert.equal(item.status, 201);
    assert.equal((await request(f.app).post(`/api/admin/announcements/${item.body.id}/stop`).set(f.user.headers).send({})).status, 403);
    assert.equal((await f.db.rows('Announcements'))[0].enabled, true);
    assert.equal((await request(f.app).get('/api/admin/announcements').set(f.admin.headers)).body.length, 1);
  } finally { await f.db.close(); }
});
test('display window reaches all signed-in users including those without a plan and excludes future, expired and stopped messages', async () => {
  const f = await fixture(); try {
    const live = await f.create();
    const future = await f.create({ startsAt: new Date(Date.now() + 1800000).toISOString() });
    const expired = await f.create(); await f.db.update('Announcements', { endsAt: new Date(Date.now() - 1000) }, 'Id=@id', { id: expired.body.id });
    const stopped = await f.create(); await request(f.app).post(`/api/admin/announcements/${stopped.body.id}/stop`).set(f.admin.headers).send({});
    for (const account of [f.user, f.pending, f.admin]) {
      const list = await request(f.app).get('/api/announcements').set(account.headers); assert.equal(list.status, 200);
      assert.deepEqual(list.body.map((a: any) => a.id), [live.body.id]);
    }
    await f.db.update('Announcements', { startsAt: new Date(Date.now() - 1000) }, 'Id=@id', { id: future.body.id });
    assert.equal((await request(f.app).get('/api/announcements').set(f.user.headers)).body.length, 2);
    const history = (await request(f.app).get('/api/admin/announcements').set(f.admin.headers)).body;
    assert.equal(history.find((a: any) => a.id === expired.body.id).status, 'expired');
    assert.equal(history.find((a: any) => a.id === stopped.body.id).status, 'disabled');
  } finally { await f.db.close(); }
});
test('hiding a notice persists per account across sessions, remains isolated from other users and does not hide new notices', async () => {
  const f = await fixture(); try {
    const item = await f.create(); const path = `/api/announcements/${item.body.id}/dismiss`;
    const responses = await Promise.all([request(f.app).post(path).set(f.user.headers).send({ employeeId: f.pending.id }), request(f.app).post(path).set(f.user.headers).send({})]);
    assert.ok(responses.every(r => r.status === 204)); assert.equal((await f.db.rows('AnnouncementDismissals')).length, 1);
    assert.equal((await f.db.rows('AnnouncementDismissals'))[0].employeeId, f.user.id);
    const otherSession = await request(f.app).post('/auth/login').send({ username: 'user', password: '123456' });
    assert.deepEqual((await request(f.app).get('/api/announcements').set('Authorization', `Bearer ${otherSession.body.token}`)).body, []);
    assert.equal((await request(f.app).get('/api/announcements').set(f.pending.headers)).body.length, 1);
    const next = await f.create({ title: 'Thông báo tiếp theo' });
    assert.deepEqual((await request(f.app).get('/api/announcements').set(f.user.headers)).body.map((a: any) => a.id), [next.body.id]);
  } finally { await f.db.close(); }
});
test('invalid schedules and empty or oversized content are rejected without creating notices or audit entries', async () => {
  const f = await fixture(); try {
    for (const change of [{ content: '  ' }, { content: 'a'.repeat(5001) }, { startsAt: 'invalid' }, { endsAt: new Date(Date.now() - 120000).toISOString() },
      { startsAt: new Date(Date.now() + 7200000).toISOString() }, { title: 'a'.repeat(121) }]) {
      assert.equal((await f.create(change)).status, 400);
    }
    assert.equal((await f.db.rows('Announcements')).length, 0); assert.equal((await f.db.rows('AdminAudit')).length, 0);
    assert.equal((await request(f.app).post(`/api/announcements/${randomUUID()}/dismiss`).set(f.user.headers).send({})).status, 404);
  } finally { await f.db.close(); }
});
test('notice content stays plain text, stopping is idempotent and audited, and expired notices cannot be dismissed', async () => {
  const f = await fixture(); try {
    const item = await f.create({ title: '', content: '<img src=x onerror=alert(1)>\nXin chào.' });
    assert.equal(item.body.title, 'Thông báo từ quản trị viên'); assert.equal(item.body.content, '<img src=x onerror=alert(1)>\nXin chào.');
    const path = `/api/admin/announcements/${item.body.id}/stop`;
    for (let i = 0; i < 2; i++) assert.equal((await request(f.app).post(path).set(f.admin.headers).send({})).status, 204);
    assert.deepEqual((await request(f.app).get('/api/announcements').set(f.user.headers)).body, []);
    const audit = await f.db.rows('AdminAudit'); assert.equal(audit.length, 2); assert.ok(audit.every(a => a.actorId === f.admin.id));
    assert.equal((await request(f.app).post(`/api/announcements/${item.body.id}/dismiss`).set(f.user.headers).send({})).status, 404);
    assert.equal((await request(f.app).post('/api/announcements/not-a-uuid/dismiss').set(f.user.headers).send({})).status, 400);
  } finally { await f.db.close(); }
});
