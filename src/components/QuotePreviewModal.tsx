import { useState } from 'react';
import { CheckCircle2, Copy, ExternalLink, Printer, XCircle } from 'lucide-react';
import { useClientFlow } from '../store/useClientFlowStore';
import type { Quote } from '../types';
import { formatJalali, formatToman, toFa } from '../utils/jalali';
import { Modal } from './Modal';

interface QuotePreviewModalProps {
  quote: Quote | null;
  onClose: () => void;
}

const STATUS_BADGE: Record<Quote['status'], { label: string; cls: string }> = {
  draft: { label: 'پیش‌نویس', cls: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  sent: { label: 'ارسال‌شده به مشتری', cls: 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300' },
  approved: { label: 'تأییدشده توسط مشتری', cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' },
  rejected: { label: 'ردشده توسط مشتری', cls: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300' },
};

export function QuotePreviewModal({ quote, onClose }: QuotePreviewModalProps) {
  const { state, updateQuoteStatus, pushToast } = useClientFlow();
  const [clientLinkView, setClientLinkView] = useState(false);
  const [clientComment, setClientComment] = useState('');

  if (!quote) return null;

  const liveQuote = state.quotes.find((q) => q.id === quote.id) ?? quote;
  const subtotal = liveQuote.items.reduce((s, it) => s + it.qty * it.price, 0);
  const discountAmount = Math.round((subtotal * liveQuote.discountPct) / 100);
  const afterDiscount = Math.max(0, subtotal - discountAmount);
  const taxAmount = Math.round((afterDiscount * liveQuote.taxPct) / 100);
  const grandTotal = afterDiscount + taxAmount;
  const shareUrl = `https://clientflow.app/q/${liveQuote.shareToken}`;
  const badge = STATUS_BADGE[liveQuote.status];

  const handleCopyShareLink = () => {
    navigator.clipboard?.writeText(shareUrl).catch(() => {});
    if (liveQuote.status === 'draft') {
      updateQuoteStatus(liveQuote.id, 'sent');
    }
    pushToast('لینک تأیید آنلاین پیش‌فاکتور کپی شد.');
  };

  return (
    <Modal
      open={Boolean(quote)}
      onClose={() => {
        setClientLinkView(false);
        onClose();
      }}
      title={
        clientLinkView
          ? `نمای عمومی مشتری: پیش‌فاکتور ${liveQuote.quoteNo} (نسخه ${toFa(liveQuote.version)})`
          : `پیش‌نمایش و چاپ پیش‌فاکتور ${liveQuote.quoteNo}`
      }
      maxWidth="xl"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs print:hidden dark:border-slate-800 dark:bg-slate-800/50">
          <div className="flex items-center gap-2">
            <span className={`rounded px-2 py-0.5 font-medium ${badge.cls}`}>{badge.label}</span>
            <span className="font-mono text-[11px] text-slate-500" dir="ltr">
              {shareUrl}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyShareLink}
              className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900"
            >
              <Copy size={12} />
              کپی لینک مشتری
            </button>
            <button
              type="button"
              onClick={() => setClientLinkView((v) => !v)}
              className="inline-flex items-center gap-1 rounded bg-indigo-50 px-2.5 py-1 text-[11px] font-medium text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:text-indigo-300"
            >
              <ExternalLink size={12} />
              {clientLinkView ? 'بازگشت به نمای چاپی' : 'شبیه‌سازی باز شدن لینک توسط مشتری'}
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
            <div>
              <div className="text-base font-bold text-indigo-600 dark:text-indigo-400">
                {state.settings.businessName}
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                پیش‌فاکتور رسمی پیشنهادی (نسخه {toFa(liveQuote.version)})
              </div>
            </div>
            <div className="text-left text-xs tabular-nums">
              <div className="font-mono font-semibold">
                {liveQuote.quoteNo} · v{toFa(liveQuote.version)}
              </div>
              <div className="mt-1 text-slate-500">تاریخ صدور: {formatJalali(liveQuote.createdAt)}</div>
              <div className="text-slate-500">اعتبار تا: {formatJalali(liveQuote.validUntil)}</div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 border-b border-slate-200 pb-4 text-xs sm:grid-cols-2 dark:border-slate-800">
            <div>
              <span className="text-slate-500">مخاطب / خریدار: </span>
              <span className="font-semibold">{liveQuote.contactName}</span>
            </div>
            <div className="tabular-nums">
              <span className="text-slate-500">تلفن تماس: </span>
              <span dir="ltr">{toFa(liveQuote.phone || '—')}</span>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-900">
                <tr>
                  <th className="px-3 py-2 font-medium">شرح کالا / خدمات</th>
                  <th className="px-3 py-2 font-medium">تعداد</th>
                  <th className="px-3 py-2 font-medium">فی واحد</th>
                  <th className="px-3 py-2 font-medium text-left">مبلغ کل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {liveQuote.items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="px-3 py-2.5 font-medium">{item.name}</td>
                    <td className="px-3 py-2.5 tabular-nums">{toFa(item.qty)}</td>
                    <td className="px-3 py-2.5 tabular-nums">{formatToman(item.price)}</td>
                    <td className="px-3 py-2.5 text-left font-medium tabular-nums">
                      {formatToman(item.qty * item.price)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 flex flex-wrap items-start justify-between gap-4 border-t border-slate-200 pt-4 dark:border-slate-800">
            <div className="max-w-sm space-y-1 text-xs text-slate-600 dark:text-slate-400">
              {liveQuote.notes && (
                <div>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">توضیحات: </span>
                  {liveQuote.notes}
                </div>
              )}
              {liveQuote.clientComment && (
                <div className="rounded bg-slate-50 p-2 text-slate-700 dark:bg-slate-900 dark:text-slate-300">
                  نظر مشتری: {liveQuote.clientComment}
                </div>
              )}
            </div>

            <div className="flex w-full max-w-xs flex-col gap-1.5 text-xs tabular-nums">
              <div className="flex justify-between">
                <span className="text-slate-500">جمع کل:</span>
                <span>{formatToman(subtotal)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                  <span>تخفیف ({toFa(liveQuote.discountPct)}٪):</span>
                  <span>{formatToman(discountAmount)} −</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">مالیات ({toFa(liveQuote.taxPct)}٪):</span>
                <span>{formatToman(taxAmount)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-1.5 text-sm font-bold dark:border-slate-800">
                <span>جمع نهایی پیش‌فاکتور:</span>
                <span className="text-indigo-600 dark:text-indigo-400">{formatToman(grandTotal)}</span>
              </div>
            </div>
          </div>
        </div>

        {clientLinkView && (
          <div className="space-y-3 rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 print:hidden dark:border-indigo-900/60 dark:bg-indigo-950/20">
            <div className="text-xs font-semibold text-indigo-800 dark:text-indigo-300">
              پنل تصمیم‌گیری مشتری در لینک عمومی
            </div>
            <input
              type="text"
              value={clientComment}
              onChange={(e) => setClientComment(e.target.value)}
              placeholder="یادداشت یا درخواست اصلاح از طرف مشتری (اختیاری)..."
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900"
            />
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => updateQuoteStatus(liveQuote.id, 'rejected', clientComment || 'نیاز به بازنگری قیمت')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-white px-4 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:bg-slate-900 dark:text-rose-400"
              >
                <XCircle size={14} />
                رد پیش‌فاکتور
              </button>
              <button
                type="button"
                onClick={() => updateQuoteStatus(liveQuote.id, 'approved', clientComment || 'مورد تأیید است، لطفاً فاکتور نهایی صادر شود.')}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-700"
              >
                <CheckCircle2 size={14} />
                تأیید نهایی پیش‌فاکتور توسط مشتری
              </button>
            </div>
          </div>
        )}

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
