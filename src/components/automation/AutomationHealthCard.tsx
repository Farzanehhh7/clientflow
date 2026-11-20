import { Activity, AlertOctagon, BellRing, PauseCircle, Play, RefreshCw, ShieldCheck } from 'lucide-react';
import { useMemo } from 'react';
import { useClientFlow } from '../../store/useClientFlowStore';
import { formatJalaliDateTime, toFa } from '../../utils/jalali';

export function AutomationHealthCard() {
  const {
    state,
    updateAutomationPolicy,
    runAutomationNow,
    processNotificationRetries,
  } = useClientFlow();

  const runnerEnabled = state.automationPolicy.backgroundRunnerEnabled ?? true;
  const intervalSec = state.automationPolicy.runnerIntervalSec ?? 30;

  const stats = useMemo(() => {
    const activeRules = state.rules.filter((r) => r.active).length;
    const totalLogs = state.automationLogs.length;
    const successLogs = state.automationLogs.filter((l) => (l.status ?? 'success') === 'success').length;
    const skippedLogs = state.automationLogs.filter((l) => l.status === 'skipped').length;
    const failedLogs = state.automationLogs.filter((l) => l.status === 'failed').length;
    const successRate = totalLogs > 0 ? Math.round((successLogs / totalLogs) * 100) : 100;

    const retrying = state.outbox.filter((m) => m.deliveryStatus === 'retrying').length;
    const dead = state.outbox.filter((m) => m.deliveryStatus === 'dead_letter').length;
    const deferredQuiet = state.outbox.filter((m) => m.deliveryStatus === 'deferred_quiet').length;

    return {
      activeRules,
      totalRules: state.rules.length,
      successLogs,
      skippedLogs,
      failedLogs,
      successRate,
      retrying,
      dead,
      deferredQuiet,
    };
  }, [state.rules, state.automationLogs, state.outbox]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-2.5">
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-lg ${
              runnerEnabled
                ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400'
                : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
            }`}
          >
            <Activity size={18} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <span>سلامت موتور اتوماسیون (Automation Health)</span>
              <span
                className={`rounded px-2 py-0.5 text-[11px] font-medium ${
                  runnerEnabled
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                    : 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                }`}
              >
                {runnerEnabled ? 'در حال اجرا (پس‌زمینه)' : 'متوقف‌شده'}
              </span>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
              <span>
                تیک‌های پس‌زمینه:{' '}
                <strong className="tabular-nums text-slate-700 dark:text-slate-200">
                  {toFa(state.automationTickCount ?? 0)}
                </strong>
              </span>
              {state.lastAutomationRunAt && (
                <span>
                  آخرین ارزیابی:{' '}
                  <strong className="tabular-nums text-slate-700 dark:text-slate-200">
                    {formatJalaliDateTime(state.lastAutomationRunAt)}
                  </strong>
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="بازه اجرای موتور پس‌زمینه"
            value={intervalSec}
            onChange={(e) => updateAutomationPolicy({ runnerIntervalSec: Number(e.target.value) || 30 })}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
          >
            <option value={15}>هر ۱۵ ثانیه</option>
            <option value={30}>هر ۳۰ ثانیه</option>
            <option value={60}>هر ۶۰ ثانیه</option>
          </select>

          <button
            type="button"
            onClick={() => updateAutomationPolicy({ backgroundRunnerEnabled: !runnerEnabled })}
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              runnerEnabled
                ? 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
            }`}
          >
            {runnerEnabled ? <PauseCircle size={14} /> : <Play size={14} />}
            {runnerEnabled ? 'توقف زمان‌بند' : 'شروع زمان‌بند'}
          </button>

          {(stats.retrying > 0 || stats.deferredQuiet > 0) && (
            <button
              type="button"
              onClick={processNotificationRetries}
              className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <RefreshCw size={13} />
              پردازش صف Retry ({toFa(stats.retrying)})
            </button>
          )}

          <button
            type="button"
            onClick={() => runAutomationNow(false)}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
          >
            <Play size={13} />
            اجرای فوری موتور
          </button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-2.5 dark:border-slate-800 dark:bg-slate-950/40">
          <div className="flex items-center gap-1 text-[11px] text-slate-500">
            <ShieldCheck size={13} className="text-indigo-500" />
            قوانین فعال
          </div>
          <div className="mt-1 text-base font-bold tabular-nums text-slate-900 dark:text-slate-100">
            {toFa(stats.activeRules)} / {toFa(stats.totalRules)}
          </div>
        </div>

        <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-2.5 dark:border-slate-800 dark:bg-slate-950/40">
          <div className="text-[11px] text-slate-500">نرخ موفقیت اجرا</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-base font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
              {toFa(stats.successRate)}٪
            </span>
            <span className="text-[11px] tabular-nums text-slate-500">
              ({toFa(stats.successLogs)} موفق · {toFa(stats.skippedLogs)} معوق)
            </span>
          </div>
        </div>

        <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-2.5 dark:border-slate-800 dark:bg-slate-950/40">
          <div className="flex items-center gap-1 text-[11px] text-slate-500">
            <BellRing size={13} className="text-amber-500" />
            صف تعویق و تلاش مجدد
          </div>
          <div className="mt-1 text-base font-bold tabular-nums text-slate-900 dark:text-slate-100">
            {toFa(stats.retrying)} Retry · {toFa(stats.deferredQuiet)} سکوت
          </div>
        </div>

        <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-2.5 dark:border-slate-800 dark:bg-slate-950/40">
          <div className="flex items-center gap-1 text-[11px] text-slate-500">
            <AlertOctagon size={13} className={stats.dead > 0 || stats.failedLogs > 0 ? 'text-rose-500' : 'text-slate-400'} />
            خطا / Dead-letter
          </div>
          <div
            className={`mt-1 text-base font-bold tabular-nums ${
              stats.dead > 0 || stats.failedLogs > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300'
            }`}
          >
            {toFa(stats.failedLogs)} خطا · {toFa(stats.dead)} دائم
          </div>
        </div>
      </div>
    </div>
  );
}
