import { useState } from 'react';
import {
  ArrowUpLeft,
  Bot,
  ExternalLink,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import {
  askTenantAiChat,
  getAiMissingKeyFriendlyNotice,
  isGeminiApiKeyConfigured,
  type AiExecutionMeta,
} from '../../services/aiService';
import { useClientFlow } from '../../store/useClientFlowStore';
import type { AiRecordReference } from '../../utils/aiRetrieval';
import { toFa } from '../../utils/jalali';
import { getEffectiveUserAndRole } from '../../utils/security';

interface ChatTurn {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  references?: AiRecordReference[];
  meta?: AiExecutionMeta;
  error?: boolean;
}

interface DockedAiChatProps {
  onNavigateToRecord: (ref: AiRecordReference) => void;
  onOpenAiCenter: () => void;
}

const QUICK_PROMPTS = [
  'برترین مشتریان VIP با بیشترین خرید چه کسانی هستند؟',
  'وضعیت تیکت‌های باز و هشدار SLA چگونه است؟',
  'کدام سفارش‌ها تأخیر (معوقه) دارند؟',
  'سرنخ‌های با بالاترین امتیاز کدامند؟',
];

const ENTITY_BADGE_LABELS: Record<AiRecordReference['entityType'], string> = {
  customer: 'مشتری',
  order: 'سفارش',
  ticket: 'تیکت',
  kb: 'پایگاه دانش',
  lead: 'سرنخ',
  appointment: 'نوبت',
};

export function DockedAiChat({ onNavigateToRecord, onOpenAiCenter }: DockedAiChatProps) {
  const { state, logAiUsage } = useClientFlow();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [turns, setTurns] = useState<ChatTurn[]>([]);

  const aiEnabled = state.settings.ai?.enabled !== false;
  const hasKey = isGeminiApiKeyConfigured();
  const { activeRole, effectiveScope } = getEffectiveUserAndRole(state);

  const sendQuestion = async (rawQ: string) => {
    const q = rawQ.trim();
    if (!q || loading) return;

    const userTurn: ChatTurn = {
      id: `u_${Date.now()}`,
      role: 'user',
      text: q,
    };
    setTurns((prev) => [...prev, userTurn]);
    setInput('');
    setLoading(true);

    const res = await askTenantAiChat(state, q, logAiUsage);
    setLoading(false);

    if (!res.ok) {
      setTurns((prev) => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          role: 'assistant',
          text: res.error,
          error: true,
        },
      ]);
      return;
    }

    setTurns((prev) => [
      ...prev,
      {
        id: `a_${Date.now()}`,
        role: 'assistant',
        text: res.data.answer,
        references: res.data.references,
        meta: res.meta,
      },
    ]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void sendQuestion(input);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="باز کردن دستیار هوشمند AI"
        className="print-hidden fixed bottom-5 left-5 z-40 inline-flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-600/25 transition-transform hover:scale-[1.02] hover:bg-indigo-700"
      >
        <Sparkles size={15} />
        <span>دستیار هوشمند AI</span>
      </button>
    );
  }

  return (
    <div
      role="dialog"
      aria-label="دستیار هوشمند داده‌های سازمان"
      className="print-hidden fixed bottom-5 left-5 z-50 flex h-[540px] w-[min(92vw,410px)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-indigo-600 px-4 py-3 text-white dark:border-slate-800">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15">
            <Bot size={17} />
          </div>
          <div className="min-w-0">
            <div className="truncate text-xs font-bold">دستیار هوشمند {state.settings.businessName}</div>
            <div className="flex items-center gap-1.5 text-[10px] text-indigo-100">
              <ShieldCheck size={11} />
              <span>
                RBAC: {activeRole?.name ?? state.settings.role} ({effectiveScope})
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onOpenAiCenter();
            }}
            title="گزارش مصرف و ارزیابی AI"
            className="rounded-md p-1.5 text-indigo-100 hover:bg-white/15 hover:text-white"
          >
            <ExternalLink size={14} />
          </button>
          {turns.length > 0 && (
            <button
              type="button"
              onClick={() => setTurns([])}
              title="پاک کردن گفتگو"
              className="rounded-md p-1.5 text-indigo-100 hover:bg-white/15 hover:text-white"
            >
              <Trash2 size={14} />
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="بستن دستیار AI"
            className="rounded-md p-1.5 text-indigo-100 hover:bg-white/15 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Mode / Guardrail Banner */}
      {!aiEnabled ? (
        <div className="border-b border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
          دستیار هوش مصنوعی در تنظیمات سیستم غیرفعال شده است.
        </div>
      ) : !hasKey ? (
        <div className="border-b border-amber-200 bg-amber-50/90 px-3 py-2 text-[11px] leading-relaxed text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
          {getAiMissingKeyFriendlyNotice()}
        </div>
      ) : (
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-3 py-1.5 text-[10px] text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
          <span>مدل متصل: Gemini 4 (ماسک PII فعال)</span>
          <span>پاسخ فقط از داده‌های مجاز</span>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 space-y-3 overflow-y-auto p-3.5 text-xs">
        {turns.length === 0 ? (
          <div className="space-y-3 py-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-slate-600 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-300">
              <p className="font-semibold text-slate-800 dark:text-slate-100">
                سوال خود را درباره داده‌های همین کسب‌وکار بپرسید:
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                پاسخ‌ها فقط بر اساس سوابق مشتریان، سفارش‌ها، تیکت‌ها و پایگاه دانش در محدوده مجوز نقش فعلی تولید می‌شوند و با لینک مستقیم به پرونده‌ها همراهند.
              </p>
            </div>
            <div className="space-y-1.5">
              <div className="text-[11px] font-medium text-slate-400">پرسش‌های سریع:</div>
              {QUICK_PROMPTS.map((qp) => (
                <button
                  key={qp}
                  type="button"
                  disabled={loading}
                  onClick={() => void sendQuestion(qp)}
                  className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-right text-[11px] font-medium text-slate-700 transition-colors hover:border-indigo-300 hover:bg-indigo-50/60 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-indigo-700 dark:hover:bg-indigo-950/30"
                >
                  {qp}
                </button>
              ))}
            </div>
          </div>
        ) : (
          turns.map((turn) => (
            <div
              key={turn.id}
              className={`flex flex-col ${turn.role === 'user' ? 'items-start' : 'items-end'}`}
            >
              <div
                className={`max-w-[92%] rounded-xl px-3.5 py-2.5 leading-relaxed ${
                  turn.role === 'user'
                    ? 'bg-indigo-600 text-white'
                    : turn.error
                      ? 'border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300'
                      : 'border border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-800 dark:bg-slate-800/70 dark:text-slate-100'
                }`}
              >
                {turn.role === 'assistant' && !turn.error && (
                  <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/70 pb-1 text-[10px] dark:border-slate-700">
                    <span className="inline-flex items-center gap-1 font-semibold text-indigo-600 dark:text-indigo-400">
                      <Sparkles size={10} />
                      تولیدشده با هوش مصنوعی (AI-generated)
                    </span>
                    {turn.meta && (
                      <span className="tabular-nums text-slate-400">
                        {turn.meta.mode === 'gemini' ? 'Gemini' : 'Rule-based'} · {toFa(turn.meta.latencyMs)} ms
                      </span>
                    )}
                  </div>
                )}

                <div className="whitespace-pre-line">{turn.text}</div>

                {turn.references && turn.references.length > 0 && (
                  <div className="mt-2.5 space-y-1.5 border-t border-slate-200/70 pt-2 dark:border-slate-700">
                    <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                      رکوردهای مرجع (کلیک برای باز کردن):
                    </div>
                    {turn.references.map((ref) => (
                      <button
                        key={ref.id}
                        type="button"
                        onClick={() => onNavigateToRecord(ref)}
                        className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-right transition-colors hover:border-indigo-400 hover:bg-indigo-50/50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-indigo-700"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[9px] font-semibold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                              {ENTITY_BADGE_LABELS[ref.entityType]}
                            </span>
                            <span className="truncate text-[11px] font-semibold text-slate-800 dark:text-slate-100">
                              {ref.title}
                            </span>
                          </div>
                          <div className="mt-0.5 truncate text-[10px] text-slate-500 dark:text-slate-400">
                            {ref.subtitle}
                          </div>
                        </div>
                        <ArrowUpLeft size={13} className="shrink-0 text-indigo-500" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        {loading && (
          <div className="text-center text-[11px] text-slate-400">
            در حال بررسی داده‌های مجاز و آماده‌سازی پاسخ...
          </div>
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 border-t border-slate-200 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-900"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={!aiEnabled || loading}
          placeholder={aiEnabled ? 'سوال فارسی درباره مشتریان، تیکت‌ها یا سفارش‌ها...' : 'AI در تنظیمات غیرفعال است'}
          className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800"
        />
        <button
          type="submit"
          disabled={!aiEnabled || loading || !input.trim()}
          aria-label="ارسال سوال"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40"
        >
          <Send size={14} />
        </button>
      </form>
    </div>
  );
}
