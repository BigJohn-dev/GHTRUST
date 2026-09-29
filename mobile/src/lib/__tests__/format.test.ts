import { describe, expect, it } from '@jest/globals';
import { date, dateTime, daysUntil, digits, groupThousands, humanize, naira, nairaShort, relativeDue } from '../format';

const isoDay = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

describe('naira', () => {
  it('formats API decimal strings without floating-point noise', () => {
    expect(naira('150000.00')).toBe('₦150,000');
    expect(naira('123333.33')).toBe('₦123,333.33');
    expect(naira(0.1 + 0.2)).toBe('₦0.30');
  });
  it('shows kobo only when asked or needed', () => {
    expect(naira(5000, { kobo: true })).toBe('₦5,000.00');
    expect(naira(5000.5)).toBe('₦5,000.50');
  });
  it('never shows NaN or undefined', () => {
    for (const bad of [null, undefined, '', 'abc']) expect(naira(bad)).toBe('—');
  });
});

describe('nairaShort', () => {
  it('abbreviates large amounts', () => {
    expect(nairaShort(1_500_000)).toBe('₦1.5m');
    expect(nairaShort(2_000_000)).toBe('₦2m');
    expect(nairaShort(850_400)).toBe('₦850k');
    expect(nairaShort(900)).toBe('₦900');
  });
});

describe('dates', () => {
  it('reads YYYY-MM-DD as a calendar day, not UTC midnight', () => {
    expect(date('2026-03-01')).toBe('1 Mar 2026');
    expect(date(null)).toBe('—');
    expect(date('not a date')).toBe('—');
  });
  it('formats a timestamp with a 12-hour time', () => {
    expect(dateTime('2026-09-29T21:05:00')).toBe('29 Sep 2026, 9:05 pm');
  });
  it('counts whole days to a due date', () => {
    expect(daysUntil(isoDay(0))).toBe(0);
    expect(daysUntil(isoDay(6))).toBe(6);
    expect(daysUntil(isoDay(-2))).toBe(-2);
  });
  it('describes due dates the way customers say them', () => {
    expect(relativeDue(isoDay(0))).toBe('Due today');
    expect(relativeDue(isoDay(1))).toBe('Due tomorrow');
    expect(relativeDue(isoDay(5))).toBe('Due in 5 days');
    expect(relativeDue(isoDay(-1))).toBe('1 day overdue');
    expect(relativeDue(isoDay(-4))).toBe('4 days overdue');
  });
});

describe('inputs', () => {
  it('keeps digits only', () => {
    expect(digits('0803 579-4364')).toBe('08035794364');
  });
  it('groups thousands while typing and drops leading zeros', () => {
    expect(groupThousands('1234567')).toBe('1,234,567');
    expect(groupThousands('000500')).toBe('500');
    expect(groupThousands('')).toBe('');
  });
  it('humanizes enum values', () => {
    expect(humanize('pending_otp')).toBe('Pending otp');
    expect(humanize(null)).toBe('');
  });
});
