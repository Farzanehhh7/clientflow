import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  Clock,
  ExternalLink,
  MessageSquare,
  Paperclip,
  Plus,
  Search,
  ShieldAlert,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { suggestTicketCategoryAndPriority } from '../services/aiService';
import { DynamicFieldsRenderer } from '../components/DynamicFieldsRenderer';
import { Modal } from '../components/Modal';
import { ComplaintsAnalyticsTab } from '../components/support/ComplaintsAnalyticsTab';
import { KnowledgeBaseTab } from '../components/support/KnowledgeBaseTab';
import { SlaPoliciesTab } from '../components/support/SlaPoliciesTab';
import {
  ROOT_CAUSES,
  SUPPORT_TEAMS,
  TICKET_CATEGORIES,
  TICKET_CHANNEL_LABEL,
  TICKET_PRIORITY_COLOR,
  TICKET_PRIORITY_LABEL,
  TICKET_SEVERITY_COLOR,
  TICKET_SEVERITY_LABEL,
  TICKET_STATUS_LABEL,
} from '../components/support/supportHelpers';
import { TicketDetailModal } from '../components/support/TicketDetailModal';
import { useClientFlow } from '../store/useClientFlowStore';
import type {
  Ticket,
  TicketAttachment,
  TicketChannel,
  TicketSeverity,
  TicketStatus,
} from '../types';
import {
  formatCustomFieldValue,
  getFieldsForEntity,
  getTableCustomFields,
  validateCustomFieldValues,
} from '../utils/customFieldValidation';
import { formatJalaliDateTime, toFa } from '../utils/jalali';
import { fuzzyMatchPersian } from '../utils/persianSearch';
import {
  evaluateTicketSla,
  formatRemainingMinutesFa,
  isTicketClosedStatus,
} from '../utils/slaEngine';
import { hasPermission } from '../utils/security';

interface TicketsPageProps {
  onOpenPortal?: () => void;
  initialTicketId?: string | null;
  onClearInitialTicketId?: () => void;
}

