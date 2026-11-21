import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { TICKET_CATEGORIES } from '../components/support/supportHelpers';
import type {
  AiBrandTone,
  AiFeatureKey,
  AiUsageLogEntry,
  AppState,
  ContentItem,
  Customer,
  CustomerSavedViewFilter,
  KbArticle,
  NotificationChannel,
  SegmentCondition,
  Ticket,
  TicketMessage,
  TicketSeverity,
} from '../types';
import {
  AI_BRAND_TONE_LABELS,
  DEFAULT_AI_CONFIG,
  PROMPT_INJECTION_SYSTEM_GUARD,
  scrubPiiFromText,
  validateAiCustomerFilterJson,
  wrapUntrustedDataBlock,
} from '../utils/aiGuardrails';
import { retrieveTenantKnowledge, type AiRecordReference } from '../utils/aiRetrieval';
import { computeCustomerStats, computeLeadScoreHint } from '../utils/crmHelpers';
import { formatJalali, formatToman, isSameDay, toFa } from '../utils/jalali';
import { getEffectiveUserAndRole } from '../utils/security';
import { isTicketClosedStatus, suggestKbArticlesForTicket } from '../utils/slaEngine';

const ENV_GEMINI_KEY = (import.meta.env.VITE_GEMINI_API_KEY as string | undefined)?.trim() || '';

export function isGeminiApiKeyConfigured(): boolean {
  return ENV_GEMINI_KEY.length > 0;
}

export function getAiMissingKeyFriendlyNotice(): string {
  return 'کلید VITE_GEMINI_API_KEY در متغیرهای محیطی تعریف نشده است؛ پاسخ‌ها به‌صورت خودکار با موتور جایگزین قاعده‌محور (Rule-based) روی داده‌های همین سازمان تولید می‌شوند.';
}

export type AiExecutionMeta = {
  mode: 'gemini' | 'fallback';
  model: string;
  fallbackReason?: string;
  piiRedactedCount: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
};

export type AiCallResult<T> =
  | {
      ok: true;
      data: T;
      meta: AiExecutionMeta;
    }
  | {
      ok: false;
      blockedBySettings?: boolean;
      error: string;
    };

export type AiLogger = (entry: Omit<AiUsageLogEntry, 'id' | 'createdAt'>) => void;

function estimateTokens(text: string): number {
  return Math.max(8, Math.ceil(text.length / 3.2));
}

