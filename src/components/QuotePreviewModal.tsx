import { useState } from 'react';
import { CheckCircle2, Copy, ExternalLink, Printer, ShieldAlert, ShieldCheck, XCircle } from 'lucide-react';
import { getPackSalesConfig } from '../data/packs';
import { useClientFlow } from '../store/useClientFlowStore';
import type { Quote } from '../types';
import { computeQuoteFinancials } from '../utils/crmHelpers';
import { formatJalali, formatToman, toFa } from '../utils/jalali';
import { Modal } from './Modal';
import { Badge } from './ui/Badge';

interface QuotePreviewModalProps {
  quote: Quote | null;
  onClose: () => void;
}

const STATUS_BADGE: Record<
  Quote['status'],
  { label: string; tone: 'neutral' | 'sky' | 'emerald' | 'rose' | 'amber' }
> = {
  draft: { label: 'پیش‌نویس', tone: 'neutral' },
  sent: { label: 'ارسال‌شده به مشتری', tone: 'sky' },
  accepted: { label: 'پذیرفته‌شده توسط مشتری', tone: 'emerald' },
  approved: { label: 'تأییدشده توسط مشتری', tone: 'emerald' },
  rejected: { label: 'ردشده توسط مشتری', tone: 'rose' },
  expired: { label: 'منقضی‌شده', tone: 'amber' },
};

