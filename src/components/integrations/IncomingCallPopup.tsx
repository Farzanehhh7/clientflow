import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Mic,
  PhoneCall,
  PhoneIncoming,
  PhoneMissed,
  PhoneOff,
  PhoneOutgoing,
  User,
  X,
} from 'lucide-react';
import { useClientFlow } from '../../store/useClientFlowStore';
import type { CallStatus, InteractionOutcome } from '../../types';
import { formatToman, toFa } from '../../utils/jalali';

const OUTCOME_LABELS: { value: InteractionOutcome; label: string }[] = [
  { value: 'answered', label: 'پاسخ‌داده و راهنمایی شد' },
  { value: 'interested', label: 'علاقه‌مند به خرید / رزرو' },
  { value: 'follow_up', label: 'نیازمند پیگیری مجدد' },
  { value: 'no_answer', label: 'بدون پاسخ / درخواست تماس مجدد' },
  { value: 'not_interested', label: 'عدم تمایل' },
];

export function IncomingCallPopup() {
  const {
    state,
    activeCall,
    answerActiveCall,
    dismissActiveCall,
    completeActiveCall,
  } = useClientFlow();

  const [elapsedSec, setElapsedSec] = useState(0);
  const [callStatus, setCallStatus] = useState<CallStatus>('answered');
  const [outcome, setOutcome] = useState<InteractionOutcome>('answered');
  const [notes, setNotes] = useState('');
  const [createTask, setCreateTask] = useState(false);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    if (!activeCall) {
      setElapsedSec(0);
      setNotes('');
      setCreateTask(false);
      setCallStatus('answered');
      setOutcome('answered');
      setMuted(false);
      return;
    }
    const timer = window.setInterval(() => {
      if (activeCall.phase === 'connected') {
        setElapsedSec((prev) => prev + 1);
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [activeCall]);

  if (!activeCall) return null;

  const customer = activeCall.customerId
    ? state.customers.find((c) => c.id === activeCall.customerId)
    : undefined;

  const openBalance = customer
    ? state.invoices
        .filter((i) => i.customerId === customer.id)
        .reduce((s, i) => s + Math.max(0, i.grandTotal - i.paidAmount), 0)
    : 0;

  const ordersCount = customer
    ? state.orders.filter((o) => o.customerId === customer.id).length
    : 0;

  const mm = String(Math.floor(elapsedSec / 60)).padStart(2, '0');
  const ss = String(elapsedSec % 60).padStart(2, '0');

  return (
    <div className="print-hidden fixed bottom-4 right-4 z-50 w-[380px] max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-lg ${
              activeCall.phase === 'ringing'
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
            }`}
          >
            {activeCall.direction === 'inbound' ? (
              <PhoneIncoming size={16} />
            ) : (
              <PhoneOutgoing size={16} />
            )}
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
              {activeCall.direction === 'inbound'
                ? activeCall.phase === 'ringing'
                  ? 'تماس ورودی (در حال زنگ...)'
                  : 'تماس ورودی برقرار'
                : 'تماس خروجی VoIP'}
            </div>
            <div className="text-[11px] tabular-nums text-slate-500">
              {activeCall.providerDriver.toUpperCase()} · داخلی {toFa(activeCall.extension)} ·{' '}
              <span dir="ltr">
                {toFa(mm)}:{toFa(ss)}
              </span>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={dismissActiveCall}
          aria-label="بستن پاپ‌آپ تماس"
          className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <X size={15} />
        </button>
      </div>

      {/* Customer Match Card */}
      <div className="space-y-3 p-4 text-xs">
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-800/40">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
              <User size={14} className="text-indigo-500" />
              <span>{activeCall.customerName}</span>
            </div>
            <span className="font-mono text-xs tabular-nums text-slate-600 dark:text-slate-300" dir="ltr">
              {toFa(activeCall.phone)}
            </span>
          </div>

          {customer ? (
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
              <span>وضعیت: {customer.lifecycle ?? 'active'}</span>
              <span>·</span>
              <span>سفارش‌ها: {toFa(ordersCount)}</span>
              <span>·</span>
              <span>بدهی باز: {formatToman(openBalance)}</span>
              {customer.tags.length > 0 && (
                <>
                  <span>·</span>
                  <span>برچسب: {customer.tags.join('، ')}</span>
                </>
              )}
            </div>
          ) : (
            <div className="mt-1.5 text-[11px] text-amber-600 dark:text-amber-400">
              شماره در پرونده مشتریان ثبت نشده است (تماس ناشناس).
            </div>
          )}
        </div>

        {/* Ringing controls OR Active outcome logging */}
        {activeCall.phase === 'ringing' ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={answerActiveCall}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2.5 text-xs font-semibold text-white hover:bg-emerald-700"
            >
              <PhoneCall size={14} />
              پاسخ به تماس
            </button>
            <button
              type="button"
              onClick={() =>
                completeActiveCall({
                  status: 'missed',
                  outcome: 'no_answer',
                  durationSec: 0,
                  notes: 'تماس بی‌پاسخ ثبت شد.',
                  createFollowUpTask: true,
                })
              }
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-700 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
            >
              <PhoneMissed size={14} />
              رد / بی‌پاسخ
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setMuted((v) => !v)}
                className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-medium ${
                  muted
                    ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                    : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300'
                }`}
              >
                <Mic size={12} />
                {muted ? 'میکروفون بی‌صداست' : 'ضبط و مکالمه فعال'}
              </button>
              <span className="text-[11px] text-slate-400">در حال ضبط خودکار تماس (WAV)</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-[11px] text-slate-500">وضعیت تماس</label>
                <select
                  value={callStatus}
                  onChange={(e) => setCallStatus(e.target.value as CallStatus)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="answered">پاسخ‌داده‌شده</option>
                  <option value="missed">بی‌پاسخ (Missed)</option>
                  <option value="voicemail">پیام‌گیر صوتی</option>
                  <option value="busy">اشغال</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-slate-500">نتیجه تعامل</label>
                <select
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value as InteractionOutcome)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                >
                  {OUTCOME_LABELS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[11px] text-slate-500">خلاصه مکالمه</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="موضوع تماس، توافقات یا درخواست مشتری..."
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
            </div>

            {customer && (
              <label className="flex cursor-pointer items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={createTask}
                  onChange={(e) => setCreateTask(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600"
                />
                ایجاد وظیفه پیگیری خودکار برای ۲۴ ساعت آینده
              </label>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() =>
                  completeActiveCall({
                    status: callStatus,
                    outcome,
                    durationSec: Math.max(15, elapsedSec),
                    notes,
                    createFollowUpTask: createTask,
                  })
                }
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
              >
                <CheckCircle2 size={14} />
                پایان و ثبت نتیجه تماس
              </button>
              <button
                type="button"
                onClick={dismissActiveCall}
                className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-400"
              >
                <PhoneOff size={14} />
                لغو
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
