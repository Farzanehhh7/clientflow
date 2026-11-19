import dayjs from 'dayjs';
import type { Appointment, OfficialHoliday, ResourceTimeOff, Service } from '../types';

/** True if two time ranges overlap (touching edges do not count). */
export function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return new Date(aStart) < new Date(bEnd) && new Date(bStart) < new Date(aEnd);
}

/** Expand an interval by service bufferBeforeMin / bufferAfterMin */
function expandWithBuffers(
  startIso: string,
  endIso: string,
  service?: Service,
): { start: string; end: string } {
  const before = service?.bufferBeforeMin ?? 0;
  const after = service?.bufferAfterMin ?? 0;
  if (before === 0 && after === 0) return { start: startIso, end: endIso };
  const s = new Date(new Date(startIso).getTime() - before * 60_000).toISOString();
  const e = new Date(new Date(endIso).getTime() + after * 60_000).toISOString();
  return { start: s, end: e };
}

/** Checks whether a new appointment collides with an existing one for the same resource, including optional service buffers. */
export function hasConflict(
  existing: Appointment[],
  candidate: Pick<Appointment, 'resourceId' | 'start' | 'end'> & { id?: string; serviceId?: string },
  services: Service[] = [],
): boolean {
  const candSrv = candidate.serviceId ? services.find((s) => s.id === candidate.serviceId) : undefined;
  const candRange = expandWithBuffers(candidate.start, candidate.end, candSrv);

  return existing.some((a) => {
    if (a.id === candidate.id || a.resourceId !== candidate.resourceId || a.status === 'cancelled') {
      return false;
    }
    const existingSrv = services.find((s) => s.id === a.serviceId);
    const existingRange = expandWithBuffers(a.start, a.end, existingSrv);
    return rangesOverlap(existingRange.start, existingRange.end, candRange.start, candRange.end);
  });
}

/** Checks if a dateKey (YYYY-MM-DD) is blocked by an official holiday or resource time-off */
export function isHolidayOrTimeOff(
  dateKey: string,
  resourceId: string,
  holidays: OfficialHoliday[] = [],
  timeOffs: ResourceTimeOff[] = [],
): { blocked: boolean; reason?: string } {
  const holiday = holidays.find((h) => h.dateKey === dateKey);
  if (holiday) {
    return { blocked: true, reason: `تعطیل رسمی: ${holiday.title}` };
  }
  const off = timeOffs.find(
    (t) => t.resourceId === resourceId && dateKey >= t.startDateKey && dateKey <= t.endDateKey,
  );
  if (off) {
    return { blocked: true, reason: `مرخصی/عدم حضور منبع: ${off.reason}` };
  }
  return { blocked: false };
}

export function getDateKeyFromIso(iso: string): string {
  return dayjs(iso).format('YYYY-MM-DD');
}

import { isValidIranMobile, isValidIranNationalId, isValidIranPostalCode } from './validators';

/** Iranian mobile validation: 09xxxxxxxxx */
export { isValidIranMobile, isValidIranPostalCode };

/** Iranian national ID validation: 10 digits with Mod-11 checksum */
export const isValidNationalId = (v: string) => isValidIranNationalId(v);