export function QuotePreviewModal({ quote, onClose }: QuotePreviewModalProps) {
  const { state, updateQuoteStatus, approveQuoteDiscount, pushToast } = useClientFlow();
  const [clientLinkView, setClientLinkView] = useState(false);
  const [clientComment, setClientComment] = useState('');

  if (!quote) return null;

  const liveQuote = state.quotes.find((q) => q.id === quote.id) ?? quote;
  const packSales = getPackSalesConfig(state.settings.industryPack, state.customPacks);
  const fin = computeQuoteFinancials(liveQuote);
  const shareUrl = `https://clientflow.app/q/${liveQuote.shareToken}`;
  const badge = STATUS_BADGE[liveQuote.status] ?? STATUS_BADGE.draft;
  const needsManagerGate = liveQuote.approvalStatus === 'pending_manager';

  const handleCopyShareLink = () => {
    if (needsManagerGate) {
      pushToast('پیش‌فاکتور دارای تخفیف بالای ۲۰٪ است و پیش از ارسال نیازمند تأیید مدیر می‌باشد.', 'error');
      return;
    }
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
          ? `نمای عمومی مشتری · ${liveQuote.quoteNo} (نسخه ${toFa(liveQuote.version)})`
          : `پیش‌نمایش چاپی A4 · ${packSales.quoteLabel} ${liveQuote.quoteNo}`
      }
      maxWidth="2xl"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs print:hidden dark:border-slate-800 dark:bg-slate-800/50">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={badge.tone}>{badge.label}</Badge>
            {needsManagerGate && (
              <Badge tone="amber">در انتظار تأیید تخفیف مدیر ({toFa(fin.effectiveDiscountPct)}٪)</Badge>
            )}
            <span className="font-mono text-[11px] text-slate-500" dir="ltr">
              {shareUrl}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {needsManagerGate && state.settings.role === 'admin' && (
              <button
                type="button"
                onClick={() => approveQuoteDiscount(liveQuote.id, true)}
                className="inline-flex items-center gap-1 whitespace-nowrap rounded bg-emerald-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-emerald-700"
              >
                <ShieldCheck size={12} />
                تأیید تخفیف توسط مدیر
              </button>
            )}
            <button
              type="button"
              onClick={handleCopyShareLink}
              className="inline-flex items-center gap-1 whitespace-nowrap rounded border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900"
            >
              <Copy size={12} />
              کپی لینک مشتری
            </button>
            <button
              type="button"
              onClick={() => setClientLinkView((v) => !v)}
              className="inline-flex items-center gap-1 whitespace-nowrap rounded bg-indigo-50 px-2.5 py-1 text-[11px] font-medium text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:text-indigo-300"
            >
              <ExternalLink size={12} />
              {clientLinkView ? 'نمای چاپی A4' : 'نمای تصمیم مشتری'}
            </button>
          </div>
        </div>

        <div className="mx-auto w-full max-w-[210mm] rounded-xl border border-slate-200 bg-white p-6 text-slate-900 shadow-sm print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
            <div>
              <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                {state.settings.businessName}
              </div>
              <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                {packSales.quoteLabel} · نسخه {toFa(liveQuote.version)}
                {liveQuote.priceListName ? ` · ${liveQuote.priceListName}` : ''}
              </div>
            </div>
            <div className="text-left text-xs tabular-nums">
              <div className="font-mono text-sm font-bold">
                {liveQuote.quoteNo} · v{toFa(liveQuote.version)}
              </div>
              <div className="mt-1 text-slate-500">تاریخ صدور (شمسی): {formatJalali(liveQuote.createdAt)}</div>
              <div className="text-slate-500">معتبر تا تاریخ: {formatJalali(liveQuote.validUntil)}</div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 border-b border-slate-200 pb-4 text-xs sm:grid-cols-3 dark:border-slate-800">
            <div>
              <div className="text-[11px] text-slate-500">خریدار / مخاطب</div>
              <div className="mt-0.5 font-semibold">{liveQuote.contactName}</div>
            </div>
            <div className="tabular-nums">
              <div className="text-[11px] text-slate-500">شماره تماس</div>
              <div className="mt-0.5 font-medium" dir="ltr">
                {toFa(liveQuote.phone || '—')}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500">وضعیت پیش‌فاکتور</div>
              <div className="mt-0.5 font-semibold">{badge.label}</div>
            </div>
          </div>

          {fin.requiresManagerApproval && (
            <div className="mt-4 flex items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
              <span className="inline-flex items-center gap-1.5">
                <ShieldAlert size={14} />
                تخفیف مؤثر این پیش‌فاکتور ({toFa(fin.effectiveDiscountPct)}٪) بیش از حد مجاز ۲۰٪ است.
              </span>
              <span className="font-semibold">
                {liveQuote.approvalStatus === 'approved'
                  ? `تأیید مدیر: ${liveQuote.approvedBy ?? 'مدیر'} (${liveQuote.approvedAt ? formatJalali(liveQuote.approvedAt) : ''})`
                  : liveQuote.approvalStatus === 'rejected'
                    ? 'ردشده توسط مدیر'
                    : 'در انتظار امضای مدیر'}
              </span>
            </div>
          )}

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-900">
                <tr>
                  <th className="px-2.5 py-2 font-medium">ردیف</th>
                  <th className="px-3 py-2 font-medium">شرح کالا / خدمات</th>
                  <th className="px-2.5 py-2 font-medium">واحد</th>
                  <th className="px-2.5 py-2 font-medium">تعداد</th>
                  <th className="px-3 py-2 font-medium">فی واحد</th>
                  <th className="px-2.5 py-2 font-medium">تخفیف ردیف</th>
                  <th className="px-3 py-2 text-left font-medium">مبلغ خالص</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {liveQuote.items.map((item, idx) => {
                  const rowGross = item.qty * item.price;
                  const rowDisc = Math.round((rowGross * (item.discountPct ?? 0)) / 100);
                  const rowNet = Math.max(0, rowGross - rowDisc);
                  return (
                    <tr key={idx}>
                      <td className="px-2.5 py-2.5 tabular-nums text-slate-500">{toFa(idx + 1)}</td>
                      <td className="px-3 py-2.5 font-medium">{item.name}</td>
                      <td className="px-2.5 py-2.5 text-slate-500">{item.unit || 'عدد'}</td>
                      <td className="px-2.5 py-2.5 tabular-nums">{toFa(item.qty)}</td>
                      <td className="px-3 py-2.5 tabular-nums">{formatToman(item.price)}</td>
                      <td className="px-2.5 py-2.5 tabular-nums text-slate-500">
                        {item.discountPct ? `${toFa(item.discountPct)}٪` : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-left font-medium tabular-nums">
                        {formatToman(rowNet)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-5 flex flex-wrap items-start justify-between gap-4 border-t border-slate-200 pt-4 dark:border-slate-800">
            <div className="max-w-sm space-y-2 text-xs text-slate-600 dark:text-slate-400">
              {liveQuote.notes && (
                <div>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">شرایط و توضیحات: </span>
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
                <span className="text-slate-500">جمع ناخالص ردیف‌ها:</span>
                <span>{formatToman(fin.grossSubtotal)}</span>
              </div>
              {fin.totalDiscount > 0 && (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                  <span>جمع تخفیف (مؤثر {toFa(fin.effectiveDiscountPct)}٪):</span>
                  <span>{formatToman(fin.totalDiscount)} −</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">جمع پس از تخفیف:</span>
                <span>{formatToman(fin.netSubtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">مالیات بر ارزش افزوده ({toFa(liveQuote.taxPct)}٪):</span>
                <span>{formatToman(fin.taxAmount)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-1.5 text-sm font-bold dark:border-slate-800">
                <span>جمع نهایی قابل پرداخت:</span>
                <span className="text-indigo-600 dark:text-indigo-400">{formatToman(fin.grandTotal)}</span>
              </div>
            </div>
          </div>

          <div className="mt-8 hidden grid-cols-2 gap-8 border-t border-dashed border-slate-300 pt-6 text-xs text-slate-600 print:grid">
            <div>
              <div className="font-semibold">مهر و امضای فروشنده ({state.settings.businessName})</div>
              <div className="mt-10 border-b border-slate-300" />
            </div>
            <div>
              <div className="font-semibold">تأیید و امضای خریدار ({liveQuote.contactName})</div>
              <div className="mt-10 border-b border-slate-300" />
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
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-rose-300 bg-white px-4 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:bg-slate-900 dark:text-rose-400"
              >
                <XCircle size={14} />
                رد پیش‌فاکتور
              </button>
              <button
                type="button"
                disabled={needsManagerGate}
                onClick={() =>
                  updateQuoteStatus(
                    liveQuote.id,
                    'accepted',
                    clientComment || 'مورد تأیید است، لطفاً فاکتور نهایی صادر شود.',
                  )
                }
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <CheckCircle2 size={14} />
                پذیرش نهایی پیش‌فاکتور توسط مشتری
              </button>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 print:hidden">
          <button
            type="button"
            onClick={onClose}
            className="whitespace-nowrap rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium dark:border-slate-700"
          >
            بستن
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700"
          >
            <Printer size={14} />
            چاپ / ذخیره PDF (A4)
          </button>
        </div>
      </div>
    </Modal>
  );
}
