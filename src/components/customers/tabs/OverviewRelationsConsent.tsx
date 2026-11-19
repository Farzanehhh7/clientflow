import { useMemo, useState } from 'react';
import { GitFork, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { useClientFlow } from '../../../store/useClientFlowStore';
import type { ConsentChannel, Customer, CustomerRelationType } from '../../../types';
import { formatJalaliDateTime, toFa } from '../../../utils/jalali';
import { Badge, Button, Input, Select } from '../../ui';

const RELATION_LABELS: Record<CustomerRelationType, string> = {
  referrer: 'معرف',
  family: 'خانواده / بستگان',
  colleague: 'همکار / هم‌سازمانی',
};

const CONSENT_LABELS: Record<ConsentChannel, string> = {
  sms: 'پیامک (SMS)',
  email: 'ایمیل',
  photo: 'تصویر/مستندات',
};

interface OverviewRelationsConsentProps {
  customer: Customer;
  onSelectCustomer: (customerId: string) => void;
}

export function OverviewRelationsConsent({ customer, onSelectCustomer }: OverviewRelationsConsentProps) {
  const { state, updateCustomerConsent, addCustomerRelation, removeCustomerRelation, pushToast } =
    useClientFlow();

  const [relTargetId, setRelTargetId] = useState('');
  const [relType, setRelType] = useState<CustomerRelationType>('referrer');
  const [relNote, setRelNote] = useState('');

  const relations = useMemo(
    () =>
      state.customerRelations.filter(
        (r) => r.fromCustomerId === customer.id || r.toCustomerId === customer.id,
      ),
    [state.customerRelations, customer.id],
  );

  const consentLogs = useMemo(
    () => (state.consentLogs ?? []).filter((l) => l.customerId === customer.id),
    [state.consentLogs, customer.id],
  );

  const handleAddRelation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!relTargetId) {
      pushToast('مشتری مقابل را انتخاب کنید.', 'error');
      return;
    }
    addCustomerRelation({
      fromCustomerId: customer.id,
      toCustomerId: relTargetId,
      relationType: relType,
      note: relNote.trim() || undefined,
    });
    setRelTargetId('');
    setRelNote('');
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
          <GitFork size={15} className="text-violet-500" />
          درخت ارتباطات ({toFa(relations.length)})
        </div>
        <div className="space-y-1.5">
          {relations.map((rel) => {
            const otherId = rel.fromCustomerId === customer.id ? rel.toCustomerId : rel.fromCustomerId;
            const other = state.customers.find((c) => c.id === otherId);
            return (
              <div
                key={rel.id}
                className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-xs dark:border-slate-800"
              >
                <div className="flex items-center gap-2">
                  <Badge tone="violet">{RELATION_LABELS[rel.relationType]}</Badge>
                  <button
                    type="button"
                    onClick={() => other && onSelectCustomer(other.id)}
                    className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                  >
                    {other?.name ?? otherId}
                  </button>
                  {rel.note && <span className="text-slate-400">({rel.note})</span>}
                </div>
                <button
                  type="button"
                  aria-label="حذف ارتباط"
                  onClick={() => removeCustomerRelation(rel.id)}
                  className="text-slate-400 hover:text-rose-600"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })}
        </div>
        <form onSubmit={handleAddRelation} className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Select
            aria-label="مشتری مرتبط"
            value={relTargetId}
            onChange={(e) => setRelTargetId(e.target.value)}
            options={[
              { value: '', label: '-- انتخاب مشتری --' },
              ...state.customers
                .filter((c) => c.id !== customer.id && !c.isDeleted)
                .map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
          <Select
            aria-label="نوع ارتباط"
            value={relType}
            onChange={(e) => setRelType(e.target.value as CustomerRelationType)}
            options={Object.entries(RELATION_LABELS).map(([k, v]) => ({ value: k, label: v }))}
          />
          <div className="flex gap-1.5">
            <Input value={relNote} onChange={(e) => setRelNote(e.target.value)} placeholder="توضیح..." />
            <Button type="submit" size="sm" aria-label="ثبت ارتباط">
              <Plus size={14} />
            </Button>
          </div>
        </form>
      </div>

      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
          <ShieldCheck size={15} className="text-emerald-600" />
          مدیریت رضایت ارتباطی و تاریخچه ممیزی (Consent Log)
        </div>
        <div className="flex flex-wrap gap-3 text-xs">
          {(
            [
              ['sms', customer.consentSms !== false],
              ['email', customer.consentEmail !== false],
              ['photo', Boolean(customer.consentPhoto)],
            ] as [ConsentChannel, boolean][]
          ).map(([ch, granted]) => (
            <label
              key={ch}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 dark:border-slate-700"
            >
              <input
                type="checkbox"
                checked={granted}
                onChange={(e) => updateCustomerConsent(customer.id, ch, e.target.checked, 'پروفایل ۳۶۰')}
              />
              <span>{CONSENT_LABELS[ch]}</span>
            </label>
          ))}
        </div>
        <div className="max-h-36 space-y-1.5 overflow-y-auto text-[11px]">
          {consentLogs.length === 0 ? (
            <p className="text-slate-400">تغییر رضایتی در تاریخچه ثبت نشده است.</p>
          ) : (
            consentLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between rounded-md bg-slate-50 px-2.5 py-1.5 dark:bg-slate-800/50"
              >
                <span>
                  {CONSENT_LABELS[log.channel]}:{' '}
                  <span className={log.granted ? 'font-semibold text-emerald-600' : 'font-semibold text-rose-600'}>
                    {log.granted ? 'تأیید شد' : 'لغو شد'}
                  </span>{' '}
                  ({log.actor})
                </span>
                <span className="tabular-nums text-slate-400">{formatJalaliDateTime(log.at)}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
