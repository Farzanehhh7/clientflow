import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Plus } from 'lucide-react';
import { useClientFlow } from '../store/useClientFlowStore';
import { formatJalaliDateTime, toFa } from '../utils/jalali';

export function NpsPage() {
  const { state, triggerNpsPrompt } = useClientFlow();

  const stats = useMemo(() => {
    const total = state.npsSurveys.length;
    const promoters = state.npsSurveys.filter((n) => n.score >= 9).length;
    const passives = state.npsSurveys.filter((n) => n.score >= 7 && n.score <= 8).length;
    const detractors = state.npsSurveys.filter((n) => n.score <= 6).length;
    const npsScore = total > 0 ? Math.round(((promoters - detractors) / total) * 100) : 0;
    const avgScore =
      total > 0
        ? (state.npsSurveys.reduce((s, n) => s + n.score, 0) / total).toFixed(1)
        : '0';

    const chartData = [
      { name: 'مروجین (۹-۱۰)', count: promoters, color: '#16a34a' },
      { name: 'خنثی (۷-۸)', count: passives, color: '#d97706' },
      { name: 'منتقدین (۰-۶)', count: detractors, color: '#dc2626' },
    ];

    return { total, promoters, passives, detractors, npsScore, avgScore, chartData };
  }, [state.npsSurveys]);

  const openManualSurvey = () => {
    const sampleApt = state.appointments.find((a) => a.status === 'done');
    const cust = state.customers.find((c) => c.id === (sampleApt?.customerId ?? state.customers[0]?.id));
    if (!cust) return;
    triggerNpsPrompt({
      customerId: cust.id,
      refType: sampleApt ? 'appointment' : 'order',
      refId: sampleApt?.id ?? state.orders[0]?.id ?? 'manual',
      label: `ثبت نظرسنجی برای ${cust.name}`,
    });
  };

  const isDark = state.settings.darkMode;
  const gridStroke = isDark ? '#1e293b' : '#e2e8f0';
  const axisColor = isDark ? '#94a3b8' : '#64748b';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          شاخص رضایت و وفاداری مشتریان (NPS) پس از انجام نوبت یا تحویل سفارش به‌صورت خودکار ثبت می‌شود.
        </p>
        <button
          type="button"
          onClick={openManualSurvey}
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700"
        >
          <Plus size={16} />
          ثبت نظرسنجی جدید
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs text-slate-500 dark:text-slate-400">شاخص خالص ترویج (NPS)</div>
          <div
            className={`mt-2 text-2xl font-bold tabular-nums ${
              stats.npsScore >= 30
                ? 'text-emerald-600 dark:text-emerald-400'
                : stats.npsScore >= 0
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {stats.npsScore > 0 ? `+${toFa(stats.npsScore)}` : toFa(stats.npsScore)}
          </div>
          <div className="mt-1 text-xs text-slate-500">بازه استاندارد: ۱۰۰- تا ۱۰۰+</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs text-slate-500 dark:text-slate-400">میانگین امتیاز</div>
          <div className="mt-2 text-2xl font-bold tabular-nums">{toFa(stats.avgScore)} / ۱۰</div>
          <div className="mt-1 text-xs text-slate-500 tabular-nums">از مجموع {toFa(stats.total)} نظر</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs text-slate-500 dark:text-slate-400">مروجین (۹ و ۱۰)</div>
          <div className="mt-2 text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
            {toFa(stats.promoters)}
          </div>
          <div className="mt-1 text-xs text-slate-500">مشتریان وفادار و راضی</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs text-slate-500 dark:text-slate-400">منتقدین (۰ تا ۶)</div>
          <div className="mt-2 text-2xl font-bold tabular-nums text-rose-600 dark:text-rose-400">
            {toFa(stats.detractors)}
          </div>
          <div className="mt-1 text-xs text-slate-500">نیازمند تماس و پیگیری</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-4 text-sm font-semibold">توزیع دسته‌بندی رضایت مشتریان</h2>
          <div className="h-64 w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.chartData} margin={{ top: 8, right: 12, left: -16, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                <XAxis dataKey="name" tick={{ fill: axisColor, fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: axisColor, fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(value: number) => [toFa(value), 'تعداد']}
                  contentStyle={{
                    borderRadius: 8,
                    border: `1px solid ${gridStroke}`,
                    backgroundColor: isDark ? '#0f172a' : '#ffffff',
                    color: isDark ? '#f8fafc' : '#0f172a',
                    fontFamily: 'Vazirmatn, sans-serif',
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={48}>
                  {stats.chartData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-3 text-sm font-semibold">آخرین بازخوردهای ثبت‌شده</h2>
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {state.npsSurveys.slice(0, 8).map((n) => {
              const cust = state.customers.find((c) => c.id === n.customerId);
              const scoreClass =
                n.score >= 9
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : n.score >= 7
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-rose-600 dark:text-rose-400';
              return (
                <div key={n.id} className="py-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {cust?.name ?? 'مشتری'} ·{' '}
                      <span className="font-normal text-slate-500">
                        {n.refType === 'appointment' ? 'نوبت' : 'سفارش'}
                      </span>
                    </span>
                    <span className={`font-bold tabular-nums ${scoreClass}`}>امتیاز {toFa(n.score)} از ۱۰</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span>{n.comment || 'بدون دیدگاه متنی'}</span>
                    <span className="shrink-0 tabular-nums">{formatJalaliDateTime(n.createdAt)}</span>
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
