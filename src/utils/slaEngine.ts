import dayjs from 'dayjs';
import type {
  BusinessSettings,
  KbArticle,
  OfficialHoliday,
  SlaPolicy,
  Ticket,
  TicketStatus,
} from '../types';
import { toFa } from './jalali';
import { fuzzyMatchPersian, normalizePersian } from './persianSearch';

export type SlaHealthState = 'met' | 'ok' | 'warning' | 'breached';

export type TicketSlaEvaluation = {
  firstRespElapsedMin: number;
  firstRespTargetMin: number;
  firstRespRemainingMin: number;
  firstRespPct: number;
  firstRespState: SlaHealthState;
  resolutionElapsedMin: number;
  resolutionTargetMin: number;
  resolutionRemainingMin: number;
  resolutionPct: number;
  resolutionState: SlaHealthState;
  overallState: SlaHealthState;
};

export function isTicketClosedStatus(status: TicketStatus): boolean {
  return status === 'resolved' || status === 'closed';
}

/**
 * Computes business minutes elapsed between startIso and endIso (or nowMs),
 * honoring workStartHour..workEndHour, settings.workDays, and officialHolidays (YYYY-MM-DD).
 */
export function computeBusinessMinutesBetween(
  startIso: string,
  endIsoOrMs: string | number,
  workStartHour: number,
  workEndHour: number,
  workDays: number[],
  holidays: OfficialHoliday[] = [],
): number {
  const startMs = new Date(startIso).getTime();
  const endMs = typeof endIsoOrMs === 'number' ? endIsoOrMs : new Date(endIsoOrMs).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return 0;

  const safeStartH = Math.max(0, Math.min(23, workStartHour));
  const safeEndH = Math.max(safeStartH + 1, Math.min(24, workEndHour));
  const activeDays = new Set(workDays.length > 0 ? workDays : [6, 0, 1, 2, 3, 4]);
  const holidayKeys = new Set(holidays.map((h) => h.dateKey));

  // Clamp evaluation span to max 90 days so long-stale tickets compute in <1ms
  const maxSpanMs = 90 * 86_400_000;
  const effectiveStartMs = endMs - startMs > maxSpanMs ? endMs - maxSpanMs : startMs;

  let totalMin = 0;
  let cursorDay = dayjs(effectiveStartMs).startOf('day');
  const lastDay = dayjs(endMs).startOf('day');

  while (cursorDay.valueOf() <= lastDay.valueOf()) {
    const dayIdx = cursorDay.day();
    const dateKey = cursorDay.format('YYYY-MM-DD');

    if (activeDays.has(dayIdx) && !holidayKeys.has(dateKey)) {
      const workOpenMs = cursorDay.hour(safeStartH).minute(0).second(0).millisecond(0).valueOf();
      const workCloseMs =
        safeEndH >= 24
          ? cursorDay.add(1, 'day').startOf('day').valueOf()
          : cursorDay.hour(safeEndH).minute(0).second(0).millisecond(0).valueOf();

      const segStart = Math.max(effectiveStartMs, workOpenMs);
      const segEnd = Math.min(endMs, workCloseMs);
      if (segEnd > segStart) {
        totalMin += (segEnd - segStart) / 60_000;
      }
    }
    cursorDay = cursorDay.add(1, 'day');
  }

  return Math.round(totalMin);
}

