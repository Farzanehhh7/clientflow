import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Building2,
  Mail,
  Pencil,
  Phone,
  PhoneOutgoing,
  ShieldAlert,
  UserCheck,
} from 'lucide-react';
import { LIFECYCLE_LABELS } from '../../hooks/useCustomerCore';
import { useClientFlow } from '../../store/useClientFlowStore';
import type { Customer } from '../../types';
import { computeCustomerStats } from '../../utils/crmHelpers';
import { formatJalali, toFa } from '../../utils/jalali';
import { maskEmail, maskPhone, shouldMaskPii } from '../../utils/security';
import { Badge, Button, ConfirmDialog, Tabs } from '../ui';
import { CustomerFilesTab, CustomerNotesTab } from './tabs/FilesNotesTabs';
import { CustomerAppointmentsTab, CustomerOrdersTab } from './tabs/OrdersAppointmentsTabs';
import { OverviewTab } from './tabs/OverviewTab';
import { CustomerInvoicesPaymentsTab, CustomerTicketsTab } from './tabs/TicketsInvoicesTabs';
import { TimelineTab } from './tabs/TimelineTab';

export type Customer360TabKey =
  | 'overview'
  | 'timeline'
  | 'orders'
  | 'appointments'
  | 'tickets'
  | 'invoices'
  | 'files'
  | 'notes';

interface Customer360PageProps {
  customerId: string;
  singularLabel: string;
  onBack?: () => void;
  onEdit: (customer: Customer) => void;
  onSelectCustomer: (customerId: string) => void;
}