async function runWithGeminiOrFallback<T>(opts: {
  state: AppState;
  feature: AiFeatureKey;
  promptPreview: string;
  systemInstruction: string;
  userPrompt: string;
  responseSchema?: Record<string, unknown>;
  piiRedactedCount: number;
  parseGeminiText: (rawText: string) => T | null;
  fallback: () => T;
  onLog?: AiLogger;
}): Promise<AiCallResult<T>> {
  const startMs = performance.now();
  const aiCfg = opts.state.settings.ai ?? DEFAULT_AI_CONFIG;
  const { activeUser, activeRole } = getEffectiveUserAndRole(opts.state);
  const actorName = activeUser?.name ?? 'کاربر سیستم';
  const actorRole = activeRole?.name ?? opts.state.settings.role;

  if (!aiCfg.enabled) {
    if (opts.onLog && aiCfg.logUsage) {
      opts.onLog({
        feature: opts.feature,
        mode: 'fallback',
        model: aiCfg.model || 'gemini-4-hydrogen',
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        piiRedactedCount: opts.piiRedactedCount,
        latencyMs: 0,
        actorName,
        actorRole,
        promptPreview: opts.promptPreview.slice(0, 120),
        status: 'blocked',
      });
    }
    return {
      ok: false,
      blockedBySettings: true,
      error: 'دستیار هوش مصنوعی در تنظیمات سیستم غیرفعال است. برای استفاده، آن را از «تنظیمات > تنظیمات AI» فعال کنید.',
    };
  }

  let resultData: T | null = null;
  let mode: 'gemini' | 'fallback' = 'fallback';
  let fallbackReason: string | undefined = ENV_GEMINI_KEY
    ? undefined
    : getAiMissingKeyFriendlyNotice();
  let promptTokens = estimateTokens(opts.systemInstruction + opts.userPrompt);
  let completionTokens = 0;

  if (ENV_GEMINI_KEY) {
    try {
      const ai = new GoogleGenAI({ apiKey: ENV_GEMINI_KEY });
      const config: Record<string, unknown> = {
        systemInstruction: opts.systemInstruction,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      };
      if (opts.responseSchema) {
        config.responseMimeType = 'application/json';
        config.responseSchema = opts.responseSchema;
      }

      const response = await ai.models.generateContent({
        model: aiCfg.model || 'gemini-4-hydrogen',
        contents: opts.userPrompt,
        config,
      });

      const rawText = (response.text ?? '').trim();
      const parsed = rawText ? opts.parseGeminiText(rawText) : null;
      if (parsed !== null) {
        resultData = parsed;
        mode = 'gemini';
        fallbackReason = undefined;
        const usage = response.usageMetadata;
        if (usage) {
          promptTokens = usage.promptTokenCount ?? promptTokens;
          completionTokens = usage.candidatesTokenCount ?? estimateTokens(rawText);
        } else {
          completionTokens = estimateTokens(rawText);
        }
      } else {
        fallbackReason = 'پاسخ مدل ساختار قابل تجزیه نداشت؛ موتور جایگزین قاعده‌محور استفاده شد.';
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'خطای ارتباط با سرویس Gemini';
      fallbackReason = `ارتباط با Gemini برقرار نشد (${msg.slice(0, 80)}) — پاسخ با موتور قاعده‌محور تولید شد.`;
    }
  }

  if (resultData === null) {
    resultData = opts.fallback();
    mode = 'fallback';
    completionTokens = estimateTokens(JSON.stringify(resultData));
  }

  const latencyMs = Math.max(1, Math.round(performance.now() - startMs));
  const totalTokens = promptTokens + completionTokens;

  if (opts.onLog && aiCfg.logUsage) {
    opts.onLog({
      feature: opts.feature,
      mode,
      model: mode === 'gemini' ? aiCfg.model || 'gemini-4-hydrogen' : 'rule-based-fallback-v1',
      promptTokens,
      completionTokens,
      totalTokens,
      piiRedactedCount: opts.piiRedactedCount,
      latencyMs,
      actorName,
      actorRole,
      promptPreview: scrubPiiFromText(opts.promptPreview).sanitized.slice(0, 120),
      status: mode === 'gemini' ? 'success' : 'fallback',
    });
  }

  return {
    ok: true,
    data: resultData,
    meta: {
      mode,
      model: mode === 'gemini' ? aiCfg.model || 'gemini-4-hydrogen' : 'rule-based-fallback-v1',
      fallbackReason,
      piiRedactedCount: opts.piiRedactedCount,
      promptTokens,
      completionTokens,
      totalTokens,
      latencyMs,
    },
  };
}

// 1) Docked Tenant RAG Chat
export type AiChatResponse = {
  answer: string;
  references: AiRecordReference[];
};

export async function askTenantAiChat(
  state: AppState,
  question: string,
  onLog?: AiLogger,
): Promise<AiCallResult<AiChatResponse>> {
  const maskPii = state.settings.ai?.maskPiiBeforeSend !== false;
  const knowledge = retrieveTenantKnowledge(state, question);
  const { block, redactedCount } = wrapUntrustedDataBlock(
    'tenant_scoped_context',
    knowledge.contextSummaryForPrompt,
    maskPii,
  );
  const cleanQ = scrubPiiFromText(question);
  const totalRedacted = redactedCount + (maskPii ? cleanQ.redactedCount : 0);

  return runWithGeminiOrFallback<AiChatResponse>({
    state,
    feature: 'chat_rag',
    promptPreview: question,
    piiRedactedCount: totalRedacted,
    systemInstruction:
      `${PROMPT_INJECTION_SYSTEM_GUARD}\n` +
      'شما دستیار هوشمند CRM ClientFlow هستید. فقط بر اساس داده‌های مجاز (RBAC) درون <untrusted_crm_data> به فارسی دقیق و کوتاه پاسخ دهید. اگر بخش یا داده‌ای RESTRICTED_BY_RBAC است، حتماً اعلام کنید که نقش فعلی مجوز مشاهده آن بخش را ندارد.',
    userPrompt: `پرسش کاربر: ${maskPii ? cleanQ.sanitized : question}\n\nداده‌های مجاز سازمان:\n${block}`,
    parseGeminiText: (txt) => ({
      answer: txt,
      references: knowledge.matchedReferences,
    }),
    fallback: () => {
      const q = question.trim();
      const lines: string[] = [];

      // Check prompt-injection attempt explicitly
      if (/ignore\s+(all\s+)?previous|نادیده\s*بگیر|system\s*:/i.test(q)) {
        return {
          answer:
            'درخواست شما حاوی الگوی دستور سیستمی خارج از چارچوب بود و بر اساس گاردریل امنیتی مسدود شد. داده‌های CRM صرفاً به عنوان داده غیرقابل‌اجرا بررسی می‌شوند و اطلاعات محرمانه (PII) افشا نمی‌شود.',
          references: [],
        };
      }

      if (/vip|بیشترین خرید|مشتری برتر|مشتریان برتر|فروش بالا/i.test(q)) {
        if (!knowledge.canViewCustomers) {
          return {
            answer: 'نقش کاربری فعلی شما مجوز مشاهده فهرست مشتریان (customers:view) را ندارد.',
            references: [],
          };
        }
        const vips = knowledge.vipCustomers.filter((v) => v.customer.lifecycle === 'vip' || v.totalSpent > 0).slice(0, 4);
        if (vips.length === 0) {
          lines.push('در محدوده دسترسی شعبه/نقش فعلی شما مشتری فعالی یافت نشد.');
        } else {
          lines.push(`برترین مشتریان در محدوده دسترسی فعلی (${knowledge.scopeLabel}):`);
          vips.forEach((v, i) => {
            lines.push(
              `${toFa(i + 1)}. ${v.customer.name} — مجموع خرید ${formatToman(v.totalSpent)} (امتیاز ${toFa(v.score)})`,
            );
          });
        }
      } else if (/تیکت|sla|پشتیبانی|نقض|شکایت/i.test(q)) {
        if (!knowledge.canViewTickets) {
          return {
            answer: 'نقش فعلی شما مجوز دسترسی به ماژول تیکت و پشتیبانی (tickets:view) را ندارد.',
            references: [],
          };
        }
        const openCount = knowledge.tickets.filter((t) => !isTicketClosedStatus(t.status)).length;
        lines.push(
          `تعداد کل تیکت‌های مجاز: ${toFa(knowledge.tickets.length)} مورد (${toFa(openCount)} تیکت باز).`,
        );
        if (knowledge.slaRiskTickets.length > 0) {
          lines.push(
            `${toFa(knowledge.slaRiskTickets.length)} تیکت در وضعیت هشدار یا نقض SLA قرار دارند:`,
          );
          knowledge.slaRiskTickets.slice(0, 4).forEach((item) => {
            lines.push(
              `• ${item.ticket.trackingCode ?? item.ticket.id} (${item.ticket.subject}) — وضعیت SLA: ${
                item.slaState === 'breached' ? 'نقض‌شده' : 'هشدار'
              }`,
            );
          });
        } else {
          lines.push('در حال حاضر هیچ تیکتی دچار هشدار یا نقض SLA نشده است.');
        }
      } else if (/سفارش|معوق|تأخیر|تاخیر|ارسال/i.test(q)) {
        if (!knowledge.canViewOrders) {
          return {
            answer: 'نقش فعلی شما مجوز مشاهده سفارش‌ها (orders:view) را ندارد.',
            references: [],
          };
        }
        lines.push(
          `تعداد سفارش‌های قابل مشاهده: ${toFa(knowledge.orders.length)} سفارش · سفارش‌های دارای تأخیر (معوق): ${toFa(knowledge.overdueOrders.length)} مورد.`,
        );
        knowledge.overdueOrders.slice(0, 4).forEach((o) => {
          const c = knowledge.customers.find((cu) => cu.id === o.customerId);
          lines.push(`• سفارش ${o.id} (${c?.name ?? 'مشتری'}) — وضعیت: ${o.status}`);
        });
      } else if (/سرنخ|لید|امتیاز|قیف/i.test(q)) {
        if (!knowledge.canViewSales) {
          return {
            answer: 'نقش فعلی شما مجوز مشاهده سرنخ‌ها و قیف فروش (sales:view) را ندارد.',
            references: [],
          };
        }
        const topLeads = [...knowledge.leads].sort((a, b) => b.score - a.score).slice(0, 4);
        lines.push(`تعداد سرنخ‌های قابل مشاهده: ${toFa(knowledge.leads.length)} مورد.`);
        topLeads.forEach((l) => {
          lines.push(
            `• ${l.name} — امتیاز ${toFa(l.score)}/۱۰۰ · برآورد ${formatToman(l.estimatedAmount)} · منبع: ${l.source}`,
          );
        });
      } else if (/نوبت|امروز|غیبت|تقویم/i.test(q)) {
        if (!knowledge.canViewAppointments) {
          return {
            answer: 'نقش فعلی شما مجوز مشاهده نوبت‌ها (appointments:view) را ندارد.',
            references: [],
          };
        }
        const todayIso = new Date().toISOString();
        const todayApts = knowledge.appointments.filter((a) => isSameDay(a.start, todayIso));
        const noShowCount = knowledge.appointments.filter((a) => a.status === 'noshow').length;
        lines.push(
          `نوبت‌های امروز: ${toFa(todayApts.length)} نوبت · کل نوبت‌های قابل مشاهده: ${toFa(knowledge.appointments.length)} (عدم حضور: ${toFa(noShowCount)} مورد).`,
        );
      } else if (/پایگاه دانش|راهنما|مقاله|مراقبت|لیزر|مرجوع|شرایط/i.test(q)) {
        if (knowledge.kbArticles.length === 0) {
          lines.push('مقاله‌ای در پایگاه دانش یافت نشد.');
        } else {
          lines.push(`مقالات مرتبط در پایگاه دانش (${toFa(knowledge.kbArticles.length)} مقاله موجود):`);
          knowledge.kbArticles.slice(0, 3).forEach((k) => {
            lines.push(`• ${k.title}: ${k.body.slice(0, 110)}...`);
          });
        }
      } else {
        lines.push(
          `خلاصه وضعیت مجاز (${state.settings.businessName} · محدوده ${knowledge.scopeLabel}):`,
        );
        if (knowledge.canViewCustomers) lines.push(`• مشتریان قابل مشاهده: ${toFa(knowledge.customers.length)} پرونده`);
        if (knowledge.canViewOrders)
          lines.push(`• سفارش‌ها: ${toFa(knowledge.orders.length)} مورد (معوق: ${toFa(knowledge.overdueOrders.length)})`);
        if (knowledge.canViewTickets)
          lines.push(`• تیکت‌ها: ${toFa(knowledge.tickets.length)} مورد (ریسک SLA: ${toFa(knowledge.slaRiskTickets.length)})`);
        if (knowledge.canViewSales) lines.push(`• سرنخ‌های فروش: ${toFa(knowledge.leads.length)} مورد`);
        if (knowledge.matchedReferences.length > 0) {
          lines.push('رکوردهای مرتبط برای بررسی سریع در پایین لیست شده‌اند.');
        }
      }

      return {
        answer: lines.join('\n'),
        references: knowledge.matchedReferences,
      };
    },
    onLog,
  });
}

// 2) Customer Timeline Summary
export type CustomerTimelineSummary = {
  summaryBullets: string[];
  sentiment: 'مثبت' | 'خنثی' | 'نیازمند توجه';
  nextBestAction: string;
  riskFlags: string[];
};

export async function summarizeCustomerTimeline(
  state: AppState,
  customer: Customer,
  onLog?: AiLogger,
): Promise<AiCallResult<CustomerTimelineSummary>> {
  const maskPii = state.settings.ai?.maskPiiBeforeSend !== false;
  const stats = computeCustomerStats(customer, state);
  const custOrders = state.orders.filter((o) => !o.isDeleted && o.customerId === customer.id);
  const custApts = state.appointments.filter((a) => !a.isDeleted && a.customerId === customer.id);
  const custTickets = state.tickets.filter((t) => !t.isDeleted && t.customerId === customer.id);
  const custInts = state.interactions.filter((i) => i.customerId === customer.id);
  const custNps = state.npsSurveys.filter((n) => n.customerId === customer.id);

  const payload = {
    name: customer.name,
    lifecycle: customer.lifecycle ?? 'active',
    score: stats.score,
    totalSpent: stats.totalSpent,
    loyaltyPoints: customer.loyaltyPoints ?? 0,
    orders: custOrders.slice(0, 6).map((o) => ({ status: o.status, createdAt: o.createdAt, itemsCount: o.items.length })),
    appointments: custApts.slice(0, 6).map((a) => ({ status: a.status, start: a.start })),
    tickets: custTickets.slice(0, 5).map((t) => ({ subject: t.subject, status: t.status, priority: t.priority, isComplaint: t.isComplaint })),
    interactions: custInts.slice(0, 6).map((i) => ({ channel: i.channel, outcome: i.outcome, text: i.text })),
    npsScores: custNps.map((n) => n.score),
  };

  const { block, redactedCount } = wrapUntrustedDataBlock('customer_timeline', payload, maskPii);

  return runWithGeminiOrFallback<CustomerTimelineSummary>({
    state,
    feature: 'timeline_summary',
    promptPreview: `خلاصه تایم‌لاین مشتری ${customer.name}`,
    piiRedactedCount: redactedCount,
    systemInstruction:
      `${PROMPT_INJECTION_SYSTEM_GUARD}\n` +
      'تایم‌لاین مشتری را به صورت بولت‌های خلاصه فارسی، ارزیابی احساس/رضایت و اقدام پیشنهادی بعدی تحلیل کن.',
    userPrompt: `این تایم‌لاین مشتری را خلاصه کن:\n${block}`,
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        summaryBullets: { type: Type.ARRAY, items: { type: Type.STRING } },
        sentiment: { type: Type.STRING },
        nextBestAction: { type: Type.STRING },
        riskFlags: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
    },
    parseGeminiText: (txt) => {
      try {
        const parsed = JSON.parse(txt) as Partial<CustomerTimelineSummary>;
        if (!Array.isArray(parsed.summaryBullets)) return null;
        return {
          summaryBullets: parsed.summaryBullets.slice(0, 5),
          sentiment:
            parsed.sentiment === 'مثبت' || parsed.sentiment === 'نیازمند توجه'
              ? parsed.sentiment
              : 'خنثی',
          nextBestAction: parsed.nextBestAction || 'پیگیری محترمانه در چرخه بعدی',
          riskFlags: Array.isArray(parsed.riskFlags) ? parsed.riskFlags : [],
        };
      } catch {
        return null;
      }
    },
    fallback: () => {
      const noShows = custApts.filter((a) => a.status === 'noshow').length;
      const openTickets = custTickets.filter((t) => !isTicketClosedStatus(t.status));
      const complaints = custTickets.filter((t) => t.isComplaint).length;
      const avgNps = custNps.length ? custNps.reduce((s, n) => s + n.score, 0) / custNps.length : null;

      const summaryBullets = [
        `مجموع خرید ثبت‌شده: ${formatToman(stats.totalSpent)} در ${toFa(custOrders.length)} سفارش (امتیاز وفاداری CRM: ${toFa(stats.score)} از ۱۰۰).`,
        `سوابق نوبت‌دهی: ${toFa(stats.completedAppointments)} نوبت تکمیل‌شده${noShows > 0 ? ` و ${toFa(noShows)} مورد عدم حضور` : ''}.`,
        `تعاملات و پشتیبانی: ${toFa(custInts.length)} تعامل ثبت‌شده، ${toFa(custTickets.length)} تیکت (${toFa(openTickets.length)} تیکت باز).`,
      ];
      if (custInts[0]) {
        summaryBullets.push(`آخرین تعامل (${formatJalali(custInts[0].at)}): «${custInts[0].text.slice(0, 75)}»`);
      }

      const riskFlags: string[] = [];
      if (openTickets.length > 0) riskFlags.push(`${toFa(openTickets.length)} تیکت پشتیبانی باز`);
      if (complaints > 0) riskFlags.push('دارای سابقه ثبت شکایت');
      if (noShows > 0) riskFlags.push(`${toFa(noShows)} مورد عدم حضور در نوبت`);
      if (avgNps !== null && avgNps < 7) riskFlags.push(`امتیاز NPS پایین (${toFa(avgNps.toFixed(1))})`);

      const sentiment: CustomerTimelineSummary['sentiment'] =
        riskFlags.length > 0 ? 'نیازمند توجه' : stats.score >= 65 || (avgNps ?? 8) >= 8 ? 'مثبت' : 'خنثی';

      const nextBestAction =
        openTickets.length > 0
          ? `بستن و پیگیری فوری تیکت باز «${openTickets[0].subject}» پیش از هر پیشنهاد فروش جدید.`
          : stats.score >= 75
            ? 'ارائه پیشنهاد بسته VIP یا کد معرفی دوستان (Referral) متناسب با سابقه خرید.'
            : 'ثبت تماس پیگیری دوره‌ای و پیشنهاد سرویس یا محصول مکمل.';

      return { summaryBullets, sentiment, nextBestAction, riskFlags };
    },
    onLog,
  });
}

