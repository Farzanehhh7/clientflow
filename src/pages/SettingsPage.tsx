import { useState } from 'react';
import {
  Bell,
  Bot,
  Building2,
  CalendarOff,
  Coins,
  Compass,
  Database,
  Download,
  Globe,
  Hash,
  History,
  Layers,
  Link2,
  PackagePlus,
  Plus,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { FieldsAndFormsTab } from '../components/settings/FieldsAndFormsTab';
import { IndustryPackDiffModal } from '../components/settings/IndustryPackDiffModal';
import { SecurityComplianceTab } from '../components/settings/SecurityComplianceTab';
import { TenantsBackupDataTab } from '../components/settings/TenantsBackupDataTab';
import { TrashRestoreTab } from '../components/settings/TrashRestoreTab';
import { UsersRolesTab } from '../components/settings/UsersRolesTab';
import { SetupWizardModal } from '../components/SetupWizardModal';
import { JalaliDatePicker } from '../components/ui/JalaliDatePicker';
import { INDUSTRY_PACKS } from '../data/packs';
import { getAiMissingKeyFriendlyNotice, isGeminiApiKeyConfigured } from '../services/aiService';
import { useClientFlow } from '../store/useClientFlowStore';
import type {
  AiBrandTone,
  BusinessProfileSettings,
  CurrencyCode,
  EntityRelationType,
  IndustryPack,
  NotificationPreferences,
  NumberingConfig,
  PackTemplate,
  UserRole,
} from '../types';
import { AI_BRAND_TONE_LABELS, DEFAULT_AI_CONFIG } from '../utils/aiGuardrails';
import { formatDocumentNumber } from '../utils/i18n';
import { formatJalaliDateTime, formatToman, getTodayJalaliAscii, jalaliToIsoUtc, toFa } from '../utils/jalali';
import { computePackSwitchDiff } from '../utils/packDiff';
import { PWAInstallButton, useOnlineStatus } from '../utils/usePWA';

const WEEKDAY_OPTIONS: { dayIndex: number; label: string }[] = [
  { dayIndex: 6, label: 'شنبه' },
  { dayIndex: 0, label: 'یکشنبه' },
  { dayIndex: 1, label: 'دوشنبه' },
  { dayIndex: 2, label: 'سه‌شنبه' },
  { dayIndex: 3, label: 'چهارشنبه' },
  { dayIndex: 4, label: 'پنج‌شنبه' },
  { dayIndex: 5, label: 'جمعه' },
];

interface SettingsPageProps {
  onStartTour?: () => void;
  onTriggerLockScreen?: () => void;
  onOpenAiCenter?: () => void;
  onOpenPackManager?: () => void;
}

export function SettingsPage({
  onStartTour,
  onTriggerLockScreen,
  onOpenAiCenter,
  onOpenPackManager,
}: SettingsPageProps) {
  const {
    state,
    updateSettings,
    exportStateJson,
    importStateJson,
    exportConfigJson,
    importConfigJson,
    resetDemoData,
    addCustomEntityDef,
    deleteCustomEntityDef,
    addEntityRelation,
    removeEntityRelation,
    saveConfigSnapshot,
    restoreConfigSnapshot,
    addService,
    addResource,
    addOfficialHoliday,
    removeOfficialHoliday,
    applyIndustryPack,
    saveCustomPack,
    importCustomPack,
    addBranch,
    deleteBranch,
    pushToast,
  } = useClientFlow();

  const [tab, setTab] = useState<
    | 'general'
    | 'users'
    | 'packs'
    | 'config'
    | 'tenants_data'
    | 'security'
    | 'trash'
    | 'entities'
    | 'audit'
  >('general');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [pendingPackKey, setPendingPackKey] = useState<IndustryPack | null>(null);
  const realOnline = useOnlineStatus();

  const [businessName, setBusinessName] = useState(state.settings.businessName);
  const [workStartHour, setWorkStartHour] = useState(state.settings.workStartHour);
  const [workEndHour, setWorkEndHour] = useState(state.settings.workEndHour);
  const [workDays, setWorkDays] = useState<number[]>(state.settings.workDays);
  const [commissionPct, setCommissionPct] = useState(String(state.settings.commissionPct));

  // Business Profile, Tax, Currency, Units & Notifications
  const [profile, setProfile] = useState<BusinessProfileSettings>(state.settings.profile ?? {});
  const [taxRatePct, setTaxRatePct] = useState(String(state.settings.taxRatePct ?? 9));
  const [currency, setCurrency] = useState<CurrencyCode>(state.settings.currency ?? 'toman');
  const [defaultUnit, setDefaultUnit] = useState(state.settings.defaultUnit ?? 'عدد');
  const [notifications, setNotifications] = useState<NotificationPreferences>(
    state.settings.notifications ?? {
      smsReminders: true,
      emailDigest: true,
      inAppToasts: true,
      slaBreachAlerts: true,
      dailySummaryHour: 9,
      quietHoursStart: 22,
      quietHoursEnd: 8,
    },
  );

  // Official Holidays (Jalali)
  const [holidayJalali, setHolidayJalali] = useState(getTodayJalaliAscii());
  const [holidayTitle, setHolidayTitle] = useState('');

  // Jalali Numbering Config (FR-CORE-05)
  const [numbering, setNumbering] = useState<NumberingConfig>(state.settings.numbering);

  // Multi-Branch form (FR-CORE-04)
  const [brName, setBrName] = useState('');
  const [brCode, setBrCode] = useState('');
  const [brCity, setBrCity] = useState('');
  const [brManager, setBrManager] = useState('');
  const [brParentId, setBrParentId] = useState(state.branches[0]?.id ?? '');

  // Pack Builder form (Section 7)
  const [pkName, setPkName] = useState('');
  const [pkKey, setPkKey] = useState('');
  const [pkDesc, setPkDesc] = useState('');

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

  // Service & Resource builder
  const [srvName, setSrvName] = useState('');
  const [srvDuration, setSrvDuration] = useState('30');
  const [srvPrice, setSrvPrice] = useState('500000');
  const [srvBufBefore, setSrvBufBefore] = useState('5');
  const [srvBufAfter, setSrvBufAfter] = useState('10');
  const [resName, setResName] = useState('');
  const [resType, setResType] = useState<'staff' | 'room' | 'device'>('staff');

  const trashCount =
    state.customers.filter((x) => x.isDeleted).length +
    state.leads.filter((x) => x.isDeleted).length +
    state.opportunities.filter((x) => x.isDeleted).length +
    state.orders.filter((x) => x.isDeleted).length +
    state.appointments.filter((x) => x.isDeleted).length +
    state.tickets.filter((x) => x.isDeleted).length +
    state.tasks.filter((x) => x.isDeleted).length +
    state.products.filter((x) => x.isDeleted).length;

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
      profile,
      taxRatePct: Math.min(30, Math.max(0, Number(taxRatePct) || 0)),
      currency,
      defaultUnit: defaultUnit.trim() || 'عدد',
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

  const downloadPackJson = (pack: PackTemplate) => {
    const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clientflow-pack-${pack.key}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportPackFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as PackTemplate;
      if (!parsed || !parsed.key || !parsed.name) {
        pushToast('ساختار فایل پک JSON معتبر نیست.', 'error');
      } else {
        importCustomPack(parsed);
      }
    } catch {
      pushToast('خطا در خواندن فایل پک JSON.', 'error');
    }
    e.target.value = '';
  };

  const handleDownloadConfigJson = () => {
    const json = exportConfigJson();
    const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clientflow-config-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleUploadConfigJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const res = importConfigJson(text);
    if (!res.ok) {
      pushToast(res.error ?? 'خطا در ورود پیکربندی', 'error');
    }
    e.target.value = '';
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
              ['general', 'پروفایل، ساعات و تنظیمات'],
              ['users', 'کاربران، نقش‌ها و شعب'],
              ['packs', 'تغییر پک صنعتی (Diff)'],
              ['config', 'فیلدها، خدمات و فرم‌ها'],
              ['tenants_data', 'چندسازمانی، دمو و پشتیبان'],
              ['security', 'امنیت و دسترسی PII'],
              ['trash', `سطل زباله (${toFa(trashCount)})`],
              ['entities', 'موجودیت‌های سفارشی'],
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

      {/* TAB 1: GENERAL, BRANCHES, NUMBERING, UX & PWA */}
      {tab === 'general' && (
        <>
          <form
            onSubmit={handleSaveGeneral}
            className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
          >
            <h2 className="text-sm font-semibold">پروفایل کسب‌وکار، مالیات، واحدها و ساعات کاری</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  نام تجاری کسب‌وکار
                </label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  نام حقوقی / ثبتی
                </label>
                <input
                  type="text"
                  value={profile.legalName ?? ''}
                  onChange={(e) => setProfile({ ...profile, legalName: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  کد اقتصادی / شناسه ملی
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={profile.economicCode ?? ''}
                  onChange={(e) => setProfile({ ...profile, economicCode: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  شماره ثبت
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={profile.registrationNo ?? ''}
                  onChange={(e) => setProfile({ ...profile, registrationNo: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  تلفن پشتیبانی / دفتر
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={profile.phone ?? ''}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  وب‌سایت / ایمیل
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={profile.website ?? ''}
                  onChange={(e) => setProfile({ ...profile, website: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <div className="sm:col-span-4">
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  نشانی دفتر مرکزی
                </label>
                <input
                  type="text"
                  value={profile.address ?? ''}
                  onChange={(e) => setProfile({ ...profile, address: e.target.value })}
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
                <label className="mb-1 flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-400">
                  <Coins size={13} className="text-amber-500" />
                  واحد پول / ارزش افزوده (٪)
                </label>
                <div className="flex gap-2">
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                    className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                  >
                    <option value="toman">تومان</option>
                    <option value="rial">ریال</option>
                    <option value="usd">دلار ($)</option>
                  </select>
                  <input
                    type="number"
                    min={0}
                    max={30}
                    value={taxRatePct}
                    onChange={(e) => setTaxRatePct(e.target.value)}
                    title="نرخ مالیات بر ارزش افزوده (٪)"
                    className="w-20 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  واحد پیش‌فرض / پورسانت (٪)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={defaultUnit}
                    onChange={(e) => setDefaultUnit(e.target.value)}
                    placeholder="عدد / جلسه"
                    className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                  />
                  <input
                    type="number"
                    min={0}
                    max={50}
                    value={commissionPct}
                    onChange={(e) => setCommissionPct(e.target.value)}
                    title="نرخ پورسانت پایه (٪)"
                    className="w-20 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
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
                ذخیره پروفایل و تنظیمات پایه
              </button>
            </div>
          </form>

          {/* Holidays (Jalali) & Notification Preferences */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <CalendarOff size={16} className="text-rose-500" />
                تعطیلات رسمی و تقویم تعطیلی (شمسی · {toFa(state.officialHolidays.length)})
              </h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!holidayJalali.trim() || !holidayTitle.trim()) return;
                  const iso = jalaliToIsoUtc(holidayJalali.trim());
                  const dateKey = iso ? iso.slice(0, 10) : new Date().toISOString().slice(0, 10);
                  addOfficialHoliday({ dateKey, jalaliDate: holidayJalali.trim(), title: holidayTitle.trim() });
                  setHolidayTitle('');
                }}
                className="flex flex-wrap items-end gap-2"
              >
                <div className="w-40">
                  <JalaliDatePicker value={holidayJalali} onChange={setHolidayJalali} />
                </div>
                <input
                  type="text"
                  required
                  placeholder="عنوان تعطیلی (مثلاً عید نوروز)..."
                  value={holidayTitle}
                  onChange={(e) => setHolidayTitle(e.target.value)}
                  className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-700"
                >
                  افزودن
                </button>
              </form>
              <div className="max-h-48 divide-y divide-slate-200 overflow-y-auto rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                {state.officialHolidays.map((h) => (
                  <div key={h.id} className="flex items-center justify-between px-3 py-2 text-xs">
                    <div>
                      <span className="font-mono font-semibold text-indigo-600 tabular-nums dark:text-indigo-400" dir="ltr">
                        {toFa(h.jalaliDate)}
                      </span>
                      <span className="mx-2 text-slate-400">·</span>
                      <span>{h.title}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeOfficialHoliday(h.id)}
                      className="p-1 text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <Bell size={16} className="text-indigo-500" />
                  ترجیحات اعلان و ساعات سکوت (Notification Preferences)
                </h2>
                <button
                  type="button"
                  onClick={() => updateSettings({ notifications })}
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                >
                  ذخیره اعلان‌ها
                </button>
              </div>

              <div className="space-y-2 text-xs">
                <label className="flex cursor-pointer items-center justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/50">
                  <span>ارسال یادآور خودکار پیامکی نوبت و فاکتور</span>
                  <input
                    type="checkbox"
                    checked={notifications.smsReminders}
                    onChange={(e) => setNotifications({ ...notifications, smsReminders: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                  />
                </label>
                <label className="flex cursor-pointer items-center justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/50">
                  <span>گزارش روزانه ایمیلی عملکرد فروش و تیکت‌ها</span>
                  <input
                    type="checkbox"
                    checked={notifications.emailDigest}
                    onChange={(e) => setNotifications({ ...notifications, emailDigest: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                  />
                </label>
                <label className="flex cursor-pointer items-center justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/50">
                  <span>هشدار لحظه‌ای نقض SLA تیکت‌ها و چک‌های سررسید</span>
                  <input
                    type="checkbox"
                    checked={notifications.slaBreachAlerts}
                    onChange={(e) => setNotifications({ ...notifications, slaBreachAlerts: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                  />
                </label>
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <div>
                    <label className="mb-1 block text-[11px] text-slate-500">ساعت خلاصه روزانه</label>
                    <input
                      type="number"
                      min={0}
                      max={23}
                      value={notifications.dailySummaryHour}
                      onChange={(e) =>
                        setNotifications({ ...notifications, dailySummaryHour: Number(e.target.value) || 9 })
                      }
                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-slate-500">شروع سکوت (شب)</label>
                    <input
                      type="number"
                      min={0}
                      max={23}
                      value={notifications.quietHoursStart}
                      onChange={(e) =>
                        setNotifications({ ...notifications, quietHoursStart: Number(e.target.value) || 22 })
                      }
                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-slate-500">پایان سکوت (صبح)</label>
                    <input
                      type="number"
                      min={0}
                      max={23}
                      value={notifications.quietHoursEnd}
                      onChange={(e) =>
                        setNotifications({ ...notifications, quietHoursEnd: Number(e.target.value) || 8 })
                      }
                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Multi-Branch Hierarchy (FR-CORE-04) */}
          <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <Building2 size={16} className="text-indigo-500" />
                  ساختار چندشعبه‌ای (Multi-Branch Hierarchy - FR-CORE-04)
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  تعریف شعبه‌ها و زیرشعبه‌ها و انتخاب شعبه فعال جهت تفکیک آمار داشبورد، فروش و نوبت‌ها.
                </p>
              </div>
              <select
                value={state.settings.activeBranchId}
                onChange={(e) => updateSettings({ activeBranchId: e.target.value })}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="all">نمایش تجمیعی همه شعبه‌ها</option>
                {state.branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    شعبه فعال: {b.name} ({b.city})
                  </option>
                ))}
              </select>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!brName.trim()) return;
                addBranch({
                  name: brName.trim(),
                  code: brCode.trim().toUpperCase() || `BR-${state.branches.length + 1}`,
                  city: brCity.trim() || 'تهران',
                  managerName: brManager.trim() || undefined,
                  parentBranchId: brParentId || undefined,
                  active: true,
                });
                setBrName('');
                setBrCode('');
                setBrCity('');
                setBrManager('');
              }}
              className="grid grid-cols-1 gap-2 sm:grid-cols-6"
            >
              <input
                type="text"
                required
                placeholder="نام شعبه..."
                value={brName}
                onChange={(e) => setBrName(e.target.value)}
                className="sm:col-span-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
              <input
                type="text"
                dir="ltr"
                placeholder="کد (SHZ-01)"
                value={brCode}
                onChange={(e) => setBrCode(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-left font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
              />
              <input
                type="text"
                placeholder="شهر"
                value={brCity}
                onChange={(e) => setBrCity(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
              <select
                value={brParentId}
                onChange={(e) => setBrParentId(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="">شعبه مادر (مستقل)</option>
                {state.branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    زیرشعبه: {b.name}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
              >
                <Plus size={14} />
                افزودن شعبه
              </button>
            </form>

            <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
              {state.branches.map((b) => {
                const parent = state.branches.find((p) => p.id === b.parentBranchId);
                return (
                  <div key={b.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-xs">
                    <div>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">{b.name}</span>
                      <span className="mx-2 font-mono text-[11px] text-indigo-600 dark:text-indigo-400">
                        ({b.code})
                      </span>
                      <span className="text-slate-500">
                        شهر: {b.city}
                        {b.managerName ? ` · مدیر: ${b.managerName}` : ''}
                        {parent ? ` · زیرمجموعه «${parent.name}»` : ' · ستاد اصلی'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => updateSettings({ activeBranchId: b.id })}
                        className={`rounded px-2 py-1 text-[11px] font-medium ${
                          state.settings.activeBranchId === b.id
                            ? 'bg-indigo-600 text-white'
                            : 'border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {state.settings.activeBranchId === b.id ? 'شعبه فعال' : 'انتخاب'}
                      </button>
                      {state.branches.length > 1 && (
                        <button
                          type="button"
                          onClick={() => deleteBranch(b.id)}
                          className="p-1 text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Configurable Jalali Numbering Pattern (FR-CORE-05) */}
          <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Hash size={16} className="text-emerald-500" />
              الگوی شماره‌گذاری شمسی اسناد (فاکتور، پیش‌فاکتور و سفارش - FR-CORE-05)
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
              <div>
                <label className="mb-1 block text-[11px] text-slate-500">پیشوند فاکتور</label>
                <input
                  type="text"
                  dir="ltr"
                  value={numbering.invoicePrefix}
                  onChange={(e) => setNumbering({ ...numbering, invoicePrefix: e.target.value.toUpperCase() })}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-slate-500">پیشوند پیش‌فاکتور</label>
                <input
                  type="text"
                  dir="ltr"
                  value={numbering.quotePrefix}
                  onChange={(e) => setNumbering({ ...numbering, quotePrefix: e.target.value.toUpperCase() })}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-slate-500">پیشوند سفارش</label>
                <input
                  type="text"
                  dir="ltr"
                  value={numbering.orderPrefix}
                  onChange={(e) => setNumbering({ ...numbering, orderPrefix: e.target.value.toUpperCase() })}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-slate-500">تعداد ارقام سریال</label>
                <select
                  value={numbering.padLength}
                  onChange={(e) => setNumbering({ ...numbering, padLength: Number(e.target.value) })}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
                >
                  {[3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>
                      {toFa(n)} رقمی
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-slate-500">جداکننده</label>
                <select
                  value={numbering.separator}
                  onChange={(e) => setNumbering({ ...numbering, separator: e.target.value as '-' | '/' })}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="-">خط تیره (-)</option>
                  <option value="/">اسلش (/)</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 px-3.5 py-2.5 text-xs dark:bg-slate-800/60">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={numbering.includeJalaliYear}
                  onChange={(e) => setNumbering({ ...numbering, includeJalaliYear: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                />
                <span>درج سال شمسی جاری در الگوی شماره سند</span>
              </label>

              <div className="flex flex-wrap items-center gap-3 font-mono text-indigo-600 dark:text-indigo-400" dir="ltr">
                <span>{formatDocumentNumber('invoice', 14, numbering)}</span>
                <span>·</span>
                <span>{formatDocumentNumber('quote', 8, numbering)}</span>
                <span>·</span>
                <span>{formatDocumentNumber('order', 25, numbering)}</span>
              </div>

              <button
                type="button"
                onClick={() => updateSettings({ numbering })}
                className="rounded-lg bg-indigo-600 px-3.5 py-1.5 font-medium text-white hover:bg-indigo-700"
              >
                ذخیره الگو
              </button>
            </div>
          </div>

          {/* UX Modes (Solo/Enterprise), Bilingual (fa/en), PWA Offline & Guided Tour */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Layers size={16} className="text-indigo-500" />
                نمای ساده / سازمانی و دوزبانه‌سازی (FR-CORE-06, FR-UX-07)
              </h2>

              <div>
                <div className="mb-1.5 text-xs text-slate-500">سطح نمایش رابط کاربری (UI Complexity)</div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => updateSettings({ uiMode: 'solo' })}
                    className={`rounded-lg border p-2.5 text-right text-xs ${
                      state.settings.uiMode === 'solo'
                        ? 'border-indigo-600 bg-indigo-50/70 font-semibold text-indigo-800 dark:border-indigo-500 dark:bg-indigo-950/40 dark:text-indigo-200'
                        : 'border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    نمای ساده (Solo)
                    <div className="mt-0.5 text-[10px] font-normal text-slate-500">
                      منوی خلوت و متمرکز بر عملیات روزمره
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSettings({ uiMode: 'enterprise' })}
                    className={`rounded-lg border p-2.5 text-right text-xs ${
                      state.settings.uiMode === 'enterprise'
                        ? 'border-indigo-600 bg-indigo-50/70 font-semibold text-indigo-800 dark:border-indigo-500 dark:bg-indigo-950/40 dark:text-indigo-200'
                        : 'border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    نمای سازمانی (Enterprise)
                    <div className="mt-0.5 text-[10px] font-normal text-slate-500">
                      تمام ماژول‌های BPMS، اتوماسیون و شعب
                    </div>
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
                <div className="flex items-center gap-2 text-xs">
                  <Globe size={15} className="text-sky-500" />
                  <span>زبان و جهت رابط:</span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => updateSettings({ language: 'fa' })}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                      state.settings.language === 'fa'
                        ? 'border-indigo-600 bg-indigo-600 text-white'
                        : 'border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    فارسی (RTL)
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSettings({ language: 'en' })}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                      state.settings.language === 'en'
                        ? 'border-indigo-600 bg-indigo-600 text-white'
                        : 'border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    English (LTR)
                  </button>
                </div>
              </div>

              <label className="flex cursor-pointer items-center justify-between text-xs">
                <span>نمایش ارقام به‌صورت لاتین (123 به جای ۱۲۳)</span>
                <input
                  type="checkbox"
                  checked={Boolean(state.settings.latinDigits)}
                  onChange={(e) => updateSettings({ latinDigits: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                />
              </label>
            </div>

            <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                {realOnline && !state.settings.simulatedOffline ? (
                  <Wifi size={16} className="text-emerald-500" />
                ) : (
                  <WifiOff size={16} className="text-amber-500" />
                )}
                حالت آفلاین PWA، نصب وب‌اپ و تور راهنما (FR-UX-03/08)
              </h2>

              <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-xs dark:border-slate-800 dark:bg-slate-800/40">
                <div className="flex items-center justify-between">
                  <span className="font-medium">وضعیت Service Worker و شبکه:</span>
                  <span
                    className={`font-semibold ${
                      realOnline && !state.settings.simulatedOffline
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {realOnline && !state.settings.simulatedOffline ? 'آنلاین (کش فعال)' : 'حالت آفلاین فعال'}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  فایل‌های هسته و LocalStorage برای کار بدون اینترنت در مرورگر و موبایل ذخیره می‌شوند.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={Boolean(state.settings.simulatedOffline)}
                    onChange={(e) => updateSettings({ simulatedOffline: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-amber-600"
                  />
                  <span>شبیه‌سازی حالت آفلاین (تست نوار وضعیت PWA)</span>
                </label>
                <PWAInstallButton lang={state.settings.language} />
              </div>

              {onStartTour && (
                <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-xs dark:border-slate-800">
                  <span className="text-slate-600 dark:text-slate-300">آموزش تعاملی قابلیت‌های سیستم</span>
                  <button
                    type="button"
                    onClick={onStartTour}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 font-medium text-indigo-700 hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-300"
                  >
                    <Compass size={14} />
                    اجرای مجدد تور راهنما
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Bot size={16} className="text-indigo-600 dark:text-indigo-400" />
                <h2 className="text-sm font-semibold">تنظیمات دستیار هوش مصنوعی (AI & Guardrails)</h2>
              </div>
              {onOpenAiCenter && (
                <button
                  type="button"
                  onClick={onOpenAiCenter}
                  className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 dark:border-indigo-900/50 dark:bg-indigo-950/40 dark:text-indigo-300"
                >
                  <Sparkles size={13} />
                  مشاهده مصرف AI و آزمون ۱۰ پرسش
                </button>
              )}
            </div>

            {(() => {
              const aiCfg = state.settings.ai ?? DEFAULT_AI_CONFIG;
              const hasEnvKey = isGeminiApiKeyConfigured();
              return (
                <div className="space-y-3 text-xs">
                  <div
                    className={`flex items-center gap-2 rounded-lg border p-3 ${
                      hasEnvKey
                        ? 'border-emerald-200 bg-emerald-50/70 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300'
                        : 'border-amber-200 bg-amber-50/70 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300'
                    }`}
                  >
                    <ShieldCheck size={15} className="shrink-0" />
                    <span>
                      {hasEnvKey
                        ? 'متغیر محیطی VITE_GEMINI_API_KEY در سرور/بیلد شناسایی شد و Gemini فعال است.'
                        : getAiMissingKeyFriendlyNotice()}
                    </span>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                      <div>
                        <div className="font-semibold text-slate-800 dark:text-slate-100">
                          فعال‌سازی هوش مصنوعی (AI)
                        </div>
                        <div className="text-[11px] text-slate-500">
                          با خاموش کردن، تمام فراخوانی‌های AI و چت متوقف می‌شوند.
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={aiCfg.enabled}
                        onChange={(e) =>
                          updateSettings({ ai: { ...aiCfg, enabled: e.target.checked } })
                        }
                        className="h-4 w-4 rounded accent-indigo-600"
                      />
                    </label>

                    <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                      <label className="mb-1 block font-semibold text-slate-800 dark:text-slate-100">
                        لحن پیش‌فرض برند در پیامک و پاسخ تیکت
                      </label>
                      <select
                        value={aiCfg.brandTone}
                        onChange={(e) =>
                          updateSettings({
                            ai: { ...aiCfg, brandTone: e.target.value as AiBrandTone },
                          })
                        }
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                      >
                        {(Object.keys(AI_BRAND_TONE_LABELS) as AiBrandTone[]).map((toneKey) => (
                          <option key={toneKey} value={toneKey}>
                            {AI_BRAND_TONE_LABELS[toneKey]}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                      <input
                        type="checkbox"
                        checked={aiCfg.maskPiiBeforeSend}
                        onChange={(e) =>
                          updateSettings({
                            ai: { ...aiCfg, maskPiiBeforeSend: e.target.checked },
                          })
                        }
                        className="h-4 w-4 rounded accent-indigo-600"
                      />
                      <span>ماسک خودکار موبایل، کد ملی و ایمیل (PII) پیش از ارسال</span>
                    </label>

                    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                      <input
                        type="checkbox"
                        checked={aiCfg.logUsage}
                        onChange={(e) =>
                          updateSettings({ ai: { ...aiCfg, logUsage: e.target.checked } })
                        }
                        className="h-4 w-4 rounded accent-indigo-600"
                      />
                      <span>ثبت گزارش فراخوانی و مصرف توکن در AI Usage</span>
                    </label>
                  </div>
                </div>
              );
            })()}
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
              <h2 className="text-sm font-semibold">خروجی و ورود پیکربندی JSON (Fields & Workflows)</h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                فقط ساختار فیلدهای سفارشی، پایپ‌لاین و قوانین را بین Tenantها جابجا کنید (بدون تغییر داده‌های مشتریان).
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleDownloadConfigJson}
                className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-xs font-medium text-indigo-700 hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-300"
              >
                <Download size={15} />
                خروجی JSON پیکربندی
              </button>
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-xs font-medium text-indigo-700 hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-300">
                <Upload size={15} />
                ورود پیکربندی JSON
                <input type="file" accept=".json,application/json" onChange={handleUploadConfigJson} className="hidden" />
              </label>
              <button
                type="button"
                onClick={handleDownloadJson}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Download size={15} />
                پشتیبان کامل JSON
              </button>
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                <Upload size={15} />
                بازیابی کامل JSON
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

      {/* TAB: USERS, ROLES, TEAMS & BRANCHES */}
      {tab === 'users' && <UsersRolesTab />}

      {/* TAB 2: INDUSTRY PACKS & PACK BUILDER */}
      {tab === 'packs' && (
        <div className="space-y-6">
          <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold">
                  کتابخانه {toFa(INDUSTRY_PACKS.length)} بسته صنعتی آماده (Industry Packs)
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  با نصب هر بسته، فیلدهای سفارشی، موجودیت‌های تخصصی، خدمات، محصولات، قالب پیام‌ها و گزارش‌ها به‌صورت غیرمخرب اضافه می‌شوند.
                </p>
              </div>
              {onOpenPackManager && (
                <button
                  type="button"
                  onClick={onOpenPackManager}
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                >
                  باز کردن Pack Manager کامل (پیش‌نمایش و خروجی)
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {INDUSTRY_PACKS.map((pk) => {
                const active = state.settings.industryPack === pk.key;
                const tierLabel = pk.tier === 'full' ? 'کامل' : pk.tier === 'medium' ? 'متوسط' : 'سبک';
                return (
                  <div
                    key={pk.id}
                    className={`flex flex-col justify-between rounded-xl border p-4 transition-colors ${
                      active
                        ? 'border-indigo-600 bg-indigo-50/50 dark:border-indigo-500 dark:bg-indigo-950/30'
                        : 'border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{pk.name}</span>
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {tierLabel}
                        </span>
                      </div>
                      <p className="mt-1.5 text-xs leading-5 text-slate-500 dark:text-slate-400">
                        {pk.description}
                      </p>
                      <div className="mt-2.5 flex flex-wrap gap-1.5 text-[10px] text-slate-500">
                        <span>{toFa(pk.customFields.length)} فیلد</span>
                        <span>·</span>
                        <span>{toFa(pk.customEntities.length)} موجودیت</span>
                        <span>·</span>
                        <span>{toFa(pk.services.length)} خدمت</span>
                        <span>·</span>
                        <span>{toFa(pk.products.length)} محصول</span>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-200/70 pt-3 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => setPendingPackKey(pk.key as IndustryPack)}
                        className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium ${
                          active
                            ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                            : 'bg-indigo-600 text-white hover:bg-indigo-700'
                        }`}
                      >
                        {active ? 'فعال (بررسی Diff و نصب مجدد)' : 'پیش‌نمایش Diff و تغییر پک'}
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadPackJson(pk)}
                        title="دانلود ساختار JSON پک"
                        className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        <Download size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pack Builder: Export & Import Custom Tenant Packs */}
          <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <PackagePlus size={16} className="text-indigo-500" />
                  پک‌ساز (Pack Builder): استخراج پک از تنظیمات فعلی و ورود پک JSON
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  تمامی فیلدهای سفارشی، موجودیت‌ها، خدمات، کالاها و قوانین فعلی شما را در قالب یک بسته قابل اشتراک‌گذاری ذخیره می‌کند.
                </p>
              </div>
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                <Upload size={14} />
                ورود پک JSON
                <input type="file" accept=".json,application/json" onChange={handleImportPackFile} className="hidden" />
              </label>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!pkName.trim()) return;
                const created = saveCustomPack({
                  name: pkName.trim(),
                  key: pkKey.trim() || `custom_${Date.now().toString(36)}`,
                  description: pkDesc.trim() || 'پک استخراج‌شده از Tenant فعلی',
                });
                setPkName('');
                setPkKey('');
                setPkDesc('');
                downloadPackJson(created);
              }}
              className="grid grid-cols-1 gap-2.5 sm:grid-cols-4"
            >
              <input
                type="text"
                required
                placeholder="نام پک سفارشی (مثلاً: کلینیک دندانپزشکی)"
                value={pkName}
                onChange={(e) => setPkName(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
              <input
                type="text"
                dir="ltr"
                placeholder="کلید انگلیسی (dental_pack)"
                value={pkKey}
                onChange={(e) => setPkKey(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-left font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
              />
              <input
                type="text"
                placeholder="توضیحات کوتاه پک..."
                value={pkDesc}
                onChange={(e) => setPkDesc(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
              >
                <Save size={14} />
                ساخت و دانلود JSON پک
              </button>
            </form>

            {state.customPacks.length > 0 && (
              <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                {state.customPacks.map((cp) => (
                  <div key={cp.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-xs">
                    <div>
                      <span className="font-semibold">{cp.name}</span>
                      <span className="mx-2 font-mono text-[11px] text-slate-400">({cp.key})</span>
                      <span className="text-slate-500">
                        · {toFa(cp.customFields.length)} فیلد، {toFa(cp.customEntities.length)} موجودیت،{' '}
                        {toFa(cp.rules.length)} قانون
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => downloadPackJson(cp)}
                        className="inline-flex items-center gap-1 rounded border border-slate-200 px-2.5 py-1 text-[11px] hover:bg-slate-50 dark:border-slate-700"
                      >
                        <Download size={12} />
                        خروجی JSON
                      </button>
                      <button
                        type="button"
                        onClick={() => applyIndustryPack(cp.key as IndustryPack, true)}
                        className="rounded bg-indigo-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-indigo-700"
                      >
                        اعمال پک
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: FIELDS & FORMS + SERVICES */}
      {tab === 'config' && (
        <div className="space-y-6">
          <FieldsAndFormsTab />

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
              <h2 className="mb-3 text-sm font-semibold">منابع (پرسنل، اتاق‌ها و تجهیزات)</h2>
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
                  placeholder="نام کارشناس، اتاق یا دستگاه..."
                  value={resName}
                  onChange={(e) => setResName(e.target.value)}
                  className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
                <select
                  value={resType}
                  onChange={(e) => setResType(e.target.value as 'staff' | 'room' | 'device')}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="staff">پزشک / پرسنل</option>
                  <option value="room">اتاق</option>
                  <option value="device">دستگاه / تجهیز</option>
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
                    <span className="text-slate-500">
                      {r.type === 'staff' ? 'پزشک / کارشناس' : r.type === 'device' ? 'دستگاه / تجهیز' : 'اتاق'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: CUSTOM ENTITIES, RELATIONS & CONFIG VERSIONING */}
      {tab === 'entities' && (
        <div className="space-y-6">
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

      {/* TAB: TENANTS, DEMO SCALE & BACKUP */}
      {tab === 'tenants_data' && <TenantsBackupDataTab />}

      {/* TAB: SECURITY, PASSWORD POLICY & DATA ACCESS LOG */}
      {tab === 'security' && <SecurityComplianceTab onTriggerLockScreen={onTriggerLockScreen} />}

      {/* TAB: SOFT DELETE TRASH & RESTORE */}
      {tab === 'trash' && <TrashRestoreTab />}

      {/* TAB 5: AUDIT LOGS */}
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

      <IndustryPackDiffModal
        diff={pendingPackKey ? computePackSwitchDiff(state, pendingPackKey) : null}
        onClose={() => setPendingPackKey(null)}
        onConfirm={(installDefaults, installSampleData) => {
          if (pendingPackKey) {
            applyIndustryPack(pendingPackKey, installDefaults, { installSampleData });
          }
          setPendingPackKey(null);
        }}
      />

      <SetupWizardModal open={wizardOpen} onClose={() => setWizardOpen(false)} />
    </div>
  );
}
