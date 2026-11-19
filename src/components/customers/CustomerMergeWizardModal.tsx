import { useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, CheckCircle2, GitMerge, ShieldAlert } from 'lucide-react';
import type { DuplicateCandidate } from '../../data/repositories/types';
import { useClientFlow } from '../../store/useClientFlowStore';
import type { Customer } from '../../types';
import { formatJalali, toFa } from '../../utils/jalali';
import { Badge, Button, Modal, Select } from '../ui';

interface CustomerMergeWizardModalProps {
  open: boolean;
  onClose: () => void;
  candidates: DuplicateCandidate[];
}

type MergeFieldKey =
  | 'name'
  | 'phone'
  | 'email'
  | 'nationalId'
  | 'companyName'
  | 'lifecycle'
  | 'ownerName'
  | 'source'
  | 'birthDateJalali';

const MERGE_FIELDS: { key: MergeFieldKey; label: string }[] = [
  { key: 'name', label: 'نام مشتری' },
  { key: 'phone', label: 'شماره موبایل' },
  { key: 'email', label: 'ایمیل' },
  { key: 'nationalId', label: 'کد ملی' },
  { key: 'companyName', label: 'نام شرکت' },
  { key: 'lifecycle', label: 'چرخه عمر' },
  { key: 'ownerName', label: 'مسئول پیگیری' },
  { key: 'source', label: 'منبع آشنایی' },
  { key: 'birthDateJalali', label: 'تاریخ تولد شمسی' },
];