// 3) Ticket Reply Suggestion (human approval required)
export type TicketReplySuggestion = {
  draftReply: string;
  usedKbTitles: string[];
  toneNote: string;
};

export async function suggestTicketReply(
  state: AppState,
  ticket: Ticket,
  customer: Customer | null,
  messages: TicketMessage[],
  kbArticles: KbArticle[],
  onLog?: AiLogger,
): Promise<AiCallResult<TicketReplySuggestion>> {
  const maskPii = state.settings.ai?.maskPiiBeforeSend !== false;
  const brandTone = state.settings.ai?.brandTone ?? 'friendly';
  const relevantKb = suggestKbArticlesForTicket(ticket, kbArticles, '', 2);

  const { block, redactedCount } = wrapUntrustedDataBlock(
    'ticket_conversation',
    {
      subject: ticket.subject,
      category: ticket.category,
      priority: ticket.priority,
      customerFirstName: customer?.name?.split(' ')[0] ?? 'مشتری',
      messages: messages.slice(-5).map((m) => ({ authorType: m.authorType, body: m.body })),
      kbReferences: relevantKb.map((k) => ({ title: k.title, body: k.body.slice(0, 260) })),
    },
    maskPii,
  );

  return runWithGeminiOrFallback<TicketReplySuggestion>({
    state,
    feature: 'ticket_reply',
    promptPreview: `پیشنهاد پاسخ تیکت: ${ticket.subject}`,
    piiRedactedCount: redactedCount,
    systemInstruction:
      `${PROMPT_INJECTION_SYSTEM_GUARD}\n` +
      `پیش‌نویس پاسخ محترمانه به فارسی برای کارشناس پشتیبانی بنویس (لحن برند: ${AI_BRAND_TONE_LABELS[brandTone]}). پاسخ به مشتری ارسال نمی‌شود مگر کارشناس آن را تأیید کند.`,
    userPrompt: `بر اساس تیکت و مقالات پایگاه دانش زیر یک پیش‌نویس پاسخ بنویس:\n${block}`,
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        draftReply: { type: Type.STRING },
        usedKbTitles: { type: Type.ARRAY, items: { type: Type.STRING } },
        toneNote: { type: Type.STRING },
      },
    },
    parseGeminiText: (txt) => {
      try {
        const parsed = JSON.parse(txt) as Partial<TicketReplySuggestion>;
        if (!parsed.draftReply) return null;
        return {
          draftReply: parsed.draftReply,
          usedKbTitles: Array.isArray(parsed.usedKbTitles) ? parsed.usedKbTitles : relevantKb.map((k) => k.title),
          toneNote: parsed.toneNote || AI_BRAND_TONE_LABELS[brandTone],
        };
      } catch {
        return null;
      }
    },
    fallback: () => {
      const custName = customer?.name ?? 'مشتری گرامی';
      const kbSnippet = relevantKb[0]
        ? `\n\nراهنمای مرتبط (${relevantKb[0].title}):\n${relevantKb[0].body.slice(0, 180)}...`
        : '';
      const opener =
        brandTone === 'formal'
          ? `با سلام و احترام، ${custName}؛\nدرخواست شما با کد پیگیری ${ticket.trackingCode ?? ticket.id} در دست بررسی قرار گرفت.`
          : `سلام ${custName} عزیز؛ وقت بخیر.\nپیام شما درباره «${ticket.subject}» با کد ${ticket.trackingCode ?? ticket.id} دریافت شد و در حال پیگیری آن هستیم.`;
      const actionLine = ticket.isComplaint
        ? '\nبابت نارضایتی پیش‌آمده پوزش می‌طلبیم؛ پرونده شما با اولویت ویژه به سرپرست پشتیبانی ارجاع شد تا نتیجه دقیق امروز اطلاع‌رسانی شود.'
        : '\nهمکاران ما جزئیات پرونده شما را بررسی کرده‌اند و نتیجه نهایی از همین بخش و پیامک اطلاع‌رسانی خواهد شد.';
      return {
        draftReply: `${opener}${actionLine}${kbSnippet}\n\nبا سپاس از شکیبایی شما، تیم پشتیبانی ${state.settings.businessName}`,
        usedKbTitles: relevantKb.map((k) => k.title),
        toneNote: AI_BRAND_TONE_LABELS[brandTone],
      };
    },
    onLog,
  });
}

