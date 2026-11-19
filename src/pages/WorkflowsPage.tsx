import { useMemo, useRef, useState } from 'react';
import {
  Activity,
  Check,
  Clock,
  Copy,
  GitFork,
  Hand,
  Layers,
  Play,
  Plus,
  Rocket,
  Save,
  Trash2,
  UserPlus,
  Workflow,
  X,
} from 'lucide-react';
import { Modal } from '../components/Modal';
import { useClientFlow } from '../store/useClientFlowStore';
import type {
  CustomFieldDef,
  CustomFieldType,
  WorkflowDefinition,
  WorkflowEdgeDef,
  WorkflowNodeDef,
  WorkflowNodeType,
  WorkflowType,
} from '../types';
import { formatJalaliDateTime, toFa } from '../utils/jalali';

const WF_TYPE_LABEL: Record<WorkflowType, string> = {
  discount_approval: 'تأیید تخفیف ویژه (>۲۰٪)',
  order_return: 'مرجوعی و استرداد سفارش',
  vip_schedule: 'نوبت‌دهی ویژه VIP',
  complaint: 'رسیدگی به شکایت مشتری',
  custom: 'فرآیند سفارشی (BPMN)',
};

const NODE_TYPE_LABEL: Record<WorkflowNodeType, string> = {
  start: 'شروع (Start)',
  task: 'گام کاربری / فرم (Task)',
  parallel_gateway: 'دروازه موازی (Parallel)',
  timer: 'تایمر انتظار (Timer)',
  end: 'پایان (End)',
};

