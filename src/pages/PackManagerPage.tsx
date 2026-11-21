import { useMemo, useState } from 'react';
import {
  BarChart3,
  CheckCircle2,
  Database,
  Download,
  Eye,
  GitBranch,
  Layers,
  MessageSquareText,
  Package,
  PackagePlus,
  Search,
  Settings2,
  Sparkles,
  Upload,
  Zap,
} from 'lucide-react';
import { Modal } from '../components/Modal';
import { IndustryPackDiffModal } from '../components/settings/IndustryPackDiffModal';
import {
  ALL_CRM_MODULE_KEYS,
  CRM_MODULE_LABELS,
  INDUSTRY_PACKS,
  PHASE13_TARGET_KEYS,
  buildPackFromState,
  getPackCustomerConfig,
  getPackEnabledModules,
  getPackKpiDefs,
  getPackOrderConfig,
  getPackSalesConfig,
} from '../data/packs';
import { useClientFlow } from '../store/useClientFlowStore';
import type { IndustryPack, PackTemplate } from '../types';
import { formatToman, toFa } from '../utils/jalali';
import { computePackSwitchDiff } from '../utils/packDiff';

type PreviewTab = 'terminology' | 'fields_kpis' | 'automation_templates' | 'reports_sample';
type LibraryFilter = 'all' | 'phase13' | 'custom' | 'healthcare' | 'commerce' | 'services' | 'hospitality' | 'b2b' | 'education';

const TIER_LABEL: Record<PackTemplate['tier'], string> = {
  full: 'پک کامل',
  medium: 'پک متوسط',
  light: 'پک سبک',
};

const CATEGORY_LABEL: Record<NonNullable<PackTemplate['category']>, string> = {
  healthcare: 'سلامت و درمان',
  commerce: 'فروش و بازرگانی',
  services: 'خدمات و مشاوره',
  hospitality: 'هتل، غذا و گردشگری',
  b2b: 'شرکتی و B2B',
  education: 'آموزش و مدرسه',
};

