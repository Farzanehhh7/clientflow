import { useMemo, useState } from 'react';
import { CalendarClock, Download, Mail, Plus, Printer, Trash2 } from 'lucide-react';
import { useClientFlow } from '../store/useClientFlowStore';
import type { ScheduledReport } from '../types';
import { exportRowsToCsv } from '../utils/csv';
import { formatJalali, formatJalaliDateTime, formatToman, toFa } from '../utils/jalali';

type DatasetKey = 'customers' | 'appointments' | 'orders' | 'invoices' | 'opportunities' | 'tickets';

const DATASET_LABELS: Record<DatasetKey, string> = {
  customers: 'مشتریان',
  appointments: 'نوبت‌ها',
  orders: 'سفارش‌ها',
  invoices: 'فاکتورها',
  opportunities: 'فرصت‌های فروش',
  tickets: 'تیکت‌های پشتیبانی',
};

const SCHED_DATASET_LABELS: Record<ScheduledReport['dataset'], string> = {
  aging: 'تراز سنی مطالبات',
  resources: 'عملکرد پزشکان و منابع',
  cohort: 'تحلیل Cohort و LTV',
  customers: 'فهرست مشتریان',
  orders: 'گزارش سفارش‌ها',
  invoices: 'گزارش فاکتورها',
  opportunities: 'قیف فروش',
  tickets: 'گزارش پشتیبانی و SLA',
};

