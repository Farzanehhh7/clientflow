import { describe, expect, it } from 'vitest';
import type { Appointment, OfficialHoliday, ResourceTimeOff, Service } from '../types';
import { hasConflict, isHolidayOrTimeOff, rangesOverlap } from '../utils/overlap';

describe('Overlap & Schedule Conflict Detection', () => {
  it('detects overlapping intervals and ignores touching edges', () => {
    expect(
      rangesOverlap(
        '2026-05-10T10:00:00.000Z',
        '2026-05-10T11:00:00.000Z',
        '2026-05-10T10:30:00.000Z',
        '2026-05-10T11:30:00.000Z',
      ),
    ).toBe(true);

    // Touching edges [10:00..11:00] and [11:00..12:00] should NOT overlap
    expect(
      rangesOverlap(
        '2026-05-10T10:00:00.000Z',
        '2026-05-10T11:00:00.000Z',
        '2026-05-10T11:00:00.000Z',
        '2026-05-10T12:00:00.000Z',
      ),
    ).toBe(false);
  });

  it('detects conflicts on same resource, ignores cancelled, and enforces service buffers', () => {
    const services: Service[] = [
      { id: 'srv1', name: 'پاکسازی', durationMin: 60, price: 800_000, bufferBeforeMin: 10, bufferAfterMin: 15 },
      { id: 'srv2', name: 'مشاوره', durationMin: 30, price: 300_000 },
    ];

    const existing: Appointment[] = [
      {
        id: 'apt1',
        customerId: 'c1',
        serviceId: 'srv1',
        resourceId: 'res1',
        start: '2026-05-10T10:00:00.000Z',
        end: '2026-05-10T11:00:00.000Z',
        status: 'confirmed',
      },
      {
        id: 'apt_cancelled',
        customerId: 'c2',
        serviceId: 'srv2',
        resourceId: 'res1',
        start: '2026-05-10T14:00:00.000Z',
        end: '2026-05-10T14:30:00.000Z',
        status: 'cancelled',
      },
    ];

    // Inside bufferAfterMin (11:00 + 15m = 11:15) -> conflict!
    expect(
      hasConflict(
        existing,
        {
          resourceId: 'res1',
          serviceId: 'srv2',
          start: '2026-05-10T11:10:00.000Z',
          end: '2026-05-10T11:40:00.000Z',
        },
        services,
      ),
    ).toBe(true);

    // After bufferAfterMin (11:15) -> no conflict
    expect(
      hasConflict(
        existing,
        {
          resourceId: 'res1',
          serviceId: 'srv2',
          start: '2026-05-10T11:15:00.000Z',
          end: '2026-05-10T11:45:00.000Z',
        },
        services,
      ),
    ).toBe(false);

    // Different resource -> no conflict
    expect(
      hasConflict(
        existing,
        {
          resourceId: 'res2',
          serviceId: 'srv1',
          start: '2026-05-10T10:00:00.000Z',
          end: '2026-05-10T11:00:00.000Z',
        },
        services,
      ),
    ).toBe(false);

    // Cancelled slot -> available
    expect(
      hasConflict(
        existing,
        {
          resourceId: 'res1',
          serviceId: 'srv2',
          start: '2026-05-10T14:00:00.000Z',
          end: '2026-05-10T14:30:00.000Z',
        },
        services,
      ),
    ).toBe(false);

    // Editing same appointment ID should not self-conflict
    expect(
      hasConflict(
        existing,
        {
          id: 'apt1',
          resourceId: 'res1',
          serviceId: 'srv1',
          start: '2026-05-10T10:05:00.000Z',
          end: '2026-05-10T11:05:00.000Z',
        },
        services,
      ),
    ).toBe(false);
  });

  it('blocks official holidays and resource time-off ranges', () => {
    const holidays: OfficialHoliday[] = [{ id: 'h1', dateKey: '2026-05-20', jalaliDate: '1405/02/30', title: 'تعطیل رسمی' }];
    const timeOffs: ResourceTimeOff[] = [
      {
        id: 'off1',
        resourceId: 'res1',
        startDateKey: '2026-05-12',
        endDateKey: '2026-05-14',
        reason: 'مرخصی سالانه',
      },
    ];

    const hCheck = isHolidayOrTimeOff('2026-05-20', 'res2', holidays, timeOffs);
    expect(hCheck.blocked).toBe(true);
    expect(hCheck.reason).toContain('تعطیل رسمی');

    const offCheck = isHolidayOrTimeOff('2026-05-13', 'res1', holidays, timeOffs);
    expect(offCheck.blocked).toBe(true);
    expect(offCheck.reason).toContain('مرخصی');

    expect(isHolidayOrTimeOff('2026-05-13', 'res2', holidays, timeOffs).blocked).toBe(false);
  });
});
