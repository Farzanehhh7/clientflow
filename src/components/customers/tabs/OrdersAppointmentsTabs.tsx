import { CalendarDays, ShoppingBag } from 'lucide-react';
import { useClientFlow } from '../../../store/useClientFlowStore';
import type { AppointmentStatus, Customer, OrderStatus } from '../../../types';
import { formatJalaliDateTime, formatToman, toFa } from '../../../utils/jalali';
import { Badge, EmptyState, Table } from '../../ui';
import type { BadgeTone } from '../../ui/Badge';

const ORDER_STATUS_META: Record<OrderStatus, { label: string; tone: BadgeTone }> = {
  new: { label: 'ثبت جدید', tone: 'sky' },
  confirmed: { label: 'تایید شده', tone: 'indigo' },
  shipped: { label: 'ارسال شده', tone: 'amber' },
  delivered: { label: 'تحویل شده', tone: 'emerald' },
  cancelled: { label: 'لغو شده', tone: 'rose' },
};

const APT_STATUS_META: Record<AppointmentStatus, { label: string; tone: BadgeTone }> = {
  booked: { label: 'رزرو شده', tone: 'sky' },
  confirmed: { label: 'تایید شده', tone: 'indigo' },
  checked_in: { label: 'پذیرش‌شده', tone: 'violet' },
  done: { label: 'انجام شده', tone: 'emerald' },
  noshow: { label: 'عدم حضور', tone: 'amber' },
  cancelled: { label: 'لغو شده', tone: 'rose' },
};

export function CustomerOrdersTab({ customer }: { customer: Customer }) {
  const { state } = useClientFlow();
  const orders = state.orders
    .filter((o) => o.customerId === customer.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <Table
      isEmpty={orders.length === 0}
      emptyState={
        <EmptyState
          icon={<ShoppingBag size={26} />}
          title="سفارشی برای این مشتری ثبت نشده است"
        />
      }
      headers={[
        { key: 'id', label: 'شماره سفارش' },
        { key: 'items', label: 'اقلام' },
        { key: 'total', label: 'مبلغ خالص' },
        { key: 'status', label: 'وضعیت' },
        { key: 'created', label: 'تاریخ ثبت' },
      ]}
    >
      {orders.map((o) => {
        const total = o.items.reduce((s, it) => s + it.qty * it.price, 0) - (o.discountAmount ?? 0);
        const st = ORDER_STATUS_META[o.status];
        return (
          <tr key={o.id} className="text-xs hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
            <td className="px-4 py-2.5 font-semibold tabular-nums">{toFa(o.id)}</td>
            <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">
              {o.items.map((it) => `${it.name} × ${toFa(it.qty)}`).join('، ')}
            </td>
            <td className="px-4 py-2.5 font-medium tabular-nums">{formatToman(total)}</td>
            <td className="px-4 py-2.5">
              <Badge tone={st.tone}>{st.label}</Badge>
            </td>
            <td className="px-4 py-2.5 tabular-nums text-slate-500">
              {formatJalaliDateTime(o.createdAt)}
            </td>
          </tr>
        );
      })}
    </Table>
  );
}

export function CustomerAppointmentsTab({ customer }: { customer: Customer }) {
  const { state } = useClientFlow();
  const appointments = state.appointments
    .filter((a) => a.customerId === customer.id)
    .sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime());

  return (
    <Table
      isEmpty={appointments.length === 0}
      emptyState={
        <EmptyState
          icon={<CalendarDays size={26} />}
          title="نوبتی برای این مشتری ثبت نشده است"
        />
      }
      headers={[
        { key: 'service', label: 'خدمت' },
        { key: 'resource', label: 'ارائه‌دهنده / منبع' },
        { key: 'start', label: 'زمان نوبت' },
        { key: 'status', label: 'وضعیت' },
      ]}
    >
      {appointments.map((a) => {
        const svc = state.services.find((s) => s.id === a.serviceId);
        const res = state.resources.find((r) => r.id === a.resourceId);
        const st = APT_STATUS_META[a.status];
        return (
          <tr key={a.id} className="text-xs hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
            <td className="px-4 py-2.5 font-semibold">{svc?.name ?? 'سرویس'}</td>
            <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{res?.name ?? '—'}</td>
            <td className="px-4 py-2.5 tabular-nums text-slate-500">{formatJalaliDateTime(a.start)}</td>
            <td className="px-4 py-2.5">
              <Badge tone={st.tone}>{st.label}</Badge>
            </td>
          </tr>
        );
      })}
    </Table>
  );
}
