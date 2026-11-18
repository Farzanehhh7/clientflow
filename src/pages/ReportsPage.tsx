import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { useClientFlow } from '../store/useClientFlowStore';
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

export function ReportsPage() {
  const { state } = useClientFlow();
  const [tab, setTab] = useState<'aging' | 'resources' | 'builder'>('aging');
  const [dataset, setDataset] = useState<DatasetKey>('orders');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const nowMs = Date.now();

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

    for (const inv of state.invoices) {
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
  }, [state.invoices, state.customers, nowMs]);

  // 2. Resource / Doctor Performance
  const resourceStats = useMemo(() => {
    return state.resources.map((res) => {
      const list = state.appointments.filter((a) => a.resourceId === res.id);
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
  }, [state.resources, state.appointments, state.services]);

  // 3. No-Code Report Builder
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
      const rows = state.customers
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
      const rows = state.appointments
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
      const rows = state.orders
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
      const rows = state.invoices
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
      .filter((t) => statusFilter === 'all' || t.status === statusFilter)
      .filter(
        (t) =>
          !q ||
          t.subject.toLowerCase().includes(q) ||
          custName(t.customerId).toLowerCase().includes(q),
      )
      .map((t) => [
        t.id,
        custName(t.customerId),
        t.subject,
        t.priority,
        t.status,
        formatJalaliDateTime(t.createdAt),
      ]);
    return { headers, rows };
  }, [dataset, statusFilter, searchQuery, state]);

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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1 w-fit dark:bg-slate-900">
        {(
          [
            ['aging', 'تراز سنی مطالبات (Receivable Aging)'],
            ['resources', 'عملکرد منابع و پزشکان'],
            ['builder', 'گزارش‌ساز بدون کد و خروجی CSV'],
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

      {tab === 'builder' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
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

            <button
              type="button"
              onClick={handleDownloadCsv}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700"
            >
              <Download size={15} />
              خروجی CSV ({toFa(builtReport.rows.length)} ردیف)
            </button>
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
    </div>
  );
}
