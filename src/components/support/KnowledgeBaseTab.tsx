import { useMemo, useState } from 'react';
import { BookOpen, Edit3, Eye, History, Lock, Plus, RotateCcw, Search, ThumbsUp } from 'lucide-react';
import { useClientFlow } from '../../store/useClientFlowStore';
import type { KbArticle, KbVisibility } from '../../types';
import { formatJalaliDateTime, toFa } from '../../utils/jalali';
import { fuzzyMatchPersian } from '../../utils/persianSearch';
import { Modal } from '../Modal';

export function KnowledgeBaseTab() {
  const { state, addKbArticle, updateKbArticle, restoreKbVersion, voteKbHelpful } = useClientFlow();

  const [kbQuery, setKbQuery] = useState('');
  const [visFilter, setVisFilter] = useState<'all' | KbVisibility>('all');
  const [catFilter, setCatFilter] = useState<string>('all');

  const [kbCreateOpen, setKbCreateOpen] = useState(false);
  const [editingKb, setEditingKb] = useState<KbArticle | null>(null);
  const [historyKb, setHistoryKb] = useState<KbArticle | null>(null);

  const [kbTitle, setKbTitle] = useState('');
  const [kbCategory, setKbCategory] = useState('نوبت‌دهی و پذیرش');
  const [kbVisibility, setKbVisibility] = useState<KbVisibility>('public');
  const [kbBody, setKbBody] = useState('');
  const [kbChangeNote, setKbChangeNote] = useState('');

  const categories = useMemo(
    () => Array.from(new Set(state.kbArticles.map((a) => a.category))),
    [state.kbArticles],
  );

  const filteredKb = useMemo(() => {
    return state.kbArticles.filter((a) => {
      const vis = a.visibility ?? 'public';
      if (visFilter !== 'all' && vis !== visFilter) return false;
      if (catFilter !== 'all' && a.category !== catFilter) return false;
      if (kbQuery.trim() && !fuzzyMatchPersian([a.title, a.body, a.category], kbQuery)) return false;
      return true;
    });
  }, [state.kbArticles, visFilter, catFilter, kbQuery]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!kbTitle.trim() || !kbBody.trim()) return;
    if (editingKb) {
      updateKbArticle(editingKb.id, {
        title: kbTitle,
        category: kbCategory,
        visibility: kbVisibility,
        body: kbBody,
        changeNote: kbChangeNote,
      });
    } else {
      addKbArticle({
        title: kbTitle.trim(),
        category: kbCategory.trim() || 'عمومی',
        visibility: kbVisibility,
        body: kbBody.trim(),
      });
    }
    setKbTitle('');
    setKbBody('');
    setKbChangeNote('');
    setKbVisibility('public');
    setEditingKb(null);
    setKbCreateOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-64">
            <Search size={15} className="absolute right-3 top-2.5 text-slate-400" />
            <input
              value={kbQuery}
              onChange={(e) => setKbQuery(e.target.value)}
              placeholder="جستجو در مقالات پایگاه دانش..."
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-9 text-xs dark:border-slate-700 dark:bg-slate-900"
            />
          </div>

          <select
            aria-label="فیلتر سطح دسترسی"
            value={visFilter}
            onChange={(e) => setVisFilter(e.target.value as 'all' | KbVisibility)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900"
          >
            <option value="all">همه دسترسی‌ها</option>
            <option value="public">عمومی (پورتال مشتری)</option>
            <option value="internal">داخلی کارشناسان</option>
          </select>

          <select
            aria-label="فیلتر دسته‌بندی"
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900"
          >
            <option value="all">همه دسته‌ها</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={() => {
            setEditingKb(null);
            setKbTitle('');
            setKbCategory('نوبت‌دهی و پذیرش');
            setKbVisibility('public');
            setKbBody('');
            setKbCreateOpen(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-indigo-700"
        >
          <Plus size={15} />
          مقاله جدید
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {filteredKb.map((art) => {
          const isInternal = art.visibility === 'internal';
          return (
            <div
              key={art.id}
              className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
            >
              <div>
                <div className="mb-2 flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 font-medium text-indigo-600 dark:text-indigo-400">
                      <BookOpen size={13} />
                      {art.category}
                    </span>
                    <span className="text-slate-300 dark:text-slate-700">|</span>
                    <span
                      className={`inline-flex items-center gap-1 font-medium ${
                        isInternal ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {isInternal ? <Lock size={11} /> : <Eye size={11} />}
                      {isInternal ? 'داخلی کارشناسان' : 'عمومی'}
                    </span>
                  </div>
                  <span className="tabular-nums text-[11px] text-slate-400">
                    نسخه {toFa(art.version ?? 1)} · {formatJalaliDateTime(art.updatedAt)}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{art.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{art.body}</p>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => voteKbHelpful(art.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <ThumbsUp size={13} />
                  مفید بود ({toFa(art.helpfulCount)})
                </button>
                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setHistoryKb(art)}
                    className="inline-flex items-center gap-1 text-slate-600 hover:underline dark:text-slate-300"
                  >
                    <History size={13} />
                    تاریخچه ({toFa(art.versions?.length ?? 1)})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingKb(art);
                      setKbTitle(art.title);
                      setKbCategory(art.category);
                      setKbVisibility(art.visibility ?? 'public');
                      setKbBody(art.body);
                      setKbChangeNote('');
                      setKbCreateOpen(true);
                    }}
                    className="inline-flex items-center gap-1 text-indigo-600 hover:underline dark:text-indigo-400"
                  >
                    <Edit3 size={13} />
                    ویرایش
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create / Edit KB Modal */}
      <Modal
        open={kbCreateOpen}
        onClose={() => setKbCreateOpen(false)}
        title={editingKb ? 'ویرایش مقاله و ثبت نسخه جدید' : 'ثبت مقاله جدید در پایگاه دانش'}
        maxWidth="md"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium">عنوان مقاله</label>
            <input
              required
              value={kbTitle}
              onChange={(e) => setKbTitle(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium">دسته‌بندی</label>
              <input
                value={kbCategory}
                onChange={(e) => setKbCategory(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">سطح دسترسی</label>
              <select
                value={kbVisibility}
                onChange={(e) => setKbVisibility(e.target.value as KbVisibility)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="public">عمومی (قابل مشاهده در پورتال مشتری)</option>
                <option value="internal">داخلی (فقط کارشناسان پشتیبانی)</option>
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">متن راهنما</label>
            <textarea
              required
              rows={4}
              value={kbBody}
              onChange={(e) => setKbBody(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          {editingKb && (
            <div>
              <label className="mb-1 block text-xs font-medium">توضیح تغییر نسخه (Change Note)</label>
              <input
                value={kbChangeNote}
                onChange={(e) => setKbChangeNote(e.target.value)}
                placeholder="مثلاً: به‌روزرسانی بازه زمانی ارسال"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setKbCreateOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium dark:border-slate-700"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700"
            >
              {editingKb ? 'ذخیره نسخه جدید' : 'ثبت مقاله'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Version History Modal */}
      <Modal
        open={Boolean(historyKb)}
        onClose={() => setHistoryKb(null)}
        title={`تاریخچه نسخه‌های مقاله: ${historyKb?.title ?? ''}`}
        maxWidth="lg"
      >
        {historyKb && (
          <div className="space-y-3">
            {(historyKb.versions ?? [
              {
                version: 1,
                title: historyKb.title,
                category: historyKb.category,
                body: historyKb.body,
                visibility: historyKb.visibility ?? 'public',
                updatedAt: historyKb.updatedAt,
                editor: 'مدیر سیستم',
                changeNote: 'نسخه فعلی',
              },
            ])
              .slice()
              .reverse()
              .map((v) => (
                <div
                  key={v.version}
                  className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 text-xs dark:border-slate-800 dark:bg-slate-800/40"
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="font-bold text-indigo-600 dark:text-indigo-400">
                      نسخه {toFa(v.version)} — {v.changeNote || 'بدون یادداشت'}
                    </span>
                    <span className="tabular-nums text-slate-400">
                      {v.editor} · {formatJalaliDateTime(v.updatedAt)}
                    </span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300">{v.body}</p>
                  {v.version !== (historyKb.version ?? 1) && (
                    <button
                      type="button"
                      onClick={() => {
                        restoreKbVersion(historyKb.id, v.version);
                        setHistoryKb(null);
                      }}
                      className="mt-2 inline-flex items-center gap-1 text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                      <RotateCcw size={12} />
                      بازگردانی به این نسخه
                    </button>
                  )}
                </div>
              ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
