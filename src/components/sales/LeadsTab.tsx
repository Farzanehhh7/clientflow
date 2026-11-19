import { useMemo, useState } from 'react';
import { ArrowLeftRight, Plus, RefreshCw, Search, Sparkles } from 'lucide-react';
import { useClientFlow } from '../../store/useClientFlowStore';
import type { PackSalesConfig, SalesLead, SalesLeadStatus } from '../../types';
import { computeLeadScoreHint } from '../../utils/crmHelpers';
import { normalizeMobileInput } from '../../utils/csv';
import { formatJalali, formatToman, toFa } from '../../utils/jalali';
import { Modal } from '../Modal';
import { Badge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';

interface LeadsTabProps {
  packSales: PackSalesConfig;
  onConverted?: (pipelineId: string) => void;
}

const LEAD_STATUS_LABEL: Record<SalesLeadStatus, { label: string; tone: 'sky' | 'amber' | 'emerald' | 'neutral' }> = {
  new: { label: 'جدید', tone: 'sky' },
  qualified: { label: 'واجد شرایط', tone: 'amber' },
  converted: { label: 'تبدیل‌شده', tone: 'emerald' },
  disqualified: { label: 'بایگانی / ردشده', tone: 'neutral' },
};

export function LeadsTab({ packSales, onConverted }: LeadsTabProps) {
  const { state, addLead, updateLead, convertLeadToCustomerAndOpportunity } = useClientFlow();

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | SalesLeadStatus>('all');
  const [createOpen, setCreateOpen] = useState(false);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [source, setSource] = useState('اینستاگرام');
  const [estimatedAmount, setEstimatedAmount] = useState('8000000');
  const [score, setScore] = useState('65');
  const [ownerName, setOwnerName] = useState(state.settings.salesTeam[0] ?? 'مریم (فروش)');
  const [useRoundRobin, setUseRoundRobin] = useState(state.settings.autoAssignLeads);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const [convertLead, setConvertLead] = useState<SalesLead | null>(null);
  const [targetPipelineId, setTargetPipelineId] = useState(
    state.pipelines.find((p) => p.isDefault)?.id ?? state.pipelines[0]?.id ?? 'pl_main',
  );
  const [dealTitle, setDealTitle] = useState('');

  const nextRrOwner =
    state.settings.salesTeam[state.settings.roundRobinIndex % Math.max(1, state.settings.salesTeam.length)] ??
    'مریم (فروش)';

  const filteredLeads = useMemo(() => {
    const q = query.trim().toLowerCase();
    return state.leads
      .filter((l) => (statusFilter === 'all' ? true : l.status === statusFilter))
      .filter((l) =>
        q
          ? l.name.toLowerCase().includes(q) ||
            l.phone.includes(q) ||
            (l.companyName ?? '').toLowerCase().includes(q) ||
            l.source.toLowerCase().includes(q)
          : true,
      )
      .sort((a, b) => b.score - a.score);
  }, [state.leads, statusFilter, query]);

  const handleAutoScore = () => {
    const suggested = computeLeadScoreHint({
      source,
      estimatedAmount: Number(estimatedAmount) || 0,
      hasEmail: Boolean(email.trim()),
      hasCompany: Boolean(companyName.trim()),
    });
    setScore(String(suggested));
  };

  const handleCreateLead = (e: React.FormEvent) => {
    e.preventDefault();
    const res = addLead(
      {
        name: name.trim(),
        phone: normalizeMobileInput(phone),
        email: email.trim() || undefined,
        companyName: companyName.trim() || undefined,
        source,
        score: Math.min(100, Math.max(0, Number(score) || 50)),
        estimatedAmount: Math.max(0, Number(estimatedAmount) || 0),
        ownerName,
        status: 'new',
        notes: notes.trim() || undefined,
      },
      useRoundRobin,
    );
    if (!res.ok) {
      setError(res.error ?? 'خطا در ثبت سرنخ');
      return;
    }
    setName('');
    setPhone('');
    setEmail('');
    setCompanyName('');
    setNotes('');
    setError('');
    setCreateOpen(false);
  };

  const handleConvertSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!convertLead) return;
    const res = convertLeadToCustomerAndOpportunity(convertLead.id, {
      pipelineId: targetPipelineId,
      opportunityTitle: dealTitle.trim() || undefined,
    });
    if (res.ok) {
      setConvertLead(null);
      onConverted?.(targetPipelineId);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute right-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`جستجو در ${packSales.leadPlural}...`}
              className="w-56 rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-3 pr-8 text-xs dark:border-slate-700 dark:bg-slate-950"
            />
          </div>

          <select
            aria-label="فیلتر وضعیت سرنخ"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | SalesLeadStatus)}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="all">همه وضعیت‌ها ({toFa(state.leads.length)})</option>
            <option value="new">جدید</option>
            <option value="qualified">واجد شرایط</option>
            <option value="converted">تبدیل‌شده</option>
            <option value="disqualified">بایگانی / ردشده</option>
          </select>
        </div>

        <button
          type="button"
          onClick={() => {
            setError('');
            setCreateOpen(true);
          }}
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-indigo-700"
        >
          <Plus size={14} />
          ثبت {packSales.leadSingular}
        </button>
      </div>

      {filteredLeads.length === 0 ? (
        <EmptyState
          title={`${packSales.leadSingular} یافت نشد`}
          description={`می‌توانید یک ${packSales.leadSingular} جدید با تخصیص دستی یا چرخشی ثبت کنید.`}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="border-b border-slate-200 bg-slate-50/70 text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">نام و اطلاعات تماس</th>
                  <th className="px-4 py-3 font-medium">منبع · تاریخ</th>
                  <th className="px-4 py-3 font-medium">امتیاز (Score)</th>
                  <th className="px-4 py-3 font-medium">برآورد مبلغ</th>
                  <th className="px-4 py-3 font-medium">مسئول و نوع تخصیص</th>
                  <th className="px-4 py-3 font-medium">وضعیت</th>
                  <th className="px-4 py-3 font-medium">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {filteredLeads.map((lead) => {
                  const st = LEAD_STATUS_LABEL[lead.status];
                  return (
                    <tr key={lead.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/20">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">{lead.name}</div>
                        <div className="mt-0.5 text-[11px] tabular-nums text-slate-500">
                          <span dir="ltr">{toFa(lead.phone)}</span>
                          {lead.companyName ? ` · ${lead.companyName}` : ''}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        <div>{lead.source}</div>
                        <div className="mt-0.5 text-[11px] tabular-nums text-slate-400">
                          {formatJalali(lead.createdAt)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 tabular-nums">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                            <div
                              className={`h-full rounded-full ${
                                lead.score >= 75
                                  ? 'bg-emerald-500'
                                  : lead.score >= 50
                                    ? 'bg-amber-500'
                                    : 'bg-slate-400'
                              }`}
                              style={{ width: `${Math.min(100, Math.max(0, lead.score))}%` }}
                            />
                          </div>
                          <span className="font-semibold">{toFa(lead.score)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium tabular-nums">
                        {formatToman(lead.estimatedAmount)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{lead.ownerName}</div>
                        <div className="mt-0.5 text-[11px] text-slate-400">
                          {lead.assignedByRule === 'round_robin' ? 'تخصیص چرخشی (Round-robin)' : 'تخصیص دستی'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={st.tone}>{st.label}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {lead.status !== 'converted' && (
                            <>
                              <select
                                aria-label="تغییر وضعیت سرنخ"
                                value={lead.status}
                                onChange={(e) =>
                                  updateLead(lead.id, { status: e.target.value as SalesLeadStatus })
                                }
                                className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] dark:border-slate-700 dark:bg-slate-900"
                              >
                                <option value="new">جدید</option>
                                <option value="qualified">واجد شرایط</option>
                                <option value="disqualified">بایگانی</option>
                              </select>
                              <button
                                type="button"
                                onClick={() => {
                                  setConvertLead(lead);
                                  setDealTitle(`${packSales.dealSingular}: ${lead.companyName || lead.name}`);
                                }}
                                className="inline-flex items-center gap-1 whitespace-nowrap rounded border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-medium text-indigo-700 hover:bg-indigo-100 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-300"
                              >
                                <ArrowLeftRight size={12} />
                                تبدیل به مشتری و {packSales.dealSingular}
                              </button>
                            </>
                          )}
                          {lead.status === 'converted' && (
                            <span className="text-[11px] text-emerald-600 dark:text-emerald-400">
                              متصل به قیف فروش
                            </span>
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
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title={`ثبت ${packSales.leadSingular} جدید`}>
        <form onSubmit={handleCreateLead} className="space-y-3">
          {error && (
            <div className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
              {error}
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium">نام و نام خانوادگی</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثلاً سروش کریمی"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">شماره موبایل</label>
              <input
                type="text"
                required
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0912..."
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">شرکت / مجموعه (اختیاری)</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">ایمیل (اختیاری)</label>
              <input
                type="email"
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">منبع جذب</label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="اینستاگرام">اینستاگرام</option>
                <option value="سایت">سایت</option>
                <option value="معرفی">معرفی</option>
                <option value="تبلیغات">تبلیغات</option>
                <option value="لندینگ">فرم لندینگ</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">برآورد ارزش (تومان)</label>
              <input
                type="number"
                value={estimatedAmount}
                onChange={(e) => setEstimatedAmount(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>

          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium">امتیاز اولیه سرنخ (۰ تا ۱۰۰)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={score}
                onChange={(e) => setScore(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <button
              type="button"
              onClick={handleAutoScore}
              className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium hover:bg-slate-50 dark:border-slate-700"
            >
              <Sparkles size={13} />
              محاسبه خودکار امتیاز
            </button>
          </div>

          <div className="rounded-lg border border-slate-200 p-3 text-xs dark:border-slate-700">
            <label className="flex cursor-pointer items-center gap-2 font-medium">
              <input
                type="checkbox"
                checked={useRoundRobin}
                onChange={(e) => setUseRoundRobin(e.target.checked)}
                className="h-4 w-4 rounded accent-indigo-600"
              />
              <RefreshCw size={13} className="text-indigo-500" />
              تخصیص چرخشی خودکار (نوبت بعدی: {nextRrOwner})
            </label>
            {!useRoundRobin && (
              <select
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              >
                {state.settings.salesTeam.map((rep) => (
                  <option key={rep} value={rep}>
                    {rep}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium">یادداشت اولیه</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium dark:border-slate-700"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700"
            >
              ثبت سرنخ
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(convertLead)}
        onClose={() => setConvertLead(null)}
        title={`تبدیل سرنخ به مشتری و ${packSales.dealSingular}`}
      >
        {convertLead && (
          <form onSubmit={handleConvertSubmit} className="space-y-3 text-xs">
            <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
              <div className="font-semibold">{convertLead.name}</div>
              <div className="mt-1 text-slate-500">
                مبلغ برآوردی: {formatToman(convertLead.estimatedAmount)} · امتیاز {toFa(convertLead.score)}
              </div>
            </div>
            <div>
              <label className="mb-1 block font-medium">عنوان {packSales.dealSingular}</label>
              <input
                type="text"
                required
                value={dealTitle}
                onChange={(e) => setDealTitle(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block font-medium">قیف فروش مقصد</label>
              <select
                value={targetPipelineId}
                onChange={(e) => setTargetPipelineId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              >
                {state.pipelines.map((pl) => (
                  <option key={pl.id} value={pl.id}>
                    {pl.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConvertLead(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 font-medium dark:border-slate-700"
              >
                انصراف
              </button>
              <button
                type="submit"
                className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700"
              >
                تأیید و تبدیل
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
