import { useEffect, useId, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import jalaliday from 'jalaliday';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import {
  getJalaliMonthGridByYearMonth,
  getTodayJalaliAscii,
  JALALI_MONTHS,
  PERSIAN_WEEKDAYS,
  toFa,
} from '../../utils/jalali';
import { normalizeDigits } from '../../utils/validators';

dayjs.extend(jalaliday);

interface JalaliDatePickerProps {
  label?: string;
  value: string; // Jalali ASCII YYYY/MM/DD
  onChange: (jalaliAscii: string) => void;
  placeholder?: string;
  error?: string;
  minYear?: number;
  maxYear?: number;
}

const WEEKDAY_SHORT = [
  PERSIAN_WEEKDAYS[6].slice(0, 1),
  PERSIAN_WEEKDAYS[0].slice(0, 1),
  PERSIAN_WEEKDAYS[1].slice(0, 1),
  PERSIAN_WEEKDAYS[2].slice(0, 1),
  PERSIAN_WEEKDAYS[3].slice(0, 1),
  PERSIAN_WEEKDAYS[4].slice(0, 1),
  PERSIAN_WEEKDAYS[5].slice(0, 1),
];

export function JalaliDatePicker({
  label,
  value,
  onChange,
  placeholder = '1405/08/28',
  error,
  minYear = 1320,
  maxYear = 1415,
}: JalaliDatePickerProps) {
  const inputId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const currentJ = dayjs().calendar('jalali');

  const initialParts = useMemo(() => {
    const clean = normalizeDigits(value).trim();
    const m = clean.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
    if (m) {
      return { year: Number(m[1]), month: Math.min(11, Math.max(0, Number(m[2]) - 1)) };
    }
    return { year: currentJ.year(), month: currentJ.month() };
  }, [value, currentJ]);

  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(initialParts.year);
  const [viewMonth, setViewMonth] = useState(initialParts.month);

  useEffect(() => {
    if (open) {
      setViewYear(initialParts.year);
      setViewMonth(initialParts.month);
    }
  }, [open, initialParts.year, initialParts.month]);

  useEffect(() => {
    if (!open) return;
    const onOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onOutside);
    window.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      window.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const grid = useMemo(() => getJalaliMonthGridByYearMonth(viewYear, viewMonth), [viewYear, viewMonth]);
  const years = useMemo(() => {
    const arr: number[] = [];
    for (let y = maxYear; y >= minYear; y--) arr.push(y);
    return arr;
  }, [minYear, maxYear]);

  const normalizedValue = normalizeDigits(value).replace(/-/g, '/');

  const stepMonth = (delta: number) => {
    let nextM = viewMonth + delta;
    let nextY = viewYear;
    if (nextM < 0) {
      nextM = 11;
      nextY -= 1;
    } else if (nextM > 11) {
      nextM = 0;
      nextY += 1;
    }
    setViewYear(Math.min(maxYear, Math.max(minYear, nextY)));
    setViewMonth(nextM);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {label && (
        <label htmlFor={inputId} className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        <input
          id={inputId}
          type="text"
          dir="ltr"
          value={value}
          onChange={(e) => onChange(normalizeDigits(e.target.value))}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className={`w-full rounded-lg border bg-white py-2 pl-16 pr-3 text-left text-sm tabular-nums focus:outline-none focus:ring-2 dark:bg-slate-800 dark:text-slate-100 ${
            error
              ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/20'
              : 'border-slate-200 focus:border-indigo-500 focus:ring-indigo-500/20 dark:border-slate-700'
          }`}
        />
        <div className="absolute left-2 flex items-center gap-1">
          {value && (
            <button
              type="button"
              aria-label="پاک کردن تاریخ"
              onClick={() => onChange('')}
              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700"
            >
              <X size={13} />
            </button>
          )}
          <button
            type="button"
            aria-label="باز کردن تقویم شمسی"
            onClick={() => setOpen((v) => !v)}
            className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-indigo-600 dark:text-slate-400 dark:hover:bg-slate-700"
          >
            <Calendar size={15} />
          </button>
        </div>
      </div>
      {error && <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400">{error}</p>}

      {open && (
        <div className="absolute right-0 z-50 mt-1.5 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-2 flex items-center justify-between gap-1">
            <button
              type="button"
              aria-label="ماه قبل"
              onClick={() => stepMonth(-1)}
              className="rounded-md p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <ChevronRight size={16} />
            </button>
            <div className="flex items-center gap-1">
              <select
                aria-label="انتخاب ماه شمسی"
                value={viewMonth}
                onChange={(e) => setViewMonth(Number(e.target.value))}
                className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-xs font-medium dark:border-slate-700 dark:bg-slate-800"
              >
                {JALALI_MONTHS.map((m, idx) => (
                  <option key={m} value={idx}>
                    {m}
                  </option>
                ))}
              </select>
              <select
                aria-label="انتخاب سال شمسی"
                value={viewYear}
                onChange={(e) => setViewYear(Number(e.target.value))}
                className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-xs font-medium tabular-nums dark:border-slate-700 dark:bg-slate-800"
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {toFa(y)}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              aria-label="ماه بعد"
              onClick={() => stepMonth(1)}
              className="rounded-md p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <ChevronLeft size={16} />
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 text-center text-[11px] font-medium text-slate-400">
            {WEEKDAY_SHORT.map((w, i) => (
              <div key={i} className="py-1">
                {w}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5 text-center text-xs">
            {grid.cells.map((cell) => {
              const cellAscii = normalizeDigits(cell.jalaliFull);
              const selected = cellAscii === normalizedValue;
              return (
                <button
                  key={cell.dateKey}
                  type="button"
                  onClick={() => {
                    onChange(cellAscii);
                    setOpen(false);
                  }}
                  className={`rounded-md py-1.5 text-xs tabular-nums transition-colors ${
                    selected
                      ? 'bg-indigo-600 font-bold text-white'
                      : cell.isToday
                        ? 'border border-indigo-400 font-semibold text-indigo-600 dark:text-indigo-400'
                        : cell.isCurrentMonth
                          ? 'text-slate-800 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800'
                          : 'text-slate-300 hover:bg-slate-50 dark:text-slate-600 dark:hover:bg-slate-800/40'
                  }`}
                >
                  {toFa(cell.jalaliDay)}
                </button>
              );
            })}
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-2 text-xs dark:border-slate-800">
            <button
              type="button"
              onClick={() => {
                onChange(getTodayJalaliAscii());
                setOpen(false);
              }}
              className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
            >
              امروز
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            >
              بستن
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
