import { useMemo, useState } from 'react';
import {
  Check,
  Code2,
  Copy,
  ExternalLink,
  Link2,
  Plus,
  Send,
  TrendingUp,
} from 'lucide-react';
import { Modal } from '../Modal';
import { useClientFlow } from '../../store/useClientFlowStore';
import type { CustomerLifecycle, LandingForm, LandingFormFieldKey } from '../../types';
import { formatJalaliDateTime, toFa } from '../../utils/jalali';

const FORM_FIELD_LABELS: Record<LandingFormFieldKey, string> = {
  name: 'نام و نام خانوادگی *',
  phone: 'شماره موبایل *',
  email: 'ایمیل',
  companyName: 'نام شرکت / مجموعه',
  notes: 'توضیحات / درخواست مشتری',
};

export function LandingAttributionTab() {
  const { state, addLandingForm, submitLandingForm } = useClientFlow();

  // Create form modal
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [sourceTag, setSourceTag] = useState('اینستاگرام');
  const [utmSource, setUtmSource] = useState('instagram');
  const [utmMedium, setUtmMedium] = useState('bio_link');
  const [utmCampaign, setUtmCampaign] = useState('spring_leads');
  const [lifecycle, setLifecycle] = useState<CustomerLifecycle>('lead');
  const [fields, setFields] = useState<LandingFormFieldKey[]>(['name', 'phone', 'notes']);

  // Embed Code Modal
  const [embedForm, setEmbedForm] = useState<LandingForm | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Live Preview & Submit Lead Modal
  const [previewForm, setPreviewForm] = useState<LandingForm | null>(null);
  const [subName, setSubName] = useState('');
  const [subPhone, setSubPhone] = useState('');
  const [subEmail, setSubEmail] = useState('');
  const [subCompany, setSubCompany] = useState('');
  const [subNotes, setSubNotes] = useState('');
  const [subError, setSubError] = useState('');

  // UTM Attribution Matrix (grouped by source/medium/campaign)
  const utmAttributionRows = useMemo(() => {
    const map = new Map<
      string,
      {
        utmSource: string;
        utmMedium: string;
        utmCampaign: string;
        touches: number;
        converted: number;
      }
    >();

    for (const t of state.utmTouches) {
      const key = `${t.utmSource}__${t.utmMedium}__${t.utmCampaign}`;
      const existing = map.get(key) ?? {
        utmSource: t.utmSource,
        utmMedium: t.utmMedium,
        utmCampaign: t.utmCampaign,
        touches: 0,
        converted: 0,
      };
      existing.touches += 1;
      if (t.converted) existing.converted += 1;
      map.set(key, existing);
    }

    return Array.from(map.values()).sort((a, b) => b.touches - a.touches);
  }, [state.utmTouches]);

  // Lead Sources Breakdown from SalesLeads + Customers
  const sourceStats = useMemo(() => {
    const map = new Map<string, { source: string; leads: number; converted: number }>();
    for (const l of state.leads) {
      const s = l.source || 'نامشخص';
      const entry = map.get(s) ?? { source: s, leads: 0, converted: 0 };
      entry.leads += 1;
      if (l.status === 'converted') entry.converted += 1;
      map.set(s, entry);
    }
    return Array.from(map.values()).sort((a, b) => b.leads - a.leads);
  }, [state.leads]);

  const toggleField = (fk: LandingFormFieldKey) => {
    if (fk === 'name' || fk === 'phone') return;
    setFields((prev) => (prev.includes(fk) ? prev.filter((x) => x !== fk) : [...prev, fk]));
  };

  const handleCreateForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    addLandingForm({
      title: title.trim(),
      slug:
        slug
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, '-') || `form-${Date.now().toString(36)}`,
      sourceTag: sourceTag.trim() || 'لندینگ',
      utmSource: utmSource.trim() || 'direct',
      utmMedium: utmMedium.trim() || 'landing',
      utmCampaign: utmCampaign.trim() || 'general',
      defaultLifecycle: lifecycle,
      fields,
      active: true,
    });
    setTitle('');
    setSlug('');
    setCreateOpen(false);
  };

  const handleTestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!previewForm) return;
    setSubError('');
    const res = submitLandingForm(previewForm.id, {
      name: subName,
      phone: subPhone,
      email: subEmail,
      companyName: subCompany,
      notes: subNotes,
    });
    if (!res.ok) {
      setSubError(res.error ?? 'خطا در ثبت فرم');
      return;
    }
    setSubName('');
    setSubPhone('');
    setSubEmail('');
    setSubCompany('');
    setSubNotes('');
    setPreviewForm(null);
  };

  const getEmbedCode = (form: LandingForm) => {
    const query = `utm_source=${encodeURIComponent(form.utmSource)}&utm_medium=${encodeURIComponent(
      form.utmMedium,
    )}&utm_campaign=${encodeURIComponent(form.utmCampaign)}`;
    return `<!-- ClientFlow Landing Form: ${form.title} -->
<iframe
  src="https://clientflow.ir/forms/${form.slug}?${query}"
  title="${form.title}"
  width="100%"
  height="460"
  style="border:0;border-radius:12px;overflow:hidden;"
  loading="lazy"
></iframe>`;
  };

  const copySnippet = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            فرم‌های لندینگ، کد جاگذاری (Embed) و تحلیل منابع UTM
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            ساخت فرم جذب سرنخ، دریافت کد جاگذاری وب‌سایت، تولید خودکار Lead در قیف فروش و انتساب UTM
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-indigo-700"
        >
          <Plus size={15} />
          فرم لندینگ جدید
        </button>
      </div>

      {/* Landing Form Cards */}
      <div className="grid gap-4 lg:grid-cols-2">
        {state.landingForms.map((form) => (
          <div
            key={form.id}
            className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900"
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">{form.title}</h3>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                    <span className="inline-flex items-center gap-1 font-mono" dir="ltr">
                      <Link2 size={12} />/{form.slug}
                    </span>
                    <span>•</span>
                    <span>منبع: {form.sourceTag}</span>
                  </div>
                </div>
                <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                  {toFa(form.submissionsCount)} ثبت سرنخ
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
                <span className="rounded bg-slate-100 px-2 py-0.5 font-mono dark:bg-slate-800">
                  utm_source={form.utmSource}
                </span>
                <span className="rounded bg-slate-100 px-2 py-0.5 font-mono dark:bg-slate-800">
                  utm_medium={form.utmMedium}
                </span>
                <span className="rounded bg-slate-100 px-2 py-0.5 font-mono dark:bg-slate-800">
                  utm_campaign={form.utmCampaign}
                </span>
              </div>

              <div className="mt-3 text-[11px] text-slate-500">
                فیلدهای فرم:{' '}
                {form.fields.map((fk) => FORM_FIELD_LABELS[fk].replace(' *', '')).join('، ')}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setEmbedForm(form)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Code2 size={14} />
                کد جاگذاری (Embed)
              </button>
              <button
                type="button"
                onClick={() => {
                  setSubError('');
                  setPreviewForm(form);
                }}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
              >
                <ExternalLink size={14} />
                پیش‌نمایش و ثبت تست سرنخ
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Attribution Analytics Tables */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Lead Sources Summary */}
        <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold dark:border-slate-800">
            سهم منابع جذب سرنخ (Lead Sources)
          </div>
          <div className="divide-y divide-slate-100 p-4 dark:divide-slate-800">
            {sourceStats.map((s) => {
              const pct = s.leads > 0 ? Math.round((s.converted / s.leads) * 100) : 0;
              return (
                <div key={s.source} className="flex items-center justify-between py-2.5 text-xs">
                  <div>
                    <div className="font-semibold text-slate-800 dark:text-slate-200">
                      {s.source}
                    </div>
                    <div className="text-[11px] text-slate-500 tabular-nums">
                      تبدیل به مشتری: {toFa(s.converted)} نفر ({toFa(pct)}٪)
                    </div>
                  </div>
                  <span className="rounded-lg bg-indigo-50 px-2.5 py-1 font-bold tabular-nums text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                    {toFa(s.leads)} سرنخ
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* UTM Attribution Matrix */}
        <div className="lg:col-span-2 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3 text-sm font-semibold dark:border-slate-800">
            <TrendingUp size={16} className="text-indigo-500" />
            گزارش انتساب UTM بر اساس کمپین و مدیوم
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-600 dark:bg-slate-800/70 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-2.5">Source</th>
                  <th className="px-3 py-2.5">Medium</th>
                  <th className="px-3 py-2.5">Campaign</th>
                  <th className="px-3 py-2.5">ورودی‌ها</th>
                  <th className="px-3 py-2.5">تبدیل‌شده</th>
                  <th className="px-3 py-2.5">نرخ تبدیل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {utmAttributionRows.map((row) => {
                  const cvr = row.touches > 0 ? Math.round((row.converted / row.touches) * 100) : 0;
                  return (
                    <tr key={`${row.utmSource}-${row.utmMedium}-${row.utmCampaign}`}>
                      <td className="px-4 py-2.5 font-mono">{row.utmSource}</td>
                      <td className="px-3 py-2.5 font-mono">{row.utmMedium}</td>
                      <td className="px-3 py-2.5 font-mono text-indigo-600 dark:text-indigo-400">
                        {row.utmCampaign}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums">{toFa(row.touches)}</td>
                      <td className="px-3 py-2.5 tabular-nums text-emerald-600 dark:text-emerald-400">
                        {toFa(row.converted)}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums font-semibold">{toFa(cvr)}٪</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Recent UTM Events Log */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold dark:border-slate-800">
          آخرین رویدادهای ورودی UTM ثبت‌شده
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 text-slate-600 dark:bg-slate-800/70 dark:text-slate-300">
              <tr>
                <th className="px-4 py-2">مشتری / سرنخ</th>
                <th className="px-3 py-2">منبع (Source / Medium)</th>
                <th className="px-3 py-2">کمپین</th>
                <th className="px-3 py-2">زمان ثبت</th>
                <th className="px-3 py-2">وضعیت</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {state.utmTouches.slice(0, 12).map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-2 font-medium">{u.customerName ?? 'بازدیدکننده'}</td>
                  <td className="px-3 py-2 font-mono">
                    {u.utmSource} / {u.utmMedium}
                  </td>
                  <td className="px-3 py-2 font-mono text-indigo-600 dark:text-indigo-400">
                    {u.utmCampaign}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-slate-500">
                    {formatJalaliDateTime(u.landedAt)}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        u.converted
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {u.converted ? 'تبدیل شده به سرنخ/مشتری' : 'در حال پیگیری'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Landing Form Modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="ساخت فرم لندینگ و لینک UTM"
        maxWidth="lg"
      >
        <form onSubmit={handleCreateForm} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium">عنوان فرم *</label>
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثلاً فرم دریافت مشاوره رایگان"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">شناسه URL (Slug)</label>
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="free-consultation"
                dir="ltr"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-mono dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium">برچسب منبع سرنخ</label>
              <input
                value={sourceTag}
                onChange={(e) => setSourceTag(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">مرحله پیش‌فرض مشتری</label>
              <select
                value={lifecycle}
                onChange={(e) => setLifecycle(e.target.value as CustomerLifecycle)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="lead">سرنخ (Lead)</option>
                <option value="active">مشتری فعال</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium">utm_source</label>
              <input
                value={utmSource}
                onChange={(e) => setUtmSource(e.target.value)}
                dir="ltr"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-mono dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">utm_medium</label>
              <input
                value={utmMedium}
                onChange={(e) => setUtmMedium(e.target.value)}
                dir="ltr"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-mono dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">utm_campaign</label>
              <input
                value={utmCampaign}
                onChange={(e) => setUtmCampaign(e.target.value)}
                dir="ltr"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-mono dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium">فیلدهای فعال فرم</label>
            <div className="flex flex-wrap gap-2">
              {(['name', 'phone', 'email', 'companyName', 'notes'] as LandingFormFieldKey[]).map(
                (fk) => (
                  <label
                    key={fk}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-xs dark:border-slate-700"
                  >
                    <input
                      type="checkbox"
                      checked={fields.includes(fk)}
                      disabled={fk === 'name' || fk === 'phone'}
                      onChange={() => toggleField(fk)}
                    />
                    {FORM_FIELD_LABELS[fk]}
                  </label>
                ),
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs dark:border-slate-700"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700"
            >
              ایجاد فرم لندینگ
            </button>
          </div>
        </form>
      </Modal>

      {/* Embed Code Preview Modal */}
      <Modal
        open={Boolean(embedForm)}
        onClose={() => setEmbedForm(null)}
        title={embedForm ? `کد جاگذاری (Embed): ${embedForm.title}` : 'کد جاگذاری'}
        maxWidth="lg"
      >
        {embedForm && (
          <div className="space-y-4">
            <p className="text-xs text-slate-600 dark:text-slate-300">
              کد زیر را در صفحه وب‌سایت یا لندینگ خود قرار دهید. هر فرم ارسال‌شده با تگ‌های{' '}
              <span className="font-mono text-indigo-600 dark:text-indigo-400">
                utm_source={embedForm.utmSource}
              </span>{' '}
              مستقیماً در بخش سرنخ‌های فروش ثبت می‌شود.
            </p>
            <pre
              dir="ltr"
              className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-950 p-3 text-xs font-mono text-emerald-300 dark:border-slate-800"
            >
              {getEmbedCode(embedForm)}
            </pre>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => copySnippet(embedForm.id, getEmbedCode(embedForm))}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700"
              >
                {copiedId === embedForm.id ? <Check size={14} /> : <Copy size={14} />}
                {copiedId === embedForm.id ? 'کپی شد!' : 'کپی کد جاگذاری'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Preview & Submit Test Lead Modal */}
      <Modal
        open={Boolean(previewForm)}
        onClose={() => setPreviewForm(null)}
        title={previewForm ? `پیش‌نمایش فرم: ${previewForm.title}` : 'پیش‌نمایش فرم'}
        maxWidth="md"
      >
        {previewForm && (
          <form onSubmit={handleTestSubmit} className="space-y-3">
            <div className="rounded-lg bg-indigo-50 p-2.5 text-[11px] text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
              ارسال این فرم یک سرنخ واقعی (Lead) در قیف فروش + پرونده مشتری + رویداد UTM ثبت می‌کند.
            </div>
            {subError && (
              <div className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                {subError}
              </div>
            )}
            {previewForm.fields.includes('name') && (
              <div>
                <label className="mb-1 block text-xs font-medium">نام و نام خانوادگی *</label>
                <input
                  required
                  value={subName}
                  onChange={(e) => setSubName(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
            )}
            {previewForm.fields.includes('phone') && (
              <div>
                <label className="mb-1 block text-xs font-medium">شماره موبایل *</label>
                <input
                  required
                  value={subPhone}
                  onChange={(e) => setSubPhone(e.target.value)}
                  placeholder="09120000000"
                  dir="ltr"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
            )}
            {previewForm.fields.includes('email') && (
              <div>
                <label className="mb-1 block text-xs font-medium">ایمیل</label>
                <input
                  type="email"
                  value={subEmail}
                  onChange={(e) => setSubEmail(e.target.value)}
                  dir="ltr"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
            )}
            {previewForm.fields.includes('companyName') && (
              <div>
                <label className="mb-1 block text-xs font-medium">نام شرکت / مجموعه</label>
                <input
                  value={subCompany}
                  onChange={(e) => setSubCompany(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
            )}
            {previewForm.fields.includes('notes') && (
              <div>
                <label className="mb-1 block text-xs font-medium">توضیحات</label>
                <textarea
                  rows={2}
                  value={subNotes}
                  onChange={(e) => setSubNotes(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPreviewForm(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs dark:border-slate-700"
              >
                انصراف
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-700"
              >
                <Send size={14} />
                ارسال فرم و ثبت سرنخ
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
