import { useMemo, useState } from 'react';
import { FileText, Plus, RefreshCw } from 'lucide-react';
import { DynamicFieldsRenderer } from '../components/DynamicFieldsRenderer';
import { Modal } from '../components/Modal';
import { QuotePreviewModal } from '../components/QuotePreviewModal';
import { CatalogPriceListsTab } from '../components/sales/CatalogPriceListsTab';
import { LeadsTab } from '../components/sales/LeadsTab';
import { PipelineKanbanTab } from '../components/sales/PipelineKanbanTab';
import { PipelineSettingsTab } from '../components/sales/PipelineSettingsTab';
import { QuotesTab } from '../components/sales/QuotesTab';
import { TargetsCommissionsTab } from '../components/sales/TargetsCommissionsTab';
import { JalaliDatePicker } from '../components/ui/JalaliDatePicker';
import { getPackSalesConfig } from '../data/packs';
import { useClientFlow } from '../store/useClientFlowStore';
import type { Opportunity, Quote } from '../types';
import { computeCommissionAmount } from '../utils/crmHelpers';
import { normalizeMobileInput } from '../utils/csv';
import { getFieldsForEntity, validateCustomFieldValues } from '../utils/customFieldValidation';
import { formatToman, isoToJalaliInput, jalaliToIsoUtc, toFa } from '../utils/jalali';

type SalesTabKey = 'leads' | 'kanban' | 'catalog' | 'quotes' | 'targets' | 'settings';

