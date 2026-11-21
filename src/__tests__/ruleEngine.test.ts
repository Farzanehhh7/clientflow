import { describe, expect, it } from 'vitest';
import { createInitialState } from '../data/seed';
import type { AutomationPolicy, Customer, Rule } from '../types';
import {
  evaluateRuleConditions,
  isRuleInCooldown,
  isWithinQuietHours,
  renderRuleTemplate,
  resolveRelativeTimeExpr,
  simulateRuleDryRun,
} from '../utils/automationEngine';

describe('Automation Rule Engine', () => {
  it('resolves relative time expressions accurately', () => {
    const baseMs = 1_700_000_000_000;
    expect(resolveRelativeTimeExpr('now', baseMs)).toBe(baseMs);
    expect(resolveRelativeTimeExpr('now+24h', baseMs)).toBe(baseMs + 24 * 3600_000);
    expect(resolveRelativeTimeExpr('now-30m', baseMs)).toBe(baseMs - 30 * 60_000);
    expect(resolveRelativeTimeExpr('now+7d', baseMs)).toBe(baseMs + 7 * 86_400_000);
    expect(resolveRelativeTimeExpr('invalid_expr', baseMs)).toBeNull();
  });

  it('evaluates AND, OR, NOT and relative-hour conditions', () => {
    const nowMs = Date.parse('2026-05-10T10:00:00.000Z');
    const customer: Customer = {
      id: 'c1',
      name: 'سارا محمدی',
      phone: '09121112233',
      tags: ['VIP', 'تهران'],
      lifecycle: 'vip',
      createdAt: '2026-05-01T10:00:00.000Z',
    };
    const record = {
      id: 'apt1',
      status: 'confirmed',
      start: '2026-05-10T18:00:00.000Z', // 8 hours after nowMs
      amount: 2_500_000,
    };

    const andRule: Rule = {
      id: 'r1',
      name: 'تست AND',
      trigger: 'زمان‌بندی نوبت',
      condition: 'VIP و تأییدشده',
      action: 'ارسال پیام',
      active: true,
      triggerType: 'schedule',
      targetEntity: 'appointment',
      conditionLogic: 'AND',
      conditions: [
        { id: 'c1', field: 'status', op: 'eq', value: 'confirmed' },
        { id: 'c2', field: 'start', op: 'within_next_hours', value: '24' },
        { id: 'c3', field: 'customer.lifecycle', op: 'eq', value: 'vip' },
      ],
    };
    expect(evaluateRuleConditions(andRule, record, customer, nowMs)).toBe(true);

    const notRule: Rule = {
      ...andRule,
      conditionLogic: 'NOT',
      conditions: [{ id: 'c4', field: 'status', op: 'eq', value: 'cancelled' }],
    };
    expect(evaluateRuleConditions(notRule, record, customer, nowMs)).toBe(true);

    const orRule: Rule = {
      ...andRule,
      conditionLogic: 'OR',
      conditions: [
        { id: 'c5', field: 'status', op: 'eq', value: 'cancelled' },
        { id: 'c6', field: 'amount', op: 'gte', value: '2000000' },
      ],
    };
    expect(evaluateRuleConditions(orRule, record, customer, nowMs)).toBe(true);
  });

  it('detects quiet hours wrapping midnight and rule cooldown windows', () => {
    const policy: AutomationPolicy = {
      quietHoursEnabled: true,
      quietStartHour: 22,
      quietEndHour: 8,
      defaultDailyCap: 3,
      maxRetries: 2,
      backgroundRunnerEnabled: true,
      runnerIntervalSec: 30,
    };

    expect(isWithinQuietHours(policy, 23)).toBe(true);
    expect(isWithinQuietHours(policy, 3)).toBe(true);
    expect(isWithinQuietHours(policy, 14)).toBe(false);

    const nowMs = Date.parse('2026-05-10T12:00:00.000Z');
    const rule: Rule = {
      id: 'r_cd',
      name: 'Cooldown',
      trigger: 'بروزرسانی',
      condition: 'همه',
      action: 'ارسال پیامک',
      active: true,
      triggerType: 'on_update',
      cooldownMinutes: 60,
    };
    const cooldowns = { r_cd_c1: '2026-05-10T11:30:00.000Z' };
    expect(isRuleInCooldown(cooldowns, rule, 'c1', nowMs)).toBe(true);
    expect(isRuleInCooldown(cooldowns, rule, 'c1', nowMs + 40 * 60_000)).toBe(false);
  });

  it('renders message templates and respects opt-out & quiet hours in dry-run', () => {
    const state = createInitialState();
    const targetCust = state.customers[0];
    state.customers[0] = { ...targetCust, name: 'نگین کریمی', consentSms: false };

    const msg = renderRuleTemplate('سلام {{customer.name}} از {{businessName}}', {
      customer: state.customers[0],
      businessName: 'کلینیک مهر',
    });
    expect(msg).toBe('سلام نگین کریمی از کلینیک مهر');

    const testRule: Rule = {
      id: 'r_dry',
      name: 'یادآوری تست',
      trigger: 'ثبت مشتری',
      condition: 'نام شامل نگین',
      action: 'ارسال پیامک',
      active: true,
      triggerType: 'on_create',
      targetEntity: 'customer',
      respectQuietHours: true,
      conditions: [{ id: 'k1', field: 'name', op: 'contains', value: 'نگین' }],
      actions: [{ id: 'a1', type: 'send_sms', channel: 'sms', messageTemplate: 'سلام {{customer.name}}' }],
    };

    const dry = simulateRuleDryRun(testRule, state, 12);
    expect(dry.matchedCount).toBeGreaterThanOrEqual(1);
    const optOutRow = dry.items.find((i) => i.entityId === targetCust.id);
    expect(optOutRow?.blockedReason).toContain('Opt-out');
  });
});
