import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileSpreadsheet, RotateCcw, Upload } from 'lucide-react';
import { useClientFlow } from '../store/useClientFlowStore';
import {
  type CsvImportMapping,
  type CsvImportResult,
  parseCsv,
  parseSpreadsheetFile,
  validateAndBuildCustomers,
} from '../utils/csv';
import { formatJalaliDateTime, toFa } from '../utils/jalali';
import { normalizeIranMobile } from '../utils/validators';
import { Badge, Button, Modal, Select } from './ui';

interface CsvImportModalProps {
  open: boolean;
  onClose: () => void;
}

const SAMPLE_CSV = `نام و نام خانوادگی,شماره تماس,کد ملی,شرکت,ایمیل,مسئول,برچسب,منبع آشنایی
مهشید تهرانی,09123334455,1000000018,,mahshid@example.ir,سارا محمدی,VIP | وفادار,اینستاگرام
کاوه اکبری,۰۹۳۵۴۴۴۵۵۶۶,,شرکت داده پرداز,kaveh@example.ir,امیر حسینی,حقوقی,سایت
مشتری بدون موبایل,12345,,,,جدید,معرفی
,09129998877,,,,,,حضوری
مریم صالحی تکراری,09121110001,,,,,تکراری,اینستاگرام`;

const MAPPING_FIELDS: { key: keyof CsvImportMapping; label: string }[] = [
  { key: 'nameCol', label: 'نام مشتری (الزامی)' },
  { key: 'phoneCol', label: 'شماره موبایل (الزامی)' },
  { key: 'nationalIdCol', label: 'کد ملی (اختیاری)' },
  { key: 'companyCol', label: 'نام شرکت (حقوقی)' },
  { key: 'emailCol', label: 'ایمیل' },
  { key: 'ownerCol', label: 'مسئول پیگیری' },
  { key: 'tagsCol', label: 'برچسب‌ها (جداشده با |)' },
  { key: 'sourceCol', label: 'منبع آشنایی' },
];

