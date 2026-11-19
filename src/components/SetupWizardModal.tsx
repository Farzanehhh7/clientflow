import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { INDUSTRY_PACKS } from '../data/packs';
import { useClientFlow } from '../store/useClientFlowStore';
import type { IndustryPack } from '../types';
import { toFa } from '../utils/jalali';
import { Modal } from './Modal';

interface SetupWizardModalProps {
  open: boolean;
  onClose: () => void;
}

const WEEKDAY_OPTIONS: { dayIndex: number; label: string }[] = [
  { dayIndex: 6, label: 'شنبه' },
  { dayIndex: 0, label: 'یکشنبه' },
  { dayIndex: 1, label: 'دوشنبه' },
  { dayIndex: 2, label: 'سه‌شنبه' },
  { dayIndex: 3, label: 'چهارشنبه' },
  { dayIndex: 4, label: 'پنج‌شنبه' },
  { dayIndex: 5, label: 'جمعه' },
];

export function SetupWizardModal({ open, onClose }: SetupWizardModalProps) {
  const { state, updateSettings, applyIndustryPack, addService, addResource, addProduct, pushToast } =
    useClientFlow();
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [businessName, setBusinessName] = useState(state.settings.businessName);
  const [pack, setPack] = useState<IndustryPack>(state.settings.industryPack);
  const [workStartHour, setWorkStartHour] = useState(state.settings.workStartHour);
  const [workEndHour, setWorkEndHour] = useState(state.settings.workEndHour);
  const [workDays, setWorkDays] = useState<number[]>(state.settings.workDays);

  const [starterService, setStarterService] = useState('');
  const [starterResource, setStarterResource] = useState('');
  const [starterProduct, setStarterProduct] = useState('');

  const toggleWorkDay = (dayIdx: number) => {
    setWorkDays((prev) =>
      prev.includes(dayIdx) ? prev.filter((d) => d !== dayIdx) : [...prev, dayIdx],
    );
  };

  const handleFinish = () => {
    updateSettings({
      businessName: businessName.trim() || state.settings.businessName,
      workStartHour,
      workEndHour,
      workDays: workDays.length > 0 ? workDays : [6, 0, 1, 2, 3, 4],
    });
    applyIndustryPack(pack, true);
    if (starterService.trim()) {
      addService({ name: starterService.trim(), durationMin: 30, price: 500000 });
    }
    if (starterResource.trim()) {
      addResource({ name: starterResource.trim(), type: 'staff' });
    }
    if (starterProduct.trim()) {
      addProduct({
        name: starterProduct.trim(),
        sku: `CF-${state.products.length + 201}`,
        price: 750000,
        stock: 25,
        active: true,
      });
    }
    pushToast('پیکربندی اولیه کسب‌وکار و نصب بسته صنعتی با ویزارد تکمیل شد.');
    setStep(1);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="ویزارد راه‌اندازی سریع کسب‌وکار (۱۰ پک صنعتی)" maxWidth="xl">
      <div className="space-y-5">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3 text-xs dark:border-slate-800">
          {(
            [
              [1, '۱. هویت و بسته صنعتی'],
              [2, '۲. ساعات و روزهای کاری'],
              [3, '۳. خدمات و اقلام اولیه'],
            ] as const
          ).map(([s, label]) => (
            <button
              key={s}
              type="button"
              onClick={() => setStep(s)}
              className={`font-medium ${
                step === s
                  ? 'text-indigo-600 dark:text-indigo-400'
                  : 'text-slate-400 dark:text-slate-500'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                نام کسب‌وکار یا مجموعه
              </label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>

            <div>
              <div className="mb-2 text-xs font-medium text-slate-600 dark:text-slate-400">
                انتخاب بسته صنعتی ({toFa(INDUSTRY_PACKS.length)} پک تخصصی آماده)
              </div>
              <div className="grid max-h-72 grid-cols-1 gap-2.5 overflow-y-auto pr-1 sm:grid-cols-2">
                {INDUSTRY_PACKS.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setPack(p.key as IndustryPack)}
                    className={`rounded-xl border p-3 text-right transition-colors ${
                      pack === p.key
                        ? 'border-indigo-600 bg-indigo-50/60 dark:border-indigo-500 dark:bg-indigo-950/30'
                        : 'border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold">{p.name}</span>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {p.tier === 'full' ? 'کامل' : p.tier === 'medium' ? 'متوسط' : 'سبک'}
                      </span>
                    </div>
                    <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{p.description}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  ساعت شروع کار
                </label>
                <select
                  value={workStartHour}
                  onChange={(e) => setWorkStartHour(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm tabular-nums dark:border-slate-700 dark:bg-slate-800"
                >
                  {Array.from({ length: 8 }, (_, i) => 6 + i).map((h) => (
                    <option key={h} value={h}>
                      {toFa(String(h).padStart(2, '0'))}:۰۰
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  ساعت پایان کار
                </label>
                <select
                  value={workEndHour}
                  onChange={(e) => setWorkEndHour(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm tabular-nums dark:border-slate-700 dark:bg-slate-800"
                >
                  {Array.from({ length: 8 }, (_, i) => 15 + i).map((h) => (
                    <option key={h} value={h}>
                      {toFa(String(h).padStart(2, '0'))}:۰۰
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <div className="mb-2 text-xs font-medium text-slate-600 dark:text-slate-400">
                روزهای کاری مجموعه در هفته
              </div>
              <div className="flex flex-wrap gap-2">
                {WEEKDAY_OPTIONS.map((d) => {
                  const active = workDays.includes(d.dayIndex);
                  return (
                    <button
                      key={d.dayIndex}
                      type="button"
                      onClick={() => toggleWorkDay(d.dayIndex)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                        active
                          ? 'border-indigo-600 bg-indigo-600 text-white'
                          : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              در صورت نیاز می‌توانید یک خدمت، پزشک/کارشناس یا محصول اولیه هم‌اکنون اضافه کنید (اختیاری):
            </p>
            <div>
              <label className="mb-1 block text-xs text-slate-500">خدمت نوبت‌دهی جدید</label>
              <input
                type="text"
                value={starterService}
                onChange={(e) => setStarterService(e.target.value)}
                placeholder="مثلاً: مشاوره تخصصی اولیه"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">پزشک / کارشناس / اتاق جدید</label>
              <input
                type="text"
                value={starterResource}
                onChange={(e) => setStarterResource(e.target.value)}
                placeholder="مثلاً: دکتر شریفی"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">محصول / بسته جدید</label>
              <input
                type="text"
                value={starterProduct}
                onChange={(e) => setStarterProduct(e.target.value)}
                placeholder="مثلاً: اشتراک پشتیبانی سالانه"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-slate-200 pt-3 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium dark:border-slate-700"
          >
            بستن
          </button>

          <div className="flex items-center gap-2">
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep((s) => (s === 3 ? 2 : 1))}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium dark:border-slate-700"
              >
                مرحله قبل
              </button>
            )}
            {step < 3 ? (
              <button
                type="button"
                onClick={() => setStep((s) => (s === 1 ? 2 : 3))}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700"
              >
                مرحله بعد
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinish}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-700"
              >
                <CheckCircle2 size={15} />
                ذخیره و نصب بسته صنعتی
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
