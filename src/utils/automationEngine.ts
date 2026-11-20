import type {
  AppState,
  AutomationPolicy,
  Customer,
  NotificationChannel,
  OutboxMessage,
  Rule,
  RuleAction,
  RuleCondition,
  WorkflowEdgeDef,
} from '../types';
import { formatJalali, formatJalaliDateTime, formatTimeFa, formatToman } from './jalali';
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

export function countTodayChannelNotifications(
  outbox: OutboxMessage[],
  channel: NotificationChannel,
): number {
  const todayKey = new Date().toISOString().slice(0, 10);
  return outbox.filter((m) => m.at.startsWith(todayKey) && m.channel === channel).length;
}

export function isChannelCapReached(
  outbox: OutboxMessage[],
  channel: NotificationChannel,
  policy: AutomationPolicy,
): boolean {
  const chCap = policy.channelDailyCaps?.[channel];
  if (!chCap || chCap <= 0) return false;
  return countTodayChannelNotifications(outbox, channel) >= chCap;
}

/**
 * Resolves relative time expressions such as "now", "now+24h", "now-48h", "now+30m", "now+7d"
 * into epoch milliseconds. Returns null if the string is not a relative time expression.
 */
export function resolveRelativeTimeExpr(expr: string, nowMs = Date.now()): number | null {
  const trimmed = expr.trim().toLowerCase();
  if (trimmed === 'now') return nowMs;
  const match = /^now\s*([+-])\s*(\d+(?:\.\d+)?)\s*(m|min|h|hr|d|day)$/i.exec(trimmed);
  if (!match) return null;
  const sign = match[1] === '-' ? -1 : 1;
  const val = Number(match[2]);
  const unit = match[3].toLowerCase();
  if (!Number.isFinite(val)) return null;
  const mult =
    unit === 'm' || unit === 'min'
      ? 60_000
      : unit === 'h' || unit === 'hr'
        ? 3600_000
        : 24 * 3600_000;
  return nowMs + sign * val * mult;
}

function getFieldValue(
  field: string,
  record: Record<string, unknown>,
  customer?: Customer,
): string {
  if (field.startsWith('customer.') && customer) {
    const k = field.slice('customer.'.length);
    if (k.startsWith('customFields.')) {
      const cfKey = k.slice('customFields.'.length);
      return String(customer.customFields?.[cfKey] ?? '');
    }
    const v = (customer as Record<string, unknown>)[k];
    return Array.isArray(v) ? v.join(',') : String(v ?? '');
  }
  if (field.startsWith('customFields.')) {
    const cfKey = field.slice('customFields.'.length);
    const cf = record.customFields as Record<string, unknown> | undefined;
    return String(cf?.[cfKey] ?? '');
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
  nowMs = Date.now(),
): boolean {
  const actual = getFieldValue(cond.field, record, customer);
  const target = cond.value ?? '';

  // Support relative time expressions cleanly on date/timestamp fields
  const relMs = resolveRelativeTimeExpr(target, nowMs);
  if (
    relMs !== null &&
    (cond.op === 'gte' ||
      cond.op === 'lte' ||
      cond.op === 'before_rel' ||
      cond.op === 'after_rel' ||
      cond.op === 'eq')
  ) {
    const actualMs = Date.parse(actual);
    if (!Number.isFinite(actualMs)) return false;
    if (cond.op === 'lte' || cond.op === 'before_rel') return actualMs <= relMs;
    if (cond.op === 'gte' || cond.op === 'after_rel') return actualMs >= relMs;
    return Math.abs(actualMs - relMs) <= 3600_000;
  }

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
      if (Number.isFinite(a) && Number.isFinite(b)) return a >= b;
      const da = Date.parse(actual);
      const db = Date.parse(target);
      return Number.isFinite(da) && Number.isFinite(db) && da >= db;
    }
    case 'lte': {
      const a = Number(actual);
      const b = Number(target);
      if (Number.isFinite(a) && Number.isFinite(b)) return a <= b;
      const da = Date.parse(actual);
      const db = Date.parse(target);
      return Number.isFinite(da) && Number.isFinite(db) && da <= db;
    }
    case 'before_rel': {
      const da = Date.parse(actual);
      const db = relMs ?? Date.parse(target);
      return Number.isFinite(da) && Number.isFinite(db) && da <= db;
    }
    case 'after_rel': {
      const da = Date.parse(actual);
      const db = relMs ?? Date.parse(target);
      return Number.isFinite(da) && Number.isFinite(db) && da >= db;
    }
    case 'within_next_hours': {
      const da = Date.parse(actual);
      const hrs = Number(target);
      if (!Number.isFinite(da) || !Number.isFinite(hrs)) return false;
      const diffH = (da - nowMs) / 3600_000;
      return diffH >= 0 && diffH <= hrs;
    }
    case 'older_than_hours': {
      const da = Date.parse(actual);
      const hrs = Number(target);
      if (!Number.isFinite(da) || !Number.isFinite(hrs)) return false;
      const ageH = (nowMs - da) / 3600_000;
      return ageH >= hrs;
    }
    default:
      return false;
  }
}

