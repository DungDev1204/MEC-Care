import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Database, Row } from './db.js';
import { HttpError, uuid } from './validation.js';

const inputSchema = z.object({
  title: z.string().trim().max(120).default(''),
  content: z.string().trim().min(1, 'Nhập nội dung thông báo.').max(5000, 'Nội dung tối đa 5.000 ký tự.'),
  startsAt: z.iso.datetime({ offset: true }), endsAt: z.iso.datetime({ offset: true })
}).refine(v => Date.parse(v.endsAt) > Date.parse(v.startsAt), { path: ['endsAt'], message: 'Thời gian kết thúc phải sau thời gian bắt đầu.' })
  .refine(v => Date.parse(v.endsAt) > Date.now(), { path: ['endsAt'], message: 'Thời gian kết thúc phải ở tương lai.' });
const visible = 'Enabled=@enabled AND StartsAt<=@now AND EndsAt>@now';
const publicAnnouncement = (a: Row) => ({ id: a.id, title: a.title, content: a.content, startsAt: a.startsAt, endsAt: a.endsAt });
const status = (a: Row) => !a.enabled ? 'disabled' : Date.parse(a.endsAt) <= Date.now() ? 'expired' : Date.parse(a.startsAt) > Date.now() ? 'scheduled' : 'active';

export function announcementRouter(db: Database) {
  const router = Router();
  router.use('/admin/announcements', (_req, res, next) => {
    if (!res.locals.user.isAdmin) throw new HttpError(403, 'Chỉ quản trị viên mới có quyền truy cập.'); next();
  });
  router.get('/admin/announcements', async (_req, res) => {
    const items = await db.page('Announcements', '1=1', {}, 'CreatedAt DESC, Id', 0, 100);
    res.json(items.map(a => ({ ...publicAnnouncement(a), createdAt: a.createdAt, enabled: a.enabled, status: status(a) })));
  });
  router.post('/admin/announcements', async (req, res) => {
    const input = inputSchema.parse(req.body);
    const item = await db.transaction(async tx => {
      const created = await tx.insert('Announcements', { id: randomUUID(), title: input.title || 'Thông báo từ quản trị viên', content: input.content,
        startsAt: new Date(input.startsAt), endsAt: new Date(input.endsAt), enabled: true, createdAt: new Date(), createdBy: res.locals.user.id });
      await tx.insert('AdminAudit', { id: randomUUID(), actorId: res.locals.user.id, targetId: null, action: 'announcement_create', createdAt: new Date(),
        details: JSON.stringify({ announcementId: created.id, startsAt: created.startsAt, endsAt: created.endsAt }) });
      return created;
    });
    res.status(201).json({ ...publicAnnouncement(item), enabled: item.enabled, status: status(item) });
  });
  router.post('/admin/announcements/:id/stop', async (req, res) => {
    const id = uuid.parse(req.params.id);
    await db.transaction(async tx => {
      const item = await tx.one('Announcements', 'Id=@id', { id });
      if (!item) throw new HttpError(404, 'Không tìm thấy thông báo.');
      if (!item.enabled) return;
      await tx.update('Announcements', { enabled: false }, 'Id=@id', { id });
      await tx.insert('AdminAudit', { id: randomUUID(), actorId: res.locals.user.id, targetId: null, action: 'announcement_stop', createdAt: new Date(), details: JSON.stringify({ announcementId: id }) });
    });
    res.sendStatus(204);
  });
  router.get('/announcements', async (_req, res) => {
    const items = await db.rows('Announcements', `${visible} AND NOT EXISTS (
      SELECT 1 FROM AnnouncementDismissals d WHERE d.AnnouncementId=Announcements.Id AND d.EmployeeId=@employeeId)`,
      { enabled: true, now: new Date(), employeeId: res.locals.user.id }, 'StartsAt, CreatedAt, Id');
    res.json(items.map(publicAnnouncement));
  });
  router.post('/announcements/:id/dismiss', async (req, res) => {
    const id = uuid.parse(req.params.id); const employeeId = res.locals.user.id;
    await db.transaction(async tx => {
      if (!await tx.one('Announcements', `Id=@id AND ${visible}`, { id, enabled: true, now: new Date() })) throw new HttpError(404, 'Thông báo đã hết hạn hoặc ngừng hiển thị.');
      if (!await tx.one('AnnouncementDismissals', 'AnnouncementId=@id AND EmployeeId=@employeeId', { id, employeeId })) {
        await tx.insert('AnnouncementDismissals', { id: randomUUID(), announcementId: id, employeeId, createdAt: new Date() });
      }
    });
    res.sendStatus(204);
  });
  return router;
}
