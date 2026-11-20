import { CalendarRange } from 'lucide-react';
import { JalaliDatePicker } from './JalaliDatePicker';
import { getJalaliDateRangePreset, type JalaliDatePreset, toFa } from '../../utils/jalali';

interface JalaliDateRangePickerProps {
  preset: JalaliDatePreset | 'custom';
  fromJalali: string;
  toJalali: string;
  onChange: (next: {
    preset: JalaliDatePreset | 'custom';
    fromJalali: string;
    toJalali: string;
  }) => void;
  compact?: boolean;
}

const PRESETS: { key: JalaliDatePreset; label: string }[] = [
  { key: 'today', label: 'امروز' },
  { key: 'this_week', label: 'هفته جاری' },
  { key: 'this_month', label: 'ماه شمسی' },
  { key: 'shamsi_year', label: 'سال شمسی' },
  { key: 'last_30_days', label: '۳۰ روز اخیر' },
  { key: 'all', label: 'کل بازه' },
];

export function JalaliDateRangePicker({
  preset,
  fromJalali,
  toJalali,
  onChange,
  compact = false,
}: JalaliDateRangePickerProps) {
  const applyPreset = (p: JalaliDatePreset) => {
    const res = getJalaliDateRangePreset(p);
    onChange({
      preset: p,
      fromJalali: res.fromJalali,
      toJalali: res.toJalali,
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
        <CalendarRange size={15} className="text-indigo-500" />
        <span className="font-medium whitespace-nowrap">بازه جلالی:</span>
      </div>

      <div className="flex flex-wrap items-center gap-1">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => applyPreset(p.key)}
            className={`whitespace-nowrap rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors ${
              preset === p.key
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {!compact && (
        <div className="flex flex-wrap items-center gap-2 border-r border-slate-200 pr-2 dark:border-slate-800">
          <div className="w-36">
            <JalaliDatePicker
              value={fromJalali}
              placeholder="از تاریخ..."
              onChange={(val) =>
                onChange({ preset: 'custom', fromJalali: val, toJalali })
              }
            />
          </div>
          <span className="text-slate-400">تا</span>
          <div className="w-36">
            <JalaliDatePicker
              value={toJalali}
              placeholder="تا تاریخ..."
              onChange={(val) =>
                onChange({ preset: 'custom', fromJalali, toJalali: val })
              }
            />
          </div>
        </div>
      )}

      {compact && (fromJalali || toJalali) && (
        <span className="text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
          ({fromJalali ? toFa(fromJalali) : 'ابتدا'} تا {toJalali ? toFa(toJalali) : 'امروز'})
        </span>
      )}
    </div>
  );
}
