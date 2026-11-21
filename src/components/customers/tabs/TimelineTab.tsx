import { useMemo, useState } from 'react';
import { CalendarDays, LifeBuoy, MessageSquare, Receipt, ShieldCheck, ShoppingBag, Sparkles, Star } from 'lucide-react';
import { summarizeCustomerTimeline, type CustomerTimelineSummary } from '../../../services/aiService';
import { useClientFlow } from '../../../store/useClientFlowStore';
import type { Customer, Interaction, InteractionOutcome } from '../../../types';
import {
  formatJalali,
  formatJalaliDateTime,
  formatToman,
  jalaliToIsoUtc,
  toFa,
} from '../../../utils/jalali';
import { interactionSchema } from '../../../utils/validators';
import { Badge, Button, EmptyState, Input, JalaliDatePicker, Select } from '../../ui';

const CHANNEL_LABELS: Record<Interaction['channel'], string> = {
  call: 'تماس تلفنی',
  sms: 'پیامک',
  whatsapp: 'واتساپ',
  visit: 'مراجعه حضوری',
  note: 'یادداشت داخلی',
};

const OUTCOME_LABELS: Record<InteractionOutcome, string> = {
  answered: 'پاسخ داده شد',
  no_answer: 'بی‌پاسخ',
  interested: 'علاقه‌مند',
  quote_requested: 'درخواست پیش‌فاکتور',
  follow_up: 'نیازمند پیگیری',
  not_interested: 'عدم نیاز',
};

type TimelineKind = 'interaction' | 'appointment' | 'order' | 'invoice' | 'ticket' | 'nps' | 'consent';

interface TimelineEntry {
  id: string;
  at: string;
  kind: TimelineKind;
  title: string;
  detail: string;
  meta?: string;
}

