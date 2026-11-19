import React, { useId } from 'react';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options?: SelectOption[];
}

export function Select({ label, error, options, id, className = '', children, ...rest }: SelectProps) {
  const autoId = useId();
  const selectId = id ?? autoId;

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={selectId} className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
          {label}
        </label>
      )}
      <select
        id={selectId}
        aria-invalid={Boolean(error) || undefined}
        className={`w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 transition-colors focus:outline-none focus:ring-2 dark:bg-slate-800 dark:text-slate-100 ${
          error
            ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/20 dark:border-rose-700'
            : 'border-slate-200 focus:border-indigo-500 focus:ring-indigo-500/20 dark:border-slate-700'
        } ${className}`}
        {...rest}
      >
        {options
          ? options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))
          : children}
      </select>
      {error && <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400">{error}</p>}
    </div>
  );
}
