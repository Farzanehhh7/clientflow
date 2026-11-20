import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Plus } from 'lucide-react';
import { useClientFlow } from '../store/useClientFlowStore';
import type { SurveyType } from '../types';
import { formatJalaliDateTime, toFa } from '../utils/jalali';

const SURVEY_BADGE: Record<SurveyType, string> = {
  nps: 'NPS',
  csat: 'CSAT',
  ces: 'CES',
};

const REF_LABEL = {
  appointment: 'نوبت',
  order: 'سفارش',
  ticket: 'تیکت پشتیبانی',
} as const;

export function NpsPage() {
  const { state, triggerNpsPrompt } = useClientFlow();
  const [typeFilter, setTypeFilter] = useState<'all' | SurveyType>('all');

  const stats = useMemo(() => {
    const npsList = state.npsSurveys.filter((n) => (n.surveyType ?? 'nps') === 'nps');
    const csatList = state.npsSurveys.filter((n) => n.surveyType === 'csat');
    const cesList = state.npsSurveys.filter((n) => n.surveyType === 'ces');

    const promoters = npsList.filter((n) => n.score >= 9).length;
    const passives = npsList.filter((n) => n.score >= 7 && n.score <= 8).length;
    const detractors = npsList.filter((n) => n.score <= 6).length;
    const npsScore = npsList.length > 0 ? Math.round(((promoters - detractors) / npsList.length) * 100) : 0;

    const csatSatisfied = csatList.filter((n) => n.score >= 4).length;
    const csatPct = csatList.length > 0 ? Math.round((csatSatisfied / csatList.length) * 100) : 0;
    const csatAvg =
      csatList.length > 0 ? (csatList.reduce((s, n) => s + n.score, 0) / csatList.length).toFixed(1) : '0';

    const cesAvg =
      cesList.length > 0 ? (cesList.reduce((s, n) => s + n.score, 0) / cesList.length).toFixed(1) : '0';

    const byRef = [
      {
        name: 'نوبت',
        count: state.npsSurveys.filter((n) => n.refType === 'appointment').length,
        color: '#6366f1',
      },
      {
        name: 'سفارش',
        count: state.npsSurveys.filter((n) => n.refType === 'order').length,
        color: '#0284c7',
      },
      {
        name: 'تیکت',
        count: state.npsSurveys.filter((n) => n.refType === 'ticket').length,
        color: '#059669',
      },
    ];

    const chartData = [
      { name: 'مروجین NPS (۹-۱۰)', count: promoters, color: '#16a34a' },
      { name: 'خنثی NPS (۷-۸)', count: passives, color: '#d97706' },
      { name: 'منتقدین NPS (۰-۶)', count: detractors, color: '#dc2626' },
    ];

    return {
      total: state.npsSurveys.length,
      npsCount: npsList.length,
      promoters,
      passives,
      detractors,
      npsScore,
      csatCount: csatList.length,
      csatPct,
      csatAvg,
      cesCount: cesList.length,
      cesAvg,
      chartData,
      byRef,
    };
  }, [state.npsSurveys]);

  const filteredResponses = useMemo(() => {
    if (typeFilter === 'all') return state.npsSurveys;
    return state.npsSurveys.filter((n) => (n.surveyType ?? 'nps') === typeFilter);
  }, [state.npsSurveys, typeFilter]);

  const openManualSurvey = (kind: SurveyType) => {
    const sampleTicket = state.tickets.find((t) => t.status === 'resolved' || t.status === 'closed') ?? state.tickets[0];
    const sampleApt = state.appointments.find((a) => a.status === 'done') ?? state.appointments[0];
    const sampleOrder = state.orders.find((o) => o.status === 'delivered') ?? state.orders[0];

    if (kind === 'csat' || kind === 'ces') {
      const cust = state.customers.find((c) => c.id === (sampleTicket?.customerId ?? state.customers[0]?.id));
      if (!cust) return;
      triggerNpsPrompt({
        customerId: cust.id,
        refType: sampleTicket ? 'ticket' : 'order',
        refId: sampleTicket?.id ?? sampleOrder?.id ?? 'manual',
        label: sampleTicket ? `تیکت «${sampleTicket.subject}» (${cust.name})` : `سفارش (${cust.name})`,
        defaultSurveyType: kind,
      });
      return;
    }

    const cust = state.customers.find((c) => c.id === (sampleApt?.customerId ?? state.customers[0]?.id));
    if (!cust) return;
    triggerNpsPrompt({
      customerId: cust.id,
      refType: sampleApt ? 'appointment' : 'order',
      refId: sampleApt?.id ?? sampleOrder?.id ?? 'manual',
      label: `ثبت نظرسنجی وفاداری برای ${cust.name}`,
      defaultSurveyType: 'nps',
    });
  };

  const isDark = state.settings.darkMode;
  const gridStroke = isDark ? '#1e293b' : '#e2e8f0';
  const axisColor = isDark ? '#94a3b8' : '#64748b';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          نظرسنجی‌های NPS، CSAT و CES به‌صورت خودکار پس از اتمام نوبت، تحویل سفارش یا مختومه‌شدن تیکت پشتیبانی ارسال می‌شوند.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => openManualSurvey('nps')}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-indigo-700"
          >
            <Plus size={15} />
            ثبت NPS
          </button>
          <button
            type="button"
            onClick={() => openManualSurvey('csat')}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Plus size={15} />
            ثبت CSAT
          </button>
          <button
            type="button"
            onClick={() => openManualSurvey('ces')}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Plus size={15} />
            ثبت CES
          </button>
        </div>
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
          <div className="mt-1 text-xs text-slate-500 tabular-nums">
            از {toFa(stats.npsCount)} پاسخ (بازه ۱۰۰- تا ۱۰۰+)
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs text-slate-500 dark:text-slate-400">رضایت آنی پشتیبانی (CSAT)</div>
          <div className="mt-2 text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
            {toFa(stats.csatPct)}٪
          </div>
          <div className="mt-1 text-xs text-slate-500 tabular-nums">
            میانگین {toFa(stats.csatAvg)} از ۵ ({toFa(stats.csatCount)} نظر)
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs text-slate-500 dark:text-slate-400">سهولت تجربه مشتری (CES)</div>
          <div className="mt-2 text-2xl font-bold tabular-nums text-indigo-600 dark:text-indigo-400">
            {toFa(stats.cesAvg)} / ۷
          </div>
          <div className="mt-1 text-xs text-slate-500 tabular-nums">
            بر اساس {toFa(stats.cesCount)} ارزیابی سهولت حل مشکل
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs text-slate-500 dark:text-slate-400">منتقدین نیازمند پیگیری</div>
          <div className="mt-2 text-2xl font-bold tabular-nums text-rose-600 dark:text-rose-400">
            {toFa(stats.detractors)}
          </div>
          <div className="mt-1 text-xs text-slate-500 tabular-nums">
            کل نظرات ثبت‌شده: {toFa(stats.total)} مورد
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-4 text-sm font-semibold">توزیع دسته‌بندی NPS مشتریان</h2>
          <div className="h-56 w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.chartData} margin={{ top: 8, right: 12, left: -16, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                <XAxis dataKey="name" tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} />
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
          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
            {stats.byRef.map((r) => (
              <div key={r.name} className="text-center text-xs">
                <div className="text-slate-500 dark:text-slate-400">منبع: {r.name}</div>
                <div className="mt-0.5 text-sm font-bold tabular-nums text-slate-800 dark:text-slate-100">
                  {toFa(r.count)}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">آخرین بازخوردهای ثبت‌شده</h2>
            <select
              aria-label="فیلتر نوع نظرسنجی"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as 'all' | SurveyType)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="all">همه نظرسنجی‌ها</option>
              <option value="nps">فقط NPS</option>
              <option value="csat">فقط CSAT</option>
              <option value="ces">فقط CES</option>
            </select>
          </div>

          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {filteredResponses.slice(0, 8).map((n) => {
              const cust = state.customers.find((c) => c.id === n.customerId);
              const kind = n.surveyType ?? 'nps';
              const maxScale = n.maxScale ?? (kind === 'csat' ? 5 : kind === 'ces' ? 7 : 10);
              const ratio = n.score / maxScale;
              const scoreClass =
                ratio >= 0.8
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : ratio >= 0.6
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-rose-600 dark:text-rose-400';

              return (
                <div key={n.id} className="py-2.5">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      <span className="ml-1.5 font-mono text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                        {SURVEY_BADGE[kind]}
                      </span>
                      {cust?.name ?? 'مشتری'} ·{' '}
                      <span className="font-normal text-slate-500">{REF_LABEL[n.refType]}</span>
                    </span>
                    <span className={`font-bold tabular-nums whitespace-nowrap ${scoreClass}`}>
                      امتیاز {toFa(n.score)} از {toFa(maxScale)}
                    </span>
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
