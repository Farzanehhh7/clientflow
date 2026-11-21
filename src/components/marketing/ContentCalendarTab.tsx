import { useMemo, useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  Edit3,
  Plus,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Trophy,
} from 'lucide-react';
import { Modal } from '../Modal';
import { JalaliDatePicker } from '../ui/JalaliDatePicker';
import { generateContentCalendarIdeas, type AiContentIdea } from '../../services/aiService';
import { useClientFlow } from '../../store/useClientFlowStore';
import type { ContentItem, ContentStatus } from '../../types';
import {
  formatJalali,
  getTodayJalaliAscii,
  isoToJalaliInput,
  jalaliToIsoUtc,
  toFa,
} from '../../utils/jalali';

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
  blog: 'بلاگ',
};

const FORMAT_LABEL: Record<ContentItem['format'], string> = {
  post: 'پست',
  reel: 'ریلز',
  story: 'استوری',
  article: 'مقاله',
};

export function ContentCalendarTab() {
  const { state, addContentItem, updateContentStatus, updateContentItem, logAiUsage } = useClientFlow();

  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [platform, setPlatform] = useState<ContentItem['platform']>('instagram');
  const [format, setFormat] = useState<ContentItem['format']>('reel');
  const [assignee, setAssignee] = useState('نگار (محتوا)');
  const [scheduleJalali, setScheduleJalali] = useState(() => getTodayJalaliAscii());
  const [hasConsent, setHasConsent] = useState(false);
  const [mediaAssetId, setMediaAssetId] = useState('');

  // Edit Content + Metrics Modal
  const [editing, setEditing] = useState<ContentItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editPlatform, setEditPlatform] = useState<ContentItem['platform']>('instagram');
  const [editFormat, setEditFormat] = useState<ContentItem['format']>('post');
  const [editAssignee, setEditAssignee] = useState('');
  const [editScheduleJalali, setEditScheduleJalali] = useState('');
  const [editCaption, setEditCaption] = useState('');
  const [editReach, setEditReach] = useState(0);
  const [editEngagement, setEditEngagement] = useState(0);
  const [editLeads, setEditLeads] = useState(0);
  const [editConsent, setEditConsent] = useState(false);
  const [editMediaId, setEditMediaId] = useState('');

  const [topMetricSort, setTopMetricSort] = useState<'engagement' | 'reach' | 'leads'>(
    'engagement',
  );

  // AI Content Idea Generator
  const [aiIdeasOpen, setAiIdeasOpen] = useState(false);
  const [aiTopic, setAiTopic] = useState('معرفی خدمات ویژه و تجربه مشتریان');
  const [aiIdeasLoading, setAiIdeasLoading] = useState(false);
  const [aiIdeas, setAiIdeas] = useState<AiContentIdea[]>([]);
  const [aiIdeasMeta, setAiIdeasMeta] = useState('');
  const [aiIdeasError, setAiIdeasError] = useState('');

  const openEditModal = (item: ContentItem) => {
    setEditing(item);
    setEditTitle(item.title);
    setEditPlatform(item.platform);
    setEditFormat(item.format);
    setEditAssignee(item.assignee);
    setEditScheduleJalali(isoToJalaliInput(item.scheduledAt) || getTodayJalaliAscii());
    setEditCaption(item.caption ?? '');
    setEditReach(item.reach);
    setEditEngagement(item.engagement ?? 0);
    setEditLeads(item.leadsCount);
    setEditConsent(Boolean(item.hasBeforeAfterConsent));
    setEditMediaId(item.mediaAssetId ?? '');
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const scheduledAt = jalaliToIsoUtc(scheduleJalali) ?? new Date().toISOString();
    addContentItem({
      title: title.trim(),
      platform,
      format,
      status: 'idea',
      scheduledAt,
      assignee: assignee.trim() || 'تیم محتوا',
      hasBeforeAfterConsent: hasConsent,
      mediaAssetId: mediaAssetId || undefined,
    });
    setTitle('');
    setHasConsent(false);
    setMediaAssetId('');
    setCreateOpen(false);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    updateContentItem(editing.id, {
      title: editTitle.trim() || editing.title,
      platform: editPlatform,
      format: editFormat,
      assignee: editAssignee.trim() || editing.assignee,
      scheduledAt: jalaliToIsoUtc(editScheduleJalali) ?? editing.scheduledAt,
      caption: editCaption,
      reach: Math.max(0, editReach),
      engagement: Math.max(0, editEngagement),
      leadsCount: Math.max(0, editLeads),
      hasBeforeAfterConsent: editConsent,
      mediaAssetId: editMediaId || undefined,
    });
    setEditing(null);
  };

  const topContent = useMemo(() => {
    const published = state.contentItems.filter((c) => c.status === 'published');
    return [...published].sort((a, b) => {
      if (topMetricSort === 'reach') return b.reach - a.reach;
      if (topMetricSort === 'leads') return b.leadsCount - a.leadsCount;
      return (b.engagement ?? 0) - (a.engagement ?? 0);
    });
  }, [state.contentItems, topMetricSort]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            تقویم محتوا (ایده تا انتشار) و گزارش برترین محتواها
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            مدیریت تولید محتوای اینستاگرام، وب‌سایت و بلاگ به همراه ثبت رضایت‌نامه انتشار و شاخص‌های نتیجه
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {state.settings.ai?.enabled !== false && (
            <button
              type="button"
              onClick={() => setAiIdeasOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-xs font-medium text-indigo-700 hover:bg-indigo-100 dark:border-indigo-900/50 dark:bg-indigo-950/40 dark:text-indigo-300"
            >
              <Sparkles size={15} />
              ایده‌پرداز هوشمند تقویم محتوا (AI)
            </button>
          )}
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-indigo-700"
          >
            <Plus size={15} />
            ایده / محتوای جدید
          </button>
        </div>
      </div>

      {/* 5-Stage Content Kanban */}
      <div className="grid gap-3 md:grid-cols-5">
        {CONTENT_STAGES.map((stage) => {
          const stageItems = state.contentItems.filter((c) => c.status === stage.key);
          const stageIdx = CONTENT_STAGES.findIndex((s) => s.key === stage.key);
          const nextStage = CONTENT_STAGES[stageIdx + 1];

          return (
            <div
              key={stage.key}
              className="flex flex-col rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/60"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {stage.label}
                </span>
                <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold tabular-nums text-slate-600 shadow-xs dark:bg-slate-800 dark:text-slate-300">
                  {toFa(stageItems.length)}
                </span>
              </div>

              <div className="space-y-2.5">
                {stageItems.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-200 py-6 text-center text-[11px] text-slate-400 dark:border-slate-800">
                    خالی
                  </div>
                ) : (
                  stageItems.map((item) => {
                    const eng = item.engagement ?? 0;
                    const linkedAsset = state.mediaAssets.find((m) => m.id === item.mediaAssetId);
                    return (
                      <div
                        key={item.id}
                        className="rounded-lg border border-slate-200 bg-white p-3 shadow-xs dark:border-slate-800 dark:bg-slate-900"
                      >
                        <div className="flex items-start justify-between gap-1.5">
                          <h4 className="text-xs font-semibold text-slate-900 dark:text-white leading-snug">
                            {item.title}
                          </h4>
                          <button
                            type="button"
                            onClick={() => openEditModal(item)}
                            title="ویرایش و ثبت آمار"
                            className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 dark:hover:bg-slate-800"
                          >
                            <Edit3 size={13} />
                          </button>
                        </div>

                        <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
                          <span className="rounded bg-indigo-50 px-1.5 py-0.5 font-medium text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                            {PLATFORM_LABEL[item.platform]}
                          </span>
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            {FORMAT_LABEL[item.format]}
                          </span>
                        </div>

                        <div className="mt-2 space-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                          <div className="flex items-center gap-1">
                            <Calendar size={11} />
                            <span className="tabular-nums">{formatJalali(item.scheduledAt)}</span>
                          </div>
                          <div>مسئول: {item.assignee}</div>
                          {linkedAsset && (
                            <div className="truncate text-[10px] text-indigo-500">
                              فایل: {linkedAsset.name}
                            </div>
                          )}
                        </div>

                        {/* Consent badge */}
                        <div className="mt-2">
                          {item.hasBeforeAfterConsent ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 size={11} />
                              دارای رضایت‌نامه انتشار
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
                              <ShieldAlert size={11} />
                              بدون تیک رضایت انتشار
                            </span>
                          )}
                        </div>

                        {item.status === 'published' && (
                          <div className="mt-2 grid grid-cols-3 gap-1 rounded bg-slate-50 p-1.5 text-center text-[10px] tabular-nums dark:bg-slate-800/60">
                            <div>
                              <div className="text-slate-400">بازدید</div>
                              <div className="font-semibold">{toFa(item.reach)}</div>
                            </div>
                            <div>
                              <div className="text-slate-400">تعامل</div>
                              <div className="font-semibold text-indigo-600 dark:text-indigo-400">
                                {toFa(eng)}
                              </div>
                            </div>
                            <div>
                              <div className="text-slate-400">لید</div>
                              <div className="font-semibold text-emerald-600 dark:text-emerald-400">
                                {toFa(item.leadsCount)}
                              </div>
                            </div>
                          </div>
                        )}

                        {nextStage && (
                          <button
                            type="button"
                            onClick={() => updateContentStatus(item.id, nextStage.key)}
                            className="mt-2.5 w-full rounded-md border border-slate-200 py-1 text-[11px] font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                          >
                            انتقال به «{nextStage.label}»
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Top Content Report */}
      <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
            <Trophy size={16} className="text-amber-500" />
            گزارش برترین محتواهای منتشرشده (Top Content)
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-500">مرتب‌سازی بر اساس:</span>
            {(
              [
                { k: 'engagement', label: 'تعامل (Engagement)' },
                { k: 'reach', label: 'بازدید (Reach)' },
                { k: 'leads', label: 'سرنخ (Leads)' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.k}
                type="button"
                onClick={() => setTopMetricSort(opt.k)}
                className={`rounded-lg px-2.5 py-1 font-medium ${
                  topMetricSort === opt.k
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 text-slate-600 dark:bg-slate-800/70 dark:text-slate-300">
              <tr>
                <th className="px-4 py-2.5">رتبه</th>
                <th className="px-3 py-2.5">عنوان محتوا</th>
                <th className="px-3 py-2.5">پلتفرم / قالب</th>
                <th className="px-3 py-2.5">مسئول</th>
                <th className="px-3 py-2.5">بازدید (Reach)</th>
                <th className="px-3 py-2.5">تعامل (Engagement)</th>
                <th className="px-3 py-2.5">نرخ تعامل</th>
                <th className="px-3 py-2.5">تعداد لید</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {topContent.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
                    هنوز محتوایی در وضعیت «منتشرشده» ثبت نشده است.
                  </td>
                </tr>
              ) : (
                topContent.map((c, idx) => {
                  const eng = c.engagement ?? 0;
                  const er = c.reach > 0 ? Math.round((eng / c.reach) * 1000) / 10 : 0;
                  return (
                    <tr key={c.id}>
                      <td className="px-4 py-2.5 font-bold tabular-nums text-indigo-600 dark:text-indigo-400">
                        #{toFa(idx + 1)}
                      </td>
                      <td className="px-3 py-2.5 font-medium text-slate-900 dark:text-white">
                        {c.title}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {PLATFORM_LABEL[c.platform]} • {FORMAT_LABEL[c.format]}
                      </td>
                      <td className="px-3 py-2.5">{c.assignee}</td>
                      <td className="px-3 py-2.5 tabular-nums">{toFa(c.reach)}</td>
                      <td className="px-3 py-2.5 tabular-nums font-semibold text-indigo-600 dark:text-indigo-400">
                        {toFa(eng)}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums">
                        <span className="inline-flex items-center gap-1">
                          <TrendingUp size={12} className="text-emerald-500" />
                          {toFa(er)}٪
                        </span>
                      </td>
                      <td className="px-3 py-2.5 tabular-nums font-bold text-emerald-600 dark:text-emerald-400">
                        {toFa(c.leadsCount)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Content Modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="ثبت محتوای جدید در تقویم"
        maxWidth="md"
      >
        <form onSubmit={handleCreate} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium">عنوان محتوا *</label>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثلاً ریلز نکات مراقبت فصلی"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium">پلتفرم</label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value as ContentItem['platform'])}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="instagram">اینستاگرام</option>
                <option value="site">وب‌سایت</option>
                <option value="blog">بلاگ</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">نوع پست</label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as ContentItem['format'])}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="post">پست</option>
                <option value="reel">ریلز</option>
                <option value="story">استوری</option>
                <option value="article">مقاله</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium">مسئول تولید</label>
              <input
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <JalaliDatePicker
              label="تاریخ برنامه‌ریزی (جلالی)"
              value={scheduleJalali}
              onChange={setScheduleJalali}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">فایل مرتبط از کتابخانه دارایی‌ها</label>
            <select
              value={mediaAssetId}
              onChange={(e) => setMediaAssetId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="">بدون فایل پیوست</option>
              {state.mediaAssets.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} {m.hasModelConsent ? '(دارای رضایت‌نامه)' : '(بدون رضایت‌نامه)'}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={hasConsent}
              onChange={(e) => setHasConsent(e.target.checked)}
            />
            تایید رضایت‌نامه کتبی/قانونی مشتری برای انتشار تصویر
          </label>
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
              افزودن به تقویم
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Content & Metrics Modal */}
      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title="ویرایش محتوا و ثبت آمار نتیجه"
        maxWidth="lg"
      >
        <form onSubmit={handleSaveEdit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium">عنوان</label>
            <input
              required
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium">پلتفرم</label>
              <select
                value={editPlatform}
                onChange={(e) => setEditPlatform(e.target.value as ContentItem['platform'])}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="instagram">اینستاگرام</option>
                <option value="site">وب‌سایت</option>
                <option value="blog">بلاگ</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">قالب</label>
              <select
                value={editFormat}
                onChange={(e) => setEditFormat(e.target.value as ContentItem['format'])}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="post">پست</option>
                <option value="reel">ریلز</option>
                <option value="story">استوری</option>
                <option value="article">مقاله</option>
              </select>
            </div>
            <JalaliDatePicker
              label="تاریخ انتشار"
              value={editScheduleJalali}
              onChange={setEditScheduleJalali}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium">بازدید (Reach)</label>
              <input
                type="number"
                min={0}
                value={editReach}
                onChange={(e) => setEditReach(Number(e.target.value) || 0)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">تعامل (Engagement)</label>
              <input
                type="number"
                min={0}
                value={editEngagement}
                onChange={(e) => setEditEngagement(Number(e.target.value) || 0)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">تعداد لید جذب‌شده</label>
              <input
                type="number"
                min={0}
                value={editLeads}
                onChange={(e) => setEditLeads(Number(e.target.value) || 0)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium">مسئول</label>
              <input
                value={editAssignee}
                onChange={(e) => setEditAssignee(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">فایل مرتبط</label>
              <select
                value={editMediaId}
                onChange={(e) => setEditMediaId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="">بدون فایل</option>
                {state.mediaAssets.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">کپشن / یادداشت محتوا</label>
            <textarea
              rows={2}
              value={editCaption}
              onChange={(e) => setEditCaption(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={editConsent}
              onChange={(e) => setEditConsent(e.target.checked)}
            />
            دارای رضایت‌نامه انتشار قبل و بعد
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs dark:border-slate-700"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700"
            >
              ذخیره تغییرات
            </button>
          </div>
        </form>
      </Modal>

      {/* AI Content Idea Generator Modal */}
      <Modal
        open={aiIdeasOpen}
        onClose={() => setAiIdeasOpen(false)}
        title="ایده‌پرداز هوشمند تقویم محتوا (AI)"
        maxWidth="xl"
      >
        <div className="space-y-4 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={aiTopic}
              onChange={(e) => setAiTopic(e.target.value)}
              placeholder="موضوع یا کمپین فصل (مثلاً مراقبت پوست تابستان، معرفی سرویس جدید)..."
              className="min-w-[220px] flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
            />
            <button
              type="button"
              disabled={aiIdeasLoading || !aiTopic.trim()}
              onClick={async () => {
                setAiIdeasLoading(true);
                setAiIdeasError('');
                const res = await generateContentCalendarIdeas(
                  state,
                  { topic: aiTopic, count: 4 },
                  logAiUsage,
                );
                setAiIdeasLoading(false);
                if (!res.ok) {
                  setAiIdeasError(res.error);
                  return;
                }
                setAiIdeas(res.data);
                setAiIdeasMeta(
                  `تولیدشده با هوش مصنوعی (AI-generated · ${res.meta.mode === 'gemini' ? 'Gemini' : 'Fallback'})`,
                );
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
            >
              <Sparkles size={13} />
              {aiIdeasLoading ? 'در حال ایده‌پردازی...' : 'تولید ۴ ایده محتوا'}
            </button>
          </div>

          {aiIdeasError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
              {aiIdeasError}
            </div>
          )}

          {aiIdeasMeta && (
            <div className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
              {aiIdeasMeta}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {aiIdeas.map((idea, idx) => (
              <div
                key={idx}
                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-800/40"
              >
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                      {PLATFORM_LABEL[idea.platform]}
                    </span>
                    <span className="rounded bg-white px-1.5 py-0.5 text-[10px] text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                      {FORMAT_LABEL[idea.format]}
                    </span>
                  </div>
                  <div className="font-bold text-slate-900 dark:text-white">{idea.title}</div>
                  <div className="text-[11px] text-indigo-600 dark:text-indigo-400">
                    قلاب (Hook): {idea.hook}
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                    {idea.captionOutline}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    addContentItem({
                      title: idea.title,
                      platform: idea.platform,
                      format: idea.format,
                      status: 'idea',
                      scheduledAt: jalaliToIsoUtc(getTodayJalaliAscii()) ?? new Date().toISOString(),
                      assignee: assignee.trim() || 'تیم محتوا',
                      caption: `${idea.hook}\n\n${idea.captionOutline}`,
                      hasBeforeAfterConsent: false,
                    });
                  }}
                  className="mt-3 w-full rounded-lg border border-indigo-200 bg-white py-1.5 font-medium text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:bg-slate-900 dark:text-indigo-300"
                >
                  + افزودن به تقویم (ستون ایده)
                </button>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}
