import { useMemo, useState } from 'react';
import {
  Activity,
  Check,
  Clock,
  GitBranch,
  GitFork,
  Hand,
  History,
  Play,
  Plus,
  UserPlus,
  Workflow,
  X,
} from 'lucide-react';
import { Modal } from '../components/Modal';
import { WorkflowDesignerTab } from '../components/workflows/WorkflowDesignerTab';
import { WorkflowMiningTab } from '../components/workflows/WorkflowMiningTab';
import { useClientFlow } from '../store/useClientFlowStore';
import type { WorkflowDefinition, WorkflowType } from '../types';
import { formatJalaliDateTime, toFa } from '../utils/jalali';

const WF_TYPE_LABEL: Record<WorkflowType, string> = {
  discount_approval: 'تأیید تخفیف ویژه (>۲۰٪)',
  order_fulfillment: 'تکمیل و ارسال سفارش',
  order_return: 'مرجوعی و استرداد سفارش',
  vip_schedule: 'نوبت‌دهی ویژه VIP',
  complaint: 'رسیدگی به شکایت مشتری',
  custom: 'فرآیند سفارشی (BPMN)',
};

export function WorkflowsPage() {
  const {
    state,
    createWorkflowInstance,
    decideWorkflowStep,
    claimWorkflowStep,
    reassignWorkflowStep,
    delegateWorkflowStep,
    advanceWorkflowTimer,
  } = useClientFlow();

  const [tab, setTab] = useState<'instances' | 'designer' | 'mining'>('instances');
  const [filter, setFilter] = useState<'all' | 'running' | 'completed'>('all');
  const [createOpen, setCreateOpen] = useState(false);

  // Start Workflow Instance Modal
  const [title, setTitle] = useState('');
  const [selectedDefId, setSelectedDefId] = useState(
    state.workflowDefinitions.find((d) => d.status === 'published')?.id ?? state.workflowDefinitions[0]?.id ?? '',
  );
  const [customerId, setCustomerId] = useState(state.customers[0]?.id ?? '');
  const [commentMap, setCommentMap] = useState<Record<string, string>>({});
  const [stepFormValues, setStepFormValues] = useState<Record<string, Record<string, string>>>({});
  const [reassignTarget, setReassignTarget] = useState<Record<string, string>>({});
  const [delegateTarget, setDelegateTarget] = useState<Record<string, string>>({});
  const [expandedHistoryIds, setExpandedHistoryIds] = useState<Record<string, boolean>>({});

  // Visual Designer selection state
  const activeDef = useMemo(
    () => state.workflowDefinitions[0] ?? null,
    [state.workflowDefinitions],
  );
  const [draftDef, setDraftDef] = useState<WorkflowDefinition | null>(activeDef);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(activeDef?.nodes[1]?.id ?? null);

  const loadDefinitionIntoEditor = (def: WorkflowDefinition) => {
    setDraftDef(JSON.parse(JSON.stringify(def)) as WorkflowDefinition);
    setSelectedNodeId(def.nodes[1]?.id ?? def.nodes[0]?.id ?? null);
  };

  const publishedDefs = useMemo(
    () => state.workflowDefinitions.filter((d) => d.status === 'published'),
    [state.workflowDefinitions],
  );

  const filtered = state.workflows.filter((w) => {
    if (filter === 'all') return true;
    if (filter === 'running') return w.status === 'running';
    return w.status !== 'running';
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const def = state.workflowDefinitions.find((d) => d.id === selectedDefId);
    createWorkflowInstance({
      title,
      type: def?.type ?? 'custom',
      definitionId: def?.id,
      customerId,
    });
    setTitle('');
    setCreateOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => setTab('instances')}
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === 'instances'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <Play size={13} />
            فرایندهای در جریان ({toFa(state.workflows.length)})
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('designer');
              if (!draftDef && activeDef) loadDefinitionIntoEditor(activeDef);
            }}
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === 'designer'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <Workflow size={14} />
            طراح فرآیند و نسخه‌گذاری ({toFa(state.workflowDefinitions.length)})
          </button>
          <button
            type="button"
            onClick={() => setTab('mining')}
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === 'mining'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <Activity size={14} />
            تحلیل گلوگاه (Process Mining)
          </button>
        </div>

        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700"
        >
          <Plus size={16} />
          آغاز گردش کار جدید
        </button>
      </div>

      {tab === 'instances' && (
        <>
          <div className="flex w-fit items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-900">
            {(
              [
                ['all', 'همه فرایندها'],
                ['running', 'در جریان'],
                ['completed', 'پایان‌یافته'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setFilter(k)}
                className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  filter === k
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            {filtered.map((wf) => {
              const cust = state.customers.find((c) => c.id === wf.customerId);
              const curStep = wf.steps[wf.currentStepIndex];
              const canAct =
                wf.status === 'running' &&
                curStep &&
                (curStep.role === 'staff' || state.settings.role === 'admin' || Boolean(curStep.delegatedTo));

              const statusText =
                wf.status === 'running'
                  ? 'در جریان'
                  : wf.status === 'approved'
                    ? 'تأیید نهایی'
                    : 'رد شده';
              const statusClass =
                wf.status === 'approved'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : wf.status === 'rejected'
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-amber-600 dark:text-amber-400';

              const curFormValues = stepFormValues[wf.id] ?? {};
              const histOpen = Boolean(expandedHistoryIds[wf.id]);

              return (
                <div
                  key={wf.id}
                  className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-3 dark:border-slate-800">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                        <span>{wf.title}</span>
                        {wf.definitionVersion && (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-normal text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            نسخه {toFa(wf.definitionVersion)}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {WF_TYPE_LABEL[wf.type] ?? wf.type}
                        {cust && ` · مشتری: ${cust.name}`}
                        {' · '}
                        SLA کل: <span className="tabular-nums">{toFa(wf.slaHours)} ساعت</span>
                        {' · '}
                        <span className="tabular-nums">{formatJalaliDateTime(wf.createdAt)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {wf.history && wf.history.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setExpandedHistoryIds((p) => ({ ...p, [wf.id]: !p[wf.id] }))}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                        >
                          <History size={12} />
                          تاریخچه ({toFa(wf.history.length)})
                        </button>
                      )}
                      <span className={`text-xs font-semibold ${statusClass}`}>{statusText}</span>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2.5">
                    {wf.steps.map((step, idx) => {
                      const isCurrent = wf.status === 'running' && idx === wf.currentStepIndex;
                      const isWaitOrTimer = step.nodeType === 'timer' || step.nodeType === 'wait';
                      return (
                        <div
                          key={idx}
                          className={`rounded-lg border px-3.5 py-2.5 text-xs ${
                            isCurrent
                              ? 'border-indigo-300 bg-indigo-50/40 dark:border-indigo-700 dark:bg-indigo-950/20'
                              : 'border-slate-200 dark:border-slate-800'
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <div className="flex flex-wrap items-center gap-2 font-medium text-slate-900 dark:text-slate-100">
                                <span>
                                  {toFa(idx + 1)}. {step.name}
                                </span>
                                {step.nodeType === 'approval' && (
                                  <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] text-violet-800 dark:bg-violet-950/50 dark:text-violet-300">
                                    تأییدیه
                                  </span>
                                )}
                                {step.nodeType === 'decision' && (
                                  <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                                    <GitBranch size={10} />
                                    تصمیم شرطی
                                  </span>
                                )}
                                {step.nodeType === 'parallel_gateway' && (
                                  <span className="inline-flex items-center gap-1 rounded bg-orange-100 px-1.5 py-0.5 text-[10px] text-orange-800 dark:bg-orange-950/50 dark:text-orange-300">
                                    <GitFork size={10} />
                                    تأیید موازی
                                  </span>
                                )}
                                {isWaitOrTimer && (
                                  <span className="inline-flex items-center gap-1 rounded bg-sky-100 px-1.5 py-0.5 text-[10px] text-sky-800 dark:bg-sky-950/50 dark:text-sky-300">
                                    <Clock size={10} />
                                    انتظار {toFa(step.timerHours ?? 2)} ساعت
                                  </span>
                                )}
                                {step.stepSlaHours && (
                                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                    SLA گام: {toFa(step.stepSlaHours)}س
                                  </span>
                                )}
                              </div>
                              <div className="mt-0.5 text-slate-500 dark:text-slate-400">
                                {step.assigneeType === 'user' && step.assignee
                                  ? `مسئول مشخص: ${step.assignee}`
                                  : `نقش: ${step.role === 'admin' ? 'مدیر سیستم' : 'کارشناس / مدیر'}${
                                      step.assignee ? ` · مسئول: ${step.assignee}` : ''
                                    }`}
                                {step.claimedBy && ` · Claim‌شده توسط: ${step.claimedBy}`}
                                {step.delegatedTo && ` · تفویض به: ${step.delegatedTo}`}
                                {step.actor && ` · اقدام‌کننده: ${step.actor}`}
                                {step.at && ` · ${formatJalaliDateTime(step.at)}`}
                              </div>
                              {step.decisionResult && (
                                <div className="mt-1 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                                  نتیجه تصمیم: {step.decisionResult}
                                </div>
                              )}
                              {step.comment && (
                                <div className="mt-1 text-slate-700 dark:text-slate-300">یادداشت: {step.comment}</div>
                              )}
                              {step.stepData && Object.keys(step.stepData).length > 0 && (
                                <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-indigo-700 dark:text-indigo-300">
                                  {Object.entries(step.stepData).map(([k, v]) => (
                                    <span key={k} className="rounded bg-white/80 px-2 py-0.5 dark:bg-slate-900">
                                      {k}: {v}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div className="shrink-0 font-medium">
                              {step.status === 'approved' && (
                                <span className="text-emerald-600 dark:text-emerald-400">تأیید شده</span>
                              )}
                              {step.status === 'rejected' && (
                                <span className="text-rose-600 dark:text-rose-400">رد شده</span>
                              )}
                              {step.status === 'pending' && (
                                <span className="text-slate-400">{isCurrent ? 'منتظر اقدام' : 'در صف'}</span>
                              )}
                            </div>
                          </div>

                          {/* Parallel Branches */}
                          {step.nodeType === 'parallel_gateway' && step.parallelBranches && (
                            <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                              {step.parallelBranches.map((br, bIdx) => (
                                <div
                                  key={bIdx}
                                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
                                >
                                  <div>
                                    <div className="font-medium text-slate-800 dark:text-slate-200">
                                      {br.branchName}
                                    </div>
                                    <div className="text-[11px] text-slate-400">
                                      {br.status === 'approved'
                                        ? `تأیید توسط ${br.actor ?? '-'}`
                                        : br.status === 'rejected'
                                          ? `رد توسط ${br.actor ?? '-'}`
                                          : 'در انتظار تأیید'}
                                    </div>
                                  </div>
                                  {isCurrent && br.status === 'pending' && (
                                    <div className="flex gap-1">
                                      <button
                                        type="button"
                                        onClick={() => decideWorkflowStep(wf.id, 'approved', commentMap[wf.id], undefined, bIdx)}
                                        className="rounded bg-emerald-600 px-2 py-1 text-[11px] text-white hover:bg-emerald-700"
                                      >
                                        تأیید
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => decideWorkflowStep(wf.id, 'rejected', commentMap[wf.id], undefined, bIdx)}
                                        className="rounded border border-rose-200 px-2 py-1 text-[11px] text-rose-600 hover:bg-rose-50"
                                      >
                                        رد
                                      </button>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Step Custom Form Inputs */}
                          {isCurrent && step.formFields && step.formFields.length > 0 && (
                            <div className="mt-3 grid grid-cols-1 gap-2 rounded-lg border border-indigo-200 bg-white p-3 sm:grid-cols-2 dark:border-indigo-900 dark:bg-slate-900">
                              {step.formFields.map((ff) => (
                                <div key={ff.id}>
                                  <label className="mb-1 block text-[11px] font-medium text-slate-600 dark:text-slate-400">
                                    {ff.label} {ff.required ? '*' : ''}
                                  </label>
                                  {ff.type === 'select' ? (
                                    <select
                                      value={curFormValues[ff.key] ?? ''}
                                      onChange={(e) =>
                                        setStepFormValues((prev) => ({
                                          ...prev,
                                          [wf.id]: { ...(prev[wf.id] ?? {}), [ff.key]: e.target.value },
                                        }))
                                      }
                                      className="w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                                    >
                                      <option value="">انتخاب...</option>
                                      {(ff.options ?? []).map((op) => (
                                        <option key={op} value={op}>
                                          {op}
                                        </option>
                                      ))}
                                    </select>
                                  ) : (
                                    <input
                                      type={ff.type === 'number' || ff.type === 'money' ? 'number' : 'text'}
                                      value={curFormValues[ff.key] ?? ''}
                                      onChange={(e) =>
                                        setStepFormValues((prev) => ({
                                          ...prev,
                                          [wf.id]: { ...(prev[wf.id] ?? {}), [ff.key]: e.target.value },
                                        }))
                                      }
                                      className="w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                                    />
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Instance Execution History */}
                  {histOpen && wf.history && (
                    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-xs dark:border-slate-800 dark:bg-slate-950/40">
                      <div className="mb-2 font-semibold text-slate-700 dark:text-slate-200">
                        تاریخچه گام‌ها و تصمیمات ({toFa(wf.history.length)})
                      </div>
                      <div className="space-y-1.5">
                        {wf.history.map((h) => (
                          <div key={h.id} className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                            <span>
                              <strong>{h.actor}</strong> · {h.stepName}: {h.detail}
                            </span>
                            <span className="tabular-nums text-slate-400">{formatJalaliDateTime(h.at)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Step Actions Bar */}
                  {wf.status === 'running' && curStep && (
                    <div className="mt-4 space-y-2.5 border-t border-slate-200 pt-3 dark:border-slate-800">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() => claimWorkflowStep(wf.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
                        >
                          <Hand size={13} />
                          در دست گرفتن گام (Claim)
                        </button>

                        <div className="flex items-center gap-1">
                          <select
                            aria-label="تغییر مسئول گام"
                            value={reassignTarget[wf.id] ?? ''}
                            onChange={(e) => setReassignTarget((p) => ({ ...p, [wf.id]: e.target.value }))}
                            className="rounded border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
                          >
                            <option value="">ارجاع به...</option>
                            {state.settings.salesTeam.map((m) => (
                              <option key={m} value={m}>
                                {m}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            disabled={!reassignTarget[wf.id]}
                            onClick={() => {
                              if (!reassignTarget[wf.id]) return;
                              reassignWorkflowStep(wf.id, reassignTarget[wf.id]);
                            }}
                            className="rounded border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700"
                          >
                            Reassign
                          </button>
                        </div>

                        <div className="flex items-center gap-1">
                          <select
                            aria-label="تفویض اختیار"
                            value={delegateTarget[wf.id] ?? ''}
                            onChange={(e) => setDelegateTarget((p) => ({ ...p, [wf.id]: e.target.value }))}
                            className="rounded border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
                          >
                            <option value="">تفویض اختیار به...</option>
                            {state.settings.salesTeam.map((m) => (
                              <option key={m} value={m}>
                                {m}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            disabled={!delegateTarget[wf.id]}
                            onClick={() => {
                              if (!delegateTarget[wf.id]) return;
                              delegateWorkflowStep(wf.id, delegateTarget[wf.id]);
                            }}
                            className="inline-flex items-center gap-1 rounded border border-indigo-200 px-2 py-1 text-xs text-indigo-700 hover:bg-indigo-50 disabled:opacity-40 dark:border-indigo-800 dark:text-indigo-300"
                          >
                            <UserPlus size={12} />
                            تفویض (Delegate)
                          </button>
                        </div>

                        {(curStep.nodeType === 'timer' || curStep.nodeType === 'wait') && (
                          <button
                            type="button"
                            onClick={() => advanceWorkflowTimer(wf.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs text-sky-700 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300"
                          >
                            <Clock size={13} />
                            شبیه‌سازی انقضای انتظار و عبور
                          </button>
                        )}
                      </div>

                      {curStep.nodeType !== 'parallel_gateway' && (
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="text"
                            placeholder="یادداشت یا دلیل تأیید/رد..."
                            value={commentMap[wf.id] ?? ''}
                            onChange={(e) => setCommentMap((m) => ({ ...m, [wf.id]: e.target.value }))}
                            className="min-w-[200px] flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                          />
                          {canAct ? (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  decideWorkflowStep(wf.id, 'approved', commentMap[wf.id], stepFormValues[wf.id])
                                }
                                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                              >
                                <Check size={14} />
                                تأیید مرحله
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  decideWorkflowStep(wf.id, 'rejected', commentMap[wf.id], stepFormValues[wf.id])
                                }
                                className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-400"
                              >
                                <X size={14} />
                                رد درخواست
                              </button>
                            </>
                          ) : (
                            <span className="text-xs text-amber-600 dark:text-amber-400">
                              این مرحله منتظر تأیید «مدیر سیستم» است (در نقش کارشناس فقط با تفویض اختیار قابل تأیید است).
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {tab === 'designer' && (
        <WorkflowDesignerTab
          draftDef={draftDef}
          setDraftDef={setDraftDef}
          selectedNodeId={selectedNodeId}
          setSelectedNodeId={setSelectedNodeId}
          onLoadDefinition={loadDefinitionIntoEditor}
        />
      )}

      {tab === 'mining' && <WorkflowMiningTab />}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="شروع فرایند گردش کار جدید" maxWidth="md">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
              انتخاب الگوی منتشرشده (BPMN)
            </label>
            <select
              value={selectedDefId}
              onChange={(e) => setSelectedDefId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            >
              {publishedDefs.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} (نسخه {toFa(d.version)})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">عنوان درخواست *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثلاً: تکمیل و ارسال سفارش ویژه یا درخواست تخفیف ۲۵٪"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">مشتری مرتبط</label>
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
              ثبت و ارسال به جریان کار
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
