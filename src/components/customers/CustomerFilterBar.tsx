import { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import { useDebouncedValue } from '../../hooks/useDebounce';
import type {
  CustomerLifecycle,
  CustomerPersonType,
  CustomerSavedViewFilter,
  CustomerSegment,
} from '../../types';
import { Select } from '../ui';

interface CustomerFilterBarProps {
  filters: CustomerSavedViewFilter;
  segments: CustomerSegment[];
  ownersList: string[];
  dynamicTags: string[];
  onUpdateFilter: <K extends keyof CustomerSavedViewFilter>(key: K, value: CustomerSavedViewFilter[K]) => void;
}

export function CustomerFilterBar({
  filters,
  segments,
  ownersList,
  dynamicTags,
  onUpdateFilter,
}: CustomerFilterBarProps) {
  const [localQuery, setLocalQuery] = useState(filters.query);
  const debouncedQuery = useDebouncedValue(localQuery, 180);

  // Sync external updates (e.g. saved view / AI NL filter / reset)
  useEffect(() => {
    setLocalQuery(filters.query);
  }, [filters.query]);

  // Propagate debounced query to store/filtering hook
  useEffect(() => {
    if (debouncedQuery !== filters.query) {
      onUpdateFilter('query', debouncedQuery);
    }
  }, [debouncedQuery, filters.query, onUpdateFilter]);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <div className="relative lg:col-span-2">
          <Search
            size={15}
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            aria-label="جستجوی مشتریان"
            value={localQuery}
            onChange={(e) => setLocalQuery(e.target.value)}
            placeholder="جستجوی فازی نام، شرکت، موبایل، کد ملی..."
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pr-9 pl-8 text-sm focus:border-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-slate-800 dark:bg-slate-900"
          />
          {localQuery && (
            <button
              type="button"
              aria-label="پاک کردن جستجو"
              onClick={() => {
                setLocalQuery('');
                onUpdateFilter('query', '');
              }}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <Select
          aria-label="فیلتر سگمنت"
          value={filters.activeSegmentId}
          onChange={(e) => onUpdateFilter('activeSegmentId', e.target.value)}
          options={[
            { value: 'all', label: 'همه سگمنت‌ها' },
            ...segments.map((s) => ({ value: s.id, label: `سگمنت: ${s.name}` })),
          ]}
        />

        <Select
          aria-label="فیلتر چرخه عمر"
          value={filters.lifecycleFilter}
          onChange={(e) =>
            onUpdateFilter('lifecycleFilter', e.target.value as 'all' | CustomerLifecycle)
          }
          options={[
            { value: 'all', label: 'همه چرخه‌های عمر' },
            { value: 'lead', label: 'سرنخ' },
            { value: 'active', label: 'فعال' },
            { value: 'vip', label: 'VIP' },
            { value: 'churned', label: 'ریزش‌کرده' },
          ]}
        />

        <div className="flex gap-2">
          <Select
            aria-label="نوع شخصیت"
            value={filters.personTypeFilter}
            onChange={(e) => onUpdateFilter('personTypeFilter', e.target.value as 'all' | CustomerPersonType)}
            options={[
              { value: 'all', label: 'حقیقی و حقوقی' },
              { value: 'individual', label: 'فقط حقیقی' },
              { value: 'organization', label: 'فقط حقوقی' },
            ]}
          />
          <Select
            aria-label="مسئول پیگیری"
            value={filters.ownerFilter}
            onChange={(e) => onUpdateFilter('ownerFilter', e.target.value)}
            options={[
              { value: 'all', label: 'همه مسئولین' },
              ...ownersList.map((o) => ({ value: o, label: o })),
            ]}
          />
        </div>
      </div>

      <div
        role="group"
        aria-label="فیلتر برچسب مشتریان"
        className="flex w-fit max-w-full flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-900"
      >
        {dynamicTags.map((tag) => (
          <button
            key={tag}
            type="button"
            aria-pressed={filters.selectedTag === tag}
            onClick={() => onUpdateFilter('selectedTag', tag)}
            className={`whitespace-nowrap rounded-md px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
              filters.selectedTag === tag
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
            }`}
          >
            {tag}
          </button>
        ))}
      </div>
    </div>
  );
}
