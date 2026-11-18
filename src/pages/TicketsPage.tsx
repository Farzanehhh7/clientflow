import { useMemo, useState } from 'react';
import { BookOpen, GitBranch, Plus, Search, ThumbsUp } from 'lucide-react';
import { Modal } from '../components/Modal';
import { useClientFlow } from '../store/useClientFlowStore';
import type { Ticket } from '../types';
import { formatJalaliDateTime, toFa } from '../utils/jalali';

const PRIORITY_LABEL: Record<Ticket['priority'], string> = {
  low: 'کم',
  normal: 'عادی',
  high: 'فوری',
};

const PRIORITY_COLOR: Record<Ticket['priority'], string> = {
  low: 'text-slate-500 dark:text-slate-400',
  normal: 'text-sky-600 dark:text-sky-400',
  high: 'text-rose-600 dark:text-rose-400',
};

const STATUS_LABEL: Record<Ticket['status'], string> = {
  open: 'باز',
  pending: 'در انتظار پاسخ',
  resolved: 'حل‌شده',
};

const CANNED_RESPONSES = [
  'سلام و احترام؛ درخواست شما بررسی و زمان نوبت مطابق درخواست به‌روزرسانی شد.',
  'بسته شما تحویل شرکت پست شده و کد رهگیری به‌زودی پیامک می‌شود.',
  'پوزش بابت تأخیر پیش‌آمده؛ کد تخفیف جبرانی برای خرید بعدی شما فعال گردید.',
  'لطفاً تا ۲۴ ساعت پس از پروسیجر از کرم ترمیم‌کننده و ضدآفتاب استفاده نمایید.',
];

