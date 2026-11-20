import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  CreditCard,
  ExternalLink,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { getPaymentGatewayProvider } from '../../services/providers/paymentGatewayAdapter';
import { useClientFlow } from '../../store/useClientFlowStore';
import type { PaymentTransaction } from '../../types';
import { formatJalaliDateTime, formatToman, toFa } from '../../utils/jalali';

export function PaymentGatewayTab() {
  const { state, processSandboxPayment } = useClientFlow();

  const openInvoices = useMemo(
    () => state.invoices.filter((i) => i.grandTotal - i.paidAmount > 0),
    [state.invoices],
  );
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(
    openInvoices[0]?.id ?? state.invoices[0]?.id ?? '',
  );
  const [gateway, setGateway] = useState<PaymentTransaction['gateway']>('zarinpal');
  const [cardMasked, setCardMasked] = useState('6104-****-****-4410');
  const [stepPhase, setStepPhase] = useState<'idle' | 'redirected' | 'verified'>('idle');
  const [pendingAuthority, setPendingAuthority] = useState<{ authority: string; redirectUrl: string } | null>(null);
  const [lastTrace, setLastTrace] = useState<{
    ok: boolean;
    refId?: string;
    authority?: string;
    errorMessage?: string;
    adapterSteps?: { step: string; detail: string; at: string }[];
  } | null>(null);

  const inv = state.invoices.find((i) => i.id === selectedInvoiceId);
  const amount = inv ? Math.max(100000, inv.grandTotal - inv.paidAmount) : 500000;
  const adapter = getPaymentGatewayProvider(gateway);

  const handleRequestRedirect = () => {
    if (!inv) return;
    const req = adapter.requestPayment({
      invoiceId: inv.id,
      invoiceNo: inv.invoiceNo,
      amount,
      callbackUrl: `${window.location.origin}/api/payments/callback/${gateway}`,
      description: `تسویه فاکتور ${inv.invoiceNo}`,
    });
    setPendingAuthority({ authority: req.authority, redirectUrl: req.redirectUrl });
    setStepPhase('redirected');
    setLastTrace(null);
  };

  const handleCompleteCallbackVerify = (outcome: 'succeeded' | 'failed' | 'cancelled') => {
    if (!inv) return;
    const res = processSandboxPayment({
      invoiceId: inv.id,
      gateway,
      amount,
      cardMasked,
      outcome,
    });
    setLastTrace(res);
    setStepPhase('verified');
  };

  return (
    <div className="space-y-5">
      {/* Interactive 3-Step Gateway Adapter Flow */}
      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck size={16} className="text-indigo-500" />
              شبیه‌ساز چرخه کامل درگاه پرداخت (IPaymentGatewayProvider: Redirect → Callback → Verify)
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              مراحل واقعی RequestPayment، انتقال به آدرس شاپرک/زرین‌پال، بازگشت Callback و Verify فاکتور را گام‌به‌گام تست کنید.
            </p>
          </div>
          <span className="font-mono text-[11px] text-indigo-600 dark:text-indigo-400">
            {adapter.merchantLabel}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-[11px] text-slate-500">آداپتور درگاه پرداخت</label>
            <select
              value={gateway}
              onChange={(e) => {
                setGateway(e.target.value as PaymentTransaction['gateway']);
                setStepPhase('idle');
              }}
              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="zarinpal">زرین‌پال (ZarinPal Sandbox)</option>
              <option value="shaparak">شاپرک (Shaparak Sandbox)</option>
              <option value="saman">بانک سامان (SEP Sandbox)</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-slate-500">فاکتور جهت تسویه</label>
            <select
              value={selectedInvoiceId}
              onChange={(e) => {
                setSelectedInvoiceId(e.target.value);
                setStepPhase('idle');
              }}
              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 dark:border-slate-700 dark:bg-slate-800"
            >
              {state.invoices.map((i) => {
                const bal = Math.max(0, i.grandTotal - i.paidAmount);
                return (
                  <option key={i.id} value={i.id}>
                    {i.invoiceNo} — مانده: {formatToman(bal)}
                  </option>
                );
              })}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-slate-500">شماره کارت ماسک‌شده تست</label>
            <input
              type="text"
              dir="ltr"
              value={cardMasked}
              onChange={(e) => setCardMasked(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 font-mono dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
        </div>

        {/* Stepper */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {/* Step 1 */}
          <div
            className={`rounded-xl border p-3.5 text-xs ${
              stepPhase === 'idle'
                ? 'border-indigo-300 bg-indigo-50/40 dark:border-indigo-800 dark:bg-indigo-950/20'
                : 'border-emerald-200 bg-emerald-50/30 dark:border-emerald-900 dark:bg-emerald-950/10'
            }`}
          >
            <div className="font-semibold">۱. درخواست توکن و Redirect</div>
            <p className="mt-1 text-[11px] text-slate-500">
              فراخوانی <code className="font-mono">requestPayment()</code> به مبلغ {formatToman(amount)}
            </p>
            <button
              type="button"
              onClick={handleRequestRedirect}
              disabled={!inv}
              className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              <ExternalLink size={13} />
              دریافت Authority و انتقال به درگاه
            </button>
          </div>

          {/* Step 2 */}
          <div
            className={`rounded-xl border p-3.5 text-xs ${
              stepPhase === 'redirected'
                ? 'border-indigo-300 bg-indigo-50/40 dark:border-indigo-800 dark:bg-indigo-950/20'
                : 'border-slate-200 dark:border-slate-800'
            }`}
          >
            <div className="font-semibold">۲. صفحه شبیه‌ساز بانک & Callback</div>
            {pendingAuthority ? (
              <div className="mt-1 space-y-2">
                <div className="truncate font-mono text-[10px] text-indigo-600 dark:text-indigo-400" dir="ltr">
                  {pendingAuthority.redirectUrl}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleCompleteCallbackVerify('succeeded')}
                    className="flex-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 font-medium text-white hover:bg-emerald-700"
                  >
                    پرداخت موفق (OK)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCompleteCallbackVerify('failed')}
                    className="rounded-lg border border-rose-200 px-2.5 py-1.5 text-rose-600 hover:bg-rose-50 dark:border-rose-900"
                  >
                    خطا (NOK)
                  </button>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-[11px] text-slate-400">ابتدا مرحله ۱ را اجرا کنید تا لینک درگاه صادر شود.</p>
            )}
          </div>

          {/* Step 3 */}
          <div
            className={`rounded-xl border p-3.5 text-xs ${
              stepPhase === 'verified'
                ? lastTrace?.ok
                  ? 'border-emerald-300 bg-emerald-50/40 dark:border-emerald-800 dark:bg-emerald-950/20'
                  : 'border-rose-300 bg-rose-50/40 dark:border-rose-800 dark:bg-rose-950/20'
                : 'border-slate-200 dark:border-slate-800'
            }`}
          >
            <div className="font-semibold">۳. VerifyPayment و ثبت سند مالی</div>
            {lastTrace ? (
              <div className="mt-1.5 space-y-1">
                <div className="flex items-center gap-1 font-semibold">
                  {lastTrace.ok ? (
                    <>
                      <CheckCircle2 size={14} className="text-emerald-600" />
                      <span className="text-emerald-700 dark:text-emerald-300">
                        تأیید شد ({lastTrace.refId})
                      </span>
                    </>
                  ) : (
                    <>
                      <XCircle size={14} className="text-rose-600" />
                      <span className="text-rose-700 dark:text-rose-300">{lastTrace.errorMessage}</span>
                    </>
                  )}
                </div>
                {lastTrace.adapterSteps?.map((s, idx) => (
                  <div key={idx} className="truncate font-mono text-[10px] text-slate-500" dir="ltr">
                    {s.step}: {s.detail}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-[11px] text-slate-400">در انتظار دریافت Callback و Verify.</p>
            )}
          </div>
        </div>
      </div>

      {/* Transaction History */}
      <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <CreditCard size={15} className="text-indigo-500" />
            تراکنش‌های درگاه پرداخت و گزارش Verify ({toFa(state.paymentTransactions.length)})
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="border-b border-slate-200 bg-slate-50/70 text-slate-500 dark:border-slate-800 dark:bg-slate-800/40">
              <tr>
                <th className="px-4 py-2.5 font-medium">فاکتور</th>
                <th className="px-4 py-2.5 font-medium">درگاه</th>
                <th className="px-4 py-2.5 font-medium">Authority</th>
                <th className="px-4 py-2.5 font-medium">کد رهگیری (RefId)</th>
                <th className="px-4 py-2.5 font-medium">مبلغ</th>
                <th className="px-4 py-2.5 font-medium">وضعیت</th>
                <th className="px-4 py-2.5 font-medium text-left">زمان</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {state.paymentTransactions.map((tx) => (
                <tr key={tx.id}>
                  <td className="px-4 py-2.5 font-mono font-semibold">{tx.invoiceNo}</td>
                  <td className="px-4 py-2.5 uppercase font-mono">{tx.gateway}</td>
                  <td className="px-4 py-2.5 font-mono text-[11px] text-slate-500" dir="ltr">
                    {tx.authority ?? '—'}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-[11px]" dir="ltr">
                    {tx.refId ?? '—'}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums font-semibold">{formatToman(tx.amount)}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium ${
                        tx.status === 'succeeded'
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                          : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                      }`}
                    >
                      {tx.status === 'succeeded' ? 'موفق (Verified)' : tx.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-left tabular-nums text-slate-500">
                    {formatJalaliDateTime(tx.at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
