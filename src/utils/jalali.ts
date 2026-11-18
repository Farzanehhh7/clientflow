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

const PERSIAN_WEEKDAYS = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه', 'شنبه'];
const JALALI_MONTHS = [
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
  dateKey: string; // YYYY-MM-DD (Gregorian for easy matching)
  isoStart: string;
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
      weekdayName,
      jalaliDayLabel: `${toFa(dayNum)} ${JALALI_MONTHS[monthIdx] ?? ''}`,
      jalaliFull: `${toFa(yearNum)}/${toFa(String(monthIdx + 1).padStart(2, '0'))}/${toFa(String(dayNum).padStart(2, '0'))}`,
      isToday: d.format('YYYY-MM-DD') === todayKey,
    };
  });
}

export { toFa };
