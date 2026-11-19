import { toFa } from '../../utils/jalali';

export interface TabItem<K extends string = string> {
  key: K;
  label: string;
  count?: number;
}

interface TabsProps<K extends string> {
  items: TabItem<K>[];
  activeKey: K;
  onChange: (key: K) => void;
  ariaLabel?: string;
}

export function Tabs<K extends string>({ items, activeKey, onChange, ariaLabel = 'تب‌ها' }: TabsProps<K>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-900"
    >
      {items.map((item) => {
        const active = item.key === activeKey;
        return (
          <button
            key={item.key}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(item.key)}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
              active
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
            }`}
          >
            <span>{item.label}</span>
            {typeof item.count === 'number' && (
              <span className="mr-1 tabular-nums text-[11px] text-slate-400 dark:text-slate-500">
                ({toFa(item.count)})
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
