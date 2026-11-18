import { useMemo, useState } from 'react';
import { Download, Eye, GitMerge, Pencil, Plus, Search, Trash2, Upload } from 'lucide-react';
import { CsvImportModal } from '../components/CsvImportModal';
import { CustomerDetailModal } from '../components/CustomerDetailModal';
import { Modal } from '../components/Modal';
import { useClientFlow } from '../store/useClientFlowStore';
import type { Customer } from '../types';
import { exportCustomersToCsv, normalizeMobileInput } from '../utils/csv';
import { formatJalali, toFa } from '../utils/jalali';

const ALL_TAGS = ['همه', 'VIP', 'پیگیری', 'مراجع ثابت', 'فروشگاه', 'جدید'];

export function CustomersPage() {
  const { state, addCustomer, updateCustomer, deleteCustomer, mergeCustomers } = useClientFlow();
  const [query, setQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState('همه');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [detailCustomer, setDetailCustomer] = useState<Customer | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [dedupOpen, setDedupOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);

  // Merge state
  const [primaryId, setPrimaryId] = useState(state.customers[0]?.id ?? '');
  const [duplicateId, setDuplicateId] = useState(state.customers[1]?.id ?? '');

  // Form fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [source, setSource] = useState('اینستاگرام');
  const [notes, setNotes] = useState('');
  const [patientCode, setPatientCode] = useState('');
  const [allergies, setAllergies] = useState('');
  const [consentSms, setConsentSms] = useState(true);
  const [consentPhoto, setConsentPhoto] = useState(false);
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');

  const isAdmin = state.settings.role === 'admin';
  const isClinic = state.settings.industryPack === 'clinic';

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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return state.customers.filter((c) => {
      const matchesTag = selectedTag === 'همه' || c.tags.includes(selectedTag);
      if (!matchesTag) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        (c.email ?? '').toLowerCase().includes(q) ||
        (c.patientCode ?? '').toLowerCase().includes(q)
      );
    });
  }, [state.customers, query, selectedTag]);

  const openCreateModal = () => {
    setEditing(null);
    setName('');
    setPhone('');
    setEmail('');
    setTagsText('');
    setSource('اینستاگرام');
    setNotes('');
    setPatientCode(`CF-${140500 + state.customers.length + 1}`);
    setAllergies('');
    setConsentSms(true);
    setConsentPhoto(false);
    setCustomValues({});
    setFormError('');
    setFormOpen(true);
  };

  const openEditModal = (c: Customer) => {
    setEditing(c);
    setName(c.name);
    setPhone(c.phone);
    setEmail(c.email ?? '');
    setTagsText(c.tags.join('، '));
    setSource(c.source ?? 'اینستاگرام');
    setNotes(c.notes ?? '');
    setPatientCode(c.patientCode ?? '');
    setAllergies(c.allergies ?? '');
    setConsentSms(c.consentSms !== false);
    setConsentPhoto(Boolean(c.consentPhoto));
    setCustomValues(c.customFields ?? {});
    setFormError('');
    setFormOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedPhone = normalizeMobileInput(phone);
    const parsedTags = tagsText
      .split(/[,،|]/)
      .map((t) => t.trim())
      .filter(Boolean);

    const payload = {
      name: name.trim(),
      phone: normalizedPhone,
      email: email.trim() || undefined,
      tags: parsedTags,
      source,
      notes: notes.trim() || undefined,
      patientCode: patientCode.trim() || undefined,
      allergies: allergies.trim() || undefined,
      consentSms,
      consentPhoto,
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative min-w-[240px] flex-1 max-w-md">
          <Search size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="جستجوی نام، موبایل، ایمیل یا کد پرونده..."
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pr-9 pl-3 text-sm focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900"
          />
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
            ورود CSV
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

      <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1 w-fit dark:bg-slate-900">
        {ALL_TAGS.map((tag) => (
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
            <p className="text-sm text-slate-500 dark:text-slate-400">مشتری مطابق با جستجوی شما یافت نشد.</p>
            <button
              type="button"
              onClick={openCreateModal}
              className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700"
            >
              ثبت اولین مشتری
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/70 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">نام</th>
                  <th className="px-4 py-3 font-medium">شماره موبایل</th>
                  <th className="px-4 py-3 font-medium">برچسب‌ها و منبع</th>
                  {isClinic && <th className="px-4 py-3 font-medium">کد پرونده</th>}
                  <th className="px-4 py-3 font-medium">تاریخ ثبت</th>
                  <th className="px-4 py-3 font-medium text-left">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {filtered.map((c) => (
                  <tr key={c.id} className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-2.5">
                      <button
                        type="button"
                        onClick={() => setDetailCustomer(c)}
                        className="font-medium text-slate-900 hover:text-indigo-600 dark:text-slate-100 dark:hover:text-indigo-400"
                      >
                        {c.name}
                      </button>
                      {c.email && <div className="text-xs text-slate-500 dark:text-slate-400">{c.email}</div>}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-slate-700 dark:text-slate-300" dir="ltr">
                      <span className="block text-right">{toFa(c.phone)}</span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-500 dark:text-slate-400">
                      {[c.tags.join('، '), c.source].filter(Boolean).join(' · ') || '—'}
                    </td>
                    {isClinic && (
                      <td className="px-4 py-2.5 text-xs tabular-nums text-slate-600 dark:text-slate-300">
                        {c.patientCode || '—'}
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
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

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                نام و نام خانوادگی *
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
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">فیلدهای سفارشی پویا</div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {state.customFieldDefs.map((def) => (
                  <div key={def.id}>
                    <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">{def.label}</label>
                    {def.type === 'select' && def.options ? (
                      <select
                        value={customValues[def.key] ?? ''}
                        onChange={(e) =>
                          setCustomValues((prev) => ({ ...prev, [def.key]: e.target.value }))
                        }
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                      >
                        <option value="">-- انتخاب کنید --</option>
                        {def.options.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={def.type === 'number' ? 'number' : 'text'}
                        value={customValues[def.key] ?? ''}
                        onChange={(e) =>
                          setCustomValues((prev) => ({ ...prev, [def.key]: e.target.value }))
                        }
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                      />
                    )}
                  </div>
                ))}
              </div>
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
      />
      <CsvImportModal open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}