// 4) Automatic Ticket Category & Priority Suggestion
export type TicketTriageSuggestion = {
  category: string;
  priority: Ticket['priority'];
  severity: TicketSeverity;
  reason: string;
};

export async function suggestTicketCategoryAndPriority(
  state: AppState,
  subject: string,
  body: string,
  onLog?: AiLogger,
): Promise<AiCallResult<TicketTriageSuggestion>> {
  const maskPii = state.settings.ai?.maskPiiBeforeSend !== false;
  const { block, redactedCount } = wrapUntrustedDataBlock(
    'ticket_triage',
    { subject, body, allowedCategories: TICKET_CATEGORIES },
    maskPii,
  );

  return runWithGeminiOrFallback<TicketTriageSuggestion>({
    state,
    feature: 'ticket_triage',
    promptPreview: `دسته‌بندی تیکت: ${subject}`,
    piiRedactedCount: redactedCount,
    systemInstruction:
      `${PROMPT_INJECTION_SYSTEM_GUARD}\n` +
      'دسته‌بندی، اولویت (low/normal/high) و شدت (minor/major/critical) تیکت را بر اساس موضوع و متن پیشنهاد بده.',
    userPrompt: `این تیکت را دسته‌بندی و اولویت‌بندی کن:\n${block}`,
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        category: { type: Type.STRING },
        priority: { type: Type.STRING },
        severity: { type: Type.STRING },
        reason: { type: Type.STRING },
      },
    },
    parseGeminiText: (txt) => {
      try {
        const p = JSON.parse(txt) as Partial<TicketTriageSuggestion>;
        if (!p.category || !p.priority) return null;
        const rawPri = String(p.priority).toLowerCase();
        const pri: Ticket['priority'] =
          rawPri === 'urgent' || rawPri === 'high'
            ? 'high'
            : rawPri === 'low'
              ? 'low'
              : 'normal';
        const sev = (['minor', 'major', 'critical'] as const).includes(p.severity as TicketSeverity)
          ? (p.severity as TicketSeverity)
          : 'minor';
        return {
          category: TICKET_CATEGORIES.includes(p.category) ? p.category : TICKET_CATEGORIES[0],
          priority: pri,
          severity: sev,
          reason: p.reason || 'تشخیص هوشمند بر اساس متن درخواست',
        };
      } catch {
        return null;
      }
    },
    fallback: () => {
      const combined = `${subject} ${body}`.toLowerCase();
      let category = TICKET_CATEGORIES[0];
      if (/پرداخت|فاکتور|تراکنش|عودت|پول|وجه|مالی|کارت/.test(combined)) category = 'پرداخت و مالی';
      else if (/ارسال|مرسوله|پست|تیپاکس|پیک|تحویل|بسته/.test(combined)) category = 'ارسال و لجستیک';
      else if (/نوبت|ساعت|زمان|جابجایی|جابه‌جایی|کنسل|لغو/.test(combined)) category = 'نوبت‌دهی و زمان‌بندی';
      else if (/شکایت|ناراضی|بد|خراب|افتضاح|اعتراض|کیفیت/.test(combined)) category = 'شکایت و کیفیت';
      else if (/فنی|خطا|ارور|ورود|لاگین|سامانه|باگ|اپلیکیشن/.test(combined)) category = 'پشتیبانی فنی';

      let priority: Ticket['priority'] = 'normal';
      let severity: TicketSeverity = 'minor';
      if (/فوری|اورژانسی|قطع|شکایت|خسارت|کلاهبرداری|امروز|فوراً/.test(combined)) {
        priority = 'high';
        severity = 'critical';
      } else if (/تاخیر|تأخیر|مهم|دوباره|دومین بار|مرجوع/.test(combined)) {
        priority = 'high';
        severity = 'major';
      } else if (/سوال|راهنما|اطلاع|چطور/.test(combined)) {
        priority = 'low';
        severity = 'minor';
      }

      return {
        category,
        priority,
        severity,
        reason: `بر اساس کلیدواژه‌های موضوع/متن، دسته «${category}» و اولویت «${priority}» پیشنهاد شد.`,
      };
    },
    onLog,
  });
}

