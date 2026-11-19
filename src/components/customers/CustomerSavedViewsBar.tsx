import { useState } from 'react';
import { Bookmark, Plus, RotateCcw, Trash2 } from 'lucide-react';
import type { CustomerSavedView, CustomerSavedViewFilter } from '../../types';
import { toFa } from '../../utils/jalali';
import { Button, Input, Select } from '../ui';

interface CustomerSavedViewsBarProps {
  views: CustomerSavedView[];
  activeViewId: string;
  filters: CustomerSavedViewFilter;
  onSelectView: (viewId: string) => void;
  onSaveView: (name: string) => void;
  onDeleteView: (id: string) => void;
  onResetFilters: () => void;
  onChangeSortBy: (sortBy: CustomerSavedViewFilter['sortBy']) => void;
  onToggleSortDir: () => void;
  totalMatched: number;
}

export function CustomerSavedViewsBar({
  views,
  activeViewId,
  filters,
  onSelectView,
  onSaveView,
  onDeleteView,
  onResetFilters,
  onChangeSortBy,
  onToggleSortDir,
  totalMatched,
}: CustomerSavedViewsBarProps) {
  const [saving, setSaving] = useState(false);
  const [viewName, setViewName] = useState('');

  const submitSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewName.trim()) return;
    onSaveView(viewName.trim());
    setViewName('');
    setSaving(false);
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
          <Bookmark size={14} className="text-indigo-500" />
          نماهای ذخیره‌شده:
        </span>

        {views.map((view) => {
          const isActive = activeViewId === view.id;
          return (
            <div
              key={view.id}
              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs transition-colors ${
                isActive
                  ? 'border-indigo-500 bg-indigo-50 font-semibold text-indigo-700 dark:border-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              <button
                type="button"
                onClick={() => onSelectView(view.id)}
                className="whitespace-nowrap"
              >
                {view.name}
              </button>
              <button
                type="button"
                aria-label={`حذف نمای ${view.name}`}
                onClick={() => onDeleteView(view.id)}
                className="text-slate-400 hover:text-rose-600"
              >
                <Trash2 size={12} />
              </button>
            </div>
          );
        })}

        {saving ? (
          <form onSubmit={submitSave} className="flex items-center gap-1.5">
            <div className="w-40">
              <Input
                value={viewName}
                onChange={(e) => setViewName(e.target.value)}
                placeholder="نام نمای جدید..."
                autoFocus
                className="py-1 text-xs"
              />
            </div>
            <Button type="submit" size="sm">
              ذخیره
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSaving(false)}>
              لغو
            </Button>
          </form>
        ) : (
          <Button variant="secondary" size="sm" onClick={() => setSaving(true)}>
            <Plus size={13} />
            ذخیره فیلتر فعلی
          </Button>
        )}

        <Button variant="ghost" size="sm" onClick={onResetFilters} title="بازنشانی فیلترها">
          <RotateCcw size={13} />
          پاک‌کردن
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
          {toFa(totalMatched)} رکورد
        </span>
        <div className="w-36">
          <Select
            aria-label="مرتب‌سازی بر اساس"
            value={filters.sortBy}
            onChange={(e) => onChangeSortBy(e.target.value as CustomerSavedViewFilter['sortBy'])}
            className="py-1 text-xs"
            options={[
              { value: 'createdAt', label: 'مرتب‌سازی: تاریخ ثبت' },
              { value: 'score', label: 'مرتب‌سازی: امتیاز' },
              { value: 'totalSpent', label: 'مرتب‌سازی: مجموع خرید' },
              { value: 'name', label: 'مرتب‌سازی: نام' },
            ]}
          />
        </div>
        <Button variant="secondary" size="sm" onClick={onToggleSortDir} title="تغییر جهت مرتب‌سازی">
          {filters.sortDir === 'desc' ? 'نزولی' : 'صعودی'}
        </Button>
      </div>
    </div>
  );
}
