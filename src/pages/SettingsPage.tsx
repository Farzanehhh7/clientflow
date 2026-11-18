import { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Database,
  Download,
  GripVertical,
  History,
  Link2,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { SetupWizardModal } from '../components/SetupWizardModal';
import { useClientFlow } from '../store/useClientFlowStore';
import type {
  CustomFieldDef,
  CustomFieldType,
  EntityRelationType,
  IndustryPack,
  UserRole,
} from '../types';
import { formatJalaliDateTime, formatToman, toFa } from '../utils/jalali';

const WEEKDAY_OPTIONS: { dayIndex: number; label: string }[] = [
  { dayIndex: 6, label: 'شنبه' },
  { dayIndex: 0, label: 'یکشنبه' },
  { dayIndex: 1, label: 'دوشنبه' },
  { dayIndex: 2, label: 'سه‌شنبه' },
  { dayIndex: 3, label: 'چهارشنبه' },
  { dayIndex: 4, label: 'پنج‌شنبه' },
  { dayIndex: 5, label: 'جمعه' },
];

const FIELD_TYPE_LABELS: Record<CustomFieldType, string> = {
  text: 'متنی',
  number: 'عددی',
  money: 'مبلغ پولی (تومان)',
  select: 'لیست انتخابی تک‌گزینه',
  multiselect: 'چندانتخابی (Multi-select)',
  date: 'تاریخ (شمسی/میلادی)',
  phone: 'شماره تماس',
  nationalId: 'کد ملی',
  file: 'پیوست فایل / مدرک',
  lookup: 'ارجاع به موجودیت (Lookup)',
  formula: 'فرمول محاسباتی',
};

export function SettingsPage() {
  const {
    state,
    updateSettings,
    exportStateJson,
    importStateJson,
    resetDemoData,
    addCustomFieldDef,
    removeCustomFieldDef,
    reorderCustomFieldDefs,
    addCustomEntityDef,
    deleteCustomEntityDef,
    addEntityRelation,
    removeEntityRelation,
    saveConfigSnapshot,
    restoreConfigSnapshot,
    addService,
    addResource,
    pushToast,
  } = useClientFlow();

  const [tab, setTab] = useState<'general' | 'config' | 'entities' | 'audit'>('general');
  const [wizardOpen, setWizardOpen] = useState(false);

  const [businessName, setBusinessName] = useState(state.settings.businessName);
  const [workStartHour, setWorkStartHour] = useState(state.settings.workStartHour);
  const [workEndHour, setWorkEndHour] = useState(state.settings.workEndHour);
  const [workDays, setWorkDays] = useState<number[]>(state.settings.workDays);
  const [commissionPct, setCommissionPct] = useState(String(state.settings.commissionPct));

  // Visual Form Builder (11 field types + conditional + lookup + formula + drag reorder)
  const [cfLabel, setCfLabel] = useState('');
  const [cfKey, setCfKey] = useState('');
  const [cfType, setCfType] = useState<CustomFieldType>('text');
  const [cfOptions, setCfOptions] = useState('');
  const [cfLookupEntity, setCfLookupEntity] = useState<'customer' | 'product' | 'service' | 'resource'>('customer');
  const [cfFormulaExpr, setCfFormulaExpr] = useState('');
  const [cfVisibleKey, setCfVisibleKey] = useState('');
  const [cfVisibleEquals, setCfVisibleEquals] = useState('');
  const [draggingFieldId, setDraggingFieldId] = useState<string | null>(null);

  // Custom Entity Builder
  const [entName, setEntName] = useState('');
  const [entPlural, setEntPlural] = useState('');
  const [entKey, setEntKey] = useState('');
  const [entDesc, setEntDesc] = useState('');
  const [entFirstFieldLabel, setEntFirstFieldLabel] = useState('عنوان / نام');
  const [entSecondFieldLabel, setEntSecondFieldLabel] = useState('توضیحات');

  // Entity Relation Builder
  const [relName, setRelName] = useState('');
  const [relSource, setRelSource] = useState('customer');
  const [relTarget, setRelTarget] = useState(state.customEntityDefs[0]?.key ?? 'order');
  const [relCardinality, setRelCardinality] = useState<EntityRelationType>('1:N');

  // Config Versioning
  const [snapVersion, setSnapVersion] = useState(`v1.${state.configSnapshots.length + 1}.0`);
  const [snapNote, setSnapNote] = useState('');

  // Service & Resource builder (with bufferBeforeMin & bufferAfterMin)
  const [srvName, setSrvName] = useState('');
  const [srvDuration, setSrvDuration] = useState('30');
  const [srvPrice, setSrvPrice] = useState('500000');
  const [srvBufBefore, setSrvBufBefore] = useState('5');
  const [srvBufAfter, setSrvBufAfter] = useState('10');
  const [resName, setResName] = useState('');
  const [resType, setResType] = useState<'staff' | 'room'>('staff');

  const toggleWorkDay = (dayIdx: number) => {
    setWorkDays((prev) =>
      prev.includes(dayIdx) ? prev.filter((d) => d !== dayIdx) : [...prev, dayIdx],
    );
  };

  const handleSaveGeneral = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({
      businessName: businessName.trim() || 'ClientFlow',
      workStartHour,
      workEndHour,
      workDays: workDays.length > 0 ? workDays : [6, 0, 1, 2, 3, 4],
      commissionPct: Math.min(50, Math.max(0, Number(commissionPct) || 5)),
    });
  };

  const handleDownloadJson = () => {
    const json = exportStateJson();
    const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clientflow-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleUploadJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const res = importStateJson(text);
    if (!res.ok) {
      pushToast(res.error ?? 'خطا در بازیابی فایل', 'error');
    }
    e.target.value = '';
  };

  const handleAddCustomField = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cfLabel.trim()) return;
    const key = cfKey.trim().replace(/[^a-zA-Z0-9_]/g, '') || `cf_${Date.now().toString(36)}`;
    addCustomFieldDef({
      key,
      label: cfLabel.trim(),
      type: cfType,
      options:
        cfType === 'select' || cfType === 'multiselect'
          ? cfOptions
              .split(/[,،]/)
              .map((o) => o.trim())
              .filter(Boolean)
          : undefined,
      lookupEntity: cfType === 'lookup' ? cfLookupEntity : undefined,
      formulaExpr: cfType === 'formula' ? cfFormulaExpr.trim() : undefined,
      visibleWhen:
        cfVisibleKey && cfVisibleEquals.trim()
          ? { fieldKey: cfVisibleKey, equals: cfVisibleEquals.trim() }
          : undefined,
    });
    setCfLabel('');
    setCfKey('');
    setCfOptions('');
    setCfFormulaExpr('');
    setCfVisibleKey('');
    setCfVisibleEquals('');
  };

  const sortedFields = [...state.customFieldDefs].sort(
    (a, b) => (a.order ?? 999) - (b.order ?? 999),
  );

  const moveFieldByStep = (idx: number, dir: -1 | 1) => {
    const nextIdx = idx + dir;
    if (nextIdx < 0 || nextIdx >= sortedFields.length) return;
    const copy = [...sortedFields];
    const [item] = copy.splice(idx, 1);
    copy.splice(nextIdx, 0, item);
    reorderCustomFieldDefs(copy.map((f) => f.id));
  };

  const handleDropField = (targetId: string) => {
    if (!draggingFieldId || draggingFieldId === targetId) return;
    const copy = [...sortedFields];
    const fromIdx = copy.findIndex((f) => f.id === draggingFieldId);
    const toIdx = copy.findIndex((f) => f.id === targetId);
    if (fromIdx < 0 || toIdx < 0) return;
    const [moved] = copy.splice(fromIdx, 1);
    copy.splice(toIdx, 0, moved);
    reorderCustomFieldDefs(copy.map((f) => f.id));
    setDraggingFieldId(null);
  };

  const handleCreateEntity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!entName.trim()) return;
    const key =
      entKey.trim().replace(/[^a-zA-Z0-9_]/g, '').toLowerCase() ||
      `entity_${Date.now().toString(36)}`;
    addCustomEntityDef({
      key,
      name: entName.trim(),
      pluralName: entPlural.trim() || entName.trim(),
      description: entDesc.trim() || undefined,
      fields: [
        {
          id: `${key}_f1`,
          key: 'title',
          label: entFirstFieldLabel.trim() || 'عنوان',
          type: 'text',
          required: true,
          order: 1,
        },
        {
          id: `${key}_f2`,
          key: 'details',
          label: entSecondFieldLabel.trim() || 'توضیحات',
          type: 'text',
          order: 2,
        },
        {
          id: `${key}_f3`,
          key: 'amount',
          label: 'مبلغ / ارزش (تومان)',
          type: 'money',
          order: 3,
        },
        {
          id: `${key}_f4`,
          key: 'record_date',
          label: 'تاریخ ثبت',
          type: 'date',
          order: 4,
        },
      ],
    });
    setEntName('');
    setEntPlural('');
    setEntKey('');
    setEntDesc('');
  };

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1 w-fit dark:bg-slate-900">
          {(
            [
              ['general', 'کسب‌وکار و بسته صنعتی'],
              ['config', 'فرم‌ساز بصری، خدمات و بافر'],
              ['entities', 'موجودیت‌های سفارشی و نسخه‌گذاری'],
              ['audit', `گزارش ممیزی (${toFa(state.auditLogs.length)})`],
            ] as const
          ).map(([key, label]) => (
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

        <button
          type="button"
          onClick={() => setWizardOpen(true)}
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-xs font-medium text-indigo-700 hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-300"
        >
          <Sparkles size={15} />
          راه‌اندازی سریع با ویزارد
        </button>
      </div>

      {tab === 'general' && (
        <>
          <form
            onSubmit={handleSaveGeneral}
            className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
          >
            <h2 className="text-sm font-semibold">مشخصات کسب‌وکار، ساعات کاری و پورسانت پایه</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
              <div className="sm:col-span-4">
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  نام کسب‌وکار
                </label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  شروع کار
                </label>
                <select
                  value={workStartHour}
                  onChange={(e) => setWorkStartHour(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm tabular-nums dark:border-slate-700 dark:bg-slate-800"
                >
                  {Array.from({ length: 8 }, (_, i) => 6 + i).map((h) => (
                    <option key={h} value={h}>
                      {toFa(String(h).padStart(2, '0'))}:۰۰
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  پایان کار
                </label>
                <select
                  value={workEndHour}
                  onChange={(e) => setWorkEndHour(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm tabular-nums dark:border-slate-700 dark:bg-slate-800"
                >
                  {Array.from({ length: 8 }, (_, i) => 15 + i).map((h) => (
                    <option key={h} value={h}>
                      {toFa(String(h).padStart(2, '0'))}:۰۰
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  نرخ پورسانت پایه (٪)
                </label>
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={commissionPct}
                  onChange={(e) => setCommissionPct(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm tabular-nums dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <div className="sm:col-span-4">
                <div className="mb-2 text-xs font-medium text-slate-600 dark:text-slate-400">
                  روزهای کاری هفته
                </div>
                <div className="flex flex-wrap gap-2">
                  {WEEKDAY_OPTIONS.map((d) => {
                    const active = workDays.includes(d.dayIndex);
                    return (
                      <button
                        key={d.dayIndex}
                        type="button"
                        onClick={() => toggleWorkDay(d.dayIndex)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                          active
                            ? 'border-indigo-600 bg-indigo-600 text-white'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
                        }`}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700"
              >
                ذخیره تنظیمات
              </button>
            </div>
          </form>

          <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-sm font-semibold">بسته صنعتی فعال (Industry Pack)</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              انتخاب بسته صنعتی، فیلدهای تخصصی پرونده و قوانین اتوماسیون متناسب را فعال می‌کند.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {(
                [
                  ['clinic', 'کلینیک و مطب', 'پرونده مراجع، رضایت‌نامه، یادآوری ویزیت کنترل'],
                  ['shop', 'فروشگاه آنلاین', 'کاتالوگ محصول، انبار خودکار، پیگیری سفارش رهاشده'],
                  ['software', 'شرکت نرم‌افزاری / IT', 'لایسنس، پروژه‌ها و استقرار، هشدار تمدید'],
                  ['general', 'عمومی (ساده)', 'پیکربندی استاندارد بدون فیلدهای تخصصی'],
                ] as [IndustryPack, string, string][]
              ).map(([pack, title, desc]) => {
                const active = state.settings.industryPack === pack;
                return (
                  <button
                    key={pack}
                    type="button"
                    onClick={() => updateSettings({ industryPack: pack })}
                    className={`rounded-xl border p-3.5 text-right transition-colors ${
                      active
                        ? 'border-indigo-600 bg-indigo-50/60 dark:border-indigo-500 dark:bg-indigo-950/30'
                        : 'border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="text-sm font-semibold">{title}</div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-sm font-semibold">نقش کاربری و دسترسی (RBAC)</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              در نقش «کارشناس (Staff)»، بخش‌های اتوماسیون و تنظیمات مخفی می‌شوند و امکان حذف یا ناشناس‌سازی مشتری وجود ندارد.
            </p>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ['admin', 'مدیر سیستم (Admin)'],
                  ['staff', 'کارشناس (Staff)'],
                ] as [UserRole, string][]
              ).map(([role, label]) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => updateSettings({ role })}
                  className={`rounded-lg border px-4 py-2 text-xs font-medium ${
                    state.settings.role === role
                      ? 'border-indigo-600 bg-indigo-600 text-white'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div>
              <h2 className="text-sm font-semibold">پشتیبان‌گیری، بازیابی JSON و بازنشانی</h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                دریافت یا بازیابی خروجی کامل وضعیت برنامه.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleDownloadJson}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Download size={15} />
                خروجی JSON
              </button>
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                <Upload size={15} />
                بازیابی JSON
                <input type="file" accept=".json,application/json" onChange={handleUploadJson} className="hidden" />
              </label>
              <button
                type="button"
                onClick={resetDemoData}
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-3.5 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-400 dark:hover:bg-rose-950/30"
              >
                <RotateCcw size={15} />
                بازنشانی نمونه
              </button>
            </div>
          </div>
        </>
      )}

      {tab === 'config' && (
        <div className="space-y-6">
          {/* Visual Form Builder with Drag & Drop + 11 Field Types + Conditional Rules */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-1 text-sm font-semibold">فرم‌ساز بصری فیلدهای پویا (۱۱ نوع فیلد + نمایش شرطی + کشیدن و رها کردن)</h2>
            <p className="mb-4 text-xs text-slate-500">
              ترتیب فیلدها را با Drag &amp; Drop تغییر دهید، شرط نمایش تعریف کنید و از فیلدهای فرمولی یا ارجاعی (Lookup) استفاده نمایید.
            </p>

            <form onSubmit={handleAddCustomField} className="mb-5 space-y-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/30">
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                <input
                  type="text"
                  placeholder="عنوان فیلد (مثلاً: تخفیف ویژه)"
                  value={cfLabel}
                  onChange={(e) => setCfLabel(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
                />
                <input
                  type="text"
                  dir="ltr"
                  placeholder="کلید انگلیسی اختیاری (مثلاً discount_val)"
                  value={cfKey}
                  onChange={(e) => setCfKey(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-left font-mono text-xs dark:border-slate-700 dark:bg-slate-900"
                />
                <select
                  value={cfType}
                  onChange={(e) => setCfType(e.target.value as CustomFieldType)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
                >
                  {(Object.keys(FIELD_TYPE_LABELS) as CustomFieldType[]).map((t) => (
                    <option key={t} value={t}>
                      {FIELD_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>

              {(cfType === 'select' || cfType === 'multiselect') && (
                <input
                  type="text"
                  placeholder="گزینه‌ها با ویرگول جدا شود (مثلاً: لیزر، بوتاکس، فیشال)..."
                  value={cfOptions}
                  onChange={(e) => setCfOptions(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
                />
              )}

              {cfType === 'lookup' && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500">ارجاع به موجودیت:</span>
                  <select
                    value={cfLookupEntity}
                    onChange={(e) =>
                      setCfLookupEntity(e.target.value as 'customer' | 'product' | 'service' | 'resource')
                    }
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
                  >
                    <option value="customer">مشتریان</option>
                    <option value="product">محصولات</option>
                    <option value="service">خدمات</option>
                    <option value="resource">منابع / پزشکان</option>
                  </select>
                </div>
              )}

              {cfType === 'formula' && (
                <input
                  type="text"
                  dir="ltr"
                  placeholder="فرمول با کلید فیلدها، مثلاً: {sessions_count} * 500000"
                  value={cfFormulaExpr}
                  onChange={(e) => setCfFormulaExpr(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-left font-mono text-xs dark:border-slate-700 dark:bg-slate-900"
                />
              )}

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-[11px] text-slate-500">نمایش شرطی (اختیاری): فقط اگر فیلد</span>
                <select
                  value={cfVisibleKey}
                  onChange={(e) => setCfVisibleKey(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
                >
                  <option value="">-- بدون شرط --</option>
                  {sortedFields.map((f) => (
                    <option key={f.id} value={f.key}>
                      {f.label} ({f.key})
                    </option>
                  ))}
                </select>
                {cfVisibleKey && (
                  <input
                    type="text"
                    placeholder="مساوی با مقدار..."
                    value={cfVisibleEquals}
                    onChange={(e) => setCfVisibleEquals(e.target.value)}
                    className="w-40 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
                  />
                )}
                <button
                  type="submit"
                  className="mr-auto inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                >
                  <Plus size={14} />
                  افزودن به فرم
                </button>
              </div>
            </form>

            <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
              {sortedFields.map((f, idx) => (
                <div
                  key={f.id}
                  draggable
                  onDragStart={() => setDraggingFieldId(f.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDropField(f.id)}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-xs hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                >
                  <div className="flex items-center gap-2">
                    <GripVertical size={15} className="cursor-grab text-slate-400" />
                    <div>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">{f.label}</span>
                      <span className="mx-1.5 font-mono text-[11px] text-slate-400">({f.key})</span>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {FIELD_TYPE_LABELS[f.type]}
                      </span>
                      {f.visibleWhen && (
                        <span className="mr-1.5 text-[11px] text-amber-600 dark:text-amber-400">
                          شرط: {f.visibleWhen.fieldKey} = {f.visibleWhen.equals}
                        </span>
                      )}
                      {f.formulaExpr && (
                        <span className="mr-1.5 font-mono text-[11px] text-indigo-500" dir="ltr">
                          [{f.formulaExpr}]
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => moveFieldByStep(idx, -1)}
                      disabled={idx === 0}
                      className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800"
                    >
                      <ArrowUp size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveFieldByStep(idx, 1)}
                      disabled={idx === sortedFields.length - 1}
                      className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800"
                    >
                      <ArrowDown size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeCustomFieldDef(f.id)}
                      className="rounded p-1 text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Services (with Buffer Before/After) & Resources */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="mb-3 text-sm font-semibold">خدمات نوبت‌دهی و زمان بافر (آماده‌سازی)</h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!srvName.trim()) return;
                  addService({
                    name: srvName.trim(),
                    durationMin: Math.max(5, Number(srvDuration) || 30),
                    price: Math.max(0, Number(srvPrice) || 0),
                    bufferBeforeMin: Math.max(0, Number(srvBufBefore) || 0),
                    bufferAfterMin: Math.max(0, Number(srvBufAfter) || 0),
                  });
                  setSrvName('');
                }}
                className="mb-4 space-y-2"
              >
                <div className="flex flex-wrap gap-2">
                  <input
                    type="text"
                    placeholder="نام خدمت..."
                    value={srvName}
                    onChange={(e) => setSrvName(e.target.value)}
                    className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                  />
                  <input
                    type="number"
                    placeholder="مدت (دقیقه)"
                    value={srvDuration}
                    onChange={(e) => setSrvDuration(e.target.value)}
                    className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
                  />
                  <input
                    type="number"
                    placeholder="تعرفه"
                    value={srvPrice}
                    onChange={(e) => setSrvPrice(e.target.value)}
                    className="w-24 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500">بافر قبل/بعد (دقیقه):</span>
                  <input
                    type="number"
                    min={0}
                    value={srvBufBefore}
                    onChange={(e) => setSrvBufBefore(e.target.value)}
                    className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
                  />
                  <input
                    type="number"
                    min={0}
                    value={srvBufAfter}
                    onChange={(e) => setSrvBufAfter(e.target.value)}
                    className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
                  />
                  <button
                    type="submit"
                    className="mr-auto rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                  >
                    افزودن خدمت
                  </button>
                </div>
              </form>
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {state.services.map((s) => (
                  <div key={s.id} className="flex items-center justify-between py-2 text-xs">
                    <div>
                      <span className="font-medium">{s.name}</span>
                      <span className="mx-1.5 text-slate-400">·</span>
                      <span className="tabular-nums text-slate-500">{toFa(s.durationMin)} دقیقه</span>
                      {(s.bufferBeforeMin || s.bufferAfterMin) ? (
                        <span className="mr-1.5 text-[11px] text-indigo-600 dark:text-indigo-400">
                          (بافر {toFa(s.bufferBeforeMin ?? 0)}/{toFa(s.bufferAfterMin ?? 0)} د)
                        </span>
                      ) : null}
                    </div>
                    <span className="font-medium tabular-nums">{formatToman(s.price)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="mb-3 text-sm font-semibold">منابع (پزشکان و اتاق‌ها)</h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!resName.trim()) return;
                  addResource({ name: resName.trim(), type: resType });
                  setResName('');
                }}
                className="mb-4 flex flex-wrap gap-2"
              >
                <input
                  type="text"
                  placeholder="نام پزشک یا اتاق..."
                  value={resName}
                  onChange={(e) => setResName(e.target.value)}
                  className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
                <select
                  value={resType}
                  onChange={(e) => setResType(e.target.value as 'staff' | 'room')}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="staff">پزشک / پرسنل</option>
                  <option value="room">اتاق / دستگاه</option>
                </select>
                <button
                  type="submit"
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                >
                  افزودن
                </button>
              </form>
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {state.resources.map((r) => (
                  <div key={r.id} className="flex items-center justify-between py-2 text-xs">
                    <span className="font-medium">{r.name}</span>
                    <span className="text-slate-500">{r.type === 'staff' ? 'پزشک / کارشناس' : 'اتاق / تجهیز'}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Entities, Relations (1:1 / 1:N / N:M) & Config Versioning */}
      {tab === 'entities' && (
        <div className="space-y-6">
          {/* Custom Entities */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-1 flex items-center gap-2 text-sm font-semibold">
              <Database size={16} className="text-indigo-500" />
              ساخت موجودیت سفارشی بدون کد (EntityDef)
            </div>
            <p className="mb-4 text-xs text-slate-500">
              موجودیت‌های تعریف‌شده در این بخش بلافاصله در صفحه «موجودیت‌های سفارشی» قابل ثبت و مدیریت هستند.
            </p>
            <form onSubmit={handleCreateEntity} className="mb-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              <input
                type="text"
                required
                placeholder="نام مفرد (مثلاً: قرارداد، دستگاه، خودرو)"
                value={entName}
                onChange={(e) => setEntName(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
              <input
                type="text"
                placeholder="نام جمع (مثلاً: قراردادها)"
                value={entPlural}
                onChange={(e) => setEntPlural(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
              <input
                type="text"
                dir="ltr"
                placeholder="کلید (مثلاً service_contract)"
                value={entKey}
                onChange={(e) => setEntKey(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-left font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
              />
              <input
                type="text"
                placeholder="عنوان فیلد اول (مثلاً شماره سریال)"
                value={entFirstFieldLabel}
                onChange={(e) => setEntFirstFieldLabel(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
              <input
                type="text"
                placeholder="عنوان فیلد دوم (مثلاً توضیحات)"
                value={entSecondFieldLabel}
                onChange={(e) => setEntSecondFieldLabel(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
              >
                <Plus size={14} />
                ایجاد موجودیت سفارشی
              </button>
            </form>

            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {state.customEntityDefs.map((ent) => (
                <div key={ent.id} className="flex items-center justify-between py-2.5 text-xs">
                  <div>
                    <span className="font-semibold">{ent.pluralName}</span>
                    <span className="mx-2 font-mono text-[11px] text-slate-400">({ent.key})</span>
                    <span className="text-slate-500">· {toFa(ent.fields.length)} فیلد</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteCustomEntityDef(ent.id)}
                    className="p-1 text-slate-400 hover:text-rose-600"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Entity Relations 1:1, 1:N, N:M */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Link2 size={16} className="text-emerald-500" />
              روابط بین موجودیت‌ها (۱:۱ / ۱:N / N:M)
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!relName.trim()) return;
                addEntityRelation({
                  name: relName.trim(),
                  sourceEntity: relSource,
                  targetEntity: relTarget,
                  cardinality: relCardinality,
                });
                setRelName('');
              }}
              className="mb-4 flex flex-wrap gap-2"
            >
              <input
                type="text"
                placeholder="عنوان رابطه (مثلاً مالکیت تجهیزات)..."
                value={relName}
                onChange={(e) => setRelName(e.target.value)}
                className="min-w-[180px] flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
              <select
                value={relSource}
                onChange={(e) => setRelSource(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="customer">مشتری (customer)</option>
                <option value="order">سفارش (order)</option>
                {state.customEntityDefs.map((e) => (
                  <option key={e.key} value={e.key}>
                    {e.name} ({e.key})
                  </option>
                ))}
              </select>
              <select
                value={relCardinality}
                onChange={(e) => setRelCardinality(e.target.value as EntityRelationType)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-mono dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="1:1">1:1</option>
                <option value="1:N">1:N</option>
                <option value="N:M">N:M</option>
              </select>
              <select
                value={relTarget}
                onChange={(e) => setRelTarget(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="order">سفارش (order)</option>
                <option value="project">پروژه (project)</option>
                {state.customEntityDefs.map((e) => (
                  <option key={e.key} value={e.key}>
                    {e.name} ({e.key})
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
              >
                ثبت رابطه
              </button>
            </form>

            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {state.entityRelations.map((r) => (
                <div key={r.id} className="flex items-center justify-between py-2 text-xs">
                  <div>
                    <span className="font-semibold">{r.name}</span>
                    <span className="mx-2 font-mono text-[11px] text-indigo-600 dark:text-indigo-400">
                      {r.sourceEntity} [{r.cardinality}] {r.targetEntity}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeEntityRelation(r.id)}
                    className="p-1 text-slate-400 hover:text-rose-600"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Config Versioning & Rollback */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <History size={16} className="text-amber-500" />
              نسخه‌گذاری تنظیمات و بازگشت (Config Versioning)
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveConfigSnapshot(snapVersion, snapNote);
                setSnapNote('');
                setSnapVersion(`v1.${state.configSnapshots.length + 2}.0`);
              }}
              className="mb-4 flex flex-wrap gap-2"
            >
              <input
                type="text"
                dir="ltr"
                value={snapVersion}
                onChange={(e) => setSnapVersion(e.target.value)}
                placeholder="v1.1.0"
                className="w-28 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-left font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
              />
              <input
                type="text"
                value={snapNote}
                onChange={(e) => setSnapNote(e.target.value)}
                placeholder="یادداشت تغییرات این نسخه..."
                className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
              >
                <Save size={14} />
                ثبت نسخه جدید تنظیمات
              </button>
            </form>

            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {state.configSnapshots.map((snap) => (
                <div key={snap.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-xs">
                  <div>
                    <span className="rounded bg-slate-100 px-2 py-0.5 font-mono font-semibold dark:bg-slate-800">
                      {snap.versionLabel}
                    </span>
                    <span className="mx-2 text-slate-700 dark:text-slate-200">{snap.note}</span>
                    <span className="tabular-nums text-slate-400">
                      · {formatJalaliDateTime(snap.createdAt)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => restoreConfigSnapshot(snap.id)}
                    className="inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-800 hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300"
                  >
                    <RotateCcw size={12} />
                    بازگشت به این نسخه
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'audit' && (
        <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
          {state.auditLogs.length === 0 ? (
            <p className="p-8 text-center text-xs text-slate-500">رویدادی ثبت نشده است.</p>
          ) : (
            state.auditLogs.map((log) => (
              <div key={log.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-xs">
                <div>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{log.entity}</span>
                  <span className="mx-2 text-slate-400">·</span>
                  <span className="text-slate-600 dark:text-slate-300">{log.summary}</span>
                  <span className="mx-2 text-slate-400">·</span>
                  <span className="text-slate-500">نقش: {log.actorRole === 'admin' ? 'مدیر' : 'کارشناس'}</span>
                </div>
                <span className="tabular-nums text-slate-500 dark:text-slate-400">
                  {formatJalaliDateTime(log.at)}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      <SetupWizardModal open={wizardOpen} onClose={() => setWizardOpen(false)} />
    </div>
  );
}
