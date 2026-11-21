import { describe, expect, it } from 'vitest';
import type { KbArticle, OfficialHoliday, SlaPolicy, Ticket } from '../types';
import {
  computeBusinessMinutesBetween,
  evaluateTicketSla,
  suggestKbArticlesForTicket,
} from '../utils/slaEngine';

describe('SLA Engine & KB Suggestion', () => {
  const settings = {
    workStartHour: 9,
    workEndHour: 17,
    workDays: [6, 0, 1, 2, 3, 4], // Sat..Thu (Friday off: day 5)
  };

  const policies: Record<Ticket['priority'], SlaPolicy> = {
    high: { priority: 'high', firstResponseMin: 30, resolutionMin: 240, warnPct: 75 },
    normal: { priority: 'normal', firstResponseMin: 120, resolutionMin: 480, warnPct: 75 },
    low: { priority: 'low', firstResponseMin: 240, resolutionMin: 960, warnPct: 80 },
  };

  it('computes business minutes honoring working hours, Fridays, and holidays', () => {
    // Thursday May 14, 2026: 16:00 local to Saturday May 16, 2026: 10:00 local
    // Note: construct local Date objects explicitly to avoid timezone offset ambiguity
    const thu16 = new Date(2026, 4, 14, 16, 0, 0).toISOString();
    const sat10 = new Date(2026, 4, 16, 10, 0, 0).toISOString();
    // Thu 16:00..17:00 = 60m; Fri = 0m (day 5 off); Sat 09:00..10:00 = 60m -> total 120m
    expect(
      computeBusinessMinutesBetween(thu16, sat10, settings.workStartHour, settings.workEndHour, settings.workDays, []),
    ).toBe(120);

    // If Saturday May 16 is an official holiday -> only 60m from Thursday
    const holidays: OfficialHoliday[] = [{ id: 'h1', dateKey: '2026-05-16', jalaliDate: '1405/02/26', title: 'تعطیل' }];
    expect(
      computeBusinessMinutesBetween(
        thu16,
        sat10,
        settings.workStartHour,
        settings.workEndHour,
        settings.workDays,
        holidays,
      ),
    ).toBe(60);
  });

  it('flags ok, warning, breached, and met SLA states accurately', () => {
    const start = new Date(2026, 4, 10, 10, 0, 0); // Sunday (work day)
    const ticketBase: Ticket = {
      id: 'tk1',
      customerId: 'c1',
      subject: 'خطا در پرداخت آنلاین',
      channel: 'portal',
      priority: 'high',
      status: 'open',
      createdAt: start.toISOString(),
    };

    // 10 mins later -> ok (target 30m)
    const okEval = evaluateTicketSla(ticketBase, policies, settings, [], start.getTime() + 10 * 60_000);
    expect(okEval.firstRespState).toBe('ok');
    expect(okEval.overallState).toBe('ok');

    // 25 mins later -> 83% >= 75% warnPct -> warning
    const warnEval = evaluateTicketSla(ticketBase, policies, settings, [], start.getTime() + 25 * 60_000);
    expect(warnEval.firstRespState).toBe('warning');
    expect(warnEval.overallState).toBe('warning');

    // 45 mins later -> breached firstResponse
    const breachEval = evaluateTicketSla(ticketBase, policies, settings, [], start.getTime() + 45 * 60_000);
    expect(breachEval.firstRespState).toBe('breached');
    expect(breachEval.overallState).toBe('breached');

    // Resolved within SLA -> met
    const resolvedTicket: Ticket = {
      ...ticketBase,
      status: 'resolved',
      firstRespondedAt: new Date(start.getTime() + 15 * 60_000).toISOString(),
      resolvedAt: new Date(start.getTime() + 120 * 60_000).toISOString(),
    };
    const metEval = evaluateTicketSla(resolvedTicket, policies, settings, [], start.getTime() + 500 * 60_000);
    expect(metEval.overallState).toBe('met');
  });

  it('suggests relevant knowledge base articles for a ticket', () => {
    const ticket: Ticket = {
      id: 'tk2',
      customerId: 'c1',
      subject: 'عدم بازگشت وجه در درگاه بانکی',
      category: 'مالی',
      channel: 'portal',
      priority: 'high',
      status: 'open',
      createdAt: new Date().toISOString(),
    };

    const articles: KbArticle[] = [
      {
        id: 'kb1',
        title: 'راهنمای تغییر رمز عبور',
        category: 'حساب کاربری',
        body: 'برای تغییر رمز وارد تنظیمات شوید.',
        visibility: 'public',
        version: 1,
        helpfulCount: 15,
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'kb2',
        title: 'پیگیری تراکنش ناموفق درگاه بانکی و بازگشت وجه',
        category: 'مالی و پرداخت',
        body: 'در صورت کسر وجه در درگاه بانکی، ظرف ۷۲ ساعت بازگشت می‌خورد.',
        visibility: 'public',
        version: 2,
        helpfulCount: 30,
        updatedAt: new Date().toISOString(),
      },
    ];

    const suggested = suggestKbArticlesForTicket(ticket, articles);
    expect(suggested[0]?.id).toBe('kb2');
  });
});
