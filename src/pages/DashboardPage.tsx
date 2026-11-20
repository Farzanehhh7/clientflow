import { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpLeft,
  Columns2,
  Compass,
  Eye,
  EyeOff,
  GripVertical,
  Landmark,
  Maximize2,
  RotateCcw,
  SlidersHorizontal,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useClientFlow } from '../store/useClientFlowStore';
import type { DashboardWidgetConfig, DashboardWidgetId, OrderStatus } from '../types';
import { displayDigits, getUiText } from '../utils/i18n';
import { formatJalaliDateTime, formatToman, getJalaliWeekDays, isSameDay } from '../utils/jalali';
import { evaluateTicketSla, formatRemainingMinutesFa, isTicketClosedStatus } from '../utils/slaEngine';

export type NavPageKey =
  | 'dashboard'
  | 'customers'
  | 'appointments'
  | 'orders'
  | 'sales'
  | 'workflows'
  | 'marketing'
  | 'tasks'
  | 'tickets'
  | 'nps'
  | 'custom_entities'
  | 'reports'
  | 'automation'
  | 'settings';

interface DashboardPageProps {
  onNavigate: (page: NavPageKey) => void;
  onStartTour?: () => void;
}

const ORDER_STATUS_LABELS: Record<OrderStatus, { fa: string; en: string }> = {
  new: { fa: 'جدید', en: 'New' },
  confirmed: { fa: 'تأییدشده', en: 'Confirmed' },
  shipped: { fa: 'ارسال‌شده', en: 'Shipped' },
  delivered: { fa: 'تحویل‌شده', en: 'Delivered' },
  cancelled: { fa: 'لغوشده', en: 'Cancelled' },
};

const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  new: '#6366f1',
  confirmed: '#0284c7',
  shipped: '#d97706',
  delivered: '#16a34a',
  cancelled: '#64748b',
};

