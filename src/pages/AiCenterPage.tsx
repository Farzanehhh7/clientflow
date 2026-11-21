import { useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  FlaskConical,
  Play,
  ShieldCheck,
  Sparkles,
  Trash2,
  XCircle,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AI_EVALUATION_SUITE, type AiEvalCaseResult } from '../data/aiEvaluationSuite';
import {
  getAiMissingKeyFriendlyNotice,
  isGeminiApiKeyConfigured,
} from '../services/aiService';
import { useClientFlow } from '../store/useClientFlowStore';
import type { AiFeatureKey } from '../types';
import { formatJalaliDateTime, toFa } from '../utils/jalali';

const FEATURE_LABELS: Record<AiFeatureKey, string> = {
  chat_rag: 'چت هوشمند (RAG)',
  timeline_summary: 'خلاصه تایم‌لاین',
  ticket_reply: 'پیشنهاد پاسخ تیکت',
  ticket_triage: 'دسته‌بندی تیکت',
  lead_scoring: 'امتیازدهی سرنخ',
  nl_to_filter: 'فیلتر زبان طبیعی',
  campaign_draft: 'متن کمپین / پیامک',
  content_ideas: 'ایده‌پرداز محتوا',
  evaluation: 'آزمون ارزیابی',
};

export function AiCenterPage() {
  const { state, logAiUsage, clearAiUsageLogs, updateSettings } = useClientFlow();
  const [tab, setTab] = useState<'usage' | 'evaluation'>('usage');
  const [featureFilter, setFeatureFilter] = useState<'all' | AiFeatureKey>('all');

  // Evaluation state
  const [evalResults, setEvalResults] = useState<Record<string, AiEvalCaseResult>>({});
  const [runningId, setRunningId] = useState<string | null>(null);
  const [runningAll, setRunningAll] = useState(false);

  const logs = state.aiUsageLogs ?? [];
  const hasKey = isGeminiApiKeyConfigured();
  const aiEnabled = state.settings.ai?.enabled !== false;

  const stats = useMemo(() => {
    let totalTokens = 0;
    let promptTokens = 0;
    let completionTokens = 0;
    let geminiCount = 0;
    let fallbackCount = 0;
    let piiRedacted = 0;
    const byFeature: Record<string, { name: string; calls: number; tokens: number }> = {};

    logs.forEach((l) => {
      totalTokens += l.totalTokens;
      promptTokens += l.promptTokens;
      completionTokens += l.completionTokens;
      piiRedacted += l.piiRedactedCount;
      if (l.mode === 'gemini') geminiCount += 1;
      else fallbackCount += 1;

      const label = FEATURE_LABELS[l.feature] ?? l.feature;
      if (!byFeature[l.feature]) byFeature[l.feature] = { name: label, calls: 0, tokens: 0 };
      byFeature[l.feature].calls += 1;
      byFeature[l.feature].tokens += l.totalTokens;
    });

    return {
      totalCalls: logs.length,
      totalTokens,
      promptTokens,
      completionTokens,
      geminiCount,
      fallbackCount,
      piiRedacted,
      chartData: Object.values(byFeature),
    };
  }, [logs]);

  const filteredLogs = useMemo(
    () => (featureFilter === 'all' ? logs : logs.filter((l) => l.feature === featureFilter)),
    [logs, featureFilter],
  );

  const runSingleEval = async (qId: string) => {
    const q = AI_EVALUATION_SUITE.find((x) => x.id === qId);
    if (!q) return;
    setRunningId(qId);
    const res = await q.runAndScore(state, logAiUsage);
    setEvalResults((prev) => ({ ...prev, [qId]: res }));
    setRunningId(null);
  };

  const runAllEvaluations = async () => {
    if (runningAll) return;
    setRunningAll(true);
    for (const q of AI_EVALUATION_SUITE) {
      setRunningId(q.id);
      const res = await q.runAndScore(state, logAiUsage);
      setEvalResults((prev) => ({ ...prev, [q.id]: res }));
    }
    setRunningId(null);
    setRunningAll(false);
  };

  const evalSummary = useMemo(() => {
    const list = Object.values(evalResults);
    if (list.length === 0) return null;
    const passed = list.filter((r) => r.passed).length;
    const avgScore = Math.round(list.reduce((s, r) => s + r.scorePct, 0) / list.length);
    return { runCount: list.length, passed, avgScore };
  }, [evalResults]);

  return (
    <div className="space-y-6">
      {/* Status & Controls Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
            <Sparkles size={17} className="text-indigo-600 dark:text-indigo-400" />
            <span>مرکز پایش مصرف، گاردریل‌ها و ارزیابی دستیار هوشمند (AI Center)</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {hasKey
              ? 'کلید محیطی VITE_GEMINI_API_KEY شناسایی شد؛ مدل Gemini 4 به‌همراه ماسک PII و فیلتر تزریق دستور فعال است.'
              : getAiMissingKeyFriendlyNotice()}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium ${
              aiEnabled
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
            }`}
          >
            <ShieldCheck size={14} />
            {aiEnabled ? 'AI فعال' : 'AI غیرفعال'}
          </span>
          <button
            type="button"
            onClick={() =>
              updateSettings({
                ai: {
                  enabled: !aiEnabled,
                  brandTone: state.settings.ai?.brandTone ?? 'friendly',
                  maskPiiBeforeSend: state.settings.ai?.maskPiiBeforeSend ?? true,
                  logUsage: state.settings.ai?.logUsage ?? true,
                  model: state.settings.ai?.model ?? 'gemini-4-hydrogen',
                },
              })
            }
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {aiEnabled ? 'غیرفعال‌سازی سریع AI' : 'فعال‌سازی AI'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setTab('usage')}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-medium ${
            tab === 'usage'
              ? 'bg-indigo-600 text-white'
              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
          }`}
        >
          <Activity size={14} />
          گزارش مصرف و توکن‌ها ({toFa(logs.length)})
        </button>
        <button
          type="button"
          onClick={() => setTab('evaluation')}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-medium ${
            tab === 'evaluation'
              ? 'bg-indigo-600 text-white'
              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
          }`}
        >
          <FlaskConical size={14} />
          صفحه ارزیابی ۱۰ پرسش فارسی
        </button>
      </div>

      {/* TAB 1: AI USAGE & LOGS */}
      {tab === 'usage' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="text-xs text-slate-500 dark:text-slate-400">کل فراخوانی‌های AI</div>
              <div className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
                {toFa(stats.totalCalls)}
              </div>
              <div className="mt-1 text-[11px] text-slate-500 tabular-nums">
                Gemini: {toFa(stats.geminiCount)} · جایگزین: {toFa(stats.fallbackCount)}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="text-xs text-slate-500 dark:text-slate-400">کل توکن مصرفی</div>
              <div className="mt-1 text-2xl font-bold tabular-nums text-indigo-600 dark:text-indigo-400">
                {toFa(stats.totalTokens)}
              </div>
              <div className="mt-1 text-[11px] text-slate-500 tabular-nums">
                ورودی: {toFa(stats.promptTokens)} · خروجی: {toFa(stats.completionTokens)}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="text-xs text-slate-500 dark:text-slate-400">داده‌های PII ماسک‌شده</div>
              <div className="mt-1 text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                {toFa(stats.piiRedacted)}
              </div>
              <div className="mt-1 text-[11px] text-slate-500">موبایل، کد ملی و ایمیل پیش از ارسال</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="text-xs text-slate-500 dark:text-slate-400">لحن برند فعال</div>
              <div className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                {state.settings.ai?.brandTone === 'formal'
                  ? 'رسمی و اداری'
                  : state.settings.ai?.brandTone === 'clinical_expert'
                    ? 'تخصصی و مشاوره‌ای'
                    : state.settings.ai?.brandTone === 'luxury'
                      ? 'لوکس و VIP'
                      : 'صمیمی و محترمانه'}
              </div>
              <div className="mt-1 text-[11px] text-slate-500">قابل تغییر در تنظیمات سیستم</div>
            </div>
          </div>

          {stats.chartData.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <h3 className="mb-3 text-xs font-bold text-slate-800 dark:text-slate-100">
                توزیع فراخوانی‌ها و توکن بر اساس قابلیت AI
              </h3>
              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.chartData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="tokens" name="توکن‌ها" fill="#4f46e5" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100">
                  تاریخچه فراخوانی‌ها و ممیزی حریم خصوصی (AI Usage Log)
                </h3>
                <select
                  aria-label="فیلتر قابلیت AI"
                  value={featureFilter}
                  onChange={(e) => setFeatureFilter(e.target.value as 'all' | AiFeatureKey)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="all">همه قابلیت‌ها</option>
                  {(Object.keys(FEATURE_LABELS) as AiFeatureKey[]).map((fk) => (
                    <option key={fk} value={fk}>
                      {FEATURE_LABELS[fk]}
                    </option>
                  ))}
                </select>
              </div>
              {logs.length > 0 && (
                <button
                  type="button"
                  onClick={clearAiUsageLogs}
                  className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:border-rose-900/50 dark:text-rose-400"
                >
                  <Trash2 size={12} />
                  پاک کردن گزارش‌ها
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">زمان</th>
                    <th className="px-3 py-2.5 font-medium">قابلیت</th>
                    <th className="px-3 py-2.5 font-medium">کاربر / نقش</th>
                    <th className="px-3 py-2.5 font-medium">حالت اجرا</th>
                    <th className="px-3 py-2.5 font-medium">توکن (کل)</th>
                    <th className="px-3 py-2.5 font-medium">PII ماسک‌شده</th>
                    <th className="px-3 py-2.5 font-medium">خلاصه درخواست</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                        هنوز فراخوانی هوش مصنوعی در این کسب‌وکار ثبت نشده است.
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((l) => (
                      <tr key={l.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                        <td className="px-4 py-2.5 tabular-nums text-slate-500 whitespace-nowrap">
                          {formatJalaliDateTime(l.createdAt)}
                        </td>
                        <td className="px-3 py-2.5 font-medium text-slate-800 dark:text-slate-100">
                          {FEATURE_LABELS[l.feature] ?? l.feature}
                        </td>
                        <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">
                          {l.actorName} ({l.actorRole})
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span
                            className={`rounded px-2 py-0.5 text-[10px] font-semibold ${
                              l.status === 'blocked'
                                ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                                : l.mode === 'gemini'
                                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                  : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                            }`}
                          >
                            {l.status === 'blocked'
                              ? 'مسدود (غیرفعال)'
                              : l.mode === 'gemini'
                                ? 'Gemini'
                                : 'Rule-based'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 tabular-nums font-semibold">
                          {toFa(l.totalTokens)}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums text-emerald-600 dark:text-emerald-400">
                          {toFa(l.piiRedactedCount)}
                        </td>
                        <td className="max-w-xs truncate px-3 py-2.5 text-slate-500 dark:text-slate-400">
                          {l.promptPreview}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: 10-QUESTION PERSIAN EVALUATION SUITE */}
      {tab === 'evaluation' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                مجموعه ارزیابی ۱۰ پرسش استاندارد فارسی (Evaluation Benchmark)
              </h3>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                تست خودکار دقت پاسخ بر روی داده‌های فعلی سازمان، تبدیل زبان طبیعی به فیلتر بدون SQL، لحن برند، ماسک PII و رعایت RBAC
              </p>
            </div>
            <div className="flex items-center gap-3">
              {evalSummary && (
                <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 tabular-nums dark:border-indigo-900/50 dark:bg-indigo-950/40 dark:text-indigo-300">
                  قبولی: {toFa(evalSummary.passed)} از {toFa(evalSummary.runCount)} · میانگین امتیاز: {toFa(evalSummary.avgScore)}٪
                </div>
              )}
              <button
                type="button"
                disabled={runningAll || !aiEnabled}
                onClick={() => void runAllEvaluations()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
              >
                <Play size={14} />
                {runningAll ? 'در حال اجرای ۱۰ پرسش...' : 'اجرای کامل هر ۱۰ تست'}
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {AI_EVALUATION_SUITE.map((item) => {
              const res = evalResults[item.id];
              const isRunning = runningId === item.id;
              return (
                <div
                  key={item.id}
                  className="rounded-xl border border-slate-200 bg-white p-4 text-xs dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded bg-slate-100 px-2 py-0.5 font-bold tabular-nums text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                          پرسش {item.numberFa}
                        </span>
                        <span className="rounded bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                          {item.category}
                        </span>
                        {res && (
                          <span
                            className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold tabular-nums ${
                              res.passed
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                            }`}
                          >
                            {res.passed ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                            {res.passed ? 'موفق' : 'نیاز به بررسی'} ({toFa(res.scorePct)}٪)
                          </span>
                        )}
                      </div>
                      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {item.question}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="font-semibold text-slate-600 dark:text-slate-300">پاسخ مورد انتظار: </span>
                        {item.expectedSummary(state)}
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={isRunning || runningAll || !aiEnabled}
                      onClick={() => void runSingleEval(item.id)}
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <Play size={12} />
                      {isRunning ? 'در حال اجرا...' : 'اجرای تست'}
                    </button>
                  </div>

                  {res && (
                    <div className="mt-3 space-y-1.5 rounded-lg border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/40">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500">
                        <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                          تولیدشده با هوش مصنوعی (AI-generated)
                        </span>
                        <span className="tabular-nums">
                          حالت: {res.mode} · زمان: {toFa(res.latencyMs)} ms · {res.notes}
                        </span>
                      </div>
                      <div className="whitespace-pre-line leading-relaxed text-slate-800 dark:text-slate-200">
                        {res.actualAnswer}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
