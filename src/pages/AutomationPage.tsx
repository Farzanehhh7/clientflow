import { useState } from 'react';
import { CheckCircle2, MessageSquarePlus, MessageSquareReply, Play, Plus, Trash2 } from 'lucide-react';
import { Modal } from '../components/Modal';
import { useClientFlow } from '../store/useClientFlowStore';
import type { Rule } from '../types';
import { formatJalaliDateTime, toFa } from '../utils/jalali';

const PACK_NAME: Record<NonNullable<Rule['pack']>, string> = {
  all: 'همه بسته‌ها',
  clinic: 'کلینیک',
  shop: 'فروشگاه',
  software: 'نرم‌افزاری / IT',
};

export function AutomationPage() {
  const {
    state,
    toggleRule,
    addRule,
    sendSimulatedSms,
    runAutomationNow,
    clearOutbox,
    simulateSmsConfirmReply,
  } = useClientFlow();
  const [tab, setTab] = useState<'rules' | 'outbox' | 'logs'>('rules');

  // New rule modal
  const [ruleOpen, setRuleOpen] = useState(false);
  const [ruleName, setRuleName] = useState('');
  const [ruleTrigger, setRuleTrigger] = useState('زمان‌بندی (هر ۳۰ ثانیه)');
  const [ruleCondition, setRuleCondition] = useState('');
  const [ruleAction, setRuleAction] = useState('ارسال پیامک شبیه‌سازی‌شده + ثبت وظیفه');
  const [rulePack, setRulePack] = useState<NonNullable<Rule['pack']>>('all');

  // Manual simulated SMS modal
  const [smsOpen, setSmsOpen] = useState(false);
  const [smsCustomerId, setSmsCustomerId] = useState(state.customers[0]?.id ?? '');
  const [smsBody, setSmsBody] = useState('');
  const [smsError, setSmsError] = useState('');

  const handleCreateRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleName.trim() || !ruleCondition.trim()) return;
    addRule({
      name: ruleName.trim(),
      trigger: ruleTrigger.trim() || 'دستی / زمان‌بندی',
      condition: ruleCondition.trim(),
      action: ruleAction.trim() || 'ثبت در صندوق پیامک',
      active: true,
      pack: rulePack,
    });
    setRuleName('');
    setRuleCondition('');
    setRuleOpen(false);
  };

  const handleSendManualSms = (e: React.FormEvent) => {
    e.preventDefault();
    setSmsError('');
    const res = sendSimulatedSms(smsCustomerId, smsBody);
    if (!res.ok) {
      setSmsError(res.error ?? 'خطا در ثبت پیامک');
      return;
    }
    setSmsBody('');
    setSmsOpen(false);
    setTab('outbox');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-900">
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
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === 'outbox'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            صندوق پیامک شبیه‌سازی‌شده ({toFa(state.outbox.length)})
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
            ارسال پیامک شبیه‌سازی‌شده
          </button>
          <button
            type="button"
            onClick={() => setRuleOpen(true)}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Plus size={15} />
            قانون جدید
          </button>
          <button
            type="button"
            onClick={() => runAutomationNow(false)}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700"
          >
            <Play size={15} />
            اجرای فوری قوانین
          </button>
        </div>
      </div>

      {tab === 'rules' && (
        <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
          {state.rules.map((rule) => {
            const matchesPack =
              !rule.pack || rule.pack === 'all' || rule.pack === state.settings.industryPack;
            return (
              <div key={rule.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    <span>{rule.name}</span>
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
                </div>

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
              </div>
            );
          })}
        </div>
      )}

      {tab === 'outbox' && (
        <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              پیامک‌های خروجی شبیه‌سازی‌شده (بدون ارسال واقعی به اپراتور)
            </span>
            {state.outbox.length > 0 && (
              <button
                type="button"
                onClick={clearOutbox}
                className="inline-flex items-center gap-1 text-xs text-rose-600 hover:underline dark:text-rose-400"
              >
                <Trash2 size={14} />
                پاک کردن صندوق
              </button>
            )}
          </div>
          {state.outbox.length === 0 ? (
            <p className="p-8 text-center text-xs text-slate-500">صندوق ارسال پیامک خالی است.</p>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {state.outbox.map((msg) => (
                <div key={msg.id} className="p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {msg.customerName || 'مشتری'}
                      </span>
                      <span className="mx-2 text-slate-400">·</span>
                      <span className="tabular-nums text-slate-600 dark:text-slate-300" dir="ltr">
                        {toFa(msg.to)}
                      </span>
                      {msg.ruleName && (
                        <>
                          <span className="mx-2 text-slate-400">·</span>
                          <span className="text-indigo-600 dark:text-indigo-400">{msg.ruleName}</span>
                        </>
                      )}
                    </div>
                    <span className="tabular-nums text-slate-500 dark:text-slate-400">
                      {formatJalaliDateTime(msg.at)}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm text-slate-700 dark:text-slate-300">{msg.body}</p>
                  {msg.canSimulateConfirm && msg.appointmentId && (
                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      {msg.confirmedByReply ? (
                        <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400">
                          <CheckCircle2 size={14} />
                          تأیید نوبت با پیامک مشتری ثبت شد
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => simulateSmsConfirmReply(msg.appointmentId!, msg.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-900/50"
                        >
                          <MessageSquareReply size={14} />
                          شبیه‌سازی پاسخ «تأیید» مشتری
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
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

      {/* New Rule Modal */}
      <Modal open={ruleOpen} onClose={() => setRuleOpen(false)} title="ایجاد قانون اتوماسیون جدید" maxWidth="md">
        <form onSubmit={handleCreateRule} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">نام قانون *</label>
            <input
              type="text"
              required
              value={ruleName}
              onChange={(e) => setRuleName(e.target.value)}
              placeholder="مثلاً: پیگیری مشتریان غیرفعال بیش از ۳۰ روز"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">محرک (Trigger)</label>
              <input
                type="text"
                value={ruleTrigger}
                onChange={(e) => setRuleTrigger(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">بسته صنعتی</label>
              <select
                value={rulePack}
                onChange={(e) => setRulePack(e.target.value as NonNullable<Rule['pack']>)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="all">همه بسته‌ها</option>
                <option value="clinic">کلینیک</option>
                <option value="shop">فروشگاه</option>
                <option value="software">نرم‌افزاری / IT</option>
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">شرط اجرا *</label>
            <input
              type="text"
              required
              value={ruleCondition}
              onChange={(e) => setRuleCondition(e.target.value)}
              placeholder="مثلاً: عدم ثبت سفارش یا نوبت جدید در ۳۰ روز گذشته"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">اقدام (Action)</label>
            <input
              type="text"
              value={ruleAction}
              onChange={(e) => setRuleAction(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
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
              ثبت قانون
            </button>
          </div>
        </form>
      </Modal>

      {/* Manual Simulated SMS Modal */}
      <Modal
        open={smsOpen}
        onClose={() => setSmsOpen(false)}
        title="ارسال پیامک شبیه‌سازی‌شده به مشتری"
        maxWidth="md"
      >
        <form onSubmit={handleSendManualSms} className="space-y-4">
          {smsError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
              {smsError}
            </div>
          )}
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
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">متن پیامک *</label>
            <textarea
              rows={3}
              required
              value={smsBody}
              onChange={(e) => setSmsBody(e.target.value)}
              placeholder="متن پیامک یادآوری یا اطلاع‌رسانی..."
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
              ثبت در صندوق پیامک
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
