import dayjs from 'dayjs';
import jalaliday from 'jalaliday';
import type {
  AppState,
  CommissionTier,
  CustomFieldDef,
  Customer,
  CustomerSegment,
} from '../types';

dayjs.extend(jalaliday);

export type CustomerComputedStats = {
  totalSpent: number;
  completedAppointments: number;
  totalAppointments: number;
  avgNps: number | null;
  interactionsCount: number;
  score: number; // 0..100
};

export function computeCustomerStats(customer: Customer, state: AppState): CustomerComputedStats {
  const custApts = state.appointments.filter((a) => a.customerId === customer.id);
  const completedAppointments = custApts.filter((a) => a.status === 'done').length;

  const totalSpent = state.orders
    .filter((o) => o.customerId === customer.id && o.status !== 'cancelled')
    .reduce(
      (sum, o) => sum + o.items.reduce((s, it) => s + it.qty * it.price, 0) - (o.discountAmount ?? 0),
      0,
    );

  const npsList = state.npsSurveys.filter((n) => n.customerId === customer.id);
  const avgNps =
    npsList.length > 0 ? npsList.reduce((s, n) => s + n.score, 0) / npsList.length : null;

  const interactionsCount = state.interactions.filter((i) => i.customerId === customer.id).length;

  // Score calculation (0..100):
  // - Spend up to 35 pts (1M Toman = 7 pts, capped at 5M)
  // - Completed appointments up to 25 pts (5 pts each, max 5)
  // - Lifecycle base up to 20 pts (vip=20, active=12, lead=6, churned=2)
  // - Engagement / NPS up to 20 pts
  const spendPts = Math.min(35, Math.round((totalSpent / 5_000_000) * 35));
  const aptPts = Math.min(25, completedAppointments * 5);
  const lc = customer.lifecycle ?? 'active';
  const lcPts = lc === 'vip' ? 20 : lc === 'active' ? 12 : lc === 'lead' ? 6 : 2;
  const npsPts = avgNps !== null ? Math.round((avgNps / 10) * 12) : 6;
  const intPts = Math.min(8, interactionsCount * 2);

  const score = Math.min(100, Math.max(5, spendPts + aptPts + lcPts + npsPts + intPts));

  return {
    totalSpent,
    completedAppointments,
    totalAppointments: custApts.length,
    avgNps,
    interactionsCount,
    score,
  };
}

export function evaluateSegment(
  customer: Customer,
  segment: CustomerSegment,
  stats: CustomerComputedStats,
): boolean {
  if (segment.conditions.length === 0) return true;

  const results = segment.conditions.map((cond) => {
    const val = cond.value.trim();
    switch (cond.field) {
      case 'lifecycle': {
        const cur = customer.lifecycle ?? 'active';
        return cond.op === 'neq' ? cur !== val : cur === val;
      }
      case 'source': {
        const cur = (customer.source ?? '').toLowerCase();
        if (cond.op === 'neq') return cur !== val.toLowerCase();
        if (cond.op === 'contains') return cur.includes(val.toLowerCase());
        return cur === val.toLowerCase();
      }
      case 'personType': {
        const cur = customer.personType ?? 'individual';
        return cond.op === 'neq' ? cur !== val : cur === val;
      }
      case 'tag': {
        const hasTag = customer.tags.some((t) => t.toLowerCase().includes(val.toLowerCase()));
        return cond.op === 'neq' ? !hasTag : hasTag;
      }
      case 'consentSms': {
        const cur = customer.consentSms !== false ? 'true' : 'false';
        return cur === val;
      }
      case 'minSpent': {
        const target = Number(val) || 0;
        return stats.totalSpent >= target;
      }
      case 'minScore': {
        const target = Number(val) || 0;
        return stats.score >= target;
      }
      default:
        return true;
    }
  });

  return segment.logic === 'OR' ? results.some(Boolean) : results.every(Boolean);
}

/** Check conditional visibility for custom fields */
export function isFieldVisible(def: CustomFieldDef, values: Record<string, string>): boolean {
  if (!def.visibleWhen || !def.visibleWhen.fieldKey) return true;
  const actual = (values[def.visibleWhen.fieldKey] ?? '').trim();
  return actual === def.visibleWhen.equals.trim();
}

