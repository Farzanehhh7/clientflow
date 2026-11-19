import { useState } from 'react';
import { Camera, Filter, Trash2, Users } from 'lucide-react';
import { useClientFlow } from '../../store/useClientFlowStore';
import type { Customer, CustomerSegment } from '../../types';
import { type CustomerComputedStats, evaluateSegment } from '../../utils/crmHelpers';
import { toFa } from '../../utils/jalali';
import { Badge, Button, ConfirmDialog, EmptyState } from '../ui';
import { SEGMENT_FIELD_LABELS, SegmentFormModal } from './SegmentFormModal';

interface CustomerSegmentsViewProps {
  customers: Customer[];
  statsMap: Map<string, CustomerComputedStats>;
  onViewInList: (segmentId: string) => void;
}

export function CustomerSegmentsView({ customers, statsMap, onViewInList }: CustomerSegmentsViewProps) {
  const { state, addCustomerSegment, deleteCustomerSegment } = useClientFlow();
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CustomerSegment | null>(null);

  const handleSnapshotToStatic = (seg: CustomerSegment) => {
    const matchedIds = customers
      .filter((c) => {
        const st = statsMap.get(c.id);
        return st ? evaluateSegment(c, seg, st) : false;
      })
      .map((c) => c.id);
    addCustomerSegment({
      name: `${seg.name} (نسخه ایستا)`,
      description: `اسنپ‌شات ثابت از سگمنت پویا با ${toFa(matchedIds.length)} عضو`,
      segmentType: 'static',
      staticCustomerIds: matchedIds,
      logic: 'AND',
      conditions: [],
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            سگمنت‌بندی ایستا و پویا مشتریان
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            سگمنت‌های پویا به‌صورت زنده با قوانین شرطی AND/OR و سگمنت‌های ایستا با انتخاب دستی یا اسنپ‌شات ساخته می‌شوند.
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Filter size={14} />
          ساخت سگمنت جدید
        </Button>
      </div>

      {state.customerSegments.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <EmptyState
            icon={<Users size={28} />}
            title="سگمنتی تعریف نشده است"
            description="برای دسته‌بندی هدفمند مشتریان، اولین سگمنت ایستا یا پویا را بسازید."
            actionLabel="ساخت سگمنت"
            onAction={() => setModalOpen(true)}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {state.customerSegments.map((seg) => {
            const isStatic = seg.segmentType === 'static';
            const matched = customers.filter((c) => {
              const st = statsMap.get(c.id);
              return st ? evaluateSegment(c, seg, st) : false;
            });
            return (
              <div
                key={seg.id}
                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{seg.name}</span>
                        <Badge tone={isStatic ? 'amber' : 'indigo'}>{isStatic ? 'ایستا' : 'پویا'}</Badge>
                      </div>
                      {seg.description && (
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{seg.description}</p>
                      )}
                    </div>
                    <Badge tone="emerald" className="tabular-nums">
                      {toFa(matched.length)} عضو
                    </Badge>
                  </div>

                  <div className="mt-3 space-y-1 rounded-lg bg-slate-50 p-2.5 text-[11px] text-slate-600 dark:bg-slate-800/50 dark:text-slate-300">
                    {isStatic ? (
                      <div>فهرست ثابت شامل {toFa(seg.staticCustomerIds?.length ?? 0)} مشتری انتخاب‌شده</div>
                    ) : (
                      <>
                        <div className="font-semibold text-slate-500">
                          منطق ترکیب: {seg.logic === 'AND' ? 'همه شرط‌ها (AND)' : 'حداقل یکی (OR)'}
                        </div>
                        {seg.conditions.map((cond) => (
                          <div key={cond.id}>
                            • {SEGMENT_FIELD_LABELS[cond.field]} ({cond.op}){' '}
                            <span className="font-semibold">{cond.value}</span>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onViewInList(seg.id)}
                      className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                      مشاهده اعضا
                    </button>
                    {!isStatic && (
                      <button
                        type="button"
                        onClick={() => handleSnapshotToStatic(seg)}
                        className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-indigo-600 dark:text-slate-400"
                        title="ذخیره اعضای فعلی به‌عنوان سگمنت ایستا"
                      >
                        <Camera size={12} />
                        اسنپ‌شات ایستا
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    aria-label={`حذف سگمنت ${seg.name}`}
                    onClick={() => setDeleteTarget(seg)}
                    className="p-1 text-slate-400 hover:text-rose-600"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <SegmentFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        customers={customers}
        statsMap={statsMap}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteCustomerSegment(deleteTarget.id);
        }}
        title="حذف سگمنت"
        message={`آیا از حذف سگمنت «${deleteTarget?.name ?? ''}» اطمینان دارید؟`}
        confirmLabel="حذف سگمنت"
      />
    </div>
  );
}
