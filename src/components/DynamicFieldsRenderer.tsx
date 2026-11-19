import { useMemo } from 'react';
import { useClientFlow } from '../store/useClientFlowStore';
import type { CustomFieldDef, CustomFieldEntity } from '../types';
import { evalCustomFormula, isFieldVisible } from '../utils/crmHelpers';
import { getFieldsForEntity } from '../utils/customFieldValidation';
import { formatToman, toFa } from '../utils/jalali';
import { JalaliDatePicker } from './ui/JalaliDatePicker';

interface DynamicFieldsRendererProps {
  defs: CustomFieldDef[];
  values: Record<string, string>;
  onChange: (nextValues: Record<string, string>) => void;
  entity?: CustomFieldEntity;
  errors?: Record<string, string>;
}

export function DynamicFieldsRenderer({
  defs,
  values,
  onChange,
  entity,
  errors = {},
}: DynamicFieldsRendererProps) {
  const { state } = useClientFlow();

  const sortedDefs = useMemo(() => getFieldsForEntity(defs, entity, false), [defs, entity]);
  const visibleDefs = sortedDefs.filter((def) => isFieldVisible(def, values));
  if (visibleDefs.length === 0) return null;

  const setField = (key: string, val: string) => {
    onChange({ ...values, [key]: val });
  };

  const getLookupOptions = (lookupEntity: CustomFieldDef['lookupEntity']) => {
    switch (lookupEntity) {
      case 'customer':
        return state.customers
          .filter((c) => !c.isDeleted)
          .map((c) => ({ value: c.name, label: `${c.name} (${toFa(c.phone)})` }));
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
        const err = errors[def.key];

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

        if (def.type === 'checkbox') {
          return (
            <div key={def.id} className="flex flex-col justify-center">
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={val === 'true'}
                  onChange={(e) => setField(def.key, e.target.checked ? 'true' : 'false')}
                />
                <span>
                  {def.label} {def.required && '*'}
                </span>
              </label>
              {err && <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400">{err}</p>}
            </div>
          );
        }

        if (def.type === 'date') {
          return (
            <div key={def.id}>
              <JalaliDatePicker
                label={`${def.label}${def.required ? ' *' : ''}`}
                value={val}
                onChange={(jalaliAscii) => setField(def.key, jalaliAscii)}
                error={err}
              />
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
                value={val}
                onChange={(e) => setField(def.key, e.target.value)}
                className={`w-full rounded-lg border bg-white px-3 py-2 text-sm dark:bg-slate-800 ${
                  err ? 'border-rose-400' : 'border-slate-200 dark:border-slate-700'
                }`}
              >
                <option value="">-- انتخاب کنید --</option>
                {(def.options ?? []).map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              {err && <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400">{err}</p>}
            </div>
          );
        }

        if (def.type === 'multiselect') {
          const selected = val
            .split(/[،,]/)
            .map((x) => x.trim())
            .filter(Boolean);
          const toggleOpt = (opt: string) => {
            const next = selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt];
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
              {err && <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400">{err}</p>}
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
                value={val}
                onChange={(e) => setField(def.key, e.target.value)}
                className={`w-full rounded-lg border bg-white px-3 py-2 text-sm dark:bg-slate-800 ${
                  err ? 'border-rose-400' : 'border-slate-200 dark:border-slate-700'
                }`}
              >
                <option value="">-- انتخاب از رکوردهای سیستم --</option>
                {opts.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              {err && <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400">{err}</p>}
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
              {err && <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400">{err}</p>}
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
              {def.unique && <span className="mr-1 text-[10px] text-amber-600">(یکتا)</span>}
            </label>
            <input
              type={inputType}
              dir={
                def.type === 'phone' || def.type === 'nationalId' || def.type === 'money' || def.type === 'number'
                  ? 'ltr'
                  : undefined
              }
              maxLength={def.type === 'nationalId' ? 10 : def.validation?.maxLength}
              value={val}
              onChange={(e) => setField(def.key, e.target.value)}
              placeholder={
                def.type === 'phone' ? '09120000000' : def.type === 'nationalId' ? '0012345678' : undefined
              }
              className={`w-full rounded-lg border bg-white px-3 py-2 text-sm dark:bg-slate-800 ${
                err ? 'border-rose-400' : 'border-slate-200 dark:border-slate-700'
              } ${inputType !== 'text' || def.type === 'nationalId' ? 'text-left tabular-nums' : ''}`}
            />
            {err && <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400">{err}</p>}
          </div>
        );
      })}
    </div>
  );
}