// 5) Lead Scoring with Explanation
export type AiLeadScoreExplanation = {
  score: number;
  tierLabel: string;
  positiveFactors: string[];
  riskFactors: string[];
  explanation: string;
};

export async function scoreLeadWithAi(
  state: AppState,
  input: {
    name: string;
    source: string;
    estimatedAmount: number;
    hasEmail: boolean;
    hasCompany: boolean;
    notes?: string;
  },
  onLog?: AiLogger,
): Promise<AiCallResult<AiLeadScoreExplanation>> {
  const maskPii = state.settings.ai?.maskPiiBeforeSend !== false;
  const { block, redactedCount } = wrapUntrustedDataBlock('lead_scoring', input, maskPii);

  return runWithGeminiOrFallback<AiLeadScoreExplanation>({
    state,
    feature: 'lead_scoring',
    promptPreview: `امتیازدهی سرنخ: ${input.name}`,
    piiRedactedCount: redactedCount,
    systemInstruction:
      `${PROMPT_INJECTION_SYSTEM_GUARD}\n` +
      'سرنخ فروش را از ۰ تا ۱۰۰ امتیازدهی کن و دلایل مثبت و ریسک‌ها را به فارسی شفاف توضیح بده.',
    userPrompt: `این سرنخ را ارزیابی کن:\n${block}`,
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        score: { type: Type.INTEGER },
        tierLabel: { type: Type.STRING },
        positiveFactors: { type: Type.ARRAY, items: { type: Type.STRING } },
        riskFactors: { type: Type.ARRAY, items: { type: Type.STRING } },
        explanation: { type: Type.STRING },
      },
    },
    parseGeminiText: (txt) => {
      try {
        const p = JSON.parse(txt) as Partial<AiLeadScoreExplanation>;
        if (typeof p.score !== 'number') return null;
        return {
          score: Math.min(100, Math.max(0, Math.round(p.score))),
          tierLabel: p.tierLabel || (p.score >= 75 ? 'داغ (Hot)' : p.score >= 50 ? 'گرم (Warm)' : 'نیازمند پرورش'),
          positiveFactors: Array.isArray(p.positiveFactors) ? p.positiveFactors : [],
          riskFactors: Array.isArray(p.riskFactors) ? p.riskFactors : [],
          explanation: p.explanation || '',
        };
      } catch {
        return null;
      }
    },
    fallback: () => {
      const score = computeLeadScoreHint({
        source: input.source,
        estimatedAmount: input.estimatedAmount,
        hasEmail: input.hasEmail,
        hasCompany: input.hasCompany,
      });
      const positiveFactors: string[] = [];
      const riskFactors: string[] = [];

      if (input.source === 'معرفی') positiveFactors.push('جذب از طریق معرفی (نرخ تبدیل بالا +۱۵ امتیاز)');
      else if (input.source === 'سایت' || input.source === 'لندینگ')
        positiveFactors.push(`ورودی هدفمند از ${input.source} (+۱۰ امتیاز)`);
      else riskFactors.push(`منبع «${input.source}» نیازمند احراز صلاحیت سریع‌تر است`);

      if (input.estimatedAmount >= 20_000_000)
        positiveFactors.push(`ارزش معامله بالا (${formatToman(input.estimatedAmount)})`);
      else if (input.estimatedAmount >= 5_000_000)
        positiveFactors.push(`ارزش برآوردی مناسب (${formatToman(input.estimatedAmount)})`);
      else riskFactors.push('برآورد بودجه پایین یا نامشخص');

      if (input.hasCompany) positiveFactors.push('دارای نام شرکت / مشتری حقوقی B2B');
      if (input.hasEmail) positiveFactors.push('اطلاعات ایمیل سازمانی/شخصی تکمیل است');
      else riskFactors.push('ایمیل ثبت نشده (کانال پیگیری محدود به تماس/پیامک)');

      const tierLabel = score >= 75 ? 'داغ (Hot · اولویت تماس فوری)' : score >= 50 ? 'گرم (Warm)' : 'سرد (Cold · پرورش سرنخ)';
      return {
        score,
        tierLabel,
        positiveFactors,
        riskFactors,
        explanation: `امتیاز ${toFa(score)} از ۱۰۰ برای «${input.name}» بر اساس کیفیت منبع (${input.source})، ارزش برآوردی و تکمیل اطلاعات تماس محاسبه شد.`,
      };
    },
    onLog,
  });
}