export function Customer360Page({
  customerId,
  singularLabel,
  onBack,
  onEdit,
  onSelectCustomer,
}: Customer360PageProps) {
  const { state, anonymizeCustomer, startOutboundCall, logDataAccess } = useClientFlow();
  const [activeTab, setActiveTab] = useState<Customer360TabKey>('overview');
  const [confirmAnon, setConfirmAnon] = useState(false);

  const customer = state.customers.find((c) => c.id === customerId && !c.isDeleted);
  const isAdmin = state.settings.role === 'admin';
  const piiMasked = shouldMaskPii(state);

  useEffect(() => {
    if (!customer) return;
    logDataAccess({
      entityType: 'customer',
      entityId: customer.id,
      entityLabel: customer.name,
      action: 'view_360',
      piiMasked,
    });
  }, [customer, logDataAccess, piiMasked]);

  const stats = useMemo(
    () => (customer ? computeCustomerStats(customer, state) : null),
    [customer, state],
  );

  const counts = useMemo(() => {
    if (!customer) return null;
    return {
      orders: state.orders.filter((o) => o.customerId === customer.id).length,
      appointments: state.appointments.filter((a) => a.customerId === customer.id).length,
      tickets: state.tickets.filter((t) => t.customerId === customer.id).length,
      invoices: state.invoices.filter((inv) => inv.customerId === customer.id).length,
      files: customer.attachments?.length ?? 0,
      notes: state.interactions.filter((i) => i.customerId === customer.id && i.channel === 'note').length,
    };
  }, [customer, state]);

  if (!customer || !stats || !counts) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm text-slate-500">{singularLabel} مورد نظر یافت نشد.</p>
        {onBack && (
          <Button variant="secondary" className="mt-3" onClick={onBack}>
            بازگشت به فهرست
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header Card */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {onBack && (
                <Button variant="ghost" size="sm" onClick={onBack}>
                  <ArrowRight size={15} />
                  بازگشت به فهرست
                </Button>
              )}
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {customer.name}
              </h2>
              <Badge tone="indigo">{LIFECYCLE_LABELS[customer.lifecycle ?? 'active']}</Badge>
              {customer.personType === 'organization' ? (
                <Badge tone="violet">
                  <Building2 size={11} />
                  حقوقی {customer.companyName ? `· ${customer.companyName}` : ''}
                </Badge>
              ) : (
                <Badge tone="neutral">حقیقی</Badge>
              )}
              {customer.isAnonymized && <Badge tone="amber">ناشناس‌سازی‌شده (PII)</Badge>}
              <Badge tone={stats.score >= 70 ? 'emerald' : 'sky'} className="tabular-nums">
                امتیاز: {toFa(stats.score)} / ۱۰۰
              </Badge>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-1 tabular-nums" dir="ltr">
                <Phone size={13} />
                {maskPhone(customer.phone, piiMasked)}
              </span>
              {customer.email && (
                <span className="inline-flex items-center gap-1" dir="ltr">
                  <Mail size={13} />
                  {maskEmail(customer.email, piiMasked)}
                </span>
              )}
              {customer.ownerName && (
                <span className="inline-flex items-center gap-1">
                  <UserCheck size={13} />
                  مسئول: {customer.ownerName}
                </span>
              )}
              <span>منبع: {customer.source || '—'}</span>
              <span className="tabular-nums">ثبت: {formatJalali(customer.createdAt)}</span>
            </div>

            {customer.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {customer.tags.map((t) => (
                  <Badge key={t} tone="neutral">
                    #{t}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => startOutboundCall(customer.phone, customer.id)}
            >
              <PhoneOutgoing size={14} className="text-emerald-600" />
              تماس VoIP (Click-to-Call)
            </Button>
            <Button variant="secondary" size="sm" onClick={() => onEdit(customer)}>
              <Pencil size={14} />
              ویرایش پروفایل
            </Button>
            {isAdmin && !customer.isAnonymized && (
              <Button variant="danger" size="sm" onClick={() => setConfirmAnon(true)}>
                <ShieldAlert size={14} />
                ناشناس‌سازی (PII)
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 8 Customer 360 Tabs */}
      <Tabs<Customer360TabKey>
        ariaLabel="تب‌های پرونده ۳۶۰ مشتری"
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          { key: 'overview', label: 'نمای کلی' },
          { key: 'timeline', label: 'تایم‌لاین یکپارچه' },
          { key: 'orders', label: 'سفارش‌ها', count: counts.orders },
          { key: 'appointments', label: 'نوبت‌ها', count: counts.appointments },
          { key: 'tickets', label: 'تیکت‌ها', count: counts.tickets },
          { key: 'invoices', label: 'فاکتور و پرداخت', count: counts.invoices },
          { key: 'files', label: 'فایل‌ها', count: counts.files },
          { key: 'notes', label: 'یادداشت‌ها', count: counts.notes },
        ]}
      />

      {activeTab === 'overview' && (
        <OverviewTab customer={customer} stats={stats} onSelectCustomer={onSelectCustomer} />
      )}
      {activeTab === 'timeline' && <TimelineTab customer={customer} />}
      {activeTab === 'orders' && <CustomerOrdersTab customer={customer} />}
      {activeTab === 'appointments' && <CustomerAppointmentsTab customer={customer} />}
      {activeTab === 'tickets' && <CustomerTicketsTab customer={customer} />}
      {activeTab === 'invoices' && <CustomerInvoicesPaymentsTab customer={customer} />}
      {activeTab === 'files' && <CustomerFilesTab customer={customer} />}
      {activeTab === 'notes' && <CustomerNotesTab customer={customer} />}

      <ConfirmDialog
        open={confirmAnon}
        onClose={() => setConfirmAnon(false)}
        onConfirm={() => anonymizeCustomer(customer.id)}
        title="ناشناس‌سازی داده‌های هویتی (PII)"
        message={`اطلاعات هویتی «${customer.name}» (نام، موبایل، کد ملی، آدرس‌ها و مدارک) پاک می‌شود اما سوابق مالی و فاکتورها حفظ خواهند شد. ادامه می‌دهید؟`}
        confirmLabel="تأیید ناشناس‌سازی"
      />
    </div>
  );
}