export function TicketsPage({ onOpenPortal, initialTicketId, onClearInitialTicketId }: TicketsPageProps) {
  const { state, addTicket, updateTicket, checkAndEscalateTickets, softDeleteEntity, logAiUsage } = useClientFlow();
  const canDeleteTicket = hasPermission(state, 'tickets', 'delete');

  const [tab, setTab] = useState<'tickets' | 'sla' | 'kb' | 'complaints'>('tickets');
  const [statusFilter, setStatusFilter] = useState<'all' | TicketStatus>('all');
  const [channelFilter, setChannelFilter] = useState<'all' | TicketChannel>('all');
  const [teamFilter, setTeamFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [nowTickMs, setNowTickMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNowTickMs(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  // Create Ticket Modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [customerId, setCustomerId] = useState(state.customers[0]?.id ?? '');
  const [subject, setSubject] = useState('');
  const [channel, setChannel] = useState<TicketChannel>('portal');
  const [priority, setPriority] = useState<Ticket['priority']>('normal');
  const [severity, setSeverity] = useState<TicketSeverity>('minor');
  const [category, setCategory] = useState(TICKET_CATEGORIES[0]);
  const [team, setTeam] = useState(SUPPORT_TEAMS[0]);
  const [assignee, setAssignee] = useState(state.settings.salesTeam[0] ?? 'سارا (پذیرش)');
  const [isComplaint, setIsComplaint] = useState(false);
  const [rootCause, setRootCause] = useState('');
  const [initialBody, setInitialBody] = useState('');
  const [draftAttachments, setDraftAttachments] = useState<TicketAttachment[]>([]);
  const [ticketCustomFields, setTicketCustomFields] = useState<Record<string, string>>({});
  const [ticketCustomErrors, setTicketCustomErrors] = useState<Record<string, string>>({});
  const [triageLoading, setTriageLoading] = useState(false);
  const [triageHint, setTriageHint] = useState('');

  // Detail modal
  const [activeTicketId, setActiveTicketId] = useState<string | null>(initialTicketId ?? null);

  useEffect(() => {
    if (initialTicketId) setActiveTicketId(initialTicketId);
  }, [initialTicketId]);

  const agents = useMemo(() => {
    const base = new Set(state.settings.salesTeam);
    state.tickets.forEach((t) => {
      if (t.assignee) base.add(t.assignee);
    });
    return Array.from(base);
  }, [state.settings.salesTeam, state.tickets]);

  const ticketActiveFields = useMemo(
    () => getFieldsForEntity(state.customFieldDefs, 'ticket', false),
    [state.customFieldDefs],
  );
  const ticketTableFields = useMemo(
    () => getTableCustomFields(state.customFieldDefs, 'ticket'),
    [state.customFieldDefs],
  );

  const kpis = useMemo(() => {
    const valid = state.tickets.filter((t) => !t.isDeleted && !t.mergedIntoTicketId);
    const active = valid.filter((t) => !isTicketClosedStatus(t.status));
    let breached = 0;
    let warning = 0;
    active.forEach((t) => {
      const ev = evaluateTicketSla(t, state.slaPolicies, state.settings, state.officialHolidays, nowTickMs);
      if (ev.overallState === 'breached') breached += 1;
      else if (ev.overallState === 'warning') warning += 1;
    });
    const complaints = valid.filter((t) => t.isComplaint || t.category === 'شکایت و کیفیت').length;
    return {
      total: valid.length,
      activeCount: active.length,
      breached,
      warning,
      complaints,
    };
  }, [state.tickets, state.slaPolicies, state.settings, state.officialHolidays, nowTickMs]);

  const filtered = useMemo(() => {
    return state.tickets.filter((t) => {
      if (t.isDeleted) return false;
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (channelFilter !== 'all' && (t.channel ?? 'portal') !== channelFilter) return false;
      if (teamFilter !== 'all' && t.team !== teamFilter) return false;
      if (searchQuery.trim()) {
        const cust = state.customers.find((c) => c.id === t.customerId);
        if (
          !fuzzyMatchPersian(
            [t.trackingCode, t.subject, t.category, t.assignee, cust?.name, cust?.phone],
            searchQuery,
          )
        ) {
          return false;
        }
      }
      return true;
    });
  }, [state.tickets, state.customers, statusFilter, channelFilter, teamFilter, searchQuery]);

  const handleFileAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const sizeKb = Math.max(1, Math.round(file.size / 1024));
    setDraftAttachments((prev) => [
      ...prev,
      {
        id: `tatt_${Date.now()}`,
        name: file.name,
        sizeLabel: sizeKb >= 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`,
        mimeType: file.type || 'application/octet-stream',
      },
    ]);
    e.target.value = '';
  };

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
      channel,
      priority,
      severity,
      category,
      team,
      assignee,
      isComplaint,
      rootCause: rootCause || undefined,
      attachments: draftAttachments.length > 0 ? draftAttachments : undefined,
      initialBody,
      customFields: ticketCustomFields,
    });
    setSubject('');
    setInitialBody('');
    setPriority('normal');
    setSeverity('minor');
    setChannel('portal');
    setIsComplaint(false);
    setRootCause('');
    setDraftAttachments([]);
    setTicketCustomFields({});
    setCreateOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Top KPI Summary */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs text-slate-500 dark:text-slate-400">تیکت‌های باز و در جریان</div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
            {toFa(kpis.activeCount)}
          </div>
          <div className="mt-1 text-xs text-slate-500 tabular-nums">از کل {toFa(kpis.total)} تیکت</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs text-slate-500 dark:text-slate-400">در آستانه هشدار SLA</div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-400">
            {toFa(kpis.warning)}
          </div>
          <div className="mt-1 text-xs text-slate-500">بر اساس ساعات کاری</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs text-slate-500 dark:text-slate-400">نقض‌شده (نیازمند تصعید)</div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-rose-600 dark:text-rose-400">
            {toFa(kpis.breached)}
          </div>
          <div className="mt-1 text-xs text-slate-500">عبور از مهلت پاسخ/حل</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs text-slate-500 dark:text-slate-400">پرونده‌های شکایت</div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-indigo-600 dark:text-indigo-400">
            {toFa(kpis.complaints)}
          </div>
          <div className="mt-1 text-xs text-slate-500">با ردیابی علت ریشه‌ای</div>
        </div>
      </div>

      {/* Tabs & Primary Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 pb-2 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setTab('tickets')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${
              tab === 'tickets'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            <MessageSquare size={14} />
            تیکت‌های پشتیبانی ({toFa(state.tickets.length)})
          </button>
          <button
            type="button"
            onClick={() => setTab('sla')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${
              tab === 'sla'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            <Clock size={14} />
            سیاست‌ها و پایش SLA
          </button>
          <button
            type="button"
            onClick={() => setTab('kb')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${
              tab === 'kb'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            <BookOpen size={14} />
            پایگاه دانش ({toFa(state.kbArticles.length)})
          </button>
          <button
            type="button"
            onClick={() => setTab('complaints')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${
              tab === 'complaints'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            <BarChart3 size={14} />
            شکایات و تحلیل پشتیبانی
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onOpenPortal && (
            <button
              type="button"
              onClick={onOpenPortal}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-medium text-indigo-700 hover:bg-indigo-100 dark:border-indigo-900/50 dark:bg-indigo-950/30 dark:text-indigo-300"
            >
              <ExternalLink size={14} />
              پورتال عمومی مشتری (/portal)
            </button>
          )}
          <button
            type="button"
            onClick={() => checkAndEscalateTickets(false)}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-100 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300"
          >
            <ShieldAlert size={14} />
            بررسی و تصعید SLA
          </button>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-indigo-700"
          >
            <Plus size={15} />
            ثبت تیکت جدید
          </button>
        </div>
      </div>

      {/* TAB 1: TICKETS */}
      {tab === 'tickets' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search size={15} className="absolute right-3 top-2.5 text-slate-400" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="جستجو بر اساس کد رهگیری، موضوع، مشتری، کارشناس..."
                className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-9 text-xs dark:border-slate-700 dark:bg-slate-900"
              />
            </div>

            <select
              aria-label="فیلتر وضعیت"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | TicketStatus)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="all">همه وضعیت‌ها</option>
              {(Object.keys(TICKET_STATUS_LABEL) as TicketStatus[]).map((st) => (
                <option key={st} value={st}>
                  {TICKET_STATUS_LABEL[st]}
                </option>
              ))}
            </select>

            <select
              aria-label="فیلتر کانال"
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value as 'all' | TicketChannel)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="all">همه کانال‌ها</option>
              {(Object.keys(TICKET_CHANNEL_LABEL) as TicketChannel[]).map((ch) => (
                <option key={ch} value={ch}>
                  {TICKET_CHANNEL_LABEL[ch]}
                </option>
              ))}
            </select>

            <select
              aria-label="فیلتر تیم"
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="all">همه تیم‌ها</option>
              {SUPPORT_TEAMS.map((tm) => (
                <option key={tm} value={tm}>
                  {tm}
                </option>
              ))}
            </select>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="border-b border-slate-200 bg-slate-50/70 text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">کد / موضوع تیکت</th>
                    <th className="px-4 py-3 font-medium">مشتری / کانال</th>
                    <th className="px-4 py-3 font-medium">تیم / کارشناس</th>
                    <th className="px-4 py-3 font-medium">اولویت / شدت</th>
                    <th className="px-4 py-3 font-medium">SLA (ساعات کاری)</th>
                    <th className="px-4 py-3 font-medium">وضعیت</th>
                    {ticketTableFields.map((f) => (
                      <th key={f.id} className="px-4 py-3 font-medium">
                        {f.label}
                      </th>
                    ))}
                    <th className="px-4 py-3 font-medium">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filtered.map((t) => {
                    const cust = state.customers.find((c) => c.id === t.customerId);
                    const msgCount = state.ticketMessages.filter((m) => m.ticketId === t.id).length;
                    const sla = evaluateTicketSla(
                      t,
                      state.slaPolicies,
                      state.settings,
                      state.officialHolidays,
                      nowTickMs,
                    );
                    const sev = t.severity ?? 'minor';
                    const chan = t.channel ?? 'portal';

                    return (
                      <tr
                        key={t.id}
                        className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/30 ${
                          t.mergedIntoTicketId ? 'opacity-50' : ''
                        }`}
                      >
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => setActiveTicketId(t.id)}
                            className="text-right font-semibold text-slate-900 hover:text-indigo-600 dark:text-slate-100 dark:hover:text-indigo-400"
                          >
                            <span className="ml-1.5 font-mono text-[11px] font-medium text-indigo-600 dark:text-indigo-400">
                              {t.trackingCode ?? t.id}
                            </span>
                            {t.subject}
                          </button>
                          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                            <span>{t.category || 'عمومی'}</span>
                            <span>·</span>
                            <span className="tabular-nums">{toFa(msgCount)} پیام</span>
                            {t.isComplaint && (
                              <>
                                <span>·</span>
                                <span className="font-semibold text-rose-600 dark:text-rose-400">شکایت</span>
                              </>
                            )}
                            {t.escalated && (
                              <>
                                <span>·</span>
                                <span className="font-semibold text-rose-600 dark:text-rose-400">
                                  تصعیدشده به {t.escalatedTo}
                                </span>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                          <div className="font-medium text-slate-800 dark:text-slate-200">{cust?.name ?? 'مشتری'}</div>
                          <div className="text-[11px] text-slate-400">{TICKET_CHANNEL_LABEL[chan]}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-700 dark:text-slate-200">{t.assignee || '—'}</div>
                          <div className="text-[11px] text-slate-400">{t.team || 'پذیرش'}</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`font-medium ${TICKET_PRIORITY_COLOR[t.priority]}`}>
                            {TICKET_PRIORITY_LABEL[t.priority]}
                          </span>
                          <span className="mx-1 text-slate-300 dark:text-slate-700">/</span>
                          <span className={`font-medium ${TICKET_SEVERITY_COLOR[sev]}`}>
                            {TICKET_SEVERITY_LABEL[sev]}
                          </span>
                        </td>
                        <td className="px-4 py-3 tabular-nums whitespace-nowrap">
                          {isTicketClosedStatus(t.status) ? (
                            <span className="text-emerald-600 dark:text-emerald-400">
                              بسته‌شده · {formatJalaliDateTime(t.resolvedAt || t.createdAt)}
                            </span>
                          ) : sla.overallState === 'breached' ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-rose-600 dark:text-rose-400">
                              <AlertTriangle size={12} />
                              {formatRemainingMinutesFa(sla.resolutionRemainingMin)}
                            </span>
                          ) : sla.overallState === 'warning' ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
                              <AlertTriangle size={12} />
                              {formatRemainingMinutesFa(sla.resolutionRemainingMin)}
                            </span>
                          ) : (
                            <span className="text-slate-500">
                              {formatRemainingMinutesFa(sla.resolutionRemainingMin)}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <select
                            aria-label={`وضعیت تیکت ${t.subject}`}
                            value={t.status}
                            onChange={(e) => updateTicket(t.id, { status: e.target.value as TicketStatus })}
                            className="rounded border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
                          >
                            {(Object.keys(TICKET_STATUS_LABEL) as TicketStatus[]).map((st) => (
                              <option key={st} value={st}>
                                {TICKET_STATUS_LABEL[st]}
                              </option>
                            ))}
                          </select>
                        </td>
                        {ticketTableFields.map((f) => (
                          <td key={f.id} className="px-4 py-3 text-slate-600 dark:text-slate-300">
                            {formatCustomFieldValue(f, t.customFields?.[f.key])}
                          </td>
                        ))}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setActiveTicketId(t.id)}
                              className="inline-flex items-center gap-1 font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                            >
                              <MessageSquare size={13} />
                              جزئیات / گفتگو
                            </button>
                            {canDeleteTicket && (
                              <button
                                type="button"
                                onClick={() => softDeleteEntity('ticket', t.id)}
                                title="انتقال به سطل بازیافت"
                                aria-label={`حذف تیکت ${t.subject}`}
                                className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30 dark:hover:text-rose-400"
                              >
                                <Trash2 size={13} />
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
          </div>
        </div>
      )}

      {/* TAB 2: SLA POLICIES & MONITOR */}
      {tab === 'sla' && <SlaPoliciesTab onOpenTicket={(id) => setActiveTicketId(id)} />}

      {/* TAB 3: KNOWLEDGE BASE */}
      {tab === 'kb' && <KnowledgeBaseTab />}

      {/* TAB 4: COMPLAINTS & ANALYTICS */}
      {tab === 'complaints' && (
        <ComplaintsAnalyticsTab agents={agents} onOpenTicket={(id) => setActiveTicketId(id)} />
      )}

      {/* CREATE TICKET MODAL */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="ثبت تیکت پشتیبانی جدید" maxWidth="lg">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium">مشتری</label>
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                {state.customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.phone})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">کانال ورودی</label>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value as TicketChannel)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                {(Object.keys(TICKET_CHANNEL_LABEL) as TicketChannel[]).map((ch) => (
                  <option key={ch} value={ch}>
                    {TICKET_CHANNEL_LABEL[ch]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <label className="block text-xs font-medium">موضوع تیکت</label>
              {state.settings.ai?.enabled !== false && (
                <button
                  type="button"
                  disabled={triageLoading || (!subject.trim() && !initialBody.trim())}
                  onClick={async () => {
                    setTriageLoading(true);
                    setTriageHint('');
                    const res = await suggestTicketCategoryAndPriority(state, subject, initialBody, logAiUsage);
                    setTriageLoading(false);
                    if (res.ok) {
                      setCategory(res.data.category);
                      setPriority(res.data.priority);
                      setSeverity(res.data.severity);
                      if (res.data.category === 'شکایت و کیفیت') setIsComplaint(true);
                      setTriageHint(`تولیدشده با هوش مصنوعی (AI-generated): ${res.data.reason}`);
                    } else {
                      setTriageHint(res.error);
                    }
                  }}
                  className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-40 dark:border-indigo-900/50 dark:bg-indigo-950/40 dark:text-indigo-300"
                >
                  <Sparkles size={11} />
                  {triageLoading ? 'در حال تشخیص...' : 'پیشنهاد خودکار دسته و اولویت (AI)'}
                </button>
              )}
            </div>
            <input
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="مثلاً: پیگیری مرسوله یا تغییر ساعت نوبت"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
            {triageHint && (
              <p className="mt-1 text-[11px] text-indigo-600 dark:text-indigo-400">{triageHint}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium">اولویت (SLA)</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Ticket['priority'])}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="low">کم ({toFa(Math.round(state.slaPolicies.low.resolutionMin / 60))} ساعت)</option>
                <option value="normal">عادی ({toFa(Math.round(state.slaPolicies.normal.resolutionMin / 60))} ساعت)</option>
                <option value="high">فوری ({toFa(Math.round(state.slaPolicies.high.resolutionMin / 60))} ساعت)</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">شدت اثر (Severity)</label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as TicketSeverity)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="minor">جزئی</option>
                <option value="major">مهم</option>
                <option value="critical">بحرانی</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">دسته‌بندی</label>
              <select
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  if (e.target.value === 'شکایت و کیفیت') setIsComplaint(true);
                }}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              >
                {TICKET_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">تیم و کارشناس</label>
              <div className="flex gap-1">
                <select
                  value={team}
                  onChange={(e) => setTeam(e.target.value)}
                  className="w-1/2 rounded-lg border border-slate-200 bg-white px-1.5 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                >
                  {SUPPORT_TEAMS.map((tm) => (
                    <option key={tm} value={tm}>
                      {tm}
                    </option>
                  ))}
                </select>
                <select
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                  className="w-1/2 rounded-lg border border-slate-200 bg-white px-1.5 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                >
                  {agents.map((ag) => (
                    <option key={ag} value={ag}>
                      {ag}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium dark:border-slate-700">
              <input
                type="checkbox"
                checked={isComplaint}
                onChange={(e) => setIsComplaint(e.target.checked)}
                className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
              />
              ثبت به‌عنوان پرونده شکایت رسمی
            </label>
            <select
              aria-label="علت ریشه‌ای"
              value={rootCause}
              onChange={(e) => setRootCause(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="">علت ریشه‌ای احتمالی (اختیاری)...</option>
              {ROOT_CAUSES.map((rc) => (
                <option key={rc} value={rc}>
                  {rc}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium">شرح اولیه پیام مشتری</label>
            <textarea
              rows={3}
              value={initialBody}
              onChange={(e) => setInitialBody(e.target.value)}
              placeholder="متن درخواست یا مشکل..."
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
              <Paperclip size={13} />
              پیوست فایل
              <input type="file" className="hidden" onChange={handleFileAttach} />
            </label>
            {draftAttachments.map((att) => (
              <span
                key={att.id}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
              >
                <span dir="ltr">{att.name}</span>
                <button
                  type="button"
                  onClick={() => setDraftAttachments((prev) => prev.filter((x) => x.id !== att.id))}
                  className="text-rose-500"
                >
                  <Trash2 size={12} />
                </button>
              </span>
            ))}
          </div>

          {ticketActiveFields.length > 0 && (
            <DynamicFieldsRenderer
              defs={state.customFieldDefs}
              entity="ticket"
              values={ticketCustomFields}
              errors={ticketCustomErrors}
              onChange={setTicketCustomFields}
            />
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium dark:border-slate-700"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700"
            >
              ثبت تیکت
            </button>
          </div>
        </form>
      </Modal>

      {/* TICKET CONVERSATION & DETAIL MODAL */}
      <TicketDetailModal
        ticketId={activeTicketId}
        onClose={() => {
          setActiveTicketId(null);
          onClearInitialTicketId?.();
        }}
        agents={agents}
      />
    </div>
  );
}
