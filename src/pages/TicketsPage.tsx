import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  Edit3,
  GitBranch,
  GitMerge,
  History,
  Lock,
  MessageSquare,
  Plus,
  RotateCcw,
  Search,
  Send,
  ShieldAlert,
  ThumbsUp,
  UserCheck,
  Users,
} from 'lucide-react';
import { DynamicFieldsRenderer } from '../components/DynamicFieldsRenderer';
import { Modal } from '../components/Modal';
import { useClientFlow } from '../store/useClientFlowStore';
import type { KbArticle, Ticket } from '../types';
import {
  formatCustomFieldValue,
  getFieldsForEntity,
  getTableCustomFields,
  validateCustomFieldValues,
} from '../utils/customFieldValidation';
import { formatJalaliDateTime, toFa } from '../utils/jalali';
import { fuzzyMatchPersian } from '../utils/persianSearch';

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

const CATEGORIES = ['نوبت‌دهی', 'سفارش و ارسال', 'مراقبت و مشاوره', 'فنی و نرم‌افزار', 'مالی و فاکتور', 'شکایت و کیفیت'];
const TEAMS = ['پذیرش', 'لجستیک و فروشگاه', 'فنی و پشتیبانی', 'مالی', 'فروش'];
const ROOT_CAUSES = [
  'درخواست تغییر برنامه مراجع',
  'تأخیر شرکت حمل / پست',
  'سوال آموزشی محصول',
  'آسیب بسته‌بندی در ارسال',
  'لغو پیامک تبلیغاتی خط مشتری',
  'نیاز به مدارک حسابداری شرکتی',
  'واکنش پوستی موقت',
  'خطای کاربری / پیکربندی',
];

const CANNED_RESPONSES = [
  'سلام و احترام؛ درخواست شما بررسی و زمان نوبت مطابق درخواست به‌روزرسانی شد.',
  'بسته شما تحویل شرکت پست شده و کد رهگیری به‌زودی پیامک می‌شود.',
  'پوزش بابت تأخیر پیش‌آمده؛ کد تخفیف جبرانی برای خرید بعدی شما فعال گردید.',
  'لطفاً تا ۲۴ ساعت پس از پروسیجر از کرم ترمیم‌کننده و ضدآفتاب استفاده نمایید.',
];