export function CsvImportModal({ open, onClose }: CsvImportModalProps) {
  const { state, importCustomersBatch, rollbackCsvImportBatch, pushToast } = useClientFlow();
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [fileName, setFileName] = useState('');
  const [mapping, setMapping] = useState<CsvImportMapping>({
    nameCol: '',
    phoneCol: '',
    emailCol: '',
    nationalIdCol: '',
    companyCol: '',
    tagsCol: '',
    sourceCol: '',
    ownerCol: '',
  });
  const [previewResult, setPreviewResult] = useState<CsvImportResult | null>(null);

  const existingPhones = useMemo(
    () => new Set(state.customers.map((c) => normalizeIranMobile(c.phone))),
    [state.customers],
  );

  const applyParsedData = (parsed: { headers: string[]; rows: string[][] }, label: string) => {
    setHeaders(parsed.headers);
    setRows(parsed.rows);
    setFileName(label);
    setPreviewResult(null);

    const autoFind = (keywords: string[]) =>
      parsed.headers.find((h) => keywords.some((k) => h.toLowerCase().includes(k))) ?? '';

    setMapping({
      nameCol: autoFind(['نام', 'name']) || parsed.headers[0] || '',
      phoneCol: autoFind(['موبایل', 'تلفن', 'شماره', 'phone', 'mobile']) || parsed.headers[1] || '',
      nationalIdCol: autoFind(['ملی', 'national']),
      companyCol: autoFind(['شرکت', 'سازمان', 'company']),
      emailCol: autoFind(['ایمیل', 'email', 'mail']),
      ownerCol: autoFind(['مسئول', 'کارشناس', 'owner']),
      tagsCol: autoFind(['برچسب', 'تگ', 'tag']),
      sourceCol: autoFind(['منبع', 'آشنایی', 'source']),
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = await parseSpreadsheetFile(file);
      if (parsed.headers.length === 0) {
        pushToast('فایل انتخاب‌شده خالی یا نامعتبر است.', 'error');
        return;
      }
      applyParsedData(parsed, file.name);
    } catch {
      pushToast('خطا در خواندن فایل CSV یا اکسل (XLSX).', 'error');
    }
  };

  const handleValidate = () => {
    const branchId = state.settings.activeBranchId !== 'all' ? state.settings.activeBranchId : undefined;
    const result = validateAndBuildCustomers(headers, rows, mapping, existingPhones, branchId);
    setPreviewResult(result);
  };

  const handleConfirmImport = () => {
    if (!previewResult || previewResult.validCustomers.length === 0) return;
    importCustomersBatch(previewResult.validCustomers, fileName || 'import.xlsx');
    handleReset();
    onClose();
  };

  const handleReset = () => {
    setHeaders([]);
    setRows([]);
    setFileName('');
    setPreviewResult(null);
  };

  const previewRows = useMemo(() => {
    const colIdx = (col?: string) => (col ? headers.indexOf(col) : -1);
    return rows.slice(0, 5).map((r, i) => ({
      rowNo: i + 2,
      name: colIdx(mapping.nameCol) >= 0 ? r[colIdx(mapping.nameCol)] : '',
      phone: colIdx(mapping.phoneCol) >= 0 ? r[colIdx(mapping.phoneCol)] : '',
      nationalId: colIdx(mapping.nationalIdCol) >= 0 ? r[colIdx(mapping.nationalIdCol)] : '',
      company: colIdx(mapping.companyCol) >= 0 ? r[colIdx(mapping.companyCol)] : '',
    }));
  }, [headers, rows, mapping]);

  return (
    <Modal open={open} onClose={onClose} title="ورود مشتریان از CSV / اکسل (XLSX) و بازگشت دسته‌ای" maxWidth="2xl">
      <div className="space-y-5">
        {headers.length === 0 ? (
          <div className="space-y-4">
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center transition-colors hover:border-indigo-500 hover:bg-indigo-50/40 dark:border-slate-700 dark:bg-slate-800/50">
              <Upload size={28} className="mb-2 text-indigo-600 dark:text-indigo-400" />
              <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
                فایل CSV یا اکسل (XLSX / XLS) را انتخاب کنید
              </span>
              <span className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                پشتیبانی کامل از فارسی UTF-8، اعداد فارسی و اعتبارسنجی کد ملی
              </span>
              <input
                type="file"
                accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                <FileSpreadsheet size={16} className="text-slate-400" />
                <span>بارگذاری فایل نمونه برای تست نگاشت ستون‌ها و گزارش خطای ردیف‌ها:</span>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => applyParsedData(parseCsv(SAMPLE_CSV), 'sample_customers.csv')}
              >
                بارگذاری نمونه تست
              </Button>
            </div>

            {state.csvImportBatches.length > 0 && (
              <div className="space-y-2 border-t border-slate-200 pt-4 dark:border-slate-800">
                <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  تاریخچه ورودهای دسته‌ای و بازگشت (Rollback)
                </h3>
                <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                  {state.csvImportBatches.map((batch) => (
                    <div key={batch.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-xs">
                      <div>
                        <span className="font-semibold text-slate-800 dark:text-slate-100">{batch.fileName}</span>
                        <span className="mx-2 text-slate-400">·</span>
                        <span className="tabular-nums">{toFa(batch.count)} رکورد</span>
                        <span className="mx-2 text-slate-400">·</span>
                        <span className="tabular-nums text-slate-400">{formatJalaliDateTime(batch.importedAt)}</span>
                      </div>
                      {batch.rolledBack ? (
                        <Badge tone="neutral">بازگشت‌داده‌شده</Badge>
                      ) : (
                        <Button variant="danger" size="sm" onClick={() => rollbackCsvImportBatch(batch.id)}>
                          <RotateCcw size={12} />
                          بازگشت کامل
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
              <div className="text-sm">
                فایل: <span className="font-semibold">{fileName}</span>
                <span className="mx-2 text-slate-400">·</span>
                <span className="tabular-nums text-slate-500">{toFa(rows.length)} ردیف داده</span>
              </div>
              <button type="button" onClick={handleReset} className="text-xs font-medium text-indigo-600 hover:underline">
                انتخاب فایل دیگر
              </button>
            </div>

            <div>
              <h3 className="mb-2 text-xs font-semibold">۱. نگاشت ستون‌های فایل به فیلدهای سیستم</h3>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                {MAPPING_FIELDS.map(({ key, label }) => (
                  <Select
                    key={key}
                    label={label}
                    value={mapping[key] ?? ''}
                    onChange={(e) => {
                      setMapping((m) => ({ ...m, [key]: e.target.value }));
                      setPreviewResult(null);
                    }}
                    options={[
                      { value: '', label: '-- انتخاب نشده --' },
                      ...headers.map((h) => ({ value: h, label: h })),
                    ]}
                  />
                ))}
              </div>
            </div>

            {/* 5-row Live Preview */}
            <div>
              <h4 className="mb-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                پیش‌نمایش ۵ ردیف اول پس از نگاشت
              </h4>
              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-500 dark:bg-slate-800">
                    <tr>
                      <th className="px-3 py-1.5">ردیف</th>
                      <th className="px-3 py-1.5">نام</th>
                      <th className="px-3 py-1.5">موبایل</th>
                      <th className="px-3 py-1.5">کد ملی</th>
                      <th className="px-3 py-1.5">شرکت</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {previewRows.map((pr) => (
                      <tr key={pr.rowNo}>
                        <td className="px-3 py-1.5 tabular-nums">{toFa(pr.rowNo)}</td>
                        <td className="px-3 py-1.5">{pr.name || '—'}</td>
                        <td className="px-3 py-1.5 tabular-nums" dir="ltr">{toFa(pr.phone || '—')}</td>
                        <td className="px-3 py-1.5 tabular-nums" dir="ltr">{toFa(pr.nationalId || '—')}</td>
                        <td className="px-3 py-1.5">{pr.company || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {!previewResult ? (
              <div className="flex justify-end">
                <Button size="md" onClick={handleValidate}>
                  بررسی اعتبار و تولید گزارش خطا
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 text-xs font-medium text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
                    <CheckCircle2 size={16} />
                    <span className="tabular-nums">{toFa(previewResult.validCustomers.length)} ردیف معتبر آماده ورود</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-xs font-medium text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
                    <AlertTriangle size={16} />
                    <span className="tabular-nums">{toFa(previewResult.errors.length)} ردیف دارای خطا</span>
                  </div>
                </div>

                {previewResult.errors.length > 0 && (
                  <div className="max-h-40 overflow-auto rounded-lg border border-slate-200 dark:border-slate-800">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-50 text-slate-500 dark:bg-slate-800">
                        <tr>
                          <th className="px-3 py-1.5">ردیف</th>
                          <th className="px-3 py-1.5">نام</th>
                          <th className="px-3 py-1.5">موبایل</th>
                          <th className="px-3 py-1.5">دلیل خطا</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {previewResult.errors.map((err) => (
                          <tr key={err.rowNumber}>
                            <td className="px-3 py-1.5 tabular-nums">{toFa(err.rowNumber)}</td>
                            <td className="px-3 py-1.5">{err.rawName || '—'}</td>
                            <td className="px-3 py-1.5 tabular-nums" dir="ltr">{err.rawPhone || '—'}</td>
                            <td className="px-3 py-1.5 text-rose-600 dark:text-rose-400">{err.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="flex justify-end gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
                  <Button variant="secondary" size="md" onClick={onClose}>
                    انصراف
                  </Button>
                  <Button
                    size="md"
                    disabled={previewResult.validCustomers.length === 0}
                    onClick={handleConfirmImport}
                  >
                    ورود {toFa(previewResult.validCustomers.length)} مشتری معتبر
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
