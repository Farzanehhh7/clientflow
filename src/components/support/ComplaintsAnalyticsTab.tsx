import { useMemo } from 'react';
import { BarChart3, ShieldAlert } from 'lucide-react';
import { useClientFlow } from '../../store/useClientFlowStore';
import type { ComplaintStatus } from '../../types';
import { formatJalaliDateTime, toFa } from '../../utils/jalali';
import { evaluateTicketSla, isTicketClosedStatus } from '../../utils/slaEngine';
import { COMPLAINT_STATUS_LABEL, TICKET_SEVERITY_COLOR, TICKET_SEVERITY_LABEL } from './supportHelpers';

interface ComplaintsAnalyticsTabProps {
  agents: string[];
  onOpenTicket: (ticketId: string) => void;
}

export function ComplaintsAnalyticsTab({ agents, onOpenTicket }: ComplaintsAnalyticsTabProps) {
  const { state, updateTicket } = useClientFlow();
  const nowMs = Date.now();

  const analytics = useMemo(() => {
    const activeSet = state.tickets.filter((t) => !t.mergedIntoTicketId);
    const total = activeSet.length;
    const resolved = activeSet.filter((t) => isTicketClosedStatus(t.status));
    const evals = activeSet.map((t) =>
      evaluateTicketSla(t, state.slaPolicies, state.settings, state.officialHolidays, nowMs),
    );
    const breachedCount = evals.filter((ev) => ev.overallState === 'breached').length;
    const slaCompliantPct = total > 0 ? Math.round(((total - breachedCount) / total) * 100) : 100;

    const firstRespList = activeSet.filter((t) => t.firstRespondedAt);
    const avgFirstRespMin =
      firstRespList.length > 0
        ? Math.round(
            firstRespList.reduce(
              (sum, t) =>
                sum +
                evaluateTicketSla(t, state.slaPolicies, state.settings, state.officialHolidays, nowMs)
                  .firstRespElapsedMin,
              0,
            ) / firstRespList.length,
          )
        : 0;

    const avgResHours =
      resolved.length > 0
        ? Math.round(
            (resolved.reduce((sum, t) => {
              const ev = evaluateTicketSla(t, state.slaPolicies, state.settings, state.officialHolidays, nowMs);
              return sum + ev.resolutionElapsedMin / 60;
            }, 0) /
              resolved.length) *
              10,
          ) / 10
        : 0;

    const byAgent = agents.map((ag) => {
      const list = activeSet.filter((t) => t.assignee === ag);
      return {
        agent: ag,
        total: list.length,
        open: list.filter((t) => t.status === 'open' || t.status === 'in_progress').length,
        pending: list.filter((t) => t.status === 'pending').length,
        resolved: list.filter((t) => isTicketClosedStatus(t.status)).length,
        escalated: list.filter((t) => {
          const ev = evaluateTicketSla(t, state.slaPolicies, state.settings, state.officialHolidays, nowMs);
          return t.escalated || ev.overallState === 'breached';
        }).length,
      };
    });

    const rootCauseMap = new Map<string, number>();
    activeSet.forEach((t) => {
      const rc = t.rootCause || 'ثبت‌نشده';
      rootCauseMap.set(rc, (rootCauseMap.get(rc) ?? 0) + 1);
    });

    const complaints = activeSet.filter((t) => t.isComplaint || t.category === 'شکایت و کیفیت');

    return {
      total,
      resolvedCount: resolved.length,
      breachedCount,
      slaCompliantPct,
      avgFirstRespMin,
      avgResHours,
      byAgent,
      rootCauses: Array.from(rootCauseMap.entries()).sort((a, b) => b[1] - a[1]),
      complaints,
    };
  }, [state.tickets, state.slaPolicies, state.settings, state.officialHolidays, agents, nowMs]);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs text-slate-500">انطباق SLA ساعات کاری</div>
          <div className="mt-1 text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
            {toFa(analytics.slaCompliantPct)}٪
          </div>
          <div className="mt-1 text-xs text-slate-500 tabular-nums">
            نقض‌شده: {toFa(analytics.breachedCount)} از {toFa(analytics.total)}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs text-slate-500">میانگین پاسخ اول (ساعت کاری)</div>
          <div className="mt-1 text-xl font-bold tabular-nums text-indigo-600 dark:text-indigo-400">
            {toFa(analytics.avgFirstRespMin)} دقیقه
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs text-slate-500">میانگین زمان حل تیکت</div>
          <div className="mt-1 text-xl font-bold tabular-nums">{toFa(analytics.avgResHours)} ساعت کاری</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs text-slate-500">تعداد شکایات ثبت‌شده</div>
          <div className="mt-1 text-xl font-bold tabular-nums text-rose-600 dark:text-rose-400">
            {toFa(analytics.complaints.length)}
          </div>
        </div>
      </div>

      {/* Complaints Register Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <ShieldAlert size={16} className="text-rose-500" />
            دفتر رسیدگی به شکایات مشتریان و اقدام اصلاحی ({toFa(analytics.complaints.length)})
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="border-b border-slate-200 bg-slate-50/70 text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">کد / شکایت</th>
                <th className="px-4 py-3 font-medium">مشتری</th>
                <th className="px-4 py-3 font-medium">شدت</th>
                <th className="px-4 py-3 font-medium">علت ریشه‌ای</th>
                <th className="px-4 py-3 font-medium">اقدام اصلاحی / جبران</th>
                <th className="px-4 py-3 font-medium">وضعیت شکایت</th>
                <th className="px-4 py-3 font-medium">تاریخ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {analytics.complaints.map((c) => {
                const cust = state.customers.find((x) => x.id === c.customerId);
                const sev = c.severity ?? 'major';
                return (
                  <tr key={c.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => onOpenTicket(c.id)}
                        className="text-right font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
                      >
                        <span className="ml-1 font-mono text-[11px]">{c.trackingCode ?? c.id}</span>
                        {c.subject}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{cust?.name ?? 'مشتری'}</td>
                    <td className="px-4 py-3">
                      <span className={`font-semibold ${TICKET_SEVERITY_COLOR[sev]}`}>
                        {TICKET_SEVERITY_LABEL[sev]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{c.rootCause || 'ثبت‌نشده'}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {c.complaintResolution || 'در دست اقدام کارشناس'}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        aria-label="تغییر وضعیت شکایت"
                        value={c.complaintStatus ?? 'investigating'}
                        onChange={(e) =>
                          updateTicket(c.id, { complaintStatus: e.target.value as ComplaintStatus })
                        }
                        className="rounded border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
                      >
                        {(Object.keys(COMPLAINT_STATUS_LABEL) as ComplaintStatus[]).map((cs) => (
                          <option key={cs} value={cs}>
                            {COMPLAINT_STATUS_LABEL[cs]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-500 whitespace-nowrap">
                      {formatJalaliDateTime(c.createdAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Workload & Root Cause Breakdown */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <BarChart3 size={16} className="text-indigo-500" />
            عملکرد و بار کاری کارشناسان پشتیبانی
          </h3>
          <div className="space-y-2.5 text-xs">
            {analytics.byAgent.map((ag) => (
              <div
                key={ag.agent}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800"
              >
                <span className="font-semibold text-slate-800 dark:text-slate-200">{ag.agent}</span>
                <div className="flex flex-wrap items-center gap-3 tabular-nums">
                  <span className="text-slate-500">کل: {toFa(ag.total)}</span>
                  <span className="text-amber-600">باز: {toFa(ag.open)}</span>
                  <span className="text-emerald-600">حل‌شده: {toFa(ag.resolved)}</span>
                  {ag.escalated > 0 && <span className="font-bold text-rose-600">تصعید: {toFa(ag.escalated)}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-3 text-sm font-semibold">فراوانی علل ریشه‌ای (Root Cause Analysis)</h3>
          <div className="space-y-2.5">
            {analytics.rootCauses.map(([cause, count]) => {
              const pct = analytics.total > 0 ? Math.round((count / analytics.total) * 100) : 0;
              return (
                <div key={cause} className="text-xs">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-medium text-slate-700 dark:text-slate-200">{cause}</span>
                    <span className="tabular-nums text-slate-500">
                      {toFa(count)} تیکت ({toFa(pct)}٪)
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div className="h-full rounded-full bg-indigo-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