export function evaluateRuleConditions(
  rule: Rule,
  record: Record<string, unknown>,
  customer?: Customer,
  nowMs = Date.now(),
): boolean {
  const conditions = rule.conditions ?? [];
  if (conditions.length === 0) return true;
  const logic = rule.conditionLogic ?? 'AND';
  if (logic === 'OR') {
    return conditions.some((c) => evaluateSingleCondition(c, record, customer, nowMs));
  }
  if (logic === 'NOT') {
    return !conditions.some((c) => evaluateSingleCondition(c, record, customer, nowMs));
  }
  return conditions.every((c) => evaluateSingleCondition(c, record, customer, nowMs));
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
  const aptStartIso =
    typeof e.start === 'string' && !Number.isNaN(Date.parse(e.start)) ? e.start : undefined;
  const amountVal = typeof e.amount === 'number' ? e.amount : Number(e.amount ?? 0);

  const map: Record<string, string> = {
    'customer.name': c?.name ?? 'مشتری گرامی',
    'customer.phone': c?.phone ?? '',
    'customer.lifecycle': c?.lifecycle ?? '',
    'customer.companyName': c?.companyName ?? '',
    'appointment.time': aptStartIso ? formatJalaliDateTime(aptStartIso) : 'ساعت مقرر',
    'appointment.hour': aptStartIso ? formatTimeFa(aptStartIso) : 'ساعت مقرر',
    'appointment.date': aptStartIso ? formatJalali(aptStartIso) : 'تاریخ مقرر',
    'appointment.service': String(e.serviceName ?? e.title ?? 'خدمت'),
    'order.id': String(e.id ?? ''),
    'order.total': Number.isFinite(amountVal) && amountVal > 0 ? formatToman(amountVal) : '۰ تومان',
    'order.status': String(e.status ?? ''),
    'ticket.trackingCode': String(e.trackingCode ?? e.id ?? ''),
    'ticket.subject': String(e.subject ?? ''),
    'entity.id': String(e.id ?? ''),
    'entity.title': String(e.title ?? e.subject ?? ''),
    'entity.status': String(e.status ?? e.stage ?? ''),
    'entity.amount': String(e.amount ?? ''),
    'entity.priority': String(e.priority ?? ''),
    businessName: ctx.businessName,
  };
  return template.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, key: string) => map[key] ?? '');
}

