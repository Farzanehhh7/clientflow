import { useMemo, useState } from 'react';
import {
  Building2,
  CalendarDays,
  FileText,
  GitFork,
  LifeBuoy,
  Mail,
  MapPin,
  MessageSquare,
  Paperclip,
  Phone,
  Plus,
  ShieldAlert,
  ShoppingBag,
  Star,
  Trash2,
  Upload,
  Users,
} from 'lucide-react';
import { useClientFlow } from '../store/useClientFlowStore';
import type {
  Customer,
  CustomerAddress,
  CustomerAttachment,
  CustomerContact,
  CustomerLifecycle,
  CustomerRelationType,
  Interaction,
} from '../types';
import { computeCustomerStats } from '../utils/crmHelpers';
import { formatJalali, formatJalaliDateTime, formatToman, toFa } from '../utils/jalali';
import { Modal } from './Modal';

interface CustomerDetailModalProps {
  customer: Customer | null;
  onClose: () => void;
  onEdit: (customer: Customer) => void;
  onSelectCustomer?: (customer: Customer) => void;
}

const LIFECYCLE_LABELS: Record<CustomerLifecycle, string> = {
  lead: 'سرنخ',
  active: 'فعال',
  vip: 'VIP',
  churned: 'ریزش‌کرده',
};

const CHANNEL_LABELS: Record<Interaction['channel'], string> = {
  call: 'تماس تلفنی',
  sms: 'پیامک',
  whatsapp: 'واتساپ',
  visit: 'مراجعه حضوری',
  note: 'یادداشت داخلی',
};

const RELATION_LABELS: Record<CustomerRelationType, string> = {
  referrer: 'معرف',
  family: 'خانواده / بستگان',
  colleague: 'همکار / هم‌سازمانی',
};

const ATT_CAT_LABELS: Record<CustomerAttachment['category'], string> = {
  photo_before: 'تصویر قبل از خدمت',
  photo_after: 'تصویر بعد از خدمت',
  lab_pdf: 'مدرک / آزمایش PDF',
  consent: 'فرم رضایت‌نامه',
  other: 'سایر مدارک',
};

type TimelineItem = {
  id: string;
  at: string;
  kind: 'interaction' | 'appointment' | 'order' | 'ticket' | 'nps';
  title: string;
  detail: string;
};

