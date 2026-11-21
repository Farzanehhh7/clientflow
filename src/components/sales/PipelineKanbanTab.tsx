import { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import jalaliday from 'jalaliday';
import { AlertTriangle, BarChart3, Clock, GripVertical, History, Trash2, UserPlus } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useClientFlow } from '../../store/useClientFlowStore';
import type { Opportunity, PackSalesConfig, PipelineStage } from '../../types';
import { formatDurationHoursFa } from '../../utils/crmHelpers';
import { formatCustomFieldValue, getTableCustomFields } from '../../utils/customFieldValidation';
import { formatJalali, formatToman, toFa } from '../../utils/jalali';
import { hasPermission } from '../../utils/security';
import { Modal } from '../Modal';

dayjs.extend(jalaliday);

interface PipelineKanbanTabProps {
  packSales: PackSalesConfig;
  selectedPipelineId: string;
  onSelectPipeline: (id: string) => void;
  onCreateQuoteForOpp: (opp: Opportunity) => void;
}

const STAGE_TOP_COLOR: Record<PipelineStage, string> = {
  lead: 'border-t-slate-400',
  contacted: 'border-t-sky-500',
  proposal: 'border-t-indigo-500',
  negotiation: 'border-t-amber-500',
  won: 'border-t-emerald-500',
  lost: 'border-t-rose-500',
};

