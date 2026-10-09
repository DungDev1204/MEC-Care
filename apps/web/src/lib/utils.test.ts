import { describe, expect, it } from 'vitest';
import { age, initials, localDateTime, normalize, safeReturn, formatTime, loginDestination } from './utils';
describe('Vietnamese customer and reminder behavior', () => {
  it('finds accented names without accents', () => { expect(normalize('Đặng Thị Ánh')).toBe('dang thi anh'); });
  it('computes age across the birthday boundary', () => { expect(age('1990-10-07', '2026-10-06')).toBe(35); expect(age('1990-10-07', '2026-10-07')).toBe(36); expect(age(null)).toBeNull(); });
  it('uses Vietnam time even on devices in another timezone', () => { expect(localDateTime(new Date('2026-10-06T20:30:00Z'))).toBe('2026-10-07T03:30'); expect(formatTime('2026-10-07T09:00')).toContain('09:00'); });
  it('keeps initials meaningful in the labeled review data', () => { expect(initials('Nguyễn Minh Anh · Mẫu')).toBe('MA'); });
  it('restores notification deep links without allowing external redirects', () => { expect(safeReturn('/customers/123?tab=reminders')).toBe('/customers/123?tab=reminders'); expect(safeReturn('//attacker.invalid')).toBe('/'); expect(safeReturn('https://attacker.invalid')).toBe('/'); expect(safeReturn('/login')).toBe('/'); });
  it('returns to admin while preventing auth loops and browser-normalized external paths', () => { expect(safeReturn('/admin')).toBe('/admin'); expect(safeReturn('/register')).toBe('/'); expect(safeReturn('/\\attacker.invalid')).toBe('/'); expect(safeReturn('/\n/attacker.invalid')).toBe('/'); });
  it('sends accounts without access to the plan page even when login has a saved return path', () => {
    const pending = { isAdmin: false, canUseApp: false };
    for (const target of [null, '/', '/orders', '/admin?tab=orders', '/customers/123']) expect(loginDestination(pending, target)).toBe('/subscription');
    expect(loginDestination({ isAdmin: false, canUseApp: true }, '/orders')).toBe('/orders');
    expect(loginDestination({ isAdmin: false, canUseApp: true }, null)).toBe('/');
    expect(loginDestination({ isAdmin: true, canUseApp: true }, null)).toBe('/admin');
    expect(loginDestination({ isAdmin: true, canUseApp: true }, '/admin?tab=orders&order=DHREVIEW')).toBe('/admin?tab=orders&order=DHREVIEW');
    expect(loginDestination({ isAdmin: false, canUseApp: true }, '//attacker.invalid')).toBe('/');
  });
});
