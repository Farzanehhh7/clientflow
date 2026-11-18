import { useState } from 'react';
import { useClientFlow } from '../store/useClientFlowStore';
import { toFa } from '../utils/jalali';
import { Modal } from './Modal';

export function NpsSurveyModal() {
  const { pendingNps, dismissPendingNps, submitNpsSurvey } = useClientFlow();
  const [score, setScore] = useState<number>(9);
  const [comment, setComment] = useState('');

  if (!pendingNps) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitNpsSurvey({
      customerId: pendingNps.customerId,
      refType: pendingNps.refType,
      refId: pendingNps.refId,
      score,
      comment: comment.trim() || undefined,
    });
    setScore(9);
    setComment('');
  };

  return (
    <Modal open={Boolean(pendingNps)} onClose={dismissPendingNps} title="نظرسنجی رضایت مشتری (NPS)" maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          ثبت امتیاز رضایت برای: <span className="font-semibold text-slate-900 dark:text-slate-100">{pendingNps.label}</span>
        </p>

        <div>
          <label className="mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400">
            چقدر احتمال دارد ما را به دوستان خود معرفی کنید؟ (۰ تا ۱۰)
          </label>
          <div className="grid grid-cols-11 gap-1.5">
            {Array.from({ length: 11 }, (_, n) => {
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
            <span>کاملاً ناراضی (منتقد)</span>
            <span>کاملاً راضی (مروج)</span>
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
            placeholder="مثلاً: کیفیت خدمات عالی بود..."
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
