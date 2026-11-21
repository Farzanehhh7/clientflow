import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  ShieldAlert,
  Trash2,
  XCircle,
} from 'lucide-react';
import { useClientFlow } from '../../store/useClientFlowStore';
import type { SecurityPolicyConfig } from '../../types';
import { formatJalaliDateTime, toFa } from '../../utils/jalali';
import {
  DEFAULT_SECURITY_POLICY,
  shouldMaskPii,
  validatePasswordAgainstPolicy,
} from '../../utils/security';

interface SecurityComplianceTabProps {
  onTriggerLockScreen?: () => void;
}

export function SecurityComplianceTab({ onTriggerLockScreen }: SecurityComplianceTabProps) {
  const { state, updateSettings, clearDataAccessLogs } = useClientFlow();
  const [policy, setPolicy] = useState<SecurityPolicyConfig>({
    ...DEFAULT_SECURITY_POLICY,
    ...(state.settings.security ?? {}),
  });
  const [testPassword, setTestPassword] = useState('ClientFlow@2026');
  const [logSearch, setLogSearch] = useState('');

  const piiMaskedForCurrent = shouldMaskPii(state);
  const validation = useMemo(
    () => validatePasswordAgainstPolicy(testPassword, policy),
    [testPassword, policy],
  );

  const accessLogs = useMemo(() => {
    const logs = state.dataAccessLogs ?? [];
    if (!logSearch.trim()) return logs;
    const q = logSearch.trim().toLowerCase();
    return logs.filter(
      (l) =>
        l.actorName.toLowerCase().includes(q) ||
        l.entityLabel.toLowerCase().includes(q) ||
        l.actorRole.toLowerCase().includes(q),
    );
  }, [logSearch, state.dataAccessLogs]);

  const handleSaveSecurity = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({ security: policy });
  };

  return (
    <div className="space-y-6">
      {/* Session Timeout & Password Policy */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <form
          onSubmit={handleSaveSecurity}
          className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <Clock size={16} className="text-indigo-500" />
              نشست امن (Session Timeout) و سیاست رمز عبور
            </h2>
            {onTriggerLockScreen && (
              <button
                type="button"
                onClick={onTriggerLockScreen}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
              >
                <Lock size={13} />
                قفل فوری نشست (شبیه‌ساز Timeout)
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 text-xs">
            <div>
              <label className="mb-1 block text-slate-500">مدت عدم فعالیت تا قفل</label>
              <select
                value={policy.sessionTimeoutMin}
                onChange={(e) => setPolicy({ ...policy, sessionTimeoutMin: Number(e.target.value) })}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
              >
                <option value={0}>غیرفعال</option>
                <option value={1}>۱ دقیقه (تست سریع)</option>
                <option value={5}>۵ دقیقه</option>
                <option value={15}>۱۵ دقیقه</option>
                <option value={30}>۳۰ دقیقه</option>
                <option value={60}>۶۰ دقیقه</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-slate-500">حداقل طول رمز عبور</label>
              <input
                type="number"
                min={6}
                max={32}
                value={policy.minPasswordLength}
                onChange={(e) =>
                  setPolicy({ ...policy, minPasswordLength: Math.max(6, Number(e.target.value) || 8) })
                }
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block text-slate-500">انقضای رمز (روز)</label>
              <input
                type="number"
                min={15}
                max={365}
                value={policy.passwordExpiryDays}
                onChange={(e) =>
                  setPolicy({ ...policy, passwordExpiryDays: Math.max(15, Number(e.target.value) || 90) })
                }
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>

          <div className="space-y-2 border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={policy.requireUppercase}
                onChange={(e) => setPolicy({ ...policy, requireUppercase: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600"
              />
              <span>الزام وجود حداقل یک حرف بزرگ انگلیسی (A–Z)</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={policy.requireNumber}
                onChange={(e) => setPolicy({ ...policy, requireNumber: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600"
              />
              <span>الزام وجود حداقل یک رقم عددی (0–9)</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={policy.requireSymbol}
                onChange={(e) => setPolicy({ ...policy, requireSymbol: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600"
              />
              <span>الزام وجود کاراکتر ویژه (!@#$%)</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={policy.requireMfaSimulated}
                onChange={(e) => setPolicy({ ...policy, requireMfaSimulated: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600"
              />
              <span>الزام ورود دومرحله‌ای پیامکی (MFA شبیه‌ساز)</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={policy.logCustomerAccess}
                onChange={(e) => setPolicy({ ...policy, logCustomerAccess: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600"
              />
              <span>ثبت خودکار Data-Access Log هنگام مشاهده پرونده ۳۶۰ مشتری</span>
            </label>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700"
            >
              ذخیره سیاست امنیتی
            </button>
          </div>
        </form>

        {/* Simulated Password Policy Tester & PII Masking Status */}
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            <KeyRound size={16} className="text-emerald-500" />
            آزمایشگر سیاست رمز عبور و وضعیت ماسک PII
          </h2>

          <div className="space-y-2 text-xs">
            <label className="block text-slate-500">تست تطابق رمز عبور با سیاست فعلی:</label>
            <input
              type="text"
              dir="ltr"
              value={testPassword}
              onChange={(e) => setTestPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
            />
            <div className="space-y-1.5 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
              {validation.checks.map((c) => (
                <div key={c.key} className="flex items-center gap-2 text-xs">
                  {c.passed ? (
                    <CheckCircle2 size={14} className="shrink-0 text-emerald-600" />
                  ) : (
                    <XCircle size={14} className="shrink-0 text-rose-500" />
                  )}
                  <span className={c.passed ? 'text-slate-700 dark:text-slate-200' : 'text-rose-600 dark:text-rose-400'}>
                    {c.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 p-3.5 text-xs dark:border-slate-800">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-slate-100">
                {piiMaskedForCurrent ? (
                  <EyeOff size={15} className="text-amber-600" />
                ) : (
                  <Eye size={15} className="text-emerald-600" />
                )}
                وضعیت نمایش PII برای حساب فعلی
              </span>
              <span
                className={`font-semibold ${
                  piiMaskedForCurrent
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {piiMaskedForCurrent ? 'ماسک فعال (۰۹۱۲***۶۷۸)' : 'نمایش کامل مجاز'}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              برای آزمایش ماسک خودکار شماره موبایل و کد ملی، از تب «کاربران و نقش‌ها» نقش کاربر فعال را به «کارشناس فروش» یا «پشتیبانی» تغییر دهید و لیست مشتریان را بررسی کنید.
            </p>
          </div>
        </div>
      </div>

      {/* Data Access Log */}
      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <ShieldAlert size={16} className="text-indigo-500" />
              گزارش دسترسی به داده‌های مشتریان (Data-Access Log · {toFa(accessLogs.length)})
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              هر زمان کاربری پرونده ۳۶۰ مشتری را باز کند، نام کاربر، نقش، وضعیت ماسک PII و زمان دقیق آن ثبت می‌شود.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="جستجو در کاربر یا مشتری..."
              value={logSearch}
              onChange={(e) => setLogSearch(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
            />
            {accessLogs.length > 0 && (
              <button
                type="button"
                onClick={clearDataAccessLogs}
                className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-400"
              >
                <Trash2 size={13} />
                پاک‌سازی گزارش
              </button>
            )}
          </div>
        </div>

        {accessLogs.length === 0 ? (
          <p className="py-8 text-center text-xs text-slate-500">
            هنوز دسترسی به پرونده مشتریان ثبت نشده است.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="w-full text-right text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">
                <tr>
                  <th className="px-3 py-2 font-semibold">کاربر مشاهده‌کننده</th>
                  <th className="px-3 py-2 font-semibold">نقش</th>
                  <th className="px-3 py-2 font-semibold">پرونده هدف</th>
                  <th className="px-3 py-2 font-semibold">نوع عملیات</th>
                  <th className="px-3 py-2 font-semibold">وضعیت PII</th>
                  <th className="px-3 py-2 font-semibold">زمان (شمسی)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {accessLogs.slice(0, 50).map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                    <td className="px-3 py-2 font-semibold text-slate-900 dark:text-slate-100">
                      {log.actorName}
                    </td>
                    <td className="px-3 py-2 text-slate-500">{log.actorRole}</td>
                    <td className="px-3 py-2 font-medium text-indigo-600 dark:text-indigo-400">
                      {log.entityLabel}
                    </td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                      {log.action === 'view_360'
                        ? 'مشاهده پرونده ۳۶۰'
                        : log.action === 'export'
                          ? 'خروجی فایل'
                          : 'مشاهده PII'}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`text-[11px] font-medium ${
                          log.piiMasked
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {log.piiMasked ? 'ماسک‌شده' : 'کامل'}
                      </span>
                    </td>
                    <td className="px-3 py-2 tabular-nums text-slate-500">
                      {formatJalaliDateTime(log.at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
