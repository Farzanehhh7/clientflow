import { useMemo, useState } from 'react';
import { CopyPlus, Plus, Printer, ShieldAlert, ShieldCheck, Trash2 } from 'lucide-react';
import { useClientFlow } from '../../store/useClientFlowStore';
import type { Opportunity, PackSalesConfig, Quote, QuoteLineItem, QuoteStatus } from '../../types';
import { computeQuoteFinancials } from '../../utils/crmHelpers';
import { formatJalali, formatToman, isoToJalaliInput, jalaliToIsoUtc, toFa } from '../../utils/jalali';
import { Modal } from '../Modal';
import { Badge } from '../ui/Badge';
import { JalaliDatePicker } from '../ui/JalaliDatePicker';

interface QuotesTabProps {
  packSales: PackSalesConfig;
  createModalRequest?: { opp?: Opportunity | null; nonce: number } | null;
  onPreviewQuote: (q: Quote) => void;
}

const QUOTE_STATUS_META: Record<
  QuoteStatus,
  { label: string; tone: 'neutral' | 'sky' | 'emerald' | 'rose' | 'amber' }
> = {
  draft: { label: 'پیش‌نویس', tone: 'neutral' },
  sent: { label: 'ارسال‌شده', tone: 'sky' },
  accepted: { label: 'پذیرفته‌شده', tone: 'emerald' },
  approved: { label: 'تأییدشده', tone: 'emerald' },
  rejected: { label: 'ردشده', tone: 'rose' },
  expired: { label: 'منقضی', tone: 'amber' },
};

