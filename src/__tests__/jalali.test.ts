import { describe, expect, it } from 'vitest';
import {
  formatJalali,
  formatToman,
  getJalaliDateRangePreset,
  getJalaliWeekDays,
  isIsoInJalaliRange,
  isoToJalaliInput,
  jalaliToIsoUtc,
  toFa,
} from '../utils/jalali';

describe('Jalali Calendar & Formatting Helpers', () => {
  it('converts digits and formats Toman currency cleanly', () => {
    expect(toFa('1405/08/27')).toBe('۱۴۰۵/۰۸/۲۷');
    expect(formatToman(1_250_000)).toBe('۱,۲۵۰,۰۰۰ تومان');
  });

  it('round-trips Jalali date string <-> ISO UTC accurately', () => {
    const iso = jalaliToIsoUtc('1404/01/01');
    expect(iso).not.toBeNull();
    // Astronomical Jalali (jalaliday) 1404/01/01 maps to 2025-03-20
    expect(iso!.startsWith('2025-03-20')).toBe(true);
    expect(isoToJalaliInput(iso!)).toBe('1404/01/01');
    expect(formatJalali(iso!)).toBe('۱۴۰۴/۰۱/۰۱');

    // Invalid Jalali date fails cleanly
    expect(jalaliToIsoUtc('not-a-date')).toBeNull();
    expect(jalaliToIsoUtc('1404/13/01')).toBeNull();
  });

  it('builds a 7-day Persian week starting on Saturday and evaluates presets/ranges', () => {
    const days = getJalaliWeekDays(0);
    expect(days).toHaveLength(7);
    expect(days[0].weekdayName).toBe('شنبه');
    expect(days[6].weekdayName).toBe('جمعه');

    const monthPreset = getJalaliDateRangePreset('this_month');
    expect(monthPreset.fromJalali.endsWith('/01')).toBe(true);

    const yearPreset = getJalaliDateRangePreset('shamsi_year');
    expect(yearPreset.fromJalali.endsWith('/01/01')).toBe(true);

    expect(isIsoInJalaliRange('2025-06-15T10:00:00Z', '1404/01/01', '1404/12/29')).toBe(true);
    expect(isIsoInJalaliRange('2024-01-15T10:00:00Z', '1404/01/01', '1404/12/29')).toBe(false);
  });
});