export function TicketsPage() {
  const { state, addTicket, updateTicket, addKbArticle, voteKbHelpful, createWorkflowInstance } =
    useClientFlow();
  const [tab, setTab] = useState<'tickets' | 'kb'>('tickets');
  const [statusFilter, setStatusFilter] = useState<'all' | Ticket['status']>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [replyTarget, setReplyTarget] = useState<Ticket | null>(null);

  const [customerId, setCustomerId] = useState(state.customers[0]?.id ?? '');
  const [subject, setSubject] = useState('');
  const [priority, setPriority] = useState<Ticket['priority']>('normal');
  const [replyNote, setReplyNote] = useState('');

  // KB state
  const [kbQuery, setKbQuery] = useState('');
  const [kbCreateOpen, setKbCreateOpen] = useState(false);
  const [kbTitle, setKbTitle] = useState('');
  const [kbCategory, setKbCategory] = useState('نوبت‌دهی و پذیرش');
  const [kbBody, setKbBody] = useState('');

  const nowMs = Date.now();

  const filtered = useMemo(() => {
    return state.tickets.filter((t) => statusFilter === 'all' || t.status === statusFilter);
  }, [state.tickets, statusFilter]);

  const filteredKb = useMemo(() => {
    const q = kbQuery.trim().toLowerCase();
    if (!q) return state.kbArticles;
    return state.kbArticles.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.body.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q),
    );
  }, [state.kbArticles, kbQuery]);

  const isSlaBreached = (t: Ticket) => {
    if (t.status === 'resolved') return false;
    const ageH = (nowMs - new Date(t.createdAt).getTime()) / 3600_000;
    return (t.priority === 'high' && ageH >= 4) || (t.priority === 'normal' && ageH >= 24);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) return;
    addTicket({ customerId, subject, priority });
    setSubject('');
    setPriority('normal');
    setCreateOpen(false);
  };

  const handleSaveReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyTarget) return;
    updateTicket(replyTarget.id, {
      replyNote: replyNote.trim() || undefined,
      status: 'resolved',
    });
    setReplyTarget(null);
    setReplyNote('');
  };

  const handleCreateKb = (e: React.FormEvent) => {
    e.preventDefault();
    if (!kbTitle.trim() || !kbBody.trim()) return;
    addKbArticle({ title: kbTitle.trim(), category: kbCategory, body: kbBody.trim() });
    setKbTitle('');
    setKbBody('');
    setKbCreateOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => setTab('tickets')}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === 'tickets'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            تیکت‌های پشتیبانی ({toFa(state.tickets.length)})
          </button>
          <button
            type="button"
            onClick={() => setTab('kb')}
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === 'kb'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <BookOpen size={14} />
            پایگاه دانش ({toFa(state.kbArticles.length)})
          </button>
        </div>

        <button
          type="button"
          onClick={() => (tab === 'tickets' ? setCreateOpen(true) : setKbCreateOpen(true))}
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700"
        >
          <Plus size={16} />
          {tab === 'tickets' ? 'ثبت تیکت جدید' : 'افزودن مقاله دانش'}
        </button>
      </div>

      {tab === 'tickets' ? (
        <>
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 w-fit dark:bg-slate-900">
            {(
              [
                ['all', 'همه'],
                ['open', 'باز'],
                ['pending', 'در انتظار'],
                ['resolved', 'حل‌شده'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setStatusFilter(key)}
                className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  statusFilter === key
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead className="border-b border-slate-200 bg-slate-50/70 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">موضوع و SLA</th>
                    <th className="px-4 py-3 font-medium">مشتری</th>
                    <th className="px-4 py-3 font-medium">اولویت</th>
                    <th className="px-4 py-3 font-medium">وضعیت</th>
                    <th className="px-4 py-3 font-medium">تاریخ ثبت</th>
                    <th className="px-4 py-3 font-medium text-left">اقدام</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filtered.map((t) => {
                    const cust = state.customers.find((c) => c.id === t.customerId);
                    const breached = isSlaBreached(t);
                    return (
                      <tr key={t.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900 dark:text-slate-100">{t.subject}</div>
                          {breached && (
                            <div className="mt-0.5 text-xs font-medium text-rose-600 dark:text-rose-400">
                              نقض مهلت پاسخگویی (SLA)
                            </div>
                          )}
                          {t.replyNote && (
                            <div className="mt-0.5 text-xs text-emerald-700 dark:text-emerald-400">
                              پاسخ: {t.replyNote}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                          {cust?.name ?? 'مشتری'}
                          {cust && <span className="mr-1.5 text-slate-400 tabular-nums">· {toFa(cust.phone)}</span>}
                        </td>
                        <td className={`px-4 py-3 text-xs font-medium ${PRIORITY_COLOR[t.priority]}`}>
                          {PRIORITY_LABEL[t.priority]}
                        </td>
                        <td className="px-4 py-3">
                          <select
                            aria-label="وضعیت تیکت"
                            value={t.status}
                            onChange={(e) =>
                              updateTicket(t.id, { status: e.target.value as Ticket['status'] })
                            }
                            className="rounded border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
                          >
                            <option value="open">{STATUS_LABEL.open}</option>
                            <option value="pending">{STATUS_LABEL.pending}</option>
                            <option value="resolved">{STATUS_LABEL.resolved}</option>
                          </select>
                        </td>
                        <td className="px-4 py-3 text-xs tabular-nums text-slate-500 dark:text-slate-400">
                          {formatJalaliDateTime(t.createdAt)}
                        </td>
                        <td className="px-4 py-3 text-left">
                          <div className="flex items-center justify-end gap-1.5">
                            {t.status !== 'resolved' && (
                              <button
                                type="button"
                                onClick={() =>
                                  createWorkflowInstance({
                                    title: `رسیدگی به شکایت تیکت: ${t.subject}`,
                                    type: 'complaint',
                                    customerId: t.customerId,
                                    relatedRef: t.id,
                                  })
                                }
                                title="ایجاد گردش کار رسیدگی به شکایت"
                                className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                              >
                                <GitBranch size={13} />
                                گردش کار
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setReplyTarget(t);
                                setReplyNote(t.replyNote ?? '');
                              }}
                              className="rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                              پاسخ و بستن
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
        </>
      ) : (
        <div className="space-y-4">
          <div className="relative max-w-md">
            <Search size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={kbQuery}
              onChange={(e) => setKbQuery(e.target.value)}
              placeholder="جستجو در مقالات پایگاه دانش..."
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pr-9 pl-3 text-sm dark:border-slate-800 dark:bg-slate-900"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {filteredKb.map((art) => (
              <div
                key={art.id}
                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
              >
                <div>
                  <div className="text-xs text-indigo-600 dark:text-indigo-400">{art.category}</div>
                  <h3 className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{art.title}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{art.body}</p>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-3 text-xs text-slate-500 dark:border-slate-800">
                  <span className="tabular-nums">به‌روزرسانی: {formatJalaliDateTime(art.updatedAt)}</span>
                  <button
                    type="button"
                    onClick={() => voteKbHelpful(art.id)}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <ThumbsUp size={13} />
                    مفید بود ({toFa(art.helpfulCount)})
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Ticket Modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="ثبت تیکت پشتیبانی" maxWidth="md">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">مشتری</label>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            >
              {state.customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">موضوع *</label>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="خلاصه مشکل یا درخواست مشتری..."
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">اولویت</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as Ticket['priority'])}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="low">کم</option>
              <option value="normal">عادی</option>
              <option value="high">فوری</option>
            </select>
          </div>
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
              ثبت تیکت
            </button>
          </div>
        </form>
      </Modal>

      {/* Reply Modal with Canned Responses & KB Insert */}
      <Modal
        open={Boolean(replyTarget)}
        onClose={() => setReplyTarget(null)}
        title={`پاسخ به تیکت: ${replyTarget?.subject ?? ''}`}
        maxWidth="lg"
      >
        <form onSubmit={handleSaveReply} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-slate-500">درج پاسخ آماده</label>
              <select
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) setReplyNote(e.target.value);
                  e.target.value = '';
                }}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="" disabled>
                  انتخاب پاسخ آماده...
                </option>
                {CANNED_RESPONSES.map((txt, idx) => (
                  <option key={idx} value={txt}>
                    {txt.slice(0, 42)}...
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">درج از پایگاه دانش</label>
              <select
                defaultValue=""
                onChange={(e) => {
                  const found = state.kbArticles.find((a) => a.id === e.target.value);
                  if (found) setReplyNote(found.body);
                  e.target.value = '';
                }}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="" disabled>
                  انتخاب مقاله راهنما...
                </option>
                {state.kbArticles.map((art) => (
                  <option key={art.id} value={art.id}>
                    {art.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
              متن پاسخ و نتیجه پیگیری
            </label>
            <textarea
              rows={4}
              required
              value={replyNote}
              onChange={(e) => setReplyNote(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setReplyTarget(null)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm dark:border-slate-700"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              ثبت پاسخ و بستن تیکت
            </button>
          </div>
        </form>
      </Modal>

      {/* Add KB Article Modal */}
      <Modal open={kbCreateOpen} onClose={() => setKbCreateOpen(false)} title="افزودن مقاله به پایگاه دانش" maxWidth="md">
        <form onSubmit={handleCreateKb} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs text-slate-500">عنوان مقاله *</label>
            <input
              type="text"
              required
              value={kbTitle}
              onChange={(e) => setKbTitle(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">دسته‌بندی</label>
            <input
              type="text"
              value={kbCategory}
              onChange={(e) => setKbCategory(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">متن راهنما *</label>
            <textarea
              rows={4}
              required
              value={kbBody}
              onChange={(e) => setKbBody(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setKbCreateOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm dark:border-slate-700"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              ذخیره مقاله
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
