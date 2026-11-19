import { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import {
  BarChart2,
  Edit3,
  ExternalLink,
  FileText,
  FolderOpen,
  Image as ImageIcon,
  Link2,
  Megaphone,
  Play,
  Plus,
  Sparkles,
  Trash2,
  Trophy,
  Upload,
} from 'lucide-react';
import { Modal } from '../components/Modal';
import { useClientFlow } from '../store/useClientFlowStore';
import type {
  ContentItem,
  ContentStatus,
  CustomerLifecycle,
  LandingForm,
  LandingFormFieldKey,
  MediaAsset,
  NotificationChannel,
} from '../types';
import { formatJalali, formatJalaliDateTime, toFa } from '../utils/jalali';
import { fuzzyMatchPersian } from '../utils/persianSearch';

const CONTENT_STAGES: { key: ContentStatus; label: string }[] = [
  { key: 'idea', label: 'ایده' },
  { key: 'draft', label: 'پیش‌نویس' },
  { key: 'review', label: 'بازبینی' },
  { key: 'scheduled', label: 'زمان‌بندی‌شده' },
  { key: 'published', label: 'منتشرشده' },
];

const PLATFORM_LABEL: Record<ContentItem['platform'], string> = {
  instagram: 'اینستاگرام',
  site: 'وب‌سایت',
  blog: 'بلاگ سئو',
};

const FORMAT_LABEL: Record<ContentItem['format'], string> = {
  post: 'پست',
  reel: 'ریلز',
  story: 'استوری',
  article: 'مقاله',
};

const FORM_FIELD_LABELS: Record<LandingFormFieldKey, string> = {
  name: 'نام و نام خانوادگی *',
  phone: 'شماره موبایل *',
  email: 'ایمیل',
  companyName: 'نام شرکت / کلینیک',
  notes: 'توضیحات / نیاز مشتری',
};

export function MarketingPage() {
  const {
    state,
    addContentItem,
    updateContentStatus,
    updateContentItem,
    addCampaign,
    launchCampaign,
    simulateCampaignStats,
    addMediaAsset,
    deleteMediaAsset,
    addLandingForm,
    submitLandingForm,
  } = useClientFlow();

  const [tab, setTab] = useState<'content' | 'campaigns' | 'media' | 'landing'>('content');

  // Create Content Modal
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [platform, setPlatform] = useState<ContentItem['platform']>('instagram');
  const [format, setFormat] = useState<ContentItem['format']>('reel');
  const [assignee, setAssignee] = useState('نگار (محتوا)');
  const [daysAhead, setDaysAhead] = useState(2);
  const [hasConsent, setHasConsent] = useState(false);
  const [contentMediaId, setContentMediaId] = useState('');

  // Edit Content & Metrics Modal (FR-MKT-05)
  const [editingContent, setEditingContent] = useState<ContentItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editCaption, setEditCaption] = useState('');
  const [editReach, setEditReach] = useState(0);
  const [editLeads, setEditLeads] = useState(0);
  const [editConsent, setEditConsent] = useState(false);
  const [editMediaId, setEditMediaId] = useState('');

  // Campaign Modal (FR-MKT-01)
  const [cmpOpen, setCmpOpen] = useState(false);
  const [cmpName, setCmpName] = useState('');
  const [cmpSegmentId, setCmpSegmentId] = useState(state.customerSegments[0]?.id ?? '');
  const [cmpChannel, setCmpChannel] = useState<NotificationChannel>('sms');
  const [cmpUtm, setCmpUtm] = useState('spring_promo');
  const [cmpAbEnabled, setCmpAbEnabled] = useState(true);
  const [cmpSubjA, setCmpSubjA] = useState('پیشنهاد ویژه مشتریان وفادار');
  const [cmpBodyA, setCmpBodyA] = useState('سلام {{customer.name}}، تا پایان هفته ۱۵٪ تخفیف ویژه شما فعال است.');
  const [cmpSubjB, setCmpSubjB] = useState('مشاوره رایگان + هدیه اختصاصی');
  const [cmpBodyB, setCmpBodyB] = useState('{{customer.name}} عزیز، یک جلسه مشاوره رایگان از {{businessName}} هدیه بگیرید.');

  // Media Library Modal (FR-MKT-06)
  const [mediaOpen, setMediaOpen] = useState(false);
  const [mediaSearch, setMediaSearch] = useState('');
  const [mediaFolderFilter, setMediaFolderFilter] = useState('all');
  const [medName, setMedName] = useState('');
  const [medType, setMedType] = useState<MediaAsset['type']>('image');
  const [medFolder, setMedFolder] = useState('اینستاگرام');
  const [medTags, setMedTags] = useState('کمپین, معرفی');
  const [medUrl, setMedUrl] = useState('');
  const [medSize, setMedSize] = useState('350 KB');
  const [medConsent, setMedConsent] = useState(false);

  // Landing Form Builder & Simulator Modal (FR-MKT-03 & UTM)
  const [formOpen, setFormOpen] = useState(false);
  const [lfTitle, setLfTitle] = useState('');
  const [lfSlug, setLfSlug] = useState('special-offer');
  const [lfSource, setLfSource] = useState('لندینگ کمپین');
  const [lfUtmSource, setLfUtmSource] = useState('instagram');
  const [lfUtmMedium, setLfUtmMedium] = useState('story_link');
  const [lfUtmCampaign, setLfUtmCampaign] = useState('winter_campaign');
  const [lfLifecycle, setLfLifecycle] = useState<CustomerLifecycle>('lead');
  const [lfFields, setLfFields] = useState<LandingFormFieldKey[]>(['name', 'phone', 'notes']);

  const [previewForm, setPreviewForm] = useState<LandingForm | null>(null);
  const [simName, setSimName] = useState('');
  const [simPhone, setSimPhone] = useState('');
  const [simEmail, setSimEmail] = useState('');
  const [simCompany, setSimCompany] = useState('');
  const [simNotes, setSimNotes] = useState('');
  const [simError, setSimError] = useState('');

  const sourceStats = useMemo(() => {
    const counts = new Map<string, number>();
    state.customers.forEach((c) => {
      const src = c.source || 'سایر';
      counts.set(src, (counts.get(src) ?? 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [state.customers]);

  const mediaFolders = useMemo(() => {
    return Array.from(new Set(state.mediaAssets.map((m) => m.folder)));
  }, [state.mediaAssets]);

  const filteredMedia = useMemo(() => {
    return state.mediaAssets.filter((m) => {
      if (mediaFolderFilter !== 'all' && m.folder !== mediaFolderFilter) return false;
      if (mediaSearch.trim() && !fuzzyMatchPersian([m.name, m.tags.join(' '), m.folder], mediaSearch)) {
        return false;
      }
      return true;
    });
  }, [state.mediaAssets, mediaFolderFilter, mediaSearch]);

  const utmSummary = useMemo(() => {
    const map = new Map<
      string,
      { source: string; medium: string; campaign: string; touches: number; converted: number }
    >();
    state.utmTouches.forEach((u) => {
      const k = `${u.utmSource}|${u.utmMedium}|${u.utmCampaign}`;
      const cur = map.get(k) ?? {
        source: u.utmSource,
        medium: u.utmMedium,
        campaign: u.utmCampaign,
        touches: 0,
        converted: 0,
      };
      cur.touches += 1;
      if (u.converted) cur.converted += 1;
      map.set(k, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.touches - a.touches);
  }, [state.utmTouches]);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    addContentItem({
      title: title.trim(),
      platform,
      format,
      status: 'idea',
      scheduledAt: dayjs().add(daysAhead, 'day').toISOString(),
      assignee,
      hasBeforeAfterConsent: hasConsent,
      mediaAssetId: contentMediaId || undefined,
    });
    setTitle('');
    setContentMediaId('');
    setCreateOpen(false);
  };

  const openEditContent = (item: ContentItem) => {
    setEditingContent(item);
    setEditTitle(item.title);
    setEditCaption(item.caption ?? '');
    setEditReach(item.reach);
    setEditLeads(item.leadsCount);
    setEditConsent(Boolean(item.hasBeforeAfterConsent));
    setEditMediaId(item.mediaAssetId ?? '');
  };

  const handleSaveEditContent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingContent || !editTitle.trim()) return;
    updateContentItem(editingContent.id, {
      title: editTitle.trim(),
      caption: editCaption.trim() || undefined,
      reach: Number(editReach) || 0,
      leadsCount: Number(editLeads) || 0,
      hasBeforeAfterConsent: editConsent,
      mediaAssetId: editMediaId || undefined,
    });
    setEditingContent(null);
  };

  const handleCreateCampaign = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cmpName.trim()) return;
    addCampaign({
      name: cmpName.trim(),
      segmentId: cmpSegmentId || undefined,
      channel: cmpChannel,
      abTestEnabled: cmpAbEnabled,
      utmCampaign: cmpUtm.trim() || 'campaign',
      variantA: { subject: cmpSubjA, body: cmpBodyA, sent: 0, clicks: 0, conversions: 0 },
      variantB: cmpAbEnabled
        ? { subject: cmpSubjB, body: cmpBodyB, sent: 0, clicks: 0, conversions: 0 }
        : undefined,
    });
    setCmpName('');
    setCmpOpen(false);
  };

  const handleMediaFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMedName((prev) => prev || file.name);
    setMedSize(`${Math.max(1, Math.round(file.size / 1024))} KB`);
    if (file.type.startsWith('image/')) setMedType('image');
    else if (file.type.startsWith('video/')) setMedType('video');
    else setMedType('pdf');

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setMedUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCreateMedia = (e: React.FormEvent) => {
    e.preventDefault();
    if (!medName.trim()) return;
    addMediaAsset({
      name: medName.trim(),
      type: medType,
      folder: medFolder.trim() || 'عمومی',
      sizeLabel: medSize,
      tags: medTags
        .split(/[،,]/)
        .map((s) => s.trim())
        .filter(Boolean),
      urlOrDataUrl: medUrl.trim() || 'https://placehold.co/600x400/6366f1/ffffff?text=Media+Asset',
      hasModelConsent: medConsent,
    });
    setMedName('');
    setMedUrl('');
    setMedConsent(false);
    setMediaOpen(false);
  };

  const handleCreateForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lfTitle.trim()) return;
    addLandingForm({
      title: lfTitle.trim(),
      slug: lfSlug.trim() || `form-${Date.now()}`,
      sourceTag: lfSource.trim() || 'فرم فرود',
      utmSource: lfUtmSource.trim() || 'direct',
      utmMedium: lfUtmMedium.trim() || 'landing',
      utmCampaign: lfUtmCampaign.trim() || 'general',
      defaultLifecycle: lfLifecycle,
      fields: lfFields.includes('name') && lfFields.includes('phone') ? lfFields : ['name', 'phone', ...lfFields],
      active: true,
    });
    setLfTitle('');
    setFormOpen(false);
  };

  const handleSimulateSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!previewForm) return;
    setSimError('');
    const res = submitLandingForm(previewForm.id, {
      name: simName,
      phone: simPhone,
      email: simEmail,
      companyName: simCompany,
      notes: simNotes,
    });
    if (!res.ok) {
      setSimError(res.error ?? 'خطا در ثبت فرم');
      return;
    }
    setSimName('');
    setSimPhone('');
    setSimEmail('');
    setSimCompany('');
    setSimNotes('');
    setPreviewForm(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => setTab('content')}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === 'content'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            تقویم و تولید محتوا ({toFa(state.contentItems.length)})
          </button>
          <button
            type="button"
            onClick={() => setTab('campaigns')}
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === 'campaigns'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <Megaphone size={13} />
            کمپین‌ها و تست A/B ({toFa(state.campaigns.length)})
          </button>
          <button
            type="button"
            onClick={() => setTab('media')}
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === 'media'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <ImageIcon size={13} />
            کتابخانه رسانه ({toFa(state.mediaAssets.length)})
          </button>
          <button
            type="button"
            onClick={() => setTab('landing')}
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === 'landing'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <Link2 size={13} />
            فرم‌های فرود و ردیابی UTM ({toFa(state.landingForms.length)})
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            if (tab === 'content') setCreateOpen(true);
            else if (tab === 'campaigns') setCmpOpen(true);
            else if (tab === 'media') setMediaOpen(true);
            else setFormOpen(true);
          }}
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700"
        >
          <Plus size={16} />
          {tab === 'content'
            ? 'محتوای جدید'
            : tab === 'campaigns'
              ? 'ساخت کمپین جدید'
              : tab === 'media'
                ? 'آپلود رسانه جدید'
                : 'ساخت فرم فرود جدید'}
        </button>
      </div>

      {tab === 'content' && (
        <div className="space-y-6">
          {/* Content Pipeline */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
            {CONTENT_STAGES.map((stage) => {
              const items = state.contentItems.filter((c) => c.status === stage.key);
              return (
                <div
                  key={stage.key}
                  className="flex min-h-[280px] flex-col rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2.5 text-xs font-semibold dark:border-slate-800">
                    <span>{stage.label}</span>
                    <span className="tabular-nums text-slate-500">{toFa(items.length)}</span>
                  </div>
                  <div className="flex-1 space-y-2.5 p-2.5">
                    {items.length === 0 ? (
                      <div className="py-8 text-center text-xs text-slate-400">موردی نیست</div>
                    ) : (
                      items.map((item) => {
                        const linkedAsset = item.mediaAssetId
                          ? state.mediaAssets.find((m) => m.id === item.mediaAssetId)
                          : undefined;
                        return (
                          <div
                            key={item.id}
                            className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/70 p-2.5 text-xs dark:border-slate-800 dark:bg-slate-800/40"
                          >
                            <div className="flex items-start justify-between gap-1">
                              <div className="font-semibold text-slate-900 dark:text-slate-100">{item.title}</div>
                              <button
                                type="button"
                                onClick={() => openEditContent(item)}
                                title="ویرایش و ثبت آمار بازدید/لید"
                                className="shrink-0 rounded p-1 text-slate-500 hover:bg-white hover:text-indigo-600 dark:hover:bg-slate-800"
                              >
                                <Edit3 size={13} />
                              </button>
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                              {PLATFORM_LABEL[item.platform]} · {FORMAT_LABEL[item.format]} · {item.assignee}
                            </div>
                            <div className="text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
                              موعد انتشار: {formatJalali(item.scheduledAt)}
                            </div>
                            {linkedAsset && (
                              <div className="truncate text-[11px] text-sky-600 dark:text-sky-400">
                                رسانه: {linkedAsset.name}
                              </div>
                            )}
                            {item.hasBeforeAfterConsent && (
                              <div className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                                دارای رضایت‌نامه کتبی تصویر
                              </div>
                            )}
                            {(item.status === 'published' || item.reach > 0 || item.leadsCount > 0) && (
                              <div className="flex items-center justify-between rounded bg-indigo-50/60 px-2 py-1 text-[11px] tabular-nums text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300">
                                <span>
                                  بازدید: {toFa(item.reach)} · لید: {toFa(item.leadsCount)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => openEditContent(item)}
                                  className="underline"
                                >
                                  ثبت آمار
                                </button>
                              </div>
                            )}
                            <select
                              aria-label="وضعیت محتوا"
                              value={item.status}
                              onChange={(e) => updateContentStatus(item.id, e.target.value as ContentStatus)}
                              className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-[11px] dark:border-slate-700 dark:bg-slate-900"
                            >
                              {CONTENT_STAGES.map((st) => (
                                <option key={st.key} value={st.key}>
                                  {st.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Lead Source Attribution */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-3 text-sm font-semibold">عملکرد کانال‌های جذب مشتری (Attribution)</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {sourceStats.map(([src, count]) => (
                <div key={src} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                  <div className="text-xs text-slate-500 dark:text-slate-400">{src}</div>
                  <div className="mt-1 text-lg font-bold tabular-nums">{toFa(count)} مشتری</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'campaigns' && (
        <div className="space-y-4">
          {state.campaigns.map((cmp) => {
            const seg = cmp.segmentId ? state.customerSegments.find((s) => s.id === cmp.segmentId) : null;
            const ctrA = cmp.variantA.sent > 0 ? Math.round((cmp.variantA.clicks / cmp.variantA.sent) * 100) : 0;
            const cvrA = cmp.variantA.sent > 0 ? Math.round((cmp.variantA.conversions / cmp.variantA.sent) * 100) : 0;
            const ctrB =
              cmp.variantB && cmp.variantB.sent > 0
                ? Math.round((cmp.variantB.clicks / cmp.variantB.sent) * 100)
                : 0;
            const cvrB =
              cmp.variantB && cmp.variantB.sent > 0
                ? Math.round((cmp.variantB.conversions / cmp.variantB.sent) * 100)
                : 0;

            return (
              <div
                key={cmp.id}
                className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-3 dark:border-slate-800">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                      <span>{cmp.name}</span>
                      {cmp.abTestEnabled && (
                        <span className="rounded bg-indigo-50 px-2 py-0.5 text-[11px] text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                          تست A/B فعال
                        </span>
                      )}
                      {cmp.winner && (
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                          <Trophy size={12} />
                          برنده: نسخه {cmp.winner}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      کانال: {cmp.channel.toUpperCase()} · UTM: <span dir="ltr">{cmp.utmCampaign}</span>
                      {seg && ` · سگمنت هدف: ${seg.name}`}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {cmp.status === 'draft' && (
                      <button
                        type="button"
                        onClick={() => launchCampaign(cmp.id)}
                        className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                      >
                        <Play size={13} />
                        اجرا و ارسال کمپین
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => simulateCampaignStats(cmp.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs hover:bg-slate-50 dark:border-slate-700"
                    >
                      <Sparkles size={13} />
                      شبیه‌سازی بازخورد و برنده A/B
                    </button>
                  </div>
                </div>

                <div className={`mt-4 grid grid-cols-1 gap-4 ${cmp.abTestEnabled && cmp.variantB ? 'md:grid-cols-2' : ''}`}>
                  <div
                    className={`rounded-xl border p-4 text-xs ${
                      cmp.winner === 'A'
                        ? 'border-emerald-300 bg-emerald-50/40 dark:border-emerald-800 dark:bg-emerald-950/20'
                        : 'border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between font-semibold">
                      <span>نسخه A: {cmp.variantA.subject}</span>
                      {cmp.winner === 'A' && <span className="text-emerald-600">برنده</span>}
                    </div>
                    <p className="mt-1 text-slate-600 dark:text-slate-300">{cmp.variantA.body}</p>
                    <div className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-200 pt-2.5 text-center tabular-nums dark:border-slate-800">
                      <div>
                        <div className="text-[11px] text-slate-400">ارسال</div>
                        <div className="font-bold">{toFa(cmp.variantA.sent)}</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-400">کلیک (CTR)</div>
                        <div className="font-bold text-indigo-600">
                          {toFa(cmp.variantA.clicks)} ({toFa(ctrA)}٪)
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-400">تبدیل (CVR)</div>
                        <div className="font-bold text-emerald-600">
                          {toFa(cmp.variantA.conversions)} ({toFa(cvrA)}٪)
                        </div>
                      </div>
                    </div>
                  </div>

                  {cmp.abTestEnabled && cmp.variantB && (
                    <div
                      className={`rounded-xl border p-4 text-xs ${
                        cmp.winner === 'B'
                          ? 'border-emerald-300 bg-emerald-50/40 dark:border-emerald-800 dark:bg-emerald-950/20'
                          : 'border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between font-semibold">
                        <span>نسخه B: {cmp.variantB.subject}</span>
                        {cmp.winner === 'B' && <span className="text-emerald-600">برنده</span>}
                      </div>
                      <p className="mt-1 text-slate-600 dark:text-slate-300">{cmp.variantB.body}</p>
                      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-200 pt-2.5 text-center tabular-nums dark:border-slate-800">
                        <div>
                          <div className="text-[11px] text-slate-400">ارسال</div>
                          <div className="font-bold">{toFa(cmp.variantB.sent)}</div>
                        </div>
                        <div>
                          <div className="text-[11px] text-slate-400">کلیک (CTR)</div>
                          <div className="font-bold text-indigo-600">
                            {toFa(cmp.variantB.clicks)} ({toFa(ctrB)}٪)
                          </div>
                        </div>
                        <div>
                          <div className="text-[11px] text-slate-400">تبدیل (CVR)</div>
                          <div className="font-bold text-emerald-600">
                            {toFa(cmp.variantB.conversions)} ({toFa(cvrB)}٪)
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'media' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setMediaFolderFilter('all')}
                className={`rounded-lg border px-3 py-1.5 text-xs ${
                  mediaFolderFilter === 'all'
                    ? 'border-indigo-500 bg-indigo-50 font-medium text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300'
                    : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
                }`}
              >
                همه پوشه‌ها
              </button>
              {mediaFolders.map((folder) => (
                <button
                  key={folder}
                  type="button"
                  onClick={() => setMediaFolderFilter(folder)}
                  className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs ${
                    mediaFolderFilter === folder
                      ? 'border-indigo-500 bg-indigo-50 font-medium text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300'
                      : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
                  }`}
                >
                  <FolderOpen size={12} />
                  {folder}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={mediaSearch}
              onChange={(e) => setMediaSearch(e.target.value)}
              placeholder="جستجو در نام یا برچسب رسانه..."
              className="w-full max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-800 dark:bg-slate-900"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredMedia.map((asset) => (
              <div
                key={asset.id}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex h-36 items-center justify-center bg-slate-100 dark:bg-slate-800">
                  {asset.type === 'image' ? (
                    <img src={asset.urlOrDataUrl} alt={asset.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-slate-500">
                      <FileText size={32} />
                      <span className="text-xs uppercase">{asset.type}</span>
                    </div>
                  )}
                </div>
                <div className="space-y-2 p-4 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-semibold text-slate-900 dark:text-slate-100">{asset.name}</div>
                    <button
                      type="button"
                      onClick={() => deleteMediaAsset(asset.id)}
                      className="text-rose-500 hover:text-rose-600"
                      title="حذف رسانه"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    پوشه: {asset.folder} · حجم: {asset.sizeLabel} · {formatJalali(asset.uploadedAt)}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {asset.tags.map((tg) => (
                      <span
                        key={tg}
                        className="rounded bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                      >
                        #{tg}
                      </span>
                    ))}
                    {asset.hasModelConsent && (
                      <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                        دارای رضایت مدل
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'landing' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {state.landingForms.map((form) => (
              <div
                key={form.id}
                className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{form.title}</h3>
                    <div className="mt-1 text-xs text-slate-500">
                      منبع: {form.sourceTag} · ثبت‌شده: <span className="font-semibold tabular-nums">{toFa(form.submissionsCount)} سرنخ</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSimError('');
                      setPreviewForm(form);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                  >
                    <ExternalLink size={13} />
                    پیش‌نمایش و تست ثبت فرم
                  </button>
                </div>
                <div
                  dir="ltr"
                  className="mt-3 truncate rounded-lg bg-slate-50 px-3 py-2 font-mono text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                >
                  https://clientflow.ir/l/{form.slug}?utm_source={form.utmSource}&utm_medium={form.utmMedium}&utm_campaign={form.utmCampaign}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-slate-500">
                  <span>فیلدها:</span>
                  {form.fields.map((f) => (
                    <span key={f} className="rounded bg-slate-100 px-2 py-0.5 dark:bg-slate-800">
                      {FORM_FIELD_LABELS[f].replace(' *', '')}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* UTM Attribution Table */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <BarChart2 size={16} className="text-indigo-600" />
              گزارش ردیابی و تبدیل UTM (UtmTouch Analytics)
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800">
                  <tr>
                    <th className="py-2">utm_source</th>
                    <th className="py-2">utm_medium</th>
                    <th className="py-2">utm_campaign</th>
                    <th className="py-2">تعداد ورود (Touch)</th>
                    <th className="py-2">تبدیل به سرنخ/مشتری</th>
                    <th className="py-2">نرخ تبدیل</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {utmSummary.map((row, idx) => {
                    const rate = row.touches > 0 ? Math.round((row.converted / row.touches) * 100) : 0;
                    return (
                      <tr key={idx}>
                        <td className="py-2.5 font-medium" dir="ltr">
                          {row.source}
                        </td>
                        <td className="py-2.5" dir="ltr">
                          {row.medium}
                        </td>
                        <td className="py-2.5 text-indigo-600 dark:text-indigo-400" dir="ltr">
                          {row.campaign}
                        </td>
                        <td className="py-2.5 tabular-nums">{toFa(row.touches)}</td>
                        <td className="py-2.5 tabular-nums text-emerald-600">{toFa(row.converted)}</td>
                        <td className="py-2.5 tabular-nums font-semibold">{toFa(rate)}٪</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {state.utmTouches.length > 0 && (
              <div className="mt-4 border-t border-slate-200 pt-3 dark:border-slate-800">
                <div className="mb-2 text-xs font-semibold text-slate-600 dark:text-slate-300">آخرین رویدادهای UTM ثبت‌شده</div>
                <div className="space-y-1.5">
                  {state.utmTouches.slice(0, 5).map((u) => (
                    <div key={u.id} className="flex flex-wrap items-center justify-between text-[11px] text-slate-500">
                      <span>
                        {u.customerName ? `مشتری: ${u.customerName}` : 'بازدیدکننده ناشناس'} ·{' '}
                        <span dir="ltr">
                          {u.utmSource}/{u.utmMedium}/{u.utmCampaign}
                        </span>
                      </span>
                      <span className="tabular-nums">{formatJalaliDateTime(u.landedAt)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Content Modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="ثبت ایده / محتوای جدید" maxWidth="md">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">عنوان محتوا *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثلاً: ریلز معرفی مراقبت‌های بعد از فیشیال"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">پلتفرم</label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value as ContentItem['platform'])}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="instagram">اینستاگرام</option>
                <option value="site">وب‌سایت</option>
                <option value="blog">بلاگ سئو</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">فرمت</label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as ContentItem['format'])}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="reel">ریلز</option>
                <option value="post">پست</option>
                <option value="story">استوری</option>
                <option value="article">مقاله</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">مسئول تولید</label>
              <input
                type="text"
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">زمان انتشار</label>
              <select
                value={daysAhead}
                onChange={(e) => setDaysAhead(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                <option value={1}>فردا</option>
                <option value={2}>۲ روز دیگر</option>
                <option value={5}>۵ روز دیگر</option>
                <option value={7}>هفته آینده</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">اتصال فایل از کتابخانه رسانه</label>
            <select
              value={contentMediaId}
              onChange={(e) => setContentMediaId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="">بدون فایل پیوست</option>
              {state.mediaAssets.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.folder})
                </option>
              ))}
            </select>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={hasConsent}
              onChange={(e) => setHasConsent(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600"
            />
            رضایت‌نامه کتبی مراجع برای انتشار تصویر/ویدیو قبل و بعد اخذ شده است
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm dark:border-slate-700"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              ثبت در تقویم
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Content & Metrics Modal (FR-MKT-05) */}
      <Modal
        open={Boolean(editingContent)}
        onClose={() => setEditingContent(null)}
        title="ویرایش محتوا و ثبت شاخص‌های عملکرد (پس از انتشار)"
        maxWidth="md"
      >
        <form onSubmit={handleSaveEditContent} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs text-slate-500">عنوان</label>
            <input
              type="text"
              required
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-slate-500">تعداد بازدید (Reach)</label>
              <input
                type="number"
                min={0}
                value={editReach}
                onChange={(e) => setEditReach(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm tabular-nums dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">تعداد سرنخ / لید جذب‌شده</label>
              <input
                type="number"
                min={0}
                value={editLeads}
                onChange={(e) => setEditLeads(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm tabular-nums dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">رسانه متصل</label>
            <select
              value={editMediaId}
              onChange={(e) => setEditMediaId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="">بدون فایل پیوست</option>
              {state.mediaAssets.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">کپشن / متن انتشار</label>
            <textarea
              rows={3}
              value={editCaption}
              onChange={(e) => setEditCaption(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={editConsent}
              onChange={(e) => setEditConsent(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600"
            />
            دارای رضایت‌نامه کتبی مراجع
          </label>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditingContent(null)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm dark:border-slate-700"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              ذخیره شاخص‌ها
            </button>
          </div>
        </form>
      </Modal>

      {/* Create Campaign Modal */}
      <Modal open={cmpOpen} onClose={() => setCmpOpen(false)} title="ایجاد کمپین هدفمند و تست A/B" maxWidth="lg">
        <form onSubmit={handleCreateCampaign} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-slate-500">نام کمپین *</label>
              <input
                type="text"
                required
                value={cmpName}
                onChange={(e) => setCmpName(e.target.value)}
                placeholder="مثلاً: کمپین زمستانی مشتریان VIP"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block text-slate-500">سگمنت هدف</label>
              <select
                value={cmpSegmentId}
                onChange={(e) => setCmpSegmentId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="">همه مشتریان دارای رضایت</option>
                {state.customerSegments.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-slate-500">کانال ارسال</label>
              <select
                value={cmpChannel}
                onChange={(e) => setCmpChannel(e.target.value as NotificationChannel)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="sms">پیامک (SMS)</option>
                <option value="email">ایمیل</option>
                <option value="push">اعلان Push</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-slate-500">برچسب UTM Campaign</label>
              <input
                type="text"
                dir="ltr"
                value={cmpUtm}
                onChange={(e) => setCmpUtm(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-2 font-medium">
            <input
              type="checkbox"
              checked={cmpAbEnabled}
              onChange={(e) => setCmpAbEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600"
            />
            فعال‌سازی تست A/B (تقسیم ۵۰/۵۰ مخاطبان بین دو متن پیام)
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
              <div className="font-semibold text-indigo-600">نسخه A</div>
              <input
                type="text"
                value={cmpSubjA}
                onChange={(e) => setCmpSubjA(e.target.value)}
                placeholder="عنوان نسخه A"
                className="w-full rounded border border-slate-200 bg-white px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-800"
              />
              <textarea
                rows={3}
                value={cmpBodyA}
                onChange={(e) => setCmpBodyA(e.target.value)}
                className="w-full rounded border border-slate-200 bg-white px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            {cmpAbEnabled && (
              <div className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                <div className="font-semibold text-emerald-600">نسخه B</div>
                <input
                  type="text"
                  value={cmpSubjB}
                  onChange={(e) => setCmpSubjB(e.target.value)}
                  placeholder="عنوان نسخه B"
                  className="w-full rounded border border-slate-200 bg-white px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-800"
                />
                <textarea
                  rows={3}
                  value={cmpBodyB}
                  onChange={(e) => setCmpBodyB(e.target.value)}
                  className="w-full rounded border border-slate-200 bg-white px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setCmpOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm dark:border-slate-700"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              ثبت کمپین
            </button>
          </div>
        </form>
      </Modal>

      {/* Media Upload Modal */}
      <Modal open={mediaOpen} onClose={() => setMediaOpen(false)} title="افزودن فایل به کتابخانه رسانه" maxWidth="md">
        <form onSubmit={handleCreateMedia} className="space-y-4 text-xs">
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 p-4 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800/40">
            <Upload size={20} className="text-indigo-600" />
            <span>انتخاب فایل از سیستم (تصویر، ویدیو یا PDF)</span>
            <input type="file" onChange={handleMediaFileUpload} className="hidden" />
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-slate-500">نام فایل *</label>
              <input
                type="text"
                required
                value={medName}
                onChange={(e) => setMedName(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block text-slate-500">پوشه</label>
              <input
                type="text"
                value={medFolder}
                onChange={(e) => setMedFolder(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block text-slate-500">نوع فایل</label>
              <select
                value={medType}
                onChange={(e) => setMedType(e.target.value as MediaAsset['type'])}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="image">تصویر</option>
                <option value="video">ویدیو</option>
                <option value="pdf">سند PDF</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-slate-500">برچسب‌ها (با کاما)</label>
              <input
                type="text"
                value={medTags}
                onChange={(e) => setMedTags(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-slate-500">آدرس لینک (اختیاری در صورت عدم آپلود)</label>
            <input
              type="text"
              dir="ltr"
              value={medUrl}
              onChange={(e) => setMedUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={medConsent}
              onChange={(e) => setMedConsent(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600"
            />
            دارای رضایت‌نامه کتبی مراجع/مدل جهت انتشار عمومی
          </label>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setMediaOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm dark:border-slate-700"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              ذخیره در کتابخانه
            </button>
          </div>
        </form>
      </Modal>

      {/* Create Landing Form Modal */}
      <Modal open={formOpen} onClose={() => setFormOpen(false)} title="ساخت فرم فرود و ردیابی UTM" maxWidth="md">
        <form onSubmit={handleCreateForm} className="space-y-4 text-xs">
          <div>
            <label className="mb-1 block text-slate-500">عنوان فرم *</label>
            <input
              type="text"
              required
              value={lfTitle}
              onChange={(e) => setLfTitle(e.target.value)}
              placeholder="مثلاً: فرم دریافت کاتالوگ و تخفیف اولین سفارش"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-slate-500">اسلاگ آدرس (Slug)</label>
              <input
                type="text"
                dir="ltr"
                value={lfSlug}
                onChange={(e) => setLfSlug(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block text-slate-500">منبع ثبت‌شده در CRM</label>
              <input
                type="text"
                value={lfSource}
                onChange={(e) => setLfSource(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block text-slate-500">utm_source</label>
              <input
                type="text"
                dir="ltr"
                value={lfUtmSource}
                onChange={(e) => setLfUtmSource(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block text-slate-500">utm_medium</label>
              <input
                type="text"
                dir="ltr"
                value={lfUtmMedium}
                onChange={(e) => setLfUtmMedium(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block text-slate-500">utm_campaign</label>
              <input
                type="text"
                dir="ltr"
                value={lfUtmCampaign}
                onChange={(e) => setLfUtmCampaign(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block text-slate-500">چرخه عمر پیش‌فرض</label>
              <select
                value={lfLifecycle}
                onChange={(e) => setLfLifecycle(e.target.value as CustomerLifecycle)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="lead">سرنخ (Lead)</option>
                <option value="active">فعال</option>
              </select>
            </div>
          </div>
          <div>
            <div className="mb-1.5 text-slate-500">فیلدهای فعال فرم</div>
            <div className="flex flex-wrap gap-3">
              {(Object.keys(FORM_FIELD_LABELS) as LandingFormFieldKey[]).map((fk) => {
                const locked = fk === 'name' || fk === 'phone';
                const checked = lfFields.includes(fk);
                return (
                  <label key={fk} className="flex cursor-pointer items-center gap-1.5">
                    <input
                      type="checkbox"
                      disabled={locked}
                      checked={checked}
                      onChange={() =>
                        setLfFields((prev) =>
                          prev.includes(fk) ? prev.filter((x) => x !== fk) : [...prev, fk],
                        )
                      }
                      className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600"
                    />
                    <span>{FORM_FIELD_LABELS[fk]}</span>
                  </label>
                );
              })}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm dark:border-slate-700"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              ایجاد فرم فرود
            </button>
          </div>
        </form>
      </Modal>

      {/* Live Landing Form Simulator Modal */}
      <Modal
        open={Boolean(previewForm)}
        onClose={() => setPreviewForm(null)}
        title={previewForm?.title ?? 'پیش‌نمایش فرم فرود'}
        maxWidth="md"
      >
        {previewForm && (
          <form onSubmit={handleSimulateSubmitForm} className="space-y-4">
            <div
              dir="ltr"
              className="rounded-lg bg-indigo-50 px-3 py-2 font-mono text-[11px] text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300"
            >
              UTM: {previewForm.utmSource} / {previewForm.utmMedium} / {previewForm.utmCampaign}
            </div>
            {simError && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
                {simError}
              </div>
            )}
            {previewForm.fields.includes('name') && (
              <div>
                <label className="mb-1 block text-xs text-slate-500">نام و نام خانوادگی *</label>
                <input
                  type="text"
                  required
                  value={simName}
                  onChange={(e) => setSimName(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
            )}
            {previewForm.fields.includes('phone') && (
              <div>
                <label className="mb-1 block text-xs text-slate-500">شماره موبایل *</label>
                <input
                  type="text"
                  required
                  dir="ltr"
                  value={simPhone}
                  onChange={(e) => setSimPhone(e.target.value)}
                  placeholder="09123456789"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
            )}
            {previewForm.fields.includes('email') && (
              <div>
                <label className="mb-1 block text-xs text-slate-500">ایمیل</label>
                <input
                  type="email"
                  dir="ltr"
                  value={simEmail}
                  onChange={(e) => setSimEmail(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
            )}
            {previewForm.fields.includes('companyName') && (
              <div>
                <label className="mb-1 block text-xs text-slate-500">نام شرکت / مجموعه</label>
                <input
                  type="text"
                  value={simCompany}
                  onChange={(e) => setSimCompany(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
            )}
            {previewForm.fields.includes('notes') && (
              <div>
                <label className="mb-1 block text-xs text-slate-500">توضیحات / درخواست</label>
                <textarea
                  rows={2}
                  value={simNotes}
                  onChange={(e) => setSimNotes(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPreviewForm(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm dark:border-slate-700"
              >
                بستن
              </button>
              <button
                type="submit"
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                ثبت فرم و ذخیره UtmTouch
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