export function TimelineTab({ customer }: { customer: Customer }) {
  const { state, addInteraction, logAiUsage } = useClientFlow();
  const [filterKind, setFilterKind] = useState<'all' | TimelineKind>('all');
  const [channel, setChannel] = useState<Interaction['channel']>('call');
  const [outcome, setOutcome] = useState<InteractionOutcome>('answered');
  const [followUpJalali, setFollowUpJalali] = useState('');
  const [createTask, setCreateTask] = useState(true);
  const [text, setText] = useState('');
  const [error, setError] = useState('');

  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiSummary, setAiSummary] = useState<{
    data: CustomerTimelineSummary;
    mode: 'gemini' | 'fallback';
  } | null>(null);

  const handleSummarizeTimeline = async () => {
    setAiError('');
    setAiLoading(true);
    const res = await summarizeCustomerTimeline(state, customer, logAiUsage);
    setAiLoading(false);
    if (!res.ok) {
      setAiError(res.error);
      return;
    }
    setAiSummary({ data: res.data, mode: res.meta.mode });
  };

  const items = useMemo<TimelineEntry[]>(() => {
    const list: TimelineEntry[] = [];

    state.interactions
      .filter((i) => i.customerId === customer.id)
      .forEach((i) => {
        const parts = [i.text];
        if (i.outcome) parts.push(`نتیجه: ${OUTCOME_LABELS[i.outcome]}`);
        if (i.followUpAt) parts.push(`پیگیری: ${formatJalali(i.followUpAt)}`);
        list.push({
          id: i.id,
          at: i.at,
          kind: 'interaction',
          title: `تعامل (${CHANNEL_LABELS[i.channel]})`,
          detail: i.text,
          meta: parts.slice(1).join(' · '),
        });
      });

    state.appointments
      .filter((a) => a.customerId === customer.id)
      .forEach((a) => {
        const svc = state.services.find((s) => s.id === a.serviceId)?.name ?? 'سرویس';
        list.push({
          id: a.id,
          at: a.start,
          kind: 'appointment',
          title: `نوبت: ${svc}`,
          detail: `وضعیت نوبت: ${a.status}`,
        });
      });

    state.orders
      .filter((o) => o.customerId === customer.id)
      .forEach((o) => {
        const total = o.items.reduce((s, it) => s + it.qty * it.price, 0) - (o.discountAmount ?? 0);
        list.push({
          id: o.id,
          at: o.createdAt,
          kind: 'order',
          title: `سفارش ${toFa(o.id)}`,
          detail: o.items.map((x) => `${x.name}×${toFa(x.qty)}`).join('، '),
          meta: formatToman(total),
        });
      });

    state.invoices
      .filter((inv) => inv.customerId === customer.id)
      .forEach((inv) => {
        list.push({
          id: inv.id,
          at: inv.issuedAt,
          kind: 'invoice',
          title: `فاکتور ${toFa(inv.invoiceNo)}`,
          detail: `مبلغ کل ${formatToman(inv.grandTotal)} · پرداخت‌شده ${formatToman(inv.paidAmount)}`,
        });
      });

    state.tickets
      .filter((t) => t.customerId === customer.id)
      .forEach((t) => {
        list.push({
          id: t.id,
          at: t.createdAt,
          kind: 'ticket',
          title: `تیکت پشتیبانی: ${t.subject}`,
          detail: `وضعیت: ${t.status} · اولویت: ${t.priority}`,
        });
      });

    state.npsSurveys
      .filter((n) => n.customerId === customer.id)
      .forEach((n) => {
        list.push({
          id: n.id,
          at: n.createdAt,
          kind: 'nps',
          title: `نظرسنجی NPS: امتیاز ${toFa(n.score)} از ۱۰`,
          detail: n.comment || 'بدون متن تکمیلی',
        });
      });

    (state.consentLogs ?? [])
      .filter((cl) => cl.customerId === customer.id)
      .forEach((cl) => {
        list.push({
          id: cl.id,
          at: cl.at,
          kind: 'consent',
          title: `تغییر رضایت (${cl.channel.toUpperCase()})`,
          detail: cl.granted ? 'رضایت تأیید شد' : 'رضایت لغو شد',
          meta: cl.actor,
        });
      });

    return list.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [state, customer.id]);

  const filtered = useMemo(
    () => (filterKind === 'all' ? items : items.filter((it) => it.kind === filterKind)),
    [items, filterKind],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const followUpIso = followUpJalali.trim() ? jalaliToIsoUtc(followUpJalali) ?? undefined : undefined;
    if (followUpJalali.trim() && !followUpIso) {
      setError('فرمت تاریخ پیگیری شمسی نامعتبر است (مثال: 1405/09/05).');
      return;
    }
    const parsed = interactionSchema.safeParse({ channel, text, outcome, followUpAt: followUpIso });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'اطلاعات تعامل نامعتبر است');
      return;
    }
    addInteraction(customer.id, parsed.data.channel, parsed.data.text, {
      outcome: parsed.data.outcome,
      followUpAt: parsed.data.followUpAt,
      createFollowUpTask: createTask,
    });
    setText('');
    setFollowUpJalali('');
  };

  const renderIcon = (kind: TimelineKind) => {
    switch (kind) {
      case 'appointment':
        return <CalendarDays size={14} className="text-indigo-500" />;
      case 'order':
        return <ShoppingBag size={14} className="text-emerald-500" />;
      case 'invoice':
        return <Receipt size={14} className="text-sky-500" />;
      case 'ticket':
        return <LifeBuoy size={14} className="text-rose-500" />;
      case 'nps':
        return <Star size={14} className="text-amber-500" />;
      case 'consent':
        return <ShieldCheck size={14} className="text-violet-500" />;
      default:
        return <MessageSquare size={14} className="text-slate-500" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* AI Customer Timeline Summary */}
      {state.settings.ai?.enabled !== false && (
        <div className="rounded-xl border border-indigo-200/80 bg-indigo-50/40 p-4 text-xs dark:border-indigo-900/50 dark:bg-indigo-950/20">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 font-semibold text-indigo-800 dark:text-indigo-200">
              <Sparkles size={15} className="text-indigo-600 dark:text-indigo-400" />
              <span>خلاصه هوشمند تایم‌لاین و اقدام پیشنهادی بعدی</span>
            </div>
            <Button type="button" size="sm" variant="secondary" disabled={aiLoading} onClick={() => void handleSummarizeTimeline()}>
              <Sparkles size={13} />
              {aiLoading ? 'در حال تحلیل...' : aiSummary ? 'به‌روزرسانی خلاصه AI' : 'خلاصه‌سازی تایم‌لاین با AI'}
            </Button>
          </div>
          {aiError && (
            <p className="mt-2 text-rose-600 dark:text-rose-400">{aiError}</p>
          )}
          {aiSummary && (
            <div className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone="indigo">تولیدشده با هوش مصنوعی (AI-generated · {aiSummary.mode === 'gemini' ? 'Gemini' : 'Fallback'})</Badge>
                  <Badge
                    tone={
                      aiSummary.data.sentiment === 'مثبت'
                        ? 'emerald'
                        : aiSummary.data.sentiment === 'نیازمند توجه'
                          ? 'rose'
                          : 'neutral'
                    }
                  >
                    حس و رضایت: {aiSummary.data.sentiment}
                  </Badge>
                </div>
              </div>
              <ul className="list-disc space-y-1 pr-4 text-slate-700 dark:text-slate-200">
                {aiSummary.data.summaryBullets.map((b, idx) => (
                  <li key={idx}>{b}</li>
                ))}
              </ul>
              {aiSummary.data.riskFlags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {aiSummary.data.riskFlags.map((rf, idx) => (
                    <Badge key={idx} tone="amber">
                      ریسک: {rf}
                    </Badge>
                  ))}
                </div>
              )}
              <div className="rounded-md bg-emerald-50/70 px-2.5 py-1.5 font-medium text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
                اقدام پیشنهادی بعدی: {aiSummary.data.nextBestAction}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Log new interaction with outcome & follow-up */}
      <form
        onSubmit={handleSubmit}
        className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
          ثبت تعامل جدید (تماس، پیامک، واتساپ، مراجعه حضوری، یادداشت)
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Select
            label="کانال ارتباطی"
            value={channel}
            onChange={(e) => setChannel(e.target.value as Interaction['channel'])}
            options={Object.entries(CHANNEL_LABELS).map(([k, v]) => ({ value: k, label: v }))}
          />
          <Select
            label="نتیجه تعامل"
            value={outcome}
            onChange={(e) => setOutcome(e.target.value as InteractionOutcome)}
            options={Object.entries(OUTCOME_LABELS).map(([k, v]) => ({ value: k, label: v }))}
          />
          <JalaliDatePicker
            label="تاریخ پیگیری بعدی (اختیاری)"
            value={followUpJalali}
            onChange={setFollowUpJalali}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-[240px] flex-1">
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="شرح تماس، مکالمه یا نتیجه پیگیری را بنویسید..."
              error={error}
            />
          </div>
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={createTask}
              onChange={(e) => setCreateTask(e.target.checked)}
            />
            <span>ایجاد خودکار وظیفه پیگیری</span>
          </label>
          <Button type="submit" size="md">
            ثبت در تایم‌لاین
          </Button>
        </div>
      </form>

      {/* Filter & Timeline list */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {(
            [
              ['all', 'همه رویدادها'],
              ['interaction', 'تعاملات'],
              ['order', 'سفارش‌ها'],
              ['appointment', 'نوبت‌ها'],
              ['invoice', 'فاکتورها'],
              ['ticket', 'تیکت‌ها'],
              ['consent', 'رضایت‌ها'],
            ] as ['all' | TimelineKind, string][]
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setFilterKind(k)}
              className={`rounded-lg border px-2.5 py-1 transition-colors ${
                filterKind === k
                  ? 'border-indigo-500 bg-indigo-50 font-semibold text-indigo-700 dark:border-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <Badge tone="neutral" className="tabular-nums">
          {toFa(filtered.length)} رویداد
        </Badge>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <EmptyState title="رویدادی در تایم‌لاین یافت نشد" />
          </div>
        ) : (
          filtered.map((item) => (
            <div
              key={item.id}
              className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5 text-xs dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 rounded-lg bg-slate-100 p-1.5 dark:bg-slate-800">
                  {renderIcon(item.kind)}
                </div>
                <div>
                  <div className="font-semibold text-slate-800 dark:text-slate-100">{item.title}</div>
                  <p className="mt-0.5 text-slate-600 dark:text-slate-300">{item.detail}</p>
                  {item.meta && (
                    <p className="mt-1 text-[11px] font-medium text-indigo-600 dark:text-indigo-400">
                      {item.meta}
                    </p>
                  )}
                </div>
              </div>
              <span className="shrink-0 tabular-nums text-[11px] text-slate-400">
                {formatJalaliDateTime(item.at)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
