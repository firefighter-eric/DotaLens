import { describe, expect, it } from 'vitest';
import {
  differenceInLocalCalendarDays,
  toLocalCalendarDayOrdinal,
  toValidUnixDate,
} from './date.js';

describe('local calendar date helpers', () => {
  it('uses calendar dates instead of elapsed 24-hour buckets across DST', () => {
    const previousDay = new Date('2026-03-08T00:30:00-05:00');
    const nextDay = new Date('2026-03-09T00:30:00-04:00');

    expect(nextDay.getTime() - previousDay.getTime()).toBe(23 * 60 * 60 * 1000);
    expect(differenceInLocalCalendarDays(nextDay, previousDay)).toBe(1);
  });

  it('returns null for invalid dates', () => {
    expect(toLocalCalendarDayOrdinal(new Date('invalid'))).toBeNull();
    expect(
      differenceInLocalCalendarDays(new Date(), new Date('invalid'))
    ).toBeNull();
  });

  it('rejects malformed and out-of-range Unix timestamps', () => {
    expect(toValidUnixDate('broken')).toBeNull();
    expect(toValidUnixDate(0)).toBeNull();
    expect(toValidUnixDate(Number.MAX_VALUE)).toBeNull();
    expect(toValidUnixDate('1710000000')?.getTime()).toBe(1710000000 * 1000);
  });
});
