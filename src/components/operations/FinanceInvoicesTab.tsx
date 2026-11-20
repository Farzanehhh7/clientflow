import { useMemo, useState } from 'react';
import {
  Banknote,
  Bell,
  CheckCircle2,
  CreditCard,
  Landmark,
  Layers,
  Plus,
  Printer,
} from 'lucide-react';
import { InvoicePreviewModal } from '../InvoicePreviewModal';
import { PaymentGatewayModal } from '../PaymentGatewayModal';
import { useClientFlow } from '../../store/useClientFlowStore';
import type { Invoice, SayadiChequeStatus } from '../../types';
import { formatJalali, formatJalaliDateTime, formatToman, toFa } from '../../utils/jalali';
import {
  PaymentAllocationModal,
  SayadiChequeModal,
  SinglePaymentModal,
} from './FinanceModals';
import { PAYMENT_METHOD_LABEL } from './orderHelpers';

type AgingBucketKey = 'all' | '0_30' | '31_60' | '61_90' | '90_plus';

type FinanceInvoicesTabProps = {
  branchInvoices: Invoice[];
};

const BUCKET_META: { key: Exclude<AgingBucketKey, 'all'>; label: string; color: string }[] = [
  { key: '0_30', label: '۰ تا ۳۰ روز', color: 'text-slate-800 dark:text-slate-100' },
  { key: '31_60', label: '۳۱ تا ۶۰ روز', color: 'text-amber-600 dark:text-amber-400' },
  { key: '61_90', label: '۶۱ تا ۹۰ روز', color: 'text-orange-600 dark:text-orange-400' },
  { key: '90_plus', label: 'بیش از ۹۰ روز', color: 'text-rose-600 dark:text-rose-400' },
];