// 6) Natural Language to Validated Whitelist Customer Filter JSON (Zero SQL)
export type AiNlFilterResult = {
  filter: CustomerSavedViewFilter;
  segmentConditions: SegmentCondition[];
  explanation: string;
};

export async function convertNlToCustomerFilter(
  state: AppState,
  persianSentence: string,
  allowedOwners: string[],
  allowedTags: string[],
  onLog?: AiLogger,
): Promise<AiCallResult<AiNlFilterResult>> {
  const maskPii = state.settings.ai?.maskPiiBeforeSend !== false;
  const { block, redactedCount } = wrapUntrustedDataBlock(
    'nl_filter_request',
    {
      sentence: persianSentence,
      allowedOwners,
      allowedTags: allowedTags.filter((t) => t !== 'همه'),
    },
    maskPii,
  );

  const ruleParse = (): AiNlFilterResult => {
    const s = persianSentence.trim();
    const conditions: SegmentCondition[] = [];
    let lifecycleFilter: CustomerSavedViewFilter['lifecycleFilter'] = 'all';
    let personTypeFilter: CustomerSavedViewFilter['personTypeFilter'] = 'all';
    let selectedTag = 'همه';
    let ownerFilter = 'all';
    let sortBy: CustomerSavedViewFilter['sortBy'] = 'createdAt';
    let sortDir: CustomerSavedViewFilter['sortDir'] = 'desc';
    let query = '';

    if (/vip|ویژه/i.test(s)) {
      lifecycleFilter = 'vip';
      conditions.push({ id: 'nl_lc', field: 'lifecycle', op: 'eq', value: 'vip' });
    } else if (/سرنخ|لید/i.test(s)) {
      lifecycleFilter = 'lead';
      conditions.push({ id: 'nl_lc', field: 'lifecycle', op: 'eq', value: 'lead' });
    } else if (/ریزش|غیرفعال|از\s*دست/i.test(s)) {
      lifecycleFilter = 'churned';
      conditions.push({ id: 'nl_lc', field: 'lifecycle', op: 'eq', value: 'churned' });
    } else if (/فعال/i.test(s)) {
      lifecycleFilter = 'active';
      conditions.push({ id: 'nl_lc', field: 'lifecycle', op: 'eq', value: 'active' });
    }

    if (/حقوقی|شرکت|سازمان/i.test(s)) {
      personTypeFilter = 'organization';
      conditions.push({ id: 'nl_pt', field: 'personType', op: 'eq', value: 'organization' });
    } else if (/حقیقی|شخص/i.test(s)) {
      personTypeFilter = 'individual';
      conditions.push({ id: 'nl_pt', field: 'personType', op: 'eq', value: 'individual' });
    }

    const matchedTag = allowedTags.find((t) => t !== 'همه' && s.includes(t));
    if (matchedTag) {
      selectedTag = matchedTag;
      conditions.push({ id: 'nl_tag', field: 'tag', op: 'eq', value: matchedTag });
    }

    const matchedOwner = allowedOwners.find((o) => s.includes(o) || s.includes(o.split(' ')[0]));
    if (matchedOwner) {
      ownerFilter = matchedOwner;
      conditions.push({ id: 'nl_own', field: 'ownerName', op: 'eq', value: matchedOwner });
    }

    if (/اینستاگرام/i.test(s)) {
      query = 'اینستاگرام';
      conditions.push({ id: 'nl_src', field: 'source', op: 'eq', value: 'اینستاگرام' });
    } else if (/معرفی/i.test(s)) {
      conditions.push({ id: 'nl_src', field: 'source', op: 'eq', value: 'معرفی' });
    }

    if (/بیشترین خرید|پرفروش|مبلغ بالا|خرید بالا/i.test(s)) {
      sortBy = 'totalSpent';
      sortDir = 'desc';
    } else if (/امتیاز بالا|برترین امتیاز/i.test(s)) {
      sortBy = 'score';
      sortDir = 'desc';
    }

    const amountMatch = s.match(/(?:بالای|بیشتر از|حداقل)\s*([0-9۰-۹]+)\s*(میلیون|هزار)?/);
    if (amountMatch) {
      const numEn = Number(amountMatch[1].replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))));
      const mult = amountMatch[2] === 'میلیون' ? 1_000_000 : amountMatch[2] === 'هزار' ? 1_000 : 1;
      if (Number.isFinite(numEn) && numEn > 0) {
        conditions.push({ id: 'nl_spent', field: 'minSpent', op: 'gte', value: String(numEn * mult) });
      }
    }

    const validated = validateAiCustomerFilterJson(
      {
        query,
        selectedTag,
        lifecycleFilter,
        personTypeFilter,
        ownerFilter,
        sortBy,
        sortDir,
        segmentConditions: conditions,
        explanation: `جمله «${s}» به فیلتر معتبر و لیست‌سفید CRM تبدیل شد (بدون اجرای SQL).`,
      },
      allowedOwners,
      allowedTags,
    );

    if (validated.ok) {
      return {
        filter: validated.filter,
        segmentConditions: validated.segmentConditions,
        explanation: validated.explanation,
      };
    }

    return {
      filter: {
        query: '',
        selectedTag: 'همه',
        lifecycleFilter: 'all',
        activeSegmentId: 'all',
        personTypeFilter: 'all',
        ownerFilter: 'all',
        sortBy: 'createdAt',
        sortDir: 'desc',
      },
      segmentConditions: [],
      explanation: 'فیلتر پیش‌فرض بازگشت داده شد.',
    };
  };

  return runWithGeminiOrFallback<AiNlFilterResult>({
    state,
    feature: 'nl_to_filter',
    promptPreview: `تبدیل جمله به فیلتر: ${persianSentence}`,
    piiRedactedCount: redactedCount,
    systemInstruction:
      `${PROMPT_INJECTION_SYSTEM_GUARD}\n` +
      'جمله فارسی کاربر را فقط به یک JSON فیلتر ساختاریافته مطابق schema و مقادیر مجاز تبدیل کن. هرگز SQL یا کد تولید نکن.',
    userPrompt: `تبدیل این عبارت به فیلتر مشتری:\n${block}`,
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING },
        selectedTag: { type: Type.STRING },
        lifecycleFilter: { type: Type.STRING },
        personTypeFilter: { type: Type.STRING },
        ownerFilter: { type: Type.STRING },
        sortBy: { type: Type.STRING },
        sortDir: { type: Type.STRING },
        explanation: { type: Type.STRING },
      },
    },
    parseGeminiText: (txt) => {
      try {
        const parsed = JSON.parse(txt);
        const validated = validateAiCustomerFilterJson(parsed, allowedOwners, allowedTags);
        if (!validated.ok) return null;
        return {
          filter: validated.filter,
          segmentConditions: validated.segmentConditions,
          explanation: validated.explanation || 'فیلتر با موفقیت استخراج و اعتبارسنجی شد.',
        };
      } catch {
        return null;
      }
    },
    fallback: ruleParse,
    onLog,
  });
}

