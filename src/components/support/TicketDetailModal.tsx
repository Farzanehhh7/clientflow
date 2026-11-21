import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Clock,
  GitBranch,
  GitMerge,
  Lock,
  Paperclip,
  Send,
  ShieldAlert,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  suggestTicketCategoryAndPriority,
  suggestTicketReply,
  type TicketReplySuggestion,
  type TicketTriageSuggestion,
} from '../../services/aiService';
import { useClientFlow } from '../../store/useClientFlowStore';
import type {
  ComplaintStatus,
  Ticket,
  TicketAttachment,
  TicketSeverity,
  TicketStatus,
} from '../../types';
import { formatJalaliDateTime, toFa } from '../../utils/jalali';
import {
  evaluateTicketSla,
  formatRemainingMinutesFa,
  isTicketClosedStatus,
  suggestKbArticlesForTicket,
} from '../../utils/slaEngine';
import { Modal } from '../Modal';
import {
  CANNED_RESPONSES,
  ROOT_CAUSES,
  SUPPORT_TEAMS,
  TICKET_CHANNEL_LABEL,
  TICKET_STATUS_LABEL,
} from './supportHelpers';

interface TicketDetailModalProps {
  ticketId: string | null;
  onClose: () => void;
  agents: string[];
}

export function TicketDetailModal({ ticketId, onClose, agents }: TicketDetailModalProps) {
  const {
    state,
    updateTicket,
    addTicketMessage,
    mergeTickets,
    escalateTicket,
    createWorkflowInstance,
    logAiUsage,
  } = useClientFlow();

  const [msgVisibility, setMsgVisibility] = useState<'public' | 'internal'>('public');
  const [msgAuthorType, setMsgAuthorType] = useState<'agent' | 'customer'>('agent');
  const [msgBody, setMsgBody] = useState('');
  const [draftAttachments, setDraftAttachments] = useState<TicketAttachment[]>([]);
  const [mergeTargetId, setMergeTargetId] = useState('');
  const [nowTickMs, setNowTickMs] = useState(() => Date.now());
  const [aiReplyLoading, setAiReplyLoading] = useState(false);
  const [aiReplyDraft, setAiReplyDraft] = useState<{
    data: TicketReplySuggestion;
    mode: 'gemini' | 'fallback';
  } | null>(null);
  const [aiTriageResult, setAiTriageResult] = useState<TicketTriageSuggestion | null>(null);
  const [aiError, setAiError] = useState('');

  useEffect(() => {
    if (!ticketId) return;
    setAiReplyDraft(null);
    setAiTriageResult(null);
    setAiError('');
    const timer = window.setInterval(() => setNowTickMs(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, [ticketId]);

  const ticket = useMemo(
    () => state.tickets.find((t) => t.id === ticketId) ?? null,
    [state.tickets, ticketId],
  );

  const customer = useMemo(
    () => (ticket ? state.customers.find((c) => c.id === ticket.customerId) ?? null : null),
    [state.customers, ticket],
  );

  const messages = useMemo(
    () =>
      ticket
        ? state.ticketMessages
            .filter((m) => m.ticketId === ticket.id)
            .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        : [],
    [state.ticketMessages, ticket],
  );

  const duplicates = useMemo(() => {
    if (!ticket) return [];
    return state.tickets.filter(
      (other) =>
        other.id !== ticket.id &&
        !other.mergedIntoTicketId &&
        other.customerId === ticket.customerId &&
        !isTicketClosedStatus(other.status),
    );
  }, [state.tickets, ticket]);

  const slaEval = useMemo(() => {
    if (!ticket) return null;
    return evaluateTicketSla(
      ticket,
      state.slaPolicies,
      state.settings,
      state.officialHolidays,
      nowTickMs,
    );
  }, [ticket, state.slaPolicies, state.settings, state.officialHolidays, nowTickMs]);

  const suggestedArticles = useMemo(() => {
    if (!ticket) return [];
    return suggestKbArticlesForTicket(ticket, state.kbArticles, msgBody, 3);
  }, [ticket, state.kbArticles, msgBody]);

  if (!ticket || !slaEval) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const sizeKb = Math.max(1, Math.round(file.size / 1024));
    const att: TicketAttachment = {
      id: `att_${Date.now()}`,
      name: file.name,
      sizeLabel: sizeKb >= 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`,
      mimeType: file.type || 'application/octet-stream',
    };
    setDraftAttachments((prev) => [...prev, att]);
    e.target.value = '';
  };

  const handleAddMockAttachment = () => {
    setDraftAttachments((prev) => [
      ...prev,
      {
        id: `att_mock_${Date.now()}`,
        name: `support-doc-${toFa(prev.length + 1)}.pdf`,
        sizeLabel: '240 KB',
        mimeType: 'application/pdf',
      },
    ]);
  };

  const handleSend = (e: React.FormEvent, closeAfter = false) => {
    e.preventDefault();
    if (!msgBody.trim() && draftAttachments.length === 0) return;
    const authorName =
      msgAuthorType === 'customer'
        ? customer?.name ?? 'مشتری'
        : ticket.assignee || state.settings.salesTeam[0] || 'کارشناس پشتیبانی';

    addTicketMessage(ticket.id, {
      authorName,
      authorType: msgAuthorType,
      visibility: msgVisibility,
      body: msgBody,
      attachments: draftAttachments.length > 0 ? draftAttachments : undefined,
    });

    if (closeAfter) {
      updateTicket(ticket.id, { status: 'resolved' });
    }
    setMsgBody('');
    setDraftAttachments([]);
  };

  const slaTone = (st: typeof slaEval.overallState) =>
    st === 'breached'
      ? 'border-rose-200 bg-rose-50/70 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300'
      : st === 'warning'
        ? 'border-amber-200 bg-amber-50/70 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300'
        : 'border-emerald-200 bg-emerald-50/60 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300';

  return (
    <Modal
      open={Boolean(ticket)}
      onClose={onClose}
      title={`${ticket.trackingCode ?? ticket.id} · ${ticket.subject}`}
      maxWidth="xl"
    >
      <div className="space-y-4">
        {/* Live SLA Strip */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className={`rounded-xl border p-3 text-xs ${slaTone(slaEval.firstRespState)}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1 font-semibold">
                <Clock size={14} />
                SLA پاسخ اول ({toFa(slaEval.firstRespTargetMin)} د کاری)
              </span>
              <span className="font-bold tabular-nums whitespace-nowrap">
                {ticket.firstRespondedAt
                  ? `پاسخ داده‌شده (${toFa(slaEval.firstRespElapsedMin)} د)`
                  : formatRemainingMinutesFa(slaEval.firstRespRemainingMin)}
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/70 dark:bg-slate-800">
              <div
                className={`h-full rounded-full ${
                  slaEval.firstRespState === 'breached'
                    ? 'bg-rose-500'
                    : slaEval.firstRespState === 'warning'
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, slaEval.firstRespPct)}%` }}
              />
            </div>
          </div>

          <div className={`rounded-xl border p-3 text-xs ${slaTone(slaEval.resolutionState)}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1 font-semibold">
                <Clock size={14} />
                SLA حل نهایی ({toFa(Math.round(slaEval.resolutionTargetMin / 60))} ساعت کاری)
              </span>
              <span className="font-bold tabular-nums whitespace-nowrap">
                {isTicketClosedStatus(ticket.status)
                  ? `حل در ${toFa(slaEval.resolutionElapsedMin)} د`
                  : formatRemainingMinutesFa(slaEval.resolutionRemainingMin)}
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/70 dark:bg-slate-800">
              <div
                className={`h-full rounded-full ${
                  slaEval.resolutionState === 'breached'
                    ? 'bg-rose-500'
                    : slaEval.resolutionState === 'warning'
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, slaEval.resolutionPct)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Properties Row */}
        <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs dark:border-slate-800 dark:bg-slate-800/40 sm:grid-cols-6">
          <div>
            <span className="text-slate-500">مشتری / کانال</span>
            <div className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
              {customer?.name ?? 'مشتری'}
              <span className="mr-1 font-normal text-slate-500">
                ({TICKET_CHANNEL_LABEL[ticket.channel ?? 'portal']})
              </span>
            </div>
          </div>
          <div>
            <span className="text-slate-500">وضعیت</span>
            <select
              value={ticket.status}
              onChange={(e) => updateTicket(ticket.id, { status: e.target.value as TicketStatus })}
              className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
            >
              {(Object.keys(TICKET_STATUS_LABEL) as TicketStatus[]).map((st) => (
                <option key={st} value={st}>
                  {TICKET_STATUS_LABEL[st]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <span className="text-slate-500">اولویت / شدت</span>
            <div className="mt-1 flex gap-1">
              <select
                value={ticket.priority}
                onChange={(e) => updateTicket(ticket.id, { priority: e.target.value as Ticket['priority'] })}
                className="w-1/2 rounded border border-slate-200 bg-white px-1.5 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
              >
                <option value="low">کم</option>
                <option value="normal">عادی</option>
                <option value="high">فوری</option>
              </select>
              <select
                value={ticket.severity ?? 'minor'}
                onChange={(e) => updateTicket(ticket.id, { severity: e.target.value as TicketSeverity })}
                className="w-1/2 rounded border border-slate-200 bg-white px-1.5 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
              >
                <option value="minor">جزئی</option>
                <option value="major">مهم</option>
                <option value="critical">بحرانی</option>
              </select>
            </div>
          </div>
          <div>
            <span className="text-slate-500">تیم</span>
            <select
              value={ticket.team ?? SUPPORT_TEAMS[0]}
              onChange={(e) => updateTicket(ticket.id, { team: e.target.value })}
              className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
            >
              {SUPPORT_TEAMS.map((tm) => (
                <option key={tm} value={tm}>
                  {tm}
                </option>
              ))}
            </select>
          </div>
          <div>
            <span className="text-slate-500">کارشناس مسئول</span>
            <select
              value={ticket.assignee ?? ''}
              onChange={(e) => updateTicket(ticket.id, { assignee: e.target.value })}
              className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
            >
              {agents.map((ag) => (
                <option key={ag} value={ag}>
                  {ag}
                </option>
              ))}
            </select>
          </div>
          <div>
            <span className="text-slate-500">علت ریشه‌ای</span>
            <select
              value={ticket.rootCause ?? ''}
              onChange={(e) => updateTicket(ticket.id, { rootCause: e.target.value })}
              className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="">انتخاب...</option>
              {ROOT_CAUSES.map((rc) => (
                <option key={rc} value={rc}>
                  {rc}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Complaint & Escalation Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 text-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-1.5 font-medium text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                checked={Boolean(ticket.isComplaint)}
                onChange={(e) =>
                  updateTicket(ticket.id, {
                    isComplaint: e.target.checked,
                    complaintStatus: e.target.checked ? ticket.complaintStatus || 'investigating' : undefined,
                  })
                }
                className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
              />
              ثبت به‌عنوان شکایت رسمی
            </label>

            {ticket.isComplaint && (
              <>
                <select
                  aria-label="وضعیت شکایت"
                  value={ticket.complaintStatus ?? 'investigating'}
                  onChange={(e) =>
                    updateTicket(ticket.id, { complaintStatus: e.target.value as ComplaintStatus })
                  }
                  className="rounded border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="investigating">در حال بررسی</option>
                  <option value="resolved">حل و فصل شده</option>
                  <option value="compensated">جبران خسارت شده</option>
                </select>
                <input
                  value={ticket.complaintResolution ?? ''}
                  onChange={(e) => updateTicket(ticket.id, { complaintResolution: e.target.value })}
                  placeholder="اقدام اصلاحی / جبران خسارت..."
                  className="w-60 rounded border border-slate-200 bg-white px-2.5 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!ticket.escalated && !isTicketClosedStatus(ticket.status) && (
              <button
                type="button"
                onClick={() => escalateTicket(ticket.id)}
                className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300"
              >
                <ShieldAlert size={13} />
                تصعید به مدیر پشتیبانی
              </button>
            )}
            <button
              type="button"
              onClick={() =>
                createWorkflowInstance({
                  title: `رسیدگی شکایت/تیکت ${ticket.trackingCode ?? ''}: ${ticket.subject}`,
                  type: 'complaint',
                  customerId: ticket.customerId,
                  relatedRef: ticket.id,
                })
              }
              className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 dark:border-indigo-900/50 dark:bg-indigo-950/30 dark:text-indigo-300"
            >
              <GitBranch size={13} />
              ارجاع به گردش کار (BPMS)
            </button>
          </div>
        </div>

        {/* Ticket-level attachments + Merge duplicate */}
        {((ticket.attachments && ticket.attachments.length > 0) || duplicates.length > 0) && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-800/30">
            {ticket.attachments && ticket.attachments.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-slate-500">فایل‌های ضمیمه تیکت:</span>
                {ticket.attachments.map((att) => (
                  <span
                    key={att.id}
                    className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-0.5 text-[11px] dark:border-slate-700 dark:bg-slate-900"
                  >
                    <Paperclip size={11} className="text-indigo-500" />
                    <span dir="ltr">{att.name}</span>
                    <span className="text-slate-400">({att.sizeLabel})</span>
                  </span>
                ))}
              </div>
            )}
            {duplicates.length > 0 && (
              <div className="flex items-center gap-2">
                <GitMerge size={14} className="text-amber-600" />
                <select
                  value={mergeTargetId}
                  onChange={(e) => setMergeTargetId(e.target.value)}
                  className="rounded border border-amber-300 bg-white px-2 py-1 text-xs dark:border-amber-800 dark:bg-slate-900"
                >
                  <option value="">ادغام تیکت تکراری هم‌مشتری...</option>
                  {duplicates.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.trackingCode ?? d.id} — {d.subject}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!mergeTargetId}
                  onClick={() => {
                    if (!mergeTargetId) return;
                    mergeTickets(ticket.id, mergeTargetId);
                    setMergeTargetId('');
                  }}
                  className="rounded-lg bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-40"
                >
                  ادغام
                </button>
              </div>
            )}
          </div>
        )}

        {/* Messages Thread */}
        <div className="max-h-60 space-y-2.5 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-950/30">
          {messages.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-400">
              هنوز پیامی در رشته این تیکت ثبت نشده است.
            </p>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={`rounded-lg border p-3 text-xs ${
                  m.visibility === 'internal'
                    ? 'border-amber-200 bg-amber-50/70 dark:border-amber-900/50 dark:bg-amber-950/20'
                    : m.authorType === 'customer'
                      ? 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
                      : 'border-indigo-200 bg-indigo-50/60 dark:border-indigo-900/50 dark:bg-indigo-950/20'
                }`}
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {m.authorName} ·{' '}
                    {m.visibility === 'internal' ? (
                      <span className="inline-flex items-center gap-0.5 text-amber-700 dark:text-amber-300">
                        <Lock size={11} />
                        یادداشت داخلی
                      </span>
                    ) : m.authorType === 'customer' ? (
                      'پیام مشتری'
                    ) : (
                      'پاسخ عمومی کارشناس'
                    )}
                  </span>
                  <span className="tabular-nums text-[11px] text-slate-400">
                    {formatJalaliDateTime(m.createdAt)}
                  </span>
                </div>
                <p className="leading-relaxed text-slate-700 dark:text-slate-300">{m.body}</p>
                {m.attachments && m.attachments.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {m.attachments.map((att) => (
                      <span
                        key={att.id}
                        className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white/80 px-2 py-0.5 text-[11px] dark:border-slate-700 dark:bg-slate-800"
                      >
                        <Paperclip size={10} className="text-indigo-500" />
                        <span dir="ltr">{att.name}</span>
                        <span className="text-slate-400">({att.sizeLabel})</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Smart KB Suggestions while replying */}
        {suggestedArticles.length > 0 && (
          <div className="rounded-xl border border-indigo-200/80 bg-indigo-50/40 p-3 dark:border-indigo-900/50 dark:bg-indigo-950/20">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
              <Sparkles size={14} />
              پیشنهاد مقالات مرتبط پایگاه دانش برای پاسخ سریع:
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {suggestedArticles.map((art) => (
                <div
                  key={art.id}
                  className="flex flex-col justify-between rounded-lg border border-slate-200 bg-white p-2.5 text-xs dark:border-slate-800 dark:bg-slate-900"
                >
                  <div>
                    <div className="flex items-center gap-1 font-semibold text-slate-800 dark:text-slate-100">
                      <BookOpen size={12} className="shrink-0 text-indigo-500" />
                      <span className="truncate">{art.title}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[11px] text-slate-500 dark:text-slate-400">
                      {art.body}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setMsgBody((prev) =>
                        prev ? `${prev}\n\nراهنما (${art.title}): ${art.body}` : `${art.body}`,
                      )
                    }
                    className="mt-2 self-start text-[11px] font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                  >
                    + درج متن در پاسخ
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI Reply & Triage Assistant (Human Approval Required) */}
        {state.settings.ai?.enabled !== false && (
          <div className="space-y-2 rounded-xl border border-indigo-200/80 bg-indigo-50/30 p-3 text-xs dark:border-indigo-900/50 dark:bg-indigo-950/20">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 font-semibold text-indigo-800 dark:text-indigo-200">
                <Sparkles size={14} className="text-indigo-600 dark:text-indigo-400" />
                <span>دستیار پاسخ و طبقه‌بندی تیکت (نیاز به تأیید کارشناس پیش از ارسال)</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={aiReplyLoading}
                  onClick={async () => {
                    setAiError('');
                    setAiReplyLoading(true);
                    const res = await suggestTicketCategoryAndPriority(
                      state,
                      ticket.subject,
                      messages[0]?.body ?? '',
                      logAiUsage,
                    );
                    setAiReplyLoading(false);
                    if (!res.ok) setAiError(res.error);
                    else setAiTriageResult(res.data);
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  پیشنهاد دسته و اولویت (AI)
                </button>
                <button
                  type="button"
                  disabled={aiReplyLoading}
                  onClick={async () => {
                    setAiError('');
                    setAiReplyLoading(true);
                    const res = await suggestTicketReply(
                      state,
                      ticket,
                      customer,
                      messages,
                      state.kbArticles,
                      logAiUsage,
                    );
                    setAiReplyLoading(false);
                    if (!res.ok) setAiError(res.error);
                    else setAiReplyDraft({ data: res.data, mode: res.meta.mode });
                  }}
                  className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1 text-[11px] font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
                >
                  <Sparkles size={12} />
                  {aiReplyLoading ? 'در حال نگارش...' : 'پیشنهاد پاسخ هوشمند (AI)'}
                </button>
              </div>
            </div>

            {aiError && <p className="text-rose-600 dark:text-rose-400">{aiError}</p>}

            {aiTriageResult && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-900">
                <div>
                  <span className="ml-2 rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                    AI-generated
                  </span>
                  <span>
                    پیشنهاد: دسته «{aiTriageResult.category}» · اولویت «{aiTriageResult.priority}» · شدت «{aiTriageResult.severity}» — {aiTriageResult.reason}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    updateTicket(ticket.id, {
                      category: aiTriageResult.category,
                      priority: aiTriageResult.priority,
                      severity: aiTriageResult.severity,
                    });
                    setAiTriageResult(null);
                  }}
                  className="rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-emerald-700"
                >
                  اعمال در تیکت
                </button>
              </div>
            )}

            {aiReplyDraft && (
              <div className="space-y-2 rounded-lg border border-indigo-200 bg-white p-3 dark:border-indigo-800 dark:bg-slate-900">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[10px]">
                  <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                    تولیدشده با هوش مصنوعی (AI-generated · {aiReplyDraft.mode === 'gemini' ? 'Gemini' : 'Fallback'}) · لحن: {aiReplyDraft.data.toneNote}
                  </span>
                  <span className="text-amber-700 dark:text-amber-300">
                    پیش‌نویس تا پیش از تأیید شما ارسال نمی‌شود
                  </span>
                </div>
                <p className="whitespace-pre-line rounded bg-slate-50 p-2.5 leading-relaxed text-slate-700 dark:bg-slate-800/60 dark:text-slate-200">
                  {aiReplyDraft.data.draftReply}
                </p>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setAiReplyDraft(null)}
                    className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] text-slate-600 dark:border-slate-700 dark:text-slate-300"
                  >
                    رد کردن
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMsgVisibility('public');
                      setMsgAuthorType('agent');
                      setMsgBody(aiReplyDraft.data.draftReply);
                      setAiReplyDraft(null);
                    }}
                    className="rounded-lg bg-emerald-600 px-3 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700"
                  >
                    تأیید و درج در کادر پاسخ
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Composer */}
        <form onSubmit={(e) => handleSend(e, false)} className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setMsgVisibility('public');
                  setMsgAuthorType('agent');
                }}
                className={`rounded-lg px-2.5 py-1 font-medium ${
                  msgVisibility === 'public' && msgAuthorType === 'agent'
                    ? 'bg-indigo-600 text-white'
                    : 'border border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300'
                }`}
              >
                پاسخ عمومی کارشناس
              </button>
              <button
                type="button"
                onClick={() => {
                  setMsgVisibility('internal');
                  setMsgAuthorType('agent');
                }}
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 font-medium ${
                  msgVisibility === 'internal'
                    ? 'bg-amber-600 text-white'
                    : 'border border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300'
                }`}
              >
                <Lock size={12} />
                یادداشت داخلی
              </button>
              <button
                type="button"
                onClick={() => {
                  setMsgVisibility('public');
                  setMsgAuthorType('customer');
                }}
                className={`rounded-lg px-2.5 py-1 font-medium ${
                  msgAuthorType === 'customer'
                    ? 'bg-emerald-600 text-white'
                    : 'border border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300'
                }`}
              >
                شبیه‌سازی پاسخ مشتری
              </button>
            </div>

            <select
              value=""
              onChange={(e) => {
                if (e.target.value) setMsgBody(e.target.value);
              }}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="">درج پاسخ آماده...</option>
              {CANNED_RESPONSES.map((c, i) => (
                <option key={i} value={c}>
                  {c.slice(0, 42)}...
                </option>
              ))}
            </select>
          </div>

          <textarea
            rows={3}
            value={msgBody}
            onChange={(e) => setMsgBody(e.target.value)}
            placeholder={
              msgVisibility === 'internal'
                ? 'یادداشت محرمانه داخلی برای همکاران پشتیبانی...'
                : 'متن پاسخ به مشتری را بنویسید...'
            }
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
          />

          {draftAttachments.length > 0 && (
            <div className="flex flex-wrap gap-2 text-xs">
              {draftAttachments.map((att) => (
                <span
                  key={att.id}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 dark:border-slate-700 dark:bg-slate-800"
                >
                  <Paperclip size={12} className="text-indigo-500" />
                  <span dir="ltr">{att.name}</span>
                  <span className="text-slate-400">({att.sizeLabel})</span>
                  <button
                    type="button"
                    onClick={() => setDraftAttachments((prev) => prev.filter((x) => x.id !== att.id))}
                    className="text-rose-500 hover:text-rose-700"
                  >
                    <Trash2 size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                <Paperclip size={13} />
                انتخاب فایل پیوست
                <input type="file" className="hidden" onChange={handleFileChange} />
              </label>
              <button
                type="button"
                onClick={handleAddMockAttachment}
                className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                + ضمیمه نمونه
              </button>
              {slaEval.overallState === 'warning' && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                  <AlertTriangle size={13} />
                  در آستانه عبور از مهلت SLA
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {!isTicketClosedStatus(ticket.status) && msgAuthorType === 'agent' && msgVisibility === 'public' && (
                <button
                  type="button"
                  onClick={(e) => handleSend(e, true)}
                  className="rounded-lg border border-emerald-600 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
                >
                  ارسال و حل تیکت
                </button>
              )}
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
              >
                <Send size={13} />
                ثبت پیام
              </button>
            </div>
          </div>
        </form>
      </div>
    </Modal>
  );
}
