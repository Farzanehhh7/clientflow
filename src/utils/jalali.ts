import dayjs from 'dayjs';
import jalaliday from 'jalaliday';

dayjs.extend(jalaliday);

const toFa = (s: string | number) => String(s).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);

/** Format an ISO date as a Jalali date with Persian digits, e.g. ۱۴۰۵/۰۸/۲۷ */
export function formatJalali(iso: string, pattern = 'YYYY/MM/DD'): string {
  return toFa(dayjs(iso).calendar('jalali').locale('fa').format(pattern));
}

export function formatJalaliDateTime(iso: string): string {
  return formatJalali(iso, 'YYYY/MM/DD HH:mm');
}

export function formatTimeFa(iso: string): string {
  return toFa(dayjs(iso).format('HH:mm'));
}

export function formatToman(amount: number): string {
  const formatted = Math.round(amount).toLocaleString('en-US');
  return `${toFa(formatted)} تومان`;
}

export function isSameDay(aIso: string, bIso: string): boolean {
  return dayjs(aIso).format('YYYY-MM-DD') === dayjs(bIso).format('YYYY-MM-DD');
}

export const PERSIAN_WEEKDAYS = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه', 'شنبه'];
export const JALALI_MONTHS = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
];

export interface JalaliDayInfo {
  dateKey: string; // YYYY-MM-DD (Gregorian local for easy matching)
  isoStart: string;
  dayIndex: number; // 0=Sun..6=Sat
  weekdayName: string;
  jalaliDayLabel: string; // e.g. ۲۶ آبان
  jalaliFull: string;
  isToday: boolean;
}

/** Returns 7 days of a Persian week (Saturday -> Friday) relative to today + weekOffset */
export function getJalaliWeekDays(weekOffset = 0): JalaliDayInfo[] {
  const now = dayjs();
  // In JS: 0=Sun, 1=Mon, ..., 6=Sat. Persian week starts on Saturday (6).
  const dayOfWeek = now.day();
  const daysSinceSaturday = (dayOfWeek + 1) % 7;
  const saturday = now.subtract(daysSinceSaturday, 'day').add(weekOffset * 7, 'day').startOf('day');
  const todayKey = now.format('YYYY-MM-DD');

  return Array.from({ length: 7 }, (_, i) => {
    const d = saturday.add(i, 'day');
    const j = d.calendar('jalali');
    const monthIdx = j.month(); // 0..11
    const dayNum = j.date();
    const yearNum = j.year();
    const weekdayName = PERSIAN_WEEKDAYS[d.day()];
    return {
      dateKey: d.format('YYYY-MM-DD'),
      isoStart: d.toISOString(),
      dayIndex: d.day(),
      weekdayName,
      jalaliDayLabel: `${toFa(dayNum)} ${JALALI_MONTHS[monthIdx] ?? ''}`,
      jalaliFull: `${toFa(yearNum)}/${toFa(String(monthIdx + 1).padStart(2, '0'))}/${toFa(String(dayNum).padStart(2, '0'))}`,
      isToday: d.format('YYYY-MM-DD') === todayKey,
    };
  });
}

export function getJalaliWeekRangeLabel(days: JalaliDayInfo[]): string {
  if (days.length === 0) return '';
  const first = days[0];
  const last = days[days.length - 1];
  const year = last.jalaliFull.slice(0, 4);
  return `${first.jalaliDayLabel} تا ${last.jalaliDayLabel} ${year}`;
}

export interface JalaliMonthCell {
  dateKey: string;
  jalaliDay: number;
  jalaliFull: string;
  dayIndex: number;
  isCurrentMonth: boolean;
  isToday: boolean;
}