export function CustomerDetailModal({
  customer,
  onClose,
  onEdit,
  onSelectCustomer,
}: CustomerDetailModalProps) {
  const {
    state,
    addInteraction,
    updateCustomer,
    anonymizeCustomer,
    addCustomerRelation,
    removeCustomerRelation,
    addCustomerAttachment,
    removeCustomerAttachment,
  } = useClientFlow();

  const [detailTab, setDetailTab] = useState<'profile' | 'contacts' | 'relations' | 'attachments'>('profile');
  const [channel, setChannel] = useState<Interaction['channel']>('call');
  const [noteText, setNoteText] = useState('');

  // Add Contact state
  const [cName, setCName] = useState('');
  const [cRole, setCRole] = useState('');
  const [cPhone, setCPhone] = useState('');

  // Add Address state
  const [aTitle, setATitle] = useState('');
  const [aAddress, setAAddress] = useState('');
  const [aPostal, setAPostal] = useState('');

  // Add Relation state
  const [relTargetId, setRelTargetId] = useState('');
  const [relType, setRelType] = useState<CustomerRelationType>('referrer');
  const [relNote, setRelNote] = useState('');

  // Add Attachment state
  const [attCat, setAttCat] = useState<CustomerAttachment['category']>('photo_before');
  const [attNote, setAttNote] = useState('');

  // PII Anonymize confirm
  const [confirmAnon, setConfirmAnon] = useState(false);

  const liveCustomer = customer
    ? state.customers.find((c) => c.id === customer.id) ?? customer
    : null;

  const isAdmin = state.settings.role === 'admin';

  const stats = useMemo(
    () => (liveCustomer ? computeCustomerStats(liveCustomer, state) : null),
    [liveCustomer, state],
  );

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

  const customerRelations = useMemo(() => {
    if (!liveCustomer) return [];
    return state.customerRelations.filter(
      (r) => r.fromCustomerId === liveCustomer.id || r.toCustomerId === liveCustomer.id,
    );
  }, [liveCustomer, state.customerRelations]);

  if (!liveCustomer || !stats) return null;

  const handleAddInteraction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim()) return;
    addInteraction(liveCustomer.id, channel, noteText);
    setNoteText('');
  };

  const handleAddContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cName.trim() || !cPhone.trim()) return;
    const next: CustomerContact = {
      id: `ct_${Date.now()}`,
      name: cName.trim(),
      role: cRole.trim() || 'رابط',
      phone: cPhone.trim(),
      isPrimary: (liveCustomer.contacts ?? []).length === 0,
    };
    updateCustomer(liveCustomer.id, {
      contacts: [...(liveCustomer.contacts ?? []), next],
    });
    setCName('');
    setCRole('');
    setCPhone('');
  };

  const handleRemoveContact = (id: string) => {
    updateCustomer(liveCustomer.id, {
      contacts: (liveCustomer.contacts ?? []).filter((c) => c.id !== id),
    });
  };

  const handleAddAddress = (e: React.FormEvent) => {
    e.preventDefault();
    if (!aTitle.trim() || !aAddress.trim()) return;
    const next: CustomerAddress = {
      id: `adr_${Date.now()}`,
      title: aTitle.trim(),
      address: aAddress.trim(),
      postalCode: aPostal.trim() || undefined,
      isDefault: (liveCustomer.addresses ?? []).length === 0,
    };
    updateCustomer(liveCustomer.id, {
      addresses: [...(liveCustomer.addresses ?? []), next],
    });
    setATitle('');
    setAAddress('');
    setAPostal('');
  };

  const handleRemoveAddress = (id: string) => {
    updateCustomer(liveCustomer.id, {
      addresses: (liveCustomer.addresses ?? []).filter((a) => a.id !== id),
    });
  };

  const handleAddRelation = (e: React.FormEvent) => {
    e.preventDefault();
    const targetId = relTargetId || state.customers.find((c) => c.id !== liveCustomer.id)?.id;
    if (!targetId) return;
    addCustomerRelation({
      fromCustomerId: liveCustomer.id,
      toCustomerId: targetId,
      relationType: relType,
      note: relNote.trim() || undefined,
    });
    setRelNote('');
  };

  const handleUploadAttachment = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const sizeKb = Math.max(1, Math.round(file.size / 1024));
    const sizeLabel = sizeKb >= 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${toFa(sizeKb)} KB`;

    const saveAtt = (dataUrl?: string) => {
      addCustomerAttachment(liveCustomer.id, {
        name: file.name,
        category: attCat,
        sizeLabel,
        mimeType: file.type || 'application/octet-stream',
        dataUrl,
        note: attNote.trim() || undefined,
      });
      setAttNote('');
    };

    if (file.type.startsWith('image/') && file.size < 450_000) {
      const reader = new FileReader();
      reader.onload = () => saveAtt(typeof reader.result === 'string' ? reader.result : undefined);
      reader.readAsDataURL(file);
    } else {
      saveAtt(undefined);
    }
    e.target.value = '';
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

  const otherCustomers = state.customers.filter((c) => c.id !== liveCustomer.id);

  return (
    <Modal open={Boolean(liveCustomer)} onClose={onClose} title={`پرونده ۳۶۰ درجه: ${liveCustomer.name}`} maxWidth="2xl">
      <div className="space-y-5">
        {/* Top Summary Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span
                className={`inline-flex items-center gap-1 rounded px-2 py-0.5 font-medium ${
                  liveCustomer.personType === 'organization'
                    ? 'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300'
                    : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {liveCustomer.personType === 'organization' ? <Building2 size={12} /> : <Users size={12} />}
                {liveCustomer.personType === 'organization' ? 'شخص حقوقی (سازمانی)' : 'شخص حقیقی'}
              </span>
              {liveCustomer.isAnonymized && (
                <span className="rounded bg-amber-100 px-2 py-0.5 font-medium text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                  ناشناس‌سازی‌شده (PII)
                </span>
              )}
              <span className="rounded bg-indigo-50 px-2 py-0.5 font-semibold text-indigo-700 tabular-nums dark:bg-indigo-950/50 dark:text-indigo-300">
                امتیاز مشتری: {toFa(stats.score)} / ۱۰۰
              </span>
            </div>

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

            {liveCustomer.personType === 'organization' && (
              <div className="text-xs text-slate-600 dark:text-slate-300">
                شرکت: <span className="font-semibold">{liveCustomer.companyName || liveCustomer.name}</span>
                {liveCustomer.economicCode && (
                  <>
                    <span className="mx-2 text-slate-400">·</span>
                    کد اقتصادی: <span className="tabular-nums">{toFa(liveCustomer.economicCode)}</span>
                  </>
                )}
                {liveCustomer.registrationNo && (
                  <>
                    <span className="mx-2 text-slate-400">·</span>
                    شماره ثبت: <span className="tabular-nums">{toFa(liveCustomer.registrationNo)}</span>
                  </>
                )}
              </div>
            )}

            <div className="text-xs text-slate-500 dark:text-slate-400">
              وضعیت: <span className="font-medium text-slate-700 dark:text-slate-200">{LIFECYCLE_LABELS[liveCustomer.lifecycle ?? 'active']}</span>
              <span className="mx-2">·</span>
              عضویت: <span className="tabular-nums">{formatJalaliDateTime(liveCustomer.createdAt)}</span>
              {liveCustomer.birthDateJalali && (
                <>
                  <span className="mx-2">·</span>
                  تولد: <span className="tabular-nums">{toFa(liveCustomer.birthDateJalali)}</span>
                </>
              )}
              {liveCustomer.anniversaryDateJalali && (
                <>
                  <span className="mx-2">·</span>
                  سالگرد: <span className="tabular-nums">{toFa(liveCustomer.anniversaryDateJalali)}</span>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
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
            {isAdmin && !liveCustomer.isAnonymized && (
              <button
                type="button"
                onClick={() => setConfirmAnon((v) => !v)}
                className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300"
              >
                <ShieldAlert size={13} />
                ناشناس‌سازی PII
              </button>
            )}
          </div>
        </div>

        {confirmAnon && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            <span>
              آیا از پاک‌سازی و ناشناس‌سازی اطلاعات هویتی (نام، موبایل، کد ملی، مدارک) با حفظ سوابق مالی و نوبت‌ها مطمئن هستید؟
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmAnon(false)}
                className="rounded border border-amber-300 px-2.5 py-1 hover:bg-amber-100 dark:border-amber-700"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={() => {
                  anonymizeCustomer(liveCustomer.id);
                  setConfirmAnon(false);
                }}
                className="rounded bg-amber-600 px-3 py-1 font-medium text-white hover:bg-amber-700"
              >
                تأیید ناشناس‌سازی
              </button>
            </div>
          </div>
        )}

        {/* Inner Tabs */}
        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800/70">
          {(
            [
              ['profile', 'پروفایل و تایم‌لاین'],
              ['contacts', `مخاطبین و آدرس‌ها (${toFa((liveCustomer.contacts?.length ?? 0) + (liveCustomer.addresses?.length ?? 0))})`],
              ['relations', `درخت ارتباطات (${toFa(customerRelations.length)})`],
              ['attachments', `پرونده و مدارک (${toFa(liveCustomer.attachments?.length ?? 0)})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setDetailTab(key)}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                detailTab === key
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Tab 1: Profile & Timeline */}
        {detailTab === 'profile' && (
          <div className="space-y-5">
            {state.settings.industryPack === 'clinic' && (
              <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-300">
                شماره پرونده: <span className="tabular-nums font-semibold">{liveCustomer.patientCode || 'ثبت‌نشده'}</span>
                <span className="mx-2 text-slate-400">·</span>
                حساسیت: {liveCustomer.allergies || 'ندارد'}
                <span className="mx-2 text-slate-400">·</span>
                رضایت پیامک: {liveCustomer.consentSms !== false ? 'بله' : 'خیر'}
                <span className="mx-2 text-slate-400">·</span>
                رضایت تصویر: {liveCustomer.consentPhoto ? 'بله' : 'خیر'}
              </div>
            )}

            {(state.settings.industryPack === 'software' || liveCustomer.licenseKey) && (
              <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-300">
                لایسنس: <span className="font-mono font-semibold">{liveCustomer.licenseKey || 'ثبت‌نشده'}</span>
                {liveCustomer.contractExpiresAt && (
                  <>
                    <span className="mx-2 text-slate-400">·</span>
                    انقضای قرارداد: <span className="tabular-nums">{formatJalali(liveCustomer.contractExpiresAt)}</span>
                  </>
                )}
              </div>
            )}

            {customFieldPairs.length > 0 && (
              <div className="flex flex-wrap gap-3 rounded-lg border border-slate-200 p-3 text-xs dark:border-slate-800">
                {customFieldPairs.map((cf) => (
                  <div key={cf.label}>
                    <span className="text-slate-500">{cf.label}: </span>
                    <span className="font-semibold">{cf.value}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-800/40">
                <div className="text-[11px] text-slate-500">نوبت‌های ثبت‌شده</div>
                <div className="mt-1 text-base font-bold tabular-nums">{toFa(stats.totalAppointments)}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-800/40">
                <div className="text-[11px] text-slate-500">جمع خرید کل</div>
                <div className="mt-1 text-base font-bold tabular-nums">{formatToman(stats.totalSpent)}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-800/40">
                <div className="text-[11px] text-slate-500">میانگین رضایت (NPS)</div>
                <div className="mt-1 text-base font-bold tabular-nums">
                  {stats.avgNps !== null ? `${toFa(stats.avgNps.toFixed(1))} از ۱۰` : 'ثبت‌نشده'}
                </div>
              </div>
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
        )}

        {/* Tab 2: Multi-Contact & Multi-Address */}
        {detailTab === 'contacts' && (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
              <div className="flex items-center gap-1.5 text-xs font-semibold">
                <Users size={14} className="text-indigo-500" />
                اشخاص مرتبط (Contacts)
              </div>
              <form onSubmit={handleAddContact} className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="نام مخاطب *"
                    value={cName}
                    onChange={(e) => setCName(e.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                  />
                  <input
                    type="text"
                    placeholder="سمت (مثلاً مدیر مالی)"
                    value={cRole}
                    onChange={(e) => setCRole(e.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
                <div className="flex gap-2">
                  <input
                    type="tel"
                    dir="ltr"
                    placeholder="0912..."
                    value={cPhone}
                    onChange={(e) => setCPhone(e.target.value)}
                    className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-left text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
                  />
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                  >
                    <Plus size={13} />
                    افزودن
                  </button>
                </div>
              </form>
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {(liveCustomer.contacts ?? []).length === 0 ? (
                  <p className="py-4 text-center text-xs text-slate-400">شخص مرتبطی ثبت نشده است.</p>
                ) : (
                  (liveCustomer.contacts ?? []).map((ct) => (
                    <div key={ct.id} className="flex items-center justify-between py-2 text-xs">
                      <div>
                        <div className="font-semibold">
                          {ct.name} <span className="font-normal text-slate-500">({ct.role})</span>
                        </div>
                        <div className="tabular-nums text-slate-500" dir="ltr">
                          {toFa(ct.phone)}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveContact(ct.id)}
                        className="p-1 text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
              <div className="flex items-center gap-1.5 text-xs font-semibold">
                <MapPin size={14} className="text-emerald-500" />
                آدرس‌های ثبت‌شده
              </div>
              <form onSubmit={handleAddAddress} className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="عنوان (مثلاً دفتر مرکزی) *"
                    value={aTitle}
                    onChange={(e) => setATitle(e.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                  />
                  <input
                    type="text"
                    dir="ltr"
                    placeholder="کد پستی"
                    value={aPostal}
                    onChange={(e) => setAPostal(e.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-left text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="نشانی کامل پستی *"
                    value={aAddress}
                    onChange={(e) => setAAddress(e.target.value)}
                    className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                  />
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                  >
                    <Plus size={13} />
                    ثبت آدرس
                  </button>
                </div>
              </form>
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {(liveCustomer.addresses ?? []).length === 0 ? (
                  <p className="py-4 text-center text-xs text-slate-400">آدرسی ثبت نشده است.</p>
                ) : (
                  (liveCustomer.addresses ?? []).map((adr) => (
                    <div key={adr.id} className="flex items-start justify-between gap-2 py-2 text-xs">
                      <div>
                        <div className="font-semibold">
                          {adr.title}{' '}
                          {adr.postalCode && (
                            <span className="font-normal tabular-nums text-slate-400">
                              (کد پستی: {toFa(adr.postalCode)})
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 text-slate-600 dark:text-slate-300">{adr.address}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveAddress(adr.id)}
                        className="p-1 text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Customer Relations Tree */}
        {detailTab === 'relations' && (
          <div className="space-y-4">
            <form
              onSubmit={handleAddRelation}
              className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-800/40"
            >
              <div className="min-w-[160px] flex-1">
                <label className="mb-1 block text-[11px] text-slate-500">مشتری مرتبط</label>
                <select
                  value={relTargetId || otherCustomers[0]?.id || ''}
                  onChange={(e) => setRelTargetId(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
                >
                  {otherCustomers.map((oc) => (
                    <option key={oc.id} value={oc.id}>
                      {oc.name} ({toFa(oc.phone)})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-slate-500">نوع ارتباط</label>
                <select
                  value={relType}
                  onChange={(e) => setRelType(e.target.value as CustomerRelationType)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
                >
                  <option value="referrer">معرف (معرفی‌شده)</option>
                  <option value="family">خانواده / بستگان</option>
                  <option value="colleague">همکار / هم‌سازمانی</option>
                </select>
              </div>
              <div className="min-w-[150px] flex-1">
                <label className="mb-1 block text-[11px] text-slate-500">توضیح (اختیاری)</label>
                <input
                  type="text"
                  value={relNote}
                  onChange={(e) => setRelNote(e.target.value)}
                  placeholder="مثلاً: معرفی از کمپین پاییز"
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
                />
              </div>
              <button
                type="submit"
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
              >
                ثبت ارتباط
              </button>
            </form>

            {customerRelations.length === 0 ? (
              <p className="rounded-xl border border-slate-200 p-6 text-center text-xs text-slate-500 dark:border-slate-800">
                ارتباطی برای این مشتری ثبت نشده است.
              </p>
            ) : (
              <div className="space-y-2">
                {customerRelations.map((rel) => {
                  const isOutgoing = rel.fromCustomerId === liveCustomer.id;
                  const peerId = isOutgoing ? rel.toCustomerId : rel.fromCustomerId;
                  const peer = state.customers.find((c) => c.id === peerId);
                  return (
                    <div
                      key={rel.id}
                      className="flex items-center justify-between rounded-xl border border-slate-200 p-3 text-xs dark:border-slate-800"
                    >
                      <div className="flex items-center gap-2.5">
                        <GitFork size={15} className="text-indigo-500" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="rounded bg-indigo-50 px-2 py-0.5 font-medium text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                              {RELATION_LABELS[rel.relationType]}
                            </span>
                            <span>{isOutgoing ? '← مرتبط با' : '→ معرفی / پیوند از'}</span>
                            <button
                              type="button"
                              onClick={() => peer && onSelectCustomer?.(peer)}
                              className="font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
                            >
                              {peer?.name ?? 'مشتری حذف‌شده'}
                            </button>
                          </div>
                          {rel.note && <div className="mt-0.5 text-slate-500">{rel.note}</div>}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeCustomerRelation(rel.id)}
                        className="p-1 text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Attachments / Medical Files */}
        {detailTab === 'attachments' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-800/40">
              <div>
                <label className="mb-1 block text-[11px] text-slate-500">دسته‌بندی مدرک</label>
                <select
                  value={attCat}
                  onChange={(e) => setAttCat(e.target.value as CustomerAttachment['category'])}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
                >
                  <option value="photo_before">تصویر قبل از خدمت</option>
                  <option value="photo_after">تصویر بعد از خدمت</option>
                  <option value="lab_pdf">آزمایش / نسخه PDF</option>
                  <option value="consent">فرم رضایت‌نامه</option>
                  <option value="other">سایر مدارک</option>
                </select>
              </div>
              <div className="min-w-[160px] flex-1">
                <label className="mb-1 block text-[11px] text-slate-500">توضیح مدرک</label>
                <input
                  type="text"
                  value={attNote}
                  onChange={(e) => setAttNote(e.target.value)}
                  placeholder="مثلاً: نمای روبه‌رو جلسه اول"
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
                />
              </div>
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-700">
                <Upload size={14} />
                آپلود تصویر یا فایل
                <input
                  type="file"
                  accept="image/*,.pdf,.doc,.docx"
                  onChange={handleUploadAttachment}
                  className="hidden"
                />
              </label>
            </div>

            {(liveCustomer.attachments ?? []).length === 0 ? (
              <p className="rounded-xl border border-slate-200 p-6 text-center text-xs text-slate-500 dark:border-slate-800">
                هنوز مدرک یا تصویری در پرونده پیوست نشده است.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {(liveCustomer.attachments ?? []).map((att) => (
                  <div
                    key={att.id}
                    className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 p-3 text-xs dark:border-slate-800"
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      {att.dataUrl ? (
                        <img
                          src={att.dataUrl}
                          alt={att.name}
                          className="h-12 w-12 shrink-0 rounded-lg border border-slate-200 object-cover dark:border-slate-700"
                        />
                      ) : (
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800">
                          {att.mimeType.includes('pdf') ? <FileText size={18} /> : <Paperclip size={18} />}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-slate-900 dark:text-slate-100">{att.name}</div>
                        <div className="mt-0.5 text-[11px] text-indigo-600 dark:text-indigo-400">
                          {ATT_CAT_LABELS[att.category]} · {att.sizeLabel}
                        </div>
                        {att.note && <div className="mt-0.5 text-[11px] text-slate-500">{att.note}</div>}
                        <div className="mt-0.5 text-[10px] tabular-nums text-slate-400">
                          {formatJalaliDateTime(att.uploadedAt)}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeCustomerAttachment(liveCustomer.id, att.id)}
                      className="p-1 text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
