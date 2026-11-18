import { useState } from 'react';
import { Play, Trash2 } from 'lucide-react';
import { useClientFlow } from '../store/useClientFlowStore';
import { formatJalaliDateTime, toFa } from '../utils/jalali';

export function AutomationPage() {
  const { state, toggleRule, runAutomationNow, clearOutbox } = useClientFlow();
  const [tab, setTab] = useState<'rules' | 'outbox' | 'logs'>('rules');

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

        <button
          type="button"
          onClick={() => runAutomationNow(false)}
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700"
        >
          <Play size={15} />
          اجرای فوری قوانین
        </button>
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
                        · مخصوص بسته {rule.pack === 'clinic' ? 'کلینیک' : 'فروشگاه'}
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
    </div>
  );
}