export function SalesPage() {
  const { state, addOpportunity } = useClientFlow();

  const packSales = useMemo(
    () => getPackSalesConfig(state.settings.industryPack, state.customPacks),
    [state.settings.industryPack, state.customPacks],
  );

  const defaultPipelineId =
    state.pipelines.find((p) => p.isDefault)?.id ?? state.pipelines[0]?.id ?? 'pl_main';

  const [tab, setTab] = useState<SalesTabKey>('kanban');
  const [selectedPipelineId, setSelectedPipelineId] = useState(defaultPipelineId);
  const [previewQuote, setPreviewQuote] = useState<Quote | null>(null);
  const [quoteCreateReq, setQuoteCreateReq] = useState<{ opp?: Opportunity | null; nonce: number } | null>(null);

  // Create Opportunity Modal
  const [createOppOpen, setCreateOppOpen] = useState(false);
  const [oppPipelineId, setOppPipelineId] = useState(defaultPipelineId);
  const [title, setTitle] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [source, setSource] = useState('اینستاگرام');
  const [amount, setAmount] = useState('5000000');
  const [expectedCloseJalali, setExpectedCloseJalali] = useState(() =>
    isoToJalaliInput(new Date(Date.now() + 14 * 24 * 3600_000).toISOString()),
  );
  const [ownerName, setOwnerName] = useState(state.settings.salesTeam[0] ?? 'مریم (فروش)');
  const [useRoundRobin, setUseRoundRobin] = useState(state.settings.autoAssignLeads);
  const [oppCustomFields, setOppCustomFields] = useState<Record<string, string>>({});
  const [oppCustomErrors, setOppCustomErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');

  const nextRoundRobinOwner =
    state.settings.salesTeam[state.settings.roundRobinIndex % Math.max(1, state.settings.salesTeam.length)] ??
    'مریم (فروش)';

  const oppActiveFields = useMemo(
    () => getFieldsForEntity(state.customFieldDefs, 'opportunity', false),
    [state.customFieldDefs],
  );

  const summary = useMemo(() => {
    const activeOpps = state.opportunities.filter((o) => o.stage !== 'won' && o.stage !== 'lost');
    const wonOpps = state.opportunities.filter((o) => o.stage === 'won');
    const pipelineValue = activeOpps.reduce((s, o) => s + o.amount, 0);
    const weightedForecast = activeOpps.reduce(
      (s, o) => s + Math.round((o.amount * o.probability) / 100),
      0,
    );
    const wonValue = wonOpps.reduce((s, o) => s + o.amount, 0);
    const comm = computeCommissionAmount(wonValue, state.commissionTiers, state.commissionRule);
    return {
      activeCount: activeOpps.length,
      pipelineValue,
      weightedForecast,
      wonValue,
      commissionTotal: comm.total,
    };
  }, [state.opportunities, state.commissionTiers, state.commissionRule]);

  const handleCreateOpp = (e: React.FormEvent) => {
    e.preventDefault();
    setOppCustomErrors({});
    const cfValidation = validateCustomFieldValues(state.customFieldDefs, oppCustomFields, {
      entity: 'opportunity',
      existingRecords: state.opportunities,
    });
    if (!cfValidation.ok) {
      setOppCustomErrors(cfValidation.errors);
      return;
    }

    const res = addOpportunity(
      {
        pipelineId: oppPipelineId,
        title: title.trim(),
        contactName: contactName.trim(),
        phone: normalizeMobileInput(phone),
        source,
        stage: 'lead',
        amount: Math.max(0, Number(amount) || 0),
        probability: 20,
        expectedCloseDate:
          jalaliToIsoUtc(expectedCloseJalali) ?? new Date(Date.now() + 14 * 24 * 3600_000).toISOString(),
        ownerName,
        customFields: oppCustomFields,
      },
      useRoundRobin,
    );
    if (!res.ok) {
      setError(res.error ?? 'خطا در ثبت فرصت فروش');
      return;
    }
    setTitle('');
    setContactName('');
    setPhone('');
    setOppCustomFields({});
    setError('');
    setCreateOppOpen(false);
  };

  const tabs: readonly [SalesTabKey, string][] = [
    ['leads', `${packSales.leadPlural} (${toFa(state.leads.length)})`],
    ['kanban', `${packSales.pipelineName} (${toFa(state.opportunities.length)})`],
    ['catalog', 'کاتالوگ و لیست قیمت'],
    ['quotes', `${packSales.quoteLabel} (${toFa(state.quotes.length)})`],
    ['targets', 'تارگت و دفتر پورسانت'],
    ['settings', 'تنظیمات قیف و تیم'],
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-900">
          {tabs.map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                tab === key
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setTab('quotes');
              setQuoteCreateReq({ opp: null, nonce: Date.now() });
            }}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <FileText size={15} />
            صدور {packSales.quoteLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              setError('');
              setOppCustomFields({});
              setOppCustomErrors({});
              setOppPipelineId(selectedPipelineId);
              setCreateOppOpen(true);
            }}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700"
          >
            <Plus size={16} />
            {packSales.dealSingular} جدید
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs text-slate-500 dark:text-slate-400">{packSales.dealPlural} باز</div>
          <div className="mt-1.5 text-xl font-bold tabular-nums">{toFa(summary.activeCount)}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs text-slate-500 dark:text-slate-400">پیش‌بینی وزنی قیف فعال</div>
          <div className="mt-1.5 text-xl font-bold tabular-nums text-indigo-600 dark:text-indigo-400">
            {formatToman(summary.weightedForecast)}
          </div>
          <div className="mt-0.5 text-[11px] tabular-nums text-slate-400">
            ارزش ناخالص: {formatToman(summary.pipelineValue)}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs text-slate-500 dark:text-slate-400">فروش نهایی (برنده‌شده)</div>
          <div className="mt-1.5 text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
            {formatToman(summary.wonValue)}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs text-slate-500 dark:text-slate-400">پورسانت کل دوره</div>
          <div className="mt-1.5 text-xl font-bold tabular-nums">{formatToman(summary.commissionTotal)}</div>
        </div>
      </div>

      {tab === 'leads' && (
        <LeadsTab
          packSales={packSales}
          onConverted={(plId) => {
            setSelectedPipelineId(plId);
            setTab('kanban');
          }}
        />
      )}

      {tab === 'kanban' && (
        <PipelineKanbanTab
          packSales={packSales}
          selectedPipelineId={selectedPipelineId}
          onSelectPipeline={setSelectedPipelineId}
          onCreateQuoteForOpp={(opp) => {
            setTab('quotes');
            setQuoteCreateReq({ opp, nonce: Date.now() });
          }}
        />
      )}

      {tab === 'catalog' && <CatalogPriceListsTab />}

      {tab === 'quotes' && (
        <QuotesTab
          packSales={packSales}
          createModalRequest={quoteCreateReq}
          onPreviewQuote={(q) => setPreviewQuote(q)}
        />
      )}

      {tab === 'targets' && <TargetsCommissionsTab packSales={packSales} />}

      {tab === 'settings' && <PipelineSettingsTab packSales={packSales} />}

      <Modal
        open={createOppOpen}
        onClose={() => setCreateOppOpen(false)}
        title={`ثبت ${packSales.dealSingular} جدید`}
      >
        <form onSubmit={handleCreateOpp} className="space-y-3">
          {error && (
            <div className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
              {error}
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs font-medium">قیف فروش</label>
            <select
              value={oppPipelineId}
              onChange={(e) => setOppPipelineId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
            >
              {state.pipelines.map((pl) => (
                <option key={pl.id} value={pl.id}>
                  {pl.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">عنوان {packSales.dealSingular}</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={`مثلاً ${packSales.dealSingular} جدید`}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium">نام مخاطب / مشتری</label>
              <input
                type="text"
                required
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
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
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium">ارزش برآوردی (تومان)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
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
              </select>
            </div>
          </div>

          <JalaliDatePicker
            label="تاریخ پیش‌بینی بستن معامله"
            value={expectedCloseJalali}
            onChange={setExpectedCloseJalali}
          />

          <div className="rounded-lg border border-slate-200 p-3 text-xs dark:border-slate-700">
            <label className="flex cursor-pointer items-center gap-2 font-medium">
              <input
                type="checkbox"
                checked={useRoundRobin}
                onChange={(e) => setUseRoundRobin(e.target.checked)}
                className="h-4 w-4 rounded accent-indigo-600"
              />
              <RefreshCw size={13} className="text-indigo-500" />
              تخصیص چرخشی خودکار (Round-robin · نوبت بعدی: {nextRoundRobinOwner})
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

          {oppActiveFields.length > 0 && (
            <DynamicFieldsRenderer
              defs={state.customFieldDefs}
              entity="opportunity"
              values={oppCustomFields}
              errors={oppCustomErrors}
              onChange={setOppCustomFields}
            />
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setCreateOppOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium dark:border-slate-700"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700"
            >
              ثبت در قیف
            </button>
          </div>
        </form>
      </Modal>

      <QuotePreviewModal quote={previewQuote} onClose={() => setPreviewQuote(null)} />
    </div>
  );
}
