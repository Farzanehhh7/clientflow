import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CopyPlus,
  FileText,
  GripVertical,
  Plus,
  Printer,
  RefreshCw,
  Target,
  UserPlus,
} from 'lucide-react';
import { Modal } from '../components/Modal';
import { QuotePreviewModal } from '../components/QuotePreviewModal';
import { useClientFlow } from '../store/useClientFlowStore';
import type { CommissionTier, Opportunity, PipelineStage, PipelineStageConfig, Quote } from '../types';
import { computeSteppedCommission } from '../utils/crmHelpers';
import { normalizeMobileInput } from '../utils/csv';
import { formatJalali, formatToman, toFa } from '../utils/jalali';

const CARRIER_STAGE_COLOR: Record<PipelineStage, string> = {
  lead: 'border-t-slate-400',
  contacted: 'border-t-sky-500',
  proposal: 'border-t-indigo-500',
  negotiation: 'border-t-amber-500',
  won: 'border-t-emerald-500',
  lost: 'border-t-rose-500',
};

export function SalesPage() {
  const {
    state,
    addOpportunity,
    moveOpportunityStage,
    convertOpportunityToCustomer,
    updatePipelineStages,
    updateSalesTargets,
    updateCommissionTiers,
    createQuote,
    createQuoteVersion,
    updateSettings,
  } = useClientFlow();

  const [tab, setTab] = useState<'kanban' | 'quotes' | 'targets' | 'settings'>('kanban');
  const [createOpen, setCreateOpen] = useState(false);

  // Drag & Drop state
  const [dragOppId, setDragOppId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<PipelineStage | null>(null);

  // Mandatory Lost Reason Modal
  const [lostModalOpp, setLostModalOpp] = useState<Opportunity | null>(null);
  const [lostReasonDraft, setLostReasonDraft] = useState('');

  // Create Opportunity Form
  const [title, setTitle] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [source, setSource] = useState('اینستاگرام');
  const [amount, setAmount] = useState('5000000');
  const [ownerName, setOwnerName] = useState(state.settings.salesTeam[0] ?? 'مریم (فروش)');
  const [useRoundRobin, setUseRoundRobin] = useState(state.settings.autoAssignLeads);
  const [error, setError] = useState('');

  // Quote Modals
  const [quoteCreateOpen, setQuoteCreateOpen] = useState(false);
  const [qOppId, setQOppId] = useState('');
  const [qContactName, setQContactName] = useState('');
  const [qPhone, setQPhone] = useState('');
  const [qItemName, setQItemName] = useState('پکیج کامل خدمات / لایسنس');
  const [qItemQty, setQItemQty] = useState('1');
  const [qItemPrice, setQItemPrice] = useState('12000000');
  const [qDiscountPct, setQDiscountPct] = useState('10');
  const [qNotes, setQNotes] = useState('');
  const [previewQuote, setPreviewQuote] = useState<Quote | null>(null);

  // Pipeline & Tiers draft states
  const [stageDrafts, setStageDrafts] = useState<PipelineStageConfig[]>(state.pipelineStages);
  const [tierDrafts, setTierDrafts] = useState<CommissionTier[]>(state.commissionTiers);
  const [newRepName, setNewRepName] = useState('');

  const nowMs = Date.now();
  const nextRoundRobinOwner =
    state.settings.salesTeam[state.settings.roundRobinIndex % Math.max(1, state.settings.salesTeam.length)] ??
    'مریم (فروش)';

  const summary = useMemo(() => {
    const activeOpps = state.opportunities.filter((o) => o.stage !== 'won' && o.stage !== 'lost');
    const wonOpps = state.opportunities.filter((o) => o.stage === 'won');
    const pipelineValue = activeOpps.reduce((s, o) => s + o.amount, 0);
    const wonValue = wonOpps.reduce((s, o) => s + o.amount, 0);
    const commissionInfo = computeSteppedCommission(wonValue, state.commissionTiers);
    return {
      activeCount: activeOpps.length,
      pipelineValue,
      wonValue,
      commissionTotal: commissionInfo.total,
      commissionBreakdown: commissionInfo.breakdown,
    };
  }, [state.opportunities, state.commissionTiers]);

  const requestMoveStage = (opp: Opportunity, nextStage: PipelineStage) => {
    if (opp.stage === nextStage) return;
    if (nextStage === 'lost') {
      setLostModalOpp(opp);
      setLostReasonDraft(opp.lostReason ?? '');
    } else {
      moveOpportunityStage(opp.id, nextStage);
    }
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const res = addOpportunity(
      {
        title: title.trim(),
        contactName: contactName.trim(),
        phone: normalizeMobileInput(phone),
        source,
        stage: 'lead',
        amount: Math.max(0, Number(amount) || 0),
        probability: 20,
        ownerName,
      },
      useRoundRobin,
    );
    if (!res.ok) {
      setError(res.error ?? 'خطا در ثبت سرنخ');
      return;
    }
    setTitle('');
    setContactName('');
    setPhone('');
    setError('');
    setCreateOpen(false);
  };

  const handleCreateQuote = (e: React.FormEvent) => {
    e.preventDefault();
    const linkedOpp = state.opportunities.find((o) => o.id === qOppId);
    const cName = qContactName.trim() || linkedOpp?.contactName || 'مشتری جدید';
    const cPhone = qPhone.trim() || linkedOpp?.phone || '';
    createQuote({
      opportunityId: linkedOpp?.id,
      customerId: linkedOpp?.customerId,
      contactName: cName,
      phone: cPhone,
      items: [
        {
          name: qItemName.trim() || 'پیشنهاد فروش',
          qty: Math.max(1, Number(qItemQty) || 1),
          price: Math.max(0, Number(qItemPrice) || 0),
        },
      ],
      discountPct: Math.min(80, Math.max(0, Number(qDiscountPct) || 0)),
      taxPct: 10,
      notes: qNotes.trim() || undefined,
      status: 'draft',
      validUntil: new Date(Date.now() + 14 * 24 * 3600_000).toISOString(),
    });
    setQuoteCreateOpen(false);
  };

  const repStats = useMemo(() => {
    return state.settings.salesTeam.map((rep) => {
      const targetObj = state.salesTargets.find((t) => t.ownerName === rep);
      const targetAmount = targetObj?.targetAmount ?? 50_000_000;
      const repWonOpps = state.opportunities.filter(
        (o) => o.stage === 'won' && o.ownerName === rep,
      );
      const wonSum = repWonOpps.reduce((s, o) => s + o.amount, 0);
      const comm = computeSteppedCommission(wonSum, state.commissionTiers);
      const pct = targetAmount > 0 ? Math.min(100, Math.round((wonSum / targetAmount) * 100)) : 0;
      return {
        rep,
        targetId: targetObj?.id,
        targetAmount,
        wonSum,
        wonCount: repWonOpps.length,
        commission: comm.total,
        breakdown: comm.breakdown,
        pct,
      };
    });
  }, [state.settings.salesTeam, state.salesTargets, state.opportunities, state.commissionTiers]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-900">
          {(
            [
              ['kanban', `قیف فروش (${toFa(state.opportunities.length)})`],
              ['quotes', `پیش‌فاکتورهای نسخه‌دار (${toFa(state.quotes.length)})`],
              ['targets', 'تارگت و پورسانت پلکانی'],
              ['settings', 'مراحل قیف و Round-robin'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setTab(key);
                if (key === 'settings') {
                  setStageDrafts(state.pipelineStages);
                  setTierDrafts(state.commissionTiers);
                }
              }}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                tab === key
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setQOppId('');
              setQContactName('');
              setQPhone('');
              setQuoteCreateOpen(true);
            }}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <FileText size={15} />
            صدور پیش‌فاکتور
          </button>
          <button
            type="button"
            onClick={() => {
              setError('');
              setCreateOpen(true);
            }}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700"
          >
            <Plus size={16} />
            سرنخ / فرصت جدید
          </button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs text-slate-500 dark:text-slate-400">فرصت‌های باز در قیف</div>
          <div className="mt-1.5 text-xl font-bold tabular-nums">{toFa(summary.activeCount)}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs text-slate-500 dark:text-slate-400">ارزش کل قیف فعال</div>
          <div className="mt-1.5 text-xl font-bold tabular-nums text-indigo-600 dark:text-indigo-400">
            {formatToman(summary.pipelineValue)}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs text-slate-500 dark:text-slate-400">فروش نهایی (برنده‌شده)</div>
          <div className="mt-1.5 text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
            {formatToman(summary.wonValue)}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs text-slate-500 dark:text-slate-400">پورسانت پلکانی کل تیم</div>
          <div className="mt-1.5 text-xl font-bold tabular-nums">{formatToman(summary.commissionTotal)}</div>
        </div>
      </div>

      {/* TAB 1: Drag & Drop Kanban */}
      {tab === 'kanban' && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
          {state.pipelineStages.map((stage) => {
            const cards = state.opportunities.filter((o) => o.stage === stage.key);
            const stageSum = cards.reduce((s, c) => s + c.amount, 0);
            const isOver = dragOverStage === stage.key;

            return (
              <div
                key={stage.key}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverStage(stage.key);
                }}
                onDragLeave={() => setDragOverStage(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverStage(null);
                  const opp = state.opportunities.find((o) => o.id === dragOppId);
                  setDragOppId(null);
                  if (opp) requestMoveStage(opp, stage.key);
                }}
                className={`flex min-h-[360px] flex-col rounded-xl border border-t-4 transition-colors ${
                  CARRIER_STAGE_COLOR[stage.key]
                } ${
                  isOver
                    ? 'border-indigo-400 bg-indigo-50/40 dark:border-indigo-500 dark:bg-indigo-950/20'
                    : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
                }`}
              >
                <div className="border-b border-slate-200 px-3 py-2.5 dark:border-slate-800">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span>{stage.label}</span>
                    <span className="tabular-nums text-slate-500">{toFa(cards.length)}</span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
                    <span>{formatToman(stageSum)}</span>
                    {stage.slaHours > 0 && <span>SLA: {toFa(stage.slaHours)}س</span>}
                  </div>
                </div>

                <div className="flex-1 space-y-2.5 p-2.5">
                  {cards.length === 0 ? (
                    <div className="py-10 text-center text-xs text-slate-400">
                      کارت را به اینجا بکشید
                    </div>
                  ) : (
                    cards.map((opp) => {
                      const ageHours = (nowMs - new Date(opp.updatedAt).getTime()) / 3600_000;
                      const slaBreached = stage.slaHours > 0 && ageHours > stage.slaHours;
                      return (
                        <div
                          key={opp.id}
                          draggable
                          onDragStart={() => setDragOppId(opp.id)}
                          onDragEnd={() => {
                            setDragOppId(null);
                            setDragOverStage(null);
                          }}
                          className={`cursor-grab space-y-2 rounded-lg border p-2.5 text-xs active:cursor-grabbing ${
                            slaBreached
                              ? 'border-rose-200 bg-rose-50/40 dark:border-rose-900/60 dark:bg-rose-950/20'
                              : 'border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-800/40'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-1">
                            <span className="font-semibold text-slate-900 dark:text-slate-100">
                              {opp.title}
                            </span>
                            <GripVertical size={13} className="mt-0.5 shrink-0 text-slate-400" />
                          </div>

                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {opp.contactName} · {opp.ownerName}
                          </div>

                          <div className="flex items-center justify-between text-[11px] font-medium tabular-nums">
                            <span className="text-indigo-600 dark:text-indigo-400">
                              {formatToman(opp.amount)}
                            </span>
                            <span className="text-slate-500">احتمال {toFa(opp.probability)}٪</span>
                          </div>

                          {slaBreached && (
                            <div className="flex items-center gap-1 text-[10px] font-medium text-rose-600 dark:text-rose-400">
                              <AlertTriangle size={11} />
                              عبور از SLA ({toFa(Math.round(ageHours))} ساعت توقف)
                            </div>
                          )}

                          {opp.stage === 'lost' && opp.lostReason && (
                            <div className="rounded bg-rose-50 px-2 py-1 text-[10px] text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
                              دلیل از دست رفتن: {opp.lostReason}
                            </div>
                          )}

                          <select
                            aria-label="تغییر مرحله فرصت"
                            value={opp.stage}
                            onChange={(e) => requestMoveStage(opp, e.target.value as PipelineStage)}
                            className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-[11px] dark:border-slate-700 dark:bg-slate-900"
                          >
                            {state.pipelineStages.map((st) => (
                              <option key={st.key} value={st.key}>
                                {st.label}
                              </option>
                            ))}
                          </select>

                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setQOppId(opp.id);
                                setQContactName(opp.contactName);
                                setQPhone(opp.phone);
                                setQItemName(opp.title);
                                setQItemPrice(String(opp.amount));
                                setQuoteCreateOpen(true);
                              }}
                              className="flex-1 rounded border border-slate-200 bg-white py-1 text-[10px] font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                            >
                              پیش‌فاکتور
                            </button>
                            {!opp.customerId && (
                              <button
                                type="button"
                                onClick={() => convertOpportunityToCustomer(opp.id)}
                                className="inline-flex flex-1 items-center justify-center gap-1 rounded border border-slate-200 bg-white py-1 text-[10px] font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                              >
                                <UserPlus size={11} />
                                تبدیل به مشتری
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 2: Versioned Quotes */}
      {tab === 'quotes' && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="border-b border-slate-200 bg-slate-50/70 text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">شماره / نسخه</th>
                  <th className="px-4 py-3 font-medium">مخاطب</th>
                  <th className="px-4 py-3 font-medium">جمع نهایی (با مالیات)</th>
                  <th className="px-4 py-3 font-medium">اعتبار تا</th>
                  <th className="px-4 py-3 font-medium">وضعیت مشتری</th>
                  <th className="px-4 py-3 font-medium text-left">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {state.quotes.map((q) => {
                  const sub = q.items.reduce((s, it) => s + it.qty * it.price, 0);
                  const afterDisc = sub * (1 - q.discountPct / 100);
                  const total = Math.round(afterDisc * (1 + q.taxPct / 100));
                  const statusLabel =
                    q.status === 'approved'
                      ? 'تأیید مشتری'
                      : q.status === 'rejected'
                        ? 'ردشده'
                        : q.status === 'sent'
                          ? 'ارسال‌شده'
                          : 'پیش‌نویس';
                  return (
                    <tr key={q.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-2.5 font-mono font-semibold tabular-nums">
                        {q.quoteNo}{' '}
                        <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                          v{toFa(q.version)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-medium">{q.contactName}</td>
                      <td className="px-4 py-2.5 font-semibold tabular-nums">{formatToman(total)}</td>
                      <td className="px-4 py-2.5 tabular-nums text-slate-500">{formatJalali(q.validUntil)}</td>
                      <td className="px-4 py-2.5">
                        <span
                          className={
                            q.status === 'approved'
                              ? 'font-semibold text-emerald-600'
                              : q.status === 'rejected'
                                ? 'font-semibold text-rose-600'
                                : 'text-slate-600 dark:text-slate-300'
                          }
                        >
                          {statusLabel}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-left">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => createQuoteVersion(q.id)}
                            className="inline-flex items-center gap-1 rounded border border-slate-200 px-2.5 py-1 text-[11px] hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                          >
                            <CopyPlus size={12} />
                            نسخه جدید
                          </button>
                          <button
                            type="button"
                            onClick={() => setPreviewQuote(q)}
                            className="inline-flex items-center gap-1 rounded bg-indigo-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-indigo-700"
                          >
                            <Printer size={12} />
                            چاپ / لینک تأیید
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
      )}

      {/* TAB 3: Sales Targets & Stepped Commissions */}
      {tab === 'targets' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {repStats.map((rs) => (
              <div
                key={rs.rep}
                className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Target size={16} className="text-indigo-500" />
                    {rs.rep}
                  </div>
                  <span className="text-xs font-bold tabular-nums text-indigo-600 dark:text-indigo-400">
                    {toFa(rs.pct)}٪ تحقق تارگت
                  </span>
                </div>

                <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full bg-indigo-600 transition-all"
                    style={{ width: `${rs.pct}%` }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs tabular-nums">
                  <div>
                    <div className="text-slate-500">فروش محقق‌شده ({toFa(rs.wonCount)} معامله)</div>
                    <div className="mt-0.5 font-bold text-emerald-600 dark:text-emerald-400">
                      {formatToman(rs.wonSum)}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">هدف دوره (تارگت قابل ویرایش)</div>
                    <input
                      type="number"
                      value={rs.targetAmount}
                      onChange={(e) => {
                        const val = Math.max(0, Number(e.target.value) || 0);
                        const existing = state.salesTargets.some((t) => t.ownerName === rs.rep);
                        const nextTargets = existing
                          ? state.salesTargets.map((t) =>
                              t.ownerName === rs.rep ? { ...t, targetAmount: val } : t,
                            )
                          : [
                              ...state.salesTargets,
                              {
                                id: `st_${Date.now()}`,
                                ownerName: rs.rep,
                                periodLabel: 'فصل پاییز ۱۴۰۵',
                                targetAmount: val,
                              },
                            ];
                        updateSalesTargets(nextTargets);
                      }}
                      className="mt-0.5 w-full rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold tabular-nums dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>
                </div>

                <div className="border-t border-slate-200 pt-2.5 text-xs dark:border-slate-800">
                  <div className="flex items-center justify-between font-semibold">
                    <span>پورسانت پلکانی محاسبه‌شده:</span>
                    <span className="tabular-nums text-indigo-600 dark:text-indigo-400">
                      {formatToman(rs.commission)}
                    </span>
                  </div>
                  {rs.breakdown.length > 0 && (
                    <div className="mt-1.5 space-y-0.5 text-[11px] text-slate-500 tabular-nums">
                      {rs.breakdown.map((b, i) => (
                        <div key={i} className="flex justify-between">
                          <span>
                            پله {b.rangeLabel} ({toFa(b.ratePct)}٪)
                          </span>
                          <span>{formatToman(b.commission)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: Pipeline Stages, SLA, Commission Tiers & Round-Robin */}
      {tab === 'settings' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-sm font-semibold">مراحل سفارشی قیف فروش، احتمال و SLA</h3>
            <div className="space-y-2">
              {stageDrafts.map((st, idx) => (
                <div key={st.key} className="grid grid-cols-12 items-center gap-2 text-xs">
                  <input
                    type="text"
                    value={st.label}
                    onChange={(e) =>
                      setStageDrafts((prev) =>
                        prev.map((row, i) => (i === idx ? { ...row, label: e.target.value } : row)),
                      )
                    }
                    className="col-span-6 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-800"
                  />
                  <div className="col-span-3 flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={st.probability}
                      onChange={(e) =>
                        setStageDrafts((prev) =>
                          prev.map((row, i) =>
                            i === idx ? { ...row, probability: Number(e.target.value) || 0 } : row,
                          ),
                        )
                      }
                      className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 tabular-nums dark:border-slate-700 dark:bg-slate-800"
                    />
                    <span>٪</span>
                  </div>
                  <div className="col-span-3 flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      value={st.slaHours}
                      onChange={(e) =>
                        setStageDrafts((prev) =>
                          prev.map((row, i) =>
                            i === idx ? { ...row, slaHours: Number(e.target.value) || 0 } : row,
                          ),
                        )
                      }
                      className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 tabular-nums dark:border-slate-700 dark:bg-slate-800"
                    />
                    <span className="text-[11px] text-slate-400">س</span>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => updatePipelineStages(stageDrafts)}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700"
            >
              ذخیره مراحل و SLA
            </button>
          </div>

          <div className="space-y-5">
            <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">توزیع چرخشی خودکار سرنخ‌ها (Round-robin)</h3>
                <label className="flex cursor-pointer items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={state.settings.autoAssignLeads}
                    onChange={(e) => updateSettings({ autoAssignLeads: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                  />
                  فعال به‌صورت پیش‌فرض
                </label>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                <RefreshCw size={14} className="text-indigo-500" />
                نوبت تخصیص سرنخ بعدی: <span className="font-bold">{nextRoundRobinOwner}</span>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="نام کارشناس جدید..."
                  value={newRepName}
                  onChange={(e) => setNewRepName(e.target.value)}
                  className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!newRepName.trim()) return;
                    updateSettings({
                      salesTeam: [...state.settings.salesTeam, newRepName.trim()],
                    });
                    setNewRepName('');
                  }}
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                >
                  افزودن به تیم
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {state.settings.salesTeam.map((rep) => (
                  <span
                    key={rep}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs dark:border-slate-700"
                  >
                    {rep}
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <h3 className="text-sm font-semibold">پله‌های محاسبه پورسانت (Progressive Tiers)</h3>
              <div className="space-y-2 text-xs">
                {tierDrafts.map((t, idx) => (
                  <div key={t.id} className="flex items-center gap-2">
                    <span className="w-24 text-slate-500">سقف (تومان):</span>
                    <input
                      type="number"
                      placeholder="نامحدود"
                      value={t.upToAmount ?? ''}
                      onChange={(e) =>
                        setTierDrafts((prev) =>
                          prev.map((row, i) =>
                            i === idx
                              ? { ...row, upToAmount: e.target.value ? Number(e.target.value) : null }
                              : row,
                          ),
                        )
                      }
                      className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 tabular-nums dark:border-slate-700 dark:bg-slate-800"
                    />
                    <span className="text-slate-500">نرخ:</span>
                    <input
                      type="number"
                      min={0}
                      max={50}
                      value={t.ratePct}
                      onChange={(e) =>
                        setTierDrafts((prev) =>
                          prev.map((row, i) =>
                            i === idx ? { ...row, ratePct: Number(e.target.value) || 0 } : row,
                          ),
                        )
                      }
                      className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1.5 tabular-nums dark:border-slate-700 dark:bg-slate-800"
                    />
                    <span>٪</span>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => updateCommissionTiers(tierDrafts)}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700"
              >
                ذخیره پلکان پورسانت
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mandatory Lost Reason Modal */}
      <Modal
        open={Boolean(lostModalOpp)}
        onClose={() => setLostModalOpp(null)}
        title={`ثبت دلیل از دست رفتن معامله: ${lostModalOpp?.title ?? ''}`}
        maxWidth="sm"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!lostModalOpp || !lostReasonDraft.trim()) return;
            moveOpportunityStage(lostModalOpp.id, 'lost', lostReasonDraft.trim());
            setLostModalOpp(null);
            setLostReasonDraft('');
          }}
          className="space-y-4"
        >
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
              دلیل از دست رفتن معامله (الزامی) *
            </label>
            <select
              value={lostReasonDraft}
              onChange={(e) => setLostReasonDraft(e.target.value)}
              className="mb-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="">-- انتخاب سریع دلیل یا نوشتن توضیح --</option>
              <option value="قیمت بالاتر از بودجه مشتری">قیمت بالاتر از بودجه مشتری</option>
              <option value="انتخاب رقیب">انتخاب رقیب</option>
              <option value="تأخیر در پاسخ‌گویی یا زمان تحویل">تأخیر در پاسخ‌گویی یا زمان تحویل</option>
              <option value="انصراف از خرید در مقطع فعلی">انصراف از خرید در مقطع فعلی</option>
            </select>
            <input
              type="text"
              required
              value={lostReasonDraft}
              onChange={(e) => setLostReasonDraft(e.target.value)}
              placeholder="شرح دقیق دلیل از دست رفتن..."
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setLostModalOpp(null)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs dark:border-slate-700"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-medium text-white hover:bg-rose-700"
            >
              ثبت و انتقال به ازدست‌رفته
            </button>
          </div>
        </form>
      </Modal>

      {/* Create Opportunity Modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="ثبت سرنخ / فرصت فروش جدید" maxWidth="md">
        <form onSubmit={handleCreate} className="space-y-4">
          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
              {error}
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">عنوان فرصت *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثلاً: پکیج کامل مراقبت پوست"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">نام مخاطب *</label>
              <input
                type="text"
                required
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">موبایل *</label>
              <input
                type="tel"
                required
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="09120000000"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm tabular-nums dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">ارزش برآوردی (تومان)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm tabular-nums dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">منبع</label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="اینستاگرام">اینستاگرام</option>
                <option value="سایت">سایت</option>
                <option value="معرفی">معرفی</option>
                <option value="تبلیغات">تبلیغات</option>
              </select>
            </div>
          </div>

          <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-800/40">
            <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
              <input
                type="checkbox"
                checked={useRoundRobin}
                onChange={(e) => setUseRoundRobin(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600"
              />
              تخصیص خودکار چرخشی (Round-robin) به کارشناس بعدی: <span className="text-indigo-600 dark:text-indigo-400">{nextRoundRobinOwner}</span>
            </label>
            {!useRoundRobin && (
              <select
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900"
              >
                {state.settings.salesTeam.map((rep) => (
                  <option key={rep} value={rep}>
                    {rep}
                  </option>
                ))}
              </select>
            )}
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
              ثبت فرصت
            </button>
          </div>
        </form>
      </Modal>

      {/* Create Versioned Quote Modal */}
      <Modal open={quoteCreateOpen} onClose={() => setQuoteCreateOpen(false)} title="صدور پیش‌فاکتور نسخه‌دار" maxWidth="md">
        <form onSubmit={handleCreateQuote} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-slate-500">نام مخاطب / خریدار *</label>
              <input
                type="text"
                required
                value={qContactName}
                onChange={(e) => setQContactName(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">شماره تماس</label>
              <input
                type="tel"
                dir="ltr"
                value={qPhone}
                onChange={(e) => setQPhone(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs text-slate-500">شرح کالا یا خدمات پیشنهادی *</label>
            <input
              type="text"
              required
              value={qItemName}
              onChange={(e) => setQItemName(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="mb-1 block text-xs text-slate-500">تعداد</label>
              <input
                type="number"
                min={1}
                value={qItemQty}
                onChange={(e) => setQItemQty(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">مبلغ واحد (تومان)</label>
              <input
                type="number"
                min={0}
                value={qItemPrice}
                onChange={(e) => setQItemPrice(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">تخفیف (٪)</label>
              <input
                type="number"
                min={0}
                max={80}
                value={qDiscountPct}
                onChange={(e) => setQDiscountPct(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs text-slate-500">توضیحات / شرایط پرداخت</label>
            <textarea
              rows={2}
              value={qNotes}
              onChange={(e) => setQNotes(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setQuoteCreateOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs dark:border-slate-700"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700"
            >
              ایجاد پیش‌فاکتور (نسخه ۱)
            </button>
          </div>
        </form>
      </Modal>

      <QuotePreviewModal quote={previewQuote} onClose={() => setPreviewQuote(null)} />
    </div>
  );
}
