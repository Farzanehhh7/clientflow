import { useMemo, useState } from 'react';
import { Plus, UserPlus } from 'lucide-react';
import { Modal } from '../components/Modal';
import { useClientFlow } from '../store/useClientFlowStore';
import type { PipelineStage } from '../types';
import { normalizeMobileInput } from '../utils/csv';
import { formatToman, toFa } from '../utils/jalali';

const STAGES: { key: PipelineStage; label: string }[] = [
  { key: 'lead', label: 'سرنخ جدید' },
  { key: 'contacted', label: 'تماس اولیه' },
  { key: 'proposal', label: 'ارسال پیش‌فاکتور' },
  { key: 'negotiation', label: 'مذاکره' },
  { key: 'won', label: 'برنده‌شده' },
  { key: 'lost', label: 'ازدست‌رفته' },
];

export function SalesPage() {
  const { state, addOpportunity, moveOpportunityStage, convertOpportunityToCustomer } = useClientFlow();
  const [createOpen, setCreateOpen] = useState(false);

  const [title, setTitle] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [source, setSource] = useState('اینستاگرام');
  const [amount, setAmount] = useState('5000000');
  const [ownerName, setOwnerName] = useState('مریم (فروش)');
  const [error, setError] = useState('');

  const summary = useMemo(() => {
    const activeOpps = state.opportunities.filter((o) => o.stage !== 'won' && o.stage !== 'lost');
    const wonOpps = state.opportunities.filter((o) => o.stage === 'won');
    const pipelineValue = activeOpps.reduce((s, o) => s + o.amount, 0);
    const wonValue = wonOpps.reduce((s, o) => s + o.amount, 0);
    const commissionTotal = Math.round((wonValue * state.settings.commissionPct) / 100);
    return {
      activeCount: activeOpps.length,
      pipelineValue,
      wonValue,
      commissionTotal,
    };
  }, [state.opportunities, state.settings.commissionPct]);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const res = addOpportunity({
      title: title.trim(),
      contactName: contactName.trim(),
      phone: normalizeMobileInput(phone),
      source,
      stage: 'lead',
      amount: Math.max(0, Number(amount) || 0),
      probability: 20,
      ownerName,
    });
    if (!res.ok) {
      setError(res.error ?? 'خطا در ثبت سرنخ');
      return;
    }
    setTitle('');
    setContactName('');
    setPhone('');
    setError('');
    setCreateOpen(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          مدیریت سرنخ‌ها، قیف فروش (Kanban)، تبدیل خودکار به مشتری و محاسبه پورسانت ({toFa(state.settings.commissionPct)}٪)
        </p>
        <button
          type="button"
          onClick={() => {
            setError('');
            setCreateOpen(true);
          }}
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700"
        >
          <Plus size={16} />
          سرنخ / فرصت جدید
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs text-slate-500 dark:text-slate-400">فرصت‌های باز در قیف</div>
          <div className="mt-1.5 text-xl font-bold tabular-nums">{toFa(summary.activeCount)}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs text-slate-500 dark:text-slate-400">ارزش کل قیف فعال</div>
          <div className="mt-1.5 text-xl font-bold tabular-nums text-indigo-600 dark:text-indigo-400">
            {formatToman(summary.pipelineValue)}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs text-slate-500 dark:text-slate-400">فروش نهایی (برنده‌شده)</div>
          <div className="mt-1.5 text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
            {formatToman(summary.wonValue)}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs text-slate-500 dark:text-slate-400">پورسانت محاسبه‌شده</div>
          <div className="mt-1.5 text-xl font-bold tabular-nums">{formatToman(summary.commissionTotal)}</div>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
        {STAGES.map((stage) => {
          const cards = state.opportunities.filter((o) => o.stage === stage.key);
          const stageSum = cards.reduce((s, c) => s + c.amount, 0);
          return (
            <div
              key={stage.key}
              className="flex min-h-[340px] flex-col rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="border-b border-slate-200 px-3 py-2.5 dark:border-slate-800">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span>{stage.label}</span>
                  <span className="tabular-nums text-slate-500">{toFa(cards.length)}</span>
                </div>
                <div className="mt-0.5 text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
                  {formatToman(stageSum)}
                </div>
              </div>

              <div className="flex-1 space-y-2.5 p-2.5">
                {cards.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">خالی</div>
                ) : (
                  cards.map((opp) => (
                    <div
                      key={opp.id}
                      className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/70 p-2.5 text-xs dark:border-slate-800 dark:bg-slate-800/40"
                    >
                      <div className="font-semibold text-slate-900 dark:text-slate-100">{opp.title}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {opp.contactName} · {opp.source}
                      </div>
                      <div className="flex items-center justify-between text-[11px] font-medium tabular-nums">
                        <span className="text-indigo-600 dark:text-indigo-400">{formatToman(opp.amount)}</span>
                        <span className="text-slate-500">احتمال {toFa(opp.probability)}٪</span>
                      </div>

                      <select
                        aria-label="تغییر مرحله فرصت"
                        value={opp.stage}
                        onChange={(e) => moveOpportunityStage(opp.id, e.target.value as PipelineStage)}
                        className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-[11px] dark:border-slate-700 dark:bg-slate-900"
                      >
                        {STAGES.map((st) => (
                          <option key={st.key} value={st.key}>
                            {st.label}
                          </option>
                        ))}
                      </select>

                      {!opp.customerId && (
                        <button
                          type="button"
                          onClick={() => convertOpportunityToCustomer(opp.id)}
                          className="flex w-full items-center justify-center gap-1 rounded border border-slate-200 bg-white py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          <UserPlus size={12} />
                          تبدیل به مشتری
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="ثبت سرنخ / فرصت فروش جدید" maxWidth="md">
        <form onSubmit={handleCreate} className="space-y-4">
          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
              {error}
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">عنوان فرصت *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثلاً: پکیج کامل مراقبت پوست"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">نام مخاطب *</label>
              <input
                type="text"
                required
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">موبایل *</label>
              <input
                type="tel"
                required
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="09120000000"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm tabular-nums dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">ارزش برآوردی (تومان)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm tabular-nums dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">منبع</label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="اینستاگرام">اینستاگرام</option>
                <option value="سایت">سایت</option>
                <option value="معرفی">معرفی</option>
                <option value="تبلیغات">تبلیغات</option>
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">کارشناس مسئول</label>
            <input
              type="text"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm dark:border-slate-700"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              ثبت فرصت
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
