import { useState } from 'react';
import { MapPin, Plus, Trash2, Users } from 'lucide-react';
import { useClientFlow } from '../../../store/useClientFlowStore';
import type { Customer, CustomerAddress, CustomerContact } from '../../../types';
import type { CustomerComputedStats } from '../../../utils/crmHelpers';
import { formatCustomFieldValue } from '../../../utils/customFieldValidation';
import { formatToman, toFa } from '../../../utils/jalali';
import { addressSchema, contactSchema, normalizeIranMobile } from '../../../utils/validators';
import { Button, Input } from '../../ui';
import { OverviewRelationsConsent } from './OverviewRelationsConsent';

interface OverviewTabProps {
  customer: Customer;
  stats: CustomerComputedStats;
  onSelectCustomer: (customerId: string) => void;
}

export function OverviewTab({ customer, stats, onSelectCustomer }: OverviewTabProps) {
  const { state, updateCustomer } = useClientFlow();

  const [cName, setCName] = useState('');
  const [cRole, setCRole] = useState('');
  const [cPhone, setCPhone] = useState('');
  const [cError, setCError] = useState('');

  const [aTitle, setATitle] = useState('');
  const [aAddress, setAAddress] = useState('');
  const [aPostal, setAPostal] = useState('');
  const [aError, setAError] = useState('');

  const handleAddContact = (e: React.FormEvent) => {
    e.preventDefault();
    setCError('');
    const parsed = contactSchema.safeParse({ name: cName, role: cRole, phone: cPhone });
    if (!parsed.success) {
      setCError(parsed.error.issues[0]?.message ?? 'اطلاعات مخاطب نامعتبر است');
      return;
    }
    const item: CustomerContact = {
      id: `ct_${Date.now()}`,
      name: parsed.data.name,
      role: parsed.data.role || 'مخاطب',
      phone: normalizeIranMobile(parsed.data.phone),
    };
    updateCustomer(customer.id, { contacts: [...(customer.contacts ?? []), item] });
    setCName('');
    setCRole('');
    setCPhone('');
  };

  const handleAddAddress = (e: React.FormEvent) => {
    e.preventDefault();
    setAError('');
    const parsed = addressSchema.safeParse({ title: aTitle, address: aAddress, postalCode: aPostal });
    if (!parsed.success) {
      setAError(parsed.error.issues[0]?.message ?? 'اطلاعات آدرس نامعتبر است');
      return;
    }
    const item: CustomerAddress = {
      id: `adr_${Date.now()}`,
      title: parsed.data.title,
      address: parsed.data.address,
      postalCode: parsed.data.postalCode || undefined,
    };
    updateCustomer(customer.id, { addresses: [...(customer.addresses ?? []), item] });
    setATitle('');
    setAAddress('');
    setAPostal('');
  };

  const customFieldEntries = Object.entries(customer.customFields ?? {}).filter(([, v]) => v?.trim());

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs text-slate-500">مجموع خرید</div>
          <div className="mt-1 text-base font-bold tabular-nums">{formatToman(stats.totalSpent)}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs text-slate-500">امتیاز خودکار CRM</div>
          <div className="mt-1 text-base font-bold tabular-nums text-indigo-600 dark:text-indigo-400">
            {toFa(stats.score)} / ۱۰۰
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs text-slate-500">نوبت‌های تکمیل‌شده</div>
          <div className="mt-1 text-base font-bold tabular-nums">{toFa(stats.completedAppointments)}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs text-slate-500">میانگین NPS</div>
          <div className="mt-1 text-base font-bold tabular-nums">
            {stats.avgNps !== null ? `${toFa(stats.avgNps.toFixed(1))} / ۱۰` : '—'}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h3 className="mb-3 text-xs font-semibold text-slate-600 dark:text-slate-300">
          اطلاعات تکمیلی و فیلدهای سفارشی
        </h3>
        <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
          <div>
            <span className="text-slate-400">مسئول پیگیری:</span>{' '}
            <span className="font-medium">{customer.ownerName || 'تعیین‌نشده'}</span>
          </div>
          <div>
            <span className="text-slate-400">کد ملی / اقتصادی:</span>{' '}
            <span className="font-medium tabular-nums" dir="ltr">
              {toFa(customer.nationalId || customer.economicCode || '—')}
            </span>
          </div>
          <div>
            <span className="text-slate-400">تاریخ تولد:</span>{' '}
            <span className="font-medium tabular-nums">{toFa(customer.birthDateJalali || '—')}</span>
          </div>
          <div>
            <span className="text-slate-400">سالگرد همکاری:</span>{' '}
            <span className="font-medium tabular-nums">{toFa(customer.anniversaryDateJalali || '—')}</span>
          </div>
          {customFieldEntries.map(([key, val]) => {
            const def = state.customFieldDefs.find((d) => d.key === key);
            return (
              <div key={key}>
                <span className="text-slate-400">{def?.label ?? key}:</span>{' '}
                <span className="font-medium tabular-nums">
                  {def ? formatCustomFieldValue(def, val) : toFa(val)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
            <Users size={15} className="text-indigo-500" />
            مخاطبان مرتبط ({toFa(customer.contacts?.length ?? 0)})
          </div>
          <div className="space-y-2">
            {(customer.contacts ?? []).map((ct) => (
              <div
                key={ct.id}
                className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-xs dark:border-slate-800"
              >
                <div>
                  <span className="font-semibold">{ct.name}</span>
                  <span className="mx-1.5 text-slate-400">·</span>
                  <span className="text-slate-500">{ct.role}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="tabular-nums text-slate-600 dark:text-slate-300" dir="ltr">
                    {toFa(ct.phone)}
                  </span>
                  <button
                    type="button"
                    aria-label="حذف مخاطب"
                    onClick={() =>
                      updateCustomer(customer.id, {
                        contacts: (customer.contacts ?? []).filter((x) => x.id !== ct.id),
                      })
                    }
                    className="text-slate-400 hover:text-rose-600"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <form onSubmit={handleAddContact} className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Input value={cName} onChange={(e) => setCName(e.target.value)} placeholder="نام مخاطب *" />
            <Input value={cRole} onChange={(e) => setCRole(e.target.value)} placeholder="سمت / نسبت" />
            <div className="flex gap-1.5">
              <Input
                dir="ltr"
                value={cPhone}
                onChange={(e) => setCPhone(e.target.value)}
                placeholder="0912..."
                className="text-left tabular-nums"
              />
              <Button type="submit" size="sm" aria-label="افزودن مخاطب">
                <Plus size={14} />
              </Button>
            </div>
          </form>
          {cError && <p className="text-[11px] text-rose-600">{cError}</p>}
        </div>

        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
            <MapPin size={15} className="text-emerald-500" />
            آدرس‌های ثبت‌شده ({toFa(customer.addresses?.length ?? 0)})
          </div>
          <div className="space-y-2">
            {(customer.addresses ?? []).map((adr) => (
              <div
                key={adr.id}
                className="flex items-start justify-between rounded-lg border border-slate-200 px-3 py-2 text-xs dark:border-slate-800"
              >
                <div>
                  <div className="font-semibold">{adr.title}</div>
                  <div className="text-slate-600 dark:text-slate-300">{adr.address}</div>
                  {adr.postalCode && (
                    <div className="mt-0.5 text-[11px] tabular-nums text-slate-400">
                      کد پستی: {toFa(adr.postalCode)}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  aria-label="حذف آدرس"
                  onClick={() =>
                    updateCustomer(customer.id, {
                      addresses: (customer.addresses ?? []).filter((x) => x.id !== adr.id),
                    })
                  }
                  className="text-slate-400 hover:text-rose-600"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
          <form onSubmit={handleAddAddress} className="space-y-2">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Input value={aTitle} onChange={(e) => setATitle(e.target.value)} placeholder="عنوان (دفتر/منزل) *" />
              <Input
                dir="ltr"
                maxLength={10}
                value={aPostal}
                onChange={(e) => setAPostal(e.target.value)}
                placeholder="کد پستی ۱۰ رقمی"
                className="text-left tabular-nums"
              />
            </div>
            <div className="flex gap-1.5">
              <Input value={aAddress} onChange={(e) => setAAddress(e.target.value)} placeholder="نشانی پستی کامل *" />
              <Button type="submit" size="sm" aria-label="افزودن آدرس">
                <Plus size={14} />
              </Button>
            </div>
          </form>
          {aError && <p className="text-[11px] text-rose-600">{aError}</p>}
        </div>
      </div>

      <OverviewRelationsConsent customer={customer} onSelectCustomer={onSelectCustomer} />
    </div>
  );
}