export function CustomerMergeWizardModal({ open, onClose, candidates }: CustomerMergeWizardModalProps) {
  const { state, mergeCustomers, pushToast } = useClientFlow();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [primaryId, setPrimaryId] = useState('');
  const [duplicateId, setDuplicateId] = useState('');
  const [choices, setChoices] = useState<Record<MergeFieldKey, 'primary' | 'duplicate'>>({
    name: 'primary',
    phone: 'primary',
    email: 'primary',
    nationalId: 'primary',
    companyName: 'primary',
    lifecycle: 'primary',
    ownerName: 'primary',
    source: 'primary',
    birthDateJalali: 'primary',
  });

  useEffect(() => {
    if (!open) return;
    setStep(1);
    if (candidates[0]) {
      setPrimaryId(candidates[0].a.id);
      setDuplicateId(candidates[0].b.id);
    } else {
      setPrimaryId(state.customers[0]?.id ?? '');
      setDuplicateId(state.customers[1]?.id ?? '');
    }
  }, [open, candidates, state.customers]);

  const primary = state.customers.find((c) => c.id === primaryId);
  const duplicate = state.customers.find((c) => c.id === duplicateId);

  useEffect(() => {
    if (!primary || !duplicate) return;
    const next: Record<MergeFieldKey, 'primary' | 'duplicate'> = {
      name: primary.name ? 'primary' : 'duplicate',
      phone: primary.phone ? 'primary' : 'duplicate',
      email: primary.email ? 'primary' : duplicate.email ? 'duplicate' : 'primary',
      nationalId: primary.nationalId ? 'primary' : duplicate.nationalId ? 'duplicate' : 'primary',
      companyName: primary.companyName ? 'primary' : duplicate.companyName ? 'duplicate' : 'primary',
      lifecycle: primary.lifecycle === 'vip' ? 'primary' : duplicate.lifecycle === 'vip' ? 'duplicate' : 'primary',
      ownerName: primary.ownerName ? 'primary' : duplicate.ownerName ? 'duplicate' : 'primary',
      source: primary.source ? 'primary' : duplicate.source ? 'duplicate' : 'primary',
      birthDateJalali: primary.birthDateJalali ? 'primary' : duplicate.birthDateJalali ? 'duplicate' : 'primary',
    };
    setChoices(next);
  }, [primaryId, duplicateId, primary, duplicate]);

  const historySummary = useMemo(() => {
    if (!duplicate) return null;
    return {
      interactions: state.interactions.filter((i) => i.customerId === duplicate.id).length,
      appointments: state.appointments.filter((a) => a.customerId === duplicate.id).length,
      orders: state.orders.filter((o) => o.customerId === duplicate.id).length,
      invoices: state.invoices.filter((inv) => inv.customerId === duplicate.id).length,
      tickets: state.tickets.filter((t) => t.customerId === duplicate.id).length,
      opportunities: state.opportunities.filter((o) => o.customerId === duplicate.id).length,
      relations: state.customerRelations.filter(
        (r) => r.fromCustomerId === duplicate.id || r.toCustomerId === duplicate.id,
      ).length,
      contacts: duplicate.contacts?.length ?? 0,
      addresses: duplicate.addresses?.length ?? 0,
    };
  }, [duplicate, state]);

  const buildMergedPatch = (): Partial<Customer> => {
    if (!primary || !duplicate) return {};
    const patch: Partial<Customer> = {};
    for (const { key } of MERGE_FIELDS) {
      const picked = choices[key] === 'duplicate' ? duplicate[key] : primary[key];
      if (picked !== undefined) {
        (patch as Record<string, unknown>)[key] = picked;
      }
    }
    return patch;
  };

  const handleConfirmMerge = () => {
    if (!primary || !duplicate || primary.id === duplicate.id) return;
    const res = mergeCustomers(primary.id, duplicate.id, buildMergedPatch());
    if (!res.ok) {
      pushToast(res.error ?? 'خطا در ادغام مشتریان', 'error');
      return;
    }
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="ویزارد هوشمند تشخیص و ادغام تکراری‌ها" maxWidth="2xl">
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-xs">
          {[
            { n: 1, label: '۱. انتخاب زوج تکراری' },
            { n: 2, label: '۲. انتخاب فیلدهای برنده' },
            { n: 3, label: '۳. تایید و انتقال تاریخچه' },
          ].map((item) => (
            <div
              key={item.n}
              className={`flex-1 rounded-lg border px-3 py-2 text-center font-medium ${
                step === item.n
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300'
                  : 'border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-800/40'
              }`}
            >
              {item.label}
            </div>
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-4">
            {candidates.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                  {toFa(candidates.length)} مورد مشکوک به تکرار (موبایل، کد ملی یا شباهت نام) شناسایی شد:
                </p>
                <div className="max-h-48 space-y-2 overflow-y-auto">
                  {candidates.map((cand, idx) => (
                    <div
                      key={`${cand.a.id}_${cand.b.id}_${idx}`}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50/70 p-2.5 text-xs dark:border-amber-900/60 dark:bg-amber-950/30"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="amber">{cand.reason}</Badge>
                        <Badge tone="neutral" className="tabular-nums">
                          اطمینان {toFa(cand.score)}٪
                        </Badge>
                        <span className="font-semibold text-slate-800 dark:text-slate-100">
                          {cand.a.name} ↔ {cand.b.name}
                        </span>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setPrimaryId(cand.a.id);
                          setDuplicateId(cand.b.id);
                          setStep(2);
                        }}
                      >
                        انتخاب و مقایسه
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 text-xs text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
                <CheckCircle2 size={16} />
                مورد تکراری خودکاری یافت نشد؛ می‌توانید دو پرونده را به‌صورت دستی برای ادغام انتخاب کنید.
              </div>
            )}

            <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-11">
              <div className="sm:col-span-5">
                <Select
                  label="پرونده مقصد (باقی می‌ماند)"
                  value={primaryId}
                  onChange={(e) => setPrimaryId(e.target.value)}
                  options={state.customers.map((c) => ({
                    value: c.id,
                    label: `${c.name} (${toFa(c.phone)})`,
                  }))}
                />
              </div>
              <div className="flex justify-center sm:col-span-1">
                <Button
                  variant="ghost"
                  size="sm"
                  title="جابه‌جایی مبدأ و مقصد"
                  onClick={() => {
                    setPrimaryId(duplicateId);
                    setDuplicateId(primaryId);
                  }}
                >
                  <ArrowLeftRight size={15} />
                </Button>
              </div>
              <div className="sm:col-span-5">
                <Select
                  label="پرونده تکراری (ادغام و حذف می‌شود)"
                  value={duplicateId}
                  onChange={(e) => setDuplicateId(e.target.value)}
                  options={state.customers.map((c) => ({
                    value: c.id,
                    label: `${c.name} (${toFa(c.phone)})`,
                  }))}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
              <Button variant="secondary" size="md" onClick={onClose}>
                انصراف
              </Button>
              <Button
                size="md"
                disabled={!primary || !duplicate || primary.id === duplicate.id}
                onClick={() => setStep(2)}
              >
                مرحله بعد: مقایسه فیلدها
              </Button>
            </div>
          </div>
        )}

        {step === 2 && primary && duplicate && (
          <div className="space-y-4">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              برای هر فیلد مشخص کنید مقدار کدام پرونده حفظ شود. مخاطبان، آدرس‌ها، فایل‌ها و برچسب‌های هر دو ترکیب می‌شوند.
            </p>
            <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-500 dark:bg-slate-800">
                  <tr>
                    <th className="px-3 py-2 font-medium">فیلد</th>
                    <th className="px-3 py-2 font-medium">مقصد ({primary.name})</th>
                    <th className="px-3 py-2 font-medium">تکراری ({duplicate.name})</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {MERGE_FIELDS.map(({ key, label }) => {
                    const pVal = String(primary[key] ?? '—');
                    const dVal = String(duplicate[key] ?? '—');
                    return (
                      <tr key={key}>
                        <td className="px-3 py-2 font-medium text-slate-700 dark:text-slate-200">{label}</td>
                        <td className="px-3 py-2">
                          <label className="flex cursor-pointer items-center gap-1.5">
                            <input
                              type="radio"
                              name={`merge_${key}`}
                              checked={choices[key] === 'primary'}
                              onChange={() => setChoices((c) => ({ ...c, [key]: 'primary' }))}
                            />
                            <span className="tabular-nums">{toFa(pVal)}</span>
                          </label>
                        </td>
                        <td className="px-3 py-2">
                          <label className="flex cursor-pointer items-center gap-1.5">
                            <input
                              type="radio"
                              name={`merge_${key}`}
                              checked={choices[key] === 'duplicate'}
                              onChange={() => setChoices((c) => ({ ...c, [key]: 'duplicate' }))}
                            />
                            <span className="tabular-nums">{toFa(dVal)}</span>
                          </label>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between border-t border-slate-200 pt-3 dark:border-slate-800">
              <Button variant="secondary" size="md" onClick={() => setStep(1)}>
                مرحله قبل
              </Button>
              <Button size="md" onClick={() => setStep(3)}>
                مرحله بعد: پیش‌نمایش نهایی
              </Button>
            </div>
          </div>
        )}

        {step === 3 && primary && duplicate && historySummary && (
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-xl border border-indigo-200 bg-indigo-50/70 p-3 text-xs text-indigo-800 dark:border-indigo-900/60 dark:bg-indigo-950/30 dark:text-indigo-200">
              <ShieldAlert size={16} className="mt-0.5 shrink-0" />
              <div>
                پرونده <span className="font-bold">«{duplicate.name}»</span> (ثبت: {formatJalali(duplicate.createdAt)}) در پرونده{' '}
                <span className="font-bold">«{primary.name}»</span> ادغام می‌شود و تمامی سوابق بدون از دست رفتن اطلاعات منتقل می‌گردند:
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
              {[
                ['تعاملات تایم‌لاین', historySummary.interactions],
                ['نوبت‌ها', historySummary.appointments],
                ['سفارش‌ها', historySummary.orders],
                ['فاکتورها', historySummary.invoices],
                ['تیکت‌ها', historySummary.tickets],
                ['فرصت‌های فروش', historySummary.opportunities],
                ['مخاطبان جانبی', historySummary.contacts],
                ['آدرس‌ها', historySummary.addresses],
                ['ارتباطات درختی', historySummary.relations],
              ].map(([label, count]) => (
                <div
                  key={String(label)}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-800/40"
                >
                  <span className="text-slate-600 dark:text-slate-300">{label}</span>
                  <span className="font-bold tabular-nums">{toFa(Number(count))}</span>
                </div>
              ))}
            </div>

            <div className="flex justify-between border-t border-slate-200 pt-3 dark:border-slate-800">
              <Button variant="secondary" size="md" onClick={() => setStep(2)}>
                بازگشت به مقایسه
              </Button>
              <Button size="md" onClick={handleConfirmMerge}>
                <GitMerge size={15} />
                تایید و ادغام کامل پرونده
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