export function evaluateTicketSla(
  ticket: Ticket,
  policies: Record<Ticket['priority'], SlaPolicy>,
  settings: Pick<BusinessSettings, 'workStartHour' | 'workEndHour' | 'workDays'>,
  holidays: OfficialHoliday[] = [],
  nowMs: number = Date.now(),
): TicketSlaEvaluation {
  const policy = policies[ticket.priority] ?? {
    priority: ticket.priority,
    firstResponseMin: ticket.priority === 'high' ? 30 : ticket.priority === 'normal' ? 120 : 240,
    resolutionMin: ticket.priority === 'high' ? 240 : ticket.priority === 'normal' ? 1440 : 2880,
    warnPct: 75,
  };

  const firstRespTargetMin = Math.max(5, policy.firstResponseMin);
  const resolutionTargetMin = Math.max(firstRespTargetMin, policy.resolutionMin);
  const warnPct = Math.min(95, Math.max(40, policy.warnPct));

  const closed = isTicketClosedStatus(ticket.status);

  // 1) First response SLA
  const firstRespEndMs = ticket.firstRespondedAt
    ? ticket.firstRespondedAt
    : closed
      ? ticket.resolvedAt ?? nowMs
      : nowMs;
  const firstRespElapsedMin = computeBusinessMinutesBetween(
    ticket.createdAt,
    firstRespEndMs,
    settings.workStartHour,
    settings.workEndHour,
    settings.workDays,
    holidays,
  );
  const firstRespRemainingMin = firstRespTargetMin - firstRespElapsedMin;
  const firstRespPct = Math.min(200, Math.round((firstRespElapsedMin / firstRespTargetMin) * 100));

  let firstRespState: SlaHealthState;
  if (ticket.firstRespondedAt || closed) {
    firstRespState = firstRespElapsedMin <= firstRespTargetMin ? 'met' : 'breached';
  } else if (firstRespElapsedMin >= firstRespTargetMin) {
    firstRespState = 'breached';
  } else if (firstRespPct >= warnPct) {
    firstRespState = 'warning';
  } else {
    firstRespState = 'ok';
  }

  // 2) Resolution SLA
  const resEndMs = closed ? ticket.resolvedAt ?? nowMs : nowMs;
  const resolutionElapsedMin = computeBusinessMinutesBetween(
    ticket.createdAt,
    resEndMs,
    settings.workStartHour,
    settings.workEndHour,
    settings.workDays,
    holidays,
  );
  const resolutionRemainingMin = resolutionTargetMin - resolutionElapsedMin;
  const resolutionPct = Math.min(200, Math.round((resolutionElapsedMin / resolutionTargetMin) * 100));

  let resolutionState: SlaHealthState;
  if (closed) {
    resolutionState = resolutionElapsedMin <= resolutionTargetMin ? 'met' : 'breached';
  } else if (resolutionElapsedMin >= resolutionTargetMin) {
    resolutionState = 'breached';
  } else if (resolutionPct >= warnPct) {
    resolutionState = 'warning';
  } else {
    resolutionState = 'ok';
  }

  // 3) Overall worst active health
  let overallState: SlaHealthState = 'ok';
  if (closed) {
    overallState =
      firstRespState === 'breached' || resolutionState === 'breached' ? 'breached' : 'met';
  } else if (resolutionState === 'breached' || firstRespState === 'breached') {
    overallState = 'breached';
  } else if (resolutionState === 'warning' || firstRespState === 'warning') {
    overallState = 'warning';
  }

  return {
    firstRespElapsedMin,
    firstRespTargetMin,
    firstRespRemainingMin,
    firstRespPct,
    firstRespState,
    resolutionElapsedMin,
    resolutionTargetMin,
    resolutionRemainingMin,
    resolutionPct,
    resolutionState,
    overallState,
  };
}

export function formatRemainingMinutesFa(remainingMin: number, prefixDone = false): string {
  const abs = Math.abs(Math.round(remainingMin));
  const hours = Math.floor(abs / 60);
  const mins = abs % 60;
  const parts: string[] = [];
  if (hours > 0) parts.push(`${toFa(hours)} ساعت`);
  if (mins > 0 || hours === 0) parts.push(`${toFa(mins)} دقیقه`);
  const span = parts.join(' و ');

  if (prefixDone) {
    return remainingMin >= 0 ? `${span} زودتر از مهلت` : `${span} تأخیر`;
  }
  return remainingMin >= 0 ? `${span} مانده` : `${span} تاخیر (نقض SLA)`;
}

export function formatDurationMinutesFa(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h === 0) return `${toFa(rem)} دقیقه`;
  if (rem === 0) return `${toFa(h)} ساعت`;
  return `${toFa(h)} ساعت و ${toFa(rem)} دقیقه`;
}

/**
 * Ranks Knowledge Base articles for a ticket subject, category, and optional draft text
 * to power the "Suggest Articles" assistant inside ticket replies.
 */
export function suggestKbArticlesForTicket(
  ticket: Ticket,
  articles: KbArticle[],
  draftQuery = '',
  limit = 3,
): KbArticle[] {
  const contextTokens = normalizePersian(
    `${ticket.subject} ${ticket.category ?? ''} ${ticket.rootCause ?? ''} ${draftQuery}`,
  )
    .split(/\s+/)
    .filter((w) => w.length >= 2);

  const scored = articles
    .map((art) => {
      let score = 0;
      const hay = normalizePersian(`${art.title} ${art.category} ${art.body}`);
      if (ticket.category && normalizePersian(art.category).includes(normalizePersian(ticket.category.split(' ')[0]))) {
        score += 4;
      }
      contextTokens.forEach((tok) => {
        if (hay.includes(tok)) score += 2;
      });
      if (draftQuery.trim() && fuzzyMatchPersian([art.title, art.body, art.category], draftQuery)) {
        score += 5;
      }
      score += Math.min(2, art.helpfulCount / 30);
      return { art, score };
    })
    .filter((x) => x.score >= 2)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return [...articles].sort((a, b) => b.helpfulCount - a.helpfulCount).slice(0, limit);
  }
  return scored.slice(0, limit).map((x) => x.art);
}