export function FinanceInvoicesTab({ branchInvoices }: FinanceInvoicesTabProps) {
  const { state, updateSayadiChequeStatus, sendOverdueInvoiceReminder } = useClientFlow();

  const [agingFilter, setAgingFilter] = useState<AgingBucketKey>('all');
  const [payInvoice, setPayInvoice] = useState<Invoice | null>(null);
  const [gatewayInvoice, setGatewayInvoice] = useState<Invoice | null>(null);
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);
  const [chequeModalOpen, setChequeModalOpen] = useState(false);
  const [allocModalOpen, setAllocModalOpen] = useState(false);

  const nowMs = Date.now();

  const getDaysPastDue = (inv: Invoice) =>
    Math.floor((nowMs - new Date(inv.dueAt).getTime()) / (24 * 3600_000));

  const getAgingBucket = (inv: Invoice): Exclude<AgingBucketKey, 'all'> | null => {
    const balance = Math.max(0, inv.grandTotal - inv.paidAmount);
    if (balance <= 0) return null;
    const days = Math.max(0, getDaysPastDue(inv));
    if (days <= 30) return '0_30';
    if (days <= 60) return '31_60';
    if (days <= 90) return '61_90';
    return '90_plus';
  };

  const financeSummary = useMemo(() => {
    const totalBilled = branchInvoices.reduce((s, inv) => s + inv.grandTotal, 0);
    const totalPaid = branchInvoices.reduce((s, inv) => s + inv.paidAmount, 0);
    const receivables = totalBilled - totalPaid;
    const pendingCheques = state.sayadiCheques
      .filter((c) => c.status === 'received' || c.status === 'deposited')
      .reduce((s, c) => s + c.amount, 0);
    return { totalBilled, totalPaid, receivables, pendingCheques };
  }, [branchInvoices, state.sayadiCheques]);

  const agingTotals = useMemo(() => {
    const map: Record<Exclude<AgingBucketKey, 'all'>, { count: number; amount: number }> = {
      '0_30': { count: 0, amount: 0 },
      '31_60': { count: 0, amount: 0 },
      '61_90': { count: 0, amount: 0 },
      '90_plus': { count: 0, amount: 0 },
    };
    for (const inv of branchInvoices) {
      const bucket = getAgingBucket(inv);
      if (!bucket) continue;
      map[bucket].count += 1;
      map[bucket].amount += Math.max(0, inv.grandTotal - inv.paidAmount);
    }
    return map;
  }, [branchInvoices, nowMs]);

  const visibleInvoices = useMemo(() => {
    if (agingFilter === 'all') return branchInvoices;
    return branchInvoices.filter((inv) => getAgingBucket(inv) === agingFilter);
  }, [branchInvoices, agingFilter, nowMs]);

  return (
    <div className="space-y-6">
      {/* Top KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs text-slate-500">جمع کل فاکتورهای صادره</div>
          <div className="mt-1.5 text-xl font-bold tabular-nums">{formatToman(financeSummary.totalBilled)}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs text-slate-500">مجموع وصول‌شده</div>
          <div className="mt-1.5 text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
            {formatToman(financeSummary.totalPaid)}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs text-slate-500">مطالبات باز (مانده بدهی)</div>
          <div className="mt-1.5 text-xl font-bold tabular-nums text-rose-600 dark:text-rose-400">
            {formatToman(financeSummary.receivables)}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs text-slate-500">چک‌های صیادی در جریان وصول</div>
          <div className="mt-1.5 text-xl font-bold tabular-nums text-indigo-600 dark:text-indigo-400">
            {formatToman(financeSummary.pendingCheques)}
          </div>
        </div>
      </div>

      {/* Aging Report (0-30 / 31-60 / 61-90 / 90+ days) */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">گزارش سنی مطالبات (Aging Report)</h2>
            <p className="text-xs text-slate-500">
              برای فیلتر کردن فاکتورهای باز بر اساس دوره سررسید، روی هر بازه کلیک کنید.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {agingFilter !== 'all' && (
              <button
                type="button"
                onClick={() => setAgingFilter('all')}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
              >
                نمایش همه فاکتورها
              </button>
            )}
            <button
              type="button"
              onClick={() => setAllocModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
            >
              <Layers size={14} />
              تخصیص پرداخت تجمیعی
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {BUCKET_META.map((b) => {
            const stat = agingTotals[b.key];
            const active = agingFilter === b.key;
            return (
              <button
                key={b.key}
                type="button"
                onClick={() => setAgingFilter(active ? 'all' : b.key)}
                className={`rounded-xl border p-3 text-right transition-colors ${
                  active
                    ? 'border-indigo-500 bg-indigo-50/50 dark:border-indigo-400 dark:bg-indigo-950/30'
                    : 'border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>{b.label}</span>
                  <span className="tabular-nums">{toFa(stat.count)} فاکتور</span>
                </div>
                <div className={`mt-1 text-base font-bold tabular-nums ${b.color}`}>
                  {formatToman(stat.amount)}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Invoices Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="border-b border-slate-200 bg-slate-50/70 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">شماره فاکتور / مرجع</th>
                <th className="px-4 py-3 font-medium">مشتری</th>
                <th className="px-4 py-3 font-medium">سررسید</th>
                <th className="px-4 py-3 font-medium">مبلغ کل</th>
                <th className="px-4 py-3 font-medium">پرداخت‌شده / مانده</th>
                <th className="px-4 py-3 font-medium">وضعیت</th>
                <th className="px-4 py-3 text-left font-medium">اقدام</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {visibleInvoices.map((inv) => {
                const cust = state.customers.find((c) => c.id === inv.customerId);
                const balance = Math.max(0, inv.grandTotal - inv.paidAmount);
                const daysOverdue = balance > 0 ? getDaysPastDue(inv) : 0;
                return (
                  <tr key={inv.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-2.5 text-xs">
                      <div className="font-mono font-semibold tabular-nums">{inv.invoiceNo}</div>
                      <div className="text-[11px] text-slate-400">{inv.orderId}</div>
                    </td>
                    <td className="px-4 py-2.5 font-medium">{cust?.name ?? 'مشتری'}</td>
                    <td className="px-4 py-2.5 text-xs tabular-nums">
                      <div>{formatJalali(inv.dueAt)}</div>
                      {daysOverdue > 0 && (
                        <div className="text-[11px] font-medium text-rose-600 dark:text-rose-400">
                          {toFa(daysOverdue)} روز معوق
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs tabular-nums">{formatToman(inv.grandTotal)}</td>
                    <td className="px-4 py-2.5 text-xs tabular-nums">
                      <div className="text-emerald-600 dark:text-emerald-400">
                        {formatToman(inv.paidAmount)}
                      </div>
                      {balance > 0 && (
                        <div className="text-rose-600 dark:text-rose-400">
                          مانده: {formatToman(balance)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs font-medium">
                      <div>
                        {inv.status === 'paid'
                          ? 'تسویه‌شده'
                          : inv.status === 'partial'
                            ? 'پرداخت جزئی'
                            : 'صادرشده'}
                        <span className="mr-1.5 text-slate-400">· {PAYMENT_METHOD_LABEL[inv.method]}</span>
                      </div>
                      {(inv.reminderCount ?? 0) > 0 && (
                        <div className="text-[11px] text-amber-600 dark:text-amber-400 tabular-nums">
                          {toFa(inv.reminderCount ?? 0)} بار یادآور ارسال شده
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-left">
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setPreviewInvoice(inv)}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          <Printer size={13} />
                          چاپ
                        </button>
                        {balance > 0 && daysOverdue > 0 && (
                          <button
                            type="button"
                            onClick={() => sendOverdueInvoiceReminder(inv.id)}
                            className="inline-flex items-center gap-1 rounded-md border border-amber-200 px-2.5 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50 dark:border-amber-900 dark:text-amber-300"
                          >
                            <Bell size={13} />
                            یادآور (Outbox)
                          </button>
                        )}
                        {balance > 0 && (
                          <>
                            <button
                              type="button"
                              onClick={() => setGatewayInvoice(inv)}
                              className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                            >
                              <CreditCard size={13} />
                              درگاه آنلاین
                            </button>
                            <button
                              type="button"
                              onClick={() => setPayInvoice(inv)}
                              className="rounded-md bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700"
                            >
                              ثبت پرداخت
                            </button>
                          </>
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

      {/* Payment Allocations History */}
      {state.paymentAllocations.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Layers size={16} className="text-indigo-500" />
            سوابق تخصیص پرداخت تجمیعی به فاکتورها
          </h2>
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {state.paymentAllocations.map((pa) => {
              const cust = state.customers.find((c) => c.id === pa.customerId);
              return (
                <div key={pa.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-xs">
                  <div>
                    <span className="font-semibold">{cust?.name ?? 'مشتری'}</span>
                    <span className="mx-2 text-slate-400">·</span>
                    <span className="tabular-nums font-medium text-emerald-600 dark:text-emerald-400">
                      {formatToman(pa.totalAmount)} ({PAYMENT_METHOD_LABEL[pa.method]})
                    </span>
                    <div className="mt-0.5 text-[11px] text-slate-500">
                      {pa.allocations.map((a) => `${a.invoiceNo}: ${formatToman(a.amount)}`).join(' | ')}
                    </div>
                  </div>
                  <div className="text-left text-[11px] tabular-nums text-slate-400">
                    {pa.reference && <div className="font-mono">کد پیگیری: {pa.reference}</div>}
                    <div>{formatJalaliDateTime(pa.createdAt)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sayadi Cheques Section */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Landmark size={16} className="text-indigo-500" />
              مدیریت چک‌های صیادی
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              ثبت شناسه ۱۶ رقمی صیادی، پیگیری سررسید شمسی، واگذاری به بانک و تسویه خودکار فاکتور هنگام وصول.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setChequeModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-indigo-700"
          >
            <Plus size={14} />
            ثبت چک صیادی جدید
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="border-b border-slate-200 bg-slate-50/70 text-slate-500 dark:border-slate-800 dark:bg-slate-800/40">
              <tr>
                <th className="px-3 py-2.5 font-medium">شماره چک / شناسه صیاد</th>
                <th className="px-3 py-2.5 font-medium">مشتری / صادرکننده</th>
                <th className="px-3 py-2.5 font-medium">بانک</th>
                <th className="px-3 py-2.5 font-medium">مبلغ</th>
                <th className="px-3 py-2.5 font-medium">سررسید شمسی</th>
                <th className="px-3 py-2.5 font-medium">فاکتور متصل</th>
                <th className="px-3 py-2.5 font-medium">وضعیت</th>
                <th className="px-3 py-2.5 text-left font-medium">تغییر وضعیت</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {state.sayadiCheques.map((chq) => {
                const cust = state.customers.find((c) => c.id === chq.customerId);
                const linkedInv = state.invoices.find((i) => i.id === chq.invoiceId);
                const statusBadge: Record<SayadiChequeStatus, { label: string; cls: string }> = {
                  received: {
                    label: 'دریافت‌شده',
                    cls: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
                  },
                  deposited: {
                    label: 'واگذارشده به بانک',
                    cls: 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300',
                  },
                  cleared: {
                    label: 'وصول‌شده',
                    cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
                  },
                  bounced: {
                    label: 'برگشتی',
                    cls: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
                  },
                };
                const badge = statusBadge[chq.status];
                return (
                  <tr key={chq.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                    <td className="px-3 py-2.5">
                      <div className="font-mono font-semibold tabular-nums">{toFa(chq.chequeNo)}</div>
                      <div className="font-mono text-[10px] text-slate-400" dir="ltr">
                        صیاد: {chq.sayadiId}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-slate-900 dark:text-slate-100">
                        {cust?.name ?? chq.drawerName}
                      </div>
                      <div className="text-[11px] text-slate-500">صادرکننده: {chq.drawerName}</div>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">{chq.bankName}</td>
                    <td className="px-3 py-2.5 font-semibold tabular-nums">{formatToman(chq.amount)}</td>
                    <td className="px-3 py-2.5 tabular-nums">{toFa(chq.dueDateJalali)}</td>
                    <td className="px-3 py-2.5 font-mono text-[11px] text-indigo-600 dark:text-indigo-400">
                      {linkedInv ? linkedInv.invoiceNo : '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-block rounded px-2 py-0.5 text-[11px] font-medium ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-left">
                      <div className="flex flex-wrap justify-end gap-1">
                        {chq.status === 'received' && (
                          <button
                            type="button"
                            onClick={() => updateSayadiChequeStatus(chq.id, 'deposited')}
                            className="rounded border border-sky-200 px-2 py-1 text-[11px] text-sky-700 hover:bg-sky-50 dark:border-sky-900 dark:text-sky-300"
                          >
                            واگذاری به بانک
                          </button>
                        )}
                        {(chq.status === 'received' || chq.status === 'deposited') && (
                          <>
                            <button
                              type="button"
                              onClick={() => updateSayadiChequeStatus(chq.id, 'cleared')}
                              className="inline-flex items-center gap-1 rounded bg-emerald-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-emerald-700"
                            >
                              <CheckCircle2 size={12} />
                              وصول شد
                            </button>
                            <button
                              type="button"
                              onClick={() => updateSayadiChequeStatus(chq.id, 'bounced')}
                              className="rounded border border-rose-200 px-2 py-1 text-[11px] text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-400"
                            >
                              برگشت خورد
                            </button>
                          </>
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

      {/* Sandbox Gateway Transactions Ledger */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Banknote size={16} className="text-emerald-500" />
          دفتر کل تراکنش‌های درگاه پرداخت آنلاین
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="border-b border-slate-200 bg-slate-50/70 text-slate-500 dark:border-slate-800 dark:bg-slate-800/40">
              <tr>
                <th className="px-3 py-2 font-medium">فاکتور</th>
                <th className="px-3 py-2 font-medium">درگاه</th>
                <th className="px-3 py-2 font-medium">مبلغ</th>
                <th className="px-3 py-2 font-medium">شماره کارت</th>
                <th className="px-3 py-2 font-medium">کد رهگیری / پیام</th>
                <th className="px-3 py-2 font-medium">وضعیت</th>
                <th className="px-3 py-2 font-medium">زمان</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {state.paymentTransactions.map((tx) => (
                <tr key={tx.id}>
                  <td className="px-3 py-2 font-mono">{tx.invoiceNo}</td>
                  <td className="px-3 py-2 uppercase">{tx.gateway}</td>
                  <td className="px-3 py-2 font-semibold tabular-nums">{formatToman(tx.amount)}</td>
                  <td className="px-3 py-2 font-mono text-slate-500" dir="ltr">
                    {tx.cardMasked ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                    {tx.refId ? (
                      <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400" dir="ltr">
                        {tx.refId}
                      </span>
                    ) : (
                      tx.errorMessage ?? '—'
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
                        tx.status === 'succeeded'
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                          : tx.status === 'failed'
                            ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {tx.status === 'succeeded' ? 'موفق' : tx.status === 'failed' ? 'ناموفق' : 'انصراف'}
                    </span>
                  </td>
                  <td className="px-3 py-2 tabular-nums text-slate-400">{formatJalaliDateTime(tx.at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <SinglePaymentModal invoice={payInvoice} onClose={() => setPayInvoice(null)} />
      <SayadiChequeModal open={chequeModalOpen} onClose={() => setChequeModalOpen(false)} />
      <PaymentAllocationModal open={allocModalOpen} onClose={() => setAllocModalOpen(false)} />
      <PaymentGatewayModal invoice={gatewayInvoice} onClose={() => setGatewayInvoice(null)} />
      <InvoicePreviewModal invoice={previewInvoice} onClose={() => setPreviewInvoice(null)} />
    </div>
  );
}
