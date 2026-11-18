import dayjs from 'dayjs';
import jalaliday from 'jalaliday';

dayjs.extend(jalaliday);

const toFa = (s: string) => s.replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);

/** Format an ISO date as a Jalali date with Persian digits, e.g. ۱۴۰۵/۰۸/۲۷ */
export function formatJalali(iso: string, pattern = 'YYYY/MM/DD'): string {
  return toFa(dayjs(iso).calendar('jalali').locale('fa').format(pattern));
}

export function formatJalaliDateTime(iso: string): string {
  return formatJalali(iso, 'YYYY/MM/DD HH:mm');
}

export { toFa };