export function WorkflowsPage() {
  const {
    state,
    saveWorkflowDefinition,
    publishWorkflowDefinition,
    cloneWorkflowDraft,
    deleteWorkflowDefinition,
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

  // Visual BPMN Designer State
  const [editingDefId, setEditingDefId] = useState<string>(state.workflowDefinitions[0]?.id ?? '');
  const activeDef = useMemo(
    () => state.workflowDefinitions.find((d) => d.id === editingDefId) ?? state.workflowDefinitions[0] ?? null,
    [state.workflowDefinitions, editingDefId],
  );
  const [draftDef, setDraftDef] = useState<WorkflowDefinition | null>(activeDef);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(activeDef?.nodes[1]?.id ?? null);
  const [connectFromId, setConnectFromId] = useState<string>('');
  const [connectToId, setConnectToId] = useState<string>('');
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldType, setNewFieldType] = useState<CustomFieldType>('text');
  const [newFieldOptions, setNewFieldOptions] = useState('');

  // Pointer Drag state on BPMN canvas
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const dragNodeRef = useRef<{ nodeId: string; offsetX: number; offsetY: number } | null>(null);

  const loadDefinitionIntoEditor = (def: WorkflowDefinition) => {
    setEditingDefId(def.id);
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

  // Process Mining Metrics (FR-WF-09)
  const mining = useMemo(() => {
    const nowMs = Date.now();
    const total = state.workflows.length;
    const running = state.workflows.filter((w) => w.status === 'running').length;
    const approved = state.workflows.filter((w) => w.status === 'approved').length;
    const rejected = state.workflows.filter((w) => w.status === 'rejected').length;

    const slaBreached = state.workflows.filter((w) => {
      const endMs = w.completedAt ? new Date(w.completedAt).getTime() : nowMs;
      const ageH = (endMs - new Date(w.createdAt).getTime()) / 3600_000;
      return ageH > w.slaHours;
    }).length;

    const stepStats = new Map<
      string,
      { name: string; count: number; pending: number; totalHours: number; timedCount: number }
    >();

    state.workflows.forEach((wf) => {
      wf.steps.forEach((st, idx) => {
        const entry = stepStats.get(st.name) ?? {
          name: st.name,
          count: 0,
          pending: 0,
          totalHours: 0,
          timedCount: 0,
        };
        entry.count += 1;
        if (st.status === 'pending' && wf.status === 'running' && idx === wf.currentStepIndex) {
          entry.pending += 1;
        }
        const startIso = st.startedAt ?? wf.createdAt;
        const endIso = st.at ?? (wf.status === 'running' && idx === wf.currentStepIndex ? new Date().toISOString() : undefined);
        if (startIso && endIso) {
          const hrs = Math.max(0.2, (new Date(endIso).getTime() - new Date(startIso).getTime()) / 3600_000);
          entry.totalHours += hrs;
          entry.timedCount += 1;
        }
        stepStats.set(st.name, entry);
      });
    });

    const stepsArray = Array.from(stepStats.values())
      .map((s) => ({
        ...s,
        avgHours: s.timedCount > 0 ? Math.round((s.totalHours / s.timedCount) * 10) / 10 : 0,
      }))
      .sort((a, b) => b.avgHours - a.avgHours || b.pending - a.pending);

    const bottleneck = stepsArray[0] ?? null;
    return { total, running, approved, rejected, slaBreached, stepsArray, bottleneck };
  }, [state.workflows]);

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

  // Designer handlers
  const handleCreateNewDraft = () => {
    const fresh: WorkflowDefinition = {
      id: '',
      key: `custom_${Date.now()}`,
      name: 'فرآیند سفارشی جدید',
      description: 'طراحی‌شده در طراح بصری BPMN',
      type: 'custom',
      version: 1,
      status: 'draft',
      slaHours: 24,
      updatedAt: new Date().toISOString(),
      nodes: [
        { id: 'n_start', type: 'start', label: 'شروع', role: 'staff', x: 60, y: 120 },
        { id: 'n_task1', type: 'task', label: 'بررسی اولیه کارشناس', role: 'staff', x: 260, y: 120 },
        { id: 'n_end', type: 'end', label: 'پایان', role: 'staff', x: 480, y: 120 },
      ],
      edges: [
        { id: 'e_1', fromId: 'n_start', toId: 'n_task1' },
        { id: 'e_2', fromId: 'n_task1', toId: 'n_end' },
      ],
    };
    setEditingDefId('');
    setDraftDef(fresh);
    setSelectedNodeId('n_task1');
  };

  const handleAddNode = (nodeType: WorkflowNodeType) => {
    if (!draftDef) return;
    const id = `node_${Date.now()}`;
    const newNode: WorkflowNodeDef = {
      id,
      type: nodeType,
      label:
        nodeType === 'timer'
          ? 'تایمر انتظار ۲ ساعته'
          : nodeType === 'parallel_gateway'
            ? 'تأیید موازی دو واحد'
            : nodeType === 'end'
              ? 'پایان فرآیند'
              : 'گام جدید بررسی',
      role: nodeType === 'parallel_gateway' ? 'admin' : 'staff',
      x: 120 + (draftDef.nodes.length % 4) * 160,
      y: 60 + Math.floor(draftDef.nodes.length / 4) * 110,
      timerHours: nodeType === 'timer' ? 2 : undefined,
      parallelBranches: nodeType === 'parallel_gateway' ? ['تأیید واحد اول', 'تأیید واحد دوم'] : undefined,
    };
    setDraftDef({ ...draftDef, nodes: [...draftDef.nodes, newNode] });
    setSelectedNodeId(id);
  };

  const handleAddEdge = () => {
    if (!draftDef || !connectFromId || !connectToId || connectFromId === connectToId) return;
    if (draftDef.edges.some((e) => e.fromId === connectFromId && e.toId === connectToId)) return;
    const edge: WorkflowEdgeDef = {
      id: `edge_${Date.now()}`,
      fromId: connectFromId,
      toId: connectToId,
    };
    setDraftDef({ ...draftDef, edges: [...draftDef.edges, edge] });
    setConnectFromId('');
    setConnectToId('');
  };

  const selectedNode = draftDef?.nodes.find((n) => n.id === selectedNodeId) ?? null;

  const updateSelectedNode = (patch: Partial<WorkflowNodeDef>) => {
    if (!draftDef || !selectedNode) return;
    setDraftDef({
      ...draftDef,
      nodes: draftDef.nodes.map((n) => (n.id === selectedNode.id ? { ...n, ...patch } : n)),
    });
  };

  const handleAddStepField = () => {
    if (!selectedNode || !newFieldLabel.trim()) return;
    const f: CustomFieldDef = {
      id: `sf_${Date.now()}`,
      key: `f_${Date.now().toString(36)}`,
      label: newFieldLabel.trim(),
      type: newFieldType,
      options:
        newFieldType === 'select'
          ? newFieldOptions
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : undefined,
      required: true,
    };
    updateSelectedNode({ formFields: [...(selectedNode.formFields ?? []), f] });
    setNewFieldLabel('');
    setNewFieldOptions('');
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragNodeRef.current || !canvasRef.current || !draftDef) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.max(16, Math.min(720, e.clientX - rect.left - dragNodeRef.current.offsetX));
    const y = Math.max(16, Math.min(270, e.clientY - rect.top - dragNodeRef.current.offsetY));
    const nid = dragNodeRef.current.nodeId;
    setDraftDef({
      ...draftDef,
      nodes: draftDef.nodes.map((n) => (n.id === nid ? { ...n, x: Math.round(x), y: Math.round(y) } : n)),
    });
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
            طراح بصری BPMN و نسخه‌گذاری ({toFa(state.workflowDefinitions.length)})
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
                        SLA: <span className="tabular-nums">{toFa(wf.slaHours)} ساعت</span>
                        {' · '}
                        <span className="tabular-nums">{formatJalaliDateTime(wf.createdAt)}</span>
                      </div>
                    </div>
                    <span className={`text-xs font-semibold ${statusClass}`}>{statusText}</span>
                  </div>

                  <div className="mt-4 space-y-2.5">
                    {wf.steps.map((step, idx) => {
                      const isCurrent = wf.status === 'running' && idx === wf.currentStepIndex;
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
                                {step.nodeType === 'parallel_gateway' && (
                                  <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                                    <GitFork size={10} />
                                    تأیید موازی
                                  </span>
                                )}
                                {step.nodeType === 'timer' && (
                                  <span className="inline-flex items-center gap-1 rounded bg-sky-100 px-1.5 py-0.5 text-[10px] text-sky-800 dark:bg-sky-950/50 dark:text-sky-300">
                                    <Clock size={10} />
                                    تایمر {toFa(step.timerHours ?? 2)} ساعت
                                  </span>
                                )}
                              </div>
                              <div className="mt-0.5 text-slate-500 dark:text-slate-400">
                                نقش: {step.role === 'admin' ? 'مدیر سیستم' : 'کارشناس / مدیر'}
                                {step.assignee && ` · مسئول: ${step.assignee}`}
                                {step.claimedBy && ` · Claim‌شده توسط: ${step.claimedBy}`}
                                {step.delegatedTo && ` · تفویض به: ${step.delegatedTo}`}
                                {step.actor && ` · اقدام‌کننده: ${step.actor}`}
                                {step.at && ` · ${formatJalaliDateTime(step.at)}`}
                              </div>
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

                          {/* Parallel Branches (FR-WF-03) */}
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

                          {/* Step Custom Form Inputs (FR-WF-02) */}
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

                  {/* Step Actions Bar: Claim / Reassign / Delegation / Timer / Approve */}
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

                        {curStep.nodeType === 'timer' && (
                          <button
                            type="button"
                            onClick={() => advanceWorkflowTimer(wf.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs text-sky-700 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300"
                          >
                            <Clock size={13} />
                            شبیه‌سازی انقضای تایمر و عبور
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
        <div className="space-y-4">
          {/* Definitions Bar + Draft/Published Versioning */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">انتخاب الگو:</span>
              {state.workflowDefinitions.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => loadDefinitionIntoEditor(d)}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs ${
                    draftDef?.id === d.id
                      ? 'border-indigo-500 bg-indigo-50 font-semibold text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300'
                  }`}
                >
                  <span>{d.name}</span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] ${
                      d.status === 'published'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                    }`}
                  >
                    {d.status === 'published' ? `v${toFa(d.version)} منتشرشده` : `v${toFa(d.version)} پیش‌نویس`}
                  </span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={handleCreateNewDraft}
              className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300"
            >
              <Plus size={14} />
              طراحی الگوی جدید
            </button>
          </div>

          {draftDef && (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
              {/* Left: Canvas + Node/Edge Toolbar */}
              <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 xl:col-span-8 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      value={draftDef.name}
                      onChange={(e) => setDraftDef({ ...draftDef, name: e.target.value })}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800"
                    />
                    <div className="flex items-center gap-1 text-xs">
                      <span className="text-slate-500">SLA (ساعت):</span>
                      <input
                        type="number"
                        min={1}
                        value={draftDef.slaHours}
                        onChange={(e) => setDraftDef({ ...draftDef, slaHours: Number(e.target.value) || 24 })}
                        className="w-16 rounded border border-slate-200 bg-white px-2 py-1 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => saveWorkflowDefinition(draftDef)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 dark:border-slate-700"
                    >
                      <Save size={13} />
                      ذخیره پیش‌نویس
                    </button>
                    {draftDef.id && (
                      <>
                        <button
                          type="button"
                          onClick={() => publishWorkflowDefinition(draftDef.id)}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                        >
                          <Rocket size={13} />
                          انتشار نسخه (Publish)
                        </button>
                        <button
                          type="button"
                          onClick={() => cloneWorkflowDraft(draftDef.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs hover:bg-slate-50 dark:border-slate-700"
                        >
                          <Copy size={13} />
                          کلون پیش‌نویس
                        </button>
                        {draftDef.status === 'draft' && (
                          <button
                            type="button"
                            onClick={() => deleteWorkflowDefinition(draftDef.id)}
                            className="rounded-lg border border-rose-200 p-1.5 text-rose-600 hover:bg-rose-50 dark:border-rose-900"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Add Nodes & Connect Edges Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-slate-500">افزودن گره:</span>
                    <button
                      type="button"
                      onClick={() => handleAddNode('task')}
                      className="rounded border border-indigo-200 bg-indigo-50 px-2 py-1 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300"
                    >
                      + گام فرم‌دار (Task)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddNode('parallel_gateway')}
                      className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                    >
                      + دروازه موازی
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddNode('timer')}
                      className="rounded border border-sky-200 bg-sky-50 px-2 py-1 text-sky-700 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300"
                    >
                      + تایمر
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <select
                      value={connectFromId}
                      onChange={(e) => setConnectFromId(e.target.value)}
                      className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] dark:border-slate-700 dark:bg-slate-800"
                    >
                      <option value="">از گره...</option>
                      {draftDef.nodes.map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.label}
                        </option>
                      ))}
                    </select>
                    <span>←</span>
                    <select
                      value={connectToId}
                      onChange={(e) => setConnectToId(e.target.value)}
                      className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] dark:border-slate-700 dark:bg-slate-800"
                    >
                      <option value="">به گره...</option>
                      {draftDef.nodes.map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleAddEdge}
                      className="rounded bg-slate-800 px-2 py-1 text-[11px] text-white dark:bg-slate-700"
                    >
                      اتصال
                    </button>
                  </div>
                </div>

                {/* Interactive Drag-and-Drop BPMN Canvas */}
                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-950/50">
                  <div
                    ref={canvasRef}
                    dir="ltr"
                    onPointerMove={handleCanvasPointerMove}
                    onPointerUp={() => {
                      dragNodeRef.current = null;
                    }}
                    onPointerLeave={() => {
                      dragNodeRef.current = null;
                    }}
                    className="relative h-[330px] w-[860px] select-none"
                  >
                    <svg className="pointer-events-none absolute inset-0 h-full w-full">
                      <defs>
                        <marker id="wf-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                          <path d="M0,0 L8,4 L0,8 z" fill="#6366f1" />
                        </marker>
                      </defs>
                      {draftDef.edges.map((edge) => {
                        const from = draftDef.nodes.find((n) => n.id === edge.fromId);
                        const to = draftDef.nodes.find((n) => n.id === edge.toId);
                        if (!from || !to) return null;
                        const x1 = from.x + 140;
                        const y1 = from.y + 28;
                        const x2 = to.x;
                        const y2 = to.y + 28;
                        return (
                          <g key={edge.id}>
                            <line
                              x1={x1}
                              y1={y1}
                              x2={x2}
                              y2={y2}
                              stroke="#6366f1"
                              strokeWidth={2}
                              markerEnd="url(#wf-arrow)"
                            />
                            {edge.label && (
                              <text
                                x={(x1 + x2) / 2}
                                y={(y1 + y2) / 2 - 6}
                                textAnchor="middle"
                                className="fill-slate-500 text-[10px]"
                              >
                                {edge.label}
                              </text>
                            )}
                          </g>
                        );
                      })}
                    </svg>

                    {draftDef.nodes.map((node) => {
                      const isSel = selectedNodeId === node.id;
                      const styleByType: Record<WorkflowNodeType, string> = {
                        start: 'border-emerald-400 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200',
                        task: 'border-indigo-300 bg-white text-slate-900 dark:border-indigo-700 dark:bg-slate-900 dark:text-slate-100',
                        parallel_gateway:
                          'border-amber-400 bg-amber-50 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200',
                        timer: 'border-sky-400 bg-sky-50 text-sky-900 dark:bg-sky-950/60 dark:text-sky-200',
                        end: 'border-slate-400 bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
                      };
                      return (
                        <div
                          key={node.id}
                          dir="rtl"
                          onPointerDown={(e) => {
                            const elRect = e.currentTarget.getBoundingClientRect();
                            dragNodeRef.current = {
                              nodeId: node.id,
                              offsetX: e.clientX - elRect.left,
                              offsetY: e.clientY - elRect.top,
                            };
                            setSelectedNodeId(node.id);
                          }}
                          style={{ left: node.x, top: node.y }}
                          className={`absolute w-[140px] cursor-grab rounded-xl border-2 p-2 text-right shadow-sm active:cursor-grabbing ${
                            styleByType[node.type]
                          } ${isSel ? 'ring-2 ring-indigo-500 ring-offset-1' : ''}`}
                        >
                          <div className="flex items-center justify-between text-[10px] opacity-75">
                            <span>{node.type === 'parallel_gateway' ? 'موازی' : node.type === 'timer' ? 'تایمر' : node.type}</span>
                            <span>{node.role === 'admin' ? 'مدیر' : 'کارشناس'}</span>
                          </div>
                          <div className="mt-0.5 truncate text-[11px] font-semibold">{node.label}</div>
                          {node.formFields && node.formFields.length > 0 && (
                            <div className="mt-1 text-[10px] text-indigo-600 dark:text-indigo-400">
                              {toFa(node.formFields.length)} فیلد فرم
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <p className="text-[11px] text-slate-500">
                  راهنما: گره‌ها را روی بوم بکشید تا جایگاهشان تغییر کند. برای ویرایش فرم اختصاصی یا شاخه‌های موازی، روی هر گره کلیک کنید.
                </p>
              </div>

              {/* Right: Selected Node Inspector + Step Custom Form Builder */}
              <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 xl:col-span-4 dark:border-slate-800 dark:bg-slate-900">
                <h3 className="text-sm font-semibold">تنظیمات گره انتخاب‌شده</h3>
                {!selectedNode ? (
                  <p className="text-xs text-slate-400">روی یکی از گره‌های بوم کلیک کنید.</p>
                ) : (
                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="mb-1 block text-slate-500">عنوان گره</label>
                      <input
                        type="text"
                        value={selectedNode.label}
                        onChange={(e) => updateSelectedNode({ label: e.target.value })}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 dark:border-slate-700 dark:bg-slate-800"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="mb-1 block text-slate-500">نوع گره</label>
                        <select
                          value={selectedNode.type}
                          onChange={(e) => updateSelectedNode({ type: e.target.value as WorkflowNodeType })}
                          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 dark:border-slate-700 dark:bg-slate-800"
                        >
                          {(Object.keys(NODE_TYPE_LABEL) as WorkflowNodeType[]).map((t) => (
                            <option key={t} value={t}>
                              {NODE_TYPE_LABEL[t]}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-slate-500">نقش مجاز</label>
                        <select
                          value={selectedNode.role}
                          onChange={(e) => updateSelectedNode({ role: e.target.value as 'staff' | 'admin' })}
                          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 dark:border-slate-700 dark:bg-slate-800"
                        >
                          <option value="staff">کارشناس / مدیر</option>
                          <option value="admin">فقط مدیر سیستم</option>
                        </select>
                      </div>
                    </div>

                    {selectedNode.type === 'timer' && (
                      <div>
                        <label className="mb-1 block text-slate-500">مدت زمان تایمر (ساعت)</label>
                        <input
                          type="number"
                          min={1}
                          value={selectedNode.timerHours ?? 2}
                          onChange={(e) => updateSelectedNode({ timerHours: Number(e.target.value) || 1 })}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 tabular-nums dark:border-slate-700 dark:bg-slate-800"
                        />
                      </div>
                    )}

                    {selectedNode.type === 'parallel_gateway' && (
                      <div>
                        <label className="mb-1 block text-slate-500">شاخه‌های تأیید موازی (با کاما جدا کنید)</label>
                        <input
                          type="text"
                          value={(selectedNode.parallelBranches ?? []).join('، ')}
                          onChange={(e) =>
                            updateSelectedNode({
                              parallelBranches: e.target.value
                                .split(/[،,]/)
                                .map((s) => s.trim())
                                .filter(Boolean),
                            })
                          }
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 dark:border-slate-700 dark:bg-slate-800"
                        />
                      </div>
                    )}

                    {/* Step Form Fields Builder (FR-WF-02) */}
                    {selectedNode.type === 'task' && (
                      <div className="space-y-2 border-t border-slate-200 pt-3 dark:border-slate-800">
                        <div className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-200">
                          <Layers size={13} />
                          فرم اختصاصی این گام ({toFa(selectedNode.formFields?.length ?? 0)})
                        </div>
                        {(selectedNode.formFields ?? []).map((ff) => (
                          <div
                            key={ff.id}
                            className="flex items-center justify-between rounded border border-slate-200 px-2 py-1 dark:border-slate-700"
                          >
                            <span>
                              {ff.label} ({ff.type})
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                updateSelectedNode({
                                  formFields: (selectedNode.formFields ?? []).filter((x) => x.id !== ff.id),
                                })
                              }
                              className="text-rose-500"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        ))}
                        <div className="space-y-1.5 rounded-lg bg-slate-50 p-2 dark:bg-slate-800/50">
                          <input
                            type="text"
                            value={newFieldLabel}
                            onChange={(e) => setNewFieldLabel(e.target.value)}
                            placeholder="نام فیلد گام..."
                            className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
                          />
                          <div className="flex gap-1.5">
                            <select
                              value={newFieldType}
                              onChange={(e) => setNewFieldType(e.target.value as CustomFieldType)}
                              className="flex-1 rounded border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
                            >
                              <option value="text">متنی</option>
                              <option value="number">عددی</option>
                              <option value="money">مبلغ</option>
                              <option value="select">لیست انتخابی</option>
                            </select>
                            <button
                              type="button"
                              onClick={handleAddStepField}
                              className="rounded bg-indigo-600 px-2.5 py-1 text-white"
                            >
                              افزودن
                            </button>
                          </div>
                          {newFieldType === 'select' && (
                            <input
                              type="text"
                              value={newFieldOptions}
                              onChange={(e) => setNewFieldOptions(e.target.value)}
                              placeholder="گزینه‌ها با کاما (مثلاً: بله, خیر)"
                              className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
                            />
                          )}
                        </div>
                      </div>
                    )}

                    <div className="border-t border-slate-200 pt-3 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => {
                          setDraftDef({
                            ...draftDef,
                            nodes: draftDef.nodes.filter((n) => n.id !== selectedNode.id),
                            edges: draftDef.edges.filter(
                              (e) => e.fromId !== selectedNode.id && e.toId !== selectedNode.id,
                            ),
                          });
                          setSelectedNodeId(null);
                        }}
                        className="inline-flex items-center gap-1 text-rose-600 hover:underline"
                      >
                        <Trash2 size={13} />
                        حذف این گره و اتصالاتش
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'mining' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="text-xs text-slate-500">کل فرایندهای اجراشده</div>
              <div className="mt-1 text-2xl font-bold tabular-nums">{toFa(mining.total)}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="text-xs text-slate-500">تأیید نهایی / در جریان</div>
              <div className="mt-1 text-2xl font-bold tabular-nums text-emerald-600">
                {toFa(mining.approved)} / {toFa(mining.running)}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="text-xs text-slate-500">نقض SLA کل فرآیند</div>
              <div className="mt-1 text-2xl font-bold tabular-nums text-rose-600">
                {toFa(mining.slaBreached)} مورد
              </div>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900/60 dark:bg-amber-950/30">
              <div className="text-xs font-medium text-amber-800 dark:text-amber-300">گلوگاه اصلی (Bottleneck)</div>
              <div className="mt-1 truncate text-sm font-bold text-slate-900 dark:text-slate-100">
                {mining.bottleneck ? `${mining.bottleneck.name} (${toFa(mining.bottleneck.avgHours)} ساعت)` : 'نامشخص'}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="mb-3 text-sm font-semibold">تحلیل زمان توقف و گلوگاه مراحل (Process Mining)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800">
                  <tr>
                    <th className="py-2">نام گام</th>
                    <th className="py-2">تعداد عبور</th>
                    <th className="py-2">در صف فعلی</th>
                    <th className="py-2">میانگین زمان توقف</th>
                    <th className="py-2">نمودار گلوگاه</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {mining.stepsArray.map((st, idx) => {
                    const maxH = Math.max(1, mining.bottleneck?.avgHours ?? 1);
                    const wPct = Math.min(100, Math.round((st.avgHours / maxH) * 100));
                    return (
                      <tr key={st.name}>
                        <td className="py-2.5 font-medium">
                          {st.name}
                          {idx === 0 && (
                            <span className="mr-2 rounded bg-rose-100 px-1.5 py-0.5 text-[10px] text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
                              گلوگاه
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 tabular-nums">{toFa(st.count)}</td>
                        <td className="py-2.5 tabular-nums text-amber-600">{toFa(st.pending)}</td>
                        <td className="py-2.5 tabular-nums font-semibold">{toFa(st.avgHours)} ساعت</td>
                        <td className="py-2.5 w-48">
                          <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                            <div
                              className={`h-full rounded-full ${idx === 0 ? 'bg-rose-500' : 'bg-indigo-600'}`}
                              style={{ width: `${wPct}%` }}
                            />
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
              placeholder="مثلاً: درخواست تخفیف ۲۵٪ برای پکیج فیشیال"
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
