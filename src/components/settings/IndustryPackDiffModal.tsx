import { useState } from 'react';
import { ArrowLeft, CheckCircle2, Layers, ShieldCheck, X } from 'lucide-react';
import type { PackSwitchDiff } from '../../utils/packDiff';
import { toFa } from '../../utils/jalali';

interface IndustryPackDiffModalProps {
  diff: PackSwitchDiff | null;
  onClose: () => void;
  onConfirm: (installDefaults: boolean, installSampleData?: boolean) => void;
}

export function IndustryPackDiffModal({
  diff,
  onClose,
  onConfirm,
}: IndustryPackDiffModalProps) {
  const [installDefaults, setInstallDefaults] = useState(true);
  const [installSampleData, setInstallSampleData] = useState(true);

  if (!diff) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
              <Layers size={16} className="text-indigo-500" />
              پیش‌نمایش تغییرات تغییر بسته صنعتی (Non-Destructive Diff)
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              {diff.currentPackName} → {diff.targetPackName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4 p-5 text-xs">
          {/* Zero Data Loss Guarantee */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 dark:border-emerald-900 dark:bg-emerald-950/30">
            <div className="flex items-center gap-2 font-semibold text-emerald-800 dark:text-emerald-300">
              <ShieldCheck size={15} />
              تضمین حفظ کامل داده‌ها و فیلدهای سفارشی
            </div>
            <div className="mt-1.5 flex flex-wrap gap-3 text-emerald-700 dark:text-emerald-300 tabular-nums">
              <span>مشتریان حفظ‌شده: {toFa(diff.preservedCustomerRecords)}</span>
              <span>·</span>
              <span>سفارش‌های حفظ‌شده: {toFa(diff.preservedOrdersCount)}</span>
              <span>·</span>
              <span>فیلدهای سفارشی فعلی (بدون حذف): {toFa(diff.keptCustomFieldsCount)}</span>
              <span>·</span>
              <span>پرونده‌های دارای مقدار CustomFields: {toFa(diff.preservedCustomFieldValuesCount)}</span>
            </div>
          </div>

          {/* Pipeline & Terminology Diff */}
          <div className="rounded-xl border border-slate-200 p-3.5 dark:border-slate-800">
            <div className="font-semibold text-slate-900 dark:text-slate-100">
              تغییر عنوان، ماژول‌های فعال ({toFa(diff.enabledModules.length)}) و مراحل پایپ‌لاین فروش
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
              <span className="rounded bg-slate-100 px-2 py-1 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                قبلی: {diff.oldPipelineName} ({diff.oldStagesLabels.join(' ← ')})
              </span>
              <ArrowLeft size={14} className="text-indigo-500" />
              <span className="rounded bg-indigo-50 px-2 py-1 font-semibold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                جدید: {diff.newPipelineName} ({diff.newStagesLabels.join(' ← ')})
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
              <input
                type="checkbox"
                checked={installDefaults}
                onChange={(e) => setInstallDefaults(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600"
              />
              <span className="font-medium text-slate-800 dark:text-slate-200">
                اقلام پیکربندی پک (فیلدهای سفارشی، خدمات، محصولات، قوانین غیرفعال، قالب پیام و گزارش‌ها) به‌صورت افزایشی اضافه شوند
              </span>
            </label>

            {diff.sampleDataCount > 0 && (
              <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
                <input
                  type="checkbox"
                  checked={installSampleData}
                  onChange={(e) => setInstallSampleData(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                />
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  افزودن داده‌های نمونه تخصصی این صنعت ({toFa(diff.sampleDataCount)} رکورد نمونه مشتری، سرنخ، سفارش، نوبت و تیکت بدون حذف داده‌های قبلی)
                </span>
              </label>
            )}
          </div>

          {installDefaults && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                <div className="font-semibold text-slate-800 dark:text-slate-200">
                  فیلدهای سفارشی جدید ({toFa(diff.newCustomFields.length)})
                </div>
                {diff.newCustomFields.length === 0 ? (
                  <p className="mt-1 text-[11px] text-slate-400">تمام فیلدهای این پک از قبل وجود دارند.</p>
                ) : (
                  <ul className="mt-1.5 space-y-1 text-[11px] text-slate-600 dark:text-slate-300">
                    {diff.newCustomFields.map((f) => (
                      <li key={f.key} className="flex items-center gap-1.5">
                        <CheckCircle2 size={12} className="text-emerald-500" />
                        <span>{f.label}</span>
                        <span className="font-mono text-[10px] text-slate-400">({f.key})</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                <div className="font-semibold text-slate-800 dark:text-slate-200">
                  اقلام عملیاتی، قالب‌ها و گزارش‌های جدید
                </div>
                <ul className="mt-1.5 space-y-1 text-[11px] text-slate-600 dark:text-slate-300 tabular-nums">
                  <li>+ {toFa(diff.newCustomEntities.length)} موجودیت تخصصی جدید</li>
                  <li>+ {toFa(diff.newServices.length)} خدمت جدید</li>
                  <li>+ {toFa(diff.newProducts.length)} کالا / پکیج جدید</li>
                  <li>+ {toFa(diff.newRules.length)} قانون اتوماسیون (متوقف/غیرفعال)</li>
                  <li>+ {toFa(diff.newWorkflows.length)} الگوی گردش‌کار (پیش‌نویس)</li>
                  <li>+ {toFa(diff.newMessageTemplates.length)} قالب پیام آماده</li>
                  <li>+ {toFa(diff.newDefaultReports.length)} گزارش پیش‌فرض BI</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3.5 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
          >
            انصراف
          </button>
          <button
            type="button"
            onClick={() => onConfirm(installDefaults, installSampleData)}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700"
          >
            تأیید و نصب / سوئیچ بسته صنعتی (بدون حذف داده)
          </button>
        </div>
      </div>
    </div>
  );
}
