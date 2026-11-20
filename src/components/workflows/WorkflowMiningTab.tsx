import { History } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useClientFlow } from '../../store/useClientFlowStore';
import { formatJalaliDateTime, toFa } from '../../utils/jalali';

export function WorkflowMiningTab() {
  const { state } = useClientFlow();
  const [selectedWfId, setSelectedWfId] = useState(state.workflows[0]?.id ?? '');

  const mining = useMemo(() => {
    const nowMs = Date.now();
    const total = state.workflows.length;
    const running = state.workflows.filter((w) => w.status === 'running').length;
    const approved = state.workflows.filter((w) => w.status === 'approved').length;
    const rejected = state.workflows.filter((w) => w.status === 'rejected').length;

    const slaBreached = state.workflows.filter((w) => {
      const endMs = w.completedAt ? new Date(w.completedAt).getTime() : nowMs;
      const ageH = (endMs - new Date(w.createdAt).getTime()) / 3600_000;
      return ageH > w.slaHours;
    }).length;

    const stepStats = new Map<
      string,
      {
        name: string;
        count: number;
        pending: number;
        totalHours: number;
        timedCount: number;
        stepSlaHoursSum: number;
        stepSlaCount: number;
        stepBreaches: number;
      }
    >();

    state.workflows.forEach((wf) => {
      wf.steps.forEach((st, idx) => {
        const entry = stepStats.get(st.name) ?? {
          name: st.name,
          count: 0,
          pending: 0,
          totalHours: 0,
          timedCount: 0,
          stepSlaHoursSum: 0,
          stepSlaCount: 0,
          stepBreaches: 0,
        };
        entry.count += 1;
        if (st.status === 'pending' && wf.status === 'running' && idx === wf.currentStepIndex) {
          entry.pending += 1;
        }
        if (st.stepSlaHours) {
          entry.stepSlaHoursSum += st.stepSlaHours;
          entry.stepSlaCount += 1;
        }
        const startIso = st.startedAt ?? wf.createdAt;
        const endIso =
          st.at ?? (wf.status === 'running' && idx === wf.currentStepIndex ? new Date().toISOString() : undefined);
        if (startIso && endIso) {
          const hrs = Math.max(0.2, (new Date(endIso).getTime() - new Date(startIso).getTime()) / 3600_000);
          entry.totalHours += hrs;
          entry.timedCount += 1;
          if (st.stepSlaHours && hrs > st.stepSlaHours) {
            entry.stepBreaches += 1;
          }
        }
        stepStats.set(st.name, entry);
      });
    });

    const stepsArray = Array.from(stepStats.values())
      .map((s) => ({
        ...s,
        avgHours: s.timedCount > 0 ? Math.round((s.totalHours / s.timedCount) * 10) / 10 : 0,
        avgStepSla: s.stepSlaCount > 0 ? Math.round((s.stepSlaHoursSum / s.stepSlaCount) * 10) / 10 : null,
      }))
      .sort((a, b) => b.avgHours - a.avgHours || b.pending - a.pending);

    const bottleneck = stepsArray[0] ?? null;
    const totalStepBreaches = stepsArray.reduce((acc, s) => acc + s.stepBreaches, 0);
    return { total, running, approved, rejected, slaBreached, totalStepBreaches, stepsArray, bottleneck };
  }, [state.workflows]);

  const selectedWf = state.workflows.find((w) => w.id === selectedWfId) ?? state.workflows[0];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs text-slate-500">کل فرایندهای اجراشده</div>
          <div className="mt-1 text-2xl font-bold tabular-nums">{toFa(mining.total)}</div>
          <div className="mt-1 text-[11px] tabular-nums text-slate-400">
            تأیید: {toFa(mining.approved)} · رد: {toFa(mining.rejected)}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs text-slate-500">در حال جریان / تکمیل‌شده</div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-emerald-600">
            {toFa(mining.running)} / {toFa(mining.approved + mining.rejected)}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs text-slate-500">نقض SLA کل / گام‌ها</div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-rose-600">
            {toFa(mining.slaBreached)} / {toFa(mining.totalStepBreaches)}
          </div>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900/60 dark:bg-amber-950/30">
          <div className="text-xs font-medium text-amber-800 dark:text-amber-300">گلوگاه اصلی (Bottleneck)</div>
          <div className="mt-1 truncate text-sm font-bold text-slate-900 dark:text-slate-100">
            {mining.bottleneck ? `${mining.bottleneck.name} (${toFa(mining.bottleneck.avgHours)} ساعت)` : 'نامشخص'}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h3 className="mb-3 text-sm font-semibold">گزارش گلوگاه مراحل و انحراف SLA گام‌به‌گام</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800">
              <tr>
                <th className="py-2">نام گام</th>
                <th className="py-2">تعداد عبور</th>
                <th className="py-2">در صف فعلی</th>
                <th className="py-2">SLA هدف گام</th>
                <th className="py-2">نقض SLA گام</th>
                <th className="py-2">میانگین زمان توقف</th>
                <th className="py-2">شدت گلوگاه</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {mining.stepsArray.map((st, idx) => {
                const maxH = Math.max(1, mining.bottleneck?.avgHours ?? 1);
                const wPct = Math.min(100, Math.round((st.avgHours / maxH) * 100));
                return (
                  <tr key={st.name}>
                    <td className="py-2.5 font-medium">
                      {st.name}
                      {idx === 0 && (
                        <span className="mr-2 rounded bg-rose-100 px-1.5 py-0.5 text-[10px] text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
                          گلوگاه
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 tabular-nums">{toFa(st.count)}</td>
                    <td className="py-2.5 tabular-nums text-amber-600">{toFa(st.pending)}</td>
                    <td className="py-2.5 tabular-nums text-slate-500">
                      {st.avgStepSla ? `${toFa(st.avgStepSla)} ساعت` : '-'}
                    </td>
                    <td className="py-2.5 tabular-nums text-rose-600">{toFa(st.stepBreaches)}</td>
                    <td className="py-2.5 font-semibold tabular-nums">{toFa(st.avgHours)} ساعت</td>
                    <td className="w-44 py-2.5">
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div
                          className={`h-full rounded-full ${idx === 0 ? 'bg-rose-500' : 'bg-indigo-600'}`}
                          style={{ width: `${wPct}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Instance Execution Audit History Viewer */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <History size={16} className="text-indigo-500" />
            تاریخچه دقیق اجرای نمونه فرآیند (Audit Trail)
          </div>
          <select
            aria-label="انتخاب پرونده گردش کار"
            value={selectedWf?.id ?? ''}
            onChange={(e) => setSelectedWfId(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
          >
            {state.workflows.map((w) => (
              <option key={w.id} value={w.id}>
                {w.title}
              </option>
            ))}
          </select>
        </div>

        {!selectedWf || !(selectedWf.history && selectedWf.history.length > 0) ? (
          <p className="text-xs text-slate-400">برای این پرونده رویداد تاریخچه‌ای ثبت نشده است.</p>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {selectedWf.history.map((h) => (
              <div key={h.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {h.stepName}
                  </span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">{h.actor}</span>
                  <span className="text-slate-600 dark:text-slate-300">{h.detail}</span>
                </div>
                <span className="tabular-nums text-slate-400">{formatJalaliDateTime(h.at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
