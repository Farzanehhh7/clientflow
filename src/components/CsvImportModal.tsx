import { useMemo, useState } from 'react';
import { Upload, AlertTriangle, CheckCircle2, FileSpreadsheet, RotateCcw } from 'lucide-react';
import { useClientFlow } from '../store/useClientFlowStore';
import {
  type CsvImportMapping,
  type CsvImportResult,
  parseCsv,
  validateAndBuildCustomers,
} from '../utils/csv';
import { formatJalaliDateTime, toFa } from '../utils/jalali';
import { Modal } from './Modal';

interface CsvImportModalProps {
  open: boolean;
  onClose: () => void;
}

const SAMPLE_CSV = `نام و نام خانوادگی,شماره تماس,ایمیل,برچسب,منبع آشنایی
مهشید تهرانی,09123334455,mahshid@example.ir,VIP | کلینیک,اینستاگرام
کاوه اکبری,۰۹۳۵۴۴۴۵۵۶۶,kaveh@example.ir,فروشگاه,سایت
مشتری بدون موبایل,12345,,جدید,معرفی
,09129998877,,پیگیری,حضوری
مریم صالحی تکراری,09121110001,,,اینستاگرام`;

export function CsvImportModal({ open, onClose }: CsvImportModalProps) {
  const { state, importCustomersBatch, rollbackCsvImportBatch } = useClientFlow();
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [fileName, setFileName] = useState('');
  const [mapping, setMapping] = useState<CsvImportMapping>({
    nameCol: '',
    phoneCol: '',
    emailCol: '',
    tagsCol: '',
    sourceCol: '',
  });
  const [previewResult, setPreviewResult] = useState<CsvImportResult | null>(null);

  const existingPhones = useMemo(() => new Set(state.customers.map((c) => c.phone)), [state.customers]);

  const loadCsvText = (text: string, label: string) => {
    const parsed = parseCsv(text);
    setHeaders(parsed.headers);
    setRows(parsed.rows);
    setFileName(label);
    setPreviewResult(null);

    const autoFind = (keywords: string[]) =>
      parsed.headers.find((h) => keywords.some((k) => h.toLowerCase().includes(k))) ?? '';

    setMapping({
      nameCol: autoFind(['نام', 'name']) || parsed.headers[0] || '',
      phoneCol: autoFind(['موبایل', 'تلفن', 'شماره', 'phone', 'mobile']) || parsed.headers[1] || '',
      emailCol: autoFind(['ایمیل', 'email', 'mail']),
      tagsCol: autoFind(['برچسب', 'تگ', 'tag']),
      sourceCol: autoFind(['منبع', 'آشنایی', 'source']),
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    loadCsvText(text, file.name);
  };

  const handleValidate = () => {
    const result = validateAndBuildCustomers(headers, rows, mapping, existingPhones);
    setPreviewResult(result);
  };

  const handleConfirmImport = () => {
    if (!previewResult || previewResult.validCustomers.length === 0) return;
    importCustomersBatch(previewResult.validCustomers, fileName || 'import.csv');
    handleReset();
    onClose();
  };

  const handleReset = () => {
    setHeaders([]);
    setRows([]);
    setFileName('');
    setPreviewResult(null);
  };

  return (
    <Modal open={open} onClose={onClose} title="ورود مشتریان از CSV و بازگشت دسته‌ای (Rollback)" maxWidth="2xl">
      <div className="space-y-5">
        {headers.length === 0 ? (
          <div className="space-y-4">
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center transition-colors hover:border-indigo-500 hover:bg-indigo-50/40 dark:border-slate-700 dark:bg-slate-800/50 dark:hover:border-indigo-500">
              <Upload size={28} className="mb-2 text-indigo-600 dark:text-indigo-400" />
              <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
                فایل CSV را انتخاب کنید یا اینجا رها کنید
              </span>
              <span className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                پشتیبانی از کاراکترهای فارسی UTF-8 و اعداد فارسی/انگلیسی
              </span>
              <input type="file" accept=".csv,text/csv" onChange={handleFileChange} className="hidden" />
            </label>

            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                <FileSpreadsheet size={16} className="text-slate-400" />
                <span>برای آزمایش سریع نگاشت، گزارش خطا و تست بازگشت دسته‌ای از نمونه استفاده کنید.</span>
              </div>
              <button
                type="button"
                onClick={() => loadCsvText(SAMPLE_CSV, 'sample_customers.csv')}
                className="shrink-0 whitespace-nowrap rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                بارگذاری نمونه تست
              </button>
            </div>

            {/* Import Batch History & Rollback */}
            {state.csvImportBatches.length > 0 && (
              <div className="space-y-2 border-t border-slate-200 pt-4 dark:border-slate-800">
                <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  تاریخچه ورودهای دسته‌ای و بازگشت (Rollback)
                </h3>
                <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                  {state.csvImportBatches.map((batch) => (
                    <div
                      key={batch.id}
                      className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-xs"
                    >
                      <div>
                        <span className="font-semibold text-slate-800 dark:text-slate-100">
                          {batch.fileName}
                        </span>
                        <span className="mx-2 text-slate-400">·</span>
                        <span className="tabular-nums text-slate-600 dark:text-slate-300">
                          {toFa(batch.count)} رکورد
                        </span>
                        <span className="mx-2 text-slate-400">·</span>
                        <span className="tabular-nums text-slate-400">
                          {formatJalaliDateTime(batch.importedAt)}
                        </span>
                      </div>
                      {batch.rolledBack ? (
                        <span className="rounded bg-slate-100 px-2.5 py-1 text-[11px] text-slate-500 dark:bg-slate-800">
                          بازگشت‌داده‌شده
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => rollbackCsvImportBatch(batch.id)}
                          className="inline-flex items-center gap-1 rounded border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-medium text-rose-700 hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300"
                        >
                          <RotateCcw size={12} />
                          بازگشت کامل این ایمپورت
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
              <div className="text-sm">
                فایل: <span className="font-semibold">{fileName}</span>
                <span className="mx-2 text-slate-400">·</span>
                <span className="tabular-nums text-slate-500 dark:text-slate-400">
                  {toFa(rows.length)} ردیف داده
                </span>
              </div>
              <button
                type="button"
                onClick={handleReset}
                className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
              >
                انتخاب فایل دیگر
              </button>
            </div>

            <div>
              <h3 className="mb-3 text-sm font-semibold">۱. نگاشت ستون‌های فایل به فیلدهای سیستم</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {(
                  [
                    ['nameCol', 'نام مشتری (الزامی)'],
                    ['phoneCol', 'شماره موبایل (الزامی)'],
                    ['emailCol', 'ایمیل'],
                    ['tagsCol', 'برچسب‌ها (جداشده با |)'],
                    ['sourceCol', 'منبع آشنایی'],
                  ] as const
                ).map(([field, label]) => (
                  <div key={field}>
                    <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">{label}</label>
                    <select
                      value={mapping[field]}
                      onChange={(e) => {
                        setMapping((m) => ({ ...m, [field]: e.target.value }));
                        setPreviewResult(null);
                      }}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                    >
                      <option value="">-- انتخاب نشده --</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {!previewResult ? (
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleValidate}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  بررسی و پیش‌نمایش خطاها
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 text-sm text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
                    <CheckCircle2 size={18} />
                    <span className="tabular-nums">
                      {toFa(previewResult.validCustomers.length)} ردیف معتبر آماده ورود
                    </span>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
                    <AlertTriangle size={18} />
                    <span className="tabular-nums">{toFa(previewResult.errors.length)} ردیف دارای خطا</span>
                  </div>
                </div>

                {previewResult.errors.length > 0 && (
                  <div>
                    <h4 className="mb-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                      گزارش ردیف‌های خطادار
                    </h4>
                    <div className="max-h-44 overflow-auto rounded-lg border border-slate-200 dark:border-slate-800">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                          <tr>
                            <th className="px-3 py-2 font-medium">ردیف</th>
                            <th className="px-3 py-2 font-medium">نام</th>
                            <th className="px-3 py-2 font-medium">موبایل</th>
                            <th className="px-3 py-2 font-medium">دلیل خطا</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                          {previewResult.errors.map((err) => (
                            <tr key={err.rowNumber}>
                              <td className="px-3 py-2 tabular-nums">{toFa(err.rowNumber)}</td>
                              <td className="px-3 py-2">{err.rawName || '—'}</td>
                              <td className="px-3 py-2 tabular-nums" dir="ltr">
                                {err.rawPhone || '—'}
                              </td>
                              <td className="px-3 py-2 text-rose-600 dark:text-rose-400">{err.reason}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    انصراف
                  </button>
                  <button
                    type="button"
                    disabled={previewResult.validCustomers.length === 0}
                    onClick={handleConfirmImport}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    ورود {toFa(previewResult.validCustomers.length)} مشتری معتبر
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
