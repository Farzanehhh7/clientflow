import { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { Plus } from 'lucide-react';
import { Modal } from '../components/Modal';
import { useClientFlow } from '../store/useClientFlowStore';
import type { ContentItem, ContentStatus } from '../types';
import { formatJalali, toFa } from '../utils/jalali';

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

export function MarketingPage() {
  const { state, addContentItem, updateContentStatus } = useClientFlow();
  const [createOpen, setCreateOpen] = useState(false);

  const [title, setTitle] = useState('');
  const [platform, setPlatform] = useState<ContentItem['platform']>('instagram');
  const [format, setFormat] = useState<ContentItem['format']>('reel');
  const [assignee, setAssignee] = useState('نگار (محتوا)');
  const [daysAhead, setDaysAhead] = useState(2);
  const [hasConsent, setHasConsent] = useState(false);

  const sourceStats = useMemo(() => {
    const counts = new Map<string, number>();
    state.customers.forEach((c) => {
      const src = c.source || 'سایر';
      counts.set(src, (counts.get(src) ?? 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [state.customers]);

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
    });
    setTitle('');
    setCreateOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          برنامه‌ریزی تولید محتوا (پست، ریلز، استوری، مقاله) + کنترل رضایت‌نامه تصاویر قبل/بعد + آمار منابع جذب مشتری
        </p>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700"
        >
          <Plus size={16} />
          محتوای جدید
        </button>
      </div>

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
                  items.map((item) => (
                    <div
                      key={item.id}
                      className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/70 p-2.5 text-xs dark:border-slate-800 dark:bg-slate-800/40"
                    >
                      <div className="font-semibold text-slate-900 dark:text-slate-100">{item.title}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {PLATFORM_LABEL[item.platform]} · {FORMAT_LABEL[item.format]} · {item.assignee}
                      </div>
                      <div className="text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
                        موعد انتشار: {formatJalali(item.scheduledAt)}
                      </div>
                      {item.hasBeforeAfterConsent && (
                        <div className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                          دارای رضایت‌نامه کتبی تصویر
                        </div>
                      )}
                      {item.status === 'published' && (
                        <div className="text-[11px] tabular-nums text-indigo-600 dark:text-indigo-400">
                          بازدید: {toFa(item.reach)} · لید: {toFa(item.leadsCount)}
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
                  ))
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
    </div>
  );
}