export function PipelineKanbanTab({
  packSales,
  selectedPipelineId,
  onSelectPipeline,
  onCreateQuoteForOpp,
}: PipelineKanbanTabProps) {
  const { state, moveOpportunityStage, convertOpportunityToCustomer, softDeleteEntity } = useClientFlow();
  const canDeleteOpp = hasPermission(state, 'sales', 'delete');

  const [dragOppId, setDragOppId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<PipelineStage | null>(null);
  const [lostModalOpp, setLostModalOpp] = useState<Opportunity | null>(null);
  const [lostReasonDraft, setLostReasonDraft] = useState('');
  const [historyOpp, setHistoryOpp] = useState<Opportunity | null>(null);
  const [forecastMode, setForecastMode] = useState<'stage' | 'month'>('stage');
  const [showForecast, setShowForecast] = useState(true);

  const activePipeline = useMemo(
    () =>
      state.pipelines.find((p) => p.id === selectedPipelineId) ??
      state.pipelines.find((p) => p.isDefault) ??
      state.pipelines[0],
    [state.pipelines, selectedPipelineId],
  );

  const stages = activePipeline?.stages ?? state.pipelineStages;
  const defaultPipelineId = state.pipelines.find((p) => p.isDefault)?.id ?? 'pl_main';

  const pipelineOpps = useMemo(() => {
    const activeBranch = state.settings.activeBranchId;
    return state.opportunities.filter((o) => {
      if (o.isDeleted) return false;
      const matchesPipeline = (o.pipelineId ?? defaultPipelineId) === activePipeline?.id;
      const matchesBranch = !activeBranch || activeBranch === 'all' || !o.branchId || o.branchId === activeBranch;
      return matchesPipeline && matchesBranch;
    });
  }, [state.opportunities, activePipeline?.id, defaultPipelineId, state.settings.activeBranchId]);

  const oppCardFields = useMemo(
    () => getTableCustomFields(state.customFieldDefs, 'opportunity'),
    [state.customFieldDefs],
  );

  const forecastData = useMemo(() => {
    if (forecastMode === 'stage') {
      return stages
        .filter((s) => s.key !== 'lost')
        .map((st) => {
          const opps = pipelineOpps.filter((o) => o.stage === st.key);
          const raw = opps.reduce((sum, o) => sum + o.amount, 0);
          const weighted = opps.reduce((sum, o) => sum + Math.round((o.amount * o.probability) / 100), 0);
          return {
            name: st.label,
            rawM: Math.round((raw / 1_000_000) * 10) / 10,
            weightedM: Math.round((weighted / 1_000_000) * 10) / 10,
          };
        });
    }

    const monthMap = new Map<string, { sortKey: string; name: string; raw: number; weighted: number }>();
    pipelineOpps
      .filter((o) => o.stage !== 'lost')
      .forEach((o) => {
        const d = dayjs(o.expectedCloseDate || o.updatedAt).calendar('jalali').locale('fa');
        const sortKey = d.format('YYYY/MM');
        const name = d.format('MMMM YYYY');
        const cur = monthMap.get(sortKey) ?? { sortKey, name: toFa(name), raw: 0, weighted: 0 };
        cur.raw += o.amount;
        cur.weighted += Math.round((o.amount * o.probability) / 100);
        monthMap.set(sortKey, cur);
      });

    return Array.from(monthMap.values())
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      .map((m) => ({
        name: m.name,
        rawM: Math.round((m.raw / 1_000_000) * 10) / 10,
        weightedM: Math.round((m.weighted / 1_000_000) * 10) / 10,
      }));
  }, [forecastMode, stages, pipelineOpps]);

  const totalWeighted = useMemo(
    () =>
      pipelineOpps
        .filter((o) => o.stage !== 'lost')
        .reduce((sum, o) => sum + Math.round((o.amount * o.probability) / 100), 0),
    [pipelineOpps],
  );

  const requestMoveStage = (opp: Opportunity, nextStage: PipelineStage) => {
    if (opp.stage === nextStage) return;
    if (nextStage === 'lost') {
      setLostModalOpp(opp);
      setLostReasonDraft(opp.lostReason ?? '');
    } else {
      moveOpportunityStage(opp.id, nextStage);
    }
  };

  const nowMs = Date.now();
  const liveHistoryOpp = historyOpp
    ? state.opportunities.find((o) => o.id === historyOpp.id) ?? historyOpp
    : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500">قیف فعال:</span>
            <select
              aria-label="انتخاب قیف فروش"
              value={activePipeline?.id ?? ''}
              onChange={(e) => onSelectPipeline(e.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 font-semibold dark:border-slate-700 dark:bg-slate-950"
            >
              {state.pipelines.map((pl) => (
                <option key={pl.id} value={pl.id}>
                  {pl.name} ({toFa(state.opportunities.filter((o) => !o.isDeleted && (o.pipelineId ?? defaultPipelineId) === pl.id).length)})
                </option>
              ))}
            </select>
          </div>
          <div className="text-xs text-slate-500 tabular-nums">
            پیش‌بینی وزنی این قیف:{' '}
            <span className="font-bold text-indigo-600 dark:text-indigo-400">
              {formatToman(totalWeighted)}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowForecast((v) => !v)}
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <BarChart3 size={14} />
          {showForecast ? 'مخفی کردن نمودار پیش‌بینی وزنی' : 'نمایش نمودار پیش‌بینی وزنی'}
        </button>
      </div>

      {showForecast && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold">نمودار پیش‌بینی وزنی فروش ({packSales.dealPlural})</div>
              <div className="text-[11px] text-slate-500">مقایسه ارزش کل در برابر ارزش وزنی (مبلغ × احتمال مرحله) به میلیون تومان</div>
            </div>
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 text-[11px] dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setForecastMode('stage')}
                className={`whitespace-nowrap rounded px-2.5 py-1 font-medium ${
                  forecastMode === 'stage'
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100'
                    : 'text-slate-500'
                }`}
              >
                بر اساس مرحله
              </button>
              <button
                type="button"
                onClick={() => setForecastMode('month')}
                className={`whitespace-nowrap rounded px-2.5 py-1 font-medium ${
                  forecastMode === 'month'
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100'
                    : 'text-slate-500'
                }`}
              >
                بر اساس ماه بسته شدن
              </button>
            </div>
          </div>

          <div className="h-56 w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={forecastData} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    `${toFa(value)} میلیون تومان`,
                    name === 'rawM' ? 'ارزش کل' : 'پیش‌بینی وزنی',
                  ]}
                />
                <Legend
                  formatter={(value) => (value === 'rawM' ? 'ارزش ناخالص (میلیون)' : 'پیش‌بینی وزنی (میلیون)')}
                />
                <Bar dataKey="rawM" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="weightedM" fill="#4f46e5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
        {stages.map((stage) => {
          const cards = pipelineOpps.filter((o) => o.stage === stage.key);
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
                const opp = pipelineOpps.find((o) => o.id === dragOppId);
                setDragOppId(null);
                if (opp) requestMoveStage(opp, stage.key);
              }}
              className={`flex min-h-[360px] flex-col rounded-xl border border-t-4 transition-colors ${
                STAGE_TOP_COLOR[stage.key]
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
                  <span>{toFa(stage.probability)}٪</span>
                </div>
              </div>

              <div className="flex-1 space-y-2.5 p-2.5">
                {cards.length === 0 ? (
                  <div className="py-10 text-center text-xs text-slate-400">کارت را به اینجا بکشید</div>
                ) : (
                  cards.map((opp) => {
                    const currentStageStart =
                      opp.stageHistory?.[opp.stageHistory.length - 1]?.enteredAt ?? opp.updatedAt;
                    const ageHours = Math.max(
                      0,
                      (nowMs - new Date(currentStageStart).getTime()) / 3600_000,
                    );
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
                          <span className="text-slate-500">{toFa(opp.probability)}٪</span>
                        </div>

                        <div className="flex items-center justify-between text-[10px] tabular-nums text-slate-500">
                          <span className="inline-flex items-center gap-1">
                            <Clock size={10} />
                            {formatDurationHoursFa(ageHours)} در این مرحله
                          </span>
                          {opp.expectedCloseDate && (
                            <span>بستن: {formatJalali(opp.expectedCloseDate)}</span>
                          )}
                        </div>

                        {slaBreached && (
                          <div className="flex items-center gap-1 text-[10px] font-medium text-rose-600 dark:text-rose-400">
                            <AlertTriangle size={11} />
                            عبور از SLA ({toFa(stage.slaHours)} ساعت)
                          </div>
                        )}

                        {opp.stage === 'lost' && opp.lostReason && (
                          <div className="rounded bg-rose-50 px-2 py-1 text-[10px] text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
                            دلیل از دست رفتن: {opp.lostReason}
                          </div>
                        )}

                        {oppCardFields.map((def) => {
                          const val = opp.customFields?.[def.key];
                          if (!val) return null;
                          return (
                            <div key={def.id} className="truncate text-[10px] text-slate-600 dark:text-slate-300">
                              {def.label}: <span className="font-medium">{formatCustomFieldValue(def, val)}</span>
                            </div>
                          );
                        })}

                        <select
                          aria-label="تغییر مرحله فرصت"
                          value={opp.stage}
                          onChange={(e) => requestMoveStage(opp, e.target.value as PipelineStage)}
                          className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-[11px] dark:border-slate-700 dark:bg-slate-900"
                        >
                          {stages.map((st) => (
                            <option key={st.key} value={st.key}>
                              {st.label}
                            </option>
                          ))}
                        </select>

                        <div className="flex flex-wrap gap-1">
                          <button
                            type="button"
                            onClick={() => onCreateQuoteForOpp(opp)}
                            className="flex-1 whitespace-nowrap rounded border border-slate-200 bg-white py-1 text-[10px] font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                          >
                            پیش‌فاکتور
                          </button>
                          <button
                            type="button"
                            onClick={() => setHistoryOpp(opp)}
                            title="تاریخچه مراحل و زمان ماندگاری"
                            className="inline-flex items-center justify-center gap-1 whitespace-nowrap rounded border border-slate-200 bg-white px-2 py-1 text-[10px] font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                          >
                            <History size={11} />
                            تاریخچه
                          </button>
                          {!opp.customerId && (
                            <button
                              type="button"
                              onClick={() => convertOpportunityToCustomer(opp.id)}
                              className="inline-flex flex-1 items-center justify-center gap-1 whitespace-nowrap rounded border border-slate-200 bg-white py-1 text-[10px] font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                            >
                              <UserPlus size={11} />
                              تبدیل مشتری
                            </button>
                          )}
                          {canDeleteOpp && (
                            <button
                              type="button"
                              onClick={() => softDeleteEntity('opportunity', opp.id)}
                              title="انتقال به سطل بازیافت"
                              aria-label={`حذف معامله ${opp.title}`}
                              className="inline-flex items-center justify-center rounded border border-slate-200 bg-white px-1.5 py-1 text-slate-400 hover:border-rose-200 hover:text-rose-600 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-rose-900 dark:hover:text-rose-400"
                            >
                              <Trash2 size={11} />
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

      <Modal
        open={Boolean(lostModalOpp)}
        onClose={() => setLostModalOpp(null)}
        title={`ثبت دلیل از دست رفتن ${packSales.dealSingular}`}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!lostModalOpp || !lostReasonDraft.trim()) return;
            moveOpportunityStage(lostModalOpp.id, 'lost', lostReasonDraft.trim());
            setLostModalOpp(null);
            setLostReasonDraft('');
          }}
          className="space-y-3 text-xs"
        >
          <div className="rounded-lg bg-rose-50 p-3 text-rose-800 dark:bg-rose-950/30 dark:text-rose-200">
            برای انتقال «{lostModalOpp?.title}» به مرحله ازدست‌رفته، درج دلیل الزامی است.
          </div>
          <div className="flex flex-wrap gap-1.5">
            {['قیمت بالا / محدودیت بودجه', 'انتخاب رقیب', 'عدم پاسخگویی مشتری', 'تغییر اولویت زمانی'].map((reason) => (
              <button
                key={reason}
                type="button"
                onClick={() => setLostReasonDraft(reason)}
                className="rounded border border-slate-200 px-2.5 py-1 text-[11px] hover:bg-slate-100 dark:border-slate-700"
              >
                {reason}
              </button>
            ))}
          </div>
          <textarea
            required
            rows={2}
            value={lostReasonDraft}
            onChange={(e) => setLostReasonDraft(e.target.value)}
            placeholder="دلیل دقیق از دست رفتن معامله..."
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setLostModalOpp(null)}
              className="rounded-lg border border-slate-200 px-4 py-2 font-medium dark:border-slate-700"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="rounded-lg bg-rose-600 px-4 py-2 font-medium text-white hover:bg-rose-700"
            >
              تأیید انتقال
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(liveHistoryOpp)}
        onClose={() => setHistoryOpp(null)}
        title={`تاریخچه مراحل و زمان ماندگاری · ${liveHistoryOpp?.title ?? ''}`}
      >
        {liveHistoryOpp && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-3 tabular-nums dark:bg-slate-800/40">
              <div>مخاطب: {liveHistoryOpp.contactName}</div>
              <div>ارزش: {formatToman(liveHistoryOpp.amount)}</div>
              <div>تاریخ پیش‌بینی بستن: {liveHistoryOpp.expectedCloseDate ? formatJalali(liveHistoryOpp.expectedCloseDate) : '—'}</div>
              <div>وزن پیش‌بینی: {formatToman(Math.round((liveHistoryOpp.amount * liveHistoryOpp.probability) / 100))}</div>
            </div>

            <div className="space-y-2">
              {(liveHistoryOpp.stageHistory && liveHistoryOpp.stageHistory.length > 0
                ? liveHistoryOpp.stageHistory
                : [{ stage: liveHistoryOpp.stage, label: liveHistoryOpp.stage, enteredAt: liveHistoryOpp.createdAt }]
              ).map((entry, idx) => {
                const liveDur =
                  entry.durationHours ??
                  Math.max(0.1, Math.round(((nowMs - new Date(entry.enteredAt).getTime()) / 3600_000) * 10) / 10);
                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2.5 dark:border-slate-800"
                  >
                    <div>
                      <div className="font-semibold">{entry.label}</div>
                      <div className="mt-0.5 text-[11px] tabular-nums text-slate-500">
                        ورود: {formatJalali(entry.enteredAt, 'YYYY/MM/DD HH:mm')}
                        {entry.exitedAt ? ` · خروج: ${formatJalali(entry.exitedAt, 'YYYY/MM/DD HH:mm')}` : ' · مرحله فعلی'}
                      </div>
                    </div>
                    <div className="text-left font-semibold tabular-nums text-indigo-600 dark:text-indigo-400">
                      {formatDurationHoursFa(liveDur)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