export function ReportsPage() {
  const {
    state,
    addScheduledReport,
    toggleScheduledReport,
    deleteScheduledReport,
    runScheduledReportNow,
  } = useClientFlow();
  const [tab, setTab] = useState<'aging' | 'resources' | 'cohort' | 'builder' | 'scheduled'>('aging');
  const [dataset, setDataset] = useState<DatasetKey>('orders');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Scheduled report form
  const [schedTitle, setSchedTitle] = useState('');
  const [schedDataset, setSchedDataset] = useState<ScheduledReport['dataset']>('cohort');
  const [schedFreq, setSchedFreq] = useState<ScheduledReport['frequency']>('weekly');
  const [schedFormat, setSchedFormat] = useState<ScheduledReport['format']>('pdf');
  const [schedRecipients, setSchedRecipients] = useState('ceo@clientflow.ir');

  const nowMs = Date.now();
  const activeBranch = state.settings.activeBranchId;

  const branchInvoices = useMemo(() => {
    if (!activeBranch || activeBranch === 'all') return state.invoices;
    return state.invoices.filter((inv) => !inv.branchId || inv.branchId === activeBranch);
  }, [state.invoices, activeBranch]);

  const branchCustomers = useMemo(() => {
    if (!activeBranch || activeBranch === 'all') return state.customers;
    return state.customers.filter((c) => !c.branchId || c.branchId === activeBranch);
  }, [state.customers, activeBranch]);

  const branchOrders = useMemo(() => {
    if (!activeBranch || activeBranch === 'all') return state.orders;
    return state.orders.filter((o) => !o.branchId || o.branchId === activeBranch);
  }, [state.orders, activeBranch]);

  const branchAppointments = useMemo(() => {
    if (!activeBranch || activeBranch === 'all') return state.appointments;
    return state.appointments.filter((a) => !a.branchId || a.branchId === activeBranch);
  }, [state.appointments, activeBranch]);

  // 1. Receivable Aging Calculation
  const agingData = useMemo(() => {
    const byCustomer = new Map<
      string,
      {
        customerId: string;
        customerName: string;
        phone: string;
        bucket0_30: number;
        bucket31_60: number;
        bucketOver60: number;
        totalOpen: number;
        invoiceCount: number;
      }
    >();

    let total0_30 = 0;
    let total31_60 = 0;
    let totalOver60 = 0;

    for (const inv of branchInvoices) {
      const balance = Math.max(0, inv.grandTotal - inv.paidAmount);
      if (balance <= 0) continue;

      const cust = state.customers.find((c) => c.id === inv.customerId);
      const ageDays = Math.max(0, Math.floor((nowMs - new Date(inv.dueAt).getTime()) / (24 * 3600_000)));
      const row = byCustomer.get(inv.customerId) ?? {
        customerId: inv.customerId,
        customerName: cust?.name ?? 'مشتری',
        phone: cust?.phone ?? '—',
        bucket0_30: 0,
        bucket31_60: 0,
        bucketOver60: 0,
        totalOpen: 0,
        invoiceCount: 0,
      };

      if (ageDays <= 30) {
        row.bucket0_30 += balance;
        total0_30 += balance;
      } else if (ageDays <= 60) {
        row.bucket31_60 += balance;
        total31_60 += balance;
      } else {
        row.bucketOver60 += balance;
        totalOver60 += balance;
      }
      row.totalOpen += balance;
      row.invoiceCount += 1;
      byCustomer.set(inv.customerId, row);
    }

    const rows = Array.from(byCustomer.values()).sort((a, b) => b.totalOpen - a.totalOpen);
    return {
      rows,
      total0_30,
      total31_60,
      totalOver60,
      grandReceivables: total0_30 + total31_60 + totalOver60,
    };
  }, [branchInvoices, state.customers, nowMs]);

  // 2. Resource / Doctor Performance
  const resourceStats = useMemo(() => {
    return state.resources.map((res) => {
      const list = branchAppointments.filter((a) => a.resourceId === res.id);
      const doneList = list.filter((a) => a.status === 'done');
      const noShowCount = list.filter((a) => a.status === 'noshow').length;
      const cancelledCount = list.filter((a) => a.status === 'cancelled').length;
      const settled = doneList.length + noShowCount;
      const noShowRate = settled > 0 ? Math.round((noShowCount / settled) * 100) : 0;
      const revenue = doneList.reduce((sum, a) => {
        const srv = state.services.find((s) => s.id === a.serviceId);
        return sum + (srv?.price ?? 0);
      }, 0);
      return {
        id: res.id,
        name: res.name,
        typeLabel: res.type === 'staff' ? 'پزشک / کارشناس' : 'اتاق / تجهیز',
        total: list.length,
        done: doneList.length,
        noShowCount,
        cancelledCount,
        noShowRate,
        revenue,
      };
    });
  }, [state.resources, branchAppointments, state.services]);

  // 3. Cohort / Retention / LTV / Churn Analysis (FR-RPT-05/08)
  const cohortBI = useMemo(() => {
    const total = branchCustomers.length;
    const churnedCount = branchCustomers.filter((c) => c.lifecycle === 'churned').length;
    const churnRate = total > 0 ? Math.round((churnedCount / total) * 100) : 0;
    const retentionRate = Math.max(0, 100 - churnRate);

    const revenueByCustomer = new Map<string, number>();
    const activityCountByCustomer = new Map<string, number>();

    for (const o of branchOrders) {
      if (o.status === 'cancelled') continue;
      const val = o.items.reduce((s, it) => s + it.qty * it.price, 0) - (o.discountAmount ?? 0);
      revenueByCustomer.set(o.customerId, (revenueByCustomer.get(o.customerId) ?? 0) + val);
      activityCountByCustomer.set(o.customerId, (activityCountByCustomer.get(o.customerId) ?? 0) + 1);
    }
    for (const a of branchAppointments) {
      if (a.status !== 'done') continue;
      const srv = state.services.find((s) => s.id === a.serviceId);
      revenueByCustomer.set(a.customerId, (revenueByCustomer.get(a.customerId) ?? 0) + (srv?.price ?? 0));
      activityCountByCustomer.set(a.customerId, (activityCountByCustomer.get(a.customerId) ?? 0) + 1);
    }

    const totalLtvSum = branchCustomers.reduce((s, c) => s + (revenueByCustomer.get(c.id) ?? 0), 0);
    const avgLtv = total > 0 ? Math.round(totalLtvSum / total) : 0;
    const repeatCustomers = branchCustomers.filter(
      (c) => (activityCountByCustomer.get(c.id) ?? 0) >= 2 || c.lifecycle === 'vip',
    ).length;
    const repeatRate = total > 0 ? Math.round((repeatCustomers / total) * 100) : 0;

    // Build Cohort Matrix grouped by Jalali Year/Month
    const cohortMap = new Map<
      string,
      { month: string; size: number; m1: number; m2: number; m3: number; ltvSum: number }
    >();
    branchCustomers.forEach((c) => {
      const jMonth = formatJalali(c.createdAt, 'YYYY/MM');
      const cur = cohortMap.get(jMonth) ?? { month: jMonth, size: 0, m1: 0, m2: 0, m3: 0, ltvSum: 0 };
      cur.size += 1;
      const act = activityCountByCustomer.get(c.id) ?? 0;
      const isRetained = c.lifecycle !== 'churned';
      if (isRetained && (act >= 1 || c.lifecycle === 'active' || c.lifecycle === 'vip')) cur.m1 += 1;
      if (isRetained && (act >= 2 || c.lifecycle === 'vip')) cur.m2 += 1;
      if (isRetained && c.lifecycle === 'vip') cur.m3 += 1;
      cur.ltvSum += revenueByCustomer.get(c.id) ?? 0;
      cohortMap.set(jMonth, cur);
    });

    const cohortRows = Array.from(cohortMap.values())
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((row) => ({
        month: row.month,
        size: row.size,
        p0: 100,
        p1: row.size > 0 ? Math.round((row.m1 / row.size) * 100) : 0,
        p2: row.size > 0 ? Math.round((row.m2 / row.size) * 100) : 0,
        p3: row.size > 0 ? Math.round((row.m3 / row.size) * 100) : 0,
        avgLtv: row.size > 0 ? Math.round(row.ltvSum / row.size) : 0,
      }));

    // Channel LTV breakdown
    const sourceMap = new Map<string, { source: string; count: number; totalLtv: number; churned: number }>();
    branchCustomers.forEach((c) => {
      const src = c.source || 'سایر / مستقیم';
      const cur = sourceMap.get(src) ?? { source: src, count: 0, totalLtv: 0, churned: 0 };
      cur.count += 1;
      cur.totalLtv += revenueByCustomer.get(c.id) ?? 0;
      if (c.lifecycle === 'churned') cur.churned += 1;
      sourceMap.set(src, cur);
    });
    const sourceStats = Array.from(sourceMap.values()).sort((a, b) => b.totalLtv - a.totalLtv);

    // Rep performance breakdown
    const repMap = new Map<string, { owner: string; won: number; total: number; revenue: number }>();
    state.opportunities.forEach((opp) => {
      const cur = repMap.get(opp.ownerName) ?? { owner: opp.ownerName, won: 0, total: 0, revenue: 0 };
      cur.total += 1;
      if (opp.stage === 'won') {
        cur.won += 1;
        cur.revenue += opp.amount;
      }
      repMap.set(opp.ownerName, cur);
    });
    const repStats = Array.from(repMap.values()).sort((a, b) => b.revenue - a.revenue);

    return {
      retentionRate,
      churnRate,
      avgLtv,
      repeatRate,
      cohortRows,
      sourceStats,
      repStats,
    };
  }, [branchCustomers, branchOrders, branchAppointments, state.services, state.opportunities]);

  // 4. No-Code Report Builder
  const statusOptions = useMemo(() => {
    switch (dataset) {
      case 'customers':
        return [
          ['all', 'همه'],
          ['vip', 'VIP'],
          ['active', 'فعال'],
          ['lead', 'سرنخ'],
          ['churned', 'ریزش‌کرده'],
        ];
      case 'appointments':
        return [
          ['all', 'همه'],
          ['booked', 'رزرو شده'],
          ['confirmed', 'تأیید شده'],
          ['checked_in', 'پذیرش در محل'],
          ['done', 'انجام شده'],
          ['noshow', 'عدم حضور'],
          ['cancelled', 'لغو شده'],
        ];
      case 'orders':
        return [
          ['all', 'همه'],
          ['new', 'جدید'],
          ['confirmed', 'تأییدشده'],
          ['shipped', 'ارسال‌شده'],
          ['delivered', 'تحویل‌شده'],
          ['cancelled', 'لغوشده'],
        ];
      case 'invoices':
        return [
          ['all', 'همه'],
          ['issued', 'صادرشده'],
          ['partial', 'پرداخت جزئی'],
          ['paid', 'تسویه‌شده'],
        ];
      case 'opportunities':
        return [
          ['all', 'همه'],
          ['lead', 'سرنخ'],
          ['contacted', 'تماس اولیه'],
          ['proposal', 'ارسال پیشنهاد'],
          ['negotiation', 'مذاکره'],
          ['won', 'موفق'],
          ['lost', 'ناموفق'],
        ];
      case 'tickets':
        return [
          ['all', 'همه'],
          ['open', 'باز'],
          ['pending', 'در انتظار'],
          ['resolved', 'حل‌شده'],
        ];
    }
  }, [dataset]);

  const builtReport = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const custName = (id?: string) => state.customers.find((c) => c.id === id)?.name ?? '—';

    if (dataset === 'customers') {
      const headers = ['نام', 'موبایل', 'چرخه عمر', 'منبع', 'برچسب‌ها', 'تاریخ ثبت'];
      const rows = branchCustomers
        .filter((c) => statusFilter === 'all' || (c.lifecycle ?? 'active') === statusFilter)
        .filter(
          (c) =>
            !q ||
            c.name.toLowerCase().includes(q) ||
            c.phone.includes(q) ||
            (c.source ?? '').toLowerCase().includes(q),
        )
        .map((c) => [
          c.name,
          c.phone,
          c.lifecycle ?? 'active',
          c.source ?? '—',
          c.tags.join('، ') || '—',
          formatJalali(c.createdAt),
        ]);
      return { headers, rows };
    }

    if (dataset === 'appointments') {
      const headers = ['مشتری', 'خدمت', 'منبع', 'زمان شروع', 'وضعیت'];
      const rows = branchAppointments
        .filter((a) => statusFilter === 'all' || a.status === statusFilter)
        .filter((a) => {
          const name = custName(a.customerId).toLowerCase();
          return !q || name.includes(q);
        })
        .map((a) => [
          custName(a.customerId),
          state.services.find((s) => s.id === a.serviceId)?.name ?? '—',
          state.resources.find((r) => r.id === a.resourceId)?.name ?? '—',
          formatJalaliDateTime(a.start),
          a.status,
        ]);
      return { headers, rows };
    }

    if (dataset === 'orders') {
      const headers = ['شناسه سفارش', 'مشتری', 'تعداد اقلام', 'مبلغ نهایی (تومان)', 'وضعیت', 'تاریخ ثبت'];
      const rows = branchOrders
        .filter((o) => statusFilter === 'all' || o.status === statusFilter)
        .filter(
          (o) =>
            !q ||
            o.id.toLowerCase().includes(q) ||
            custName(o.customerId).toLowerCase().includes(q),
        )
        .map((o) => {
          const total =
            o.items.reduce((s, it) => s + it.qty * it.price, 0) - (o.discountAmount ?? 0);
          return [
            o.id,
            custName(o.customerId),
            o.items.reduce((s, it) => s + it.qty, 0),
            total,
            o.status,
            formatJalaliDateTime(o.createdAt),
          ];
        });
      return { headers, rows };
    }

    if (dataset === 'invoices') {
      const headers = ['شماره فاکتور', 'مشتری', 'مبلغ کل', 'پرداخت‌شده', 'مانده', 'وضعیت'];
      const rows = branchInvoices
        .filter((inv) => statusFilter === 'all' || inv.status === statusFilter)
        .filter(
          (inv) =>
            !q ||
            inv.invoiceNo.toLowerCase().includes(q) ||
            custName(inv.customerId).toLowerCase().includes(q),
        )
        .map((inv) => [
          inv.invoiceNo,
          custName(inv.customerId),
          inv.grandTotal,
          inv.paidAmount,
          Math.max(0, inv.grandTotal - inv.paidAmount),
          inv.status,
        ]);
      return { headers, rows };
    }

    if (dataset === 'opportunities') {
      const headers = ['عنوان فرصت', 'مخاطب', 'مسئول', 'مرحله', 'مبلغ (تومان)', 'احتمال (٪)'];
      const rows = state.opportunities
        .filter((o) => statusFilter === 'all' || o.stage === statusFilter)
        .filter(
          (o) =>
            !q ||
            o.title.toLowerCase().includes(q) ||
            o.contactName.toLowerCase().includes(q),
        )
        .map((o) => [o.title, o.contactName, o.ownerName, o.stage, o.amount, o.probability]);
      return { headers, rows };
    }

    const headers = ['شناسه', 'مشتری', 'موضوع', 'اولویت', 'وضعیت', 'تاریخ ثبت'];
    const rows = state.tickets
      .filter((tItem) => statusFilter === 'all' || tItem.status === statusFilter)
      .filter(
        (tItem) =>
          !q ||
          tItem.subject.toLowerCase().includes(q) ||
          custName(tItem.customerId).toLowerCase().includes(q),
      )
      .map((tItem) => [
        tItem.id,
        custName(tItem.customerId),
        tItem.subject,
        tItem.priority,
        tItem.status,
        formatJalaliDateTime(tItem.createdAt),
      ]);
    return { headers, rows };
  }, [
    dataset,
    statusFilter,
    searchQuery,
    state.customers,
    state.services,
    state.resources,
    state.opportunities,
    state.tickets,
    branchCustomers,
    branchAppointments,
    branchOrders,
    branchInvoices,
  ]);

  const handleDownloadCsv = () => {
    const csv = exportRowsToCsv(builtReport.headers, builtReport.rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clientflow-report-${dataset}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const tabTitles = {
    aging: 'تراز سنی مطالبات (Receivable Aging)',
    resources: 'عملکرد منابع و پزشکان',
    cohort: 'تحلیل Cohort، ماندگاری، LTV و ریزش',
    builder: 'گزارش‌ساز بدون کد (CSV / PDF)',
    scheduled: 'زمان‌بندی ارسال گزارش',
  };

  return (
    <div className="space-y-6">
      {/* Print-Only Formal Header (for Direct PDF Export FR-RPT-03) */}
      <div className="hidden border-b border-slate-300 pb-3 print:block">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-base font-bold">{state.settings.businessName} — گزارش تحلیلی ClientFlow</div>
            <div className="mt-0.5 text-xs text-slate-600">{tabTitles[tab]}</div>
          </div>
          <div className="text-xs tabular-nums text-slate-500">
            تاریخ تهیه: {formatJalaliDateTime(new Date().toISOString())}
          </div>
        </div>
      </div>

      {/* Top Navigation & Direct PDF Export */}
      <div className="flex flex-wrap items-center justify-between gap-3 print-hidden">
        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-900">
          {(
            [
              ['aging', 'تراز سنی مطالبات'],
              ['resources', 'عملکرد منابع و پزشکان'],
              ['cohort', 'تحلیل Cohort / LTV / Churn'],
              ['builder', 'گزارش‌ساز بدون کد (CSV)'],
              ['scheduled', `زمان‌بندی گزارش (${toFa(state.scheduledReports.length)})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                tab === key
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <Printer size={15} />
          خروجی PDF / چاپ مستقیم گزارش
        </button>
      </div>

      {/* TAB 1: AGING */}
      {tab === 'aging' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="text-xs text-slate-500">جمع کل مطالبات باز</div>
              <div className="mt-1.5 text-xl font-bold tabular-nums text-rose-600 dark:text-rose-400">
                {formatToman(agingData.grandReceivables)}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="text-xs text-slate-500">جاری و ۰ تا ۳۰ روز</div>
              <div className="mt-1.5 text-xl font-bold tabular-nums">
                {formatToman(agingData.total0_30)}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="text-xs text-slate-500">معوق ۳۱ تا ۶۰ روز</div>
              <div className="mt-1.5 text-xl font-bold tabular-nums text-amber-600 dark:text-amber-400">
                {formatToman(agingData.total31_60)}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="text-xs text-slate-500">معوق بالای ۶۰ روز</div>
              <div className="mt-1.5 text-xl font-bold tabular-nums text-rose-600 dark:text-rose-400">
                {formatToman(agingData.totalOver60)}
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            {agingData.rows.length === 0 ? (
              <p className="p-8 text-center text-xs text-slate-500">
                هیچ فاکتور تسویه‌نشده‌ای در سیستم وجود ندارد.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50/70 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-3 font-medium">مشتری</th>
                      <th className="px-4 py-3 font-medium">تعداد فاکتور باز</th>
                      <th className="px-4 py-3 font-medium">۰ تا ۳۰ روز</th>
                      <th className="px-4 py-3 font-medium">۳۱ تا ۶۰ روز</th>
                      <th className="px-4 py-3 font-medium">بالای ۶۰ روز</th>
                      <th className="px-4 py-3 font-medium text-left">جمع بدهی</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {agingData.rows.map((r) => (
                      <tr key={r.customerId} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                        <td className="px-4 py-2.5">
                          <div className="font-medium">{r.customerName}</div>
                          <div className="text-xs tabular-nums text-slate-400">{toFa(r.phone)}</div>
                        </td>
                        <td className="px-4 py-2.5 text-xs tabular-nums">{toFa(r.invoiceCount)}</td>
                        <td className="px-4 py-2.5 text-xs tabular-nums">{formatToman(r.bucket0_30)}</td>
                        <td className="px-4 py-2.5 text-xs tabular-nums text-amber-600 dark:text-amber-400">
                          {formatToman(r.bucket31_60)}
                        </td>
                        <td className="px-4 py-2.5 text-xs tabular-nums text-rose-600 dark:text-rose-400">
                          {formatToman(r.bucketOver60)}
                        </td>
                        <td className="px-4 py-2.5 text-left text-xs font-bold tabular-nums">
                          {formatToman(r.totalOpen)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: RESOURCES */}
      {tab === 'resources' && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/70 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">نام منبع</th>
                  <th className="px-4 py-3 font-medium">نوع</th>
                  <th className="px-4 py-3 font-medium">کل نوبت‌ها</th>
                  <th className="px-4 py-3 font-medium">انجام‌شده</th>
                  <th className="px-4 py-3 font-medium">عدم حضور</th>
                  <th className="px-4 py-3 font-medium">نرخ غیبت</th>
                  <th className="px-4 py-3 font-medium text-left">درآمد برآوردی خدمات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {resourceStats.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-2.5 font-medium">{r.name}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">{r.typeLabel}</td>
                    <td className="px-4 py-2.5 text-xs tabular-nums">{toFa(r.total)}</td>
                    <td className="px-4 py-2.5 text-xs tabular-nums text-emerald-600 dark:text-emerald-400">
                      {toFa(r.done)}
                    </td>
                    <td className="px-4 py-2.5 text-xs tabular-nums text-amber-600 dark:text-amber-400">
                      {toFa(r.noShowCount)}
                    </td>
                    <td className="px-4 py-2.5 text-xs tabular-nums">{toFa(r.noShowRate)}٪</td>
                    <td className="px-4 py-2.5 text-left text-xs font-semibold tabular-nums">
                      {formatToman(r.revenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: COHORT / RETENTION / LTV / CHURN (FR-RPT-05/08) */}
      {tab === 'cohort' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="text-xs text-slate-500">نرخ ماندگاری مشتریان (Retention)</div>
              <div className="mt-1.5 text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                {toFa(cohortBI.retentionRate)}٪
              </div>
              <div className="mt-1 text-[11px] text-slate-400">مشتریان فعال و VIP نسبت به کل</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="text-xs text-slate-500">نرخ ریزش (Churn Rate)</div>
              <div className="mt-1.5 text-2xl font-bold tabular-nums text-rose-600 dark:text-rose-400">
                {toFa(cohortBI.churnRate)}٪
              </div>
              <div className="mt-1 text-[11px] text-slate-400">نیازمند کمپین بازگشت مشتری</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="text-xs text-slate-500">ارزش طول عمر مشتری (Avg LTV)</div>
              <div className="mt-1.5 text-2xl font-bold tabular-nums text-indigo-600 dark:text-indigo-400">
                {formatToman(cohortBI.avgLtv)}
              </div>
              <div className="mt-1 text-[11px] text-slate-400">میانگین درآمد تجمیعی هر مشتری</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="text-xs text-slate-500">نرخ تکرار خرید / مراجعه</div>
              <div className="mt-1.5 text-2xl font-bold tabular-nums">
                {toFa(cohortBI.repeatRate)}٪
              </div>
              <div className="mt-1 text-[11px] text-slate-400">دارای ۲+ تراکنش یا سطح VIP</div>
            </div>
          </div>

          {/* Cohort Retention Matrix */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-1 text-sm font-semibold">ماتریس حفظ هم‌گروه مشتریان (Jalali Cohort Retention)</h2>
            <p className="mb-4 text-xs text-slate-500">
              درصد ماندگاری و فعالیت مجدد مشتریان بر اساس ماه عضویت شمسی در دوره‌های بعدی
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="border-b border-slate-200 bg-slate-50/70 text-slate-500 dark:border-slate-800 dark:bg-slate-800/40">
                  <tr>
                    <th className="px-3 py-2.5 font-medium">هم‌گروه (ماه شمسی)</th>
                    <th className="px-3 py-2.5 font-medium">تعداد جذب</th>
                    <th className="px-3 py-2.5 font-medium text-center">ماه ۰</th>
                    <th className="px-3 py-2.5 font-medium text-center">ماه +۱</th>
                    <th className="px-3 py-2.5 font-medium text-center">ماه +۲</th>
                    <th className="px-3 py-2.5 font-medium text-center">ماه +۳ (وفادار)</th>
                    <th className="px-3 py-2.5 font-medium text-left">میانگین LTV هم‌گروه</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {cohortBI.cohortRows.map((row) => {
                    const cellCls = (pct: number) =>
                      pct >= 75
                        ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200'
                        : pct >= 40
                          ? 'bg-sky-100 text-sky-900 dark:bg-sky-950/60 dark:text-sky-200'
                          : pct > 0
                            ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200'
                            : 'bg-slate-50 text-slate-400 dark:bg-slate-800/40';
                    return (
                      <tr key={row.month}>
                        <td className="px-3 py-2.5 font-mono font-semibold tabular-nums">{toFa(row.month)}</td>
                        <td className="px-3 py-2.5 tabular-nums">{toFa(row.size)} نفر</td>
                        <td className="px-2 py-2 text-center font-semibold tabular-nums">
                          <span className="inline-block w-14 rounded py-1 bg-indigo-100 text-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-200">
                            {toFa(row.p0)}٪
                          </span>
                        </td>
                        <td className="px-2 py-2 text-center font-semibold tabular-nums">
                          <span className={`inline-block w-14 rounded py-1 ${cellCls(row.p1)}`}>
                            {toFa(row.p1)}٪
                          </span>
                        </td>
                        <td className="px-2 py-2 text-center font-semibold tabular-nums">
                          <span className={`inline-block w-14 rounded py-1 ${cellCls(row.p2)}`}>
                            {toFa(row.p2)}٪
                          </span>
                        </td>
                        <td className="px-2 py-2 text-center font-semibold tabular-nums">
                          <span className={`inline-block w-14 rounded py-1 ${cellCls(row.p3)}`}>
                            {toFa(row.p3)}٪
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-left font-bold tabular-nums">
                          {formatToman(row.avgLtv)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* LTV by Acquisition Channel */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="mb-3 text-sm font-semibold">ارزش طول عمر و ریزش بر اساس کانال جذب</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50/70 text-slate-500 dark:border-slate-800 dark:bg-slate-800/40">
                    <tr>
                      <th className="px-3 py-2 font-medium">منبع جذب</th>
                      <th className="px-3 py-2 font-medium">تعداد</th>
                      <th className="px-3 py-2 font-medium">ریزش</th>
                      <th className="px-3 py-2 font-medium text-left">مجموع LTV</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {cohortBI.sourceStats.map((s) => (
                      <tr key={s.source}>
                        <td className="px-3 py-2 font-medium">{s.source}</td>
                        <td className="px-3 py-2 tabular-nums">{toFa(s.count)}</td>
                        <td className="px-3 py-2 tabular-nums text-rose-600">{toFa(s.churned)}</td>
                        <td className="px-3 py-2 text-left font-semibold tabular-nums">
                          {formatToman(s.totalLtv)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Sales Rep Win Rate & Revenue */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="mb-3 text-sm font-semibold">عملکرد فروش کارشناسان (نرخ برد و درآمد)</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50/70 text-slate-500 dark:border-slate-800 dark:bg-slate-800/40">
                    <tr>
                      <th className="px-3 py-2 font-medium">کارشناس فروش</th>
                      <th className="px-3 py-2 font-medium">فرصت‌ها</th>
                      <th className="px-3 py-2 font-medium">موفق (Won)</th>
                      <th className="px-3 py-2 font-medium text-left">فروش قطعی</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {cohortBI.repStats.map((r) => (
                      <tr key={r.owner}>
                        <td className="px-3 py-2 font-medium">{r.owner}</td>
                        <td className="px-3 py-2 tabular-nums">{toFa(r.total)}</td>
                        <td className="px-3 py-2 tabular-nums text-emerald-600">
                          {toFa(r.won)} ({r.total > 0 ? toFa(Math.round((r.won / r.total) * 100)) : '۰'}٪)
                        </td>
                        <td className="px-3 py-2 text-left font-semibold tabular-nums">
                          {formatToman(r.revenue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: NO-CODE REPORT BUILDER */}
      {tab === 'builder' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 print-hidden dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <label className="mb-1 block text-[11px] text-slate-500">مجموعه داده</label>
                <select
                  value={dataset}
                  onChange={(e) => {
                    setDataset(e.target.value as DatasetKey);
                    setStatusFilter('all');
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium dark:border-slate-700 dark:bg-slate-800"
                >
                  {(Object.keys(DATASET_LABELS) as DatasetKey[]).map((k) => (
                    <option key={k} value={k}>
                      {DATASET_LABELS[k]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-[11px] text-slate-500">فیلتر وضعیت</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium dark:border-slate-700 dark:bg-slate-800"
                >
                  {statusOptions.map(([val, label]) => (
                    <option key={val} value={val}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-[11px] text-slate-500">جستجو در ردیف‌ها</label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="نام، شماره یا عنوان..."
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Printer size={15} />
                خروجی PDF
              </button>
              <button
                type="button"
                onClick={handleDownloadCsv}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700"
              >
                <Download size={15} />
                خروجی CSV ({toFa(builtReport.rows.length)} ردیف)
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="border-b border-slate-200 bg-slate-50/70 text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
                  <tr>
                    {builtReport.headers.map((h) => (
                      <th key={h} className="px-4 py-3 font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {builtReport.rows.slice(0, 30).map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className="px-4 py-2.5 tabular-nums text-slate-700 dark:text-slate-300">
                          {typeof cell === 'number' ? toFa(cell.toLocaleString('en-US')) : toFa(String(cell))}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {builtReport.rows.length > 30 && (
              <div className="border-t border-slate-200 px-4 py-2 text-xs text-slate-500 dark:border-slate-800">
                نمایش ۳۰ ردیف اول در پیش‌نمایش؛ فایل CSV شامل تمام {toFa(builtReport.rows.length)} ردیف است.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: SCHEDULED REPORT DELIVERY (FR-RPT-04) */}
      {tab === 'scheduled' && (
        <div className="space-y-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!schedTitle.trim() || !schedRecipients.trim()) return;
              addScheduledReport({
                title: schedTitle.trim(),
                dataset: schedDataset,
                frequency: schedFreq,
                format: schedFormat,
                recipients: schedRecipients.trim(),
                active: true,
              });
              setSchedTitle('');
            }}
            className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 print-hidden dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center gap-2 text-sm font-semibold">
              <CalendarClock size={16} className="text-indigo-500" />
              تعریف زمان‌بندی ارسال خودکار گزارش (FR-RPT-04)
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
              <input
                type="text"
                required
                value={schedTitle}
                onChange={(e) => setSchedTitle(e.target.value)}
                placeholder="عنوان گزارش زمان‌بندی‌شده..."
                className="sm:col-span-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
              <select
                value={schedDataset}
                onChange={(e) => setSchedDataset(e.target.value as ScheduledReport['dataset'])}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              >
                {(Object.keys(SCHED_DATASET_LABELS) as ScheduledReport['dataset'][]).map((k) => (
                  <option key={k} value={k}>
                    {SCHED_DATASET_LABELS[k]}
                  </option>
                ))}
              </select>
              <select
                value={schedFreq}
                onChange={(e) => setSchedFreq(e.target.value as ScheduledReport['frequency'])}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="daily">روزانه (Daily)</option>
                <option value="weekly">هفتگی (Weekly)</option>
                <option value="monthly">ماهانه (Monthly)</option>
              </select>
              <select
                value={schedFormat}
                onChange={(e) => setSchedFormat(e.target.value as ScheduledReport['format'])}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs uppercase dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="pdf">PDF</option>
                <option value="csv">CSV</option>
              </select>
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                dir="ltr"
                required
                value={schedRecipients}
                onChange={(e) => setSchedRecipients(e.target.value)}
                placeholder="finance@company.ir, ceo@company.ir"
                className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700"
              >
                <Plus size={14} />
                ثبت زمان‌بندی ارسال
              </button>
            </div>
          </form>

          <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
            {state.scheduledReports.map((rep) => (
              <div key={rep.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-xs">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{rep.title}</span>
                    <span className="rounded bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                      {SCHED_DATASET_LABELS[rep.dataset]}
                    </span>
                    <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] uppercase dark:bg-slate-800">
                      {rep.frequency === 'daily' ? 'روزانه' : rep.frequency === 'weekly' ? 'هفتگی' : 'ماهانه'} ·{' '}
                      {rep.format}
                    </span>
                  </div>
                  <div className="mt-1 text-slate-500">
                    گیرندگان: <span className="font-mono">{rep.recipients}</span>
                    <span className="mx-2">·</span>
                    اجرای بعدی: <span className="tabular-nums">{formatJalaliDateTime(rep.nextRunAt)}</span>
                    {rep.lastSentAt && (
                      <>
                        <span className="mx-2">·</span>
                        آخرین ارسال: <span className="tabular-nums">{formatJalaliDateTime(rep.lastSentAt)}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 print-hidden">
                  <button
                    type="button"
                    onClick={() => runScheduledReportNow(rep.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 font-medium text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                  >
                    <Mail size={13} />
                    ارسال فوری آزمایشی
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleScheduledReport(rep.id)}
                    className={`rounded-lg border px-2.5 py-1.5 font-medium ${
                      rep.active
                        ? 'border-indigo-200 text-indigo-700 dark:border-indigo-900 dark:text-indigo-300'
                        : 'border-slate-200 text-slate-400 dark:border-slate-700'
                    }`}
                  >
                    {rep.active ? 'فعال' : 'متوقف'}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteScheduledReport(rep.id)}
                    className="rounded p-1.5 text-slate-400 hover:text-rose-600"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