// 7) Draft SMS / Campaign Copy in Brand Tone
export type AiCampaignDraft = {
  subjectA: string;
  bodyA: string;
  subjectB: string;
  bodyB: string;
  toneLabel: string;
};

export async function draftCampaignCopyInBrandTone(
  state: AppState,
  params: {
    goal: string;
    channel: NotificationChannel;
    audienceLabel: string;
    discountText?: string;
  },
  onLog?: AiLogger,
): Promise<AiCallResult<AiCampaignDraft>> {
  const brandTone: AiBrandTone = state.settings.ai?.brandTone ?? 'friendly';
  const toneLabel = AI_BRAND_TONE_LABELS[brandTone];
  const maskPii = state.settings.ai?.maskPiiBeforeSend !== false;
  const { block, redactedCount } = wrapUntrustedDataBlock(
    'campaign_brief',
    {
      businessName: state.settings.businessName,
      brandTone: toneLabel,
      ...params,
    },
    maskPii,
  );

  return runWithGeminiOrFallback<AiCampaignDraft>({
    state,
    feature: 'campaign_draft',
    promptPreview: `پیش‌نویس کمپین (${params.channel}): ${params.goal}`,
    piiRedactedCount: redactedCount,
    systemInstruction:
      `${PROMPT_INJECTION_SYSTEM_GUARD}\n` +
      `دو نسخه متن تست A/B برای کمپین ${params.channel} با لحن «${toneLabel}» و متغیر {{customer.name}} بنویس. برای پیامک کوتاه و زیر ۱۶۰ کاراکتر باشد.`,
    userPrompt: `مشخصات کمپین:\n${block}`,
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        subjectA: { type: Type.STRING },
        bodyA: { type: Type.STRING },
        subjectB: { type: Type.STRING },
        bodyB: { type: Type.STRING },
      },
    },
    parseGeminiText: (txt) => {
      try {
        const p = JSON.parse(txt) as Partial<AiCampaignDraft>;
        if (!p.bodyA || !p.bodyB) return null;
        return {
          subjectA: p.subjectA || params.goal,
          bodyA: p.bodyA,
          subjectB: p.subjectB || `${params.goal} (نسخه B)`,
          bodyB: p.bodyB,
          toneLabel,
        };
      } catch {
        return null;
      }
    },
    fallback: () => {
      const offer = params.discountText?.trim() || '۱۵٪ هدیه وفاداری';
      const biz = state.settings.businessName;
      if (brandTone === 'formal') {
        return {
          subjectA: `اطلاع‌رسانی طرح ویژه ${biz}`,
          bodyA: `با احترام {{customer.name}}، به پاس همراهی شما طرح «${params.goal}» با ${offer} تا پایان هفته فعال است. ${biz}`,
          subjectB: `دعوت‌نامه اختصاصی: ${params.goal}`,
          bodyB: `مشتری گرامی {{customer.name}}، امتیاز ویژه ${offer} برای استفاده در ${biz} به حساب شما اختصاص یافت.`,
          toneLabel,
        };
      }
      if (brandTone === 'luxury') {
        return {
          subjectA: `دعوت اختصاصی VIP | ${biz}`,
          bodyA: `{{customer.name}} عزیز، تجربه متمایز ${params.goal} همراه با مزیت اختصاصی ${offer} ویژه اعضای VIP ${biz} آماده شد.`,
          subjectB: `مزایای ویژه اعضای برتر ${biz}`,
          bodyB: `همراه ارجمند {{customer.name}}، دسترسی زودهنگام و ${offer} برای ${params.goal} برای شما فعال گردید.`,
          toneLabel,
        };
      }
      if (brandTone === 'clinical_expert') {
        return {
          subjectA: `پیشنهاد تخصصی و مشاوره ${biz}`,
          bodyA: `{{customer.name}} عزیز، زمان یادآوری برنامه ${params.goal} رسیده است. با ${offer} از مشاوره تخصصی ${biz} بهره‌مند شوید.`,
          subjectB: `برنامه پیگیری و تخفیف ${offer}`,
          bodyB: `سلام {{customer.name}}؛ جهت تکمیل دوره و ${params.goal} می‌توانید از ${offer} در ${biz} استفاده کنید.`,
          toneLabel,
        };
      }
      return {
        subjectA: `خبر خوب از ${biz}: ${params.goal}`,
        bodyA: `سلام {{customer.name}} جان! به مناسبت ${params.goal} یک ${offer} برات فعال کردیم. فرصت استفاده تا پایان هفته است — ${biz}`,
        subjectB: `هدیه ویژه فقط برای شما در ${biz}`,
        bodyB: `{{customer.name}} عزیز، دلمون برات تنگ شده بود! با ${offer} همین امروز برای ${params.goal} سر بزن: ${biz}`,
        toneLabel,
      };
    },
    onLog,
  });
}

