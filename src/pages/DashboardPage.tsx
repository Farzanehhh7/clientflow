import { useMemo } from 'react';
import dayjs from 'dayjs';
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
import { ArrowUpLeft } from 'lucide-react';
import { useClientFlow } from '../store/useClientFlowStore';
import type { OrderStatus } from '../types';
import { formatJalaliDateTime, getJalaliWeekDays, isSameDay, toFa } from '../utils/jalali';

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
}

const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  new: 'جدید',
  confirmed: 'تأییدشده',
  shipped: 'ارسال‌شده',
  delivered: 'تحویل‌شده',
  cancelled: 'لغوشده',
};

const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  new: '#6366f1',
  confirmed: '#0284c7',
  shipped: '#d97706',
  delivered: '#16a34a',
  cancelled: '#64748b',
};

export function DashboardPage({ onNavigate }: DashboardPageProps) {
  const { state, toggleTaskDone } = useClientFlow();
  const nowIso = new Date().toISOString();
  const nowMs = Date.now();

  const metrics = useMemo(() => {
    const todaysAppointments = state.appointments.filter(
      (a) => a.status !== 'cancelled' && isSameDay(a.start, nowIso),
    ).length;

    const settledAppointments = state.appointments.filter(
      (a) => a.status === 'done' || a.status === 'noshow',
    );
    const noShowCount = settledAppointments.filter((a) => a.status === 'noshow').length;
    const noShowRate =
      settledAppointments.length > 0
        ? Math.round((noShowCount / settledAppointments.length) * 100)
        : 0;

    const overdueOrders = state.orders.filter(
      (o) =>
        o.promisedAt &&
        new Date(o.promisedAt).getTime() < nowMs &&
        o.status !== 'delivered' &&
        o.status !== 'cancelled',
    ).length;

    return {
      totalCustomers: state.customers.length,
      todaysAppointments,
      noShowRate,
      overdueOrders,
    };
  }, [state.appointments, state.customers.length, state.orders, nowIso, nowMs]);

  const weeklyAppointmentsData = useMemo(() => {
    const days = getJalaliWeekDays(0);
    return days.map((d) => {
      const count = state.appointments.filter(
        (a) => a.status !== 'cancelled' && dayjs(a.start).format('YYYY-MM-DD') === d.dateKey,
      ).length;
      return {
        name: d.weekdayName,
        count,
      };
    });
  }, [state.appointments]);

  const ordersByStatusData = useMemo(() => {
    const statuses: OrderStatus[] = ['new', 'confirmed', 'shipped', 'delivered', 'cancelled'];
    return statuses.map((s) => ({
      status: s,
      name: ORDER_STATUS_LABELS[s],
      count: state.orders.filter((o) => o.status === s).length,
      color: ORDER_STATUS_COLORS[s],
    }));
  }, [state.orders]);

  const urgentTasks = useMemo(
    () =>
      state.tasks
        .filter((t) => !t.done)
        .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())
        .slice(0, 5),
    [state.tasks],
  );

  const openTickets = useMemo(
    () => state.tickets.filter((t) => t.status !== 'resolved').slice(0, 5),
    [state.tickets],
  );

  const isDark = state.settings.darkMode;
  const gridStroke = isDark ? '#1e293b' : '#e2e8f0';
  const axisColor = isDark ? '#94a3b8' : '#64748b';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">تعداد کل مشتریان</div>
          <div className="mt-2 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
            {toFa(metrics.totalCustomers)}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            ثبت‌شده در سیستم
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">نوبت‌های امروز</div>
          <div className="mt-2 text-2xl font-bold tabular-nums text-indigo-600 dark:text-indigo-400">
            {toFa(metrics.todaysAppointments)}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            نوبت‌های فعال امروز
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">نرخ غیبت (No-Show)</div>
          <div className="mt-2 text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-400">
            {toFa(metrics.noShowRate)}٪
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            نسبت به نوبت‌های نهایی‌شده
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">سفارش‌های دارای تأخیر</div>
          <div className="mt-2 text-2xl font-bold tabular-nums text-rose-600 dark:text-rose-400">
            {toFa(metrics.overdueOrders)}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            عبور از زمان وعده‌داده‌شده
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold">نوبت‌های هفته جاری (شنبه تا جمعه)</h2>
            <button
              type="button"
              onClick={() => onNavigate('appointments')}
              className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
            >
              تقویم نوبت‌ها
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
                  formatter={(value: number) => [toFa(value), 'تعداد نوبت']}
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

        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold">وضعیت سفارش‌ها</h2>
            <button
              type="button"
              onClick={() => onNavigate('orders')}
              className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
            >
              مدیریت سفارش‌ها
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
                  formatter={(value: number) => [toFa(value), 'تعداد سفارش']}
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
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">پیگیری‌های فوری و امروز</h2>
            <button
              type="button"
              onClick={() => onNavigate('tasks')}
              className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
            >
              مشاهده همه
            </button>
          </div>
          {urgentTasks.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-500">همه پیگیری‌ها انجام شده است.</p>
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
                        {overdue ? 'معوق · ' : ''}
                        {formatJalaliDateTime(task.dueAt)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">آخرین تیکت‌های باز</h2>
            <button
              type="button"
              onClick={() => onNavigate('tickets')}
              className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
            >
              مشاهده همه
            </button>
          </div>
          {openTickets.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-500">هیچ تیکت بازی وجود ندارد.</p>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {openTickets.map((ticket) => {
                const cust = state.customers.find((c) => c.id === ticket.customerId);
                const priorityLabel =
                  ticket.priority === 'high' ? 'فوری' : ticket.priority === 'normal' ? 'عادی' : 'کم';
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
                        {cust?.name ?? 'مشتری'} · <span className="tabular-nums">{formatJalaliDateTime(ticket.createdAt)}</span>
                      </div>
                    </div>
                    <span className={`shrink-0 text-xs font-medium ${priorityClass}`}>{priorityLabel}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
