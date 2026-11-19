import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useClientFlow } from '../../store/useClientFlowStore';
import type { Customer, CustomerSegment, SegmentCondition } from '../../types';
import { type CustomerComputedStats, evaluateSegment } from '../../utils/crmHelpers';
import { toFa } from '../../utils/jalali';
import { fuzzyMatchPersian } from '../../utils/persianSearch';
import { Badge, Button, Input, Modal, Select } from '../ui';

export const SEGMENT_FIELD_LABELS: Record<SegmentCondition['field'], string> = {
  lifecycle: 'چرخه عمر',
  source: 'منبع آشنایی',
  personType: 'نوع شخصیت',
  tag: 'برچسب',
  ownerName: 'مسئول پیگیری',
  minSpent: 'حداقل جمع خرید (تومان)',
  minScore: 'حداقل امتیاز مشتری (۰-۱۰۰)',
  consentSms: 'رضایت پیامک',
  consentEmail: 'رضایت ایمیل',
};

interface SegmentFormModalProps {
  open: boolean;
  onClose: () => void;
  customers: Customer[];
  statsMap: Map<string, CustomerComputedStats>;
}

export function SegmentFormModal({ open, onClose, customers, statsMap }: SegmentFormModalProps) {
  const { addCustomerSegment } = useClientFlow();
  const [segType, setSegType] = useState<'dynamic' | 'static'>('dynamic');
  const [segName, setSegName] = useState('');
  const [segDesc, setSegDesc] = useState('');
  const [segLogic, setSegLogic] = useState<'AND' | 'OR'>('AND');
  const [segConds, setSegConds] = useState<SegmentCondition[]>([
    { id: 'c1', field: 'minScore', op: 'gte', value: '60' },
  ]);
  const [staticIds, setStaticIds] = useState<string[]>([]);
  const [memberSearch, setMemberSearch] = useState('');

  const draftPreview = useMemo(() => {
    const mockSeg: CustomerSegment = {
      id: 'preview',
      name: segName,
      segmentType: segType,
      staticCustomerIds: staticIds,
      logic: segLogic,
      conditions: segConds,
      createdAt: '',
    };
    return customers.filter((c) => {
      const st = statsMap.get(c.id);
      return st ? evaluateSegment(c, mockSeg, st) : false;
    });
  }, [customers, statsMap, segName, segType, staticIds, segLogic, segConds]);

  const pickerCustomers = useMemo(() => {
    if (!memberSearch.trim()) return customers;
    return customers.filter((c) => fuzzyMatchPersian([c.name, c.phone, c.companyName], memberSearch));
  }, [customers, memberSearch]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!segName.trim()) return;
    addCustomerSegment({
      name: segName.trim(),
      description: segDesc.trim() || undefined,
      segmentType: segType,
      staticCustomerIds: segType === 'static' ? staticIds : undefined,
      logic: segLogic,
      conditions: segType === 'dynamic' ? segConds : [],
    });
    setSegName('');
    setSegDesc('');
    setStaticIds([]);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="ساخت سگمنت جدید" maxWidth="lg">
      <form onSubmit={handleSave} className="space-y-4">
        <div className="flex w-fit items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
          <button
            type="button"
            onClick={() => setSegType('dynamic')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${
              segType === 'dynamic'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100'
                : 'text-slate-500'
            }`}
          >
            سگمنت پویا (شرطی)
          </button>
          <button
            type="button"
            onClick={() => setSegType('static')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${
              segType === 'static'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100'
                : 'text-slate-500'
            }`}
          >
            سگمنت ایستا (انتخاب دستی)
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="نام سگمنت *"
            required
            value={segName}
            onChange={(e) => setSegName(e.target.value)}
            placeholder="مثلاً: مشتریان VIP آماده تمدید"
          />
          <Input label="توضیح (اختیاری)" value={segDesc} onChange={(e) => setSegDesc(e.target.value)} />
        </div>

        {segType === 'dynamic' ? (
          <div className="space-y-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            <div className="flex items-center justify-between gap-2">
              <div className="w-56">
                <Select
                  label="منطق ترکیب شرط‌ها"
                  value={segLogic}
                  onChange={(e) => setSegLogic(e.target.value as 'AND' | 'OR')}
                  options={[
                    { value: 'AND', label: 'همه شرط‌ها (AND)' },
                    { value: 'OR', label: 'حداقل یکی از شرط‌ها (OR)' },
                  ]}
                />
              </div>
              <Badge tone="indigo" className="tabular-nums">
                تعداد اعضای منطبق: {toFa(draftPreview.length)} مشتری
              </Badge>
            </div>

            {segConds.map((cond, idx) => (
              <div key={cond.id} className="grid grid-cols-12 items-center gap-2">
                <div className="col-span-4">
                  <Select
                    aria-label="فیلد شرط"
                    value={cond.field}
                    onChange={(e) => {
                      const field = e.target.value as SegmentCondition['field'];
                      setSegConds((prev) => prev.map((c, i) => (i === idx ? { ...c, field } : c)));
                    }}
                    options={Object.entries(SEGMENT_FIELD_LABELS).map(([k, v]) => ({ value: k, label: v }))}
                  />
                </div>
                <div className="col-span-3">
                  <Select
                    aria-label="عملگر شرط"
                    value={cond.op}
                    onChange={(e) => {
                      const op = e.target.value as SegmentCondition['op'];
                      setSegConds((prev) => prev.map((c, i) => (i === idx ? { ...c, op } : c)));
                    }}
                    options={[
                      { value: 'eq', label: 'برابر' },
                      { value: 'neq', label: 'نابرابر' },
                      { value: 'contains', label: 'شامل' },
                      { value: 'gte', label: 'بزرگتر/مساوی' },
                    ]}
                  />
                </div>
                <div className="col-span-4">
                  <Input
                    aria-label="مقدار شرط"
                    value={cond.value}
                    onChange={(e) => {
                      const value = e.target.value;
                      setSegConds((prev) => prev.map((c, i) => (i === idx ? { ...c, value } : c)));
                    }}
                    placeholder="مثلاً: vip یا 60 یا true"
                  />
                </div>
                <div className="col-span-1 text-left">
                  {segConds.length > 1 && (
                    <button
                      type="button"
                      aria-label="حذف شرط"
                      onClick={() => setSegConds((prev) => prev.filter((_, i) => i !== idx))}
                      className="p-1 text-rose-500 hover:text-rose-700"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}

            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                setSegConds((prev) => [
                  ...prev,
                  { id: `c_${Date.now()}`, field: 'lifecycle', op: 'eq', value: 'vip' },
                ])
              }
            >
              <Plus size={13} />
              افزودن شرط
            </Button>
          </div>
        ) : (
          <div className="space-y-2 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            <div className="flex items-center justify-between gap-2">
              <div className="w-64">
                <Input
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  placeholder="جستجوی مشتری برای افزودن..."
                />
              </div>
              <Badge tone="amber" className="tabular-nums">
                {toFa(staticIds.length)} مشتری انتخاب شده
              </Badge>
            </div>
            <div className="max-h-52 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
              {pickerCustomers.map((c) => {
                const checked = staticIds.includes(c.id);
                return (
                  <label
                    key={c.id}
                    className="flex cursor-pointer items-center justify-between px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setStaticIds((prev) =>
                            prev.includes(c.id) ? prev.filter((x) => x !== c.id) : [...prev, c.id],
                          )
                        }
                      />
                      <span className="font-medium text-slate-800 dark:text-slate-100">{c.name}</span>
                    </span>
                    <span className="tabular-nums text-slate-400" dir="ltr">
                      {toFa(c.phone)}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
          <Button variant="secondary" size="md" onClick={onClose}>
            انصراف
          </Button>
          <Button type="submit" size="md">
            ذخیره سگمنت ({toFa(draftPreview.length)} عضو)
          </Button>
        </div>
      </form>
    </Modal>
  );
}
