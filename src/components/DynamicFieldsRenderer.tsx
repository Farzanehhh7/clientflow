import { useMemo } from 'react';
import type { CustomFieldDef } from '../types';
import { evalCustomFormula, isFieldVisible } from '../utils/crmHelpers';
import { formatToman, toFa } from '../utils/jalali';
import { useClientFlow } from '../store/useClientFlowStore';

interface DynamicFieldsRendererProps {
  defs: CustomFieldDef[];
  values: Record<string, string>;
  onChange: (nextValues: Record<string, string>) => void;
}

export function DynamicFieldsRenderer({ defs, values, onChange }: DynamicFieldsRendererProps) {
  const { state } = useClientFlow();

  const sortedDefs = useMemo(
    () => [...defs].sort((a, b) => (a.order ?? 999) - (b.order ?? 999)),
    [defs],
  );

  const visibleDefs = sortedDefs.filter((def) => isFieldVisible(def, values));
  if (visibleDefs.length === 0) return null;

  const setField = (key: string, val: string) => {
    onChange({ ...values, [key]: val });
  };

  const getLookupOptions = (entity: CustomFieldDef['lookupEntity']) => {
    switch (entity) {
      case 'customer':
        return state.customers.map((c) => ({ value: c.name, label: `${c.name} (${toFa(c.phone)})` }));
      case 'product':
        return state.products.map((p) => ({ value: p.name, label: `${p.name} (${formatToman(p.price)})` }));
      case 'service':
        return state.services.map((s) => ({ value: s.name, label: `${s.name} (${toFa(s.durationMin)} دقیقه)` }));
      case 'resource':
        return state.resources.map((r) => ({ value: r.name, label: r.name }));
      default:
        return [];
    }
  };

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {visibleDefs.map((def) => {
        const val = values[def.key] ?? '';

        if (def.type === 'formula') {
          const computed = evalCustomFormula(def.formulaExpr, values);
          return (
            <div key={def.id}>
              <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
                {def.label} <span className="text-[10px] text-indigo-500">(محاسبه خودکار)</span>
              </label>
              <div
                dir="ltr"
                className="rounded-lg border border-indigo-200 bg-indigo-50/50 px-3 py-2 text-left text-sm font-semibold tabular-nums text-indigo-700 dark:border-indigo-900/60 dark:bg-indigo-950/30 dark:text-indigo-300"
              >
                {toFa(computed)}
              </div>
            </div>
          );
        }

        if (def.type === 'select') {
          return (
            <div key={def.id}>
              <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
                {def.label} {def.required && '*'}
              </label>
              <select
                required={def.required}
                value={val}
                onChange={(e) => setField(def.key, e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="">-- انتخاب کنید --</option>
                {(def.options ?? []).map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          );
        }

        if (def.type === 'multiselect') {
          const selected = val
            .split('،')
            .map((x) => x.trim())
            .filter(Boolean);
          const toggleOpt = (opt: string) => {
            const next = selected.includes(opt)
              ? selected.filter((s) => s !== opt)
              : [...selected, opt];
            setField(def.key, next.join('، '));
          };
          return (
            <div key={def.id} className="sm:col-span-2">
              <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
                {def.label} {def.required && '*'}
              </label>
              <div className="flex flex-wrap gap-1.5 rounded-lg border border-slate-200 bg-slate-50/50 p-2 dark:border-slate-700 dark:bg-slate-800/50">
                {(def.options ?? []).map((opt) => {
                  const active = selected.includes(opt);
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => toggleOpt(opt)}
                      className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                        active
                          ? 'border-indigo-600 bg-indigo-600 text-white'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        }

        if (def.type === 'lookup') {
          const opts = getLookupOptions(def.lookupEntity);
          return (
            <div key={def.id}>
              <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
                {def.label} {def.required && '*'}
              </label>
              <select
                required={def.required}
                value={val}
                onChange={(e) => setField(def.key, e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="">-- انتخاب از رکوردهای سیستم --</option>
                {opts.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          );
        }

        if (def.type === 'file') {
          return (
            <div key={def.id}>
              <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
                {def.label} {def.required && '*'}
              </label>
              <div className="flex items-center gap-2">
                <label className="cursor-pointer rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  انتخاب فایل
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) setField(def.key, f.name);
                    }}
                  />
                </label>
                <span className="truncate text-xs text-slate-500">{val || 'فایلی انتخاب نشده'}</span>
              </div>
            </div>
          );
        }

        if (def.type === 'date') {
          return (
            <div key={def.id}>
              <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
                {def.label} (شمسی یا میلادی) {def.required && '*'}
              </label>
              <input
                type="text"
                dir="ltr"
                required={def.required}
                value={val}
                onChange={(e) => setField(def.key, e.target.value)}
                placeholder="1405/08/28"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm tabular-nums dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          );
        }

        const inputType =
          def.type === 'number' || def.type === 'money'
            ? 'number'
            : def.type === 'phone'
              ? 'tel'
              : 'text';

        return (
          <div key={def.id}>
            <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
              {def.label}
              {def.type === 'money' && ' (تومان)'}
              {def.required && ' *'}
            </label>
            <input
              type={inputType}
              required={def.required}
              dir={def.type === 'phone' || def.type === 'nationalId' || def.type === 'money' || def.type === 'number' ? 'ltr' : undefined}
              maxLength={def.type === 'nationalId' ? 10 : undefined}
              value={val}
              onChange={(e) => setField(def.key, e.target.value)}
              placeholder={
                def.type === 'phone'
                  ? '09120000000'
                  : def.type === 'nationalId'
                    ? '0012345678'
                    : undefined
              }
              className={`w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 ${
                inputType !== 'text' || def.type === 'nationalId' ? 'text-left tabular-nums' : ''
              }`}
            />
          </div>
        );
      })}
    </div>
  );
}
