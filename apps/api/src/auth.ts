import { randomBytes, randomUUID, createHash, scrypt as cryptoScrypt, pbkdf2 as cryptoPbkdf2, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { Request, Response, NextFunction } from 'express';
import type { Database, Row } from './db.js';
import type { Config } from './config.js';
import { HttpError } from './validation.js';
import { settings } from './system-settings.js';

const scrypt = promisify(cryptoScrypt); const pbkdf2 = promisify(cryptoPbkdf2);
export const cookieName = 'cliente-session';
export const hash = (value: string) => createHash('sha256').update(value).digest('hex').toUpperCase();
export const token = (req: Request) => req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : String(req.cookies?.[cookieName] || '');
export function accessStatus(user: Row) {
  return user.isAdmin ? 'active' : user.accessGranted === false ? 'pending' : user.activeUntil && Date.parse(user.activeUntil) <= Date.now() ? 'expired' : 'active';
}
export function canUseApp(user: Row, subscriptionEnabled = true) {
  return user.enabled !== false && user.emailVerified !== false && (!subscriptionEnabled || accessStatus(user) === 'active');
}
export function sessionInfo(user: Row, subscriptionEnabled = true) {
  return { email: user.email, displayName: user.displayName, username: user.username, isAdmin: !!user.isAdmin, activeUntil: user.activeUntil,
    accessStatus: accessStatus(user), subscriptionEnabled, canUseApp: canUseApp(user, subscriptionEnabled) };
}
export function requireActive(_req: Request, res: Response, next: NextFunction) {
  if (!canUseApp(res.locals.user, res.locals.subscriptionEnabled !== false)) throw new HttpError(403, 'Vui lòng đăng ký hoặc gia hạn gói để sử dụng.', { code: 'SUBSCRIPTION_REQUIRED', accessStatus: accessStatus(res.locals.user), subscriptionEnabled: res.locals.subscriptionEnabled !== false, canUseApp: false });
  next();
}
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('base64'); const key = await scrypt(password, Buffer.from(salt, 'base64'), 64) as Buffer;
  return `scrypt$${salt}$${key.toString('base64')}`;
}
export async function verifyPassword(password: string, encoded: string) {
  try {
    if (encoded.startsWith('scrypt$')) {
      const [, salt, expected] = encoded.split('$'); const actual = await scrypt(password, Buffer.from(salt, 'base64'), 64) as Buffer;
      const key = Buffer.from(expected, 'base64'); return key.length === actual.length && timingSafeEqual(key, actual);
    }
    // Read existing ASP.NET Identity hashes so migrated accounts keep their password.
    const bytes = Buffer.from(encoded, 'base64'); let offset: number, iterations: number, saltLength: number, digest: string;
    if (bytes[0] === 0 && bytes.length === 49) { offset = 1; iterations = 1000; saltLength = 16; digest = 'sha1'; }
    else if (bytes[0] === 1 && bytes.length >= 45) {
      offset = 13; iterations = bytes.readUInt32BE(5); saltLength = bytes.readUInt32BE(9); digest = ['sha1','sha256','sha512'][bytes.readUInt32BE(1)];
      if (!digest || iterations < 1 || iterations > 1000000 || saltLength < 16 || bytes.length - offset - saltLength < 16) return false;
    } else return false;
    const expected = bytes.subarray(offset + saltLength); const actual = await pbkdf2(password, bytes.subarray(offset, offset + saltLength), iterations, expected.length, digest);
    return timingSafeEqual(actual, expected);
  } catch { return false; }
}
export function authenticate(db: Database) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const value = token(req);
    if (value && value.length <= 512) {
      const rows = await db.query('SELECT e.Id, e.Email, e.DisplayName, e.Username, e.IsAdmin, e.ActiveUntil, e.AccessGranted, e.Enabled, e.EmailVerified, s.Id AS SessionId FROM Employees e JOIN Sessions s ON s.EmployeeId=e.Id WHERE s.TokenHash=@hash AND s.ExpiresAt>@now AND e.Enabled=@enabled AND COALESCE(e.EmailVerified,1)=1', { hash: hash(value), now: new Date(), enabled: true });
      if (rows[0]) { res.locals.user = rows[0]; res.locals.subscriptionEnabled = (await settings(db)).subscriptionEnabled; }
    }
    next();
  };
}
export function requireUser(_req: Request, res: Response, next: NextFunction) { if (!res.locals.user) { res.sendStatus(401); return; } next(); }
export async function startSession(db: Database, req: Request, res: Response, user: Row, config: Config, register = false) {
  const value = randomBytes(48).toString('base64'); const expiresAt = new Date(Date.now() + 7 * 86400000);
  await db.transaction(async tx => {
    if (register) await tx.insert('Employees', user);
    const previous = await tx.one('Sessions', 'TokenHash=@hash', { hash: hash(token(req)) });
    if (previous) {
      await tx.update('Devices', { enabled: false }, 'SessionId=@id', { id: previous.id });
      await tx.update('Sessions', { expiresAt: new Date() }, 'Id=@id', { id: previous.id });
    }
    await tx.insert('Sessions', { id: randomUUID(), employeeId: user.id, tokenHash: hash(value), expiresAt });
  });
  res.cookie(cookieName, value, { httpOnly: true, secure: config.environment !== 'Development', sameSite: 'strict', expires: expiresAt, path: '/' });
  return { ...sessionInfo(user, (await settings(db)).subscriptionEnabled), token: value, expiresAt: expiresAt.toISOString() };
}
