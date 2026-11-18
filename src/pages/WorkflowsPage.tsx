import { useState } from 'react';
import { Check, Plus, X } from 'lucide-react';
import { Modal } from '../components/Modal';
import { useClientFlow } from '../store/useClientFlowStore';
import type { WorkflowType } from '../types';
import { formatJalaliDateTime, toFa } from '../utils/jalali';

const WF_TYPE_LABEL: Record<WorkflowType, string> = {
  discount_approval: 'تأیید تخفیف ویژه (>۲۰٪)',
  order_return: 'مرجوعی و استرداد سفارش',
  vip_schedule: 'نوبت‌دهی ویژه VIP',
  complaint: 'رسیدگی به شکایت مشتری',
};

export function WorkflowsPage() {
  const { state, createWorkflowInstance, decideWorkflowStep } = useClientFlow();
  const [filter, setFilter] = useState<'all' | 'running' | 'completed'>('all');
  const [createOpen, setCreateOpen] = useState(false);

  const [title, setTitle] = useState('');
  const [type, setType] = useState<WorkflowType>('discount_approval');
  const [customerId, setCustomerId] = useState(state.customers[0]?.id ?? '');
  const [commentMap, setCommentMap] = useState<Record<string, string>>({});

  const filtered = state.workflows.filter((w) => {
    if (filter === 'all') return true;
    if (filter === 'running') return w.status === 'running';
    return w.status !== 'running';
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    createWorkflowInstance({ title, type, customerId });
    setTitle('');
    setCreateOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-900">
          {(
            [
              ['all', 'همه فرایندها'],
              ['running', 'در جریان'],
              ['completed', 'پایان‌یافته'],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setFilter(k)}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === k
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700"
        >
          <Plus size={16} />
          آغاز گردش کار جدید
        </button>
      </div>

      <div className="space-y-4">
        {filtered.map((wf) => {
          const cust = state.customers.find((c) => c.id === wf.customerId);
          const curStep = wf.steps[wf.currentStepIndex];
          const canAct =
            wf.status === 'running' &&
            curStep &&
            (curStep.role === 'staff' || state.settings.role === 'admin');

          const statusText =
            wf.status === 'running'
              ? 'در جریان'
              : wf.status === 'approved'
                ? 'تأیید نهایی'
                : 'رد شده';
          const statusClass =
            wf.status === 'approved'
              ? 'text-emerald-600 dark:text-emerald-400'
              : wf.status === 'rejected'
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-amber-600 dark:text-amber-400';

          return (
            <div
              key={wf.id}
              className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-3 dark:border-slate-800">
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{wf.title}</div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {WF_TYPE_LABEL[wf.type]}
                    {cust && ` · مشتری: ${cust.name}`}
                    {' · '}
                    SLA: <span className="tabular-nums">{toFa(wf.slaHours)} ساعت</span>
                    {' · '}
                    <span className="tabular-nums">{formatJalaliDateTime(wf.createdAt)}</span>
                  </div>
                </div>
                <span className={`text-xs font-semibold ${statusClass}`}>{statusText}</span>
              </div>

              <div className="mt-4 space-y-2.5">
                {wf.steps.map((step, idx) => {
                  const isCurrent = wf.status === 'running' && idx === wf.currentStepIndex;
                  return (
                    <div
                      key={idx}
                      className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3.5 py-2.5 text-xs ${
                        isCurrent
                          ? 'border-indigo-300 bg-indigo-50/40 dark:border-indigo-700 dark:bg-indigo-950/20'
                          : 'border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      <div>
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          {toFa(idx + 1)}. {step.name}
                        </div>
                        <div className="mt-0.5 text-slate-500 dark:text-slate-400">
                          مسئول مرحله: {step.role === 'admin' ? 'مدیر سیستم (Admin)' : 'کارشناس / مدیر'}
                          {step.actor && ` · اقدام‌کننده: ${step.actor}`}
                          {step.at && ` · ${formatJalaliDateTime(step.at)}`}
                        </div>
                        {step.comment && (
                          <div className="mt-1 text-slate-700 dark:text-slate-300">یادداشت: {step.comment}</div>
                        )}
                      </div>

                      <div className="shrink-0 font-medium">
                        {step.status === 'approved' && (
                          <span className="text-emerald-600 dark:text-emerald-400">تأیید شده</span>
                        )}
                        {step.status === 'rejected' && (
                          <span className="text-rose-600 dark:text-rose-400">رد شده</span>
                        )}
                        {step.status === 'pending' && (
                          <span className="text-slate-400">{isCurrent ? 'منتظر اقدام' : 'در صف'}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {wf.status === 'running' && (
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
                  <input
                    type="text"
                    placeholder="یادداشت یا دلیل تأیید/رد..."
                    value={commentMap[wf.id] ?? ''}
                    onChange={(e) => setCommentMap((m) => ({ ...m, [wf.id]: e.target.value }))}
                    className="min-w-[200px] flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                  />
                  {canAct ? (
                    <>
                      <button
                        type="button"
                        onClick={() => decideWorkflowStep(wf.id, 'approved', commentMap[wf.id])}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                      >
                        <Check size={14} />
                        تأیید مرحله
                      </button>
                      <button
                        type="button"
                        onClick={() => decideWorkflowStep(wf.id, 'rejected', commentMap[wf.id])}
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-400"
                      >
                        <X size={14} />
                        رد درخواست
                      </button>
                    </>
                  ) : (
                    <span className="text-xs text-amber-600 dark:text-amber-400">
                      این مرحله منتظر تأیید «مدیر سیستم» است (در نقش کارشناس قابل تأیید نیست).
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="شروع فرایند گردش کار جدید" maxWidth="md">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">نوع فرایند</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as WorkflowType)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="discount_approval">{WF_TYPE_LABEL.discount_approval}</option>
              <option value="order_return">{WF_TYPE_LABEL.order_return}</option>
              <option value="vip_schedule">{WF_TYPE_LABEL.vip_schedule}</option>
              <option value="complaint">{WF_TYPE_LABEL.complaint}</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">عنوان درخواست *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثلاً: درخواست تخفیف ۲۵٪ برای پکیج فیشیال"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">مشتری مرتبط</label>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            >
              {state.customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm dark:border-slate-700"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              ثبت و ارسال به جریان کار
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
