import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Database } from './db.js';
import { HttpError } from './validation.js';

const servicePaths = new Set(['share', 'proxy', 'socks', 'iv', 'login', 'auth', 'oauth', 'addstickers', 'addemoji', 'setlanguage', 'confirmphone', 'bg', 'invoice', 'boost', 'giftcode', 'contact', 'addtheme', 'joinchat', 'resolve', 'msg', 'games']);
export function telegramCommunityUrlAllowed(value: string) {
  if (!value) return true;
  // Match the submitted URL before parsing: URL() normalizes ports and traversal segments.
  const match = /^https:\/\/t\.me\/([A-Za-z][A-Za-z0-9_]{3,31}|\+[A-Za-z0-9_-]+|joinchat\/[A-Za-z0-9_-]+)\/?$/i.exec(value);
  return !!match && !servicePaths.has(match[1].toLowerCase());
}
export const communitySettingsSchema = z.object({
  telegramCommunityUrl: z.string().trim().max(300).refine(telegramCommunityUrlAllowed, 'Nhập liên kết nhóm Telegram dạng https://t.me/tennhom hoặc liên kết mời Telegram.')
}).strict();
export async function communitySettings(db: Database) {
  const row = await db.one('SystemSettings', 'Id=@id', { id: 'auth' });
  const parsed = communitySettingsSchema.safeParse({ telegramCommunityUrl: String(row?.telegramCommunityUrl || '') });
  return parsed.success ? parsed.data : { telegramCommunityUrl: '' };
}
export function communityRouter(db: Database) {
  const router = Router();
  const requireAdmin = (user: { isAdmin?: boolean }) => { if (!user.isAdmin) throw new HttpError(403, 'Chỉ quản trị viên mới có quyền truy cập.'); };
  router.get('/community-settings', async (_req, res) => { res.json(await communitySettings(db)); });
  router.get('/admin/community-settings', async (_req, res) => { requireAdmin(res.locals.user); res.json(await communitySettings(db)); });
  router.put('/admin/community-settings', async (req, res) => {
    requireAdmin(res.locals.user);
    const input = communitySettingsSchema.parse(req.body);
    await db.transaction(async tx => {
      if (await tx.oneLocked('SystemSettings', 'Id=@id', { id: 'auth' })) await tx.update('SystemSettings', input, 'Id=@id', { id: 'auth' });
      else await tx.insert('SystemSettings', { id: 'auth', registrationEnabled: true, defaultActivationMonths: 1, subscriptionEnabled: true, ...input });
      await tx.insert('AdminAudit', { id: randomUUID(), actorId: res.locals.user.id, targetId: null, action: 'community_settings', createdAt: new Date(), details: JSON.stringify(input) });
    });
    res.json(input);
  });
  return router;
}
