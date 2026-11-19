import type {
  AppState,
  AutomationPolicy,
  Customer,
  OutboxMessage,
  Rule,
  RuleCondition,
} from '../types';
import { fuzzyMatchPersian } from './persianSearch';

export function isWithinQuietHours(policy: AutomationPolicy, hourOverride?: number): boolean {
  if (!policy.quietHoursEnabled) return false;
  const h = typeof hourOverride === 'number' ? hourOverride : new Date().getHours();
  const start = policy.quietStartHour;
  const end = policy.quietEndHour;
  if (start === end) return false;
  if (start < end) {
    return h >= start && h < end;
  }
  // Wraps midnight e.g. 22:00 to 08:00
  return h >= start || h < end;
}

export function countTodayCustomerNotifications(
  outbox: OutboxMessage[],
  customerId?: string,
  phone?: string,
): number {
  const todayKey = new Date().toISOString().slice(0, 10);
  return outbox.filter((m) => {
    if (!m.at.startsWith(todayKey)) return false;
    if (customerId && m.customerId === customerId) return true;
    if (phone && m.to === phone) return true;
    return false;
  }).length;
}

function getFieldValue(
  field: string,
  record: Record<string, unknown>,
  customer?: Customer,
): string {
  if (field.startsWith('customer.') && customer) {
    const k = field.slice('customer.'.length) as keyof Customer;
    const v = customer[k];
    return Array.isArray(v) ? v.join(',') : String(v ?? '');
  }
  if (field === 'tags' && customer) {
    return customer.tags.join(',');
  }
  const raw = record[field];
  if (Array.isArray(raw)) return raw.join(',');
  if (raw === undefined || raw === null) {
    if (customer) {
      const cv = (customer as Record<string, unknown>)[field];
      return cv === undefined || cv === null ? '' : String(cv);
    }
    return '';
  }
  return String(raw);
}

function evaluateSingleCondition(
  cond: RuleCondition,
  record: Record<string, unknown>,
  customer?: Customer,
): boolean {
  const actual = getFieldValue(cond.field, record, customer);
  const target = cond.value ?? '';
  switch (cond.op) {
    case 'eq':
      return actual.trim().toLowerCase() === target.trim().toLowerCase();
    case 'neq':
      return actual.trim().toLowerCase() !== target.trim().toLowerCase();
    case 'contains':
      return fuzzyMatchPersian([actual], target);
    case 'gte': {
      const a = Number(actual);
      const b = Number(target);
      return Number.isFinite(a) && Number.isFinite(b) && a >= b;
    }
    case 'lte': {
      const a = Number(actual);
      const b = Number(target);
      return Number.isFinite(a) && Number.isFinite(b) && a <= b;
    }
    default:
      return false;
  }
}

export function evaluateRuleConditions(
  rule: Rule,
  record: Record<string, unknown>,
  customer?: Customer,
): boolean {
  const conditions = rule.conditions ?? [];
  if (conditions.length === 0) return true;
  const logic = rule.conditionLogic ?? 'AND';
  if (logic === 'OR') {
    return conditions.some((c) => evaluateSingleCondition(c, record, customer));
  }
  if (logic === 'NOT') {
    // True only when NONE of the conditions match
    return !conditions.some((c) => evaluateSingleCondition(c, record, customer));
  }
  return conditions.every((c) => evaluateSingleCondition(c, record, customer));
}

export function renderRuleTemplate(
  template: string,
  ctx: {
    customer?: Customer;
    entity?: Record<string, unknown>;
    businessName: string;
  },
): string {
  const c = ctx.customer;
  const e = ctx.entity ?? {};
  const map: Record<string, string> = {
    'customer.name': c?.name ?? 'مشتری گرامی',
    'customer.phone': c?.phone ?? '',
    'customer.lifecycle': c?.lifecycle ?? '',
    'customer.companyName': c?.companyName ?? '',
    'entity.id': String(e.id ?? ''),
    'entity.title': String(e.title ?? e.subject ?? ''),
    'entity.status': String(e.status ?? e.stage ?? ''),
    'entity.amount': String(e.amount ?? ''),
    'entity.priority': String(e.priority ?? ''),
    businessName: ctx.businessName,
  };
  return template.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, key: string) => map[key] ?? '');
}

export type RuleCandidate = {
  entityId: string;
  customer?: Customer;
  record: Record<string, unknown>;
};

