import { useState } from 'react';
import {
  Building,
  CheckCircle2,
  Database,
  Download,
  Eraser,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { INDUSTRY_PACKS } from '../../data/packs';
import { useClientFlow } from '../../store/useClientFlowStore';
import type { IndustryPack } from '../../types';
import { CURRENT_SCHEMA_VERSION } from '../../utils/backupMigration';
import { PACK_LABELS } from '../../utils/i18n';
import { formatJalaliDateTime, toFa } from '../../utils/jalali';
import { ConfirmDialog } from '../ui';

const SCALE_STEPS: (10 | 100 | 1000 | 10000)[] = [10, 100, 1000, 10000];

export function TenantsBackupDataTab() {
  const {
    state,
    tenants,
    activeTenantId,
    createTenant,
    switchTenant,
    renameTenant,
    deleteTenant,
    exportStateJson,
    importStateJson,
    generateScaleDemoData,
    clearTenantData,
    resetDemoData,
    pushToast,
  } = useClientFlow();

  // Multi-Tenant create
  const [newTenantName, setNewTenantName] = useState('');
  const [newTenantPack, setNewTenantPack] = useState<IndustryPack>('shop');
  const [newTenantSeed, setNewTenantSeed] = useState<0 | 10 | 100>(10);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');

  // Scale Demo Generator
  const [scaleIdx, setScaleIdx] = useState<number>(1); // default 100
  const [appendMode, setAppendMode] = useState(false);

  // Confirm dialogs
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [keepConfigOnClear, setKeepConfigOnClear] = useState(true);

  // Migration Report
  const [migrationReport, setMigrationReport] = useState<{
    fromVersion: number;
    toVersion: number;
    steps: string[];
  } | null>(null);

  const selectedScaleCount = SCALE_STEPS[scaleIdx] ?? 100;

  const handleCreateTenant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTenantName.trim()) return;
    createTenant({
      name: newTenantName.trim(),
      industryPack: newTenantPack,
      demoCount: newTenantSeed,
    });
    setNewTenantName('');
  };

  const handleDownloadBackup = () => {
    const json = exportStateJson();
    const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clientflow-tenant-${activeTenantId}-v${CURRENT_SCHEMA_VERSION}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleUploadBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const res = importStateJson(text);
    if (!res.ok) {
      pushToast(res.error ?? 'خطا در بازیابی فایل پشتیبان', 'error');
      setMigrationReport(null);
    } else if (res.migrationInfo) {
      setMigrationReport(res.migrationInfo);
    }
    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      {/* Multi-Tenant Simulation */}
      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            <Building size={16} className="text-indigo-500" />
            شبیه‌سازی چندسازمانی (Multi-Tenant Simulation · {toFa(tenants.length)} کسب‌وکار)
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            اطلاعات هر کسب‌وکار به‌صورت مجزا در LocalStorage ذخیره می‌شود و می‌توانید بدون خروج از برنامه بین شرکت‌ها/شعب مستقل جابجا شوید.
          </p>
        </div>

        <form onSubmit={handleCreateTenant} className="grid grid-cols-1 gap-2.5 sm:grid-cols-5">
          <input
            type="text"
            required
            placeholder="نام کسب‌وکار جدید (مثلاً: فروشگاه آنلاین نوین)..."
            value={newTenantName}
            onChange={(e) => setNewTenantName(e.target.value)}
            className="sm:col-span-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
          />
          <select
            value={newTenantPack}
            onChange={(e) => setNewTenantPack(e.target.value as IndustryPack)}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
          >
            {INDUSTRY_PACKS.map((pk) => (
              <option key={pk.key} value={pk.key}>
                {pk.name}
              </option>
            ))}
          </select>
          <select
            value={newTenantSeed}
            onChange={(e) => setNewTenantSeed(Number(e.target.value) as 0 | 10 | 100)}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
          >
            <option value={0}>شروع خالی (۰ مشتری)</option>
            <option value={10}>با ۱۰ مشتری نمونه</option>
            <option value={100}>با ۱۰۰ مشتری نمونه</option>
          </select>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
          >
            <Plus size={14} />
            ایجاد Tenant جدید
          </button>
        </form>

        <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
          {tenants.map((t) => {
            const isActive = t.id === activeTenantId;
            return (
              <div key={t.id} className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-3 text-xs">
                <div className="min-w-0 flex-1">
                  {renamingId === t.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={renameText}
                        onChange={(e) => setRenameText(e.target.value)}
                        className="rounded border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-800"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          renameTenant(t.id, renameText);
                          setRenamingId(null);
                        }}
                        className="rounded bg-emerald-600 px-2.5 py-1 text-[11px] text-white"
                      >
                        ثبت
                      </button>
                      <button
                        type="button"
                        onClick={() => setRenamingId(null)}
                        className="text-[11px] text-slate-500"
                      >
                        لغو
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-slate-100">{t.name}</span>
                        {isActive && (
                          <span className="rounded bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                            فعال
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-500 tabular-nums">
                        صنعت: {PACK_LABELS[t.industryPack]?.fa ?? t.industryPack} · {toFa(t.customerCount)} مشتری · آخرین تغییر: {formatJalaliDateTime(t.updatedAt)}
                      </div>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {!isActive && (
                    <button
                      type="button"
                      onClick={() => switchTenant(t.id)}
                      className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                    >
                      ورود به این Tenant
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setRenamingId(t.id);
                      setRenameText(t.name);
                    }}
                    className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                  >
                    تغییر نام
                  </button>
                  {tenants.length > 1 && (
                    <button
                      type="button"
                      onClick={() => deleteTenant(t.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600"
                      title="حذف Tenant"
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

      {/* Demo Scale Generator + Clear Data */}
      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            <Database size={16} className="text-emerald-500" />
            تولید داده آزمایشی مقیاس‌پذیر (۱۰ تا ۱۰٬۰۰۰ مشتری) و پاک‌سازی
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            برای تست عملکرد جداول، فیلترها و گزارش‌ساز در مقیاس واقعی، تعداد مشتریان را با اسلایدر انتخاب کنید.
          </p>
        </div>

        <div className="space-y-3 rounded-lg bg-slate-50 p-4 dark:bg-slate-800/50">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              تعداد مشتریان تستی:{' '}
              <strong className="text-base tabular-nums text-indigo-600 dark:text-indigo-400">
                {toFa(selectedScaleCount.toLocaleString('en-US'))}
              </strong>{' '}
              رکورد
            </span>
            <label className="flex cursor-pointer items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={appendMode}
                onChange={(e) => setAppendMode(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600"
              />
              <span>افزودن به داده‌های فعلی (به‌جای جایگزینی)</span>
            </label>
          </div>

          <input
            type="range"
            min={0}
            max={3}
            step={1}
            value={scaleIdx}
            onChange={(e) => setScaleIdx(Number(e.target.value))}
            aria-label="تعداد مشتریان دمو"
            className="w-full accent-indigo-600"
          />

          <div className="flex justify-between text-[11px] font-medium tabular-nums text-slate-500">
            {SCALE_STEPS.map((val, i) => (
              <button
                key={val}
                type="button"
                onClick={() => setScaleIdx(i)}
                className={`rounded px-2 py-0.5 ${
                  scaleIdx === i
                    ? 'bg-indigo-600 text-white'
                    : 'hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {toFa(val.toLocaleString('en-US'))} مشتری
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => generateScaleDemoData(selectedScaleCount, appendMode)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700"
            >
              <Sparkles size={14} />
              تولید {toFa(selectedScaleCount.toLocaleString('en-US'))} مشتری و داده‌های مرتبط
            </button>
            <button
              type="button"
              onClick={resetDemoData}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <RotateCcw size={14} />
              بازنشانی به نمونه اولیه
            </button>
          </div>

          <button
            type="button"
            onClick={() => setConfirmClearOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-medium text-rose-700 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300"
          >
            <Eraser size={14} />
            پاک‌سازی کامل داده‌ها (Clear Data)
          </button>
        </div>
      </div>

      {/* Schema-Versioned Backup & Migration Restore */}
      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              پشتیبان‌گیری کامل Tenant و بازیابی با Migration (Schema v{toFa(CURRENT_SCHEMA_VERSION)})
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              خروجی JSON شامل کل داده‌ها، تنظیمات، نقش‌ها و فیلدهای سفارشی با شماره نسخه اسکیما؛ نسخه‌های قدیمی (v1/v2/v3) هنگام ورود به‌صورت خودکار Migrate می‌شوند.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleDownloadBackup}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-emerald-700"
            >
              <Download size={14} />
              خروجی کامل JSON (v{toFa(CURRENT_SCHEMA_VERSION)})
            </button>
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-xs font-medium text-indigo-700 hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-300">
              <Upload size={14} />
              بازیابی و Migration از JSON
              <input
                type="file"
                accept=".json,application/json"
                onChange={handleUploadBackup}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {migrationReport && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3.5 text-xs dark:border-emerald-900 dark:bg-emerald-950/30">
            <div className="flex items-center gap-1.5 font-semibold text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 size={15} />
              گزارش مهاجرت اسکیما (Schema Migration v{toFa(migrationReport.fromVersion)} → v{toFa(migrationReport.toVersion)})
            </div>
            <ul className="mt-2 list-disc space-y-1 pr-5 text-emerald-700 dark:text-emerald-300">
              {migrationReport.steps.map((s, idx) => (
                <li key={idx}>{s}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmClearOpen}
        onClose={() => setConfirmClearOpen(false)}
        onConfirm={() => clearTenantData(keepConfigOnClear)}
        title="پاک‌سازی داده‌های Tenant فعلی"
        message={
          keepConfigOnClear
            ? 'تمام مشتریان، سفارش‌ها، فاکتورها، نوبت‌ها، تیکت‌ها و گزارش‌ها پاک می‌شوند اما فیلدهای سفارشی، خدمات و تنظیمات حفظ می‌شوند. ادامه می‌دهید؟'
            : 'تمام داده‌ها و پیکربندی‌های Tenant فعلی به حالت صفر بازنشانی می‌شوند. ادامه می‌دهید؟'
        }
        confirmLabel="تأیید پاک‌سازی"
      />
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={keepConfigOnClear}
            onChange={(e) => setKeepConfigOnClear(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-indigo-600"
          />
          <span>هنگام «پاک‌سازی داده‌ها (Clear Data)»، فیلدهای سفارشی و پیکربندی کسب‌وکار حفظ شوند</span>
        </label>
      </div>
    </div>
  );
}
