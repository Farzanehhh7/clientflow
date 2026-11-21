import { useMemo, useState } from 'react';
import { RotateCcw, Search, Trash2 } from 'lucide-react';
import { useClientFlow } from '../../store/useClientFlowStore';
import type { TrashEntityType } from '../../types';
import { formatJalaliDateTime, toFa } from '../../utils/jalali';
import { ConfirmDialog } from '../ui';

type TrashRow = {
  id: string;
  entityType: TrashEntityType;
  entityLabel: string;
  title: string;
  subtitle: string;
  deletedAt?: string;
  deletedBy?: string;
};

const ENTITY_LABELS: Record<TrashEntityType, string> = {
  customer: 'مشتریان',
  lead: 'سرنخ‌ها',
  opportunity: 'فرصت‌ها',
  order: 'سفارش‌ها',
  appointment: 'نوبت‌ها',
  ticket: 'تیکت‌ها',
  task: 'تسک‌ها',
  product: 'محصولات',
};

export function TrashRestoreTab() {
  const { state, restoreEntity, permanentlyDeleteEntity, emptyTrash } = useClientFlow();
  const [filterType, setFilterType] = useState<'all' | TrashEntityType>('all');
  const [search, setSearch] = useState('');
  const [confirmEmpty, setConfirmEmpty] = useState(false);

  const trashItems = useMemo<TrashRow[]>(() => {
    const custMap = new Map(state.customers.map((c) => [c.id, c.name]));
    const rows: TrashRow[] = [];

    state.customers
      .filter((c) => c.isDeleted)
      .forEach((c) =>
        rows.push({
          id: c.id,
          entityType: 'customer',
          entityLabel: 'مشتری',
          title: c.name,
          subtitle: c.phone,
          deletedAt: c.deletedAt,
          deletedBy: c.deletedBy,
        }),
      );

    state.leads
      .filter((l) => l.isDeleted)
      .forEach((l) =>
        rows.push({
          id: l.id,
          entityType: 'lead',
          entityLabel: 'سرنخ فروش',
          title: l.name,
          subtitle: `${l.phone} · ${l.source}`,
          deletedAt: l.deletedAt,
          deletedBy: l.deletedBy,
        }),
      );

    state.opportunities
      .filter((o) => o.isDeleted)
      .forEach((o) =>
        rows.push({
          id: o.id,
          entityType: 'opportunity',
          entityLabel: 'فرصت فروش',
          title: o.title,
          subtitle: o.contactName,
          deletedAt: o.deletedAt,
          deletedBy: o.deletedBy,
        }),
      );

    state.orders
      .filter((o) => o.isDeleted)
      .forEach((o) =>
        rows.push({
          id: o.id,
          entityType: 'order',
          entityLabel: 'سفارش',
          title: `سفارش #${o.id.slice(-5)} (${custMap.get(o.customerId) ?? 'مشتری'})`,
          subtitle: `${toFa(o.items.length)} قلم کالا`,
          deletedAt: o.deletedAt,
          deletedBy: o.deletedBy,
        }),
      );

    state.appointments
      .filter((a) => a.isDeleted)
      .forEach((a) =>
        rows.push({
          id: a.id,
          entityType: 'appointment',
          entityLabel: 'نوبت',
          title: custMap.get(a.customerId) ?? 'مشتری',
          subtitle: formatJalaliDateTime(a.start),
          deletedAt: a.deletedAt,
          deletedBy: a.deletedBy,
        }),
      );

    state.tickets
      .filter((t) => t.isDeleted)
      .forEach((t) =>
        rows.push({
          id: t.id,
          entityType: 'ticket',
          entityLabel: 'تیکت',
          title: t.subject,
          subtitle: custMap.get(t.customerId) ?? t.trackingCode ?? t.id,
          deletedAt: t.deletedAt,
          deletedBy: t.deletedBy,
        }),
      );

    state.tasks
      .filter((t) => t.isDeleted)
      .forEach((t) =>
        rows.push({
          id: t.id,
          entityType: 'task',
          entityLabel: 'تسک',
          title: t.title,
          subtitle: t.assignee ?? 'بدون مسئول',
          deletedAt: t.deletedAt,
          deletedBy: t.deletedBy,
        }),
      );

    state.products
      .filter((p) => p.isDeleted)
      .forEach((p) =>
        rows.push({
          id: p.id,
          entityType: 'product',
          entityLabel: 'کالا',
          title: p.name,
          subtitle: p.sku,
          deletedAt: p.deletedAt,
          deletedBy: p.deletedBy,
        }),
      );

    return rows.sort((a, b) => (b.deletedAt ?? '').localeCompare(a.deletedAt ?? ''));
  }, [
    state.appointments,
    state.customers,
    state.leads,
    state.opportunities,
    state.orders,
    state.products,
    state.tasks,
    state.tickets,
  ]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return trashItems.filter((item) => {
      if (filterType !== 'all' && item.entityType !== filterType) return false;
      if (q && !item.title.toLowerCase().includes(q) && !item.subtitle.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [filterType, search, trashItems]);

  return (
    <div className="space-y-4">
      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <Trash2 size={16} className="text-rose-500" />
              سطل زباله و بازیابی رکوردها (Soft Delete · {toFa(trashItems.length)})
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              رکوردهای حذف‌شده از موجودیت‌های اصلی ابتدا به این بخش منتقل می‌شوند و در هر زمان قابل بازیابی یا حذف دائمی هستند.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute right-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="جستجو..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white py-1.5 pl-3 pr-8 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            {trashItems.length > 0 && (
              <button
                type="button"
                onClick={() => setConfirmEmpty(true)}
                className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300"
              >
                <Trash2 size={13} />
                خالی کردن سطل زباله
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setFilterType('all')}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
              filterType === 'all'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            همه ({toFa(trashItems.length)})
          </button>
          {(Object.keys(ENTITY_LABELS) as TrashEntityType[]).map((key) => {
            const count = trashItems.filter((i) => i.entityType === key).length;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setFilterType(key)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                  filterType === key
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {ENTITY_LABELS[key]} ({toFa(count)})
              </button>
            );
          })}
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 py-10 text-center text-xs text-slate-500 dark:border-slate-800">
            سطل زباله برای این فیلتر خالی است. هنگام حذف مشتری، سفارش، نوبت یا تیکت، رکورد به اینجا منتقل می‌شود.
          </div>
        ) : (
          <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
            {filtered.map((item) => (
              <div
                key={`${item.entityType}_${item.id}`}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">{item.title}</span>
                    <span className="text-slate-400">·</span>
                    <span className="text-indigo-600 dark:text-indigo-400">{item.entityLabel}</span>
                  </div>
                  <div className="mt-0.5 text-[11px] tabular-nums text-slate-500">
                    {toFa(item.subtitle)}
                    {item.deletedBy ? ` · حذف توسط: ${item.deletedBy}` : ''}
                    {item.deletedAt ? ` · زمان: ${formatJalaliDateTime(item.deletedAt)}` : ''}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => restoreEntity(item.entityType, item.id)}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                  >
                    <RotateCcw size={13} />
                    بازیابی
                  </button>
                  <button
                    type="button"
                    onClick={() => permanentlyDeleteEntity(item.entityType, item.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-400"
                  >
                    <Trash2 size={13} />
                    حذف دائمی
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmEmpty}
        onClose={() => setConfirmEmpty(false)}
        onConfirm={emptyTrash}
        title="خالی کردن سطل زباله"
        message={`تمام ${toFa(trashItems.length)} رکورد داخل سطل زباله به‌صورت دائمی پاک خواهند شد و قابل بازگشت نیستند. ادامه می‌دهید؟`}
        confirmLabel="حذف دائمی همه"
      />
    </div>
  );
}
