import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../Modal';
import { JalaliDatePicker } from '../ui/JalaliDatePicker';
import { useClientFlow } from '../../store/useClientFlowStore';
import type { Invoice, PaymentMethod } from '../../types';
import { formatToman, getTodayJalaliAscii, jalaliToIsoUtc, toFa } from '../../utils/jalali';
import { PAYMENT_METHOD_LABEL } from './orderHelpers';

type SinglePaymentModalProps = {
  invoice: Invoice | null;
  onClose: () => void;
};

export function SinglePaymentModal({ invoice, onClose }: SinglePaymentModalProps) {
  const { recordInvoicePayment } = useClientFlow();
  const [payAmount, setPayAmount] = useState('0');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('online');

  useEffect(() => {
    if (!invoice) return;
    setPayAmount(String(Math.max(0, invoice.grandTotal - invoice.paidAmount)));
    setPayMethod(invoice.method);
  }, [invoice]);

  return (
    <Modal
      open={Boolean(invoice)}
      onClose={onClose}
      title={`ثبت پرداخت فاکتور ${invoice?.invoiceNo ?? ''}`}
      maxWidth="sm"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!invoice) return;
          recordInvoicePayment(invoice.id, Number(payAmount) || 0, payMethod);
          onClose();
        }}
        className="space-y-4"
      >
        <div>
          <label className="mb-1 block text-xs text-slate-500">مبلغ پرداختی (تومان)</label>
          <input
            type="number"
            min={1}
            value={payAmount}
            onChange={(e) => setPayAmount(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm tabular-nums dark:border-slate-700 dark:bg-slate-800"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">روش پرداخت</label>
          <select
            value={payMethod}
            onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
          >
            {(Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map((m) => (
              <option key={m} value={m}>
                {PAYMENT_METHOD_LABEL[m]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm dark:border-slate-700"
          >
            انصراف
          </button>
          <button
            type="submit"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            ثبت پرداخت
          </button>
        </div>
      </form>
    </Modal>
  );
}

type SayadiChequeModalProps = {
  open: boolean;
  onClose: () => void;
};

export function SayadiChequeModal({ open, onClose }: SayadiChequeModalProps) {
  const { state, addSayadiCheque } = useClientFlow();
  const [chqNo, setChqNo] = useState('');
  const [chqSayadiId, setChqSayadiId] = useState('');
  const [chqBank, setChqBank] = useState('بانک ملت');
  const [chqDrawer, setChqDrawer] = useState('');
  const [chqCustomerId, setChqCustomerId] = useState(state.customers[0]?.id ?? '');
  const [chqInvoiceId, setChqInvoiceId] = useState('');
  const [chqAmount, setChqAmount] = useState('5000000');
  const [chqDueJalali, setChqDueJalali] = useState(() => getTodayJalaliAscii());
  const [chqNotes, setChqNotes] = useState('');

  return (
    <Modal open={open} onClose={onClose} title="ثبت چک صیادی جدید" maxWidth="md">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!chqNo.trim() || !chqDrawer.trim()) return;
          const isoDue = jalaliToIsoUtc(chqDueJalali) ?? new Date(Date.now() + 30 * 24 * 3600_000).toISOString();
          addSayadiCheque({
            chequeNo: chqNo.trim(),
            sayadiId:
              chqSayadiId.trim() ||
              `44${Math.floor(10000000000000 + Math.random() * 89999999999999)}`,
            bankName: chqBank.trim() || 'بانک ملت',
            drawerName: chqDrawer.trim(),
            customerId: chqCustomerId,
            invoiceId: chqInvoiceId || undefined,
            amount: Math.max(1000, Number(chqAmount) || 0),
            dueDateJalali: chqDueJalali.trim() || getTodayJalaliAscii(),
            dueDateIso: isoDue,
            status: 'received',
            notes: chqNotes.trim() || undefined,
          });
          onClose();
          setChqNo('');
          setChqSayadiId('');
          setChqDrawer('');
          setChqNotes('');
        }}
        className="space-y-3"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-slate-500">شماره برگه چک *</label>
            <input
              type="text"
              required
              dir="ltr"
              value={chqNo}
              onChange={(e) => setChqNo(e.target.value)}
              placeholder="654321"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-left font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">شناسه ۱۶ رقمی صیادی</label>
            <input
              type="text"
              dir="ltr"
              maxLength={16}
              value={chqSayadiId}
              onChange={(e) => setChqSayadiId(e.target.value)}
              placeholder="تولید خودکار در صورت خالی‌ماندن"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-left font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">مشتری</label>
            <select
              value={chqCustomerId}
              onChange={(e) => setChqCustomerId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
            >
              {state.customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">صادرکننده چک *</label>
            <input
              type="text"
              required
              value={chqDrawer}
              onChange={(e) => setChqDrawer(e.target.value)}
              placeholder="نام صاحب حساب چک"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">نام بانک</label>
            <input
              type="text"
              value={chqBank}
              onChange={(e) => setChqBank(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">مبلغ چک (تومان)</label>
            <input
              type="number"
              required
              min={1000}
              value={chqAmount}
              onChange={(e) => setChqAmount(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
        </div>

        <JalaliDatePicker
          label="تاریخ سررسید چک (شمسی)"
          value={chqDueJalali}
          onChange={setChqDueJalali}
        />

        <div>
          <label className="mb-1 block text-xs text-slate-500">اتصال به فاکتور (اختیاری)</label>
          <select
            value={chqInvoiceId}
            onChange={(e) => setChqInvoiceId(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
          >
            <option value="">-- بدون اتصال به فاکتور --</option>
            {state.invoices
              .filter((inv) => inv.grandTotal > inv.paidAmount)
              .map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.invoiceNo} (مانده: {formatToman(inv.grandTotal - inv.paidAmount)})
                </option>
              ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs text-slate-500">یادداشت</label>
          <input
            type="text"
            value={chqNotes}
            onChange={(e) => setChqNotes(e.target.value)}
            placeholder="توضیحات بابت چک..."
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-xs dark:border-slate-700"
          >
            انصراف
          </button>
          <button
            type="submit"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700"
          >
            ثبت چک صیادی
          </button>
        </div>
      </form>
    </Modal>
  );
}

type PaymentAllocationModalProps = {
  open: boolean;
  onClose: () => void;
};

export function PaymentAllocationModal({ open, onClose }: PaymentAllocationModalProps) {
  const { state, allocatePaymentToInvoices } = useClientFlow();
  const [customerId, setCustomerId] = useState(state.customers[0]?.id ?? '');
  const [totalAmount, setTotalAmount] = useState('3000000');
  const [method, setMethod] = useState<PaymentMethod>('transfer');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [allocMap, setAllocMap] = useState<Record<string, number>>({});
  const [error, setError] = useState('');

  const openInvoices = useMemo(
    () =>
      state.invoices
        .filter((inv) => inv.customerId === customerId && inv.grandTotal > inv.paidAmount)
        .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()),
    [state.invoices, customerId],
  );

  useEffect(() => {
    setAllocMap({});
    setError('');
  }, [customerId, open]);

  const allocatedSum = useMemo(
    () => Object.values(allocMap).reduce((s, v) => s + (v || 0), 0),
    [allocMap],
  );

  const handleAutoDistribute = () => {
    let remaining = Math.max(0, Number(totalAmount) || 0);
    const next: Record<string, number> = {};
    for (const inv of openInvoices) {
      const balance = Math.max(0, inv.grandTotal - inv.paidAmount);
      const take = Math.min(remaining, balance);
      if (take > 0) {
        next[inv.id] = take;
        remaining -= take;
      }
    }
    setAllocMap(next);
  };

  return (
    <Modal open={open} onClose={onClose} title="تخصیص پرداخت تجمیعی به چند فاکتور" maxWidth="lg">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError('');
          const res = allocatePaymentToInvoices({
            customerId,
            totalAmount: Math.max(0, Number(totalAmount) || 0),
            method,
            reference,
            note,
            allocations: Object.entries(allocMap).map(([invoiceId, amount]) => ({
              invoiceId,
              amount: Number(amount) || 0,
            })),
          });
          if (!res.ok) {
            setError(res.error ?? 'خطا در تخصیص پرداخت');
            return;
          }
          onClose();
        }}
        className="space-y-4"
      >
        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs text-slate-500">مشتری</label>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
            >
              {state.customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">مبلغ کل واریزی (تومان)</label>
            <input
              type="number"
              min={1}
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">روش پرداخت</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as PaymentMethod)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
            >
              {(Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map((m) => (
                <option key={m} value={m}>
                  {PAYMENT_METHOD_LABEL[m]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-600 dark:text-slate-300">
            فاکتورهای باز مشتری ({toFa(openInvoices.length)})
          </span>
          <button
            type="button"
            onClick={handleAutoDistribute}
            className="rounded border border-indigo-200 px-2.5 py-1 text-indigo-600 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-400"
          >
            توزیع خودکار از قدیمی‌ترین فاکتور (FIFO)
          </button>
        </div>

        {openInvoices.length === 0 ? (
          <p className="rounded-lg border border-slate-200 py-5 text-center text-xs text-slate-400 dark:border-slate-800">
            برای این مشتری فاکتور باز با مانده بدهی وجود ندارد.
          </p>
        ) : (
          <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
            {openInvoices.map((inv) => {
              const balance = Math.max(0, inv.grandTotal - inv.paidAmount);
              return (
                <div key={inv.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs">
                  <div>
                    <span className="font-mono font-semibold">{inv.invoiceNo}</span>
                    <span className="mx-2 text-slate-400">·</span>
                    <span className="tabular-nums text-rose-600 dark:text-rose-400">
                      مانده: {formatToman(balance)}
                    </span>
                  </div>
                  <input
                    type="number"
                    min={0}
                    max={balance}
                    value={allocMap[inv.id] ?? 0}
                    onChange={(e) =>
                      setAllocMap((prev) => ({
                        ...prev,
                        [inv.id]: Math.max(0, Math.min(balance, Number(e.target.value) || 0)),
                      }))
                    }
                    className="w-32 rounded border border-slate-200 bg-white px-2.5 py-1 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
              );
            })}
          </div>
        )}

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <input
            type="text"
            dir="ltr"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="شماره پیگیری شبا / فیش..."
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-left font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
          />
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="یادداشت تخصیص..."
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3 text-xs dark:border-slate-800">
          <span className="tabular-nums text-slate-500">
            جمع تخصیص‌یافته: <strong className="text-slate-900 dark:text-slate-100">{formatToman(allocatedSum)}</strong> از{' '}
            {formatToman(Number(totalAmount) || 0)}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-1.5 dark:border-slate-700"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-1.5 font-medium text-white hover:bg-indigo-700"
            >
              ثبت و اعمال روی فاکتورها
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