/** Normalizes structured actions[] or falls back cleanly to legacy actionType / actionChannel fields */
export function getNormalizedRuleActions(rule: Rule): RuleAction[] {
  if (rule.actions && rule.actions.length > 0) {
    return rule.actions;
  }
  const legacyType = rule.actionType ?? 'send_notification';
  const ch = rule.actionChannel ?? 'sms';
  const out: RuleAction[] = [];

  if (legacyType === 'send_notification' || legacyType === 'both') {
    const type: RuleAction['type'] =
      ch === 'whatsapp' ? 'send_whatsapp' : ch === 'email' ? 'send_email' : 'send_sms';
    out.push({
      id: `${rule.id}_act_notify`,
      type,
      channel: ch,
      messageTemplate: rule.messageTemplate || 'سلام {{customer.name}}، پیام خودکار از {{businessName}}.',
    });
  }
  if (legacyType === 'create_task' || legacyType === 'both') {
    out.push({
      id: `${rule.id}_act_task`,
      type: 'create_task',
      taskTitleTemplate: rule.taskTitleTemplate || 'پیگیری خودکار {{customer.name}}',
    });
  }
  return out;
}

export function isRuleInCooldown(
  ruleCooldowns: Record<string, string> | undefined,
  rule: Rule,
  entityId: string,
  nowMs = Date.now(),
): boolean {
  const cdMin = rule.cooldownMinutes ?? 0;
  if (cdMin <= 0 || !ruleCooldowns) return false;
  const lastIso = ruleCooldowns[`${rule.id}_${entityId}`];
  if (!lastIso) return false;
  const elapsedMin = (nowMs - Date.parse(lastIso)) / 60_000;
  return Number.isFinite(elapsedMin) && elapsedMin < cdMin;
}

