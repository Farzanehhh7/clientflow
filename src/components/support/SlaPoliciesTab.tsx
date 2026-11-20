import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Clock, ShieldAlert } from 'lucide-react';
import { useClientFlow } from '../../store/useClientFlowStore';
import type { Ticket } from '../../types';
import { toFa } from '../../utils/jalali';
import {
  evaluateTicketSla,
  formatDurationMinutesFa,
  formatRemainingMinutesFa,
  isTicketClosedStatus,
} from '../../utils/slaEngine';
import { TICKET_PRIORITY_COLOR, TICKET_PRIORITY_LABEL } from './supportHelpers';

interface SlaPoliciesTabProps {
  onOpenTicket: (ticketId: string) => void;
}

export function SlaPoliciesTab({ onOpenTicket }: SlaPoliciesTabProps) {
  const { state, updateSlaPolicy, escalateTicket, checkAndEscalateTickets } = useClientFlow();
  const [nowTickMs, setNowTickMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNowTickMs(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  const openEvals = useMemo(() => {
    return state.tickets
      .filter((t) => !isTicketClosedStatus(t.status) && !t.mergedIntoTicketId)
      .map((ticket) => ({
        ticket,
        evalRes: evaluateTicketSla(
          ticket,
          state.slaPolicies,
          state.settings,
          state.officialHolidays,
          nowTickMs,
        ),
      }))
      .sort((a, b) => a.evalRes.resolutionRemainingMin - b.evalRes.resolutionRemainingMin);
  }, [state.tickets, state.slaPolicies, state.settings, state.officialHolidays, nowTickMs]);

  const priorities: Ticket['priority'][] = ['high', 'normal', 'low'];

  return (
    <div className="space-y-6">
      {/* Editable SLA Policies per priority */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">سیاست‌های سطح خدمات (SLA) بر اساس اولویت</h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              محاسبه شمارنده به‌صورت خودکار فقط در ساعات کاری ({toFa(state.settings.workStartHour)}:۰۰ تا{' '}
              {toFa(state.settings.workEndHour)}:۰۰) و با لحاظ تعطیلات رسمی شمسی انجام می‌شود.
            </p>
          </div>
          <button
            type="button"
            onClick={() => checkAndEscalateTickets(false)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-medium text-rose-700 hover:bg-rose-100 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300"
          >
            <ShieldAlert size={14} />
            تصعید خودکار موارد نقض‌شده
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {priorities.map((prio) => {
            const p = state.slaPolicies[prio];
            return (
              <div
                key={prio}
                className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-xs dark:border-slate-800 dark:bg-slate-800/40"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className={`text-sm font-bold ${TICKET_PRIORITY_COLOR[prio]}`}>
                    اولویت {TICKET_PRIORITY_LABEL[prio]}
                  </span>
                  <span className="tabular-nums text-slate-500">
                    هشدار از {toFa(p.warnPct)}٪ مهلت
                  </span>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="mb-1 flex items-center justify-between text-slate-600 dark:text-slate-300">
                      <span>مهلت پاسخ اول (دقیقه کاری)</span>
                      <span className="font-semibold tabular-nums">
                        {formatDurationMinutesFa(p.firstResponseMin)}
                      </span>
                    </label>
                    <input
                      type="number"
                      min={5}
                      max={2880}
                      value={p.firstResponseMin}
                      onChange={(e) =>
                        updateSlaPolicy(prio, { firstResponseMin: Math.max(5, Number(e.target.value) || 30) })
                      }
                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-900"
                    />
                  </div>

                  <div>
                    <label className="mb-1 flex items-center justify-between text-slate-600 dark:text-slate-300">
                      <span>مهلت حل نهایی (دقیقه کاری)</span>
                      <span className="font-semibold tabular-nums">
                        {formatDurationMinutesFa(p.resolutionMin)}
                      </span>
                    </label>
                    <input
                      type="number"
                      min={15}
                      max={14400}
                      value={p.resolutionMin}
                      onChange={(e) =>
                        updateSlaPolicy(prio, { resolutionMin: Math.max(15, Number(e.target.value) || 60) })
                      }
                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-900"
                    />
                  </div>

                  <div>
                    <label className="mb-1 flex items-center justify-between text-slate-600 dark:text-slate-300">
                      <span>آستانه هشدار پیش از نقض (٪)</span>
                      <span className="font-semibold tabular-nums">{toFa(p.warnPct)}٪</span>
                    </label>
                    <input
                      type="number"
                      min={40}
                      max={95}
                      value={p.warnPct}
                      onChange={(e) =>
                        updateSlaPolicy(prio, {
                          warnPct: Math.min(95, Math.max(40, Number(e.target.value) || 75)),
                        })
                      }
                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-900"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Live SLA Queue Monitor */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Clock size={16} className="text-indigo-500" />
            صف پایش زنده SLA تیکت‌های باز ({toFa(openEvals.length)})
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="border-b border-slate-200 bg-slate-50/70 text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">کد / موضوع</th>
                <th className="px-4 py-3 font-medium">مشتری</th>
                <th className="px-4 py-3 font-medium">اولویت</th>
                <th className="px-4 py-3 font-medium">تایمر پاسخ اول</th>
                <th className="px-4 py-3 font-medium">تایمر حل نهایی</th>
                <th className="px-4 py-3 font-medium">وضعیت SLA</th>
                <th className="px-4 py-3 font-medium">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {openEvals.map(({ ticket, evalRes }) => {
                const cust = state.customers.find((c) => c.id === ticket.customerId);
                return (
                  <tr key={ticket.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => onOpenTicket(ticket.id)}
                        className="text-right font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
                      >
                        <span className="ml-1 font-mono text-[11px]">{ticket.trackingCode ?? ticket.id}</span>
                        {ticket.subject}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{cust?.name ?? 'مشتری'}</td>
                    <td className="px-4 py-3">
                      <span className={`font-medium ${TICKET_PRIORITY_COLOR[ticket.priority]}`}>
                        {TICKET_PRIORITY_LABEL[ticket.priority]}
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular-nums whitespace-nowrap">
                      {ticket.firstRespondedAt ? (
                        <span className="text-emerald-600 dark:text-emerald-400">
                          پاسخ در {toFa(evalRes.firstRespElapsedMin)} د
                        </span>
                      ) : (
                        <span
                          className={
                            evalRes.firstRespState === 'breached'
                              ? 'font-semibold text-rose-600 dark:text-rose-400'
                              : evalRes.firstRespState === 'warning'
                                ? 'font-semibold text-amber-600 dark:text-amber-400'
                                : 'text-slate-600 dark:text-slate-300'
                          }
                        >
                          {formatRemainingMinutesFa(evalRes.firstRespRemainingMin)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 tabular-nums whitespace-nowrap">
                      <span
                        className={
                          evalRes.resolutionState === 'breached'
                            ? 'font-semibold text-rose-600 dark:text-rose-400'
                            : evalRes.resolutionState === 'warning'
                              ? 'font-semibold text-amber-600 dark:text-amber-400'
                              : 'text-slate-700 dark:text-slate-200'
                        }
                      >
                        {formatRemainingMinutesFa(evalRes.resolutionRemainingMin)}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {evalRes.overallState === 'breached' ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-rose-600 dark:text-rose-400">
                          <AlertTriangle size={12} />
                          نقض‌شده
                        </span>
                      ) : evalRes.overallState === 'warning' ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
                          <AlertTriangle size={12} />
                          آستانه هشدار
                        </span>
                      ) : (
                        <span className="font-medium text-emerald-600 dark:text-emerald-400">در مهلت مجاز</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onOpenTicket(ticket.id)}
                          className="text-indigo-600 hover:underline dark:text-indigo-400"
                        >
                          بررسی
                        </button>
                        {!ticket.escalated && (
                          <button
                            type="button"
                            onClick={() => escalateTicket(ticket.id)}
                            className="text-rose-600 hover:underline dark:text-rose-400"
                          >
                            تصعید فوری
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
