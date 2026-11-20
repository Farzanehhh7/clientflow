import { LifeBuoy, Receipt } from 'lucide-react';
import { useClientFlow } from '../../../store/useClientFlowStore';
import type { Customer, SayadiChequeStatus, TicketStatus } from '../../../types';
import { formatJalali, formatJalaliDateTime, formatToman, toFa } from '../../../utils/jalali';
import { Badge, EmptyState, Table } from '../../ui';
import type { BadgeTone } from '../../ui/Badge';

const TICKET_STATUS: Record<TicketStatus, { label: string; tone: BadgeTone }> = {
  open: { label: 'باز', tone: 'rose' },
  in_progress: { label: 'در دست بررسی', tone: 'indigo' },
  pending: { label: 'در انتظار مشتری', tone: 'amber' },
  resolved: { label: 'حل‌شده', tone: 'emerald' },
  closed: { label: 'بسته', tone: 'neutral' },
};

const INVOICE_STATUS: Record<'issued' | 'partial' | 'paid', { label: string; tone: BadgeTone }> = {
  issued: { label: 'صادرشده (پرداخت‌نشده)', tone: 'amber' },
  partial: { label: 'پرداخت جزئی', tone: 'indigo' },
  paid: { label: 'تسویه کامل', tone: 'emerald' },
};

const CHEQUE_STATUS: Record<SayadiChequeStatus, { label: string; tone: BadgeTone }> = {
  received: { label: 'دریافت‌شده', tone: 'sky' },
  deposited: { label: 'واگذار به بانک', tone: 'indigo' },
  cleared: { label: 'پاس‌شده', tone: 'emerald' },
  bounced: { label: 'برگشتی', tone: 'rose' },
};

export function CustomerTicketsTab({ customer }: { customer: Customer }) {
  const { state } = useClientFlow();
  const tickets = state.tickets
    .filter((t) => t.customerId === customer.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <Table
      isEmpty={tickets.length === 0}
      emptyState={
        <EmptyState icon={<LifeBuoy size={26} />} title="تیکت پشتیبانی برای این مشتری ثبت نشده است" />
      }
      headers={[
        { key: 'subject', label: 'موضوع تیکت' },
        { key: 'priority', label: 'اولویت' },
        { key: 'assignee', label: 'کارشناس مسئول' },
        { key: 'status', label: 'وضعیت' },
        { key: 'created', label: 'تاریخ ثبت' },
      ]}
    >
      {tickets.map((t) => {
        const st = TICKET_STATUS[t.status];
        const msgsCount = state.ticketMessages.filter((m) => m.ticketId === t.id).length;
        return (
          <tr key={t.id} className="text-xs hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
            <td className="px-4 py-2.5">
              <div className="font-semibold text-slate-800 dark:text-slate-100">{t.subject}</div>
              {msgsCount > 0 && (
                <div className="text-[11px] text-slate-400">{toFa(msgsCount)} پیام در رشته گفتگو</div>
              )}
            </td>
            <td className="px-4 py-2.5">
              <Badge tone={t.priority === 'high' ? 'rose' : t.priority === 'normal' ? 'indigo' : 'neutral'}>
                {t.priority === 'high' ? 'فوری' : t.priority === 'normal' ? 'عادی' : 'کم'}
              </Badge>
            </td>
            <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{t.assignee || 'تعیین‌نشده'}</td>
            <td className="px-4 py-2.5">
              <Badge tone={st.tone}>{st.label}</Badge>
            </td>
            <td className="px-4 py-2.5 tabular-nums text-slate-500">{formatJalaliDateTime(t.createdAt)}</td>
          </tr>
        );
      })}
    </Table>
  );
}

export function CustomerInvoicesPaymentsTab({ customer }: { customer: Customer }) {
  const { state } = useClientFlow();
  const invoices = state.invoices.filter((inv) => inv.customerId === customer.id);
  const payments = state.paymentTransactions.filter((pt) => pt.customerId === customer.id);
  const cheques = state.sayadiCheques.filter((ch) => ch.customerId === customer.id);

  const totalBilled = invoices.reduce((s, inv) => s + inv.grandTotal, 0);
  const totalPaid = invoices.reduce((s, inv) => s + inv.paidAmount, 0);
  const remaining = Math.max(0, totalBilled - totalPaid);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs text-slate-500">جمع فاکتورها</div>
          <div className="mt-1 text-base font-bold tabular-nums">{formatToman(totalBilled)}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs text-slate-500">مجموع پرداختی</div>
          <div className="mt-1 text-base font-bold tabular-nums text-emerald-600">{formatToman(totalPaid)}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs text-slate-500">مانده بدهی</div>
          <div className="mt-1 text-base font-bold tabular-nums text-rose-600">{formatToman(remaining)}</div>
        </div>
      </div>

      <Table
        isEmpty={invoices.length === 0}
        emptyState={<EmptyState icon={<Receipt size={26} />} title="فاکتوری برای این مشتری صادر نشده است" />}
        headers={[
          { key: 'no', label: 'شماره فاکتور' },
          { key: 'total', label: 'جمع کل' },
          { key: 'paid', label: 'پرداخت‌شده' },
          { key: 'status', label: 'وضعیت' },
          { key: 'issued', label: 'تاریخ صدور' },
        ]}
      >
        {invoices.map((inv) => {
          const st = INVOICE_STATUS[inv.status];
          return (
            <tr key={inv.id} className="text-xs">
              <td className="px-4 py-2.5 font-semibold tabular-nums">{toFa(inv.invoiceNo)}</td>
              <td className="px-4 py-2.5 tabular-nums">{formatToman(inv.grandTotal)}</td>
              <td className="px-4 py-2.5 tabular-nums text-emerald-600">{formatToman(inv.paidAmount)}</td>
              <td className="px-4 py-2.5">
                <Badge tone={st.tone}>{st.label}</Badge>
              </td>
              <td className="px-4 py-2.5 tabular-nums text-slate-500">{formatJalali(inv.issuedAt)}</td>
            </tr>
          );
        })}
      </Table>

      {(payments.length > 0 || cheques.length > 0) && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {payments.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <h4 className="mb-2 text-xs font-semibold">تراکنش‌های درگاه پرداخت</h4>
              <div className="space-y-2 text-xs">
                {payments.map((pt) => (
                  <div key={pt.id} className="flex items-center justify-between border-b border-slate-100 pb-1.5 dark:border-slate-800">
                    <span>
                      فاکتور {toFa(pt.invoiceNo)} · {pt.gateway}
                    </span>
                    <span className="font-semibold tabular-nums">{formatToman(pt.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {cheques.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <h4 className="mb-2 text-xs font-semibold">چک‌های صیادی</h4>
              <div className="space-y-2 text-xs">
                {cheques.map((ch) => {
                  const st = CHEQUE_STATUS[ch.status];
                  return (
                    <div key={ch.id} className="flex items-center justify-between border-b border-slate-100 pb-1.5 dark:border-slate-800">
                      <div>
                        <span className="font-medium">{ch.bankName}</span>
                        <span className="mx-1.5 text-slate-400">·</span>
                        <span className="tabular-nums text-slate-500">سررسید {toFa(ch.dueDateJalali)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold tabular-nums">{formatToman(ch.amount)}</span>
                        <Badge tone={st.tone}>{st.label}</Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