/** Returns a full Jalali month grid (Saturday -> Friday columns) for monthOffset relative to current month */
export function getJalaliMonthGrid(monthOffset = 0): {
  title: string;
  year: number;
  month: number; // 0..11
  cells: JalaliMonthCell[];
} {
  let cursor = dayjs().startOf('day');
  while (cursor.calendar('jalali').date() > 1) {
    cursor = cursor.subtract(1, 'day');
  }

  if (monthOffset > 0) {
    for (let m = 0; m < monthOffset; m++) {
      cursor = cursor.add(32, 'day');
      while (cursor.calendar('jalali').date() > 1) {
        cursor = cursor.subtract(1, 'day');
      }
    }
  } else if (monthOffset < 0) {
    for (let m = 0; m < Math.abs(monthOffset); m++) {
      cursor = cursor.subtract(1, 'day');
      while (cursor.calendar('jalali').date() > 1) {
        cursor = cursor.subtract(1, 'day');
      }
    }
  }

  const targetJ = cursor.calendar('jalali');
  const targetYear = targetJ.year();
  const targetMonth = targetJ.month(); // 0..11

  const leadingDays = (cursor.day() + 1) % 7;
  const gridStart = cursor.subtract(leadingDays, 'day');
  const todayKey = dayjs().format('YYYY-MM-DD');

  const allCells: JalaliMonthCell[] = Array.from({ length: 42 }, (_, i) => {
    const d = gridStart.add(i, 'day');
    const j = d.calendar('jalali');
    const jYear = j.year();
    const jMonth = j.month();
    const jDay = j.date();
    return {
      dateKey: d.format('YYYY-MM-DD'),
      jalaliDay: jDay,
      jalaliFull: `${toFa(jYear)}/${toFa(String(jMonth + 1).padStart(2, '0'))}/${toFa(String(jDay).padStart(2, '0'))}`,
      dayIndex: d.day(),
      isCurrentMonth: jYear === targetYear && jMonth === targetMonth,
      isToday: d.format('YYYY-MM-DD') === todayKey,
    };
  });

  // Trim 6th row if completely outside the target Jalali month
  const sixthRowHasCurrent = allCells.slice(35).some((c) => c.isCurrentMonth);
  const cells = sixthRowHasCurrent ? allCells : allCells.slice(0, 35);

  return {
    title: `${JALALI_MONTHS[targetMonth] ?? ''} ${toFa(targetYear)}`,
    year: targetYear,
    month: targetMonth,
    cells,
  };
}

export function getTodayJalaliAscii(): string {
  const j = dayjs().calendar('jalali');
  return `${j.year()}/${String(j.month() + 1).padStart(2, '0')}/${String(j.date()).padStart(2, '0')}`;
}

export function isoToJalaliInput(iso?: string): string {
  if (!iso) return '';
  const d = dayjs(iso);
  if (!d.isValid()) return '';
  const j = d.calendar('jalali');
  return `${j.year()}/${String(j.month() + 1).padStart(2, '0')}/${String(j.date()).padStart(2, '0')}`;
}

/** Convert a Jalali date string like 1405/08/28 to an ISO UTC string (noon local to avoid timezone shift) */
export function jalaliToIsoUtc(jalaliStr: string): string | null {
  const ascii = jalaliStr.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).trim();
  const match = ascii.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (!match) return null;
  const jy = Number(match[1]);
  const jm = Number(match[2]);
  const jd = Number(match[3]);
  if (jm < 1 || jm > 12 || jd < 1 || jd > 31) return null;
  // Convert Jalali to Gregorian via iterative search around approximate year
  const approxGregYear = jy + 621;
  let cursor = dayjs(`${approxGregYear}-03-20`).startOf('day');
  // Adjust up/down quickly
  for (let i = 0; i < 420; i++) {
    const j = cursor.calendar('jalali');
    if (j.year() === jy && j.month() + 1 === jm && j.date() === jd) {
      return cursor.hour(12).minute(0).second(0).millisecond(0).toISOString();
    }
    const diffDays = (jy - j.year()) * 365 + (jm - (j.month() + 1)) * 30 + (jd - j.date());
    if (Math.abs(diffDays) > 2) {
      cursor = cursor.add(diffDays > 0 ? Math.max(1, Math.floor(diffDays / 2)) : Math.min(-1, Math.ceil(diffDays / 2)), 'day');
    } else {
      cursor = cursor.add(diffDays >= 0 ? 1 : -1, 'day');
    }
  }
  return null;
}

