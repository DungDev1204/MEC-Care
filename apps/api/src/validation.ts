import { z } from 'zod';
import { DateTime } from 'luxon';
import { randomUUID } from 'node:crypto';
import type { Row } from './db.js';

export class HttpError extends Error { constructor(public status: number, message: string, public extra: Row = {}) { super(message); } }
export const uuid = z.string().uuid();
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => DateTime.fromISO(value).isValid, 'Ngày chưa hợp lệ.');
export const phone = (value: string) => value.replace(/\D/g, '');
export const searchText = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').replace(/[đĐ]/g, 'd').toLowerCase();
const text = (max: number) => z.string().max(max).transform(s => s.trim());
export const customerSchema = z.object({
  name: text(200).refine(Boolean, 'Nhập họ tên.'), phone: z.string().transform(phone).refine(s => s.length >= 8 && s.length <= 15, 'Số điện thoại cần 8–15 chữ số.'),
  birthDate: dateOnly.nullable().refine(s => !s || s <= DateTime.now().setZone('Asia/Ho_Chi_Minh').toISODate()!, 'Ngày sinh không được ở tương lai.'),
  interests: text(10000), notes: text(10000), preferredContact: text(500), status: z.enum(['new','consulting','purchased']),
  vehicles: z.array(z.object({ id: uuid.nullish(), model: text(200), plate: text(32), deliveryDate: dateOnly.nullable() })).max(20),
  confirmDuplicate: z.boolean().optional()
});
export function localTime(value: string, zone: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(value)) throw new HttpError(400, 'Ngày giờ chưa hợp lệ.');
  const time = DateTime.fromISO(value, { zone, setZone: true });
  if (!time.isValid || time.toFormat("yyyy-MM-dd'T'HH:mm") !== value.slice(0, 16) || time.getPossibleOffsets().length !== 1)
    throw new HttpError(400, 'Ngày giờ hoặc múi giờ không hợp lệ hoặc không rõ ràng.');
  return time;
}
export const reminderSchema = z.object({ kind: z.enum(['birthday','afterPurchase','maintenance','delivery','consulting','other']), content: text(2000).refine(Boolean),
  localDateTime: z.string(), timeZone: z.string().max(100), repeat: z.enum(['once','annual']), leadDays: z.union([z.literal(0),z.literal(1),z.literal(3)]), leapDayPolicy: z.enum(['feb28','mar1']).nullable() })
  .superRefine((r, ctx) => {
    try {
      const time = localTime(r.localDateTime, r.timeZone);
      if (time.toMillis() <= Date.now()) ctx.addIssue({ code: 'custom', path: ['localDateTime'], message: 'Chọn ngày giờ trong tương lai.' });
      if (r.repeat === 'annual' && time.month === 2 && time.day === 29 && !r.leapDayPolicy) ctx.addIssue({ code: 'custom', path: ['leapDayPolicy'], message: 'Chọn quy tắc 29/02.' });
    } catch (error) { ctx.addIssue({ code: 'custom', path: ['localDateTime'], message: (error as Error).message }); }
  })
  // datetime-local inputs send minute precision; SQL Server datetime2 requires seconds with ISO's T separator.
  .transform(r => ({ ...r, localDateTime: r.localDateTime.length === 16 ? `${r.localDateTime}:00` : r.localDateTime }));
export const registerSchema = z.object({ username: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,32}$/, 'Username cần 3–32 ký tự: chữ không dấu, số hoặc dấu gạch dưới.'), email: z.string().trim().toLowerCase().pipe(z.email().max(254)), password: z.string().min(6, 'Mật khẩu cần ít nhất 6 ký tự.').max(256) });
const loginIdentifier = z.string().trim().toLowerCase().min(1, 'Nhập username.').max(254);
export const loginSchema = z.object({ username: loginIdentifier.optional(), email: loginIdentifier.optional(), password: z.string().min(1, 'Nhập mật khẩu.').max(256) })
  .refine(input => !!(input.username || input.email), { path: ['username'], message: 'Nhập username.' })
  .transform(input => ({ identifier: input.username || input.email!, password: input.password }));
export const personalSchema = z.object({ displayName: text(200).refine(Boolean), phone: z.string().max(32).transform(phone).refine(s => !s || s.length >= 8 && s.length <= 15) });
export const contactSchema = z.object({ at: z.iso.datetime({ offset: true }).refine(s => Date.parse(s) <= Date.now() + 60000, 'Thời điểm chưa được thực hiện.'), channel: z.enum(['call','message','meeting']),
  content: text(10000).refine(Boolean), occurrenceId: uuid.nullish(), nextReminder: reminderSchema.nullish() });
export function generate(r: Row, now = Date.now()): Row[] {
  const baseValue = String(r.localDateTime).replace(' ', 'T').replace(/Z$/, '');
  const base = localTime(baseValue, r.timeZone); const localNow = DateTime.fromMillis(now, { zone: r.timeZone });
  const start = r.repeat === 'once' ? base.year : Math.max(base.year, localNow.year); const result: Row[] = [];
  for (let year = start; year <= (r.repeat === 'once' ? start : start + 2); year++) {
    let target = base;
    if (r.repeat === 'annual') {
      if (base.month === 2 && base.day === 29 && !DateTime.local(year).isInLeapYear) {
        if (!['feb28','mar1'].includes(r.leapDayPolicy)) throw new HttpError(400, 'Chọn quy tắc 29/02.');
        target = base.set({ day: 1, year, month: r.leapDayPolicy === 'feb28' ? 2 : 3 }).set({ day: r.leapDayPolicy === 'feb28' ? 28 : 1 });
      } else target = base.set({ year });
      target = localTime(target.toFormat("yyyy-MM-dd'T'HH:mm:ss"), r.timeZone);
    }
    if (target.toMillis() < base.toMillis() || r.repeat === 'annual' && target.toMillis() < now) continue;
    const at = target.toUTC().toISO()!;
    result.push({ id: randomUUID(), reminderId: r.id, revision: r.revision, originalAt: at, scheduledAt: at,
      notifyAt: target.minus({ days: r.leadDays }).toUTC().toISO()!, state: 'pending', completedAt: null });
  }
  return result;
}
