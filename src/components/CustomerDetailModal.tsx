import { useMemo, useState } from 'react';
import { Phone, Mail, MessageSquare, CalendarDays, ShoppingBag, LifeBuoy, Star } from 'lucide-react';
import { useClientFlow } from '../store/useClientFlowStore';
import type { Customer, Interaction } from '../types';
import { formatJalaliDateTime, formatToman, toFa } from '../utils/jalali';
import { Modal } from './Modal';

interface CustomerDetailModalProps {
  customer: Customer | null;
  onClose: () => void;
  onEdit: (customer: Customer) => void;
}

const CHANNEL_LABELS: Record<Interaction['channel'], string> = {
  call: 'تماس تلفنی',
  sms: 'پیامک',
  whatsapp: 'واتساپ',
  visit: 'مراجعه حضوری',
  note: 'یادداشت داخلی',
};

type TimelineItem = {
  id: string;
  at: string;
  kind: 'interaction' | 'appointment' | 'order' | 'ticket' | 'nps';
  title: string;
  detail: string;
};

export function CustomerDetailModal({ customer, onClose, onEdit }: CustomerDetailModalProps) {
  const { state, addInteraction } = useClientFlow();
  const [channel, setChannel] = useState<Interaction['channel']>('call');
  const [noteText, setNoteText] = useState('');

  const liveCustomer = customer
    ? state.customers.find((c) => c.id === customer.id) ?? customer
    : null;

  const timeline = useMemo<TimelineItem[]>(() => {
    if (!liveCustomer) return [];
    const list: TimelineItem[] = [];

    state.interactions
      .filter((i) => i.customerId === liveCustomer.id)
      .forEach((i) => {
        list.push({
          id: i.id,
          at: i.at,
          kind: 'interaction',
          title: CHANNEL_LABELS[i.channel],
          detail: i.text,
        });
      });

    state.appointments
      .filter((a) => a.customerId === liveCustomer.id)
      .forEach((a) => {
        const srv = state.services.find((s) => s.id === a.serviceId)?.name ?? 'خدمت';
        const res = state.resources.find((r) => r.id === a.resourceId)?.name ?? 'منبع';
        list.push({
          id: a.id,
          at: a.start,
          kind: 'appointment',
          title: `نوبت: ${srv} (${res})`,
          detail: `وضعیت: ${a.status}`,
        });
      });

    state.orders
      .filter((o) => o.customerId === liveCustomer.id)
      .forEach((o) => {
        const total = o.items.reduce((sum, it) => sum + it.qty * it.price, 0) - (o.discountAmount ?? 0);
        list.push({
          id: o.id,
          at: o.createdAt,
          kind: 'order',
          title: `سفارش ${o.id} — ${formatToman(total)}`,
          detail: `${o.items.map((x) => `${x.name} × ${toFa(x.qty)}`).join('، ')} · وضعیت: ${o.status}`,
        });
      });

    state.tickets
      .filter((t) => t.customerId === liveCustomer.id)
      .forEach((t) => {
        list.push({
          id: t.id,
          at: t.createdAt,
          kind: 'ticket',
          title: `تیکت پشتیبانی: ${t.subject}`,
          detail: `اولویت: ${t.priority} · وضعیت: ${t.status}`,
        });
      });

    state.npsSurveys
      .filter((n) => n.customerId === liveCustomer.id)
      .forEach((n) => {
        list.push({
          id: n.id,
          at: n.createdAt,
          kind: 'nps',
          title: `امتیاز رضایت (NPS): ${toFa(n.score)} از ۱۰`,
          detail: n.comment || 'بدون توضیح متنی',
        });
      });

    return list.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [
    liveCustomer,
    state.interactions,
    state.appointments,
    state.orders,
    state.tickets,
    state.npsSurveys,
    state.services,
    state.resources,
  ]);

  if (!liveCustomer) return null;

  const handleAddInteraction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim()) return;
    addInteraction(liveCustomer.id, channel, noteText);
    setNoteText('');
  };

  const renderKindIcon = (kind: TimelineItem['kind']) => {
    switch (kind) {
      case 'appointment':
        return <CalendarDays size={15} className="text-indigo-600 dark:text-indigo-400" />;
      case 'order':
        return <ShoppingBag size={15} className="text-emerald-600 dark:text-emerald-400" />;
      case 'ticket':
        return <LifeBuoy size={15} className="text-amber-600 dark:text-amber-400" />;
      case 'nps':
        return <Star size={15} className="text-amber-500" />;
      default:
        return <MessageSquare size={15} className="text-slate-500 dark:text-slate-400" />;
    }
  };

  const customFieldPairs = state.customFieldDefs
    .map((def) => ({
      label: def.label,
      value: liveCustomer.customFields?.[def.key],
    }))
    .filter((x) => x.value);

  return (
    <Modal open={Boolean(liveCustomer)} onClose={onClose} title={`پرونده ۳۶۰ درجه: ${liveCustomer.name}`} maxWidth="2xl">
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
              <span className="inline-flex items-center gap-1.5 tabular-nums">
                <Phone size={14} className="text-slate-400" />
                <span dir="ltr">{toFa(liveCustomer.phone)}</span>
              </span>
              {liveCustomer.email && (
                <>
                  <span className="text-slate-300 dark:text-slate-700">·</span>
                  <span className="inline-flex items-center gap-1.5">
                    <Mail size={14} className="text-slate-400" />
                    {liveCustomer.email}
                  </span>
                </>
              )}
              {liveCustomer.source && (
                <>
                  <span className="text-slate-300 dark:text-slate-700">·</span>
                  <span>منبع: {liveCustomer.source}</span>
                </>
              )}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              تاریخ عضویت: <span className="tabular-nums">{formatJalaliDateTime(liveCustomer.createdAt)}</span>
              {liveCustomer.tags.length > 0 && (
                <>
                  <span className="mx-2">·</span>
                  برچسب‌ها: {liveCustomer.tags.join('، ')}
                </>
              )}
            </div>
            {state.settings.industryPack === 'clinic' && (
              <div className="pt-1 text-xs text-slate-600 dark:text-slate-300">
                شماره پرونده: <span className="tabular-nums font-medium">{liveCustomer.patientCode || 'ثبت‌نشده'}</span>
                <span className="mx-2 text-slate-400">·</span>
                حساسیت دارویی/پوستی: {liveCustomer.allergies || 'ندارد'}
                <span className="mx-2 text-slate-400">·</span>
                رضایت پیامک: {liveCustomer.consentSms !== false ? 'بله' : 'خیر'}
                <span className="mx-2 text-slate-400">·</span>
                رضایت ثبت تصویر: {liveCustomer.consentPhoto ? 'بله' : 'خیر'}
              </div>
            )}
            {customFieldPairs.length > 0 && (
              <div className="pt-1 text-xs text-slate-600 dark:text-slate-300">
                {customFieldPairs.map((cf, i) => (
                  <span key={cf.label}>
                    {i > 0 && <span className="mx-2 text-slate-400">·</span>}
                    {cf.label}: <span className="font-medium">{cf.value}</span>
                  </span>
                ))}
              </div>
            )}
            {liveCustomer.notes && <p className="pt-1 text-xs text-slate-500 dark:text-slate-400">{liveCustomer.notes}</p>}
          </div>

          <button
            type="button"
            onClick={() => {
              onClose();
              onEdit(liveCustomer);
            }}
            className="shrink-0 whitespace-nowrap rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            ویرایش اطلاعات
          </button>
        </div>

        <form onSubmit={handleAddInteraction} className="space-y-2.5">
          <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">ثبت تعامل جدید</div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value as Interaction['channel'])}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="call">تماس تلفنی</option>
              <option value="whatsapp">واتساپ</option>
              <option value="sms">پیامک</option>
              <option value="visit">مراجعه حضوری</option>
              <option value="note">یادداشت</option>
            </select>
            <input
              type="text"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="شرح تماس، پیگیری یا یادداشت..."
              className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
            <button
              type="submit"
              className="shrink-0 whitespace-nowrap rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              ثبت در تایم‌لاین
            </button>
          </div>
        </form>

        <div>
          <h3 className="mb-3 text-sm font-semibold">تایم‌لاین یکپارچه فعالیت‌ها ({toFa(timeline.length)})</h3>
          {timeline.length === 0 ? (
            <p className="rounded-lg border border-slate-200 p-4 text-center text-xs text-slate-500 dark:border-slate-800">
              هنوز هیچ تعامل، نوبت یا سفارشی برای این مشتری ثبت نشده است.
            </p>
          ) : (
            <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
              {timeline.map((item) => (
                <div key={item.id} className="flex items-start gap-3 p-3.5">
                  <div className="mt-0.5 shrink-0">{renderKindIcon(item.kind)}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{item.title}</span>
                      <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
                        {formatJalaliDateTime(item.at)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{item.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
