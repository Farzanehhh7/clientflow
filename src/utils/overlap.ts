import type { Appointment } from '../types';

/** True if two time ranges overlap (touching edges do not count). */
export function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return new Date(aStart) < new Date(bEnd) && new Date(bStart) < new Date(aEnd);
}

/** Checks whether a new appointment collides with an existing one for the same resource. */
export function hasConflict(
  existing: Appointment[],
  candidate: Pick<Appointment, 'resourceId' | 'start' | 'end'> & { id?: string },
): boolean {
  return existing.some(
    (a) =>
      a.id !== candidate.id &&
      a.resourceId === candidate.resourceId &&
      a.status !== 'cancelled' &&
      rangesOverlap(a.start, a.end, candidate.start, candidate.end),
  );
}

/** Iranian mobile validation: 09xxxxxxxxx */
export const isValidIranMobile = (v: string) => /^09\d{9}$/.test(v);