// 8) Content Calendar Idea Generator
export type AiContentIdea = {
  title: string;
  platform: ContentItem['platform'];
  format: ContentItem['format'];
  hook: string;
  captionOutline: string;
};

export async function generateContentCalendarIdeas(
  state: AppState,
  params: { topic: string; count?: number },
  onLog?: AiLogger,
): Promise<AiCallResult<AiContentIdea[]>> {
  const count = Math.min(6, Math.max(2, params.count ?? 4));
  const maskPii = state.settings.ai?.maskPiiBeforeSend !== false;
  const { block, redactedCount } = wrapUntrustedDataBlock(
    'content_calendar_brief',
    {
      businessName: state.settings.businessName,
      industryPack: state.settings.industryPack,
      topic: params.topic,
      count,
    },
    maskPii,
  );

  return runWithGeminiOrFallback<AiContentIdea[]>({
    state,
    feature: 'content_ideas',
    promptPreview: `ایده‌پردازی محتوا: ${params.topic}`,
    piiRedactedCount: redactedCount,
    systemInstruction:
      `${PROMPT_INJECTION_SYSTEM_GUARD}\n` +
      'ایده‌های خلاقانه برای تقویم محتوای فارسی (اینستاگرام، وب‌سایت یا بلاگ) متناسب با صنعت کسب‌وکار پیشنهاد بده.',
    userPrompt: `این تعداد ایده تولید محتوا بساز (${count} مورد):\n${block}`,
    responseSchema: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          platform: { type: Type.STRING },
          format: { type: Type.STRING },
          hook: { type: Type.STRING },
          captionOutline: { type: Type.STRING },
        },
      },
    },
    parseGeminiText: (txt) => {
      try {
        const arr = JSON.parse(txt) as Partial<AiContentIdea>[];
        if (!Array.isArray(arr) || arr.length === 0) return null;
        return arr.slice(0, count).map((item) => ({
          title: item.title || 'ایده محتوای جدید',
          platform:
            item.platform === 'instagram' || item.platform === 'site' || item.platform === 'blog'
              ? item.platform
              : 'instagram',
          format:
            item.format === 'post' || item.format === 'reel' || item.format === 'story' || item.format === 'article'
              ? item.format
              : 'reel',
          hook: item.hook || 'نکته کلیدی ۳ ثانیه اول ویدیو',
          captionOutline: item.captionOutline || '',
        }));
      } catch {
        return null;
      }
    },
    fallback: () => {
      const t = params.topic.trim() || state.settings.businessName;
      const pack = state.settings.industryPack;
      const ideas: AiContentIdea[] = [
        {
          title: `۳ اشتباه رایج مشتریان درباره ${t} و راهکار اصلاحی`,
          platform: 'instagram',
          format: 'reel',
          hook: 'اگه این ۳ کار رو انجام می‌دی، نتیجه دلخواهت رو نمی‌گیری!',
          captionOutline: `معرفی سریع اشتباهات رایج در ${t} + دعوت به مشاوره دایرکت.`,
        },
        {
          title: `پشت صحنه آماده‌سازی و استانداردهای کیفیت در ${state.settings.businessName}`,
          platform: 'instagram',
          format: 'story',
          hook: 'نظرسنجی تعاملی: کدوم سرویس/محصول براتون اولویت داره؟',
          captionOutline: 'سریال ۳ استوری با باکس پرسش‌وپاسخ و لینک رزرو یا خرید.',
        },
        {
          title: `راهنمای جامع انتخاب بهترین گزینه برای ${t} (مقایسه تخصصی)`,
          platform: 'blog',
          format: 'article',
          hook: 'چطور بدون هزینه‌های اضافه بهترین انتخاب را داشته باشیم؟',
          captionOutline: `مقاله سئو شده با جدول مقایسه، سوالات متداول و فرم جذب سرنخ (${pack}).`,
        },
        {
          title: `نتیجه واقعی و تجربه مشتریان راضی از ${t} (با رضایت‌نامه انتشار)`,
          platform: 'instagram',
          format: 'post',
          hook: 'قبل و بعد + گفتگوی کوتاه با مشتری وفادار',
          captionOutline: 'تاکید بر رضایت‌نامه رسمی، نکات مراقبتی و کد تخفیف معرفی دوستان.',
        },
      ];
      return ideas.slice(0, count);
    },
    onLog,
  });
}