export function TicketsPage() {
  const {
    state,
    addTicket,
    updateTicket,
    addTicketMessage,
    mergeTickets,
    checkAndEscalateTickets,
    addKbArticle,
    updateKbArticle,
    restoreKbVersion,
    voteKbHelpful,
    createWorkflowInstance,
  } = useClientFlow();

  const [tab, setTab] = useState<'tickets' | 'kb' | 'portal' | 'analytics'>('tickets');
  const [statusFilter, setStatusFilter] = useState<'all' | Ticket['status']>('all');
  const [teamFilter, setTeamFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Create Ticket Modal
  const [createOpen, setCreateOpen] = useState(false);
  const [customerId, setCustomerId] = useState(state.customers[0]?.id ?? '');
  const [subject, setSubject] = useState('');
  const [priority, setPriority] = useState<Ticket['priority']>('normal');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [team, setTeam] = useState(TEAMS[0]);
  const [assignee, setAssignee] = useState(state.settings.salesTeam[0] ?? 'سارا (پذیرش)');
  const [initialBody, setInitialBody] = useState('');
  const [ticketCustomFields, setTicketCustomFields] = useState<Record<string, string>>({});
  const [ticketCustomErrors, setTicketCustomErrors] = useState<Record<string, string>>({});

  // Conversation Thread & Detail Modal
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
  const [msgVisibility, setMsgVisibility] = useState<'public' | 'internal'>('public');
  const [msgAuthorType, setMsgAuthorType] = useState<'agent' | 'customer'>('agent');
  const [msgBody, setMsgBody] = useState('');
  const [mergeTargetId, setMergeTargetId] = useState('');

  // KB Create / Edit / History
  const [kbQuery, setKbQuery] = useState('');
  const [kbCreateOpen, setKbCreateOpen] = useState(false);
  const [editingKb, setEditingKb] = useState<KbArticle | null>(null);
  const [historyKb, setHistoryKb] = useState<KbArticle | null>(null);
  const [kbTitle, setKbTitle] = useState('');
  const [kbCategory, setKbCategory] = useState('نوبت‌دهی و پذیرش');
  const [kbBody, setKbBody] = useState('');
  const [kbChangeNote, setKbChangeNote] = useState('');

  // Customer Self-Service Portal state
  const [portalCustomerId, setPortalCustomerId] = useState(state.customers[0]?.id ?? '');
  const [portalSubject, setPortalSubject] = useState('');
  const [portalCategory, setPortalCategory] = useState(CATEGORIES[0]);
  const [portalBody, setPortalBody] = useState('');
  const [portalReplyMap, setPortalReplyMap] = useState<Record<string, string>>({});
  const [portalKbSearch, setPortalKbSearch] = useState('');

  const nowMs = Date.now();
  const agents = useMemo(() => {
    const base = new Set(state.settings.salesTeam);
    state.tickets.forEach((t) => {
      if (t.assignee) base.add(t.assignee);
    });
    return Array.from(base);
  }, [state.settings.salesTeam, state.tickets]);

  const activeTicket = useMemo(
    () => state.tickets.find((t) => t.id === activeTicketId) ?? null,
    [state.tickets, activeTicketId],
  );

  const isSlaBreached = (t: Ticket) => {
    if (t.status === 'resolved') return false;
    const limitH = t.slaHours ?? (t.priority === 'high' ? 4 : t.priority === 'normal' ? 24 : 48);
    const ageH = (nowMs - new Date(t.createdAt).getTime()) / 3600_000;
    return ageH >= limitH;
  };

  const getDuplicateCandidates = (t: Ticket) => {
    return state.tickets.filter(
      (other) =>
        other.id !== t.id &&
        !other.mergedIntoTicketId &&
        other.customerId === t.customerId &&
        other.status !== 'resolved',
    );
  };

  const filtered = useMemo(() => {
    return state.tickets.filter((t) => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (teamFilter !== 'all' && t.team !== teamFilter) return false;
      if (searchQuery.trim()) {
        const cust = state.customers.find((c) => c.id === t.customerId);
        if (!fuzzyMatchPersian([t.subject, t.category, t.assignee, cust?.name], searchQuery)) return false;
      }
      return true;
    });
  }, [state.tickets, state.customers, statusFilter, teamFilter, searchQuery]);

  const filteredKb = useMemo(() => {
    const q = kbQuery.trim();
    if (!q) return state.kbArticles;
    return state.kbArticles.filter((a) => fuzzyMatchPersian([a.title, a.body, a.category], q));
  }, [state.kbArticles, kbQuery]);

  const portalTickets = useMemo(() => {
    return state.tickets.filter((t) => t.customerId === portalCustomerId && !t.mergedIntoTicketId);
  }, [state.tickets, portalCustomerId]);

  const portalKbResults = useMemo(() => {
    if (!portalKbSearch.trim()) return state.kbArticles.slice(0, 4);
    return state.kbArticles.filter((a) => fuzzyMatchPersian([a.title, a.body, a.category], portalKbSearch));
  }, [state.kbArticles, portalKbSearch]);

  // Analytics metrics
  const analytics = useMemo(() => {
    const total = state.tickets.length;
    const resolved = state.tickets.filter((t) => t.status === 'resolved');
    const breached = state.tickets.filter((t) => isSlaBreached(t) || t.escalated);
    const slaCompliantPct = total > 0 ? Math.round(((total - breached.length) / total) * 100) : 100;

    const avgResHours =
      resolved.length > 0
        ? Math.round(
            (resolved.reduce((sum, t) => {
              const endMs = t.resolvedAt ? new Date(t.resolvedAt).getTime() : new Date(t.createdAt).getTime() + 6 * 3600_000;
              return sum + Math.max(0.5, (endMs - new Date(t.createdAt).getTime()) / 3600_000);
            }, 0) /
              resolved.length) *
              10,
          ) / 10
        : 0;

    const byAgent = agents.map((ag) => {
      const list = state.tickets.filter((t) => t.assignee === ag);
      return {
        agent: ag,
        total: list.length,
        open: list.filter((t) => t.status === 'open').length,
        pending: list.filter((t) => t.status === 'pending').length,
        resolved: list.filter((t) => t.status === 'resolved').length,
        escalated: list.filter((t) => t.escalated || isSlaBreached(t)).length,
      };
    });

    const rootCauseMap = new Map<string, number>();
    const categoryMap = new Map<string, number>();
    state.tickets.forEach((t) => {
      const rc = t.rootCause || 'ثبت‌نشده';
      rootCauseMap.set(rc, (rootCauseMap.get(rc) ?? 0) + 1);
      const cat = t.category || 'عمومی';
      categoryMap.set(cat, (categoryMap.get(cat) ?? 0) + 1);
    });

    return {
      total,
      resolvedCount: resolved.length,
      breachedCount: breached.length,
      slaCompliantPct,
      avgResHours,
      byAgent,
      rootCauses: Array.from(rootCauseMap.entries()).sort((a, b) => b[1] - a[1]),
      categories: Array.from(categoryMap.entries()).sort((a, b) => b[1] - a[1]),
    };
  }, [state.tickets, agents, nowMs]);

  const ticketActiveFields = useMemo(
    () => getFieldsForEntity(state.customFieldDefs, 'ticket', false),
    [state.customFieldDefs],
  );
  const ticketTableFields = useMemo(
    () => getTableCustomFields(state.customFieldDefs, 'ticket'),
    [state.customFieldDefs],
  );

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) return;
    setTicketCustomErrors({});
    const cfValidation = validateCustomFieldValues(state.customFieldDefs, ticketCustomFields, {
      entity: 'ticket',
      existingRecords: state.tickets,
    });
    if (!cfValidation.ok) {
      setTicketCustomErrors(cfValidation.errors);
      return;
    }
    addTicket({
      customerId,
      subject,
      priority,
      category,
      team,
      assignee,
      initialBody,
      customFields: ticketCustomFields,
    });
    setSubject('');
    setInitialBody('');
    setPriority('normal');
    setTicketCustomFields({});
    setCreateOpen(false);
  };

  const handleSendThreadMessage = (e: React.FormEvent, closeAfter = false) => {
    e.preventDefault();
    if (!activeTicket || !msgBody.trim()) return;
    const cust = state.customers.find((c) => c.id === activeTicket.customerId);
    const authorName =
      msgAuthorType === 'customer'
        ? cust?.name ?? 'مشتری'
        : state.settings.role === 'admin'
          ? 'مدیر پشتیبانی'
          : activeTicket.assignee ?? 'کارشناس پشتیبانی';

    addTicketMessage(activeTicket.id, {
      authorName,
      authorType: msgAuthorType,
      visibility: msgAuthorType === 'customer' ? 'public' : msgVisibility,
      body: msgBody,
    });
    if (closeAfter) {
      updateTicket(activeTicket.id, { status: 'resolved', replyNote: msgBody.trim() });
    }
    setMsgBody('');
  };

  const handleSaveKb = (e: React.FormEvent) => {
    e.preventDefault();
    if (!kbTitle.trim() || !kbBody.trim()) return;
    if (editingKb) {
      updateKbArticle(editingKb.id, {
        title: kbTitle,
        category: kbCategory,
        body: kbBody,
        changeNote: kbChangeNote,
      });
      setEditingKb(null);
    } else {
      addKbArticle({ title: kbTitle.trim(), category: kbCategory, body: kbBody.trim() });
      setKbCreateOpen(false);
    }
    setKbTitle('');
    setKbBody('');
    setKbChangeNote('');
  };

  const handlePortalSubmitTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!portalSubject.trim() || !portalBody.trim()) return;
    addTicket({
      customerId: portalCustomerId,
      subject: portalSubject.trim(),
      priority: 'normal',
      category: portalCategory,
      team: 'پذیرش',
      initialBody: portalBody.trim(),
    });
    setPortalSubject('');
    setPortalBody('');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-900">
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
          <button
            type="button"
            onClick={() => setTab('portal')}
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === 'portal'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <Users size={14} />
            پورتال سلف‌سرویس مشتری
          </button>
          <button
            type="button"
            onClick={() => setTab('analytics')}
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === 'analytics'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <BarChart3 size={14} />
            علت ریشه‌ای و بار کاری
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {tab === 'tickets' && (
            <button
              type="button"
              onClick={() => checkAndEscalateTickets(false)}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
            >
              <ShieldAlert size={15} />
              بررسی و تصعید SLA
            </button>
          )}
          {(tab === 'tickets' || tab === 'kb') && (
            <button
              type="button"
              onClick={() => {
                if (tab === 'tickets') {
                  setTicketCustomFields({});
                  setTicketCustomErrors({});
                  setCreateOpen(true);
                } else {
                  setEditingKb(null);
                  setKbTitle('');
                  setKbBody('');
                  setKbChangeNote('');
                  setKbCreateOpen(true);
                }
              }}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700"
            >
              <Plus size={16} />
              {tab === 'tickets' ? 'ثبت تیکت جدید' : 'افزودن مقاله دانش'}
            </button>
          )}
        </div>
      </div>

      {tab === 'tickets' && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-900">
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

              <select
                aria-label="فیلتر تیم"
                value={teamFilter}
                onChange={(e) => setTeamFilter(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-800 dark:bg-slate-900"
              >
                <option value="all">همه تیم‌ها</option>
                {TEAMS.map((tm) => (
                  <option key={tm} value={tm}>
                    تیم {tm}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative w-full max-w-xs">
              <Search size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="جستجوی تیکت، مشتری، کارشناس..."
                className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pr-9 pl-3 text-xs dark:border-slate-800 dark:bg-slate-900"
              />
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead className="border-b border-slate-200 bg-slate-50/70 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">موضوع، دسته‌بندی و SLA</th>
                    <th className="px-4 py-3 font-medium">مشتری</th>
                    <th className="px-4 py-3 font-medium">تیم و کارشناس</th>
                    <th className="px-4 py-3 font-medium">اولویت</th>
                    <th className="px-4 py-3 font-medium">وضعیت</th>
                    <th className="px-4 py-3 font-medium">تاریخ ثبت</th>
                    {ticketTableFields.map((def) => (
                      <th key={def.id} className="px-4 py-3 font-medium">
                        {def.label}
                      </th>
                    ))}
                    <th className="px-4 py-3 font-medium text-left">اقدام</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filtered.map((t) => {
                    const cust = state.customers.find((c) => c.id === t.customerId);
                    const breached = isSlaBreached(t);
                    const msgCount = state.ticketMessages.filter((m) => m.ticketId === t.id).length;
                    const dups = getDuplicateCandidates(t);
                    return (
                      <tr key={t.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-1.5 font-medium text-slate-900 dark:text-slate-100">
                            <span>{t.subject}</span>
                            {t.category && (
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-normal text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                {t.category}
                              </span>
                            )}
                            {dups.length > 0 && !t.mergedIntoTicketId && (
                              <span className="inline-flex items-center gap-0.5 rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-normal text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                                <GitMerge size={11} />
                                {toFa(dups.length)} تیکت مشابه
                              </span>
                            )}
                            {t.mergedIntoTicketId && (
                              <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[11px] text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                                ادغام‌شده در {t.mergedIntoTicketId}
                              </span>
                            )}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                            {t.escalated && (
                              <span className="inline-flex items-center gap-1 font-medium text-rose-600 dark:text-rose-400">
                                <ShieldAlert size={12} />
                                تصعیدشده به {t.escalatedTo ?? 'مدیر پشتیبانی'}
                              </span>
                            )}
                            {!t.escalated && breached && (
                              <span className="inline-flex items-center gap-1 font-medium text-rose-600 dark:text-rose-400">
                                <AlertTriangle size={12} />
                                نقض مهلت SLA ({toFa(t.slaHours ?? 24)} ساعت)
                              </span>
                            )}
                            {msgCount > 0 && (
                              <span className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400">
                                <MessageSquare size={12} />
                                {toFa(msgCount)} پیام در گفتگو
                              </span>
                            )}
                          </div>
                          {t.replyNote && (
                            <div className="mt-0.5 text-xs text-emerald-700 dark:text-emerald-400">
                              آخرین پاسخ: {t.replyNote}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                          <div>{cust?.name ?? 'مشتری'}</div>
                          {cust && <div className="text-slate-400 tabular-nums">{toFa(cust.phone)}</div>}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <div className="text-slate-500 dark:text-slate-400">{t.team ?? 'پذیرش'}</div>
                          <select
                            aria-label="کارشناس مسئول"
                            value={t.assignee ?? ''}
                            onChange={(e) => updateTicket(t.id, { assignee: e.target.value })}
                            className="mt-1 rounded border border-slate-200 bg-white px-2 py-0.5 text-[11px] dark:border-slate-700 dark:bg-slate-800"
                          >
                            <option value="">تخصیص‌نیافته</option>
                            {agents.map((ag) => (
                              <option key={ag} value={ag}>
                                {ag}
                              </option>
                            ))}
                          </select>
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
                        {ticketTableFields.map((def) => (
                          <td key={def.id} className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                            {formatCustomFieldValue(def, t.customFields?.[def.key])}
                          </td>
                        ))}
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
                                setActiveTicketId(t.id);
                                setMsgBody('');
                                setMsgVisibility('public');
                                setMsgAuthorType('agent');
                                setMergeTargetId(dups[0]?.id ?? '');
                              }}
                              className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300"
                            >
                              <MessageSquare size={13} />
                              رشته گفتگو ({toFa(msgCount)})
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
      )}

      {tab === 'kb' && (
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
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-indigo-600 dark:text-indigo-400">{art.category}</span>
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      نسخه {toFa(art.version ?? 1)}
                    </span>
                  </div>
                  <h3 className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{art.title}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{art.body}</p>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3 text-xs text-slate-500 dark:border-slate-800">
                  <span className="tabular-nums">به‌روزرسانی: {formatJalaliDateTime(art.updatedAt)}</span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setHistoryKb(art)}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <History size={13} />
                      نسخه‌ها ({toFa(art.versions?.length ?? 1)})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingKb(art);
                        setKbTitle(art.title);
                        setKbCategory(art.category);
                        setKbBody(art.body);
                        setKbChangeNote('');
                      }}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <Edit3 size={13} />
                      ویرایش
                    </button>
                    <button
                      type="button"
                      onClick={() => voteKbHelpful(art.id)}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <ThumbsUp size={13} />
                      مفید ({toFa(art.helpfulCount)})
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'portal' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 dark:border-indigo-900/60 dark:bg-indigo-950/20">
            <div>
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                پیش‌نمایش زنده پورتال سلف‌سرویس مشتری
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                در این نما فقط تیکت‌های مشتری انتخاب‌شده و پیام‌های عمومی (بدون یادداشت‌های داخلی کارشناسان) نمایش داده می‌شوند.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <UserCheck size={16} className="text-indigo-600" />
              <select
                aria-label="مشتری واردشده در پورتال"
                value={portalCustomerId}
                onChange={(e) => setPortalCustomerId(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
              >
                {state.customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({toFa(c.phone)})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            {/* Submit & Self-Service KB */}
            <div className="space-y-4 lg:col-span-5">
              <form
                onSubmit={handlePortalSubmitTicket}
                className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
              >
                <h3 className="text-sm font-semibold">ارسال درخواست پشتیبانی جدید (پورتال مشتری)</h3>
                <input
                  type="text"
                  required
                  value={portalSubject}
                  onChange={(e) => setPortalSubject(e.target.value)}
                  placeholder="موضوع درخواست..."
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
                <select
                  value={portalCategory}
                  onChange={(e) => setPortalCategory(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <textarea
                  rows={3}
                  required
                  value={portalBody}
                  onChange={(e) => setPortalBody(e.target.value)}
                  placeholder="توضیح کامل مشکل یا سوال خود را بنویسید..."
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700"
                >
                  <Send size={14} />
                  ارسال تیکت از طرف مشتری
                </button>
              </form>

              <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <h3 className="text-sm font-semibold">جستجوی سریع در راهنما قبل از ثبت تیکت</h3>
                <input
                  type="text"
                  value={portalKbSearch}
                  onChange={(e) => setPortalKbSearch(e.target.value)}
                  placeholder="مثلاً: تغییر ساعت نوبت یا کد رهگیری..."
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
                <div className="space-y-2">
                  {portalKbResults.map((a) => (
                    <div key={a.id} className="rounded-lg border border-slate-200 p-2.5 text-xs dark:border-slate-800">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">{a.title}</div>
                      <div className="mt-1 text-slate-600 dark:text-slate-300">{a.body}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Customer Tickets (Public messages only) */}
            <div className="space-y-3 lg:col-span-7">
              <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <h3 className="mb-3 text-sm font-semibold">
                  تیکت‌های من ({toFa(portalTickets.length)})
                </h3>
                {portalTickets.length === 0 ? (
                  <p className="py-8 text-center text-xs text-slate-500">تیکتی برای این مشتری ثبت نشده است.</p>
                ) : (
                  <div className="space-y-4">
                    {portalTickets.map((t) => {
                      const pubMsgs = state.ticketMessages.filter(
                        (m) => m.ticketId === t.id && m.visibility === 'public',
                      );
                      const custName = state.customers.find((c) => c.id === portalCustomerId)?.name ?? 'مشتری';
                      return (
                        <div key={t.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                              {t.subject}
                            </div>
                            <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] dark:bg-slate-800">
                              {STATUS_LABEL[t.status]}
                            </span>
                          </div>
                          <div className="mt-3 space-y-2">
                            {pubMsgs.length === 0 && t.replyNote && (
                              <div className="rounded-lg bg-slate-50 p-2.5 text-xs dark:bg-slate-800/50">
                                <span className="font-semibold text-indigo-600">پشتیبانی: </span>
                                {t.replyNote}
                              </div>
                            )}
                            {pubMsgs.map((m) => (
                              <div
                                key={m.id}
                                className={`rounded-lg p-2.5 text-xs ${
                                  m.authorType === 'customer'
                                    ? 'bg-indigo-50/60 dark:bg-indigo-950/30'
                                    : 'bg-slate-50 dark:bg-slate-800/50'
                                }`}
                              >
                                <div className="flex items-center justify-between text-[11px] text-slate-500">
                                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                                    {m.authorName}
                                  </span>
                                  <span className="tabular-nums">{formatJalaliDateTime(m.createdAt)}</span>
                                </div>
                                <p className="mt-1 text-slate-700 dark:text-slate-300">{m.body}</p>
                              </div>
                            ))}
                          </div>
                          <div className="mt-3 flex gap-2">
                            <input
                              type="text"
                              value={portalReplyMap[t.id] ?? ''}
                              onChange={(e) =>
                                setPortalReplyMap((prev) => ({ ...prev, [t.id]: e.target.value }))
                              }
                              placeholder="ارسال پیام جدید از طرف مشتری..."
                              className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const text = portalReplyMap[t.id]?.trim();
                                if (!text) return;
                                addTicketMessage(t.id, {
                                  authorName: custName,
                                  authorType: 'customer',
                                  visibility: 'public',
                                  body: text,
                                });
                                setPortalReplyMap((prev) => ({ ...prev, [t.id]: '' }));
                              }}
                              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                            >
                              ارسال
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'analytics' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="text-xs text-slate-500">کل تیکت‌ها</div>
              <div className="mt-1 text-2xl font-bold tabular-nums">{toFa(analytics.total)}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="text-xs text-slate-500">رعایت SLA</div>
              <div className="mt-1 text-2xl font-bold tabular-nums text-emerald-600">
                {toFa(analytics.slaCompliantPct)}٪
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="text-xs text-slate-500">تیکت‌های تصعیدشده / نقض SLA</div>
              <div className="mt-1 text-2xl font-bold tabular-nums text-rose-600">
                {toFa(analytics.breachedCount)}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="text-xs text-slate-500">میانگین زمان حل تیکت</div>
              <div className="mt-1 text-2xl font-bold tabular-nums">
                {toFa(analytics.avgResHours)} ساعت
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Agent Workload */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <h3 className="mb-3 text-sm font-semibold">بار کاری کارشناسان پشتیبانی</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800">
                    <tr>
                      <th className="py-2">کارشناس</th>
                      <th className="py-2">کل</th>
                      <th className="py-2">باز</th>
                      <th className="py-2">در انتظار</th>
                      <th className="py-2">حل‌شده</th>
                      <th className="py-2">نقض SLA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {analytics.byAgent.map((row) => (
                      <tr key={row.agent}>
                        <td className="py-2.5 font-medium">{row.agent}</td>
                        <td className="py-2.5 tabular-nums">{toFa(row.total)}</td>
                        <td className="py-2.5 tabular-nums text-amber-600">{toFa(row.open)}</td>
                        <td className="py-2.5 tabular-nums text-sky-600">{toFa(row.pending)}</td>
                        <td className="py-2.5 tabular-nums text-emerald-600">{toFa(row.resolved)}</td>
                        <td className="py-2.5 tabular-nums text-rose-600">{toFa(row.escalated)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Root Cause Analysis */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <h3 className="mb-3 text-sm font-semibold">تحلیل علت ریشه‌ای (Root Cause Analysis)</h3>
              <div className="space-y-3">
                {analytics.rootCauses.map(([cause, count]) => {
                  const pct = Math.round((count / Math.max(1, analytics.total)) * 100);
                  return (
                    <div key={cause}>
                      <div className="flex justify-between text-xs">
                        <span className="font-medium text-slate-700 dark:text-slate-300">{cause}</span>
                        <span className="tabular-nums text-slate-500">
                          {toFa(count)} مورد ({toFa(pct)}٪)
                        </span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div className="h-full rounded-full bg-indigo-600" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Ticket Modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="ثبت تیکت پشتیبانی" maxWidth="md">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">دسته‌بندی</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">تیم رسیدگی</label>
              <select
                value={team}
                onChange={(e) => setTeam(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                {TEAMS.map((tm) => (
                  <option key={tm} value={tm}>
                    {tm}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">کارشناس مسئول</label>
              <select
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                {agents.map((ag) => (
                  <option key={ag} value={ag}>
                    {ag}
                  </option>
                ))}
              </select>
            </div>
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
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">اولویت (تعیین SLA)</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as Ticket['priority'])}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="low">کم (SLA ۴۸ ساعت)</option>
              <option value="normal">عادی (SLA ۲۴ ساعت)</option>
              <option value="high">فوری (SLA ۴ ساعت)</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">شرح اولیه پیام</label>
            <textarea
              rows={2}
              value={initialBody}
              onChange={(e) => setInitialBody(e.target.value)}
              placeholder="متن پیام اولیه مشتری (اختیاری)..."
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </div>

          {ticketActiveFields.length > 0 && (
            <div className="border-t border-slate-200 pt-3 dark:border-slate-800">
              <p className="mb-2 text-xs font-semibold text-slate-500">فیلدهای سفارشی تیکت</p>
              <DynamicFieldsRenderer
                entity="ticket"
                defs={state.customFieldDefs}
                values={ticketCustomFields}
                onChange={setTicketCustomFields}
                errors={ticketCustomErrors}
              />
            </div>
          )}

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

      {/* Ticket Conversation Thread, Routing, Merge & Root Cause Modal */}
      <Modal
        open={Boolean(activeTicket)}
        onClose={() => setActiveTicketId(null)}
        title={`پرونده تیکت: ${activeTicket?.subject ?? ''}`}
        maxWidth="xl"
      >
        {activeTicket && (() => {
          const thread = state.ticketMessages.filter((m) => m.ticketId === activeTicket.id);
          const dups = getDuplicateCandidates(activeTicket);
          const otherTicketsSameOrAll = state.tickets.filter(
            (x) => x.id !== activeTicket.id && !x.mergedIntoTicketId,
          );
          return (
            <div className="space-y-4">
              {/* Routing & Root Cause Bar */}
              <div className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-xs sm:grid-cols-4 dark:border-slate-800 dark:bg-slate-800/40">
                <div>
                  <label className="mb-1 block text-[11px] text-slate-500">تیم</label>
                  <select
                    value={activeTicket.team ?? 'پذیرش'}
                    onChange={(e) => updateTicket(activeTicket.id, { team: e.target.value })}
                    className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
                  >
                    {TEAMS.map((tm) => (
                      <option key={tm} value={tm}>
                        {tm}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-slate-500">کارشناس مسئول</label>
                  <select
                    value={activeTicket.assignee ?? ''}
                    onChange={(e) => updateTicket(activeTicket.id, { assignee: e.target.value })}
                    className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
                  >
                    {agents.map((ag) => (
                      <option key={ag} value={ag}>
                        {ag}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-slate-500">علت ریشه‌ای</label>
                  <select
                    value={activeTicket.rootCause ?? ''}
                    onChange={(e) => updateTicket(activeTicket.id, { rootCause: e.target.value })}
                    className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
                  >
                    <option value="">انتخاب علت ریشه‌ای...</option>
                    {ROOT_CAUSES.map((rc) => (
                      <option key={rc} value={rc}>
                        {rc}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-slate-500">ادغام تیکت تکراری</label>
                  <div className="flex gap-1">
                    <select
                      value={mergeTargetId}
                      onChange={(e) => setMergeTargetId(e.target.value)}
                      className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-[11px] dark:border-slate-700 dark:bg-slate-900"
                    >
                      <option value="">انتخاب تیکت تکراری...</option>
                      {dups.map((d) => (
                        <option key={d.id} value={d.id}>
                          ★ مشابه: {d.subject}
                        </option>
                      ))}
                      {otherTicketsSameOrAll
                        .filter((x) => !dups.some((d) => d.id === x.id))
                        .slice(0, 8)
                        .map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.subject}
                          </option>
                        ))}
                    </select>
                    <button
                      type="button"
                      disabled={!mergeTargetId}
                      onClick={() => {
                        if (!mergeTargetId) return;
                        mergeTickets(activeTicket.id, mergeTargetId);
                        setMergeTargetId('');
                      }}
                      title="ادغام تیکت انتخاب‌شده در این تیکت"
                      className="shrink-0 rounded bg-amber-600 px-2 py-1 text-[11px] text-white hover:bg-amber-700 disabled:opacity-40"
                    >
                      ادغام
                    </button>
                  </div>
                </div>
              </div>

              {/* Messages Thread */}
              <div className="max-h-72 space-y-2.5 overflow-y-auto rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                {thread.length === 0 ? (
                  <p className="py-6 text-center text-xs text-slate-400">
                    هنوز پیامی در رشته این تیکت ثبت نشده است. اولین پاسخ یا یادداشت داخلی را ارسال کنید.
                  </p>
                ) : (
                  thread.map((m) => (
                    <div
                      key={m.id}
                      className={`rounded-lg border p-3 text-xs ${
                        m.visibility === 'internal'
                          ? 'border-amber-200 bg-amber-50/60 dark:border-amber-800/70 dark:bg-amber-950/30'
                          : m.authorType === 'customer'
                            ? 'border-indigo-200 bg-indigo-50/40 dark:border-indigo-900 dark:bg-indigo-950/20'
                            : 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/40'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 font-semibold">
                          <span>{m.authorName}</span>
                          {m.visibility === 'internal' ? (
                            <span className="inline-flex items-center gap-0.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/60 dark:text-amber-200">
                              <Lock size={10} />
                              یادداشت داخلی (مخفی از مشتری)
                            </span>
                          ) : (
                            <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                              {m.authorType === 'customer' ? 'پیام مشتری' : 'پاسخ عمومی'}
                            </span>
                          )}
                        </div>
                        <span className="tabular-nums text-[11px] text-slate-500">
                          {formatJalaliDateTime(m.createdAt)}
                        </span>
                      </div>
                      <p className="mt-1.5 leading-relaxed text-slate-800 dark:text-slate-200">{m.body}</p>
                    </div>
                  ))
                )}
              </div>

              {/* Composer */}
              <form onSubmit={(e) => handleSendThreadMessage(e, false)} className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setMsgAuthorType('agent');
                        setMsgVisibility('public');
                      }}
                      className={`rounded-lg border px-3 py-1.5 font-medium ${
                        msgAuthorType === 'agent' && msgVisibility === 'public'
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300'
                          : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-400'
                      }`}
                    >
                      پاسخ عمومی به مشتری
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMsgAuthorType('agent');
                        setMsgVisibility('internal');
                      }}
                      className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 font-medium ${
                        msgAuthorType === 'agent' && msgVisibility === 'internal'
                          ? 'border-amber-500 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                          : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-400'
                      }`}
                    >
                      <Lock size={12} />
                      یادداشت داخلی کارشناس
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMsgAuthorType('customer');
                        setMsgVisibility('public');
                      }}
                      className={`rounded-lg border px-3 py-1.5 font-medium ${
                        msgAuthorType === 'customer'
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                          : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-400'
                      }`}
                    >
                      شبیه‌سازی پیام مشتری
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <select
                      defaultValue=""
                      onChange={(e) => {
                        if (e.target.value) setMsgBody(e.target.value);
                        e.target.value = '';
                      }}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
                    >
                      <option value="" disabled>
                        درج پاسخ آماده...
                      </option>
                      {CANNED_RESPONSES.map((txt, idx) => (
                        <option key={idx} value={txt}>
                          {txt.slice(0, 32)}...
                        </option>
                      ))}
                    </select>
                    <select
                      defaultValue=""
                      onChange={(e) => {
                        const found = state.kbArticles.find((a) => a.id === e.target.value);
                        if (found) setMsgBody(found.body);
                        e.target.value = '';
                      }}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
                    >
                      <option value="" disabled>
                        درج از پایگاه دانش...
                      </option>
                      {state.kbArticles.map((art) => (
                        <option key={art.id} value={art.id}>
                          {art.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <textarea
                  rows={3}
                  required
                  value={msgBody}
                  onChange={(e) => setMsgBody(e.target.value)}
                  placeholder={
                    msgVisibility === 'internal'
                      ? 'متن یادداشت داخلی برای تیم پشتیبانی (مشتری آن را نمی‌بیند)...'
                      : 'متن پاسخ برای ثبت در رشته تیکت...'
                  }
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                />

                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTicketId(null)}
                    className="rounded-lg border border-slate-200 px-4 py-2 text-xs dark:border-slate-700"
                  >
                    بستن
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1 rounded-lg border border-indigo-600 px-4 py-2 text-xs font-medium text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400"
                  >
                    <Send size={13} />
                    ثبت در گفتگو
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleSendThreadMessage(e, true)}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700"
                  >
                    ثبت پاسخ و بستن تیکت
                  </button>
                </div>
              </form>
            </div>
          );
        })()}
      </Modal>

      {/* Add / Edit KB Article Modal */}
      <Modal
        open={kbCreateOpen || Boolean(editingKb)}
        onClose={() => {
          setKbCreateOpen(false);
          setEditingKb(null);
        }}
        title={editingKb ? `ویرایش مقاله (نسخه فعلی ${toFa(editingKb.version ?? 1)})` : 'افزودن مقاله به پایگاه دانش'}
        maxWidth="md"
      >
        <form onSubmit={handleSaveKb} className="space-y-4">
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
          {editingKb && (
            <div>
              <label className="mb-1 block text-xs text-slate-500">یادداشت تغییرات این نسخه</label>
              <input
                type="text"
                value={kbChangeNote}
                onChange={(e) => setKbChangeNote(e.target.value)}
                placeholder="مثلاً: به‌روزرسانی شرایط ارسال رایگان"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setKbCreateOpen(false);
                setEditingKb(null);
              }}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm dark:border-slate-700"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              {editingKb ? 'ذخیره به عنوان نسخه جدید' : 'ذخیره مقاله'}
            </button>
          </div>
        </form>
      </Modal>

      {/* KB Version History Modal */}
      <Modal
        open={Boolean(historyKb)}
        onClose={() => setHistoryKb(null)}
        title={`تاریخچه نسخه‌های مقاله: ${historyKb?.title ?? ''}`}
        maxWidth="lg"
      >
        {historyKb && (
          <div className="space-y-3">
            {(historyKb.versions && historyKb.versions.length > 0
              ? [...historyKb.versions].reverse()
              : [
                  {
                    version: historyKb.version ?? 1,
                    title: historyKb.title,
                    category: historyKb.category,
                    body: historyKb.body,
                    updatedAt: historyKb.updatedAt,
                    editor: 'مدیر سیستم',
                    changeNote: 'نسخه فعلی',
                  },
                ]
            ).map((ver) => (
              <div
                key={ver.version}
                className="rounded-xl border border-slate-200 p-3.5 text-xs dark:border-slate-800"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-indigo-50 px-2 py-0.5 font-semibold text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                      نسخه {toFa(ver.version)}
                    </span>
                    <span className="text-slate-500">ویرایشگر: {ver.editor}</span>
                    {ver.changeNote && <span className="text-slate-600 dark:text-slate-300">· {ver.changeNote}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="tabular-nums text-slate-400">{formatJalaliDateTime(ver.updatedAt)}</span>
                    {ver.version !== (historyKb.version ?? 1) && (
                      <button
                        type="button"
                        onClick={() => {
                          restoreKbVersion(historyKb.id, ver.version);
                          setHistoryKb(null);
                        }}
                        className="inline-flex items-center gap-1 rounded border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300"
                      >
                        <RotateCcw size={11} />
                        بازگردانی
                      </button>
                    )}
                  </div>
                </div>
                <div className="mt-2 font-medium text-slate-900 dark:text-slate-100">{ver.title}</div>
                <p className="mt-1 text-slate-600 dark:text-slate-300">{ver.body}</p>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
