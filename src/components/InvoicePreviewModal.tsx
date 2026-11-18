import { Printer } from 'lucide-react';
import { useClientFlow } from '../store/useClientFlowStore';
import type { Invoice, PaymentMethod } from '../types';
import { formatJalali, formatToman, toFa } from '../utils/jalali';
import { Modal } from './Modal';

interface InvoicePreviewModalProps {
  invoice: Invoice | null;
  onClose: () => void;
}

const METHOD_LABEL: Record<PaymentMethod, string> = {
  online: 'درگاه آنلاین',
  card: 'کارت‌خوان',
  transfer: 'کارت‌به‌کارت / شبا',
  cash: 'نقدی',
  cheque: 'چک صیادی',
};

export function InvoicePreviewModal({ invoice, onClose }: InvoicePreviewModalProps) {
  const { state } = useClientFlow();
  if (!invoice) return null;

  const customer = state.customers.find((c) => c.id === invoice.customerId);
  const order = state.orders.find((o) => o.id === invoice.orderId);
  const balance = Math.max(0, invoice.grandTotal - invoice.paidAmount);

  return (
    <Modal open={Boolean(invoice)} onClose={onClose} title={`پیش‌نمایش فاکتور ${invoice.invoiceNo}`} maxWidth="xl">
      <div className="space-y-5">
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
            <div>
              <div className="text-base font-bold text-indigo-600 dark:text-indigo-400">
                {state.settings.businessName}
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                صورتحساب فروش کالا و خدمات (ClientFlow)
              </div>
            </div>
            <div className="text-left text-xs tabular-nums">
              <div className="font-mono font-semibold">{invoice.invoiceNo}</div>
              <div className="mt-1 text-slate-500">تاریخ صدور: {formatJalali(invoice.issuedAt)}</div>
              <div className="text-slate-500">سررسید: {formatJalali(invoice.dueAt)}</div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 border-b border-slate-200 pb-4 text-xs sm:grid-cols-2 dark:border-slate-800">
            <div>
              <span className="text-slate-500">خریدار: </span>
              <span className="font-semibold">{customer?.name ?? 'مشتری'}</span>
            </div>
            <div className="tabular-nums">
              <span className="text-slate-500">تلفن تماس: </span>
              <span dir="ltr">{toFa(customer?.phone ?? '—')}</span>
              {customer?.nationalId && (
                <span className="mr-3">· کد ملی: {toFa(customer.nationalId)}</span>
              )}
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-900">
                <tr>
                  <th className="px-3 py-2 font-medium">شرح کالا / خدمت</th>
                  <th className="px-3 py-2 font-medium">تعداد</th>
                  <th className="px-3 py-2 font-medium">مبلغ واحد</th>
                  <th className="px-3 py-2 font-medium text-left">جمع کل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {(order?.items ?? [{ name: `سفارش ${invoice.orderId}`, qty: 1, price: invoice.subtotal }]).map(
                  (item, idx) => (
                    <tr key={idx}>
                      <td className="px-3 py-2.5 font-medium">{item.name}</td>
                      <td className="px-3 py-2.5 tabular-nums">{toFa(item.qty)}</td>
                      <td className="px-3 py-2.5 tabular-nums">{formatToman(item.price)}</td>
                      <td className="px-3 py-2.5 text-left tabular-nums font-medium">
                        {formatToman(item.qty * item.price)}
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-5 flex flex-col items-end gap-1.5 border-t border-slate-200 pt-4 text-xs tabular-nums dark:border-slate-800">
            <div className="flex w-full max-w-xs justify-between">
              <span className="text-slate-500">جمع کل اقلام:</span>
              <span>{formatToman(invoice.subtotal)}</span>
            </div>
            {invoice.discount > 0 && (
              <div className="flex w-full max-w-xs justify-between text-emerald-600 dark:text-emerald-400">
                <span>تخفیف:</span>
                <span>{formatToman(invoice.discount)} −</span>
              </div>
            )}
            <div className="flex w-full max-w-xs justify-between">
              <span className="text-slate-500">مالیات بر ارزش افزوده (۱۰٪):</span>
              <span>{formatToman(invoice.tax)}</span>
            </div>
            <div className="flex w-full max-w-xs justify-between border-t border-slate-200 pt-1.5 text-sm font-bold dark:border-slate-800">
              <span>مبلغ قابل پرداخت:</span>
              <span>{formatToman(invoice.grandTotal)}</span>
            </div>
            <div className="flex w-full max-w-xs justify-between text-emerald-600 dark:text-emerald-400">
              <span>مبلغ پرداخت‌شده ({METHOD_LABEL[invoice.method]}):</span>
              <span>{formatToman(invoice.paidAmount)}</span>
            </div>
            <div className="flex w-full max-w-xs justify-between font-semibold text-rose-600 dark:text-rose-400">
              <span>مانده بدهی:</span>
              <span>{formatToman(balance)}</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 print:hidden">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium dark:border-slate-700"
          >
            بستن
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700"
          >
            <Printer size={14} />
            چاپ / ذخیره PDF
          </button>
        </div>
      </div>
    </Modal>
  );
}
