import { Copy, Layers, Plus, Rocket, Save, Trash2, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { useClientFlow } from '../../store/useClientFlowStore';
import type {
  CustomFieldDef,
  CustomFieldType,
  WorkflowDefinition,
  WorkflowEdgeDef,
  WorkflowNodeDef,
  WorkflowNodeType,
} from '../../types';
import { toFa } from '../../utils/jalali';

export const WORKFLOW_NODE_TYPE_LABEL: Record<WorkflowNodeType, string> = {
  start: 'شروع (Start)',
  task: 'گام کاربری / فرم (Task)',
  approval: 'تأییدیه (Approval)',
  decision: 'گره تصمیم‌گیری (Decision)',
  wait: 'گام انتظار (Wait)',
  parallel_gateway: 'دروازه موازی (Parallel)',
  timer: 'تایمر انتظار (Timer)',
  end: 'پایان (End)',
};

const NODE_STYLE: Record<WorkflowNodeType, string> = {
  start: 'border-emerald-400 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200',
  task: 'border-indigo-300 bg-white text-slate-900 dark:border-indigo-700 dark:bg-slate-900 dark:text-slate-100',
  approval: 'border-violet-400 bg-violet-50 text-violet-900 dark:border-violet-700 dark:bg-violet-950/60 dark:text-violet-200',
  decision: 'border-amber-400 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-200',
  wait: 'border-cyan-400 bg-cyan-50 text-cyan-900 dark:border-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-200',
  parallel_gateway:
    'border-orange-400 bg-orange-50 text-orange-900 dark:border-orange-700 dark:bg-orange-950/60 dark:text-orange-200',
  timer: 'border-sky-400 bg-sky-50 text-sky-900 dark:border-sky-700 dark:bg-sky-950/60 dark:text-sky-200',
  end: 'border-slate-400 bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
};

type Props = {
  draftDef: WorkflowDefinition | null;
  setDraftDef: React.Dispatch<React.SetStateAction<WorkflowDefinition | null>>;
  selectedNodeId: string | null;
  setSelectedNodeId: React.Dispatch<React.SetStateAction<string | null>>;
  onLoadDefinition: (def: WorkflowDefinition) => void;
};

export function WorkflowDesignerTab({
  draftDef,
  setDraftDef,
  selectedNodeId,
  setSelectedNodeId,
  onLoadDefinition,
}: Props) {
  const {
    state,
    saveWorkflowDefinition,
    publishWorkflowDefinition,
    cloneWorkflowDraft,
    deleteWorkflowDefinition,
  } = useClientFlow();

  const [connectFromId, setConnectFromId] = useState('');
  const [connectToId, setConnectToId] = useState('');
  const [edgeLabel, setEdgeLabel] = useState('');
  const [edgeField, setEdgeField] = useState('');
  const [edgeOp, setEdgeOp] = useState<NonNullable<WorkflowEdgeDef['conditionOp']>>('eq');
  const [edgeValue, setEdgeValue] = useState('');

  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldType, setNewFieldType] = useState<CustomFieldType>('text');
  const [newFieldOptions, setNewFieldOptions] = useState('');

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const dragNodeRef = useRef<{ nodeId: string; offsetX: number; offsetY: number } | null>(null);

  const handleCreateNewDraft = () => {
    const fresh: WorkflowDefinition = {
      id: '',
      key: `custom_${Date.now()}`,
      name: 'فرآیند سفارشی جدید',
      description: 'طراحی‌شده در طراح بصری گردش کار',
      type: 'custom',
      version: 1,
      status: 'draft',
      pack: 'all',
      slaHours: 24,
      updatedAt: new Date().toISOString(),
      nodes: [
        { id: 'n_start', type: 'start', label: 'شروع', role: 'staff', assigneeType: 'role', x: 40, y: 120 },
        { id: 'n_task1', type: 'task', label: 'بررسی اولیه کارشناس', role: 'staff', assigneeType: 'role', stepSlaHours: 8, x: 240, y: 120 },
        { id: 'n_end', type: 'end', label: 'پایان', role: 'staff', assigneeType: 'role', x: 480, y: 120 },
      ],
      edges: [
        { id: 'e_1', fromId: 'n_start', toId: 'n_task1' },
        { id: 'e_2', fromId: 'n_task1', toId: 'n_end' },
      ],
    };
    setDraftDef(fresh);
    setSelectedNodeId('n_task1');
  };

  const handleAddNode = (nodeType: WorkflowNodeType) => {
    if (!draftDef) return;
    const id = `node_${Date.now()}`;
    const labelMap: Record<WorkflowNodeType, string> = {
      start: 'نقطه شروع',
      task: 'گام کاربری جدید',
      approval: 'تأییدیه مدیر',
      decision: 'گره تصمیم‌گیری شرطی',
      wait: 'گام انتظار ۲ ساعته',
      parallel_gateway: 'تأیید موازی دو واحد',
      timer: 'تایمر انتظار ۲ ساعته',
      end: 'پایان فرآیند',
    };
    const newNode: WorkflowNodeDef = {
      id,
      type: nodeType,
      label: labelMap[nodeType],
      role: nodeType === 'approval' || nodeType === 'parallel_gateway' ? 'admin' : 'staff',
      assigneeType: 'role',
      stepSlaHours: nodeType === 'start' || nodeType === 'end' ? undefined : 12,
      x: 110 + (draftDef.nodes.length % 4) * 165,
      y: 50 + Math.floor(draftDef.nodes.length / 4) * 105,
      timerHours: nodeType === 'timer' || nodeType === 'wait' ? 2 : undefined,
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
      label: edgeLabel.trim() || undefined,
      conditionField: edgeField.trim() || undefined,
      conditionOp: edgeField.trim() ? edgeOp : undefined,
      conditionValue: edgeField.trim() ? edgeValue.trim() : undefined,
    };
    setDraftDef({ ...draftDef, edges: [...draftDef.edges, edge] });
    setConnectFromId('');
    setConnectToId('');
    setEdgeLabel('');
    setEdgeField('');
    setEdgeValue('');
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
    const y = Math.max(16, Math.min(265, e.clientY - rect.top - dragNodeRef.current.offsetY));
    const nid = dragNodeRef.current.nodeId;
    setDraftDef({
      ...draftDef,
      nodes: draftDef.nodes.map((n) => (n.id === nid ? { ...n, x: Math.round(x), y: Math.round(y) } : n)),
    });
  };

  return (
    <div className="space-y-4">
      {/* Definitions Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">انتخاب الگوی فرآیند:</span>
          {state.workflowDefinitions.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => onLoadDefinition(d)}
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
          {/* Canvas & Edge Connectors */}
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
                  <span className="text-slate-500">SLA کل (ساعت):</span>
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
                        title="حذف پیش‌نویس"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Add Node Buttons */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-slate-500">افزودن گره:</span>
              <button
                type="button"
                onClick={() => handleAddNode('task')}
                className="rounded border border-indigo-200 bg-indigo-50 px-2 py-1 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300"
              >
                + گام کاربری (Task)
              </button>
              <button
                type="button"
                onClick={() => handleAddNode('approval')}
                className="rounded border border-violet-200 bg-violet-50 px-2 py-1 text-violet-700 hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300"
              >
                + تأییدیه (Approval)
              </button>
              <button
                type="button"
                onClick={() => handleAddNode('decision')}
                className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
              >
                + گره تصمیم (Decision)
              </button>
              <button
                type="button"
                onClick={() => handleAddNode('wait')}
                className="rounded border border-cyan-200 bg-cyan-50 px-2 py-1 text-cyan-800 hover:bg-cyan-100 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-300"
              >
                + انتظار (Wait)
              </button>
              <button
                type="button"
                onClick={() => handleAddNode('parallel_gateway')}
                className="rounded border border-orange-200 bg-orange-50 px-2 py-1 text-orange-800 hover:bg-orange-100 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-300"
              >
                + دروازه موازی
              </button>
              <button
                type="button"
                onClick={() => handleAddNode('end')}
                className="rounded border border-slate-200 bg-slate-100 px-2 py-1 text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                + پایان (End)
              </button>
            </div>

            {/* Interactive Canvas */}
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
                className="relative h-[330px] w-[880px] select-none"
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
                    const x1 = from.x + 144;
                    const y1 = from.y + 30;
                    const x2 = to.x;
                    const y2 = to.y + 30;
                    const hasCond = Boolean(edge.conditionField);
                    return (
                      <g key={edge.id}>
                        <line
                          x1={x1}
                          y1={y1}
                          x2={x2}
                          y2={y2}
                          stroke={hasCond ? '#d97706' : '#6366f1'}
                          strokeWidth={2}
                          strokeDasharray={hasCond ? '5,3' : undefined}
                          markerEnd="url(#wf-arrow)"
                        />
                        {(edge.label || hasCond) && (
                          <text
                            x={(x1 + x2) / 2}
                            y={(y1 + y2) / 2 - 6}
                            textAnchor="middle"
                            className="fill-slate-600 text-[10px] dark:fill-slate-300"
                          >
                            {edge.label ?? `${edge.conditionField} ${edge.conditionOp} ${edge.conditionValue}`}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </svg>

                {draftDef.nodes.map((node) => {
                  const isSel = selectedNodeId === node.id;
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
                      className={`absolute w-[144px] cursor-grab rounded-xl border-2 p-2 text-right shadow-sm active:cursor-grabbing ${
                        NODE_STYLE[node.type]
                      } ${isSel ? 'ring-2 ring-indigo-500 ring-offset-1' : ''}`}
                    >
                      <div className="flex items-center justify-between text-[10px] opacity-75">
                        <span>{node.type}</span>
                        <span>
                          {node.assigneeType === 'user' && node.assigneeUser
                            ? node.assigneeUser
                            : node.role === 'admin'
                              ? 'مدیر'
                              : 'کارشناس'}
                        </span>
                      </div>
                      <div className="mt-0.5 truncate text-[11px] font-semibold">{node.label}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] opacity-80">
                        {node.stepSlaHours && (
                          <span className="tabular-nums">SLA: {toFa(node.stepSlaHours)}س</span>
                        )}
                        {node.formFields && node.formFields.length > 0 && (
                          <span className="text-indigo-600 dark:text-indigo-300">
                            · {toFa(node.formFields.length)} فیلد
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Conditional Edge Connector + Edge List */}
            <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/60 p-3 text-xs dark:border-slate-800 dark:bg-slate-950/30">
              <div className="font-semibold text-slate-700 dark:text-slate-200">اتصال گره‌ها و تعریف شرط گذار (Transitions)</div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-6">
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
                <input
                  type="text"
                  value={edgeLabel}
                  onChange={(e) => setEdgeLabel(e.target.value)}
                  placeholder="برچسب گذار (اختیاری)"
                  className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] dark:border-slate-700 dark:bg-slate-800"
                />
                <input
                  type="text"
                  dir="ltr"
                  value={edgeField}
                  onChange={(e) => setEdgeField(e.target.value)}
                  placeholder="شرط فیلد (مثلاً discount_pct)"
                  className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] dark:border-slate-700 dark:bg-slate-800"
                />
                <div className="flex gap-1">
                  <select
                    value={edgeOp}
                    onChange={(e) => setEdgeOp(e.target.value as NonNullable<WorkflowEdgeDef['conditionOp']>)}
                    className="w-16 rounded border border-slate-200 bg-white px-1 py-1 text-[11px] dark:border-slate-700 dark:bg-slate-800"
                  >
                    <option value="eq">=</option>
                    <option value="neq">≠</option>
                    <option value="gte">≥</option>
                    <option value="lte">≤</option>
                    <option value="contains">شامل</option>
                  </select>
                  <input
                    type="text"
                    value={edgeValue}
                    onChange={(e) => setEdgeValue(e.target.value)}
                    placeholder="مقدار"
                    className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-[11px] dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddEdge}
                  className="rounded bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-slate-800 dark:bg-indigo-600"
                >
                  افزودن اتصال
                </button>
              </div>

              {draftDef.edges.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {draftDef.edges.map((ed) => {
                    const fromName = draftDef.nodes.find((n) => n.id === ed.fromId)?.label ?? ed.fromId;
                    const toName = draftDef.nodes.find((n) => n.id === ed.toId)?.label ?? ed.toId;
                    return (
                      <span
                        key={ed.id}
                        className="inline-flex items-center gap-1 rounded bg-white px-2 py-0.5 text-[11px] text-slate-700 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700"
                      >
                        <span>
                          {fromName} ← {toName}
                          {ed.conditionField && ` (${ed.conditionField} ${ed.conditionOp} ${ed.conditionValue})`}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setDraftDef({
                              ...draftDef,
                              edges: draftDef.edges.filter((x) => x.id !== ed.id),
                            })
                          }
                          className="text-rose-500 hover:text-rose-700"
                        >
                          <X size={11} />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right: Node Inspector */}
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
                      {(Object.keys(WORKFLOW_NODE_TYPE_LABEL) as WorkflowNodeType[]).map((t) => (
                        <option key={t} value={t}>
                          {WORKFLOW_NODE_TYPE_LABEL[t]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-slate-500">SLA این مرحله (ساعت)</label>
                    <input
                      type="number"
                      min={1}
                      value={selectedNode.stepSlaHours ?? 8}
                      onChange={(e) => updateSelectedNode({ stepSlaHours: Number(e.target.value) || 1 })}
                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 tabular-nums dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-slate-500">نوع ارجاع مسئول</label>
                    <select
                      value={selectedNode.assigneeType ?? 'role'}
                      onChange={(e) =>
                        updateSelectedNode({ assigneeType: e.target.value as 'role' | 'user' })
                      }
                      className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 dark:border-slate-700 dark:bg-slate-800"
                    >
                      <option value="role">بر اساس نقش</option>
                      <option value="user">کاربر مشخص</option>
                    </select>
                  </div>
                  {selectedNode.assigneeType === 'user' ? (
                    <div>
                      <label className="mb-1 block text-slate-500">کاربر مسئول گام</label>
                      <select
                        value={selectedNode.assigneeUser ?? state.settings.salesTeam[0] ?? ''}
                        onChange={(e) => updateSelectedNode({ assigneeUser: e.target.value })}
                        className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 dark:border-slate-700 dark:bg-slate-800"
                      >
                        {state.settings.salesTeam.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
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
                  )}
                </div>

                {(selectedNode.type === 'timer' || selectedNode.type === 'wait') && (
                  <div>
                    <label className="mb-1 block text-slate-500">مدت زمان انتظار / تایمر (ساعت)</label>
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

                {(selectedNode.type === 'task' ||
                  selectedNode.type === 'approval' ||
                  selectedNode.type === 'decision') && (
                  <div className="space-y-2 border-t border-slate-200 pt-3 dark:border-slate-800">
                    <div className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-200">
                      <Layers size={13} />
                      فرم / پارامترهای این گام ({toFa(selectedNode.formFields?.length ?? 0)})
                    </div>
                    {(selectedNode.formFields ?? []).map((ff) => (
                      <div
                        key={ff.id}
                        className="flex items-center justify-between rounded border border-slate-200 px-2 py-1 dark:border-slate-700"
                      >
                        <span>
                          {ff.label} ({ff.key})
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
  );
}
