import dayjs from 'dayjs';
import jalaliday from 'jalaliday';
import type {
  AppState,
  CommissionRuleConfig,
  CommissionTier,
  CustomFieldDef,
  Customer,
  CustomerSegment,
  Invoice,
  LoyaltyConfig,
  LoyaltyTier,
  Quote,
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

/** O(N + M) batch stats calculator for 10,000+ customer lists without O(N*M) scans */
export function computeAllCustomerStatsMap(
  customers: Customer[],
  state: AppState,
): Map<string, CustomerComputedStats> {
  const aptCountMap = new Map<string, { total: number; done: number }>();
  for (const a of state.appointments) {
    if (a.isDeleted) continue;
    const cur = aptCountMap.get(a.customerId) ?? { total: 0, done: 0 };
    cur.total += 1;
    if (a.status === 'done') cur.done += 1;
    aptCountMap.set(a.customerId, cur);
  }

  const spendMap = new Map<string, number>();
  for (const o of state.orders) {
    if (o.isDeleted || o.status === 'cancelled') continue;
    const orderTotal =
      o.items.reduce((s, it) => s + it.qty * it.price, 0) - (o.discountAmount ?? 0);
    spendMap.set(o.customerId, (spendMap.get(o.customerId) ?? 0) + orderTotal);
  }

  const npsMap = new Map<string, { sum: number; count: number }>();
  for (const n of state.npsSurveys) {
    const cur = npsMap.get(n.customerId) ?? { sum: 0, count: 0 };
    cur.sum += n.score;
    cur.count += 1;
    npsMap.set(n.customerId, cur);
  }

  const intMap = new Map<string, number>();
  for (const i of state.interactions) {
    intMap.set(i.customerId, (intMap.get(i.customerId) ?? 0) + 1);
  }

  const result = new Map<string, CustomerComputedStats>();
  for (const customer of customers) {
    const apt = aptCountMap.get(customer.id) ?? { total: 0, done: 0 };
    const totalSpent = spendMap.get(customer.id) ?? 0;
    const nps = npsMap.get(customer.id);
    const avgNps = nps && nps.count > 0 ? nps.sum / nps.count : null;
    const interactionsCount = intMap.get(customer.id) ?? 0;

    const spendPts = Math.min(35, Math.round((totalSpent / 5_000_000) * 35));
    const aptPts = Math.min(25, apt.done * 5);
    const lc = customer.lifecycle ?? 'active';
    const lcPts = lc === 'vip' ? 20 : lc === 'active' ? 12 : lc === 'lead' ? 6 : 2;
    const npsPts = avgNps !== null ? Math.round((avgNps / 10) * 12) : 6;
    const intPts = Math.min(8, interactionsCount * 2);
    const score = Math.min(100, Math.max(5, spendPts + aptPts + lcPts + npsPts + intPts));

    result.set(customer.id, {
      totalSpent,
      completedAppointments: apt.done,
      totalAppointments: apt.total,
      avgNps,
      interactionsCount,
      score,
    });
  }
  return result;
}

export function evaluateSegment(
  customer: Customer,
  segment: CustomerSegment,
  stats: CustomerComputedStats,
): boolean {
  if (segment.segmentType === 'static') {
    const idSet = new Set(segment.staticCustomerIds ?? []);
    return idSet.has(customer.id);
  }
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
      case 'ownerName': {
        const cur = (customer.ownerName ?? '').toLowerCase();
        if (cond.op === 'neq') return cur !== val.toLowerCase();
        if (cond.op === 'contains') return cur.includes(val.toLowerCase());
        return cur === val.toLowerCase();
      }
      case 'tag': {
        const hasTag = customer.tags.some((t) => t.toLowerCase().includes(val.toLowerCase()));
        return cond.op === 'neq' ? !hasTag : hasTag;
      }
      case 'consentSms': {
        const cur = customer.consentSms !== false ? 'true' : 'false';
        return cond.op === 'neq' ? cur !== val : cur === val;
      }
      case 'consentEmail': {
        const cur = customer.consentEmail !== false ? 'true' : 'false';
        return cond.op === 'neq' ? cur !== val : cur === val;
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

/** Compute commission based on CommissionRuleConfig ('percentage' or 'tiered') */
export function computeCommissionAmount(
  amount: number,
  tiers: CommissionTier[],
  rule?: CommissionRuleConfig,
): {
  total: number;
  summary: string;
  breakdown: { rangeLabel: string; ratePct: number; portion: number; commission: number }[];
} {
  if (amount <= 0) return { total: 0, summary: '۰٪', breakdown: [] };
  if (rule?.mode === 'percentage') {
    const rate = Math.max(0, rule.flatRatePct);
    const total = Math.round((amount * rate) / 100);
    return {
      total,
      summary: `ثابت ${rate}٪`,
      breakdown: [
        {
          rangeLabel: 'کل مبلغ فروش',
          ratePct: rate,
          portion: amount,
          commission: total,
        },
      ],
    };
  }
  const stepped = computeSteppedCommission(amount, tiers);
  return {
    total: stepped.total,
    summary: `پلکانی (${stepped.breakdown.length} پله)`,
    breakdown: stepped.breakdown,
  };
}

/** Calculate Quote line discounts, overall discount, effective discount %, tax, grandTotal, and Manager Approval rule (>20%) */
export function computeQuoteFinancials(
  quote: Pick<Quote, 'items' | 'discountPct' | 'taxPct'>,
  approvalThresholdPct = 20,
) {
  let grossSubtotal = 0;
  let lineDiscounts = 0;
  for (const it of quote.items) {
    const lineGross = Math.max(0, it.qty) * Math.max(0, it.price);
    const lineDiscPct = Math.min(100, Math.max(0, it.discountPct ?? 0));
    const lineDiscAmt = Math.round((lineGross * lineDiscPct) / 100);
    grossSubtotal += lineGross;
    lineDiscounts += lineDiscAmt;
  }
  const afterLineDiscounts = Math.max(0, grossSubtotal - lineDiscounts);
  const overallDiscount = Math.round((afterLineDiscounts * Math.min(100, Math.max(0, quote.discountPct))) / 100);
  const totalDiscount = lineDiscounts + overallDiscount;
  const netSubtotal = Math.max(0, grossSubtotal - totalDiscount);
  const taxAmount = Math.round((netSubtotal * Math.max(0, quote.taxPct)) / 100);
  const grandTotal = netSubtotal + taxAmount;
  const effectiveDiscountPct =
    grossSubtotal > 0 ? Math.round((totalDiscount / grossSubtotal) * 1000) / 10 : quote.discountPct;
  const requiresManagerApproval = effectiveDiscountPct > approvalThresholdPct;

  return {
    grossSubtotal,
    lineDiscounts,
    overallDiscount,
    totalDiscount,
    netSubtotal,
    taxAmount,
    grandTotal,
    effectiveDiscountPct,
    requiresManagerApproval,
  };
}

/** Heuristic lead score suggestion (0..100) */
export function computeLeadScoreHint(input: {
  source?: string;
  estimatedAmount?: number;
  hasEmail?: boolean;
  hasCompany?: boolean;
}): number {
  let score = 35;
  const amt = input.estimatedAmount ?? 0;
  if (amt >= 20_000_000) score += 25;
  else if (amt >= 10_000_000) score += 18;
  else if (amt >= 4_000_000) score += 10;

  if (input.hasEmail) score += 10;
  if (input.hasCompany) score += 15;
  if (input.source === 'معرفی' || input.source === 'مشتری قدیمی') score += 15;
  else if (input.source === 'سایت' || input.source === 'لندینگ') score += 8;

  return Math.min(100, Math.max(10, score));
}

export function formatDurationHoursFa(hours: number): string {
  const toFaNum = (n: number) => String(Math.round(n)).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
  if (!Number.isFinite(hours) || hours < 1) return 'کمتر از ۱ ساعت';
  if (hours < 24) return `${toFaNum(hours)} ساعت`;
  const days = Math.floor(hours / 24);
  const rem = Math.round(hours % 24);
  return rem > 0 ? `${toFaNum(days)} روز و ${toFaNum(rem)} ساعت` : `${toFaNum(days)} روز`;
}

export function computeLoyaltyTier(points: number, cfg?: LoyaltyConfig): LoyaltyTier {
  const vip = cfg?.vipMinPoints ?? 4000;
  const gold = cfg?.goldMinPoints ?? 1500;
  const silver = cfg?.silverMinPoints ?? 500;
  if (points >= vip) return 'vip';
  if (points >= gold) return 'gold';
  if (points >= silver) return 'silver';
  return 'bronze';
}

export function getSegmentMatchingCustomers(state: AppState, segmentId?: string): Customer[] {
  const eligible = state.customers.filter((c) => !c.isDeleted && !c.isAnonymized);
  if (!segmentId) return eligible;
  const seg = state.customerSegments.find((s) => s.id === segmentId);
  if (!seg) return eligible;
  return eligible.filter((c) => evaluateSegment(c, seg, computeCustomerStats(c, state)));
}

export type AgingBucketKey = '0_30' | '31_60' | '61_90' | 'over_90';

export interface AgingBucketSummary {
  key: AgingBucketKey;
  label: string;
  amount: number;
  count: number;
  color: string;
}

export interface ReceivablesAgingReport {
  totalOpen: number;
  overdueInvoicesCount: number;
  buckets: AgingBucketSummary[];
}

/** Pure invoices receivables aging calculator (0-30, 31-60, 61-90, 90+ days past due) */
export function computeReceivablesAgingReport(
  invoices: Pick<Invoice, 'grandTotal' | 'paidAmount' | 'dueAt' | 'isDeleted'>[],
  nowMs: number = Date.now(),
): ReceivablesAgingReport {
  const amounts: Record<AgingBucketKey, number> = {
    '0_30': 0,
    '31_60': 0,
    '61_90': 0,
    over_90: 0,
  };
  const counts: Record<AgingBucketKey, number> = {
    '0_30': 0,
    '31_60': 0,
    '61_90': 0,
    over_90: 0,
  };

  let totalOpen = 0;
  let overdueInvoicesCount = 0;

  for (const inv of invoices) {
    if (inv.isDeleted) continue;
    const open = Math.max(0, inv.grandTotal - inv.paidAmount);
    if (open <= 0) continue;

    totalOpen += open;
    const dueMs = new Date(inv.dueAt).getTime();
    const rawDays = Number.isFinite(dueMs) ? Math.floor((nowMs - dueMs) / (24 * 3600_000)) : 0;
    const days = Math.max(0, rawDays);
    if (rawDays > 0) overdueInvoicesCount += 1;

    const bucket: AgingBucketKey =
      days <= 30 ? '0_30' : days <= 60 ? '31_60' : days <= 90 ? '61_90' : 'over_90';
    amounts[bucket] += open;
    counts[bucket] += 1;
  }

  return {
    totalOpen,
    overdueInvoicesCount,
    buckets: [
      { key: '0_30', label: '۰ تا ۳۰ روز', amount: amounts['0_30'], count: counts['0_30'], color: '#10b981' },
      { key: '31_60', label: '۳۱ تا ۶۰ روز', amount: amounts['31_60'], count: counts['31_60'], color: '#f59e0b' },
      { key: '61_90', label: '۶۱ تا ۹۰ روز', amount: amounts['61_90'], count: counts['61_90'], color: '#f97316' },
      { key: 'over_90', label: 'بالای ۹۰ روز', amount: amounts.over_90, count: counts.over_90, color: '#ef4444' },
    ],
  };
}



