import { DateTime } from 'luxon';
import type { Row } from './db.js';

export const subscriptionZone = 'Asia/Ho_Chi_Minh';
export function renewalAllowed(user: Row, now = DateTime.utc()) {
  if (user.isAdmin) return false;
  if (user.accessGranted === false) return true;
  if (!user.activeUntil) return false; // Legacy unlimited accounts need no paid renewal.
  return now.toMillis() >= DateTime.fromISO(user.activeUntil).setZone(subscriptionZone).startOf('day').toMillis();
}
export function subscriptionExpiry(activeUntil: string | null, months: number, now = DateTime.utc()) {
  const current = activeUntil ? DateTime.fromISO(activeUntil) : null;
  const base = current && current.toMillis() > now.toMillis() ? current : now;
  return base.setZone(subscriptionZone).startOf('day').plus({ months }).endOf('day').toUTC().toISO()!;
}