/** Safe arithmetic formula evaluator for {fieldKey} placeholders, supports + - * / and parentheses */
export function evalCustomFormula(expr: string | undefined, values: Record<string, string>): string {
  if (!expr?.trim()) return '0';
  const replaced = expr.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key) => {
    const raw = (values[key] ?? '0').replace(/,/g, '').trim();
    const num = Number(raw);
    return Number.isFinite(num) ? String(num) : '0';
  });

  // Allow only numbers, spaces, +, -, *, /, ., (, )
  if (!/^[0-9+\-*/().\s]+$/.test(replaced)) return 'خطای فرمول';
  try {
    const tokens = replaced.match(/(\d+(?:\.\d+)?|[+\-*/()])/g);
    if (!tokens || tokens.length === 0) return '0';
    let pos = 0;

    const parseExpr = (): number => {
      let left = parseTerm();
      while (tokens[pos] === '+' || tokens[pos] === '-') {
        const op = tokens[pos++];
        const right = parseTerm();
        left = op === '+' ? left + right : left - right;
      }
      return left;
    };

    const parseTerm = (): number => {
      let left = parseFactor();
      while (tokens[pos] === '*' || tokens[pos] === '/') {
        const op = tokens[pos++];
        const right = parseFactor();
        left = op === '*' ? left * right : right === 0 ? 0 : left / right;
      }
      return left;
    };

    const parseFactor = (): number => {
      const tok = tokens[pos];
      if (tok === '(') {
        pos++;
        const v = parseExpr();
        if (tokens[pos] === ')') pos++;
        return v;
      }
      if (tok === '-') {
        pos++;
        return -parseFactor();
      }
      pos++;
      const n = Number(tok);
      return Number.isFinite(n) ? n : 0;
    };

    const result = parseExpr();
    if (!Number.isFinite(result)) return '0';
    return String(Math.round(result * 100) / 100);
  } catch {
    return '0';
  }
}

/** Progressive stepped commission calculation across sorted tiers */
export function computeSteppedCommission(
  wonAmount: number,
  tiers: CommissionTier[],
): { total: number; breakdown: { rangeLabel: string; ratePct: number; portion: number; commission: number }[] } {
  if (wonAmount <= 0 || tiers.length === 0) return { total: 0, breakdown: [] };
  const sorted = [...tiers].sort((a, b) => {
    if (a.upToAmount === null) return 1;
    if (b.upToAmount === null) return -1;
    return a.upToAmount - b.upToAmount;
  });

  let prevLimit = 0;
  let total = 0;
  const breakdown: { rangeLabel: string; ratePct: number; portion: number; commission: number }[] = [];

  for (const tier of sorted) {
    if (wonAmount <= prevLimit) break;
    const upper = tier.upToAmount ?? Infinity;
    const portion = Math.max(0, Math.min(wonAmount, upper) - prevLimit);
    const commission = Math.round((portion * tier.ratePct) / 100);
    total += commission;
    breakdown.push({
      rangeLabel:
        tier.upToAmount === null
          ? `مازاد بر ${Math.round(prevLimit / 1_000_000)} میلیون`
          : `${Math.round(prevLimit / 1_000_000)} تا ${Math.round(tier.upToAmount / 1_000_000)} میلیون`,
      ratePct: tier.ratePct,
      portion,
      commission,
    });
    prevLimit = upper;
  }

  return { total, breakdown };
}

/** Extract Jalali month (1..12) and day (1..31) from YYYY/MM/DD string */
export function parseJalaliMonthDay(jalaliStr?: string): { month: number; day: number } | null {
  if (!jalaliStr) return null;
  const ascii = jalaliStr
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .trim();
  const parts = ascii.split(/[/-]/);
  if (parts.length < 3) return null;
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (!month || !day || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { month, day };
}

/** Returns days remaining (0..365) until the next occurrence of a Jalali MM/DD date */
export function daysUntilJalaliMonthDay(jalaliStr?: string): number | null {
  const parsed = parseJalaliMonthDay(jalaliStr);
  if (!parsed) return null;
  const base = dayjs().startOf('day');
  for (let d = 0; d < 366; d++) {
    const j = base.add(d, 'day').calendar('jalali');
    if (j.month() + 1 === parsed.month && j.date() === parsed.day) {
      return d;
    }
  }
  return null;
}
