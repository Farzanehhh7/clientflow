import { useState } from 'react';
import { Download, Plus, RotateCcw, Trash2, Upload } from 'lucide-react';
import { useClientFlow } from '../store/useClientFlowStore';
import type { CustomFieldDef, IndustryPack, UserRole } from '../types';
import { formatJalaliDateTime, formatToman, toFa } from '../utils/jalali';

export function SettingsPage() {
  const {
    state,
    updateSettings,
    exportStateJson,
    importStateJson,
    resetDemoData,
    addCustomFieldDef,
    removeCustomFieldDef,
    addService,
    addResource,
    pushToast,
  } = useClientFlow();

  const [tab, setTab] = useState<'general' | 'config' | 'audit'>('general');

  const [businessName, setBusinessName] = useState(state.settings.businessName);
  const [workStartHour, setWorkStartHour] = useState(state.settings.workStartHour);
  const [workEndHour, setWorkEndHour] = useState(state.settings.workEndHour);
  const [commissionPct, setCommissionPct] = useState(String(state.settings.commissionPct));

  // Custom field builder
  const [cfLabel, setCfLabel] = useState('');
  const [cfType, setCfType] = useState<CustomFieldDef['type']>('text');
  const [cfOptions, setCfOptions] = useState('');

  // Service & Resource builder
  const [srvName, setSrvName] = useState('');
  const [srvDuration, setSrvDuration] = useState('30');
  const [srvPrice, setSrvPrice] = useState('500000');
  const [resName, setResName] = useState('');
  const [resType, setResType] = useState<'staff' | 'room'>('staff');

  const handleSaveGeneral = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({
      businessName: businessName.trim() || 'ClientFlow',
      workStartHour,
      workEndHour,
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
    const key = `cf_${Date.now().toString(36)}`;
    addCustomFieldDef({
      key,
      label: cfLabel.trim(),
      type: cfType,
      options:
        cfType === 'select'
          ? cfOptions
              .split(/[,،]/)
              .map((o) => o.trim())
              .filter(Boolean)
          : undefined,
    });
    setCfLabel('');
    setCfOptions('');
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1 w-fit dark:bg-slate-900">
        {(
          [
            ['general', 'تنظیمات کسب‌وکار و بسته صنعتی'],
            ['config', 'فیلدهای پویا، خدمات و منابع'],
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

      {tab === 'general' && (
        <>
          <form
            onSubmit={handleSaveGeneral}
            className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
          >
            <h2 className="text-sm font-semibold">مشخصات کسب‌وکار، ساعات کاری و پورسانت</h2>
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
                  نرخ پورسانت فروش (٪)
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
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {(
                [
                  ['clinic', 'کلینیک و مطب', 'پرونده مراجع، رضایت‌نامه، یادآوری ویزیت کنترل'],
                  ['shop', 'فروشگاه آنلاین', 'کاتالوگ محصول، کد تخفیف، پیگیری سفارش رهاشده'],
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
              در نقش «کارشناس (Staff)»، بخش‌های اتوماسیون و تنظیمات مخفی می‌شوند و امکان حذف مشتری یا تأیید مراحل مدیریتی وجود ندارد.
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
                دریافت یا بازیابی خروجی کامل وضعیت برنامه (مناسب انتقال به ASP.NET Core و SQL Server).
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
          {/* Dynamic Custom Fields */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-1 text-sm font-semibold">فیلدهای سفارشی پویا برای مشتری (CustomJson)</h2>
            <p className="mb-4 text-xs text-slate-500">
              فیلدهای تعریف‌شده در اینجا به‌صورت خودکار در فرم افزودن/ویرایش و پرونده ۳۶۰ درجه مشتری نمایش داده می‌شوند.
            </p>
            <form onSubmit={handleAddCustomField} className="mb-4 flex flex-wrap gap-2">
              <input
                type="text"
                placeholder="عنوان فیلد (مثلاً: شماره بیمه)"
                value={cfLabel}
                onChange={(e) => setCfLabel(e.target.value)}
                className="min-w-[180px] flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
              <select
                value={cfType}
                onChange={(e) => setCfType(e.target.value as CustomFieldDef['type'])}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="text">متنی</option>
                <option value="number">عددی</option>
                <option value="select">انتخابی (لیست)</option>
              </select>
              {cfType === 'select' && (
                <input
                  type="text"
                  placeholder="گزینه‌ها با ویرگول..."
                  value={cfOptions}
                  onChange={(e) => setCfOptions(e.target.value)}
                  className="min-w-[180px] rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
              )}
              <button
                type="submit"
                className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
              >
                <Plus size={14} />
                افزودن فیلد
              </button>
            </form>

            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {state.customFieldDefs.map((f) => (
                <div key={f.id} className="flex items-center justify-between py-2.5 text-xs">
                  <div>
                    <span className="font-semibold">{f.label}</span>
                    <span className="mx-2 text-slate-400">·</span>
                    <span className="text-slate-500">
                      نوع: {f.type === 'text' ? 'متنی' : f.type === 'number' ? 'عددی' : 'لیست انتخابی'}
                      {f.options && ` (${f.options.join('، ')})`}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeCustomFieldDef(f.id)}
                    className="p-1 text-slate-400 hover:text-rose-600"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Services & Resources */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="mb-3 text-sm font-semibold">خدمات نوبت‌دهی</h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!srvName.trim()) return;
                  addService({
                    name: srvName.trim(),
                    durationMin: Math.max(5, Number(srvDuration) || 30),
                    price: Math.max(0, Number(srvPrice) || 0),
                  });
                  setSrvName('');
                }}
                className="mb-4 flex flex-wrap gap-2"
              >
                <input
                  type="text"
                  placeholder="نام خدمت..."
                  value={srvName}
                  onChange={(e) => setSrvName(e.target.value)}
                  className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
                <input
                  type="number"
                  placeholder="دقیقه"
                  value={srvDuration}
                  onChange={(e) => setSrvDuration(e.target.value)}
                  className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
                />
                <input
                  type="number"
                  placeholder="تعرفه"
                  value={srvPrice}
                  onChange={(e) => setSrvPrice(e.target.value)}
                  className="w-24 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                >
                  افزودن
                </button>
              </form>
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {state.services.map((s) => (
                  <div key={s.id} className="flex items-center justify-between py-2 text-xs">
                    <span>
                      {s.name} · <span className="tabular-nums text-slate-500">{toFa(s.durationMin)} دقیقه</span>
                    </span>
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
    </div>
  );
}