export function QuotesTab({ packSales, createModalRequest, onPreviewQuote }: QuotesTabProps) {
  const { state, createQuote, createQuoteVersion, updateQuoteStatus, approveQuoteDiscount } = useClientFlow();

  const [statusFilter, setStatusFilter] = useState<'all' | 'pending_manager' | QuoteStatus>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [lastNonce, setLastNonce] = useState(0);

  const [qOppId, setQOppId] = useState('');
  const [qContactName, setQContactName] = useState('');
  const [qPhone, setQPhone] = useState('');
  const [qPriceListId, setQPriceListId] = useState(state.priceLists[0]?.id ?? '');
  const [qItems, setQItems] = useState<QuoteLineItem[]>([
    { name: 'پکیج خدمات پیشنهادی', unit: 'عدد', qty: 1, price: 5000000, discountPct: 0 },
  ]);
  const [qDiscountPct, setQDiscountPct] = useState('10');
  const [qTaxPct, setQTaxPct] = useState('10');
  const [qValidUntil, setQValidUntil] = useState(() =>
    isoToJalaliInput(new Date(Date.now() + 14 * 24 * 3600_000).toISOString()),
  );
  const [qNotes, setQNotes] = useState('');

  if (createModalRequest && createModalRequest.nonce !== lastNonce) {
    setLastNonce(createModalRequest.nonce);
    const opp = createModalRequest.opp;
    if (opp) {
      setQOppId(opp.id);
      setQContactName(opp.contactName);
      setQPhone(opp.phone);
      setQItems([{ name: opp.title, unit: 'پکیج', qty: 1, price: opp.amount, discountPct: 0 }]);
    } else {
      setQOppId('');
      setQContactName('');
      setQPhone('');
    }
    setCreateOpen(true);
  }

  const catalogOptions = useMemo(() => {
    const prods = state.products.map((p) => ({
      id: p.id,
      name: p.name,
      unit: p.unit || 'عدد',
      price: p.price,
      taxRate: p.taxRate ?? 10,
    }));
    const svcs = state.services.map((s) => ({
      id: s.id,
      name: s.name,
      unit: s.unit || 'جلسه',
      price: s.price,
      taxRate: s.taxRate ?? 10,
    }));
    return [...prods, ...svcs];
  }, [state.products, state.services]);

  const activePriceList = useMemo(
    () => state.priceLists.find((pl) => pl.id === qPriceListId),
    [state.priceLists, qPriceListId],
  );

  const draftFinancials = useMemo(
    () =>
      computeQuoteFinancials({
        items: qItems,
        discountPct: Number(qDiscountPct) || 0,
        taxPct: Number(qTaxPct) || 0,
      }),
    [qItems, qDiscountPct, qTaxPct],
  );

  const filteredQuotes = useMemo(() => {
    return state.quotes.filter((q) => {
      if (statusFilter === 'all') return true;
      if (statusFilter === 'pending_manager') return q.approvalStatus === 'pending_manager';
      if (statusFilter === 'accepted') return q.status === 'accepted' || q.status === 'approved';
      return q.status === statusFilter;
    });
  }, [state.quotes, statusFilter]);

  const applyPriceListToItems = (nextPlId: string) => {
    setQPriceListId(nextPlId);
    const pl = state.priceLists.find((p) => p.id === nextPlId);
    if (!pl) return;
    setQDiscountPct(String(pl.discountPct));
    setQItems((prev) =>
      prev.map((row) => {
        if (!row.productId) return row;
        const override = pl.itemOverrides?.[row.productId];
        const base = catalogOptions.find((c) => c.id === row.productId);
        return {
          ...row,
          price: override ?? base?.price ?? row.price,
        };
      }),
    );
  };

  const addLineFromCatalog = (catalogId: string) => {
    const found = catalogOptions.find((c) => c.id === catalogId);
    if (!found) return;
    const override = activePriceList?.itemOverrides?.[found.id];
    setQItems((prev) => [
      ...prev,
      {
        productId: found.id,
        name: found.name,
        unit: found.unit,
        qty: 1,
        price: override ?? found.price,
        discountPct: 0,
      },
    ]);
  };

  const handleSubmitQuote = (e: React.FormEvent) => {
    e.preventDefault();
    const linkedOpp = state.opportunities.find((o) => o.id === qOppId);
    createQuote({
      opportunityId: linkedOpp?.id,
      customerId: linkedOpp?.customerId,
      contactName: qContactName.trim() || linkedOpp?.contactName || 'مشتری جدید',
      phone: qPhone.trim() || linkedOpp?.phone || '',
      priceListId: activePriceList?.id,
      priceListName: activePriceList?.name,
      items: qItems.filter((it) => it.name.trim() && it.qty > 0),
      discountPct: Math.min(80, Math.max(0, Number(qDiscountPct) || 0)),
      taxPct: Math.max(0, Number(qTaxPct) || 0),
      notes: qNotes.trim() || undefined,
      status: 'draft',
      validUntil: jalaliToIsoUtc(qValidUntil) ?? new Date(Date.now() + 14 * 24 * 3600_000).toISOString(),
    });
    setCreateOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1 text-xs dark:bg-slate-800">
          {(
            [
              ['all', `همه (${toFa(state.quotes.length)})`],
              [
                'pending_manager',
                `نیازمند تأیید مدیر (${toFa(state.quotes.filter((q) => q.approvalStatus === 'pending_manager').length)})`,
              ],
              ['sent', 'ارسال‌شده'],
              ['accepted', 'پذیرفته‌شده'],
              ['expired', 'منقضی'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setStatusFilter(key)}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 font-medium ${
                statusFilter === key
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-indigo-700"
        >
          <Plus size={14} />
          صدور {packSales.quoteLabel}
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="border-b border-slate-200 bg-slate-50/70 text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">شماره / نسخه</th>
                <th className="px-4 py-3 font-medium">مخاطب · لیست قیمت</th>
                <th className="px-4 py-3 font-medium">جمع نهایی · تخفیف</th>
                <th className="px-4 py-3 font-medium">اعتبار تا</th>
                <th className="px-4 py-3 font-medium">وضعیت و قانون تأیید</th>
                <th className="px-4 py-3 font-medium">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filteredQuotes.map((q) => {
                const fin = computeQuoteFinancials(q);
                const meta = QUOTE_STATUS_META[q.status] ?? QUOTE_STATUS_META.draft;
                const pendingMgr = q.approvalStatus === 'pending_manager';
                return (
                  <tr key={q.id}>
                    <td className="px-4 py-3 font-mono font-semibold">
                      {q.quoteNo} · v{toFa(q.version)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold">{q.contactName}</div>
                      <div className="mt-0.5 text-[11px] text-slate-500">
                        {q.priceListName || 'تعرفه استاندارد'} · {toFa(q.items.length)} ردیف
                      </div>
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      <div className="font-semibold text-indigo-600 dark:text-indigo-400">
                        {formatToman(fin.grandTotal)}
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-500">
                        تخفیف مؤثر {toFa(fin.effectiveDiscountPct)}٪ · مالیات {toFa(q.taxPct)}٪
                      </div>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-500">{formatJalali(q.validUntil)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-start gap-1">
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                        {pendingMgr && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                            <ShieldAlert size={12} />
                            تخفیف بالای ۲۰٪ (نیازمند تأیید مدیر)
                          </span>
                        )}
                        {q.approvalStatus === 'approved' && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                            <ShieldCheck size={12} />
                            تخفیف تأییدشده توسط مدیر
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {pendingMgr && state.settings.role === 'admin' && (
                          <button
                            type="button"
                            onClick={() => approveQuoteDiscount(q.id, true)}
                            className="inline-flex items-center gap-1 whitespace-nowrap rounded bg-emerald-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-emerald-700"
                          >
                            <ShieldCheck size={12} />
                            تأیید تخفیف مدیر
                          </button>
                        )}
                        <select
                          aria-label="تغییر وضعیت پیش‌فاکتور"
                          value={q.status === 'approved' ? 'accepted' : q.status}
                          onChange={(e) => updateQuoteStatus(q.id, e.target.value as QuoteStatus)}
                          className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] dark:border-slate-700 dark:bg-slate-900"
                        >
                          <option value="draft">پیش‌نویس</option>
                          <option value="sent">ارسال‌شده</option>
                          <option value="accepted">پذیرفته‌شده</option>
                          <option value="rejected">ردشده</option>
                          <option value="expired">منقضی</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => onPreviewQuote(q)}
                          className="inline-flex items-center gap-1 whitespace-nowrap rounded border border-slate-200 px-2.5 py-1 text-[11px] font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                        >
                          <Printer size={12} />
                          چاپ A4
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            createQuoteVersion(q.id, {
                              discountPct: Math.min(30, q.discountPct + 3),
                              notes: `${q.notes ? `${q.notes} · ` : ''}نسخه بازنگری‌شده v${q.version + 1}`,
                            })
                          }
                          className="inline-flex items-center gap-1 whitespace-nowrap rounded border border-slate-200 px-2.5 py-1 text-[11px] font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                        >
                          <CopyPlus size={12} />
                          نسخه جدید
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={`صدور ${packSales.quoteLabel} جدید (چندردیفی)`}
        maxWidth="2xl"
      >
        <form onSubmit={handleSubmitQuote} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block font-medium">اتصال به {packSales.dealSingular} (اختیاری)</label>
              <select
                value={qOppId}
                onChange={(e) => {
                  const opp = state.opportunities.find((o) => o.id === e.target.value);
                  setQOppId(e.target.value);
                  if (opp) {
                    setQContactName(opp.contactName);
                    setQPhone(opp.phone);
                    setQItems([{ name: opp.title, unit: 'پکیج', qty: 1, price: opp.amount, discountPct: 0 }]);
                  }
                }}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="">— انتخاب دستی مشتری —</option>
                {state.opportunities.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.title} ({o.contactName})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block font-medium">لیست قیمت پایه (Price List)</label>
              <select
                value={qPriceListId}
                onChange={(e) => applyPriceListToItems(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="">— بدون لیست قیمت —</option>
                {state.priceLists
                  .filter((pl) => pl.active)
                  .map((pl) => (
                    <option key={pl.id} value={pl.id}>
                      {pl.name} ({toFa(pl.discountPct)}٪)
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block font-medium">نام مخاطب / خریدار</label>
              <input
                type="text"
                required
                value={qContactName}
                onChange={(e) => setQContactName(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block font-medium">تلفن تماس</label>
              <input
                type="text"
                dir="ltr"
                value={qPhone}
                onChange={(e) => setQPhone(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>

          <div className="space-y-2 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold">ردیف‌های کالا و خدمات</span>
              <div className="flex items-center gap-2">
                <select
                  aria-label="افزودن از کاتالوگ"
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) {
                      addLineFromCatalog(e.target.value);
                      e.target.value = '';
                    }
                  }}
                  className="rounded-lg border border-slate-200 px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="">+ افزودن از کاتالوگ کالا/خدمات...</option>
                  {catalogOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({formatToman(c.price)})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() =>
                    setQItems((prev) => [
                      ...prev,
                      { name: 'آیتم سفارشی', unit: 'عدد', qty: 1, price: 1000000, discountPct: 0 },
                    ])
                  }
                  className="rounded-lg border border-slate-200 px-2.5 py-1.5 font-medium hover:bg-slate-50 dark:border-slate-700"
                >
                  + ردیف آزاد
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {qItems.map((row, idx) => (
                <div key={idx} className="grid grid-cols-12 items-center gap-2">
                  <input
                    type="text"
                    value={row.name}
                    onChange={(e) =>
                      setQItems((prev) => prev.map((r, i) => (i === idx ? { ...r, name: e.target.value } : r)))
                    }
                    placeholder="شرح"
                    className="col-span-4 rounded border border-slate-200 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-800"
                  />
                  <input
                    type="text"
                    value={row.unit || 'عدد'}
                    onChange={(e) =>
                      setQItems((prev) => prev.map((r, i) => (i === idx ? { ...r, unit: e.target.value } : r)))
                    }
                    placeholder="واحد"
                    className="col-span-2 rounded border border-slate-200 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-800"
                  />
                  <input
                    type="number"
                    min={1}
                    value={row.qty}
                    onChange={(e) =>
                      setQItems((prev) =>
                        prev.map((r, i) => (i === idx ? { ...r, qty: Math.max(1, Number(e.target.value) || 1) } : r)),
                      )
                    }
                    placeholder="تعداد"
                    className="col-span-1 rounded border border-slate-200 px-2 py-1.5 tabular-nums dark:border-slate-700 dark:bg-slate-800"
                  />
                  <input
                    type="number"
                    min={0}
                    value={row.price}
                    onChange={(e) =>
                      setQItems((prev) =>
                        prev.map((r, i) => (i === idx ? { ...r, price: Math.max(0, Number(e.target.value) || 0) } : r)),
                      )
                    }
                    placeholder="فی"
                    className="col-span-2 rounded border border-slate-200 px-2 py-1.5 tabular-nums dark:border-slate-700 dark:bg-slate-800"
                  />
                  <input
                    type="number"
                    min={0}
                    max={80}
                    value={row.discountPct ?? 0}
                    onChange={(e) =>
                      setQItems((prev) =>
                        prev.map((r, i) =>
                          i === idx ? { ...r, discountPct: Math.min(80, Math.max(0, Number(e.target.value) || 0)) } : r,
                        ),
                      )
                    }
                    placeholder="تخفیف٪"
                    className="col-span-2 rounded border border-slate-200 px-2 py-1.5 tabular-nums dark:border-slate-700 dark:bg-slate-800"
                  />
                  <button
                    type="button"
                    disabled={qItems.length <= 1}
                    onClick={() => setQItems((prev) => prev.filter((_, i) => i !== idx))}
                    className="col-span-1 flex justify-center text-rose-500 disabled:opacity-30"
                    aria-label="حذف ردیف"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block font-medium">تخفیف کلی (٪)</label>
              <input
                type="number"
                min={0}
                max={80}
                value={qDiscountPct}
                onChange={(e) => setQDiscountPct(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 tabular-nums dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block font-medium">مالیات (٪)</label>
              <input
                type="number"
                min={0}
                max={30}
                value={qTaxPct}
                onChange={(e) => setQTaxPct(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 tabular-nums dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <JalaliDatePicker label="اعتبار تا تاریخ" value={qValidUntil} onChange={setQValidUntil} />
          </div>

          {draftFinancials.requiresManagerApproval && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
              <ShieldAlert size={15} />
              تخفیف مؤثر ({toFa(draftFinancials.effectiveDiscountPct)}٪) بالای ۲۰٪ است؛ این پیش‌فاکتور پس از ثبت در حالت «در انتظار تأیید مدیر» قرار می‌گیرد.
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2.5 tabular-nums dark:bg-slate-800/50">
            <span>جمع ناخالص: {formatToman(draftFinancials.grossSubtotal)}</span>
            <span>تخفیف: {formatToman(draftFinancials.totalDiscount)}</span>
            <span>مالیات: {formatToman(draftFinancials.taxAmount)}</span>
            <span className="font-bold text-indigo-600 dark:text-indigo-400">
              نهایی: {formatToman(draftFinancials.grandTotal)}
            </span>
          </div>

          <div>
            <label className="mb-1 block font-medium">شرایط پرداخت و توضیحات</label>
            <textarea
              rows={2}
              value={qNotes}
              onChange={(e) => setQNotes(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 font-medium dark:border-slate-700"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700"
            >
              ثبت پیش‌فاکتور
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