/** Build a calendar grid for an explicit Jalali year & month (0..11) */
export function getJalaliMonthGridByYearMonth(targetYear: number, targetMonth: number): {
  title: string;
  year: number;
  month: number;
  cells: JalaliMonthCell[];
} {
  const firstDayIso = jalaliToIsoUtc(`${targetYear}/${String(targetMonth + 1).padStart(2, '0')}/01`);
  const cursor = firstDayIso ? dayjs(firstDayIso).startOf('day') : dayjs().startOf('day');
  const leadingDays = (cursor.day() + 1) % 7;
  const gridStart = cursor.subtract(leadingDays, 'day');
  const todayKey = dayjs().format('YYYY-MM-DD');

  const allCells: JalaliMonthCell[] = Array.from({ length: 42 }, (_, i) => {
    const d = gridStart.add(i, 'day');
    const j = d.calendar('jalali');
    const jYear = j.year();
    const jMonth = j.month();
    const jDay = j.date();
    return {
      dateKey: d.format('YYYY-MM-DD'),
      jalaliDay: jDay,
      jalaliFull: `${toFa(jYear)}/${toFa(String(jMonth + 1).padStart(2, '0'))}/${toFa(String(jDay).padStart(2, '0'))}`,
      dayIndex: d.day(),
      isCurrentMonth: jYear === targetYear && jMonth === targetMonth,
      isToday: d.format('YYYY-MM-DD') === todayKey,
    };
  });

  const sixthRowHasCurrent = allCells.slice(35).some((c) => c.isCurrentMonth);
  const cells = sixthRowHasCurrent ? allCells : allCells.slice(0, 35);
  return {
    title: `${JALALI_MONTHS[targetMonth] ?? ''} ${toFa(targetYear)}`,
    year: targetYear,
    month: targetMonth,
    cells,
  };
}

export type JalaliDatePreset =
  | 'today'
  | 'this_week'
  | 'this_month'
  | 'shamsi_year'
  | 'last_30_days'
  | 'all';

export function getJalaliDateRangePreset(preset: JalaliDatePreset): {
  fromJalali: string;
  toJalali: string;
  label: string;
} {
  const now = dayjs().startOf('day');
  const todayJ = getTodayJalaliAscii();
  const jNow = now.calendar('jalali');

  if (preset === 'today') {
    return { fromJalali: todayJ, toJalali: todayJ, label: 'امروز' };
  }
  if (preset === 'this_week') {
    const daysSinceSaturday = (now.day() + 1) % 7;
    const sat = now.subtract(daysSinceSaturday, 'day');
    const jSat = sat.calendar('jalali');
    return {
      fromJalali: `${jSat.year()}/${String(jSat.month() + 1).padStart(2, '0')}/${String(jSat.date()).padStart(2, '0')}`,
      toJalali: todayJ,
      label: 'هفته جاری',
    };
  }
  if (preset === 'this_month') {
    return {
      fromJalali: `${jNow.year()}/${String(jNow.month() + 1).padStart(2, '0')}/01`,
      toJalali: todayJ,
      label: 'ماه شمسی جاری',
    };
  }
  if (preset === 'shamsi_year') {
    return {
      fromJalali: `${jNow.year()}/01/01`,
      toJalali: todayJ,
      label: 'سال شمسی جاری',
    };
  }
  if (preset === 'last_30_days') {
    const past = now.subtract(29, 'day');
    const jPast = past.calendar('jalali');
    return {
      fromJalali: `${jPast.year()}/${String(jPast.month() + 1).padStart(2, '0')}/${String(jPast.date()).padStart(2, '0')}`,
      toJalali: todayJ,
      label: '۳۰ روز اخیر',
    };
  }
  return { fromJalali: '', toJalali: '', label: 'کل بازه زمانی' };
}

export function isIsoInJalaliRange(
  iso: string | undefined,
  fromJalali?: string,
  toJalali?: string,
): boolean {
  if (!fromJalali && !toJalali) return true;
  if (!iso) return false;
  const targetMs = dayjs(iso).valueOf();
  if (!Number.isFinite(targetMs)) return false;

  if (fromJalali) {
    const fromIso = jalaliToIsoUtc(fromJalali);
    if (fromIso) {
      const startMs = dayjs(fromIso).startOf('day').valueOf();
      if (targetMs < startMs) return false;
    }
  }
  if (toJalali) {
    const toIso = jalaliToIsoUtc(toJalali);
    if (toIso) {
      const endMs = dayjs(toIso).endOf('day').valueOf();
      if (targetMs > endMs) return false;
    }
  }
  return true;
}

export { toFa };

