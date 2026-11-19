import { useMemo, useState } from 'react';
import {
  AlertOctagon,
  BellRing,
  CheckCircle2,
  FlaskConical,
  MessageSquarePlus,
  MessageSquareReply,
  Moon,
  Play,
  Plus,
  RefreshCw,
  Sliders,
  Trash2,
} from 'lucide-react';
import { Modal } from '../components/Modal';
import { useClientFlow } from '../store/useClientFlowStore';
import type {
  NotificationChannel,
  NotificationDeliveryStatus,
  Rule,
  RuleCondition,
  RuleTargetEntity,
  RuleTriggerType,
} from '../types';
import type { DryRunResult } from '../utils/automationEngine';
import { formatJalaliDateTime, toFa } from '../utils/jalali';

const PACK_NAME: Record<NonNullable<Rule['pack']>, string> = {
  all: 'همه بسته‌ها',
  clinic: 'کلینیک',
  shop: 'فروشگاه',
  software: 'نرم‌افزاری / IT',
  b2b: 'B2B و پیمانکاری',
  education: 'آموزشگاه',
  realestate: 'املاک و خودرو',
  salon: 'آرایشگاه و باشگاه',
  restaurant: 'رستوران و کافه',
  freelancer: 'فریلنسر',
  general: 'عمومی',
};

const TRIGGER_LABEL: Record<RuleTriggerType, string> = {
  schedule: 'زمان‌بندی (هر ۳۰ ثانیه)',
  on_create: 'در لحظه ایجاد رکورد (OnCreate)',
  on_update: 'در لحظه ویرایش (OnUpdate)',
  on_stage_change: 'تغییر مرحله / وضعیت (OnStageChange)',
  on_ticket_create: 'در لحظه ثبت تیکت پشتیبانی',
};

const ENTITY_LABEL: Record<RuleTargetEntity, string> = {
  customer: 'مشتری',
  order: 'سفارش',
  appointment: 'نوبت',
  opportunity: 'فرصت فروش',
  ticket: 'تیکت',
};

const ENTITY_FIELDS: Record<RuleTargetEntity, { value: string; label: string }[]> = {
  customer: [
    { value: 'lifecycle', label: 'چرخه عمر (lead/active/vip/churned)' },
    { value: 'source', label: 'منبع جذب' },
    { value: 'tags', label: 'برچسب‌ها' },
    { value: 'personType', label: 'نوع شخصیت (individual/organization)' },
    { value: 'consentSms', label: 'رضایت پیامک (true/false)' },
  ],
  order: [
    { value: 'status', label: 'وضعیت سفارش (new/confirmed/shipped/delivered)' },
    { value: 'amount', label: 'مبلغ سفارش (تومان)' },
    { value: 'customer.lifecycle', label: 'چرخه عمر مشتری' },
  ],
  appointment: [
    { value: 'status', label: 'وضعیت نوبت (booked/confirmed/checked_in/done)' },
    { value: 'customer.lifecycle', label: 'چرخه عمر مشتری' },
  ],
  opportunity: [
    { value: 'stage', label: 'مرحله قیف (lead/contacted/proposal/negotiation/won/lost)' },
    { value: 'amount', label: 'مبلغ معامله (تومان)' },
    { value: 'source', label: 'منبع سرنخ' },
  ],
  ticket: [
    { value: 'priority', label: 'اولویت (low/normal/high)' },
    { value: 'status', label: 'وضعیت (open/pending/resolved)' },
    { value: 'category', label: 'دسته‌بندی' },
  ],
};

const CHANNEL_LABEL: Record<NotificationChannel, string> = {
  sms: 'پیامک (SMS)',
  email: 'ایمیل',
  push: 'اعلان Push',
  in_app: 'درون‌برنامه‌ای',
};