export function PackManagerPage() {
  const { state, applyIndustryPack, saveCustomPack, importCustomPack, pushToast } = useClientFlow();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<LibraryFilter>('all');
  const [previewPack, setPreviewPack] = useState<PackTemplate | null>(null);
  const [previewTab, setPreviewTab] = useState<PreviewTab>('terminology');
  const [pendingInstallKey, setPendingInstallKey] = useState<IndustryPack | null>(null);

  // Export current setup as new pack modal
  const [exportOpen, setExportOpen] = useState(false);
  const [expName, setExpName] = useState('');
  const [expKey, setExpKey] = useState('');
  const [expTier, setExpTier] = useState<PackTemplate['tier']>('full');
  const [expDesc, setExpDesc] = useState('');

  const allPacks = useMemo(() => {
    const custom = state.customPacks ?? [];
    return [...custom, ...INDUSTRY_PACKS];
  }, [state.customPacks]);

  const activePack = useMemo(
    () => allPacks.find((p) => p.key === state.settings.industryPack) ?? INDUSTRY_PACKS[0],
    [allPacks, state.settings.industryPack],
  );

  const filteredPacks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allPacks.filter((p) => {
      if (filter === 'phase13' && !PHASE13_TARGET_KEYS.includes(p.key as IndustryPack)) return false;
      if (filter === 'custom' && !p.isCustom) return false;
      if (
        filter !== 'all' &&
        filter !== 'phase13' &&
        filter !== 'custom' &&
        p.category !== filter
      ) {
        return false;
      }
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.nameEn.toLowerCase().includes(q) ||
        p.key.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
      );
    });
  }, [allPacks, filter, search]);

  const liveExportPreviewPack = useMemo(
    () =>
      buildPackFromState(state, {
        key: expKey || 'custom_tenant_pack',
        name: expName || `${state.settings.businessName} Pack`,
        description: expDesc || 'پک استخراج‌شده از پیکربندی فعلی فضای کاری',
        tier: expTier,
      }),
    [state, expKey, expName, expDesc, expTier],
  );

  const downloadPackJson = (pack: PackTemplate) => {
    const json = JSON.stringify(pack, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clientflow-pack-${pack.key}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJsonFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as PackTemplate;
      if (!parsed.key || !parsed.name || !Array.isArray(parsed.customFields)) {
        pushToast('ساختار فایل JSON پک معتبر نیست.', 'error');
      } else {
        importCustomPack(parsed);
      }
    } catch {
      pushToast('خطا در خواندن فایل JSON پک.', 'error');
    }
    e.target.value = '';
  };

  const handleCreateExportPack = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expName.trim()) {
      pushToast('لطفاً نام پک جدید را وارد کنید.', 'error');
      return;
    }
    const created = saveCustomPack({
      name: expName.trim(),
      key: expKey.trim() || `custom_${Date.now().toString(36)}`,
      description: expDesc.trim() || `پک استخراج‌شده از تنظیمات فعلی ${state.settings.businessName}`,
      tier: expTier,
    });
    downloadPackJson(created);
    setExpName('');
    setExpKey('');
    setExpDesc('');
    setExportOpen(false);
  };

  const openPreview = (pack: PackTemplate) => {
    setPreviewPack(pack);
    setPreviewTab('terminology');
  };

  const previewMeta = useMemo(() => {
    if (!previewPack) return null;
    const key = previewPack.key as IndustryPack;
    return {
      customerMeta:
        previewPack.customerMeta ??
        getPackCustomerConfig(key, state.customFieldDefs, state.customPacks),
      salesMeta: previewPack.salesMeta ?? getPackSalesConfig(key, state.customPacks),
      orderMeta: previewPack.orderMeta ?? getPackOrderConfig(key, state.customPacks),
      enabledModules:
        previewPack.enabledModules && previewPack.enabledModules.length > 0
          ? previewPack.enabledModules
          : getPackEnabledModules(key, state.customPacks),
      kpis:
        previewPack.kpiDefs && previewPack.kpiDefs.length > 0
          ? previewPack.kpiDefs
          : getPackKpiDefs(key, state.customPacks),
    };
  }, [previewPack, state.customFieldDefs, state.customPacks]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-900">
        <div>
          <h1 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-100">
            <Layers size={18} className="text-indigo-600 dark:text-indigo-400" />
            مدیریت و کتابخانه پک‌های صنعت (Pack Manager)
          </h1>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            پیکربندی کامل صنایع بدون شاخه‌بندی کد صفحات · پک فعال کنونی:{' '}
            <span className="font-semibold text-indigo-600 dark:text-indigo-400">{activePack.name}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap shrink-0">
            <Upload size={14} />
            ورود پک JSON
            <input type="file" accept=".json,application/json" onChange={handleImportJsonFile} className="hidden" />
          </label>
          <button
            type="button"
            onClick={() => setExportOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-indigo-700 whitespace-nowrap shrink-0"
          >
            <PackagePlus size={14} />
            خروجی تنظیمات فعلی به عنوان پک جدید
          </button>
        </div>
      </div>

      {/* Filter and search toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
        <div className="relative min-w-[240px] flex-1 max-w-md">
          <Search size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جستجوی پک صنعت (مثلاً رستوران، خودرو، حقوقی، هتل...)"
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pr-9 pl-3 text-xs focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {(
            [
              ['all', `همه (${toFa(allPacks.length)})`],
              ['phase13', 'پک‌های تخصصی کامل (۱۰)'],
              ['custom', `سفارشی (${toFa((state.customPacks ?? []).length)})`],
              ['hospitality', 'هتل، رستوران و سفر'],
              ['services', 'خدمات، املاک و باشگاه'],
              ['commerce', 'فروش و پخش'],
              ['healthcare', 'سلامت و دارو'],
              ['b2b', 'حقوقی و B2B'],
              ['education', 'آموزش و مدرسه'],
            ] as [LibraryFilter, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`rounded-lg px-2.5 py-1.5 font-medium transition-colors whitespace-nowrap ${
                filter === key
                  ? 'bg-indigo-600 text-white'
                  : 'border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Pack grid */}
      {filteredPacks.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
            هیچ پک صنعتی مطابق فیلتر جستجو یافت نشد.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setFilter('all');
            }}
            className="mt-3 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-slate-50 dark:border-slate-700 dark:text-indigo-400"
          >
            نمایش تمام پک‌ها
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredPacks.map((pk) => {
            const isActive = state.settings.industryPack === pk.key;
            const rulesCount = pk.rules?.length ?? 0;
            const wfCount = pk.workflowTemplates?.length ?? 0;
            const tplCount = pk.messageTemplates?.length ?? 0;
            const rptCount = pk.defaultReports?.length ?? 0;
            const sampleCount =
              (pk.sampleData?.customers?.length ?? 0) +
              (pk.sampleData?.orders?.length ?? 0) +
              (pk.sampleData?.appointments?.length ?? 0);

            return (
              <div
                key={pk.id}
                className={`flex flex-col justify-between rounded-xl border bg-white p-4 transition-colors dark:bg-slate-900 ${
                  isActive
                    ? 'border-indigo-600 dark:border-indigo-500'
                    : 'border-slate-200 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">{pk.name}</h2>
                      <div dir="ltr" className="mt-0.5 text-right font-mono text-[11px] text-slate-400">
                        {pk.nameEn} · {pk.key}
                      </div>
                    </div>
                    <span
                      className={`shrink-0 text-[11px] font-semibold ${
                        isActive
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {isActive ? 'فعال' : TIER_LABEL[pk.tier]}
                    </span>
                  </div>

                  <p className="mt-2.5 text-xs leading-5 text-slate-600 dark:text-slate-300">
                    {pk.description}
                  </p>

                  <div className="mt-3 border-t border-slate-100 pt-2.5 text-[11px] text-slate-500 tabular-nums dark:border-slate-800 dark:text-slate-400">
                    <span>{toFa(pk.customFields.length)} فیلد</span>
                    <span className="mx-1.5">·</span>
                    <span>{toFa(rulesCount)} قانون</span>
                    <span className="mx-1.5">·</span>
                    <span>{toFa(wfCount)} گردش‌کار</span>
                    <span className="mx-1.5">·</span>
                    <span>{toFa(tplCount)} قالب پیام</span>
                    <span className="mx-1.5">·</span>
                    <span>{toFa(rptCount)} گزارش</span>
                    {sampleCount > 0 && (
                      <>
                        <span className="mx-1.5">·</span>
                        <span>{toFa(sampleCount)} نمونه</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="mt-3.5 flex items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => openPreview(pk)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <Eye size={13} />
                    پیش‌نمایش
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingInstallKey(pk.key as IndustryPack)}
                    className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-colors ${
                      isActive
                        ? 'bg-emerald-600 hover:bg-emerald-700'
                        : 'bg-indigo-600 hover:bg-indigo-700'
                    }`}
                  >
                    {isActive ? 'به‌روزرسانی / نصب مجدد' : 'نصب و سوئیچ پک'}
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadPackJson(pk)}
                    title="دانلود JSON پک"
                    aria-label="دانلود JSON پک"
                    className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 hover:text-slate-700 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
                  >
                    <Download size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Custom exported / imported packs library table */}
      {(state.customPacks ?? []).length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              پک‌های سفارشی ساخته‌شده یا واردشده ({toFa(state.customPacks.length)})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-2.5 font-medium">نام پک</th>
                  <th className="px-4 py-2.5 font-medium">کلید</th>
                  <th className="px-4 py-2.5 font-medium">فیلد / موجودیت</th>
                  <th className="px-4 py-2.5 font-medium">قوانین / قالب پیام / گزارش</th>
                  <th className="px-4 py-2.5 font-medium text-left">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 tabular-nums">
                {state.customPacks.map((cp) => (
                  <tr key={cp.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                    <td className="px-4 py-2.5 font-semibold text-slate-900 dark:text-slate-100">{cp.name}</td>
                    <td dir="ltr" className="px-4 py-2.5 text-right font-mono text-slate-500">
                      {cp.key}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">
                      {toFa(cp.customFields.length)} فیلد · {toFa(cp.customEntities.length)} موجودیت
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">
                      {toFa(cp.rules.length)} قانون · {toFa(cp.messageTemplates?.length ?? 0)} پیام ·{' '}
                      {toFa(cp.defaultReports?.length ?? 0)} گزارش
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openPreview(cp)}
                          className="rounded border border-slate-200 px-2.5 py-1 text-[11px] hover:bg-slate-50 dark:border-slate-700"
                        >
                          مشاهده
                        </button>
                        <button
                          type="button"
                          onClick={() => downloadPackJson(cp)}
                          className="rounded border border-slate-200 px-2.5 py-1 text-[11px] hover:bg-slate-50 dark:border-slate-700"
                        >
                          JSON
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingInstallKey(cp.key as IndustryPack)}
                          className="rounded bg-indigo-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-indigo-700"
                        >
                          نصب
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pack Preview Modal */}
      <Modal
        open={Boolean(previewPack)}
        onClose={() => setPreviewPack(null)}
        title={previewPack ? `پیش‌نمایش پک: ${previewPack.name}` : 'پیش‌نمایش پک'}
        maxWidth="2xl"
      >
        {previewPack && previewMeta && (
          <div className="space-y-4 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
              <div>
                <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {previewPack.name}{' '}
                  <span dir="ltr" className="font-mono text-xs font-normal text-slate-400">
                    ({previewPack.key})
                  </span>
                </div>
                <p className="mt-1 text-slate-500 dark:text-slate-400">{previewPack.description}</p>
              </div>
              {previewPack.category && (
                <span className="text-[11px] font-medium text-slate-500">
                  دسته: {CATEGORY_LABEL[previewPack.category]} · {TIER_LABEL[previewPack.tier]}
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5 border-b border-slate-200 pb-2.5 dark:border-slate-800">
              {(
                [
                  ['terminology', 'اصطلاحات، ماژول‌ها و جریان سفارش', Settings2],
                  ['fields_kpis', `فیلدها (${toFa(previewPack.customFields.length)}) و KPIها`, Database],
                  ['automation_templates', `قوانین (${toFa(previewPack.rules.length)}) و پیام‌ها`, Zap],
                  ['reports_sample', `گزارش‌ها (${toFa(previewPack.defaultReports?.length ?? 0)}) و نمونه داده`, BarChart3],
                ] as const
              ).map(([tKey, label, Icon]) => (
                <button
                  key={tKey}
                  type="button"
                  onClick={() => setPreviewTab(tKey)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium ${
                    previewTab === tKey
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  <Icon size={13} />
                  {label}
                </button>
              ))}
            </div>

            {previewTab === 'terminology' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-slate-200 p-3.5 dark:border-slate-800">
                    <div className="font-semibold text-slate-800 dark:text-slate-100">واژگان تخصصی صنعت</div>
                    <dl className="mt-2 space-y-1.5 text-[11px]">
                      <div className="flex justify-between">
                        <dt className="text-slate-500">نام مشتری:</dt>
                        <dd className="font-medium">{previewMeta.customerMeta.singularLabel} / {previewMeta.customerMeta.pluralLabel}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-slate-500">قیف فروش:</dt>
                        <dd className="font-medium">{previewMeta.salesMeta.pipelineName}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-slate-500">سرنخ / معامله:</dt>
                        <dd className="font-medium">{previewMeta.salesMeta.leadSingular} · {previewMeta.salesMeta.dealSingular}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-slate-500">پیش‌فاکتور:</dt>
                        <dd className="font-medium">{previewMeta.salesMeta.quoteLabel}</dd>
                      </div>
                    </dl>
                  </div>

                  <div className="rounded-lg border border-slate-200 p-3.5 dark:border-slate-800">
                    <div className="font-semibold text-slate-800 dark:text-slate-100">
                      مراحل سفارش ({previewMeta.orderMeta.channelDefault ?? 'website'})
                    </div>
                    <div className="mt-2 space-y-1 text-[11px]">
                      {(['new', 'confirmed', 'shipped', 'delivered', 'cancelled'] as const).map((st, idx) => (
                        <div key={st} className="flex items-center justify-between">
                          <span className="text-slate-500">{toFa(idx + 1)}. <span dir="ltr" className="font-mono">{st}</span></span>
                          <span className="font-medium text-slate-800 dark:text-slate-200">
                            {previewMeta.orderMeta.statusLabels[st]}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 p-3.5 dark:border-slate-800">
                  <div className="font-semibold text-slate-800 dark:text-slate-100">
                    مراحل قیف فروش ({toFa(previewMeta.salesMeta.defaultStages.length)} مرحله)
                  </div>
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full text-right text-[11px]">
                      <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800">
                        <tr>
                          <th className="py-1.5">مرحله</th>
                          <th className="py-1.5">کلید</th>
                          <th className="py-1.5">احتمال موفقیت</th>
                          <th className="py-1.5">SLA مرحله (ساعت)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 tabular-nums">
                        {previewMeta.salesMeta.defaultStages.map((st) => (
                          <tr key={st.key}>
                            <td className="py-1.5 font-medium">{st.label}</td>
                            <td dir="ltr" className="py-1.5 text-right font-mono text-slate-400">{st.key}</td>
                            <td className="py-1.5">{toFa(st.probability)}٪</td>
                            <td className="py-1.5">{toFa(st.slaHours)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 p-3.5 dark:border-slate-800">
                  <div className="font-semibold text-slate-800 dark:text-slate-100">
                    ماژول‌های فعال‌شده با این پک ({toFa(previewMeta.enabledModules.length)} از {toFa(ALL_CRM_MODULE_KEYS.length)})
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3 text-[11px]">
                    {ALL_CRM_MODULE_KEYS.map((mk) => {
                      const on = previewMeta.enabledModules.includes(mk);
                      return (
                        <div
                          key={mk}
                          className={`flex items-center gap-1.5 ${
                            on ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-400 line-through'
                          }`}
                        >
                          <CheckCircle2 size={12} className={on ? 'opacity-100' : 'opacity-30'} />
                          <span>{CRM_MODULE_LABELS[mk]?.fa ?? mk}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {previewTab === 'fields_kpis' && (
              <div className="space-y-4">
                <div className="rounded-lg border border-slate-200 p-3.5 dark:border-slate-800">
                  <div className="font-semibold text-slate-800 dark:text-slate-100">
                    فیلدهای سفارشی پک ({toFa(previewPack.customFields.length)})
                  </div>
                  {previewPack.customFields.length === 0 ? (
                    <p className="mt-2 text-slate-400">فیلد سفارشی پیش‌فرض ندارد.</p>
                  ) : (
                    <table className="mt-2 w-full text-right text-[11px]">
                      <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800">
                        <tr>
                          <th className="py-1.5">برچسب فیلد</th>
                          <th className="py-1.5">کلید</th>
                          <th className="py-1.5">موجودیت</th>
                          <th className="py-1.5">نوع / گزینه‌ها</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {previewPack.customFields.map((f) => (
                          <tr key={f.key}>
                            <td className="py-1.5 font-medium">{f.label}</td>
                            <td dir="ltr" className="py-1.5 text-right font-mono text-slate-400">{f.key}</td>
                            <td className="py-1.5">{f.entity ?? 'customer'}</td>
                            <td className="py-1.5 text-slate-500">
                              {f.type}
                              {f.options && f.options.length > 0 ? ` (${f.options.join('، ')})` : ''}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {previewPack.customEntities.length > 0 && (
                  <div className="rounded-lg border border-slate-200 p-3.5 dark:border-slate-800">
                    <div className="font-semibold text-slate-800 dark:text-slate-100">
                      موجودیت‌های تخصصی ({toFa(previewPack.customEntities.length)})
                    </div>
                    <div className="mt-2 space-y-2">
                      {previewPack.customEntities.map((ce) => (
                        <div key={ce.key} className="text-[11px]">
                          <span className="font-semibold">{ce.name}</span> ({ce.key}) — {ce.description}
                          <div className="mt-0.5 text-slate-500">
                            فیلدها: {ce.fields.map((cf) => cf.label).join(' · ')}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="rounded-lg border border-slate-200 p-3.5 dark:border-slate-800">
                  <div className="font-semibold text-slate-800 dark:text-slate-100">
                    مجموعه شاخص‌های کلیدی عملکرد (KPI Set · {toFa(previewMeta.kpis.length)})
                  </div>
                  <table className="mt-2 w-full text-right text-[11px] tabular-nums">
                    <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800">
                      <tr>
                        <th className="py-1.5">شاخص</th>
                        <th className="py-1.5">کلید متریک</th>
                        <th className="py-1.5">هدف پیش‌فرض</th>
                        <th className="py-1.5">جهت بهینه</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {previewMeta.kpis.map((k) => (
                        <tr key={k.id}>
                          <td className="py-1.5 font-medium">{k.label}</td>
                          <td dir="ltr" className="py-1.5 text-right font-mono text-slate-400">{k.metricKey}</td>
                          <td className="py-1.5">
                            {k.unit === 'toman' ? formatToman(k.targetValue) : toFa(k.targetValue)}
                          </td>
                          <td className="py-1.5">{k.higherIsBetter ? 'بیشتر بهتر' : 'کمتر بهتر'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {previewTab === 'automation_templates' && (
              <div className="space-y-4">
                <div className="rounded-lg border border-slate-200 p-3.5 dark:border-slate-800">
                  <div className="font-semibold text-slate-800 dark:text-slate-100">
                    قوانین اتوماسیون آماده ({toFa(previewPack.rules.length)} — نصب به‌صورت متوقف/غیرفعال)
                  </div>
                  <div className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
                    {previewPack.rules.map((r, i) => (
                      <div key={r.name} className="py-2 text-[11px]">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                          {toFa(i + 1)}. {r.name}
                        </div>
                        <div className="mt-0.5 text-slate-500">
                          تریگر: {r.trigger} · شرط: {r.condition} · اقدام: {r.action}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 p-3.5 dark:border-slate-800">
                  <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-100">
                    <GitBranch size={14} className="text-indigo-500" />
                    الگوی گردش‌کار (BPMS) — ({toFa(previewPack.workflowTemplates?.length ?? 0)})
                  </div>
                  {(previewPack.workflowTemplates ?? []).map((wf) => (
                    <div key={wf.key} className="mt-2 text-[11px]">
                      <div className="font-semibold">{wf.name} (SLA: {toFa(wf.slaHours)} ساعت)</div>
                      <p className="text-slate-500">{wf.description}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-indigo-700 dark:text-indigo-300">
                        {wf.nodes.map((n, idx) => (
                          <span key={n.id}>
                            {n.label}
                            {idx < wf.nodes.length - 1 ? ' ← ' : ''}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="rounded-lg border border-slate-200 p-3.5 dark:border-slate-800">
                  <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-100">
                    <MessageSquareText size={14} className="text-emerald-600" />
                    قالب‌های پیام متغیردار ({toFa(previewPack.messageTemplates?.length ?? 0)})
                  </div>
                  {(!previewPack.messageTemplates || previewPack.messageTemplates.length === 0) ? (
                    <p className="mt-2 text-slate-400">قالب پیام اختصاصی برای این پک ثبت نشده است.</p>
                  ) : (
                    <div className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
                      {previewPack.messageTemplates.map((tpl) => (
                        <div key={tpl.name} className="py-2 text-[11px]">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold">{tpl.name}</span>
                            <span dir="ltr" className="font-mono text-slate-400">{tpl.channel} / {tpl.category}</span>
                          </div>
                          <p className="mt-1 text-slate-600 dark:text-slate-300">{tpl.body}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {previewTab === 'reports_sample' && (
              <div className="space-y-4">
                <div className="rounded-lg border border-slate-200 p-3.5 dark:border-slate-800">
                  <div className="font-semibold text-slate-800 dark:text-slate-100">
                    گزارش‌های پیش‌فرض BI ({toFa(previewPack.defaultReports?.length ?? 0)})
                  </div>
                  {(!previewPack.defaultReports || previewPack.defaultReports.length === 0) ? (
                    <p className="mt-2 text-slate-400">گزارش اختصاصی تعریف نشده است.</p>
                  ) : (
                    <div className="mt-2 divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
                      {previewPack.defaultReports.map((rep) => (
                        <div key={rep.title} className="flex flex-wrap items-center justify-between gap-2 py-2">
                          <span className="font-semibold">{rep.title}</span>
                          <span dir="ltr" className="font-mono text-slate-500">
                            {rep.entity} · group:{rep.groupBy} · {rep.aggregation}({rep.metricField}) · {rep.chartType}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-slate-200 p-3.5 dark:border-slate-800">
                    <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-100">
                      <Sparkles size={13} className="text-indigo-500" />
                      خدمات پیش‌فرض ({toFa(previewPack.services.length)})
                    </div>
                    <ul className="mt-2 space-y-1 text-[11px] tabular-nums">
                      {previewPack.services.map((s) => (
                        <li key={s.name} className="flex justify-between gap-2">
                          <span>{s.name}</span>
                          <span className="text-slate-500">{formatToman(s.price)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-3.5 dark:border-slate-800">
                    <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-100">
                      <Package size={13} className="text-emerald-600" />
                      محصولات / پکیج‌ها ({toFa(previewPack.products.length)})
                    </div>
                    <ul className="mt-2 space-y-1 text-[11px] tabular-nums">
                      {previewPack.products.map((p) => (
                        <li key={p.sku} className="flex justify-between gap-2">
                          <span>{p.name}</span>
                          <span className="text-slate-500">{formatToman(p.price)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {previewPack.sampleData && (
                  <div className="rounded-lg border border-slate-200 p-3.5 dark:border-slate-800">
                    <div className="font-semibold text-slate-800 dark:text-slate-100">
                      پیش‌نمایش داده‌های نمونه صنعت
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5 text-[11px] tabular-nums">
                      <div>مشتری نمونه: {toFa(previewPack.sampleData.customers.length)}</div>
                      <div>سرنخ: {toFa(previewPack.sampleData.leads?.length ?? 0)}</div>
                      <div>سفارش: {toFa(previewPack.sampleData.orders?.length ?? 0)}</div>
                      <div>نوبت/جلسه: {toFa(previewPack.sampleData.appointments?.length ?? 0)}</div>
                      <div>تیکت: {toFa(previewPack.sampleData.tickets?.length ?? 0)}</div>
                    </div>
                    <ul className="mt-2 space-y-1 border-t border-slate-100 pt-2 text-[11px] text-slate-600 dark:border-slate-800 dark:text-slate-300">
                      {previewPack.sampleData.customers.map((sc) => (
                        <li key={sc.phone}>
                          {sc.name} ({sc.phone}) · منبع: {sc.source ?? '—'}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between border-t border-slate-200 pt-3 dark:border-slate-800">
              <button
                type="button"
                onClick={() => downloadPackJson(previewPack)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 dark:border-slate-700"
              >
                <Download size={13} />
                دانلود JSON پک
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewPack(null)}
                  className="rounded-lg border border-slate-200 px-3.5 py-1.5 text-xs font-medium dark:border-slate-700"
                >
                  بستن
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const k = previewPack.key as IndustryPack;
                    setPreviewPack(null);
                    setPendingInstallKey(k);
                  }}
                  className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                >
                  بررسی Diff و نصب پک
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Export current setup as new pack modal */}
      <Modal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        title="خروجی تنظیمات فعلی به عنوان یک پک صنعتی جدید"
        maxWidth="2xl"
      >
        <form onSubmit={handleCreateExportPack} className="space-y-4 text-xs">
          <p className="text-slate-500 dark:text-slate-400">
            تمامی اصطلاحات فعال، مراحل پایپ‌لاین، ماژول‌های فعال، فیلدهای سفارشی، موجودیت‌ها، KPIها، خدمات، کالاها، قوانین اتوماسیون، گردش‌کارها، قالب‌های پیام و گزارش‌های ساخته‌شده فعلی شما در قالب یک پک قابل نصب مجدد ذخیره و خروجی JSON گرفته می‌شوند.
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block font-medium text-slate-700 dark:text-slate-300">نام پک جدید</label>
              <input
                type="text"
                required
                placeholder="مثلاً: کلینیک تخصصی دندانپزشکی"
                value={expName}
                onChange={(e) => setExpName(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block font-medium text-slate-700 dark:text-slate-300">کلید لاتین پک</label>
              <input
                type="text"
                dir="ltr"
                placeholder="dental_clinic_pro"
                value={expKey}
                onChange={(e) => setExpKey(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block font-medium text-slate-700 dark:text-slate-300">سطح پک</label>
              <select
                value={expTier}
                onChange={(e) => setExpTier(e.target.value as PackTemplate['tier'])}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="full">پک کامل (Full)</option>
                <option value="medium">پک متوسط (Medium)</option>
                <option value="light">پک سبک (Light)</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block font-medium text-slate-700 dark:text-slate-300">توضیحات پک</label>
              <input
                type="text"
                placeholder="توضیح کوتاه کاربرد و امکانات پک..."
                value={expDesc}
                onChange={(e) => setExpDesc(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/40 tabular-nums">
            <div className="font-semibold text-slate-800 dark:text-slate-200">اقلام استخراجی از فضای کاری فعلی:</div>
            <div className="mt-1.5 flex flex-wrap gap-3 text-[11px] text-slate-600 dark:text-slate-300">
              <span>فیلدها: {toFa(liveExportPreviewPack.customFields.length)}</span>
              <span>·</span>
              <span>موجودیت‌ها: {toFa(liveExportPreviewPack.customEntities.length)}</span>
              <span>·</span>
              <span>خدمات/کالا: {toFa(liveExportPreviewPack.services.length + liveExportPreviewPack.products.length)}</span>
              <span>·</span>
              <span>قوانین: {toFa(liveExportPreviewPack.rules.length)}</span>
              <span>·</span>
              <span>گردش‌کار: {toFa(liveExportPreviewPack.workflowTemplates?.length ?? 0)}</span>
              <span>·</span>
              <span>قالب پیام: {toFa(liveExportPreviewPack.messageTemplates?.length ?? 0)}</span>
              <span>·</span>
              <span>گزارش: {toFa(liveExportPreviewPack.defaultReports?.length ?? 0)}</span>
            </div>
          </div>

          <div>
            <div className="mb-1 font-medium text-slate-600 dark:text-slate-400">پیش‌نمایش ساختار JSON پک:</div>
            <pre
              dir="ltr"
              className="max-h-40 overflow-auto rounded-lg border border-slate-200 bg-slate-950 p-3 text-left font-mono text-[11px] text-slate-200 dark:border-slate-800"
            >
              {JSON.stringify(liveExportPreviewPack, null, 2)}
            </pre>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setExportOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium dark:border-slate-700"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700"
            >
              <Download size={14} />
              ذخیره در کتابخانه و دانلود JSON پک
            </button>
          </div>
        </form>
      </Modal>

      <IndustryPackDiffModal
        diff={pendingInstallKey ? computePackSwitchDiff(state, pendingInstallKey) : null}
        onClose={() => setPendingInstallKey(null)}
        onConfirm={(installDefaults, installSampleData) => {
          if (pendingInstallKey) {
            applyIndustryPack(pendingInstallKey, installDefaults, {
              installSampleData,
            });
          }
          setPendingInstallKey(null);
        }}
      />
    </div>
  );
}
