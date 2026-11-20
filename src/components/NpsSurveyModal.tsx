import { useEffect, useState } from 'react';
import { useClientFlow } from '../store/useClientFlowStore';
import type { SurveyType } from '../types';
import { toFa } from '../utils/jalali';
import { Modal } from './Modal';

const SURVEY_META: Record<
  SurveyType,
  {
    label: string;
    question: string;
    min: number;
    max: number;
    defaultScore: number;
    lowLabel: string;
    highLabel: string;
  }
> = {
  nps: {
    label: 'شاخص وفاداری (NPS)',
    question: 'چقدر احتمال دارد ما را به دوستان یا همکاران خود معرفی کنید؟ (۰ تا ۱۰)',
    min: 0,
    max: 10,
    defaultScore: 9,
    lowLabel: 'کاملاً ناراضی (منتقد)',
    highLabel: 'کاملاً راضی (مروج)',
  },
  csat: {
    label: 'رضایت از سرویس (CSAT)',
    question: 'میزان رضایت کلی شما از کیفیت خدمات یا پشتیبانی چقدر است؟ (۱ تا ۵)',
    min: 1,
    max: 5,
    defaultScore: 5,
    lowLabel: 'بسیار ناراضی',
    highLabel: 'کاملاً راضی',
  },
  ces: {
    label: 'سهولت تجربه مشتری (CES)',
    question: 'انجام درخواست یا دریافت پشتیبانی شما چقدر ساده و بی‌دردسر بود؟ (۱ تا ۷)',
    min: 1,
    max: 7,
    defaultScore: 6,
    lowLabel: 'بسیار دشوار',
    highLabel: 'بسیار آسان',
  },
};

export function NpsSurveyModal() {
  const { pendingNps, dismissPendingNps, submitNpsSurvey } = useClientFlow();
  const [surveyType, setSurveyType] = useState<SurveyType>('nps');
  const [score, setScore] = useState<number>(9);
  const [comment, setComment] = useState('');

  useEffect(() => {
    if (!pendingNps) return;
    const nextType = pendingNps.defaultSurveyType ?? 'nps';
    setSurveyType(nextType);
    setScore(SURVEY_META[nextType].defaultScore);
    setComment('');
  }, [pendingNps]);

  if (!pendingNps) return null;

  const meta = SURVEY_META[surveyType];
  const scaleValues = Array.from({ length: meta.max - meta.min + 1 }, (_, idx) => meta.min + idx);

  const handleSelectType = (next: SurveyType) => {
    setSurveyType(next);
    setScore(SURVEY_META[next].defaultScore);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitNpsSurvey({
      surveyType,
      maxScale: meta.max,
      customerId: pendingNps.customerId,
      refType: pendingNps.refType,
      refId: pendingNps.refId,
      score,
      comment: comment.trim() || undefined,
    });
    setComment('');
  };

  return (
    <Modal open={Boolean(pendingNps)} onClose={dismissPendingNps} title="نظرسنجی رضایت مشتری (NPS / CSAT / CES)" maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          ثبت امتیاز برای: <span className="font-semibold text-slate-900 dark:text-slate-100">{pendingNps.label}</span>
        </p>

        <div className="grid grid-cols-3 gap-2">
          {(['nps', 'csat', 'ces'] as SurveyType[]).map((st) => {
            const active = surveyType === st;
            return (
              <button
                key={st}
                type="button"
                onClick={() => handleSelectType(st)}
                className={`rounded-lg border px-2 py-2 text-xs font-medium transition-colors ${
                  active
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:border-indigo-500 dark:bg-indigo-950/50 dark:text-indigo-300'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {SURVEY_META[st].label}
              </button>
            );
          })}
        </div>

        <div>
          <label className="mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400">{meta.question}</label>
          <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${scaleValues.length}, minmax(0, 1fr))` }}>
            {scaleValues.map((n) => {
              const active = score === n;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => setScore(n)}
                  className={`h-10 rounded-lg border text-sm font-medium tabular-nums transition-colors ${
                    active
                      ? 'border-indigo-600 bg-indigo-600 text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {toFa(n)}
                </button>
              );
            })}
          </div>
          <div className="mt-1.5 flex justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>{meta.lowLabel}</span>
            <span>{meta.highLabel}</span>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
            نظر یا بازخورد مشتری (اختیاری)
          </label>
          <textarea
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="مثلاً: رسیدگی بسیار سریع و حرفه‌ای بود..."
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={dismissPendingNps}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            بعداً
          </button>
          <button
            type="submit"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            ثبت نظرسنجی
          </button>
        </div>
      </form>
    </Modal>
  );
}