export function DashboardPage({ onNavigate, onStartTour }: DashboardPageProps) {
  const { state, toggleTaskDone, updateDashboardWidgets, resetDashboardWidgets, updateSettings } =
    useClientFlow();
  const [customizeMode, setCustomizeMode] = useState(false);
  const [draggingWidgetId, setDraggingWidgetId] = useState<DashboardWidgetId | null>(null);

  const lang = state.settings.language ?? 'fa';
  const latinDigits = state.settings.latinDigits;
  const isEn = lang === 'en';
  const t = getUiText(lang);
  const fmtNum = (v: string | number) => displayDigits(v, lang, latinDigits);

  const nowIso = new Date().toISOString();
  const nowMs = Date.now();
  const activeBranch = state.settings.activeBranchId;

  const branchCustomers = useMemo(() => {
    if (!activeBranch || activeBranch === 'all') return state.customers;
    return state.customers.filter((c) => !c.branchId || c.branchId === activeBranch);
  }, [state.customers, activeBranch]);

  const branchAppointments = useMemo(() => {
    if (!activeBranch || activeBranch === 'all') return state.appointments;
    return state.appointments.filter((a) => !a.branchId || a.branchId === activeBranch);
  }, [state.appointments, activeBranch]);

  const branchOrders = useMemo(() => {
    if (!activeBranch || activeBranch === 'all') return state.orders;
    return state.orders.filter((o) => !o.branchId || o.branchId === activeBranch);
  }, [state.orders, activeBranch]);

  const branchInvoices = useMemo(() => {
    if (!activeBranch || activeBranch === 'all') return state.invoices;
    return state.invoices.filter((inv) => !inv.branchId || inv.branchId === activeBranch);
  }, [state.invoices, activeBranch]);

  const branchOpportunities = useMemo(() => {
    if (!activeBranch || activeBranch === 'all') return state.opportunities;
    return state.opportunities.filter((opp) => !opp.branchId || opp.branchId === activeBranch);
  }, [state.opportunities, activeBranch]);

  const metrics = useMemo(() => {
    const todaysAppointments = branchAppointments.filter(
      (a) => a.status !== 'cancelled' && isSameDay(a.start, nowIso),
    ).length;

    const settledAppointments = branchAppointments.filter(
      (a) => a.status === 'done' || a.status === 'noshow',
    );
    const noShowCount = settledAppointments.filter((a) => a.status === 'noshow').length;
    const noShowRate =
      settledAppointments.length > 0
        ? Math.round((noShowCount / settledAppointments.length) * 100)
        : 0;

    const overdueOrders = branchOrders.filter(
      (o) =>
        o.promisedAt &&
        new Date(o.promisedAt).getTime() < nowMs &&
        o.status !== 'delivered' &&
        o.status !== 'cancelled',
    ).length;

    return {
      totalCustomers: branchCustomers.length,
      todaysAppointments,
      noShowRate,
      overdueOrders,
    };
  }, [branchAppointments, branchCustomers.length, branchOrders, nowIso, nowMs]);

  const financeMetrics = useMemo(() => {
    const totalBilled = branchInvoices.reduce((s, inv) => s + inv.grandTotal, 0);
    const totalPaid = branchInvoices.reduce((s, inv) => s + inv.paidAmount, 0);
    const receivables = Math.max(0, totalBilled - totalPaid);
    const activeCheques = state.sayadiCheques.filter(
      (c) => c.status === 'received' || c.status === 'deposited',
    );
    const bouncedCount = state.sayadiCheques.filter((c) => c.status === 'bounced').length;
    const gatewayPaidCount = state.paymentTransactions.filter((p) => p.status === 'succeeded').length;
    return {
      totalBilled,
      totalPaid,
      receivables,
      activeChequesAmount: activeCheques.reduce((s, c) => s + c.amount, 0),
      activeChequesCount: activeCheques.length,
      bouncedCount,
      gatewayPaidCount,
    };
  }, [branchInvoices, state.sayadiCheques, state.paymentTransactions]);

  const pipelineMetrics = useMemo(() => {
    const activeOpps = branchOpportunities.filter((o) => o.stage !== 'won' && o.stage !== 'lost');
    const wonOpps = branchOpportunities.filter((o) => o.stage === 'won');
    const totalActiveVal = activeOpps.reduce((s, o) => s + o.amount, 0);
    const weightedForecast = activeOpps.reduce(
      (s, o) => s + Math.round((o.amount * o.probability) / 100),
      0,
    );
    const wonVal = wonOpps.reduce((s, o) => s + o.amount, 0);
    const openQuotes = state.quotes.filter((q) => q.status === 'sent' || q.status === 'draft').length;
    return {
      activeCount: activeOpps.length,
      totalActiveVal,
      weightedForecast,
      wonVal,
      openQuotes,
    };
  }, [branchOpportunities, state.quotes]);

  const weeklyAppointmentsData = useMemo(() => {
    const days = getJalaliWeekDays(0);
    return days.map((d) => {
      const count = branchAppointments.filter(
        (a) => a.status !== 'cancelled' && dayjs(a.start).format('YYYY-MM-DD') === d.dateKey,
      ).length;
      return {
        name: d.weekdayName,
        count,
      };
    });
  }, [branchAppointments]);

  const ordersByStatusData = useMemo(() => {
    const statuses: OrderStatus[] = ['new', 'confirmed', 'shipped', 'delivered', 'cancelled'];
    return statuses.map((s) => ({
      status: s,
      name: ORDER_STATUS_LABELS[s][lang],
      count: branchOrders.filter((o) => o.status === s).length,
      color: ORDER_STATUS_COLORS[s],
    }));
  }, [branchOrders, lang]);

  const urgentTasks = useMemo(
    () =>
      state.tasks
        .filter((tItem) => !tItem.done)
        .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())
        .slice(0, 5),
    [state.tasks],
  );

  const openTickets = useMemo(
    () => state.tickets.filter((tk) => !isTicketClosedStatus(tk.status)).slice(0, 5),
    [state.tickets],
  );

  const slaOverview = useMemo(() => {
    const active = state.tickets.filter((tk) => !isTicketClosedStatus(tk.status) && !tk.mergedIntoTicketId);
    const evals = active.map((tk) => ({
      ticket: tk,
      evalRes: evaluateTicketSla(tk, state.slaPolicies, state.settings, state.officialHolidays, nowMs),
    }));
    const breached = evals.filter((x) => x.evalRes.overallState === 'breached');
    const warning = evals.filter((x) => x.evalRes.overallState === 'warning');
    const totalEval = state.tickets.filter((tk) => !tk.mergedIntoTicketId);
    const totalCompliant = totalEval.filter((tk) => {
      const ev = evaluateTicketSla(tk, state.slaPolicies, state.settings, state.officialHolidays, nowMs);
      return ev.overallState !== 'breached';
    }).length;
    const compliancePct = totalEval.length > 0 ? Math.round((totalCompliant / totalEval.length) * 100) : 100;
    const avgFirstRespMin =
      totalEval.filter((tk) => tk.firstRespondedAt).length > 0
        ? Math.round(
            totalEval
              .filter((tk) => tk.firstRespondedAt)
              .reduce(
                (sum, tk) =>
                  sum +
                  evaluateTicketSla(tk, state.slaPolicies, state.settings, state.officialHolidays, nowMs)
                    .firstRespElapsedMin,
                0,
              ) / totalEval.filter((tk) => tk.firstRespondedAt).length,
          )
        : 0;
    const urgent = [...evals]
      .sort((a, b) => a.evalRes.resolutionRemainingMin - b.evalRes.resolutionRemainingMin)
      .slice(0, 3);
    return {
      activeCount: active.length,
      breachedCount: breached.length,
      warningCount: warning.length,
      compliancePct,
      avgFirstRespMin,
      urgent,
    };
  }, [state.tickets, state.slaPolicies, state.settings, state.officialHolidays, nowMs]);

  const sortedWidgets = useMemo(
    () => [...state.settings.dashboardWidgets].sort((a, b) => a.order - b.order),
    [state.settings.dashboardWidgets],
  );

  const moveWidget = (idx: number, dir: -1 | 1) => {
    const nextIdx = idx + dir;
    if (nextIdx < 0 || nextIdx >= sortedWidgets.length) return;
    const copy = [...sortedWidgets];
    const [item] = copy.splice(idx, 1);
    copy.splice(nextIdx, 0, item);
    updateDashboardWidgets(copy.map((w, i) => ({ ...w, order: i + 1 })));
  };

  const handleDropWidget = (targetId: DashboardWidgetId) => {
    if (!draggingWidgetId || draggingWidgetId === targetId) return;
    const copy = [...sortedWidgets];
    const fromIdx = copy.findIndex((w) => w.id === draggingWidgetId);
    const toIdx = copy.findIndex((w) => w.id === targetId);
    if (fromIdx < 0 || toIdx < 0) return;
    const [moved] = copy.splice(fromIdx, 1);
    copy.splice(toIdx, 0, moved);
    updateDashboardWidgets(copy.map((w, i) => ({ ...w, order: i + 1 })));
    setDraggingWidgetId(null);
  };

  const toggleWidgetVisible = (id: DashboardWidgetId) => {
    updateDashboardWidgets(
      sortedWidgets.map((w) => (w.id === id ? { ...w, visible: !w.visible } : w)),
    );
  };

  const toggleWidgetSize = (id: DashboardWidgetId) => {
    updateDashboardWidgets(
      sortedWidgets.map((w) => (w.id === id ? { ...w, size: w.size === 'full' ? 'half' : 'full' } : w)),
    );
  };

  const isDark = state.settings.darkMode;
  const gridStroke = isDark ? '#1e293b' : '#e2e8f0';
  const axisColor = isDark ? '#94a3b8' : '#64748b';
  const activeBranchObj = state.branches.find((b) => b.id === activeBranch);

  const renderWidgetBody = (w: DashboardWidgetConfig) => {
    switch (w.id) {
      case 'kpi_summary':
        return (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {t.dash.totalCustomers}
              </div>
              <div className="mt-2 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
                {fmtNum(metrics.totalCustomers)}
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {t.dash.registeredInBranch}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {t.dash.todaysAppointments}
              </div>
              <div className="mt-2 text-2xl font-bold tabular-nums text-indigo-600 dark:text-indigo-400">
                {fmtNum(metrics.todaysAppointments)}
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {t.dash.activeToday}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {t.dash.noShowRate}
              </div>
              <div className="mt-2 text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-400">
                {fmtNum(metrics.noShowRate)}
                {isEn ? '%' : '٪'}
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {t.dash.settledRatio}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {t.dash.overdueOrders}
              </div>
              <div className="mt-2 text-2xl font-bold tabular-nums text-rose-600 dark:text-rose-400">
                {fmtNum(metrics.overdueOrders)}
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {t.dash.passedPromised}
              </div>
            </div>
          </div>
        );

      case 'chart_appointments':
        return (
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold">{t.dash.weeklyAppts}</h2>
              <button
                type="button"
                onClick={() => onNavigate('appointments')}
                className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
              >
                {isEn ? 'Calendar' : 'تقویم نوبت‌ها'}
                <ArrowUpLeft size={14} />
              </button>
            </div>
            <div className="h-64 w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyAppointmentsData} margin={{ top: 8, right: 12, left: -16, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: axisColor, fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fill: axisColor, fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(value: number) => [fmtNum(value), isEn ? 'Appointments' : 'تعداد نوبت']}
                    contentStyle={{
                      borderRadius: 8,
                      border: `1px solid ${gridStroke}`,
                      backgroundColor: isDark ? '#0f172a' : '#ffffff',
                      color: isDark ? '#f8fafc' : '#0f172a',
                      fontFamily: 'Vazirmatn, sans-serif',
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="count" fill="#4f46e5" radius={[6, 6, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        );

      case 'chart_orders':
        return (
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold">{t.dash.ordersStatus}</h2>
              <button
                type="button"
                onClick={() => onNavigate('orders')}
                className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
              >
                {isEn ? 'Orders' : 'مدیریت سفارش‌ها'}
                <ArrowUpLeft size={14} />
              </button>
            </div>
            <div className="h-64 w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ordersByStatusData} margin={{ top: 8, right: 12, left: -16, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: axisColor, fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fill: axisColor, fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(value: number) => [fmtNum(value), isEn ? 'Orders' : 'تعداد سفارش']}
                    contentStyle={{
                      borderRadius: 8,
                      border: `1px solid ${gridStroke}`,
                      backgroundColor: isDark ? '#0f172a' : '#ffffff',
                      color: isDark ? '#f8fafc' : '#0f172a',
                      fontFamily: 'Vazirmatn, sans-serif',
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={44}>
                    {ordersByStatusData.map((entry) => (
                      <Cell key={entry.status} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        );

      case 'chart_finance':
        return (
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Wallet size={16} className="text-emerald-500" />
                {t.dash.financeOverview}
              </h2>
              <button
                type="button"
                onClick={() => onNavigate('orders')}
                className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
              >
                {t.dash.viewAll}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-800/40">
                <div className="text-slate-500">{isEn ? 'Collected Revenue' : 'مجموع وصول‌شده'}</div>
                <div className="mt-1 text-sm font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {formatToman(financeMetrics.totalPaid)}
                </div>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-800/40">
                <div className="text-slate-500">{isEn ? 'Open Receivables' : 'مطالبات باز'}</div>
                <div className="mt-1 text-sm font-bold tabular-nums text-rose-600 dark:text-rose-400">
                  {formatToman(financeMetrics.receivables)}
                </div>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-800/40">
                <div className="text-slate-500">
                  {isEn ? 'Pending Cheques' : `چک‌های صیادی در جریان (${fmtNum(financeMetrics.activeChequesCount)})`}
                </div>
                <div className="mt-1 text-sm font-bold tabular-nums text-indigo-600 dark:text-indigo-400">
                  {formatToman(financeMetrics.activeChequesAmount)}
                </div>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-800/40">
                <div className="text-slate-500">
                  {isEn ? 'Gateway Tx / Bounced' : 'تراکنش موفق / چک برگشتی'}
                </div>
                <div className="mt-1 text-sm font-bold tabular-nums">
                  <span className="text-emerald-600">{fmtNum(financeMetrics.gatewayPaidCount)}</span>
                  {' / '}
                  <span className={financeMetrics.bouncedCount > 0 ? 'text-rose-600' : 'text-slate-500'}>
                    {fmtNum(financeMetrics.bouncedCount)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        );

      case 'kpi_pipeline':
        return (
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <TrendingUp size={16} className="text-indigo-500" />
                {t.dash.pipelineOverview}
              </h2>
              <button
                type="button"
                onClick={() => onNavigate('sales')}
                className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
              >
                {t.dash.viewAll}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-800/40">
                <div className="text-slate-500">
                  {isEn ? `Active Deals (${pipelineMetrics.activeCount})` : `معاملات باز (${fmtNum(pipelineMetrics.activeCount)})`}
                </div>
                <div className="mt-1 text-sm font-bold tabular-nums">
                  {formatToman(pipelineMetrics.totalActiveVal)}
                </div>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-800/40">
                <div className="text-slate-500">{isEn ? 'Weighted Forecast' : 'پیش‌بینی وزنی فروش'}</div>
                <div className="mt-1 text-sm font-bold tabular-nums text-indigo-600 dark:text-indigo-400">
                  {formatToman(pipelineMetrics.weightedForecast)}
                </div>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-800/40">
                <div className="text-slate-500">{isEn ? 'Won Revenue' : 'معاملات موفق (Won)'}</div>
                <div className="mt-1 text-sm font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {formatToman(pipelineMetrics.wonVal)}
                </div>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-800/40">
                <div className="text-slate-500">{isEn ? 'Pending Quotes' : 'پیش‌فاکتورهای باز'}</div>
                <div className="mt-1 text-sm font-bold tabular-nums">{fmtNum(pipelineMetrics.openQuotes)}</div>
              </div>
            </div>
          </div>
        );

      case 'list_tasks':
        return (
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">{t.dash.urgentTasks}</h2>
              <button
                type="button"
                onClick={() => onNavigate('tasks')}
                className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
              >
                {t.dash.viewAll}
              </button>
            </div>
            {urgentTasks.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-500">
                {isEn ? 'All follow-up tasks are done.' : 'همه پیگیری‌ها انجام شده است.'}
              </p>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {urgentTasks.map((task) => {
                  const overdue = new Date(task.dueAt).getTime() < nowMs;
                  const cust = state.customers.find((c) => c.id === task.customerId);
                  return (
                    <div key={task.id} className="flex items-center justify-between gap-3 py-2.5">
                      <label className="flex min-w-0 cursor-pointer items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={task.done}
                          onChange={() => toggleTaskDone(task.id)}
                          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="truncate text-sm text-slate-800 dark:text-slate-200">
                          {task.title}
                        </span>
                      </label>
                      <div className="shrink-0 text-xs tabular-nums">
                        {cust && <span className="ml-2 text-slate-400">{cust.name} ·</span>}
                        <span className={overdue ? 'font-medium text-rose-600 dark:text-rose-400' : 'text-slate-500'}>
                          {overdue ? (isEn ? 'Overdue · ' : 'معوق · ') : ''}
                          {formatJalaliDateTime(task.dueAt)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );

      case 'list_tickets':
        return (
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">{t.dash.openTickets}</h2>
              <button
                type="button"
                onClick={() => onNavigate('tickets')}
                className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
              >
                {t.dash.viewAll}
              </button>
            </div>
            {openTickets.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-500">
                {isEn ? 'No open support tickets.' : 'هیچ تیکت بازی وجود ندارد.'}
              </p>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {openTickets.map((ticket) => {
                  const cust = state.customers.find((c) => c.id === ticket.customerId);
                  const priorityLabel = isEn
                    ? ticket.priority.toUpperCase()
                    : ticket.priority === 'high'
                      ? 'فوری'
                      : ticket.priority === 'normal'
                        ? 'عادی'
                        : 'کم';
                  const priorityClass =
                    ticket.priority === 'high'
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-slate-500 dark:text-slate-400';
                  return (
                    <div key={ticket.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                          {ticket.subject}
                        </div>
                        <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                          {cust?.name ?? 'مشتری'} ·{' '}
                          <span className="tabular-nums">{formatJalaliDateTime(ticket.createdAt)}</span>
                        </div>
                      </div>
                      <span className={`shrink-0 text-xs font-medium ${priorityClass}`}>{priorityLabel}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );

      case 'sla_overview':
        return (
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">
                {isEn ? 'Support SLA Monitor' : 'پایش SLA و عملکرد پشتیبانی'}
              </h2>
              <button
                type="button"
                onClick={() => onNavigate('tickets')}
                className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
              >
                {t.dash.viewAll}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
              <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
                <div className="text-slate-500 dark:text-slate-400">نرخ انطباق SLA</div>
                <div className="mt-1 text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {fmtNum(slaOverview.compliancePct)}٪
                </div>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
                <div className="text-slate-500 dark:text-slate-400">در آستانه هشدار</div>
                <div className="mt-1 text-lg font-bold tabular-nums text-amber-600 dark:text-amber-400">
                  {fmtNum(slaOverview.warningCount)}
                </div>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
                <div className="text-slate-500 dark:text-slate-400">نقض‌شده (Breach)</div>
                <div className="mt-1 text-lg font-bold tabular-nums text-rose-600 dark:text-rose-400">
                  {fmtNum(slaOverview.breachedCount)}
                </div>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
                <div className="text-slate-500 dark:text-slate-400">میانگین پاسخ اول</div>
                <div className="mt-1 text-lg font-bold tabular-nums text-slate-900 dark:text-slate-100">
                  {fmtNum(slaOverview.avgFirstRespMin)} د
                </div>
              </div>
            </div>
            {slaOverview.urgent.length > 0 && (
              <div className="mt-3 divide-y divide-slate-200 dark:divide-slate-800">
                {slaOverview.urgent.map(({ ticket, evalRes }) => (
                  <div key={ticket.id} className="flex items-center justify-between gap-2 py-2 text-xs">
                    <span className="truncate font-medium text-slate-800 dark:text-slate-200">
                      {ticket.subject}
                    </span>
                    <span
                      className={`shrink-0 font-semibold tabular-nums whitespace-nowrap ${
                        evalRes.overallState === 'breached'
                          ? 'text-rose-600 dark:text-rose-400'
                          : evalRes.overallState === 'warning'
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {formatRemainingMinutesFa(evalRes.resolutionRemainingMin)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'list_cheques':
        return (
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Landmark size={16} className="text-indigo-500" />
                {t.dash.chequesDue}
              </h2>
              <button
                type="button"
                onClick={() => onNavigate('orders')}
                className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
              >
                {t.dash.viewAll}
              </button>
            </div>
            {state.sayadiCheques.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-500">چک صیادی ثبت نشده است.</p>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {state.sayadiCheques.slice(0, 5).map((chq) => (
                  <div key={chq.id} className="flex items-center justify-between gap-2 py-2.5 text-xs">
                    <div>
                      <div className="font-medium text-slate-800 dark:text-slate-200">
                        {chq.drawerName} · {chq.bankName}
                      </div>
                      <div className="mt-0.5 tabular-nums text-slate-500">
                        سررسید: {fmtNum(chq.dueDateJalali)} · شماره {fmtNum(chq.chequeNo)}
                      </div>
                    </div>
                    <div className="text-left">
                      <div className="font-bold tabular-nums">{formatToman(chq.amount)}</div>
                      <div
                        className={`text-[10px] font-medium ${
                          chq.status === 'bounced'
                            ? 'text-rose-600'
                            : chq.status === 'cleared'
                              ? 'text-emerald-600'
                              : 'text-amber-600'
                        }`}
                      >
                        {chq.status === 'cleared'
                          ? 'وصول‌شده'
                          : chq.status === 'bounced'
                            ? 'برگشتی'
                            : chq.status === 'deposited'
                              ? 'واگذارشده به بانک'
                              : 'نزد صندوق'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
    }
  };

  return (
    <div className="space-y-5">
      {/* Non-blocking Onboarding Starter Banner */}
      {!state.settings.onboardingCompleted && onStartTour && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-200 bg-indigo-50/70 px-4 py-3 text-xs dark:border-indigo-900/60 dark:bg-indigo-950/30">
          <div className="flex items-center gap-2.5 text-indigo-900 dark:text-indigo-200">
            <Compass size={18} className="shrink-0 text-indigo-600 dark:text-indigo-400" />
            <span>
              {isEn
                ? 'New to ClientFlow? Take the 6-step interactive tour to explore widgets, Sayadi cheques, BI cohorts, and 10 industry packs.'
                : 'به ClientFlow خوش آمدید! با تور راهنمای تعاملی ۶ مرحله‌ای با چیدمان داشبورد، چک صیادی، گزارش‌های Cohort و ۱۰ پک صنعتی آشنا شوید.'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onStartTour}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 font-medium text-white hover:bg-indigo-700"
            >
              {isEn ? 'Start Tour' : 'شروع تور راهنما'}
            </button>
            <button
              type="button"
              onClick={() => updateSettings({ onboardingCompleted: true })}
              aria-label="بستن"
              className="rounded-lg p-1 text-indigo-600 hover:bg-indigo-100 dark:text-indigo-300 dark:hover:bg-indigo-900/50"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Dashboard Toolbar: Active Branch + Widget Layout Customizer */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-slate-500 dark:text-slate-400">
          {activeBranchObj
            ? isEn
              ? `Branch Scope: ${activeBranchObj.name} (${activeBranchObj.city})`
              : `محدوده شعبه فعال: ${activeBranchObj.name} (${activeBranchObj.city})`
            : isEn
              ? 'Scope: All Branches Combined'
              : 'نمای تجمیعی: همه شعبه‌ها'}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {customizeMode && (
            <button
              type="button"
              onClick={resetDashboardWidgets}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            >
              <RotateCcw size={13} />
              {t.resetLayout}
            </button>
          )}
          <button
            type="button"
            onClick={() => setCustomizeMode((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              customizeMode
                ? 'border-indigo-600 bg-indigo-600 text-white'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            <SlidersHorizontal size={14} />
            {customizeMode ? t.doneCustomizing : t.customizeDashboard}
          </button>
        </div>
      </div>

      {/* Customizable Widget Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {sortedWidgets.map((w, idx) => {
          if (!w.visible && !customizeMode) return null;
          return (
            <div
              key={w.id}
              draggable={customizeMode}
              onDragStart={() => setDraggingWidgetId(w.id)}
              onDragOver={(e) => {
                if (customizeMode) e.preventDefault();
              }}
              onDrop={() => customizeMode && handleDropWidget(w.id)}
              className={`${w.size === 'full' ? 'lg:col-span-2' : 'lg:col-span-1'} ${
                customizeMode
                  ? `rounded-2xl border-2 border-dashed p-2 transition-colors ${
                      w.visible
                        ? 'border-indigo-300 bg-indigo-50/20 dark:border-indigo-800 dark:bg-indigo-950/10'
                        : 'border-slate-300 bg-slate-100/60 opacity-60 dark:border-slate-700 dark:bg-slate-900/40'
                    }`
                  : ''
              }`}
            >
              {customizeMode && (
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1 text-xs">
                  <div className="flex items-center gap-1.5 font-semibold text-indigo-700 dark:text-indigo-300">
                    <GripVertical size={14} className="cursor-grab" />
                    <span>{isEn ? w.titleEn : w.title}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => moveWidget(idx, -1)}
                      disabled={idx === 0}
                      title="انتقال به بالا"
                      className="rounded border border-slate-200 bg-white p-1 text-slate-600 disabled:opacity-30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    >
                      <ArrowUp size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveWidget(idx, 1)}
                      disabled={idx === sortedWidgets.length - 1}
                      title="انتقال به پایین"
                      className="rounded border border-slate-200 bg-white p-1 text-slate-600 disabled:opacity-30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    >
                      <ArrowDown size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleWidgetSize(w.id)}
                      title="تغییر عرض ویجت (نیمه / تمام‌عرض)"
                      className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    >
                      {w.size === 'full' ? <Columns2 size={12} /> : <Maximize2 size={12} />}
                      {w.size === 'full' ? (isEn ? 'Half' : 'نیم‌عرض') : isEn ? 'Full' : 'تمام‌عرض'}
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleWidgetVisible(w.id)}
                      title={w.visible ? 'مخفی کردن ویجت' : 'نمایش ویجت'}
                      className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    >
                      {w.visible ? <EyeOff size={12} /> : <Eye size={12} />}
                      {w.visible ? (isEn ? 'Hide' : 'مخفی') : isEn ? 'Show' : 'نمایش'}
                    </button>
                  </div>
                </div>
              )}

              {w.visible ? renderWidgetBody(w) : (
                <div className="py-6 text-center text-xs text-slate-500">
                  {isEn ? `${w.titleEn} (Hidden)` : `ویجت «${w.title}» مخفی است`}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
