import { useState } from 'react';
import { Bell, FileText, Plus, Receipt, RefreshCw, Shield, Wrench } from 'lucide-react';
import { Modal } from '../Modal';
import { JalaliDatePicker } from '../ui/JalaliDatePicker';
import { useClientFlow } from '../../store/useClientFlowStore';
import type { ContractStatus, WarrantyClaim, WarrantyRecord } from '../../types';
import {
  formatJalali,
  formatToman,
  getTodayJalaliAscii,
  jalaliToIsoUtc,
  toFa,
} from '../../utils/jalali';

const CONTRACT_STATUS_META: Record<ContractStatus, { label: string; cls: string }> = {
  draft: { label: 'پیش‌نویس', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
  active: { label: 'فعال', cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' },
  expiring_soon: { label: 'در آستانه انقضا', cls: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' },
  renewed: { label: 'تمدیدشده', cls: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300' },
  expired: { label: 'منقضی‌شده', cls: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300' },
};

export function ContractsWarrantiesTab() {
  const {
    state,
    addContract,
    renewContract,
    updateContractStatus,
    runContractRenewalReminders,
    createInvoiceFromContract,
    addWarrantyRecord,
    addWarrantyClaim,
    updateWarrantyClaimStatus,
  } = useClientFlow();

  // Contract modal
  const [ctrModalOpen, setCtrModalOpen] = useState(false);
  const [ctrTitle, setCtrTitle] = useState('');
  const [ctrCustomerId, setCtrCustomerId] = useState(state.customers[0]?.id ?? '');
  const [ctrAmount, setCtrAmount] = useState('12000000');
  const [ctrStartJalali, setCtrStartJalali] = useState(() => getTodayJalaliAscii());
  const [ctrEndJalali, setCtrEndJalali] = useState(() => getTodayJalaliAscii());
  const [ctrReminderDays, setCtrReminderDays] = useState('14');
  const [ctrAutoRenew, setCtrAutoRenew] = useState(true);

  // Warranty modal
  const [warModalOpen, setWarModalOpen] = useState(false);
  const [warCustomerId, setWarCustomerId] = useState(state.customers[0]?.id ?? '');
  const [warProductId, setWarProductId] = useState('');
  const [warProductName, setWarProductName] = useState('');
  const [warSerial, setWarSerial] = useState('');
  const [warOrderId, setWarOrderId] = useState('');
  const [warStartJalali, setWarStartJalali] = useState(() => getTodayJalaliAscii());
  const [warEndJalali, setWarEndJalali] = useState(() => getTodayJalaliAscii());

  // Claims modal
  const [activeWarranty, setActiveWarranty] = useState<WarrantyRecord | null>(null);
  const [claimIssue, setClaimIssue] = useState('');
  const [claimResolution, setClaimResolution] = useState('');
  const [claimCoveredBy, setClaimCoveredBy] = useState<WarrantyClaim['costCoveredBy']>('warranty');

  const liveWarranty = activeWarranty
    ? state.warranties.find((w) => w.id === activeWarranty.id) ?? activeWarranty
    : null;

  return (
    <div className="space-y-6">
      {/* Contracts Section */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <FileText size={16} className="text-indigo-500" />
              قراردادها و قوانین یادآور تمدید ({toFa(state.contracts.length)})
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              پیگیری سررسید قراردادها، ارسال خودکار یادآور تمدید به Outbox، تمدید یک‌کلیکی و صدور فاکتور مستقیم.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => runContractRenewalReminders()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300"
            >
              <Bell size={14} />
              اجرای یادآور سررسید (Outbox)
            </button>
            <button
              type="button"
              onClick={() => setCtrModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
            >
              <Plus size={14} />
              قرارداد جدید
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="border-b border-slate-200 bg-slate-50/70 text-slate-500 dark:border-slate-800 dark:bg-slate-800/40">
              <tr>
                <th className="px-3 py-2.5 font-medium">شماره / عنوان</th>
                <th className="px-3 py-2.5 font-medium">مشتری</th>
                <th className="px-3 py-2.5 font-medium">بازه زمانی (شمسی)</th>
                <th className="px-3 py-2.5 font-medium">مبلغ قرارداد</th>
                <th className="px-3 py-2.5 font-medium">وضعیت و یادآور</th>
                <th className="px-3 py-2.5 text-left font-medium">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {state.contracts.map((c) => {
                const cust = state.customers.find((cu) => cu.id === c.customerId);
                const meta = CONTRACT_STATUS_META[c.status];
                return (
                  <tr key={c.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                    <td className="px-3 py-2.5">
                      <div className="font-mono text-[11px] text-slate-400">{c.contractNo}</div>
                      <div className="font-semibold text-slate-900 dark:text-slate-100">{c.title}</div>
                    </td>
                    <td className="px-3 py-2.5 font-medium">{cust?.name ?? 'مشتری'}</td>
                    <td className="px-3 py-2.5 tabular-nums text-slate-600 dark:text-slate-300">
                      {formatJalali(c.startDate)} تا {formatJalali(c.endDate)}
                    </td>
                    <td className="px-3 py-2.5 font-semibold tabular-nums">{formatToman(c.amount)}</td>
                    <td className="px-3 py-2.5">
                      <select
                        value={c.status}
                        onChange={(e) => updateContractStatus(c.id, e.target.value as ContractStatus)}
                        className={`rounded px-2 py-0.5 text-[11px] font-medium outline-none ${meta.cls}`}
                      >
                        {(Object.keys(CONTRACT_STATUS_META) as ContractStatus[]).map((st) => (
                          <option key={st} value={st}>
                            {CONTRACT_STATUS_META[st].label}
                          </option>
                        ))}
                      </select>
                      <div className="mt-1 text-[10px] text-slate-400 tabular-nums">
                        یادآور {toFa(c.renewalReminderDays)} روز قبل
                        {c.autoRenew ? ' · تمدید خودکار' : ''}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-left">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => renewContract(c.id)}
                          className="inline-flex items-center gap-1 rounded border border-indigo-200 px-2 py-1 text-[11px] text-indigo-700 hover:bg-indigo-50 dark:border-indigo-900 dark:text-indigo-300"
                        >
                          <RefreshCw size={12} />
                          تمدید
                        </button>
                        <button
                          type="button"
                          onClick={() => createInvoiceFromContract(c.id)}
                          className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200"
                        >
                          <Receipt size={12} />
                          صدور فاکتور
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Warranties & After-Sales Section */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Shield size={16} className="text-emerald-500" />
              گارانتی و خدمات پس از فروش ({toFa(state.warranties.length)})
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              ثبت شماره سریال، تاریخ شروع/انقضا، و پرونده پذیرش تعمیرات و سوابق خدمات پس از فروش.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setWarModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
          >
            <Plus size={14} />
            ثبت گارانتی جدید
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="border-b border-slate-200 bg-slate-50/70 text-slate-500 dark:border-slate-800 dark:bg-slate-800/40">
              <tr>
                <th className="px-3 py-2.5 font-medium">محصول / دستگاه</th>
                <th className="px-3 py-2.5 font-medium">شماره سریال</th>
                <th className="px-3 py-2.5 font-medium">مشتری</th>
                <th className="px-3 py-2.5 font-medium">اعتبار گارانتی</th>
                <th className="px-3 py-2.5 font-medium">وضعیت و پذیرش‌ها</th>
                <th className="px-3 py-2.5 text-left font-medium">خدمات پس از فروش</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {state.warranties.map((w) => {
                const cust = state.customers.find((cu) => cu.id === w.customerId);
                return (
                  <tr key={w.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                    <td className="px-3 py-2.5 font-semibold">{w.productName}</td>
                    <td className="px-3 py-2.5 font-mono text-slate-600 dark:text-slate-300" dir="ltr">
                      {w.serialNumber}
                    </td>
                    <td className="px-3 py-2.5">{cust?.name ?? 'مشتری'}</td>
                    <td className="px-3 py-2.5 tabular-nums text-slate-500">
                      {formatJalali(w.startDate)} تا {formatJalali(w.endDate)}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`rounded px-2 py-0.5 text-[11px] font-medium ${
                          w.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {w.status === 'active' ? 'دارای اعتبار' : w.status === 'expired' ? 'منقضی' : 'باطل'}
                      </span>
                      <span className="mr-2 tabular-nums text-slate-500">
                        {toFa(w.claims.length)} پرونده
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-left">
                      <button
                        type="button"
                        onClick={() => setActiveWarranty(w)}
                        className="inline-flex items-center gap-1 rounded border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200"
                      >
                        <Wrench size={12} />
                        پذیرش و سوابق ({toFa(w.claims.length)})
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Contract Modal */}
      <Modal open={ctrModalOpen} onClose={() => setCtrModalOpen(false)} title="ثبت قرارداد جدید" maxWidth="md">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!ctrTitle.trim()) return;
            const startIso = jalaliToIsoUtc(ctrStartJalali) ?? new Date().toISOString();
            const endIso =
              jalaliToIsoUtc(ctrEndJalali) ?? new Date(Date.now() + 365 * 24 * 3600_000).toISOString();
            addContract({
              customerId: ctrCustomerId,
              title: ctrTitle.trim(),
              startDate: startIso,
              endDate: endIso,
              amount: Math.max(0, Number(ctrAmount) || 0),
              renewalReminderDays: Math.max(1, Number(ctrReminderDays) || 14),
              autoRenew: ctrAutoRenew,
              status: 'active',
            });
            setCtrTitle('');
            setCtrModalOpen(false);
          }}
          className="space-y-3"
        >
          <div>
            <label className="mb-1 block text-xs text-slate-500">عنوان قرارداد *</label>
            <input
              type="text"
              required
              value={ctrTitle}
              onChange={(e) => setCtrTitle(e.target.value)}
              placeholder="مثلاً: قرارداد پشتیبانی سالانه نرم‌افزار یا سرویس دوره‌ای"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-slate-500">مشتری / کارفرما</label>
              <select
                value={ctrCustomerId}
                onChange={(e) => setCtrCustomerId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
              >
                {state.customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">مبلغ قرارداد (تومان)</label>
              <input
                type="number"
                min={0}
                value={ctrAmount}
                onChange={(e) => setCtrAmount(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <JalaliDatePicker label="تاریخ شروع (شمسی)" value={ctrStartJalali} onChange={setCtrStartJalali} />
            <JalaliDatePicker label="تاریخ پایان (شمسی)" value={ctrEndJalali} onChange={setCtrEndJalali} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-slate-500">ارسال یادآور چند روز قبل از انقضا</label>
              <input
                type="number"
                min={1}
                value={ctrReminderDays}
                onChange={(e) => setCtrReminderDays(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <label className="flex cursor-pointer items-center gap-2 pt-5 text-xs text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={ctrAutoRenew}
                onChange={(e) => setCtrAutoRenew(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600"
              />
              تمدید خودکار دوره‌ای فعال باشد
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setCtrModalOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-1.5 text-xs dark:border-slate-700"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
            >
              ثبت قرارداد
            </button>
          </div>
        </form>
      </Modal>

      {/* Create Warranty Modal */}
      <Modal open={warModalOpen} onClose={() => setWarModalOpen(false)} title="ثبت کارت گارانتی جدید" maxWidth="md">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const chosenProd = state.products.find((p) => p.id === warProductId);
            const finalProdName = warProductName.trim() || chosenProd?.name;
            if (!finalProdName || !warSerial.trim()) return;
            addWarrantyRecord({
              customerId: warCustomerId,
              productId: warProductId || undefined,
              productName: finalProdName,
              serialNumber: warSerial.trim(),
              orderId: warOrderId.trim() || undefined,
              startDate: jalaliToIsoUtc(warStartJalali) ?? new Date().toISOString(),
              endDate: jalaliToIsoUtc(warEndJalali) ?? new Date(Date.now() + 365 * 24 * 3600_000).toISOString(),
              status: 'active',
            });
            setWarSerial('');
            setWarProductName('');
            setWarModalOpen(false);
          }}
          className="space-y-3"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-slate-500">مشتری</label>
              <select
                value={warCustomerId}
                onChange={(e) => setWarCustomerId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
              >
                {state.customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">انتخاب از کاتالوگ (اختیاری)</label>
              <select
                value={warProductId}
                onChange={(e) => {
                  setWarProductId(e.target.value);
                  const found = state.products.find((p) => p.id === e.target.value);
                  if (found) setWarProductName(found.name);
                }}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="">وارد کردن دستی نام کالا...</option>
                {state.products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">نام کالا / دستگاه *</label>
              <input
                type="text"
                required={!warProductId}
                value={warProductName}
                onChange={(e) => setWarProductName(e.target.value)}
                placeholder="مثلاً: دستگاه لیزر یا پکیج سخت‌افزاری"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">شماره سریال *</label>
              <input
                type="text"
                required
                dir="ltr"
                value={warSerial}
                onChange={(e) => setWarSerial(e.target.value)}
                placeholder="SN-1405-9841"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-left font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <JalaliDatePicker label="شروع گارانتی" value={warStartJalali} onChange={setWarStartJalali} />
            <JalaliDatePicker label="پایان گارانتی" value={warEndJalali} onChange={setWarEndJalali} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">شماره سفارش مرتبط (اختیاری)</label>
            <input
              type="text"
              dir="ltr"
              value={warOrderId}
              onChange={(e) => setWarOrderId(e.target.value)}
              placeholder="ORD-1405-0021"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-left font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setWarModalOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-1.5 text-xs dark:border-slate-700"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
            >
              ثبت کارت گارانتی
            </button>
          </div>
        </form>
      </Modal>

      {/* Warranty Claims History & Intake Modal */}
      <Modal
        open={Boolean(liveWarranty)}
        onClose={() => setActiveWarranty(null)}
        title={`سوابق خدمات پس از فروش: ${liveWarranty?.productName ?? ''} (${liveWarranty?.serialNumber ?? ''})`}
        maxWidth="lg"
      >
        {liveWarranty && (
          <div className="space-y-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!claimIssue.trim()) return;
                addWarrantyClaim(liveWarranty.id, {
                  date: new Date().toISOString(),
                  issue: claimIssue.trim(),
                  resolution: claimResolution.trim() || 'در حال بررسی فنی',
                  costCoveredBy: claimCoveredBy,
                  status: 'open',
                });
                setClaimIssue('');
                setClaimResolution('');
              }}
              className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-800/40"
            >
              <div className="text-xs font-semibold">ثبت پذیرش خدمات پس از فروش جدید</div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input
                  type="text"
                  required
                  value={claimIssue}
                  onChange={(e) => setClaimIssue(e.target.value)}
                  placeholder="شرح ایراد یا درخواست سرویس..."
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
                />
                <input
                  type="text"
                  value={claimResolution}
                  onChange={(e) => setClaimResolution(e.target.value)}
                  placeholder="اقدام پیشنهادی / قطعه جایگزین..."
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <select
                  value={claimCoveredBy}
                  onChange={(e) => setClaimCoveredBy(e.target.value as WarrantyClaim['costCoveredBy'])}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
                >
                  <option value="warranty">پوشش کامل گارانتی (رایگان)</option>
                  <option value="customer">خارج از شمول گارانتی (هزینه با مشتری)</option>
                </select>
                <button
                  type="submit"
                  className="rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                >
                  ثبت پذیرش
                </button>
              </div>
            </form>

            <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
              {liveWarranty.claims.length === 0 ? (
                <p className="py-5 text-center text-xs text-slate-400">
                  هنوز پرونده خدماتی برای این سریال ثبت نشده است.
                </p>
              ) : (
                liveWarranty.claims.map((cl) => (
                  <div key={cl.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-xs">
                    <div>
                      <div className="font-semibold">{cl.issue}</div>
                      <div className="text-[11px] text-slate-500">
                        اقدام: {cl.resolution} · پوشش:{' '}
                        {cl.costCoveredBy === 'warranty' ? 'تحت گارانتی' : 'با مشتری'} ·{' '}
                        <span className="tabular-nums">{formatJalali(cl.date)}</span>
                      </div>
                    </div>
                    <select
                      value={cl.status}
                      onChange={(e) =>
                        updateWarrantyClaimStatus(
                          liveWarranty.id,
                          cl.id,
                          e.target.value as WarrantyClaim['status'],
                        )
                      }
                      className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] dark:border-slate-700 dark:bg-slate-800"
                    >
                      <option value="open">ثبت‌شده</option>
                      <option value="in_repair">در حال تعمیر</option>
                      <option value="resolved">تحویل / مختومه</option>
                    </select>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
