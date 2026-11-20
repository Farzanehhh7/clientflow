import { useMemo, useState } from 'react';
import {
  Check,
  Edit2,
  Target,
  TrendingUp,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { getPackKpiDefs } from '../../data/packs';
import { useClientFlow } from '../../store/useClientFlowStore';
import type {
  Appointment,
  Customer,
  Invoice,
  Opportunity,
  Order,
  PackKpiDef,
  PackKpiMetricKey,
} from '../../types';
import { displayDigits } from '../../utils/i18n';
import {
  formatJalali,
  formatToman,
  getJalaliWeekDays,
  isIsoInJalaliRange,
  toFa,
} from '../../utils/jalali';
import { evaluateTicketSla } from '../../utils/slaEngine';
import dayjs from 'dayjs';

export interface DashboardAnalyticsScope {
  fromJalali: string;
  toJalali: string;
  branchCustomers: Customer[];
  branchAppointments: Appointment[];
  branchOrders: Order[];
  branchInvoices: Invoice[];
  branchOpportunities: Opportunity[];
}

const TOOLTIP_STYLE = (isDark: boolean, gridStroke: string) => ({
  borderRadius: 8,
  border: `1px solid ${gridStroke}`,
  backgroundColor: isDark ? '#0f172a' : '#ffffff',
  color: isDark ? '#f8fafc' : '#0f172a',
  fontFamily: 'Vazirmatn, sans-serif',
  fontSize: 12,
});

export function PackKpisGoalsWidget({ scope }: { scope: DashboardAnalyticsScope }) {
  const { state, updateKpiTarget } = useClientFlow();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTarget, setDraftTarget] = useState(0);

  const kpiDefs = useMemo(
    () => getPackKpiDefs(state.settings.industryPack, state.customPacks),
    [state.settings.industryPack, state.customPacks],
  );

  const nowMs = Date.now();

  const computedActuals = useMemo<Record<PackKpiMetricKey, number>>(() => {
    const inRangeOrders = scope.branchOrders.filter(
      (o) => o.status !== 'cancelled' && isIsoInJalaliRange(o.createdAt, scope.fromJalali, scope.toJalali),
    );
    const inRangeInvoices = scope.branchInvoices.filter((inv) =>
      isIsoInJalaliRange(inv.issuedAt, scope.fromJalali, scope.toJalali),
    );
    const inRangeApts = scope.branchAppointments.filter((a) =>
      isIsoInJalaliRange(a.start, scope.fromJalali, scope.toJalali),
    );
    const inRangeCustomers = scope.branchCustomers.filter((c) =>
      isIsoInJalaliRange(c.createdAt, scope.fromJalali, scope.toJalali),
    );
    const inRangeOpps = scope.branchOpportunities.filter((opp) =>
      isIsoInJalaliRange(opp.createdAt, scope.fromJalali, scope.toJalali),
    );
    const inRangeNps = state.npsSurveys.filter((n) =>
      isIsoInJalaliRange(n.createdAt, scope.fromJalali, scope.toJalali),
    );
    const inRangeTickets = state.tickets.filter(
      (tk) => !tk.mergedIntoTicketId && isIsoInJalaliRange(tk.createdAt, scope.fromJalali, scope.toJalali),
    );

    const revenue = inRangeInvoices.reduce((s, inv) => s + inv.paidAmount, 0);
    const openReceivables = scope.branchInvoices.reduce(
      (s, inv) => s + Math.max(0, inv.grandTotal - inv.paidAmount),
      0,
    );
    const doneAppointments = inRangeApts.filter((a) => a.status === 'done').length;
    const noShowCount = inRangeApts.filter((a) => a.status === 'noshow').length;
    const settledCount = doneAppointments + noShowCount;
    const noShowRate = settledCount > 0 ? Math.round((noShowCount / settledCount) * 100) : 0;

    const activePipelineValue = inRangeOpps
      .filter((o) => o.stage !== 'won' && o.stage !== 'lost')
      .reduce((s, o) => s + o.amount, 0);
    const wonDealsRevenue = inRangeOpps
      .filter((o) => o.stage === 'won')
      .reduce((s, o) => s + o.amount, 0);

    const compliantTickets = inRangeTickets.filter(
      (tk) =>
        evaluateTicketSla(tk, state.slaPolicies, state.settings, state.officialHolidays, nowMs)
          .overallState !== 'breached',
    ).length;
    const slaCompliancePct =
      inRangeTickets.length > 0 ? Math.round((compliantTickets / inRangeTickets.length) * 100) : 100;

    const npsOnly = inRangeNps.filter((n) => (n.surveyType ?? 'nps') === 'nps');
    const promoters = npsOnly.filter((n) => n.score >= 9).length;
    const detractors = npsOnly.filter((n) => n.score <= 6).length;
    const npsScore =
      npsOnly.length > 0 ? Math.round(((promoters - detractors) / npsOnly.length) * 100) : 65;

    return {
      revenue,
      orders_count: inRangeOrders.length,
      appointments_count: inRangeApts.filter((a) => a.status !== 'cancelled').length,
      done_appointments: doneAppointments,
      no_show_rate: noShowRate,
      new_customers: inRangeCustomers.length,
      active_pipeline_value: activePipelineValue,
      won_deals_revenue: wonDealsRevenue,
      sla_compliance_pct: slaCompliancePct,
      nps_score: npsScore,
      open_receivables: openReceivables,
    };
  }, [
    scope,
    state.npsSurveys,
    state.tickets,
    state.slaPolicies,
    state.settings,
    state.officialHolidays,
    nowMs,
  ]);

  const formatMetricVal = (val: number, unit: PackKpiDef['unit']) => {
    if (unit === 'toman') return formatToman(val);
    if (unit === 'pct') return `${toFa(val)}٪`;
    return toFa(val);
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Target size={17} className="text-indigo-500" />
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            شاخص‌های کلیدی صنعت و اهداف (Goals vs Actual)
          </h2>
        </div>
        <span className="text-[11px] text-slate-500 dark:text-slate-400">
          برای ویرایش هدف هر شاخص روی آیکون مداد کلیک کنید
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpiDefs.map((kpi) => {
          const actual = computedActuals[kpi.metricKey] ?? 0;
          const target = state.settings.kpiTargets?.[kpi.id] ?? kpi.targetValue;
          const pct = kpi.higherIsBetter
            ? target > 0
              ? Math.min(100, Math.round((actual / target) * 100))
              : 100
            : actual <= target
              ? 100
              : Math.max(10, Math.round((target / Math.max(1, actual)) * 100));

          const onTrack = kpi.higherIsBetter ? actual >= target * 0.75 : actual <= target;
          const exceeded = kpi.higherIsBetter ? actual >= target : actual <= target * 0.7;

          const barColor = exceeded
            ? 'bg-emerald-500'
            : onTrack
              ? 'bg-indigo-500'
              : 'bg-amber-500';

          return (
            <div
              key={kpi.id}
              className="rounded-xl border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/40"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  {kpi.label}
                </span>
                {editingId === kpi.id ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      value={draftTarget}
                      onChange={(e) => setDraftTarget(Number(e.target.value) || 0)}
                      className="w-24 rounded border border-indigo-400 bg-white px-1.5 py-0.5 text-[11px] tabular-nums dark:bg-slate-900"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        updateKpiTarget(kpi.id, draftTarget);
                        setEditingId(null);
                      }}
                      className="rounded bg-emerald-600 p-1 text-white"
                    >
                      <Check size={11} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(kpi.id);
                      setDraftTarget(target);
                    }}
                    title="ویرایش هدف"
                    className="rounded p-1 text-slate-400 hover:bg-slate-200/70 hover:text-indigo-600 dark:hover:bg-slate-700"
                  >
                    <Edit2 size={12} />
                  </button>
                )}
              </div>

              <div className="mt-2 text-lg font-bold tabular-nums text-slate-900 dark:text-white">
                {formatMetricVal(actual, kpi.unit)}
              </div>

              <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                <span>هدف: {formatMetricVal(target, kpi.unit)}</span>
                <span
                  className={`font-semibold tabular-nums ${
                    exceeded
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : onTrack
                        ? 'text-indigo-600 dark:text-indigo-400'
                        : 'text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {toFa(pct)}٪ تحقق
                </span>
              </div>

              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                  style={{ width: `${Math.max(4, Math.min(100, pct))}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function RevenueTrendWidget({ scope }: { scope: DashboardAnalyticsScope }) {
  const { state } = useClientFlow();
  const isDark = state.settings.darkMode;
  const gridStroke = isDark ? '#1e293b' : '#e2e8f0';
  const axisColor = isDark ? '#94a3b8' : '#64748b';

  const trendData = useMemo(() => {
    const map = new Map<string, { label: string; revenue: number; orders: number }>();

    const invs = scope.branchInvoices.filter((inv) =>
      isIsoInJalaliRange(inv.issuedAt, scope.fromJalali, scope.toJalali),
    );
    const ords = scope.branchOrders.filter(
      (o) => o.status !== 'cancelled' && isIsoInJalaliRange(o.createdAt, scope.fromJalali, scope.toJalali),
    );

    for (const inv of invs) {
      const key = formatJalali(inv.issuedAt, 'MM/DD');
      const row = map.get(key) ?? { label: key, revenue: 0, orders: 0 };
      row.revenue += inv.paidAmount;
      map.set(key, row);
    }
    for (const o of ords) {
      const key = formatJalali(o.createdAt, 'MM/DD');
      const row = map.get(key) ?? { label: key, revenue: 0, orders: 0 };
      row.orders += 1;
      map.set(key, row);
    }

    const sorted = Array.from(map.values()).slice(-10);
    if (sorted.length === 0) {
      return [
        { label: '۰۸/۰۱', revenue: 0, orders: 0 },
        { label: '۰۸/۱۵', revenue: 0, orders: 0 },
      ];
    }
    return sorted;
  }, [scope]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <TrendingUp size={16} className="text-indigo-500" />
          روند درآمد وصولی و سفارش‌ها (شمسی)
        </h2>
        <span className="text-[11px] text-slate-400">برحسب میلیون تومان</span>
      </div>
      <div className="h-64 w-full" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={trendData} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
            <defs>
              <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
            <XAxis dataKey="label" tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis
              tickFormatter={(v) => toFa(Math.round(Number(v) / 1_000_000))}
              tick={{ fill: axisColor, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(value: number, name: string) =>
                name === 'revenue' ? [formatToman(value), 'وصولی'] : [toFa(value), 'سفارش']
              }
              contentStyle={TOOLTIP_STYLE(isDark, gridStroke)}
            />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="#4f46e5"
              strokeWidth={2.5}
              fill="url(#revGrad)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function SalesFunnelWidget({ scope }: { scope: DashboardAnalyticsScope }) {
  const { state } = useClientFlow();
  const isDark = state.settings.darkMode;
  const gridStroke = isDark ? '#1e293b' : '#e2e8f0';
  const axisColor = isDark ? '#94a3b8' : '#64748b';

  const funnelData = useMemo(() => {
    const stages = state.pipelineStages.filter((s) => s.key !== 'lost');
    const opps = scope.branchOpportunities.filter((o) =>
      isIsoInJalaliRange(o.createdAt, scope.fromJalali, scope.toJalali),
    );
    return stages.map((st, idx) => {
      const list = opps.filter((o) => o.stage === st.key);
      const amountM = Math.round(list.reduce((s, o) => s + o.amount, 0) / 1_000_000);
      const colors = ['#6366f1', '#0ea5e9', '#8b5cf6', '#f59e0b', '#10b981'];
      return {
        stage: st.label,
        count: list.length,
        amountM,
        color: colors[idx % colors.length],
      };
    });
  }, [state.pipelineStages, scope]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold">قیف تبدیل فروش (مراحل معامله)</h2>
        <span className="text-[11px] text-slate-400">تعداد و ارزش (میلیون تومان)</span>
      </div>
      <div className="h-64 w-full" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={funnelData}
            layout="vertical"
            margin={{ top: 4, right: 16, left: 20, bottom: 4 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} horizontal={false} />
            <XAxis type="number" tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis
              type="category"
              dataKey="stage"
              width={105}
              tick={{ fill: axisColor, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(value: number, name: string) =>
                name === 'amountM'
                  ? [`${toFa(value)} میلیون تومان`, 'ارزش معاملات']
                  : [toFa(value), 'تعداد معامله']
              }
              contentStyle={TOOLTIP_STYLE(isDark, gridStroke)}
            />
            <Bar dataKey="amountM" radius={[0, 6, 6, 0]} maxBarSize={26}>
              {funnelData.map((entry, idx) => (
                <Cell key={idx} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function RevenueBreakdownWidget({ scope }: { scope: DashboardAnalyticsScope }) {
  const { state } = useClientFlow();
  const [mode, setMode] = useState<'source' | 'owner' | 'product'>('source');
  const isDark = state.settings.darkMode;
  const gridStroke = isDark ? '#1e293b' : '#e2e8f0';
  const axisColor = isDark ? '#94a3b8' : '#64748b';

  const chartData = useMemo(() => {
    const map = new Map<string, number>();

    if (mode === 'source') {
      const custById = new Map(state.customers.map((c) => [c.id, c]));
      for (const o of scope.branchOrders) {
        if (o.status === 'cancelled' || !isIsoInJalaliRange(o.createdAt, scope.fromJalali, scope.toJalali)) continue;
        const src = custById.get(o.customerId)?.source || 'سایر / مستقیم';
        const val = o.items.reduce((s, it) => s + it.qty * it.price, 0) - (o.discountAmount ?? 0);
        map.set(src, (map.get(src) ?? 0) + val);
      }
      for (const opp of scope.branchOpportunities) {
        if (opp.stage !== 'won' || !isIsoInJalaliRange(opp.createdAt, scope.fromJalali, scope.toJalali)) continue;
        const src = opp.source || 'سایر / مستقیم';
        map.set(src, (map.get(src) ?? 0) + opp.amount);
      }
    } else if (mode === 'owner') {
      for (const opp of scope.branchOpportunities) {
        if (opp.stage !== 'won' || !isIsoInJalaliRange(opp.createdAt, scope.fromJalali, scope.toJalali)) continue;
        map.set(opp.ownerName, (map.get(opp.ownerName) ?? 0) + opp.amount);
      }
      const custById = new Map(state.customers.map((c) => [c.id, c]));
      for (const o of scope.branchOrders) {
        if (o.status === 'cancelled' || !isIsoInJalaliRange(o.createdAt, scope.fromJalali, scope.toJalali)) continue;
        const owner = custById.get(o.customerId)?.ownerName || 'ثبت مستقیم';
        const val = o.items.reduce((s, it) => s + it.qty * it.price, 0) - (o.discountAmount ?? 0);
        map.set(owner, (map.get(owner) ?? 0) + val);
      }
    } else {
      for (const o of scope.branchOrders) {
        if (o.status === 'cancelled' || !isIsoInJalaliRange(o.createdAt, scope.fromJalali, scope.toJalali)) continue;
        for (const it of o.items) {
          map.set(it.name, (map.get(it.name) ?? 0) + it.qty * it.price);
        }
      }
    }

    return Array.from(map.entries())
      .map(([name, revenue]) => ({ name, revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6);
  }, [mode, scope, state.customers]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">درآمد بر اساس تفکیک تحلیلی</h2>
        <div className="flex gap-1 rounded-lg bg-slate-100 p-0.5 text-[11px] dark:bg-slate-800">
          {(
            [
              ['source', 'منبع'],
              ['owner', 'کارشناس'],
              ['product', 'محصول/خدمت'],
            ] as const
          ).map(([k, lbl]) => (
            <button
              key={k}
              type="button"
              onClick={() => setMode(k)}
              className={`rounded-md px-2.5 py-1 font-medium ${
                mode === k
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {lbl}
            </button>
          ))}
        </div>
      </div>

      <div className="h-64 w-full" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
            <XAxis dataKey="name" tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis
              tickFormatter={(v) => toFa(Math.round(Number(v) / 1_000_000))}
              tick={{ fill: axisColor, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(value: number) => [formatToman(value), 'درآمد']}
              contentStyle={TOOLTIP_STYLE(isDark, gridStroke)}
            />
            <Bar dataKey="revenue" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={38} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function CohortRetentionWidget({ scope }: { scope: DashboardAnalyticsScope }) {
  const { state } = useClientFlow();
  const isDark = state.settings.darkMode;
  const gridStroke = isDark ? '#1e293b' : '#e2e8f0';
  const axisColor = isDark ? '#94a3b8' : '#64748b';

  const cohortData = useMemo(() => {
    const activity = new Map<string, number>();
    for (const o of scope.branchOrders) {
      if (o.status !== 'cancelled') activity.set(o.customerId, (activity.get(o.customerId) ?? 0) + 1);
    }
    for (const a of scope.branchAppointments) {
      if (a.status === 'done') activity.set(a.customerId, (activity.get(a.customerId) ?? 0) + 1);
    }

    const byMonth = new Map<string, { month: string; size: number; m1: number; m2: number; m3: number }>();
    for (const c of scope.branchCustomers) {
      const m = formatJalali(c.createdAt, 'YYYY/MM');
      const cur = byMonth.get(m) ?? { month: m, size: 0, m1: 0, m2: 0, m3: 0 };
      cur.size += 1;
      const act = activity.get(c.id) ?? 0;
      const ok = c.lifecycle !== 'churned';
      if (ok && (act >= 1 || c.lifecycle === 'active' || c.lifecycle === 'vip')) cur.m1 += 1;
      if (ok && (act >= 2 || c.lifecycle === 'vip')) cur.m2 += 1;
      if (ok && c.lifecycle === 'vip') cur.m3 += 1;
      byMonth.set(m, cur);
    }

    return Array.from(byMonth.values())
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((r) => ({
        month: toFa(r.month),
        m1Pct: r.size > 0 ? Math.round((r.m1 / r.size) * 100) : 0,
        m2Pct: r.size > 0 ? Math.round((r.m2 / r.size) * 100) : 0,
        m3Pct: r.size > 0 ? Math.round((r.m3 / r.size) * 100) : 0,
      }));
  }, [scope]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold">نمودار ماندگاری هم‌گروه‌ها (Cohort Retention)</h2>
        <span className="text-[11px] text-slate-400">درصد حفظ مشتری ماه +۱ / +۲ / +۳</span>
      </div>
      <div className="h-64 w-full" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={cohortData} margin={{ top: 8, right: 12, left: -12, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
            <XAxis dataKey="month" tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 100]} tickFormatter={(v) => `${toFa(v)}٪`} tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip
              formatter={(value: number, name: string) => [
                `${toFa(value)}٪`,
                name === 'm1Pct' ? 'ماه +۱' : name === 'm2Pct' ? 'ماه +۲' : 'ماه +۳',
              ]}
              contentStyle={TOOLTIP_STYLE(isDark, gridStroke)}
            />
            <Legend
              formatter={(val) => (val === 'm1Pct' ? 'ماه +۱' : val === 'm2Pct' ? 'ماه +۲' : 'ماه +۳')}
              wrapperStyle={{ fontSize: 11 }}
            />
            <Line type="monotone" dataKey="m1Pct" stroke="#4f46e5" strokeWidth={2.5} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="m2Pct" stroke="#0ea5e9" strokeWidth={2.5} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="m3Pct" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function AgingChartWidget({ scope }: { scope: DashboardAnalyticsScope }) {
  const { state } = useClientFlow();
  const isDark = state.settings.darkMode;
  const gridStroke = isDark ? '#1e293b' : '#e2e8f0';
  const axisColor = isDark ? '#94a3b8' : '#64748b';
  const nowMs = Date.now();

  const agingBuckets = useMemo(() => {
    const b = { b0: 0, b31: 0, b61: 0, b90: 0 };
    for (const inv of scope.branchInvoices) {
      const open = Math.max(0, inv.grandTotal - inv.paidAmount);
      if (open <= 0) continue;
      const days = Math.max(0, Math.floor((nowMs - new Date(inv.dueAt).getTime()) / (24 * 3600_000)));
      if (days <= 30) b.b0 += open;
      else if (days <= 60) b.b31 += open;
      else if (days <= 90) b.b61 += open;
      else b.b90 += open;
    }
    return [
      { label: '۰ تا ۳۰ روز', amount: b.b0, color: '#10b981' },
      { label: '۳۱ تا ۶۰ روز', amount: b.b31, color: '#f59e0b' },
      { label: '۶۱ تا ۹۰ روز', amount: b.b61, color: '#f97316' },
      { label: 'بالای ۹۰ روز', amount: b.b90, color: '#ef4444' },
    ];
  }, [scope.branchInvoices, nowMs]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold">نمودار تراز سنی مطالبات (Aging)</h2>
        <span className="text-[11px] text-slate-400">برحسب میلیون تومان</span>
      </div>
      <div className="h-64 w-full" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={agingBuckets} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
            <XAxis dataKey="label" tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis
              tickFormatter={(v) => toFa(Math.round(Number(v) / 1_000_000))}
              tick={{ fill: axisColor, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(value: number) => [formatToman(value), 'مانده مطالبات']}
              contentStyle={TOOLTIP_STYLE(isDark, gridStroke)}
            />
            <Bar dataKey="amount" radius={[6, 6, 0, 0]} maxBarSize={44}>
              {agingBuckets.map((entry, idx) => (
                <Cell key={idx} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function SlaNpsTrendWidget({ scope }: { scope: DashboardAnalyticsScope }) {
  const { state } = useClientFlow();
  const isDark = state.settings.darkMode;
  const gridStroke = isDark ? '#1e293b' : '#e2e8f0';
  const axisColor = isDark ? '#94a3b8' : '#64748b';
  const nowMs = Date.now();

  const trendData = useMemo(() => {
    const months = new Map<string, { label: string; npsSum: number; npsCount: number; tkTotal: number; tkCompliant: number }>();

    for (const s of state.npsSurveys) {
      if (!isIsoInJalaliRange(s.createdAt, scope.fromJalali, scope.toJalali)) continue;
      const m = formatJalali(s.createdAt, 'YYYY/MM');
      const cur = months.get(m) ?? { label: m, npsSum: 0, npsCount: 0, tkTotal: 0, tkCompliant: 0 };
      const normalized10 = (s.surveyType ?? 'nps') === 'nps' ? s.score * 10 : Math.round((s.score / (s.maxScale ?? 5)) * 100);
      cur.npsSum += normalized10;
      cur.npsCount += 1;
      months.set(m, cur);
    }

    for (const tk of state.tickets) {
      if (tk.mergedIntoTicketId || !isIsoInJalaliRange(tk.createdAt, scope.fromJalali, scope.toJalali)) continue;
      const m = formatJalali(tk.createdAt, 'YYYY/MM');
      const cur = months.get(m) ?? { label: m, npsSum: 0, npsCount: 0, tkTotal: 0, tkCompliant: 0 };
      cur.tkTotal += 1;
      const ev = evaluateTicketSla(tk, state.slaPolicies, state.settings, state.officialHolidays, nowMs);
      if (ev.overallState !== 'breached') cur.tkCompliant += 1;
      months.set(m, cur);
    }

    return Array.from(months.values())
      .sort((a, b) => a.label.localeCompare(b.label))
      .map((r) => ({
        month: toFa(r.label),
        slaPct: r.tkTotal > 0 ? Math.round((r.tkCompliant / r.tkTotal) * 100) : 100,
        satisfactionPct: r.npsCount > 0 ? Math.round(r.npsSum / r.npsCount) : 80,
      }));
  }, [state.npsSurveys, state.tickets, state.slaPolicies, state.settings, state.officialHolidays, scope.fromJalali, scope.toJalali, nowMs]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold">روند انطباق SLA و رضایت مشتریان (NPS)</h2>
        <span className="text-[11px] text-slate-400">مقیاس ۰ تا ۱۰۰٪</span>
      </div>
      <div className="h-64 w-full" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={trendData} margin={{ top: 8, right: 12, left: -12, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
            <XAxis dataKey="month" tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 100]} tickFormatter={(v) => `${toFa(v)}٪`} tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip
              formatter={(value: number, name: string) => [
                `${toFa(value)}٪`,
                name === 'slaPct' ? 'انطباق SLA' : 'شاخص رضایت (NPS)',
              ]}
              contentStyle={TOOLTIP_STYLE(isDark, gridStroke)}
            />
            <Legend
              formatter={(v) => (v === 'slaPct' ? 'انطباق SLA' : 'شاخص رضایت (NPS)')}
              wrapperStyle={{ fontSize: 11 }}
            />
            <Line type="monotone" dataKey="slaPct" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4 }} />
            <Line type="monotone" dataKey="satisfactionPct" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function AppointmentsNoShowChart({
  scope,
  onNavigateAppointments,
}: {
  scope: DashboardAnalyticsScope;
  onNavigateAppointments: () => void;
}) {
  const { state } = useClientFlow();
  const lang = state.settings.language ?? 'fa';
  const latinDigits = state.settings.latinDigits;
  const isDark = state.settings.darkMode;
  const gridStroke = isDark ? '#1e293b' : '#e2e8f0';
  const axisColor = isDark ? '#94a3b8' : '#64748b';
  const fmtNum = (v: string | number) => displayDigits(v, lang, latinDigits);

  const data = useMemo(() => {
    const days = getJalaliWeekDays(0);
    return days.map((d) => {
      const dayApts = scope.branchAppointments.filter(
        (a) => a.status !== 'cancelled' && dayjs(a.start).format('YYYY-MM-DD') === d.dateKey,
      );
      const settled = dayApts.filter((a) => a.status === 'done' || a.status === 'noshow');
      const noShows = settled.filter((a) => a.status === 'noshow').length;
      const noShowRate = settled.length > 0 ? Math.round((noShows / settled.length) * 100) : 0;
      return {
        name: d.weekdayName,
        count: dayApts.length,
        noShowRate,
      };
    });
  }, [scope.branchAppointments]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold">نوبت‌های هفته و نرخ عدم حضور (No-Show)</h2>
        <button
          type="button"
          onClick={onNavigateAppointments}
          className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
        >
          تقویم نوبت‌ها
        </button>
      </div>
      <div className="h-64 w-full" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
            <XAxis dataKey="name" tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="left" allowDecimals={false} tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tickFormatter={(v) => `${toFa(v)}٪`} tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip
              formatter={(value: number, name: string) =>
                name === 'noShowRate'
                  ? [`${fmtNum(value)}٪`, 'نرخ عدم حضور']
                  : [fmtNum(value), 'تعداد نوبت']
              }
              contentStyle={TOOLTIP_STYLE(isDark, gridStroke)}
            />
            <Legend
              formatter={(v) => (v === 'noShowRate' ? 'نرخ عدم حضور (٪)' : 'تعداد نوبت')}
              wrapperStyle={{ fontSize: 11 }}
            />
            <Bar yAxisId="left" dataKey="count" fill="#4f46e5" radius={[6, 6, 0, 0]} maxBarSize={32} />
            <Line yAxisId="right" type="monotone" dataKey="noShowRate" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 3 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
