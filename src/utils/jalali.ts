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

export { toFa };
