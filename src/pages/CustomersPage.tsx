import { useMemo, useState } from 'react';
import {
  Building2,
  Cake,
  Download,
  Eye,
  Filter,
  GitMerge,
  Pencil,
  Plus,
  Search,
  Send,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { CsvImportModal } from '../components/CsvImportModal';
import { CustomerDetailModal } from '../components/CustomerDetailModal';
import { DynamicFieldsRenderer } from '../components/DynamicFieldsRenderer';
import { Modal } from '../components/Modal';
import { useClientFlow } from '../store/useClientFlowStore';
import type {
  Customer,
  CustomerLifecycle,
  CustomerPersonType,
  SegmentCondition,
} from '../types';
import { computeCustomerStats, daysUntilJalaliMonthDay, evaluateSegment } from '../utils/crmHelpers';
import { exportCustomersToCsv, normalizeMobileInput } from '../utils/csv';
import { formatJalali, toFa } from '../utils/jalali';
import { fuzzyMatchPersian } from '../utils/persianSearch';

const LIFECYCLE_LABELS: Record<CustomerLifecycle, string> = {
  lead: 'سرنخ',
  active: 'فعال',
  vip: 'VIP',
  churned: 'ریزش‌کرده',
};

const FIELD_LABELS: Record<SegmentCondition['field'], string> = {
  lifecycle: 'چرخه عمر',
  source: 'منبع آشنایی',
  personType: 'نوع شخصیت',
  tag: 'برچسب',
  minSpent: 'حداقل جمع خرید (تومان)',
  minScore: 'حداقل امتیاز مشتری (۰-۱۰۰)',
  consentSms: 'رضایت پیامک',
};

export function CustomersPage() {
  const {
    state,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    mergeCustomers,
    addCustomerSegment,
    deleteCustomerSegment,
    sendBirthdayGreeting,
  } = useClientFlow();

  const [subView, setSubView] = useState<'list' | 'segments' | 'occasions'>('list');
  const [query, setQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState('همه');
  const [lifecycleFilter, setLifecycleFilter] = useState<'all' | CustomerLifecycle>('all');
  const [activeSegmentId, setActiveSegmentId] = useState<string>('all');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [detailCustomer, setDetailCustomer] = useState<Customer | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [dedupOpen, setDedupOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);

  // Dynamic Segment Modal
  const [segOpen, setSegOpen] = useState(false);
  const [segName, setSegName] = useState('');
  const [segDesc, setSegDesc] = useState('');
  const [segLogic, setSegLogic] = useState<'AND' | 'OR'>('AND');
  const [segConds, setSegConds] = useState<SegmentCondition[]>([
    { id: 'c1', field: 'minScore', op: 'gte', value: '60' },
  ]);

  // Merge state
  const [primaryId, setPrimaryId] = useState(state.customers[0]?.id ?? '');
  const [duplicateId, setDuplicateId] = useState(state.customers[1]?.id ?? '');

  // Form fields
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
  const [tagsText, setTagsText] = useState('');
  const [source, setSource] = useState('اینستاگرام');
  const [notes, setNotes] = useState('');
  const [patientCode, setPatientCode] = useState('');
  const [allergies, setAllergies] = useState('');
  const [consentSms, setConsentSms] = useState(true);
  const [consentPhoto, setConsentPhoto] = useState(false);
  const [licenseKey, setLicenseKey] = useState('');
  const [contractExpiresDate, setContractExpiresDate] = useState('');
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');

  const isAdmin = state.settings.role === 'admin';
  const isClinic = state.settings.industryPack === 'clinic';
  const isSoftware = state.settings.industryPack === 'software';

  const statsMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof computeCustomerStats>>();
    for (const c of state.customers) {
      map.set(c.id, computeCustomerStats(c, state));
    }
    return map;
  }, [state]);

  const dynamicTags = useMemo(() => {
    const set = new Set<string>();
    state.customers.forEach((c) => c.tags.forEach((t) => set.add(t)));
    return ['همه', ...Array.from(set)];
  }, [state.customers]);

  const duplicatePairs = useMemo(() => {
    const byPhone = new Map<string, Customer[]>();
    const byName = new Map<string, Customer[]>();
    for (const c of state.customers) {
      const pList = byPhone.get(c.phone) ?? [];
      pList.push(c);
      byPhone.set(c.phone, pList);

      const cleanName = c.name.trim();
      const nList = byName.get(cleanName) ?? [];
      nList.push(c);
      byName.set(cleanName, nList);
    }
    const pairs: { reason: string; a: Customer; b: Customer }[] = [];
    for (const [, list] of byPhone) {
      if (list.length > 1) pairs.push({ reason: 'شماره موبایل یکسان', a: list[0], b: list[1] });
    }
    for (const [, list] of byName) {
      if (list.length > 1) pairs.push({ reason: 'نام مشابه/یکسان', a: list[0], b: list[1] });
    }
    return pairs;
  }, [state.customers]);

  const activeSegment = state.customerSegments.find((s) => s.id === activeSegmentId);

  const filtered = useMemo(() => {
    return state.customers.filter((c) => {
      const matchesTag = selectedTag === 'همه' || c.tags.includes(selectedTag);
      const matchesLifecycle = lifecycleFilter === 'all' || (c.lifecycle ?? 'active') === lifecycleFilter;
      if (!matchesTag || !matchesLifecycle) return false;

      if (activeSegment) {
        const st = statsMap.get(c.id);
        if (st && !evaluateSegment(c, activeSegment, st)) return false;
      }

      if (!query.trim()) return true;
      return fuzzyMatchPersian(
        [
          c.name,
          c.companyName,
          c.phone,
          c.email,
          c.nationalId,
          c.patientCode,
          c.licenseKey,
          c.economicCode,
          ...(c.contacts ?? []).map((ct) => `${ct.name} ${ct.phone}`),
        ],
        query,
      );
    });
  }, [state.customers, query, selectedTag, lifecycleFilter, activeSegment, statsMap]);

  const occasionsList = useMemo(() => {
    const list: {
      customer: Customer;
      kind: 'birthday' | 'anniversary';
      jalaliDate: string;
      daysLeft: number;
    }[] = [];

    for (const c of state.customers) {
      if (c.birthDateJalali) {
        const d = daysUntilJalaliMonthDay(c.birthDateJalali);
        if (d !== null) {
          list.push({ customer: c, kind: 'birthday', jalaliDate: c.birthDateJalali, daysLeft: d });
        }
      }
      if (c.anniversaryDateJalali) {
        const d = daysUntilJalaliMonthDay(c.anniversaryDateJalali);
        if (d !== null) {
          list.push({
            customer: c,
            kind: 'anniversary',
            jalaliDate: c.anniversaryDateJalali,
            daysLeft: d,
          });
        }
      }
    }
    return list.sort((a, b) => a.daysLeft - b.daysLeft);
  }, [state.customers]);

  const draftSegmentPreviewCount = useMemo(() => {
    const mockSeg = {
      id: 'preview',
      name: segName,
      logic: segLogic,
      conditions: segConds,
      createdAt: '',
    };
    return state.customers.filter((c) => {
      const st = statsMap.get(c.id);
      return st ? evaluateSegment(c, mockSeg, st) : false;
    }).length;
  }, [state.customers, statsMap, segName, segLogic, segConds]);

  const openCreateModal = () => {
    setEditing(null);
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
    setTagsText('');
    setSource('اینستاگرام');
    setNotes('');
    setPatientCode(`CF-${140500 + state.customers.length + 1}`);
    setAllergies('');
    setConsentSms(true);
    setConsentPhoto(false);
    setLicenseKey(`LIC-CF-${new Date().getFullYear()}-${100 + state.customers.length + 1}`);
    setContractExpiresDate('');
    setCustomValues({});
    setFormError('');
    setFormOpen(true);
  };

  const openEditModal = (c: Customer) => {
    setEditing(c);
    setPersonType(c.personType ?? 'individual');
    setName(c.name);
    setPhone(c.phone);
    setEmail(c.email ?? '');
    setNationalId(c.nationalId ?? '');
    setCompanyName(c.companyName ?? '');
    setEconomicCode(c.economicCode ?? '');
    setRegistrationNo(c.registrationNo ?? '');
    setBirthDateJalali(c.birthDateJalali ?? '');
    setAnniversaryDateJalali(c.anniversaryDateJalali ?? '');
    setLifecycle(c.lifecycle ?? 'active');
    setTagsText(c.tags.join('، '));
    setSource(c.source ?? 'اینستاگرام');
    setNotes(c.notes ?? '');
    setPatientCode(c.patientCode ?? '');
    setAllergies(c.allergies ?? '');
    setConsentSms(c.consentSms !== false);
    setConsentPhoto(Boolean(c.consentPhoto));
    setLicenseKey(c.licenseKey ?? '');
    setContractExpiresDate(c.contractExpiresAt ? c.contractExpiresAt.slice(0, 10) : '');
    setCustomValues(c.customFields ?? {});
    setFormError('');
    setFormOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedPhone = normalizeMobileInput(phone);
    const cleanNationalId = nationalId
      .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
      .trim();
    const parsedTags = tagsText
      .split(/[,،|]/)
      .map((t) => t.trim())
      .filter(Boolean);

    const payload = {
      personType,
      name: name.trim(),
      phone: normalizedPhone,
      email: email.trim() || undefined,
      nationalId: personType === 'individual' ? cleanNationalId || undefined : undefined,
      companyName: personType === 'organization' ? companyName.trim() || name.trim() : undefined,
      economicCode: personType === 'organization' ? economicCode.trim() || undefined : undefined,
      registrationNo: personType === 'organization' ? registrationNo.trim() || undefined : undefined,
      birthDateJalali: birthDateJalali.trim() || undefined,
      anniversaryDateJalali: anniversaryDateJalali.trim() || undefined,
      lifecycle,
      tags: parsedTags,
      source,
      notes: notes.trim() || undefined,
      patientCode: patientCode.trim() || undefined,
      allergies: allergies.trim() || undefined,
      consentSms,
      consentPhoto,
      licenseKey: licenseKey.trim() || undefined,
      contractExpiresAt: contractExpiresDate
        ? new Date(`${contractExpiresDate}T12:00:00`).toISOString()
        : undefined,
      customFields: customValues,
    };

    const res = editing ? updateCustomer(editing.id, payload) : addCustomer(payload);
    if (!res.ok) {
      setFormError(res.error ?? 'خطا در ثبت اطلاعات');
      return;
    }
    setFormOpen(false);
  };

  const handleExportCsv = () => {
    const csvContent = exportCustomersToCsv(filtered);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clientflow-customers-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCreateSegment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!segName.trim()) return;
    addCustomerSegment({
      name: segName.trim(),
      description: segDesc.trim() || undefined,
      logic: segLogic,
      conditions: segConds,
    });
    setSegName('');
    setSegDesc('');
    setSegOpen(false);
  };

  return (
    <div className="space-y-4">
      {/* Sub-navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => setSubView('list')}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              subView === 'list'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            فهرست مشتریان ({toFa(state.customers.length)})
          </button>
          <button
            type="button"
            onClick={() => setSubView('segments')}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              subView === 'segments'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            سگمنت‌های پویا ({toFa(state.customerSegments.length)})
          </button>
          <button
            type="button"
            onClick={() => setSubView('occasions')}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              subView === 'occasions'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            تقویم تولد و سالگردها ({toFa(occasionsList.length)})
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <button
              type="button"
              onClick={() => setDedupOpen(true)}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <GitMerge size={15} />
              ادغام تکراری‌ها ({toFa(duplicatePairs.length)})
            </button>
          )}
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Upload size={15} />
            ورود / بازگشت CSV
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Download size={15} />
            خروجی CSV
          </button>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700"
          >
            <Plus size={16} />
            مشتری جدید
          </button>
        </div>
      </div>

      {subView === 'list' && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative min-w-[260px] flex-1 max-w-md">
              <Search size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="جستجوی فازی نام، شرکت، موبایل (مقاوم به نیم‌فاصله و غلط املایی)..."
                className="w-full rounded-lg border border-slate-200 bg-white py-2 pr-9 pl-3 text-sm focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="فیلتر سگمنت پویا"
                value={activeSegmentId}
                onChange={(e) => setActiveSegmentId(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium dark:border-slate-800 dark:bg-slate-900"
              >
                <option value="all">همه سگمنت‌ها</option>
                {state.customerSegments.map((seg) => (
                  <option key={seg.id} value={seg.id}>
                    سگمنت: {seg.name}
                  </option>
                ))}
              </select>

              <select
                aria-label="فیلتر چرخه عمر مشتری"
                value={lifecycleFilter}
                onChange={(e) => setLifecycleFilter(e.target.value as 'all' | CustomerLifecycle)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium dark:border-slate-800 dark:bg-slate-900"
              >
                <option value="all">همه چرخه‌های عمر</option>
                <option value="lead">سرنخ</option>
                <option value="active">فعال</option>
                <option value="vip">VIP</option>
                <option value="churned">ریزش‌کرده</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1 w-fit dark:bg-slate-900">
            {dynamicTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setSelectedTag(tag)}
                className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  selectedTag === tag
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            {filtered.length === 0 ? (
              <div className="p-10 text-center">
                <p className="text-sm text-slate-500 dark:text-slate-400">مشتری مطابق با جستجو یا فیلتر یافت نشد.</p>
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700"
                >
                  ثبت مشتری جدید
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50/70 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-3 font-medium">نام / شخصیت</th>
                      <th className="px-4 py-3 font-medium">موبایل</th>
                      <th className="px-4 py-3 font-medium">امتیاز</th>
                      <th className="px-4 py-3 font-medium">برچسب‌ها و منبع</th>
                      {isClinic && <th className="px-4 py-3 font-medium">کد پرونده</th>}
                      {isSoftware && <th className="px-4 py-3 font-medium">لایسنس و اعتبار</th>}
                      <th className="px-4 py-3 font-medium">تاریخ ثبت</th>
                      <th className="px-4 py-3 font-medium text-left">عملیات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {filtered.map((c) => {
                      const st = statsMap.get(c.id);
                      const score = st?.score ?? 0;
                      return (
                        <tr key={c.id} className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                          <td className="px-4 py-2.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setDetailCustomer(c)}
                                className="font-medium text-slate-900 hover:text-indigo-600 dark:text-slate-100 dark:hover:text-indigo-400"
                              >
                                {c.name}
                              </button>
                              {c.personType === 'organization' && (
                                <span className="inline-flex items-center gap-0.5 rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">
                                  <Building2 size={10} />
                                  حقوقی
                                </span>
                              )}
                              {c.isAnonymized && (
                                <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                                  ناشناس
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              {LIFECYCLE_LABELS[c.lifecycle ?? 'active']}
                              {c.companyName && ` · ${c.companyName}`}
                              {(c.contacts?.length ?? 0) > 0 && ` · ${toFa(c.contacts?.length ?? 0)} مخاطب`}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 tabular-nums text-slate-700 dark:text-slate-300" dir="ltr">
                            <span className="block text-right">{toFa(c.phone)}</span>
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-1.5 text-xs font-semibold tabular-nums">
                              <span
                                className={
                                  score >= 70
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : score >= 40
                                      ? 'text-indigo-600 dark:text-indigo-400'
                                      : 'text-slate-500'
                                }
                              >
                                {toFa(score)}
                              </span>
                              <span className="text-[10px] font-normal text-slate-400">/ ۱۰۰</span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-slate-500 dark:text-slate-400">
                            {[c.tags.join('، '), c.source].filter(Boolean).join(' · ') || '—'}
                          </td>
                          {isClinic && (
                            <td className="px-4 py-2.5 text-xs tabular-nums text-slate-600 dark:text-slate-300">
                              {c.patientCode || '—'}
                            </td>
                          )}
                          {isSoftware && (
                            <td className="px-4 py-2.5 text-xs tabular-nums text-slate-600 dark:text-slate-300">
                              <div>{c.licenseKey || '—'}</div>
                              {c.contractExpiresAt && (
                                <div className="text-[11px] text-slate-400">
                                  تا {formatJalali(c.contractExpiresAt)}
                                </div>
                              )}
                            </td>
                          )}
                          <td className="px-4 py-2.5 text-xs tabular-nums text-slate-500 dark:text-slate-400">
                            {formatJalali(c.createdAt)}
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => setDetailCustomer(c)}
                                title="مشاهده پرونده و تایم‌لاین"
                                className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-indigo-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-indigo-400"
                              >
                                <Eye size={16} />
                              </button>
                              <button
                                type="button"
                                onClick={() => openEditModal(c)}
                                title="ویرایش"
                                className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                              >
                                <Pencil size={16} />
                              </button>
                              {isAdmin && (
                                <button
                                  type="button"
                                  onClick={() => setDeleteTarget(c)}
                                  title="حذف"
                                  className="rounded-md p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600 dark:text-slate-400 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Dynamic Segments View */}
      {subView === 'segments' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div>
              <h2 className="text-sm font-semibold">سگمنت‌بندی پویا و شرطی مشتریان</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                سگمنت‌ها به‌صورت زنده براساس امتیاز، مجموع خرید، نوع شخصیت و برچسب‌ها ارزیابی می‌شوند.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSegOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-indigo-700"
            >
              <Filter size={14} />
              ساخت سگمنت جدید
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {state.customerSegments.map((seg) => {
              const matched = state.customers.filter((c) => {
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
                        <div className="text-sm font-semibold">{seg.name}</div>
                        {seg.description && (
                          <div className="mt-0.5 text-xs text-slate-500">{seg.description}</div>
                        )}
                      </div>
                      <span className="rounded bg-indigo-50 px-2 py-0.5 text-xs font-bold tabular-nums text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                        {toFa(matched.length)} مشتری
                      </span>
                    </div>

                    <div className="mt-3 space-y-1 rounded-lg bg-slate-50 p-2.5 text-[11px] text-slate-600 dark:bg-slate-800/50 dark:text-slate-300">
                      <div className="font-semibold text-slate-500">
                        منطق ترکیب: {seg.logic === 'AND' ? 'همه شرط‌ها (AND)' : 'حداقل یکی از شرط‌ها (OR)'}
                      </div>
                      {seg.conditions.map((cond) => (
                        <div key={cond.id}>
                          • {FIELD_LABELS[cond.field]} ({cond.op}) <span className="font-semibold">{cond.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveSegmentId(seg.id);
                        setSubView('list');
                      }}
                      className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                      مشاهده اعضا در فهرست
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteCustomerSegment(seg.id)}
                      className="p-1 text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Birthdays & Anniversaries View */}
      {subView === 'occasions' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Cake size={17} className="text-rose-500" />
              تقویم تولد و سالگرد همراهی مشتریان (شمسی)
            </div>
            <p className="mt-1 text-xs text-slate-500">
              قانون اتوماسیون تبریک خودکار نیز هر روز مناسبت‌های امروز را بررسی و پیامک تبریک ارسال می‌کند.
            </p>
          </div>

          <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
            {occasionsList.length === 0 ? (
              <p className="p-8 text-center text-xs text-slate-500">
                هنوز تاریخ تولد یا سالگرد شمسی برای مشتریان ثبت نشده است.
              </p>
            ) : (
              occasionsList.map((item, idx) => (
                <div
                  key={`${item.customer.id}_${item.kind}_${idx}`}
                  className="flex flex-wrap items-center justify-between gap-3 p-4"
                >
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <span>{item.customer.name}</span>
                      <span
                        className={`rounded px-2 py-0.5 text-[11px] font-medium ${
                          item.kind === 'birthday'
                            ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                            : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300'
                        }`}
                      >
                        {item.kind === 'birthday' ? 'تولد' : 'سالگرد همکاری'}
                      </span>
                      {item.daysLeft === 0 && (
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                          <Sparkles size={11} />
                          امروز!
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-xs tabular-nums text-slate-500">
                      تاریخ شمسی: {toFa(item.jalaliDate)} ·{' '}
                      {item.daysLeft === 0 ? 'مناسبت امروز است' : `${toFa(item.daysLeft)} روز مانده`}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => sendBirthdayGreeting(item.customer.id, item.kind)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-300"
                  >
                    <Send size={13} />
                    ارسال پیامک تبریک
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Add / Edit Customer Modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? `ویرایش مشتری: ${editing.name}` : 'ثبت مشتری جدید'}
        maxWidth="lg"
      >
        <form onSubmit={handleSave} className="space-y-4">
          {formError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
              {formError}
            </div>
          )}

          {/* Individual / Organization Toggle */}
          <div className="flex items-center gap-2 rounded-lg bg-slate-100 p-1 w-fit dark:bg-slate-800">
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
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                {personType === 'organization' ? 'نام رابط اصلی / عنوان *' : 'نام و نام خانوادگی *'}
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                شماره موبایل (۰۹xxxxxxxxx) *
              </label>
              <input
                type="tel"
                required
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="09120000000"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm tabular-nums dark:border-slate-700 dark:bg-slate-800"
              />
            </div>

            {personType === 'organization' ? (
              <>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                    نام رسمی شرکت / سازمان *
                  </label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="مثلاً: شرکت فناوری اطلاعات پارس"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">کد اقتصادی / شناسه ملی</label>
                  <input
                    type="text"
                    dir="ltr"
                    value={economicCode}
                    onChange={(e) => setEconomicCode(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm tabular-nums dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">شماره ثبت</label>
                  <input
                    type="text"
                    dir="ltr"
                    value={registrationNo}
                    onChange={(e) => setRegistrationNo(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm tabular-nums dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
              </>
            ) : (
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">کد ملی (۱۰ رقم، اختیاری)</label>
                <input
                  type="text"
                  dir="ltr"
                  maxLength={10}
                  value={nationalId}
                  onChange={(e) => setNationalId(e.target.value)}
                  placeholder="0014501000"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm tabular-nums dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">وضعیت چرخه عمر</label>
              <select
                value={lifecycle}
                onChange={(e) => setLifecycle(e.target.value as CustomerLifecycle)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="lead">سرنخ</option>
                <option value="active">فعال</option>
                <option value="vip">VIP</option>
                <option value="churned">ریزش‌کرده</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">ایمیل</label>
              <input
                type="email"
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">منبع آشنایی</label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="اینستاگرام">اینستاگرام</option>
                <option value="سایت">سایت</option>
                <option value="معرفی">معرفی</option>
                <option value="حضوری">حضوری</option>
                <option value="تبلیغات">تبلیغات</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">تاریخ تولد (شمسی)</label>
              <input
                type="text"
                dir="ltr"
                value={birthDateJalali}
                onChange={(e) => setBirthDateJalali(e.target.value)}
                placeholder="1370/08/28"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm tabular-nums dark:border-slate-700 dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">سالگرد همکاری (شمسی)</label>
              <input
                type="text"
                dir="ltr"
                value={anniversaryDateJalali}
                onChange={(e) => setAnniversaryDateJalali(e.target.value)}
                placeholder="1403/08/29"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm tabular-nums dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
              برچسب‌ها (با ویرگول جدا کنید، مثلاً: VIP، پیگیری)
            </label>
            <input
              type="text"
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </div>

          {state.customFieldDefs.length > 0 && (
            <div className="space-y-3 border-t border-slate-200 pt-3 dark:border-slate-800">
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                فیلدهای سفارشی پویا (شامل نمایش شرطی و فرمول)
              </div>
              <DynamicFieldsRenderer
                defs={state.customFieldDefs}
                values={customValues}
                onChange={setCustomValues}
              />
            </div>
          )}

          {isClinic && (
            <div className="space-y-3 border-t border-slate-200 pt-3 dark:border-slate-800">
              <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                فیلدهای پرونده کلینیک
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">کد پرونده</label>
                  <input
                    type="text"
                    value={patientCode}
                    onChange={(e) => setPatientCode(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm tabular-nums dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">حساسیت / سوابق مهم</label>
                  <input
                    type="text"
                    value={allergies}
                    onChange={(e) => setAllergies(e.target.value)}
                    placeholder="مثلاً: حساسیت به لیدوکائین"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-5 pt-1 text-xs">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={consentSms}
                    onChange={(e) => setConsentSms(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                  />
                  رضایت دریافت پیامک یادآوری و اطلاع‌رسانی
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={consentPhoto}
                    onChange={(e) => setConsentPhoto(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                  />
                  رضایت‌نامه ثبت تصاویر قبل و بعد
                </label>
              </div>
            </div>
          )}

          {isSoftware && (
            <div className="space-y-3 border-t border-slate-200 pt-3 dark:border-slate-800">
              <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                فیلدهای قرارداد و لایسنس (بسته نرم‌افزاری)
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">کلید لایسنس</label>
                  <input
                    type="text"
                    dir="ltr"
                    value={licenseKey}
                    onChange={(e) => setLicenseKey(e.target.value)}
                    placeholder="LIC-CF-2026-101"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm font-mono dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">تاریخ انقضای قرارداد پشتیبانی</label>
                  <input
                    type="date"
                    dir="ltr"
                    value={contractExpiresDate}
                    onChange={(e) => setContractExpiresDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm tabular-nums dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
              </div>
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

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              {editing ? 'ذخیره تغییرات' : 'ثبت مشتری'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Dynamic Segment Builder Modal */}
      <Modal open={segOpen} onClose={() => setSegOpen(false)} title="ساخت سگمنت پویا جدید" maxWidth="lg">
        <form onSubmit={handleCreateSegment} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-slate-500">عنوان سگمنت *</label>
              <input
                type="text"
                required
                value={segName}
                onChange={(e) => setSegName(e.target.value)}
                placeholder="مثلاً: خریداران وفادار با امتیاز بالا"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">منطق ترکیب شروط</label>
              <select
                value={segLogic}
                onChange={(e) => setSegLogic(e.target.value as 'AND' | 'OR')}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="AND">برقراری همه شروط (AND)</option>
                <option value="OR">برقراری حداقل یکی از شروط (OR)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs text-slate-500">توضیح سگمنت (اختیاری)</label>
            <input
              type="text"
              value={segDesc}
              onChange={(e) => setSegDesc(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold">شروط سگمنت</span>
              <button
                type="button"
                onClick={() =>
                  setSegConds((prev) => [
                    ...prev,
                    { id: `sc_${Date.now()}`, field: 'lifecycle', op: 'eq', value: 'vip' },
                  ])
                }
                className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
              >
                + افزودن شرط
              </button>
            </div>

            {segConds.map((cond, idx) => (
              <div key={cond.id} className="flex flex-wrap items-center gap-2">
                <select
                  value={cond.field}
                  onChange={(e) => {
                    const nextField = e.target.value as SegmentCondition['field'];
                    setSegConds((prev) =>
                      prev.map((c, i) =>
                        i === idx
                          ? {
                              ...c,
                              field: nextField,
                              op: nextField === 'minSpent' || nextField === 'minScore' ? 'gte' : 'eq',
                            }
                          : c,
                      ),
                    );
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                >
                  {(Object.keys(FIELD_LABELS) as SegmentCondition['field'][]).map((f) => (
                    <option key={f} value={f}>
                      {FIELD_LABELS[f]}
                    </option>
                  ))}
                </select>
                <select
                  value={cond.op}
                  onChange={(e) =>
                    setSegConds((prev) =>
                      prev.map((c, i) =>
                        i === idx ? { ...c, op: e.target.value as SegmentCondition['op'] } : c,
                      ),
                    )
                  }
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="eq">مساوی (=)</option>
                  <option value="neq">نامساوی (!=)</option>
                  <option value="contains">شامل</option>
                  <option value="gte">بزرگ‌تر یا مساوی (&gt;=)</option>
                </select>
                <input
                  type="text"
                  value={cond.value}
                  onChange={(e) =>
                    setSegConds((prev) =>
                      prev.map((c, i) => (i === idx ? { ...c, value: e.target.value } : c)),
                    )
                  }
                  placeholder="مقدار (مثلاً vip یا 60 یا organization)"
                  className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
                {segConds.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setSegConds((prev) => prev.filter((_, i) => i !== idx))}
                    className="p-1 text-slate-400 hover:text-rose-600"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 px-3 py-2 text-xs text-indigo-800 dark:border-indigo-900/60 dark:bg-indigo-950/30 dark:text-indigo-300">
            پیش‌نمایش زنده: با این شروط، <span className="font-bold tabular-nums">{toFa(draftSegmentPreviewCount)}</span> مشتری انتخاب می‌شوند.
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setSegOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs dark:border-slate-700"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700"
            >
              ذخیره سگمنت پویا
            </button>
          </div>
        </form>
      </Modal>

      {/* Deduplication / Merge Modal */}
      <Modal open={dedupOpen} onClose={() => setDedupOpen(false)} title="شناسایی و ادغام مشتریان تکراری (Dedup)" maxWidth="lg">
        <div className="space-y-4">
          {duplicatePairs.length > 0 ? (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                موارد مشکوک به تکرار یافت‌شده:
              </div>
              {duplicatePairs.map((p, idx) => (
                <div
                  key={idx}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50/50 p-3 text-xs dark:border-amber-900/50 dark:bg-amber-950/20"
                >
                  <div>
                    <span className="font-semibold">{p.a.name}</span> ({toFa(p.a.phone)}) و{' '}
                    <span className="font-semibold">{p.b.name}</span> ({toFa(p.b.phone)}) · {p.reason}
                  </div>
                  <button
                    type="button"
                    onClick={() => mergeCustomers(p.a.id, p.b.id)}
                    className="rounded-md bg-indigo-600 px-3 py-1 font-medium text-white hover:bg-indigo-700"
                  >
                    ادغام در پرونده اول
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-slate-200 p-3 text-xs text-slate-500 dark:border-slate-800">
              در حال حاضر شماره موبایل یا نام تکراری خودکاری یافت نشد. می‌توانید ادغام دستی انجام دهید:
            </p>
          )}

          <div className="grid grid-cols-1 gap-3 border-t border-slate-200 pt-3 sm:grid-cols-2 dark:border-slate-800">
            <div>
              <label className="mb-1 block text-xs text-slate-500">پرونده اصلی (حفظ می‌شود)</label>
              <select
                value={primaryId}
                onChange={(e) => setPrimaryId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              >
                {state.customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({toFa(c.phone)})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">پرونده تکراری (ادغام و حذف می‌شود)</label>
              <select
                value={duplicateId}
                onChange={(e) => setDuplicateId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              >
                {state.customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({toFa(c.phone)})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDedupOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs dark:border-slate-700"
            >
              بستن
            </button>
            <button
              type="button"
              onClick={() => {
                const res = mergeCustomers(primaryId, duplicateId);
                if (res.ok) setDedupOpen(false);
              }}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700"
            >
              اجرای ادغام دستی
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete confirmation modal */}
      <Modal open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} title="تأیید حذف مشتری" maxWidth="sm">
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            آیا از حذف <span className="font-semibold text-slate-900 dark:text-slate-100">{deleteTarget?.name}</span> مطمئن هستید؟
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm dark:border-slate-700"
            >
              انصراف
            </button>
            <button
              type="button"
              onClick={() => {
                if (deleteTarget) deleteCustomer(deleteTarget.id);
                setDeleteTarget(null);
              }}
              className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700"
            >
              حذف مشتری
            </button>
          </div>
        </div>
      </Modal>

      <CustomerDetailModal
        customer={detailCustomer}
        onClose={() => setDetailCustomer(null)}
        onEdit={openEditModal}
        onSelectCustomer={(c) => setDetailCustomer(c)}
      />
      <CsvImportModal open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}
