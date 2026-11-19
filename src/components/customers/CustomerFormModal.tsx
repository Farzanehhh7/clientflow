import { useEffect, useState } from 'react';
import { useClientFlow } from '../../store/useClientFlowStore';
import type {
  Customer,
  CustomerLifecycle,
  CustomerPersonType,
} from '../../types';
import { getFieldsForEntity, validateCustomFieldValues } from '../../utils/customFieldValidation';
import { customerFormSchema, normalizeDigits, normalizeIranMobile } from '../../utils/validators';
import { DynamicFieldsRenderer } from '../DynamicFieldsRenderer';
import { Button, Input, JalaliDatePicker, Modal, Select } from '../ui';

interface CustomerFormModalProps {
  open: boolean;
  editing: Customer | null;
  singularLabel: string;
  ownersList: string[];
  onClose: () => void;
}

const SOURCE_OPTIONS = ['اینستاگرام', 'سایت', 'معرفی', 'حضوری', 'تبلیغات', 'تماس مستقیم'];

export function CustomerFormModal({
  open,
  editing,
  singularLabel,
  ownersList,
  onClose,
}: CustomerFormModalProps) {
  const { state, addCustomer, updateCustomer } = useClientFlow();

  const [personType, setPersonType] = useState<CustomerPersonType>('individual');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [economicCode, setEconomicCode] = useState('');
  const [registrationNo, setRegistrationNo] = useState('');
  const [birthDateJalali, setBirthDateJalali] = useState('');
  const [anniversaryDateJalali, setAnniversaryDateJalali] = useState('');
  const [lifecycle, setLifecycle] = useState<CustomerLifecycle>('active');
  const [ownerName, setOwnerName] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [source, setSource] = useState('اینستاگرام');
  const [notes, setNotes] = useState('');
  const [consentSms, setConsentSms] = useState(true);
  const [consentEmail, setConsentEmail] = useState(true);
  const [consentPhoto, setConsentPhoto] = useState(false);
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [customErrors, setCustomErrors] = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');

  const activeCustomerFields = getFieldsForEntity(state.customFieldDefs, 'customer', false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setPersonType(editing.personType ?? 'individual');
      setName(editing.name);
      setPhone(editing.phone);
      setEmail(editing.email ?? '');
      setNationalId(editing.nationalId ?? '');
      setCompanyName(editing.companyName ?? '');
      setEconomicCode(editing.economicCode ?? '');
      setRegistrationNo(editing.registrationNo ?? '');
      setBirthDateJalali(editing.birthDateJalali ?? '');
      setAnniversaryDateJalali(editing.anniversaryDateJalali ?? '');
      setLifecycle(editing.lifecycle ?? 'active');
      setOwnerName(editing.ownerName ?? ownersList[0] ?? '');
      setTagsText(editing.tags.join('، '));
      setSource(editing.source ?? 'اینستاگرام');
      setNotes(editing.notes ?? '');
      setConsentSms(editing.consentSms !== false);
      setConsentEmail(editing.consentEmail !== false);
      setConsentPhoto(Boolean(editing.consentPhoto));
      setCustomValues(editing.customFields ?? {});
    } else {
      setPersonType('individual');
      setName('');
      setPhone('');
      setEmail('');
      setNationalId('');
      setCompanyName('');
      setEconomicCode('');
      setRegistrationNo('');
      setBirthDateJalali('');
      setAnniversaryDateJalali('');
      setLifecycle('active');
      setOwnerName(ownersList[0] ?? '');
      setTagsText('');
      setSource('اینستاگرام');
      setNotes('');
      setConsentSms(true);
      setConsentEmail(true);
      setConsentPhoto(false);
      setCustomValues({});
    }
    setCustomErrors({});
    setFieldErrors({});
    setSubmitError('');
  }, [open, editing, ownersList]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    setCustomErrors({});
    setSubmitError('');

    const parsed = customerFormSchema.safeParse({
      personType,
      name,
      phone,
      email: email || undefined,
      nationalId: personType === 'individual' ? nationalId || undefined : undefined,
      companyName: personType === 'organization' ? companyName || name : undefined,
    });

    const cfValidation = validateCustomFieldValues(state.customFieldDefs, customValues, {
      entity: 'customer',
      existingRecords: state.customers.filter((c) => !c.isDeleted),
      currentRecordId: editing?.id,
    });

    if (!parsed.success || !cfValidation.ok) {
      const nextErr: Record<string, string> = {};
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          const key = String(issue.path[0] ?? 'form');
          if (!nextErr[key]) nextErr[key] = issue.message;
        }
      }
      setFieldErrors(nextErr);
      setCustomErrors(cfValidation.errors);
      return;
    }

    const parsedTags = tagsText
      .split(/[,،|]/)
      .map((t) => t.trim())
      .filter(Boolean);

    const payload: Omit<Customer, 'id' | 'createdAt'> = {
      personType,
      name: parsed.data.name,
      phone: normalizeIranMobile(parsed.data.phone),
      email: parsed.data.email || undefined,
      nationalId: personType === 'individual' ? normalizeDigits(nationalId).trim() || undefined : undefined,
      companyName: personType === 'organization' ? companyName.trim() || parsed.data.name : undefined,
      economicCode: personType === 'organization' ? normalizeDigits(economicCode).trim() || undefined : undefined,
      registrationNo: personType === 'organization' ? normalizeDigits(registrationNo).trim() || undefined : undefined,
      birthDateJalali: normalizeDigits(birthDateJalali).trim() || undefined,
      anniversaryDateJalali: normalizeDigits(anniversaryDateJalali).trim() || undefined,
      lifecycle,
      ownerName: ownerName || undefined,
      tags: parsedTags,
      source,
      notes: notes.trim() || undefined,
      consentSms,
      consentEmail,
      consentPhoto,
      customFields: customValues,
    };

    const res = editing ? updateCustomer(editing.id, payload) : addCustomer(payload);
    if (!res.ok) {
      setSubmitError(res.error ?? 'خطا در ذخیره‌سازی اطلاعات');
      return;
    }
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? `ویرایش ${singularLabel}: ${editing.name}` : `ثبت ${singularLabel} جدید`}
      maxWidth="lg"
    >
      <form onSubmit={handleSave} className="space-y-4">
        {submitError && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
            {submitError}
          </div>
        )}

        <div className="flex w-fit items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
          <button
            type="button"
            onClick={() => setPersonType('individual')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${
              personType === 'individual'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100'
                : 'text-slate-500'
            }`}
          >
            شخص حقیقی
          </button>
          <button
            type="button"
            onClick={() => setPersonType('organization')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${
              personType === 'organization'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100'
                : 'text-slate-500'
            }`}
          >
            شخص حقوقی / شرکت
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label={personType === 'organization' ? 'نام رابط اصلی / عنوان *' : 'نام و نام خانوادگی *'}
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={fieldErrors.name}
          />
          <Input
            label="شماره موبایل (۰۹xxxxxxxxx) *"
            type="tel"
            dir="ltr"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="09120000000"
            className="text-left tabular-nums"
            error={fieldErrors.phone}
          />

          {personType === 'organization' ? (
            <>
              <div className="sm:col-span-2">
                <Input
                  label="نام رسمی شرکت / سازمان *"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="مثلاً: شرکت فناوری اطلاعات پارس"
                  error={fieldErrors.companyName}
                />
              </div>
              <Input
                label="کد اقتصادی / شناسه ملی"
                dir="ltr"
                value={economicCode}
                onChange={(e) => setEconomicCode(e.target.value)}
                className="text-left tabular-nums"
              />
              <Input
                label="شماره ثبت"
                dir="ltr"
                value={registrationNo}
                onChange={(e) => setRegistrationNo(e.target.value)}
                className="text-left tabular-nums"
              />
            </>
          ) : (
            <Input
              label="کد ملی (۱۰ رقم، اختیاری)"
              dir="ltr"
              maxLength={10}
              value={nationalId}
              onChange={(e) => setNationalId(e.target.value)}
              placeholder="0014501001"
              className="text-left tabular-nums"
              error={fieldErrors.nationalId}
            />
          )}

          <Select
            label="وضعیت چرخه عمر"
            value={lifecycle}
            onChange={(e) => setLifecycle(e.target.value as CustomerLifecycle)}
            options={[
              { value: 'lead', label: 'سرنخ' },
              { value: 'active', label: 'فعال' },
              { value: 'vip', label: 'VIP' },
              { value: 'churned', label: 'ریزش‌کرده' },
            ]}
          />

          <Input
            label="ایمیل"
            type="email"
            dir="ltr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="text-left"
            error={fieldErrors.email}
          />

          <Select
            label="مسئول پیگیری"
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
            options={[
              { value: '', label: '-- تعیین نشده --' },
              ...ownersList.map((o) => ({ value: o, label: o })),
            ]}
          />

          <Select
            label="منبع آشنایی"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            options={SOURCE_OPTIONS.map((s) => ({ value: s, label: s }))}
          />

          <JalaliDatePicker
            label="تاریخ تولد (شمسی)"
            value={birthDateJalali}
            onChange={setBirthDateJalali}
            placeholder="1370/08/28"
            minYear={1310}
            maxYear={1405}
          />
          <JalaliDatePicker
            label="سالگرد همکاری (شمسی)"
            value={anniversaryDateJalali}
            onChange={setAnniversaryDateJalali}
            placeholder="1403/08/29"
            minYear={1390}
            maxYear={1410}
          />
        </div>

        <Input
          label="برچسب‌ها (با ویرگول جدا کنید، مثلاً: VIP، پیگیری)"
          value={tagsText}
          onChange={(e) => setTagsText(e.target.value)}
          placeholder="VIP، وفادار"
        />

        <div className="flex flex-wrap gap-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs dark:border-slate-700 dark:bg-slate-800/50">
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={consentSms} onChange={(e) => setConsentSms(e.target.checked)} />
            <span>رضایت دریافت پیامک (SMS)</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={consentEmail} onChange={(e) => setConsentEmail(e.target.checked)} />
            <span>رضایت دریافت ایمیل</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={consentPhoto} onChange={(e) => setConsentPhoto(e.target.checked)} />
            <span>رضایت مستندسازی تصویر/پرونده</span>
          </label>
        </div>

        {activeCustomerFields.length > 0 && (
          <div className="border-t border-slate-200 pt-3 dark:border-slate-800">
            <p className="mb-2 text-xs font-semibold text-slate-500">فیلدهای سفارشی کسب‌وکار</p>
            <DynamicFieldsRenderer
              entity="customer"
              defs={state.customFieldDefs}
              values={customValues}
              onChange={setCustomValues}
              errors={customErrors}
            />
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">یادداشت</label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
          />
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
          <Button variant="secondary" size="md" onClick={onClose}>
            انصراف
          </Button>
          <Button type="submit" size="md">
            {editing ? 'ذخیره تغییرات' : `ثبت ${singularLabel}`}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
