import { useState } from 'react';
import { BookmarkPlus, Check, ShieldCheck, Sparkles, X } from 'lucide-react';
import { convertNlToCustomerFilter, type AiNlFilterResult } from '../../services/aiService';
import { useClientFlow } from '../../store/useClientFlowStore';
import type { CustomerSavedViewFilter } from '../../types';

interface AiNlFilterBarProps {
  allowedOwners: string[];
  allowedTags: string[];
  onApplyFilter: (filter: CustomerSavedViewFilter) => void;
  onSaveAsView: (name: string, filter: CustomerSavedViewFilter) => void;
}

const SAMPLE_QUERIES = [
  'مشتریان VIP با بیشترین خرید',
  'مشتریان حقوقی بر اساس امتیاز بالا',
  'سرنخ‌های اینستاگرام',
];

export function AiNlFilterBar({
  allowedOwners,
  allowedTags,
  onApplyFilter,
  onSaveAsView,
}: AiNlFilterBarProps) {
  const { state, logAiUsage } = useClientFlow();
  const [sentence, setSentence] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AiNlFilterResult | null>(null);
  const [modeLabel, setModeLabel] = useState<'gemini' | 'fallback' | null>(null);
  const [error, setError] = useState('');
  const [viewName, setViewName] = useState('');

  if (state.settings.ai?.enabled === false) {
    return null;
  }

  const handleConvert = async (raw?: string) => {
    const q = (raw ?? sentence).trim();
    if (!q || loading) return;
    setSentence(q);
    setError('');
    setLoading(true);
    const res = await convertNlToCustomerFilter(state, q, allowedOwners, allowedTags, logAiUsage);
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      setResult(null);
      return;
    }
    setResult(res.data);
    setModeLabel(res.meta.mode);
    setViewName(q.slice(0, 32));
  };

  return (
    <div className="space-y-2.5 rounded-xl border border-indigo-200/70 bg-indigo-50/40 p-3 dark:border-indigo-900/50 dark:bg-indigo-950/20">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-800 dark:text-indigo-200">
          <Sparkles size={14} className="text-indigo-600 dark:text-indigo-400" />
          <span>جستجو و فیلتر با زبان طبیعی فارسی (NL-to-Filter · لیست سفید JSON بدون SQL)</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {SAMPLE_QUERIES.map((sq) => (
            <button
              key={sq}
              type="button"
              onClick={() => void handleConvert(sq)}
              className="rounded-md border border-indigo-200 bg-white px-2 py-0.5 text-[11px] text-indigo-700 hover:bg-indigo-100/70 dark:border-indigo-800 dark:bg-slate-900 dark:text-indigo-300"
            >
              {sq}
            </button>
          ))}
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleConvert();
        }}
        className="flex flex-wrap items-center gap-2"
      >
        <input
          value={sentence}
          onChange={(e) => setSentence(e.target.value)}
          placeholder="مثال: مشتریان VIP حقوقی با بیشترین خرید..."
          className="min-w-[240px] flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900"
        />
        <button
          type="submit"
          disabled={loading || !sentence.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
        >
          <Sparkles size={13} />
          {loading ? 'در حال تبدیل...' : 'تبدیل به فیلتر هوشمند'}
        </button>
      </form>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3 text-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-200">
              <ShieldCheck size={14} className="text-emerald-600 dark:text-emerald-400" />
              <span>{result.explanation}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                تولیدشده با هوش مصنوعی (AI-generated · {modeLabel === 'gemini' ? 'Gemini' : 'Fallback'})
              </span>
              <button
                type="button"
                onClick={() => setResult(null)}
                aria-label="بستن پیش‌نمایش فیلتر"
                className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={13} />
              </button>
            </div>
          </div>

          <pre
            dir="ltr"
            className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-2 font-mono text-[11px] text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300"
          >
            {JSON.stringify(result.filter, null, 2)}
          </pre>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-1.5">
              <input
                value={viewName}
                onChange={(e) => setViewName(e.target.value)}
                placeholder="نام نمای ذخیره‌شده..."
                className="w-44 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
              <button
                type="button"
                disabled={!viewName.trim()}
                onClick={() => {
                  onApplyFilter(result.filter);
                  onSaveAsView(viewName.trim(), result.filter);
                }}
                className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-40 dark:border-indigo-900/50 dark:bg-indigo-950/40 dark:text-indigo-300"
              >
                <BookmarkPlus size={13} />
                اعمال و ذخیره نما
              </button>
            </div>
            <button
              type="button"
              onClick={() => onApplyFilter(result.filter)}
              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
            >
              <Check size={13} />
              اعمال فوری فیلتر
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