export function evaluateWorkflowEdgeCondition(
  edge: WorkflowEdgeDef,
  context: Record<string, unknown>,
): boolean {
  if (!edge.conditionField || !edge.conditionOp) return true;
  const raw = context[edge.conditionField];
  const actual = raw === undefined || raw === null ? '' : String(raw);
  const target = edge.conditionValue ?? '';
  switch (edge.conditionOp) {
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
      return true;
  }
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
    const enrichedRec =
      target === 'order' && rec.amount === undefined && Array.isArray(rec.items)
        ? {
            ...rec,
            amount:
              (rec.items as { qty: number; price: number }[]).reduce((s, it) => s + it.qty * it.price, 0) -
              Number(rec.discountAmount ?? 0),
          }
        : rec;
    return [{ entityId: String(rec.id ?? Date.now()), customer: cust, record: enrichedRec }];
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
      return state.appointments.map((a) => {
        const svc = state.services.find((s) => s.id === a.serviceId);
        return {
          entityId: a.id,
          customer: findCust(a.customerId),
          record: { ...(a as unknown as Record<string, unknown>), serviceName: svc?.name ?? '' },
        };
      });
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
  actionSummaries: string[];
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

const ACTION_NAME_FA: Record<RuleAction['type'], string> = {
  send_sms: 'ارسال پیامک',
  send_whatsapp: 'ارسال واتساپ',
  send_email: 'ارسال ایمیل',
  create_task: 'ایجاد وظیفه',
  update_field: 'تغییر مقدار فیلد',
  change_stage: 'تغییر مرحله/وضعیت',
  assign_owner: 'تخصیص مسئول',
  call_webhook: 'فراخوانی وب‌هوک',
  add_tag: 'افزودن برچسب',
  create_ticket: 'ایجاد تیکت پشتیبانی',
};

export function simulateRuleDryRun(
  rule: Rule,
  state: AppState,
  hourOverride?: number,
): DryRunResult {
  const candidates = getTargetRecordsForRule(rule, state);
  const quiet = (rule.respectQuietHours ?? true) && isWithinQuietHours(state.automationPolicy, hourOverride);
  const cap = rule.dailyCapPerCustomer ?? state.automationPolicy.defaultDailyCap;
  const actions = getNormalizedRuleActions(rule);
  const items: DryRunMatchItem[] = [];

  for (const cand of candidates) {
    if (!evaluateRuleConditions(rule, cand.record, cand.customer)) continue;
    const key = `${rule.id}_${cand.entityId}`;
    const alreadyProcessed = !rule.allowRepeat && state.processedRuleKeys.includes(key);
    const inCooldown = isRuleInCooldown(state.ruleCooldowns, rule, cand.entityId);
    const todayCount = countTodayCustomerNotifications(state.outbox, cand.customer?.id, cand.customer?.phone);

    const notifyAction = actions.find(
      (a) => a.type === 'send_sms' || a.type === 'send_whatsapp' || a.type === 'send_email',
    );
    const notifyCh: NotificationChannel =
      notifyAction?.channel ??
      (notifyAction?.type === 'send_whatsapp'
        ? 'whatsapp'
        : notifyAction?.type === 'send_email'
          ? 'email'
          : 'sms');

    let blockedReason: string | undefined;
    if (alreadyProcessed) {
      blockedReason = 'قبلاً برای این رکورد اجرا شده است (Dedup)';
    } else if (inCooldown) {
      blockedReason = `در دوره Cooldown (${rule.cooldownMinutes} دقیقه) قرار دارد`;
    } else if (notifyAction && cand.customer && cand.customer.consentSms === false && (notifyCh === 'sms' || notifyCh === 'whatsapp')) {
      blockedReason = 'عدم رضایت پیامکی/واتساپ مشتری (Opt-out)';
    } else if (notifyAction && cand.customer && cand.customer.consentEmail === false && notifyCh === 'email') {
      blockedReason = 'عدم رضایت ایمیلی مشتری (Opt-out)';
    } else if (quiet && Boolean(notifyAction)) {
      blockedReason = 'در ساعات سکوت (Quiet Hours) به صف تعویق می‌رود';
    } else if (notifyAction && cap > 0 && todayCount >= cap) {
      blockedReason = `سقف ارسال روزانه مشتری (${cap} پیام) پر شده است`;
    } else if (notifyAction && isChannelCapReached(state.outbox, notifyCh, state.automationPolicy)) {
      blockedReason = `سقف روزانه کانال ${notifyCh} تکمیل شده است`;
    }

    const msgTpl =
      notifyAction?.messageTemplate ||
      rule.messageTemplate ||
      'سلام {{customer.name}} عزیز، پیام اطلاع‌رسانی از {{businessName}}.';
    const renderedMessage = renderRuleTemplate(msgTpl, {
      customer: cand.customer,
      entity: cand.record,
      businessName: state.settings.businessName,
    });

    const taskAct = actions.find((a) => a.type === 'create_task');
    const renderedTask = taskAct
      ? renderRuleTemplate(taskAct.taskTitleTemplate || rule.taskTitleTemplate || 'پیگیری {{customer.name}}', {
          customer: cand.customer,
          entity: cand.record,
          businessName: state.settings.businessName,
        })
      : undefined;

    const actionSummaries = actions.map((a) => {
      if (a.type === 'update_field') return `${ACTION_NAME_FA[a.type]}: ${a.field} → ${a.value}`;
      if (a.type === 'change_stage') return `${ACTION_NAME_FA[a.type]} → ${a.stage}`;
      if (a.type === 'assign_owner') return `${ACTION_NAME_FA[a.type]}: ${a.ownerName || 'چرخشی'}`;
      if (a.type === 'call_webhook') return `${ACTION_NAME_FA[a.type]}: ${a.webhookUrl || 'https://hooks.clientflow.ir/event'}`;
      if (a.type === 'add_tag') return `${ACTION_NAME_FA[a.type]}: #${a.tag || 'vip'}`;
      if (a.type === 'create_ticket') return `${ACTION_NAME_FA[a.type]}: ${a.ticketSubjectTemplate || 'تیکت خودکار'}`;
      return ACTION_NAME_FA[a.type];
    });

    items.push({
      entityId: cand.entityId,
      customerName: cand.customer?.name ?? String(cand.record.contactName ?? cand.entityId),
      phone: cand.customer?.phone ?? String(cand.record.phone ?? '-'),
      renderedMessage,
      renderedTask,
      actionSummaries,
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
