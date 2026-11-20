import { useEffect, useState } from 'react';
import { CheckCircle2, CreditCard, Lock, ShieldCheck, XCircle } from 'lucide-react';
import { useClientFlow } from '../store/useClientFlowStore';
import type { Invoice, PaymentTransaction } from '../types';
import { formatToman, toFa } from '../utils/jalali';
import { Modal } from './Modal';

interface PaymentGatewayModalProps {
  invoice: Invoice | null;
  onClose: () => void;
}

const GATEWAYS: { id: PaymentTransaction['gateway']; name: string; merchant: string; badge: string }[] = [
  { id: 'shaparak', name: 'درگاه شاپرک (Sandbox)', merchant: 'پذیرنده: 98412045', badge: 'شاپرک' },
  { id: 'zarinpal', name: 'زرین‌پال (آزمایشی)', merchant: 'ZarinPal Sandbox', badge: 'زرین‌پال' },
  { id: 'saman', name: 'درگاه پرداخت سامان (SEP)', merchant: 'Terminal: 1148209', badge: 'سامان' },
];

export function PaymentGatewayModal({ invoice, onClose }: PaymentGatewayModalProps) {
  const { state, processSandboxPayment } = useClientFlow();
  const [gateway, setGateway] = useState<PaymentTransaction['gateway']>('shaparak');
  const [amount, setAmount] = useState('0');
  const [cardNumber, setCardNumber] = useState('6104-3379-8812-4410');
  const [expMonth, setExpMonth] = useState('11');
  const [expYear, setExpYear] = useState('06');
  const [cvv2, setCvv2] = useState('482');
  const [otp, setOtp] = useState('');
  const [result, setResult] = useState<{
    ok: boolean;
    refId?: string;
    authority?: string;
    errorMessage?: string;
    adapterSteps?: { step: string; detail: string; at: string }[];
  } | null>(null);

  useEffect(() => {
    if (invoice) {
      const balance = Math.max(0, invoice.grandTotal - invoice.paidAmount);
      setAmount(String(balance));
      setResult(null);
      setOtp('');
    }
  }, [invoice]);

  if (!invoice) return null;

  const customer = state.customers.find((c) => c.id === invoice.customerId);
  const balance = Math.max(0, invoice.grandTotal - invoice.paidAmount);
  const cleanDigits = cardNumber.replace(/\D/g, '');
  const cardMasked =
    cleanDigits.length >= 10
      ? `${cleanDigits.slice(0, 4)}-****-****-${cleanDigits.slice(-4)}`
      : '6104-****-****-4410';

  const runOutcome = (outcome: 'succeeded' | 'failed' | 'cancelled') => {
    const payVal = Math.max(1, Math.min(balance || invoice.grandTotal, Number(amount) || balance));
    const res = processSandboxPayment({
      invoiceId: invoice.id,
      gateway,
      amount: payVal,
      cardMasked,
      outcome,
    });
    if (outcome === 'cancelled') {
      onClose();
      return;
    }
    setResult(res);
  };

  return (
    <Modal open={Boolean(invoice)} onClose={onClose} title="شبیه‌ساز درگاه پرداخت اینترنتی (Sandbox)" maxWidth="md">
      <div className="space-y-4">
        {/* Sandbox Header Banner */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-indigo-200 bg-indigo-50/70 p-3.5 text-xs dark:border-indigo-900/60 dark:bg-indigo-950/30">
          <div>
            <div className="flex items-center gap-1.5 font-semibold text-indigo-900 dark:text-indigo-200">
              <ShieldCheck size={16} className="text-indigo-600 dark:text-indigo-400" />
              تراکنش آزمایشی شبیه‌سازی‌شده برای فاکتور {invoice.invoiceNo}
            </div>
            <div className="mt-1 text-slate-600 dark:text-slate-400">
              پذیرنده: {state.settings.businessName} · مشتری: {customer?.name ?? 'مشتری'}
            </div>
          </div>
          <div className="text-left">
            <div className="text-[11px] text-slate-500">مبلغ قابل پرداخت</div>
            <div className="text-sm font-bold tabular-nums text-indigo-700 dark:text-indigo-300">
              {formatToman(Number(amount) || balance)}
            </div>
          </div>
        </div>

        {result ? (
          <div
            className={`rounded-xl border p-5 text-center ${
              result.ok
                ? 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/60 dark:bg-emerald-950/30'
                : 'border-rose-200 bg-rose-50/70 dark:border-rose-900/60 dark:bg-rose-950/30'
            }`}
          >
            {result.ok ? (
              <>
                <CheckCircle2 size={36} className="mx-auto text-emerald-600 dark:text-emerald-400" />
                <h3 className="mt-2 text-sm font-bold text-emerald-800 dark:text-emerald-200">
                  پرداخت با موفقیت انجام شد و فاکتور تسویه گردید
                </h3>
                <div className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                  کد رهگیری شاپرک:{' '}
                  <span className="font-mono font-bold text-slate-900 dark:text-slate-100" dir="ltr">
                    {result.refId}
                  </span>
                </div>
                <div className="mt-1 text-xs tabular-nums text-slate-500">
                  شماره کارت: <span dir="ltr">{cardMasked}</span>
                  {result.authority && (
                    <span className="mr-2 font-mono text-[11px]" dir="ltr">
                      · Authority: {result.authority}
                    </span>
                  )}
                </div>
              </>
            ) : (
              <>
                <XCircle size={36} className="mx-auto text-rose-600 dark:text-rose-400" />
                <h3 className="mt-2 text-sm font-bold text-rose-800 dark:text-rose-200">تراکنش ناموفق بود</h3>
                <p className="mt-1 text-xs text-rose-700 dark:text-rose-300">{result.errorMessage}</p>
              </>
            )}
            {result.adapterSteps && result.adapterSteps.length > 0 && (
              <div className="mt-3 space-y-1 rounded-lg border border-slate-200 bg-white/80 p-2.5 text-left font-mono text-[10px] text-slate-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300" dir="ltr">
                {result.adapterSteps.map((s, idx) => (
                  <div key={idx} className="truncate">
                    {s.step}: {s.detail}
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 flex justify-center gap-2">
              {!result.ok && (
                <button
                  type="button"
                  onClick={() => setResult(null)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  تلاش مجدد
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg bg-indigo-600 px-5 py-2 text-xs font-medium text-white hover:bg-indigo-700"
              >
                بازگشت به پنل مالی
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Gateway Provider Selection */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
                انتخاب درگاه پرداخت
              </label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {GATEWAYS.map((gw) => (
                  <button
                    key={gw.id}
                    type="button"
                    onClick={() => setGateway(gw.id)}
                    className={`rounded-lg border p-2.5 text-right transition-colors ${
                      gateway === gw.id
                        ? 'border-indigo-600 bg-indigo-50/70 dark:border-indigo-500 dark:bg-indigo-950/40'
                        : 'border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="text-xs font-semibold">{gw.badge}</div>
                    <div className="mt-0.5 text-[10px] text-slate-500">{gw.merchant}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Amount + Test Card Form */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-slate-500">مبلغ پرداختی (تومان)</label>
                <input
                  type="number"
                  min={1}
                  max={balance || invoice.grandTotal}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">شماره کارت شتابی (آزمایشی)</label>
                <div className="relative">
                  <input
                    type="text"
                    dir="ltr"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 pl-8 text-left font-mono text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
                  />
                  <CreditCard size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className="mb-1 block text-xs text-slate-500">CVV2</label>
                <input
                  type="text"
                  dir="ltr"
                  maxLength={4}
                  value={cvv2}
                  onChange={(e) => setCvv2(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-center font-mono text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">ماه انقضا</label>
                <input
                  type="text"
                  dir="ltr"
                  maxLength={2}
                  value={expMonth}
                  onChange={(e) => setExpMonth(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-center font-mono text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">سال انقضا</label>
                <input
                  type="text"
                  dir="ltr"
                  maxLength={2}
                  value={expYear}
                  onChange={(e) => setExpYear(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-center font-mono text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-2">
              <div className="flex-1">
                <label className="mb-1 block text-xs text-slate-500">رمز دوم پویا (OTP)</label>
                <input
                  type="text"
                  dir="ltr"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="مثلاً 482910"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-left font-mono text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
              <button
                type="button"
                onClick={() => setOtp(String(Math.floor(100000 + Math.random() * 899999)))}
                className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-300"
              >
                درخواست رمز پویا
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => runOutcome('failed')}
                  className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-400 dark:hover:bg-rose-950/30"
                >
                  شبیه‌سازی خطای بانکی
                </button>
                <button
                  type="button"
                  onClick={() => runOutcome('cancelled')}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  انصراف از پرداخت
                </button>
              </div>
              <button
                type="button"
                onClick={() => runOutcome('succeeded')}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                <Lock size={14} />
                پرداخت موفق (Callback تأیید) ({toFa(formatToman(Number(amount) || balance))})
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