const DELIVERY_LABEL: Record<NotificationDeliveryStatus, { label: string; cls: string }> = {
  queued: { label: 'در صف', cls: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  sent: { label: 'ارسال‌شده', cls: 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300' },
  delivered: { label: 'تحویل‌شده', cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' },
  retrying: { label: 'در صف Retry (Backoff)', cls: 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300' },
  failed: { label: 'ناموفق', cls: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300' },
  dead_letter: { label: 'صف خطای دائم (Dead-letter)', cls: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300' },
  deferred_quiet: { label: 'معوق ساعات سکوت', cls: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300' },
};

const TEMPLATE_VARS = [
  '{{customer.name}}',
  '{{customer.phone}}',
  '{{customer.lifecycle}}',
  '{{entity.status}}',
  '{{entity.amount}}',
  '{{businessName}}',
];

export function AutomationPage() {
  const {
    state,
    toggleRule,
    addRule,
    deleteRule,
    updateAutomationPolicy,
    dryRunRule,
    sendSimulatedSms,
    runAutomationNow,
    retryNotification,
    processNotificationRetries,
    simulateDeliveryFailure,
    clearOutbox,
    simulateSmsConfirmReply,
  } = useClientFlow();

  const [tab, setTab] = useState<'rules' | 'outbox' | 'policy' | 'logs'>('rules');
  const [channelFilter, setChannelFilter] = useState<'all' | NotificationChannel>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'delivered' | 'retrying' | 'dead_letter' | 'deferred_quiet'>('all');

  // Structured Rule Builder Modal
  const [ruleOpen, setRuleOpen] = useState(false);
  const [ruleName, setRuleName] = useState('');
  const [triggerType, setTriggerType] = useState<RuleTriggerType>('schedule');
  const [targetEntity, setTargetEntity] = useState<RuleTargetEntity>('customer');
  const [conditionLogic, setConditionLogic] = useState<'AND' | 'OR' | 'NOT'>('AND');
  const [conditions, setConditions] = useState<RuleCondition[]>([
    { id: 'c1', field: 'lifecycle', op: 'eq', value: 'vip' },
  ]);
  const [actionType, setActionType] = useState<'send_notification' | 'create_task' | 'both'>('both');
  const [actionChannel, setActionChannel] = useState<NotificationChannel>('sms');
  const [messageTemplate, setMessageTemplate] = useState(
    'سلام {{customer.name}} عزیز، پیام اطلاع‌رسانی ویژه از {{businessName}}.',
  );
  const [taskTitleTemplate, setTaskTitleTemplate] = useState('پیگیری خودکار {{customer.name}}');
  const [dailyCap, setDailyCap] = useState(3);
  const [respectQuiet, setRespectQuiet] = useState(true);
  const [rulePack, setRulePack] = useState<NonNullable<Rule['pack']>>('all');

  // Dry-run Simulator Modal
  const [dryRunTarget, setDryRunTarget] = useState<Rule | null>(null);
  const [dryRunHour, setDryRunHour] = useState<number | undefined>(undefined);
  const [dryRunResult, setDryRunResult] = useState<DryRunResult | null>(null);

  // Manual Multi-channel Send Modal
  const [smsOpen, setSmsOpen] = useState(false);
  const [smsCustomerId, setSmsCustomerId] = useState(state.customers[0]?.id ?? '');
  const [smsChannel, setSmsChannel] = useState<NotificationChannel>('sms');
  const [smsBody, setSmsBody] = useState('');
  const [smsError, setSmsError] = useState('');

  const filteredOutbox = useMemo(() => {
    return state.outbox.filter((m) => {
      if (channelFilter !== 'all' && m.channel !== channelFilter) return false;
      const st = m.deliveryStatus ?? 'delivered';
      if (statusFilter !== 'all' && st !== statusFilter) return false;
      return true;
    });
  }, [state.outbox, channelFilter, statusFilter]);

  const queueStats = useMemo(() => {
    const retrying = state.outbox.filter((m) => m.deliveryStatus === 'retrying').length;
    const dead = state.outbox.filter((m) => m.deliveryStatus === 'dead_letter').length;
    const quiet = state.outbox.filter((m) => m.deliveryStatus === 'deferred_quiet').length;
    return { retrying, dead, quiet };
  }, [state.outbox]);

  const handleCreateRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleName.trim()) return;
    const condSummary =
      conditions.length === 0
        ? 'بدون شرط'
        : conditions.map((c) => `${c.field} ${c.op} ${c.value}`).join(` ${conditionLogic} `);
    addRule({
      name: ruleName.trim(),
      trigger: TRIGGER_LABEL[triggerType],
      condition: `${conditionLogic === 'NOT' ? 'NOT (' : ''}${condSummary}${conditionLogic === 'NOT' ? ')' : ''}`,
      action: `${actionType === 'create_task' ? 'ایجاد وظیفه' : actionType === 'both' ? `اعلان ${CHANNEL_LABEL[actionChannel]} + وظیفه` : `اعلان ${CHANNEL_LABEL[actionChannel]}`}`,
      active: true,
      pack: rulePack,
      triggerType,
      targetEntity,
      conditionLogic,
      conditions,
      actionType,
      actionChannel,
      messageTemplate,
      taskTitleTemplate,
      dailyCapPerCustomer: dailyCap,
      respectQuietHours: respectQuiet,
    });
    setRuleName('');
    setRuleOpen(false);
  };

  const handleOpenDryRun = (rule: Rule, hour?: number) => {
    setDryRunTarget(rule);
    setDryRunHour(hour);
    setDryRunResult(dryRunRule(rule, hour));
  };

  const handleSendManualSms = (e: React.FormEvent) => {
    e.preventDefault();
    setSmsError('');
    const res = sendSimulatedSms(smsCustomerId, smsBody, smsChannel);
    if (!res.ok) {
      setSmsError(res.error ?? 'خطا در ثبت اعلان');
      return;
    }
    setSmsBody('');
    setSmsOpen(false);
    setTab('outbox');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => setTab('rules')}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === 'rules'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            قوانین اتوماسیون ({toFa(state.rules.length)})
          </button>
          <button
            type="button"
            onClick={() => setTab('outbox')}
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === 'outbox'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <BellRing size={13} />
            صف چندکاناله اعلان ({toFa(state.outbox.length)})
            {(queueStats.retrying > 0 || queueStats.dead > 0) && (
              <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                {toFa(queueStats.retrying + queueStats.dead)}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setTab('policy')}
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === 'policy'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <Sliders size={13} />
            ساعات سکوت و سقف ارسال
          </button>
          <button
            type="button"
            onClick={() => setTab('logs')}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === 'logs'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            گزارش اجرا ({toFa(state.automationLogs.length)})
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setSmsError('');
              setSmsOpen(true);
            }}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <MessageSquarePlus size={15} />
            ارسال اعلان دستی
          </button>
          <button
            type="button"
            onClick={() => setRuleOpen(true)}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Plus size={15} />
            ساخت قانون پویا
          </button>
          <button
            type="button"
            onClick={() => runAutomationNow(false)}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700"
          >
            <Play size={15} />
            اجرای فوری موتور
          </button>
        </div>
      </div>

      {tab === 'rules' && (
        <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
          {state.rules.map((rule) => {
            const matchesPack =
              !rule.pack || rule.pack === 'all' || rule.pack === state.settings.industryPack;
            const isDynamic = Boolean(rule.targetEntity);
            return (
              <div key={rule.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    <span>{rule.name}</span>
                    {isDynamic && (
                      <span className="rounded bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                        موتور پویا ({rule.conditionLogic ?? 'AND'})
                      </span>
                    )}
                    {rule.pack && rule.pack !== 'all' && (
                      <span className="text-xs font-normal text-indigo-600 dark:text-indigo-400">
                        · مخصوص بسته {PACK_NAME[rule.pack]}
                        {!matchesPack && ' (غیرفعال در بسته فعلی)'}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    محرک: {rule.trigger} · شرط: {rule.condition} · اقدام: {rule.action}
                  </div>
                  {rule.messageTemplate && (
                    <div className="text-[11px] text-slate-500">
                      قالب پیام: <span className="text-slate-700 dark:text-slate-300">{rule.messageTemplate}</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {isDynamic && (
                    <button
                      type="button"
                      onClick={() => handleOpenDryRun(rule, undefined)}
                      className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300"
                    >
                      <FlaskConical size={13} />
                      تست Dry-run
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => toggleRule(rule.id)}
                    className={`whitespace-nowrap rounded-lg border px-3.5 py-1.5 text-xs font-medium transition-colors ${
                      rule.active
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400'
                        : 'border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    {rule.active ? 'فعال' : 'متوقف'}
                  </button>
                  {!['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7'].includes(rule.id) && (
                    <button
                      type="button"
                      onClick={() => deleteRule(rule.id)}
                      className="rounded-lg border border-rose-200 p-1.5 text-rose-600 hover:bg-rose-50 dark:border-rose-900"
                      title="حذف قانون"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'outbox' && (
        <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="فیلتر کانال"
                value={channelFilter}
                onChange={(e) => setChannelFilter(e.target.value as typeof channelFilter)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="all">همه کانال‌ها</option>
                <option value="sms">پیامک (SMS)</option>
                <option value="email">ایمیل</option>
                <option value="push">اعلان Push</option>
                <option value="in_app">درون‌برنامه‌ای</option>
              </select>
              <select
                aria-label="فیلتر وضعیت تحویل"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="all">همه وضعیت‌ها</option>
                <option value="delivered">تحویل‌شده</option>
                <option value="retrying">در صف Retry ({toFa(queueStats.retrying)})</option>
                <option value="deferred_quiet">معوق ساعات سکوت ({toFa(queueStats.quiet)})</option>
                <option value="dead_letter">صف Dead-letter ({toFa(queueStats.dead)})</option>
              </select>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={processNotificationRetries}
                className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300"
              >
                <RefreshCw size={13} />
                اجرای چرخه Retry / Backoff
              </button>
              {state.outbox.length > 0 && (
                <button
                  type="button"
                  onClick={clearOutbox}
                  className="inline-flex items-center gap-1 text-xs text-rose-600 hover:underline dark:text-rose-400"
                >
                  <Trash2 size={14} />
                  پاک کردن صف
                </button>
              )}
            </div>
          </div>

          {filteredOutbox.length === 0 ? (
            <p className="p-8 text-center text-xs text-slate-500">موردی در صف اعلان‌ها با این فیلتر یافت نشد.</p>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {filteredOutbox.map((msg) => {
                const deliv = msg.deliveryStatus ?? 'delivered';
                const badge = DELIVERY_LABEL[deliv];
                return (
                  <div key={msg.id} className="p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium dark:bg-slate-800">
                          {CHANNEL_LABEL[msg.channel]}
                        </span>
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {msg.customerName || 'مشتری'}
                        </span>
                        <span className="tabular-nums text-slate-600 dark:text-slate-300" dir="ltr">
                          {toFa(msg.to)}
                        </span>
                        {msg.ruleName && (
                          <span className="text-indigo-600 dark:text-indigo-400">· {msg.ruleName}</span>
                        )}
                        <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${badge.cls}`}>
                          {badge.label}
                          {(msg.retryCount ?? 0) > 0 &&
                            ` (${toFa(msg.retryCount ?? 0)}/${toFa(msg.maxRetries ?? state.automationPolicy.maxRetries)})`}
                        </span>
                      </div>
                      <span className="tabular-nums text-slate-500 dark:text-slate-400">
                        {formatJalaliDateTime(msg.at)}
                      </span>
                    </div>

                    <p className="mt-1.5 text-sm text-slate-700 dark:text-slate-300">{msg.body}</p>

                    {msg.lastError && (
                      <div className="mt-1.5 flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400">
                        <AlertOctagon size={13} />
                        <span>{msg.lastError}</span>
                        {msg.nextRetryAt && (
                          <span className="tabular-nums text-slate-500">
                            (تلاش بعدی: {formatJalaliDateTime(msg.nextRetryAt)})
                          </span>
                        )}
                      </div>
                    )}

                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      {deliv !== 'delivered' && (
                        <button
                          type="button"
                          onClick={() => retryNotification(msg.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                        >
                          <RefreshCw size={12} />
                          ارسال مجدد فوری
                        </button>
                      )}
                      {deliv !== 'dead_letter' && (
                        <button
                          type="button"
                          onClick={() => simulateDeliveryFailure(msg.id)}
                          className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                        >
                          شبیه‌سازی خطای درگاه (تست Retry / Dead-letter)
                        </button>
                      )}
                      {msg.canSimulateConfirm && msg.appointmentId && (
                        <>
                          {msg.confirmedByReply ? (
                            <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400">
                              <CheckCircle2 size={14} />
                              تأیید نوبت با پیامک مشتری ثبت شد
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => simulateSmsConfirmReply(msg.appointmentId!, msg.id)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300"
                            >
                              <MessageSquareReply size={14} />
                              شبیه‌سازی پاسخ «تأیید» مشتری
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'policy' && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Moon size={16} className="text-indigo-600" />
            تنظیمات ساعات سکوت (Quiet Hours)، سقف ارسال و سیاست تلاش مجدد
          </div>
          <p className="mt-1 text-xs text-slate-500">
            پیام‌های خودکاری که در بازه ساعات سکوت تولید شوند به جای ارسال شبانه در وضعیت «معوق ساعات سکوت» قرار می‌گیرند.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 p-3 text-xs dark:border-slate-800">
              <input
                type="checkbox"
                checked={state.automationPolicy.quietHoursEnabled}
                onChange={(e) => updateAutomationPolicy({ quietHoursEnabled: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600"
              />
              فعال‌سازی ساعات سکوت شبانه
            </label>
            <div className="rounded-lg border border-slate-200 p-3 text-xs dark:border-slate-800">
              <div className="mb-1 text-slate-500">شروع سکوت (ساعت ۰..۲۳)</div>
              <input
                type="number"
                min={0}
                max={23}
                value={state.automationPolicy.quietStartHour}
                onChange={(e) => updateAutomationPolicy({ quietStartHour: Number(e.target.value) })}
                className="w-full rounded border border-slate-200 bg-white px-2 py-1 tabular-nums dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div className="rounded-lg border border-slate-200 p-3 text-xs dark:border-slate-800">
              <div className="mb-1 text-slate-500">پایان سکوت (ساعت ۰..۲۳)</div>
              <input
                type="number"
                min={0}
                max={23}
                value={state.automationPolicy.quietEndHour}
                onChange={(e) => updateAutomationPolicy({ quietEndHour: Number(e.target.value) })}
                className="w-full rounded border border-slate-200 bg-white px-2 py-1 tabular-nums dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div className="rounded-lg border border-slate-200 p-3 text-xs dark:border-slate-800">
              <div className="mb-1 text-slate-500">سقف ارسال روزانه به هر مشتری</div>
              <input
                type="number"
                min={1}
                max={20}
                value={state.automationPolicy.defaultDailyCap}
                onChange={(e) => updateAutomationPolicy({ defaultDailyCap: Number(e.target.value) || 1 })}
                className="w-full rounded border border-slate-200 bg-white px-2 py-1 tabular-nums dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div className="rounded-lg border border-slate-200 p-3 text-xs dark:border-slate-800">
              <div className="mb-1 text-slate-500">حداکثر تلاش مجدد پیش از Dead-letter</div>
              <input
                type="number"
                min={1}
                max={10}
                value={state.automationPolicy.maxRetries}
                onChange={(e) => updateAutomationPolicy({ maxRetries: Number(e.target.value) || 3 })}
                className="w-full rounded border border-slate-200 bg-white px-2 py-1 tabular-nums dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>
        </div>
      )}

      {tab === 'logs' && (
        <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
          {state.automationLogs.length === 0 ? (
            <p className="p-8 text-center text-xs text-slate-500">هنوز گزارشی ثبت نشده است.</p>
          ) : (
            state.automationLogs.map((log) => (
              <div key={log.id} className="flex items-center justify-between gap-3 px-4 py-3 text-xs">
                <div>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{log.ruleName}</span>
                  <span className="mx-2 text-slate-400">·</span>
                  <span className="text-slate-600 dark:text-slate-300">{log.summary}</span>
                </div>
                <span className="shrink-0 tabular-nums text-slate-500 dark:text-slate-400">
                  {formatJalaliDateTime(log.at)}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {/* Structured Dynamic Rule Builder Modal */}
      <Modal open={ruleOpen} onClose={() => setRuleOpen(false)} title="ایجاد قانون اتوماسیون پویا (قابل اجرا در موتور)" maxWidth="xl">
        <form onSubmit={handleCreateRule} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block font-medium text-slate-600 dark:text-slate-400">نام قانون *</label>
              <input
                type="text"
                required
                value={ruleName}
                onChange={(e) => setRuleName(e.target.value)}
                placeholder="مثلاً: ارسال پیامک خوش‌آمدگویی سرنخ‌های اینستاگرام"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block font-medium text-slate-600 dark:text-slate-400">بسته صنعتی</label>
              <select
                value={rulePack}
                onChange={(e) => setRulePack(e.target.value as NonNullable<Rule['pack']>)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="all">همه بسته‌ها</option>
                <option value="clinic">کلینیک</option>
                <option value="shop">فروشگاه</option>
                <option value="software">نرم‌افزاری / IT</option>
                <option value="b2b">B2B و پیمانکاری</option>
                <option value="education">آموزشگاه</option>
                <option value="realestate">املاک و خودرو</option>
                <option value="salon">آرایشگاه و باشگاه</option>
                <option value="restaurant">رستوران و کافه</option>
                <option value="freelancer">فریلنسر</option>
                <option value="general">عمومی</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block font-medium text-slate-600 dark:text-slate-400">محرک (Trigger)</label>
              <select
                value={triggerType}
                onChange={(e) => setTriggerType(e.target.value as RuleTriggerType)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                {(Object.keys(TRIGGER_LABEL) as RuleTriggerType[]).map((k) => (
                  <option key={k} value={k}>
                    {TRIGGER_LABEL[k]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block font-medium text-slate-600 dark:text-slate-400">موجودیت هدف</label>
              <select
                value={targetEntity}
                onChange={(e) => {
                  const nextEnt = e.target.value as RuleTargetEntity;
                  setTargetEntity(nextEnt);
                  const firstField = ENTITY_FIELDS[nextEnt][0]?.value ?? 'status';
                  setConditions([{ id: `c_${Date.now()}`, field: firstField, op: 'eq', value: '' }]);
                }}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                {(Object.keys(ENTITY_LABEL) as RuleTargetEntity[]).map((k) => (
                  <option key={k} value={k}>
                    {ENTITY_LABEL[k]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* AND / OR / NOT Conditions */}
          <div className="space-y-2 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold">شروط اجرا:</span>
                <select
                  value={conditionLogic}
                  onChange={(e) => setConditionLogic(e.target.value as 'AND' | 'OR' | 'NOT')}
                  className="rounded border border-slate-200 bg-white px-2 py-1 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="AND">همه شروط برقرار باشند (AND)</option>
                  <option value="OR">حداقل یکی برقرار باشد (OR)</option>
                  <option value="NOT">هیچ‌کدام برقرار نباشند (NOT)</option>
                </select>
              </div>
              <button
                type="button"
                onClick={() =>
                  setConditions((prev) => [
                    ...prev,
                    {
                      id: `c_${Date.now()}`,
                      field: ENTITY_FIELDS[targetEntity][0]?.value ?? 'status',
                      op: 'eq',
                      value: '',
                    },
                  ])
                }
                className="inline-flex items-center gap-1 rounded border border-indigo-200 px-2 py-1 text-indigo-700 dark:border-indigo-800 dark:text-indigo-300"
              >
                <Plus size={12} />
                افزودن شرط
              </button>
            </div>

            {conditions.map((cond, idx) => (
              <div key={cond.id} className="grid grid-cols-1 gap-2 sm:grid-cols-12">
                <select
                  value={cond.field}
                  onChange={(e) =>
                    setConditions((prev) =>
                      prev.map((c, i) => (i === idx ? { ...c, field: e.target.value } : c)),
                    )
                  }
                  className="rounded border border-slate-200 bg-white px-2 py-1.5 sm:col-span-5 dark:border-slate-700 dark:bg-slate-800"
                >
                  {ENTITY_FIELDS[targetEntity].map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
                <select
                  value={cond.op}
                  onChange={(e) =>
                    setConditions((prev) =>
                      prev.map((c, i) =>
                        i === idx ? { ...c, op: e.target.value as RuleCondition['op'] } : c,
                      ),
                    )
                  }
                  className="rounded border border-slate-200 bg-white px-2 py-1.5 sm:col-span-3 dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="eq">مساوی (=)</option>
                  <option value="neq">نامساوی (≠)</option>
                  <option value="contains">شامل باشد (فازی)</option>
                  <option value="gte">بزرگتر مساوی (≥)</option>
                  <option value="lte">کوچکتر مساوی (≤)</option>
                </select>
                <input
                  type="text"
                  value={cond.value}
                  onChange={(e) =>
                    setConditions((prev) =>
                      prev.map((c, i) => (i === idx ? { ...c, value: e.target.value } : c)),
                    )
                  }
                  placeholder="مقدار مقایسه..."
                  className="rounded border border-slate-200 bg-white px-2 py-1.5 sm:col-span-3 dark:border-slate-700 dark:bg-slate-800"
                />
                <button
                  type="button"
                  onClick={() => setConditions((prev) => prev.filter((_, i) => i !== idx))}
                  className="flex items-center justify-center rounded border border-rose-200 text-rose-600 sm:col-span-1 dark:border-rose-900"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>

          {/* Action, Channel, Template Variables, Quiet Hours & Daily Cap */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block font-medium text-slate-600 dark:text-slate-400">نوع اقدام</label>
              <select
                value={actionType}
                onChange={(e) => setActionType(e.target.value as typeof actionType)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="send_notification">ارسال اعلان</option>
                <option value="create_task">ایجاد وظیفه پیگیری</option>
                <option value="both">هر دو (اعلان + وظیفه)</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block font-medium text-slate-600 dark:text-slate-400">کانال اعلان</label>
              <select
                value={actionChannel}
                onChange={(e) => setActionChannel(e.target.value as NotificationChannel)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="sms">پیامک (SMS)</option>
                <option value="email">ایمیل</option>
                <option value="push">اعلان Push</option>
                <option value="in_app">درون‌برنامه‌ای</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block font-medium text-slate-600 dark:text-slate-400">سقف روزانه برای هر مشتری</label>
              <input
                type="number"
                min={1}
                max={20}
                value={dailyCap}
                onChange={(e) => setDailyCap(Number(e.target.value) || 1)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 tabular-nums dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>

          {actionType !== 'create_task' && (
            <div>
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <label className="font-medium text-slate-600 dark:text-slate-400">قالب متن اعلان</label>
                <div className="flex flex-wrap gap-1">
                  {TEMPLATE_VARS.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setMessageTemplate((prev) => `${prev} ${v}`)}
                      className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-indigo-700 hover:bg-indigo-50 dark:bg-slate-800 dark:text-indigo-300"
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                rows={2}
                value={messageTemplate}
                onChange={(e) => setMessageTemplate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          )}

          {actionType !== 'send_notification' && (
            <div>
              <label className="mb-1 block font-medium text-slate-600 dark:text-slate-400">عنوان وظیفه خودکار</label>
              <input
                type="text"
                value={taskTitleTemplate}
                onChange={(e) => setTaskTitleTemplate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          )}

          <label className="flex cursor-pointer items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={respectQuiet}
              onChange={(e) => setRespectQuiet(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600"
            />
            رعایت ساعات سکوت شبانه (Quiet Hours) در ارسال اعلان
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setRuleOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm dark:border-slate-700"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              ثبت قانون پویا
            </button>
          </div>
        </form>
      </Modal>

      {/* Dry-Run Simulator Modal */}
      <Modal
        open={Boolean(dryRunTarget)}
        onClose={() => setDryRunTarget(null)}
        title={`شبیه‌ساز Dry-run: ${dryRunTarget?.name ?? ''}`}
        maxWidth="xl"
      >
        {dryRunTarget && dryRunResult && (
          <div className="space-y-4 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/40">
              <span>تست رفتار در ساعت شبیه‌سازی‌شده (برای بررسی Quiet Hours):</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenDryRun(dryRunTarget, undefined)}
                  className={`rounded px-2.5 py-1 ${dryRunHour === undefined ? 'bg-indigo-600 text-white' : 'border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'}`}
                >
                  ساعت واقعی سیستم
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenDryRun(dryRunTarget, 23)}
                  className={`rounded px-2.5 py-1 ${dryRunHour === 23 ? 'bg-indigo-600 text-white' : 'border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'}`}
                >
                  ساعت ۲۳:۰۰ (شب / سکوت)
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenDryRun(dryRunTarget, 12)}
                  className={`rounded px-2.5 py-1 ${dryRunHour === 12 ? 'bg-indigo-600 text-white' : 'border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'}`}
                >
                  ساعت ۱۲:۰۰ (روز)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                <div className="text-slate-500">رکورد اسکن‌شده</div>
                <div className="mt-1 text-lg font-bold tabular-nums">{toFa(dryRunResult.totalScanned)}</div>
              </div>
              <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                <div className="text-slate-500">تطبیق با شروط</div>
                <div className="mt-1 text-lg font-bold tabular-nums text-indigo-600">{toFa(dryRunResult.matchedCount)}</div>
              </div>
              <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                <div className="text-slate-500">ارسال/اجرای فوری</div>
                <div className="mt-1 text-lg font-bold tabular-nums text-emerald-600">{toFa(dryRunResult.willExecuteCount)}</div>
              </div>
              <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                <div className="text-slate-500">مسدود / معوق</div>
                <div className="mt-1 text-lg font-bold tabular-nums text-amber-600">{toFa(dryRunResult.blockedCount)}</div>
              </div>
            </div>

            <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-800">
              {dryRunResult.items.length === 0 ? (
                <p className="p-6 text-center text-slate-400">هیچ رکوردی با شروط این قانون مطابقت نداشت.</p>
              ) : (
                <div className="divide-y divide-slate-200 dark:divide-slate-800">
                  {dryRunResult.items.map((item) => (
                    <div key={item.entityId} className="p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold">
                          {item.customerName} ({toFa(item.phone)})
                        </span>
                        {item.blockedReason ? (
                          <span className="rounded bg-amber-50 px-2 py-0.5 text-[11px] text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                            {item.blockedReason}
                          </span>
                        ) : (
                          <span className="rounded bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                            آماده اجرا
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-slate-600 dark:text-slate-300">خروجی قالب پیام: {item.renderedMessage}</p>
                      {item.renderedTask && (
                        <p className="mt-0.5 text-indigo-600 dark:text-indigo-400">وظیفه: {item.renderedTask}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Manual Multi-Channel Notification Modal */}
      <Modal
        open={smsOpen}
        onClose={() => setSmsOpen(false)}
        title="ارسال اعلان شبیه‌سازی‌شده به مشتری"
        maxWidth="md"
      >
        <form onSubmit={handleSendManualSms} className="space-y-4">
          {smsError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
              {smsError}
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">مخاطب</label>
              <select
                value={smsCustomerId}
                onChange={(e) => setSmsCustomerId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                {state.customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({toFa(c.phone)})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">کانال ارسال</label>
              <select
                value={smsChannel}
                onChange={(e) => setSmsChannel(e.target.value as NotificationChannel)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="sms">پیامک (SMS)</option>
                <option value="email">ایمیل</option>
                <option value="push">اعلان Push</option>
                <option value="in_app">درون‌برنامه‌ای</option>
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">متن پیام *</label>
            <textarea
              rows={3}
              required
              value={smsBody}
              onChange={(e) => setSmsBody(e.target.value)}
              placeholder="متن پیامک یا اعلان..."
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setSmsOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm dark:border-slate-700"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              ارسال و ثبت در صف
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
