import { useMemo, useState } from 'react';
import {
  AlertOctagon,
  BellRing,
  CheckCircle2,
  Edit3,
  FileText,
  FlaskConical,
  MessageSquarePlus,
  MessageSquareReply,
  Moon,
  Plus,
  RefreshCw,
  RotateCcw,
  Sliders,
  Trash2,
} from 'lucide-react';
import { Modal } from '../components/Modal';
import { AutomationHealthCard } from '../components/automation/AutomationHealthCard';
import { RuleBuilderModal } from '../components/automation/RuleBuilderModal';
import { TemplatesAndWebhookTab } from '../components/automation/TemplatesAndWebhookTab';
import { useClientFlow } from '../store/useClientFlowStore';
import type {
  NotificationChannel,
  NotificationDeliveryStatus,
  Rule,
} from '../types';
import {
  countTodayChannelNotifications,
  getNormalizedRuleActions,
  type DryRunResult,
} from '../utils/automationEngine';
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

const CHANNEL_LABEL: Record<NotificationChannel, string> = {
  sms: 'پیامک (SMS)',
  whatsapp: 'واتساپ',
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
  dead_letter: { label: 'صف Dead-letter', cls: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300' },
  deferred_quiet: { label: 'معوق ساعات سکوت', cls: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300' },
};

const LOG_STATUS_BADGE: Record<'success' | 'skipped' | 'failed', { label: string; cls: string }> = {
  success: { label: 'موفق', cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' },
  skipped: { label: 'معوق / رد شده', cls: 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300' },
  failed: { label: 'ناموفق', cls: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300' },
};

export function AutomationPage() {
  const {
    state,
    toggleRule,
    deleteRule,
    updateAutomationPolicy,
    dryRunRule,
    sendSimulatedSms,
    retryAutomationLog,
    retryNotification,
    processNotificationRetries,
    simulateDeliveryFailure,
    clearOutbox,
    simulateSmsConfirmReply,
  } = useClientFlow();

  const [tab, setTab] = useState<'rules' | 'templates' | 'outbox' | 'policy' | 'logs'>('rules');
  const [ruleScopeFilter, setRuleScopeFilter] = useState<'all' | 'current_pack' | 'active'>('all');
  const [channelFilter, setChannelFilter] = useState<'all' | NotificationChannel>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'delivered' | 'retrying' | 'dead_letter' | 'deferred_quiet'>('all');
  const [logStatusFilter, setLogStatusFilter] = useState<'all' | 'success' | 'skipped' | 'failed'>('all');

  // Rule Builder Modal (Create or Edit)
  const [ruleOpen, setRuleOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);

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

  const filteredRules = useMemo(() => {
    return state.rules.filter((r) => {
      if (ruleScopeFilter === 'active' && !r.active) return false;
      if (ruleScopeFilter === 'current_pack') {
        const matchPack = !r.pack || r.pack === 'all' || r.pack === state.settings.industryPack;
        if (!matchPack) return false;
      }
      return true;
    });
  }, [state.rules, ruleScopeFilter, state.settings.industryPack]);

  const filteredOutbox = useMemo(() => {
    return state.outbox.filter((m) => {
      if (channelFilter !== 'all' && m.channel !== channelFilter) return false;
      const st = m.deliveryStatus ?? 'delivered';
      if (statusFilter !== 'all' && st !== statusFilter) return false;
      return true;
    });
  }, [state.outbox, channelFilter, statusFilter]);

  const filteredLogs = useMemo(() => {
    return state.automationLogs.filter((l) => {
      const st = l.status ?? 'success';
      if (logStatusFilter !== 'all' && st !== logStatusFilter) return false;
      return true;
    });
  }, [state.automationLogs, logStatusFilter]);

  const queueStats = useMemo(() => {
    const retrying = state.outbox.filter((m) => m.deliveryStatus === 'retrying').length;
    const dead = state.outbox.filter((m) => m.deliveryStatus === 'dead_letter').length;
    const quiet = state.outbox.filter((m) => m.deliveryStatus === 'deferred_quiet').length;
    return { retrying, dead, quiet };
  }, [state.outbox]);

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
      <AutomationHealthCard />

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
            onClick={() => setTab('templates')}
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === 'templates'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <FileText size={13} />
            قالب‌های پیام و وب‌هوک ({toFa((state.messageTemplates ?? []).length)})
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
            ساعات سکوت و سقف کانال‌ها
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
            onClick={() => {
              setEditingRule(null);
              setRuleOpen(true);
            }}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-indigo-700"
          >
            <Plus size={15} />
            ساخت قانون پویا
          </button>
        </div>
      </div>

      {tab === 'rules' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 text-xs dark:bg-slate-900">
              {(
                [
                  ['all', 'همه قوانین'],
                  ['current_pack', 'مرتبط با بسته فعلی'],
                  ['active', 'فقط قوانین فعال'],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setRuleScopeFilter(k)}
                  className={`rounded-md px-3 py-1 font-medium transition-colors ${
                    ruleScopeFilter === k
                      ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <span className="text-[11px] text-slate-500">
              قوانین آماده بسته‌های صنعتی به‌صورت پیش‌فرض «متوقف» نصب می‌شوند تا پس از بازبینی فعال شوند.
            </span>
          </div>

          <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
            {filteredRules.map((rule) => {
              const matchesPack =
                !rule.pack || rule.pack === 'all' || rule.pack === state.settings.industryPack;
              const isDynamic = Boolean(rule.targetEntity);
              const actCount = getNormalizedRuleActions(rule).length;
              return (
                <div key={rule.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                      <span>{rule.name}</span>
                      {isDynamic && (
                        <span className="rounded bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                          {rule.triggerType === 'on_webhook'
                            ? `Webhook: ${rule.webhookTopic ?? 'event'}`
                            : rule.triggerType === 'on_event'
                              ? `Event: ${rule.eventName ?? 'custom'}`
                              : `${rule.conditionLogic ?? 'AND'} · ${toFa(actCount)} اقدام`}
                        </span>
                      )}
                      {rule.pack && rule.pack !== 'all' && (
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-normal text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          بسته {PACK_NAME[rule.pack]}
                          {!matchesPack && ' (غیرمرتبط با بسته فعلی)'}
                        </span>
                      )}
                      {(rule.cooldownMinutes ?? 0) > 0 && (
                        <span className="text-[11px] font-normal tabular-nums text-slate-400">
                          Cooldown: {toFa(rule.cooldownMinutes ?? 0)}د
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      محرک: {rule.trigger} · شرط: {rule.condition} · اقدام: {rule.action}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {isDynamic && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleOpenDryRun(rule, undefined)}
                          className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300"
                        >
                          <FlaskConical size={13} />
                          تست Dry-run
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingRule(rule);
                            setRuleOpen(true);
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                          title="ویرایش قانون"
                        >
                          <Edit3 size={13} />
                          ویرایش
                        </button>
                      </>
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
        </div>
      )}

      {tab === 'templates' && <TemplatesAndWebhookTab />}

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
                {(Object.keys(CHANNEL_LABEL) as NotificationChannel[]).map((ch) => (
                  <option key={ch} value={ch}>
                    {CHANNEL_LABEL[ch]}
                  </option>
                ))}
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
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Moon size={16} className="text-indigo-600" />
              تنظیمات ساعات سکوت (Quiet Hours)، سقف ارسال مشتری و کانال‌ها
            </div>
            <p className="mt-1 text-xs text-slate-500">
              پیام‌های خودکاری که در بازه ساعات سکوت تولید شوند به جای ارسال شبانه در وضعیت «معوق ساعات سکوت» قرار می‌گیرند.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
              <div className="mb-1 text-slate-500">سقف روزانه برای هر مشتری</div>
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
              <div className="mb-1 text-slate-500">حداکثر Retry پیش از Dead-letter</div>
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

          <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
            <h4 className="mb-3 text-xs font-semibold text-slate-700 dark:text-slate-200">
              محدودیت سقف ارسال روزانه هر کانال ارتباطی (Per-Channel Daily Caps)
            </h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {(Object.keys(CHANNEL_LABEL) as NotificationChannel[]).map((ch) => {
                const capVal = state.automationPolicy.channelDailyCaps?.[ch] ?? 200;
                const usedToday = countTodayChannelNotifications(state.outbox, ch);
                return (
                  <div key={ch} className="rounded-lg border border-slate-200 p-3 text-xs dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{CHANNEL_LABEL[ch]}</span>
                      <span className="tabular-nums text-[11px] text-slate-400">امروز: {toFa(usedToday)}</span>
                    </div>
                    <input
                      type="number"
                      min={1}
                      max={10000}
                      value={capVal}
                      onChange={(e) =>
                        updateAutomationPolicy({
                          channelDailyCaps: {
                            ...(state.automationPolicy.channelDailyCaps ?? {}),
                            [ch]: Math.max(1, Number(e.target.value) || 1),
                          },
                        })
                      }
                      className="mt-2 w-full rounded border border-slate-200 bg-white px-2 py-1 tabular-nums dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {tab === 'logs' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 text-xs dark:bg-slate-900">
              {(
                [
                  ['all', 'همه گزارش‌ها'],
                  ['success', 'موفق'],
                  ['skipped', 'معوق / رد شده'],
                  ['failed', 'ناموفق'],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setLogStatusFilter(k)}
                  className={`rounded-md px-3 py-1 font-medium transition-colors ${
                    logStatusFilter === k
                      ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
            {filteredLogs.length === 0 ? (
              <p className="p-8 text-center text-xs text-slate-500">گزارشی با این فیلتر ثبت نشده است.</p>
            ) : (
              filteredLogs.map((log) => {
                const st = log.status ?? 'success';
                const badge = LOG_STATUS_BADGE[st];
                return (
                  <div key={log.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded px-2 py-0.5 text-[10px] font-medium ${badge.cls}`}>
                          {badge.label}
                        </span>
                        <span className="font-semibold text-slate-900 dark:text-slate-100">{log.ruleName}</span>
                        {log.triggerSource && (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500 dark:bg-slate-800">
                            {log.triggerSource}
                          </span>
                        )}
                      </div>
                      <div className="text-slate-600 dark:text-slate-300">{log.summary}</div>
                      {log.reason && (
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          علت وضعیت: {log.reason}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      {log.matchedCount !== undefined && (
                        <span className="tabular-nums text-[11px] text-slate-500">
                          تطبیق: {toFa(log.matchedCount)} · اجرا: {toFa(log.executedCount ?? 0)} · رد: {toFa(log.skippedCount ?? 0)}
                        </span>
                      )}
                      {(st === 'failed' || st === 'skipped') && (
                        <button
                          type="button"
                          onClick={() => retryAutomationLog(log.id)}
                          className="inline-flex items-center gap-1 rounded border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-medium text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300"
                        >
                          <RotateCcw size={12} />
                          اجرای مجدد
                        </button>
                      )}
                      <span className="shrink-0 tabular-nums text-slate-500 dark:text-slate-400">
                        {formatJalaliDateTime(log.at)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Visual Rule Builder Modal */}
      <RuleBuilderModal
        open={ruleOpen}
        onClose={() => {
          setRuleOpen(false);
          setEditingRule(null);
        }}
        editingRule={editingRule}
      />

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
                <div className="text-slate-500">اجرای فوری</div>
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
                    <div key={item.entityId} className="space-y-1 p-3">
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
                      <div className="flex flex-wrap gap-1">
                        {item.actionSummaries.map((s, idx) => (
                          <span
                            key={idx}
                            className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                      <p className="text-slate-600 dark:text-slate-300">خروجی قالب پیام: {item.renderedMessage}</p>
                      {item.renderedTask && (
                        <p className="text-indigo-600 dark:text-indigo-400">وظیفه: {item.renderedTask}</p>
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
                {(Object.keys(CHANNEL_LABEL) as NotificationChannel[]).map((ch) => (
                  <option key={ch} value={ch}>
                    {CHANNEL_LABEL[ch]}
                  </option>
                ))}
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
              placeholder="متن پیامک، واتساپ یا اعلان..."
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
