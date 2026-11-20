import { useMemo, useState } from 'react';
import { Download, FileSpreadsheet, RotateCcw } from 'lucide-react';
import {
  ACCOUNTING_PRESET_LABELS,
  getDefaultAccountingMapping,
} from '../../services/providers/webhookAndOpenApi';
import { useClientFlow } from '../../store/useClientFlowStore';
import type { AccountingFieldMapping, AccountingSoftwarePreset } from '../../types';
import { exportRowsToCsv, exportRowsToXlsx } from '../../utils/csv';
import { formatJalali, formatToman, toFa } from '../../utils/jalali';

export function AccountingExportTab() {
  const { state, updateIntegrationsConfig, pushToast } = useClientFlow();

  const cfg = state.integrationsConfig;
  const preset = cfg?.accountingPreset ?? 'sepidar';
  const mappings = cfg?.accountingMappings ?? getDefaultAccountingMapping(preset);

  const [exportEntity, setExportEntity] = useState<'invoices' | 'customers'>('invoices');

  const handlePresetChange = (nextPreset: AccountingSoftwarePreset) => {
    updateIntegrationsConfig({
      accountingPreset: nextPreset,
      accountingMappings: getDefaultAccountingMapping(nextPreset),
    });
  };

  const updateMappingRow = (sourceKey: string, patch: Partial<AccountingFieldMapping>) => {
    const next = mappings.map((m) => (m.sourceKey === sourceKey ? { ...m, ...patch } : m));
    updateIntegrationsConfig({ accountingMappings: next });
  };

  const activeMappings = useMemo(() => mappings.filter((m) => m.enabled), [mappings]);

  // Build preview + export matrix
  const exportDataset = useMemo(() => {
    const custMap = new Map(state.customers.map((c) => [c.id, c]));

    if (exportEntity === 'customers') {
      const headers = ['کد تفصیلی', 'نام شخص / شرکت', 'نوع', 'شماره تماس', 'کد ملی / شناسه', 'کد اقتصادی', 'آدرس پیش‌فرض'];
      const rows = state.customers
        .filter((c) => !c.isDeleted)
        .map((c) => [
          c.patientCode || c.id.toUpperCase(),
          c.name,
          c.personType === 'organization' ? 'حقوقی' : 'حقیقی',
          c.phone,
          c.nationalId || '—',
          c.economicCode || '—',
          c.addresses?.[0]?.address || '—',
        ]);
      return { headers, rows };
    }

    const headers = activeMappings.map((m) => m.targetColumn);
    const rows = state.invoices.map((inv) => {
      const cust = custMap.get(inv.customerId);
      const valMap: Record<string, string | number> = {
        invoiceNo: inv.invoiceNo,
        issuedAtJalali: formatJalali(inv.issuedAt),
        customerCode: cust?.patientCode || inv.customerId.toUpperCase(),
        customerName: cust?.name ?? 'مشتری',
        nationalId: cust?.nationalId ?? '—',
        economicCode: cust?.economicCode ?? '—',
        subtotal: inv.subtotal,
        discountTotal: inv.discount,
        taxTotal: inv.tax,
        grandTotal: inv.grandTotal,
        paidAmount: inv.paidAmount,
        debitAccount: mappings.find((m) => m.sourceKey === 'debitAccount')?.accountCode || '110301',
        creditAccount: mappings.find((m) => m.sourceKey === 'creditAccount')?.accountCode || '410101',
      };
      return activeMappings.map((m) => valMap[m.sourceKey] ?? '');
    });
    return { headers, rows };
  }, [exportEntity, activeMappings, mappings, state.customers, state.invoices]);

  const handleDownloadCsv = () => {
    const csv = exportRowsToCsv(exportDataset.headers, exportDataset.rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clientflow-${preset}-${exportEntity}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    pushToast(`خروجی CSV با فرمت ${ACCOUNTING_PRESET_LABELS[preset]} آماده شد.`);
  };

  const handleDownloadXlsx = () => {
    exportRowsToXlsx(
      exportEntity === 'invoices' ? 'Invoices' : 'Customers',
      exportDataset.headers,
      exportDataset.rows,
      `clientflow-${preset}-${exportEntity}.xlsx`,
    );
    pushToast(`فایل اکسل استاندارد ${ACCOUNTING_PRESET_LABELS[preset]} دانلود شد.`);
  };

  return (
    <div className="space-y-5">
      {/* Preset & Export Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div>
            <label className="mb-1 block text-[11px] text-slate-500">الگوی نرم‌افزار حسابداری مقصد</label>
            <select
              value={preset}
              onChange={(e) => handlePresetChange(e.target.value as AccountingSoftwarePreset)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-medium dark:border-slate-700 dark:bg-slate-800"
            >
              {(Object.keys(ACCOUNTING_PRESET_LABELS) as AccountingSoftwarePreset[]).map((k) => (
                <option key={k} value={k}>
                  {ACCOUNTING_PRESET_LABELS[k]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[11px] text-slate-500">موجودیت خروجی</label>
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setExportEntity('invoices')}
                className={`rounded-md px-3 py-1 font-medium ${
                  exportEntity === 'invoices'
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                فاکتورهای فروش ({toFa(state.invoices.length)})
              </button>
              <button
                type="button"
                onClick={() => setExportEntity('customers')}
                className={`rounded-md px-3 py-1 font-medium ${
                  exportEntity === 'customers'
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                طرف‌حساب / تفصیلی ({toFa(state.customers.length)})
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handlePresetChange(preset)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
          >
            <RotateCcw size={13} />
            بازنشانی نگاشت
          </button>
          <button
            type="button"
            onClick={handleDownloadCsv}
            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-xs font-medium text-indigo-700 hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-300"
          >
            <Download size={14} />
            خروجی CSV (UTF-8 BOM)
          </button>
          <button
            type="button"
            onClick={handleDownloadXlsx}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
          >
            <FileSpreadsheet size={14} />
            خروجی Excel (.xlsx)
          </button>
        </div>
      </div>

      {/* Field Mapping Screen (for Invoices) */}
      {exportEntity === 'invoices' && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-3 text-sm font-semibold">
            صفحه نگاشت ستون‌ها و کدینگ معین ({ACCOUNTING_PRESET_LABELS[preset]})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800">
                <tr>
                  <th className="py-2">فعال</th>
                  <th className="py-2">فیلد مبدأ در ClientFlow</th>
                  <th className="py-2">عنوان ستون در فایل نرم‌افزار حسابداری</th>
                  <th className="py-2">کد حساب معین پیش‌فرض (اختیاری)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {mappings.map((m) => (
                  <tr key={m.sourceKey}>
                    <td className="py-2">
                      <input
                        type="checkbox"
                        checked={m.enabled}
                        onChange={(e) => updateMappingRow(m.sourceKey, { enabled: e.target.checked })}
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                      />
                    </td>
                    <td className="py-2 font-medium text-slate-700 dark:text-slate-200">{m.sourceLabel}</td>
                    <td className="py-2">
                      <input
                        type="text"
                        value={m.targetColumn}
                        onChange={(e) => updateMappingRow(m.sourceKey, { targetColumn: e.target.value })}
                        className="w-full max-w-xs rounded border border-slate-200 bg-white px-2.5 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
                      />
                    </td>
                    <td className="py-2">
                      {m.accountCode !== undefined ? (
                        <input
                          type="text"
                          dir="ltr"
                          value={m.accountCode}
                          onChange={(e) => updateMappingRow(m.sourceKey, { accountCode: e.target.value })}
                          className="w-28 rounded border border-slate-200 bg-white px-2.5 py-1 font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
                        />
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Preview Table */}
      <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold dark:border-slate-800">
          پیش‌نمایش فایل خروجی ({toFa(exportDataset.rows.length)} ردیف)
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="border-b border-slate-200 bg-slate-50/70 text-slate-500 dark:border-slate-800 dark:bg-slate-800/40">
              <tr>
                {exportDataset.headers.map((h, i) => (
                  <th key={i} className="whitespace-nowrap px-3 py-2.5 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {exportDataset.rows.slice(0, 12).map((row, rIdx) => (
                <tr key={rIdx}>
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="whitespace-nowrap px-3 py-2 tabular-nums text-slate-700 dark:text-slate-300">
                      {typeof cell === 'number' ? formatToman(cell) : toFa(String(cell))}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