export function getTargetRecordsForRule(
  rule: Rule,
  state: AppState,
  singleTarget?: { entity: Rule['targetEntity']; record: Record<string, unknown> },
): RuleCandidate[] {
  const target = rule.targetEntity ?? 'customer';
  const findCust = (cid?: unknown) =>
    typeof cid === 'string' ? state.customers.find((c) => c.id === cid) : undefined;

  if (singleTarget) {
    if (singleTarget.entity !== target) return [];
    const rec = singleTarget.record;
    const cust = target === 'customer' ? (rec as Customer) : findCust(rec.customerId);
    return [{ entityId: String(rec.id ?? Date.now()), customer: cust, record: rec }];
  }

  switch (target) {
    case 'customer':
      return state.customers.map((c) => ({
        entityId: c.id,
        customer: c,
        record: c as unknown as Record<string, unknown>,
      }));
    case 'order':
      return state.orders.map((o) => {
        const total = o.items.reduce((s, it) => s + it.qty * it.price, 0) - (o.discountAmount ?? 0);
        return {
          entityId: o.id,
          customer: findCust(o.customerId),
          record: { ...(o as unknown as Record<string, unknown>), amount: total },
        };
      });
    case 'appointment':
      return state.appointments.map((a) => ({
        entityId: a.id,
        customer: findCust(a.customerId),
        record: a as unknown as Record<string, unknown>,
      }));
    case 'opportunity':
      return state.opportunities.map((op) => ({
        entityId: op.id,
        customer: findCust(op.customerId),
        record: op as unknown as Record<string, unknown>,
      }));
    case 'ticket':
      return state.tickets.map((t) => ({
        entityId: t.id,
        customer: findCust(t.customerId),
        record: t as unknown as Record<string, unknown>,
      }));
    default:
      return [];
  }
}

export type DryRunMatchItem = {
  entityId: string;
  customerName: string;
  phone: string;
  renderedMessage: string;
  renderedTask?: string;
  blockedReason?: string;
};

export type DryRunResult = {
  totalScanned: number;
  matchedCount: number;
  willExecuteCount: number;
  blockedCount: number;
  quietHoursActive: boolean;
  items: DryRunMatchItem[];
};

export function simulateRuleDryRun(
  rule: Rule,
  state: AppState,
  hourOverride?: number,
): DryRunResult {
  const candidates = getTargetRecordsForRule(rule, state);
  const quiet = (rule.respectQuietHours ?? true) && isWithinQuietHours(state.automationPolicy, hourOverride);
  const cap = rule.dailyCapPerCustomer ?? state.automationPolicy.defaultDailyCap;
  const items: DryRunMatchItem[] = [];

  for (const cand of candidates) {
    if (!evaluateRuleConditions(rule, cand.record, cand.customer)) continue;
    const key = `${rule.id}_${cand.entityId}`;
    const alreadyProcessed = state.processedRuleKeys.includes(key);
    const todayCount = countTodayCustomerNotifications(state.outbox, cand.customer?.id, cand.customer?.phone);
    let blockedReason: string | undefined;

    if (alreadyProcessed) {
      blockedReason = 'قبلاً برای این رکورد اجرا شده است';
    } else if (cand.customer && cand.customer.consentSms === false && (rule.actionChannel ?? 'sms') === 'sms') {
      blockedReason = 'عدم رضایت پیامکی مشتری';
    } else if (quiet && (rule.actionType ?? 'send_notification') !== 'create_task') {
      blockedReason = 'در ساعات سکوت (Quiet Hours) به صف تعویق می‌رود';
    } else if (cap > 0 && todayCount >= cap) {
      blockedReason = `سقف ارسال روزانه (${cap} پیام در روز) پر شده است`;
    }

    const renderedMessage = renderRuleTemplate(
      rule.messageTemplate || 'سلام {{customer.name}} عزیز، پیام اطلاع‌رسانی از {{businessName}}.',
      { customer: cand.customer, entity: cand.record, businessName: state.settings.businessName },
    );
    const renderedTask =
      rule.actionType === 'create_task' || rule.actionType === 'both'
        ? renderRuleTemplate(rule.taskTitleTemplate || 'پیگیری {{customer.name}}', {
            customer: cand.customer,
            entity: cand.record,
            businessName: state.settings.businessName,
          })
        : undefined;

    items.push({
      entityId: cand.entityId,
      customerName: cand.customer?.name ?? String(cand.record.contactName ?? cand.entityId),
      phone: cand.customer?.phone ?? String(cand.record.phone ?? '-'),
      renderedMessage,
      renderedTask,
      blockedReason,
    });
  }

  const willExecuteCount = items.filter((i) => !i.blockedReason).length;
  return {
    totalScanned: candidates.length,
    matchedCount: items.length,
    willExecuteCount,
    blockedCount: items.length - willExecuteCount,
    quietHoursActive: quiet,
    items,
  };
}
