import { useMemo, useState } from 'react';
import { CheckSquare, Clock, FolderKanban, Plus } from 'lucide-react';
import { Modal } from '../Modal';
import { JalaliDatePicker } from '../ui/JalaliDatePicker';
import { useClientFlow } from '../../store/useClientFlowStore';
import type { ProjectStatus } from '../../types';
import {
  formatJalali,
  formatJalaliDateTime,
  getTodayJalaliAscii,
  jalaliToIsoUtc,
  toFa,
} from '../../utils/jalali';
import { CHECK_CAT_LABEL, PROJECT_STATUS_LABEL } from './orderHelpers';

export function ProjectsTab() {
  const {
    state,
    addProject,
    updateProjectStatus,
    addProjectTask,
    toggleProjectTask,
    addProjectTaskSubtask,
    toggleProjectTaskSubtask,
    addTimeEntry,
    toggleDeploymentCheck,
  } = useClientFlow();

  const [selectedProjectId, setSelectedProjectId] = useState(state.projects[0]?.id ?? '');
  const [newProjOpen, setNewProjOpen] = useState(false);
  const [newProjTitle, setNewProjTitle] = useState('');
  const [newProjCustId, setNewProjCustId] = useState(state.customers[0]?.id ?? '');
  const [newProjDueJalali, setNewProjDueJalali] = useState(() => getTodayJalaliAscii());

  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskAssignee, setNewTaskAssignee] = useState(state.settings.salesTeam[0] ?? 'تیم فنی');
  const [newTaskHours, setNewTaskHours] = useState('4');
  const [newTaskDueJalali, setNewTaskDueJalali] = useState(() => getTodayJalaliAscii());
  const [subtaskDrafts, setSubtaskDrafts] = useState<Record<string, string>>({});

  const [timeUser, setTimeUser] = useState('مهندس استقرار');
  const [timeHours, setTimeHours] = useState('2');
  const [timeNote, setTimeNote] = useState('');

  const activeProject = state.projects.find((p) => p.id === selectedProjectId) ?? state.projects[0];

  const activeProjectTimeEntries = useMemo(() => {
    if (!activeProject) return [];
    return state.timeEntries.filter((t) => t.projectId === activeProject.id);
  }, [activeProject, state.timeEntries]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {state.projects.map((p) => {
            const active = activeProject?.id === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedProjectId(p.id)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium ${
                  active
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-950/40 dark:text-indigo-300'
                    : 'border-slate-200 bg-white text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'
                }`}
              >
                <FolderKanban size={14} />
                {p.title}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => setNewProjOpen(true)}
          className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
        >
          <Plus size={14} />
          پروژه جدید
        </button>
      </div>

      {activeProject && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div>
              <h2 className="text-sm font-semibold">{activeProject.title}</h2>
              <p className="mt-0.5 text-xs text-slate-500 tabular-nums">
                مشتری: {state.customers.find((c) => c.id === activeProject.customerId)?.name ?? 'مشتری'} ·
                تحویل هدف: {formatJalali(activeProject.dueAt)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">وضعیت پروژه:</span>
              <select
                value={activeProject.status}
                onChange={(e) => updateProjectStatus(activeProject.id, e.target.value as ProjectStatus)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium dark:border-slate-700 dark:bg-slate-800"
              >
                {(Object.keys(PROJECT_STATUS_LABEL) as ProjectStatus[]).map((st) => (
                  <option key={st} value={st}>
                    {PROJECT_STATUS_LABEL[st]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            {/* Project Tasks + Subtasks */}
            <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="text-xs font-semibold">وظایف و زیرتسک‌های پروژه (ProjectTask)</div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newTaskTitle.trim()) return;
                  addProjectTask(activeProject.id, {
                    title: newTaskTitle.trim(),
                    assignee: newTaskAssignee.trim() || 'تیم فنی',
                    estimatedHours: Math.max(1, Number(newTaskHours) || 2),
                    dueAt: jalaliToIsoUtc(newTaskDueJalali) ?? undefined,
                  });
                  setNewTaskTitle('');
                }}
                className="space-y-2"
              >
                <input
                  type="text"
                  placeholder="عنوان تسک فنی..."
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder="مسئول"
                    value={newTaskAssignee}
                    onChange={(e) => setNewTaskAssignee(e.target.value)}
                    className="col-span-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                  />
                  <input
                    type="number"
                    min={1}
                    value={newTaskHours}
                    onChange={(e) => setNewTaskHours(e.target.value)}
                    title="برآورد ساعت"
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <JalaliDatePicker
                      value={newTaskDueJalali}
                      onChange={setNewTaskDueJalali}
                      placeholder="تاریخ سررسید تسک"
                    />
                  </div>
                  <button
                    type="submit"
                    className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-700"
                  >
                    افزودن
                  </button>
                </div>
              </form>

              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {activeProject.tasks.map((t) => {
                  const subtasks = t.subtasks ?? [];
                  const doneSubs = subtasks.filter((s) => s.done).length;
                  return (
                    <div key={t.id} className="space-y-2 py-2.5 text-xs">
                      <label className="flex cursor-pointer items-start gap-2">
                        <input
                          type="checkbox"
                          checked={t.done}
                          onChange={() => toggleProjectTask(activeProject.id, t.id)}
                          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600"
                        />
                        <div className={t.done ? 'line-through text-slate-400' : ''}>
                          <div className="font-medium">{t.title}</div>
                          <div className="text-[11px] text-slate-500 tabular-nums">
                            {t.assignee} · برآورد: {toFa(t.estimatedHours)} ساعت
                            {t.dueAt ? ` · سررسید: ${formatJalali(t.dueAt)}` : ''}
                            {subtasks.length > 0 ? ` · زیرتسک: ${toFa(doneSubs)}/${toFa(subtasks.length)}` : ''}
                          </div>
                        </div>
                      </label>

                      {/* Nested subtasks */}
                      <div className="mr-6 space-y-1 border-r border-slate-200 pr-2.5 dark:border-slate-700">
                        {subtasks.map((sub) => (
                          <label key={sub.id} className="flex cursor-pointer items-center gap-1.5 text-[11px]">
                            <input
                              type="checkbox"
                              checked={sub.done}
                              onChange={() => toggleProjectTaskSubtask(activeProject.id, t.id, sub.id)}
                              className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600"
                            />
                            <span className={sub.done ? 'line-through text-slate-400' : 'text-slate-600 dark:text-slate-300'}>
                              {sub.title}
                            </span>
                          </label>
                        ))}
                        <div className="flex gap-1 pt-0.5">
                          <input
                            type="text"
                            value={subtaskDrafts[t.id] ?? ''}
                            onChange={(e) =>
                              setSubtaskDrafts((prev) => ({ ...prev, [t.id]: e.target.value }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const txt = (subtaskDrafts[t.id] ?? '').trim();
                                if (!txt) return;
                                addProjectTaskSubtask(activeProject.id, t.id, txt);
                                setSubtaskDrafts((prev) => ({ ...prev, [t.id]: '' }));
                              }
                            }}
                            placeholder="+ افزودن زیرتسک..."
                            className="flex-1 rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] dark:border-slate-700 dark:bg-slate-800"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const txt = (subtaskDrafts[t.id] ?? '').trim();
                              if (!txt) return;
                              addProjectTaskSubtask(activeProject.id, t.id, txt);
                              setSubtaskDrafts((prev) => ({ ...prev, [t.id]: '' }));
                            }}
                            className="rounded border border-slate-200 px-2 py-0.5 text-[10px] hover:bg-slate-100 dark:border-slate-700"
                          >
                            ثبت
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Time Entries */}
            <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="flex items-center gap-1.5">
                  <Clock size={14} className="text-sky-500" />
                  زمان‌سنجی کارکرد (TimeEntry)
                </span>
                <span className="tabular-nums text-indigo-600 dark:text-indigo-400">
                  مجموع: {toFa(activeProjectTimeEntries.reduce((s, e) => s + e.hours, 0))} ساعت
                </span>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!timeNote.trim()) return;
                  addTimeEntry({
                    projectId: activeProject.id,
                    userName: timeUser.trim() || 'کارشناس فنی',
                    hours: Math.max(0.5, Number(timeHours) || 1),
                    note: timeNote.trim(),
                  });
                  setTimeNote('');
                }}
                className="space-y-2"
              >
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={timeUser}
                    onChange={(e) => setTimeUser(e.target.value)}
                    placeholder="نام کارشناس"
                    className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                  />
                  <input
                    type="number"
                    step="0.5"
                    min={0.5}
                    value={timeHours}
                    onChange={(e) => setTimeHours(e.target.value)}
                    className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={timeNote}
                    onChange={(e) => setTimeNote(e.target.value)}
                    placeholder="شرح کار انجام‌شده..."
                    className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                  />
                  <button
                    type="submit"
                    className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                  >
                    ثبت ساعت
                  </button>
                </div>
              </form>
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {activeProjectTimeEntries.map((te) => (
                  <div key={te.id} className="py-2 text-xs">
                    <div className="flex justify-between font-medium">
                      <span>{te.userName}</span>
                      <span className="tabular-nums text-sky-600 dark:text-sky-400">
                        {toFa(te.hours)} ساعت
                      </span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-500">{te.note}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Deployment Checklist */}
            <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              {(() => {
                const doneCount = activeProject.deploymentChecklist.filter((c) => c.done).length;
                const total = activeProject.deploymentChecklist.length;
                const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;
                return (
                  <>
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="flex items-center gap-1.5">
                        <CheckSquare size={14} className="text-emerald-500" />
                        چک‌لیست استقرار (Deployment)
                      </span>
                      <span className="tabular-nums text-emerald-600 dark:text-emerald-400">
                        {toFa(pct)}٪ تکمیل
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="divide-y divide-slate-200 dark:divide-slate-800">
                      {activeProject.deploymentChecklist.map((chk) => (
                        <label key={chk.id} className="flex cursor-pointer items-start gap-2 py-2 text-xs">
                          <input
                            type="checkbox"
                            checked={chk.done}
                            onChange={() => toggleDeploymentCheck(activeProject.id, chk.id)}
                            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600"
                          />
                          <div>
                            <div className={chk.done ? 'line-through text-slate-400' : 'font-medium'}>
                              {chk.title}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {CHECK_CAT_LABEL[chk.category]}
                              {chk.checkedAt && ` · تأیید: ${formatJalaliDateTime(chk.checkedAt)}`}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* New Project Modal */}
      <Modal
        open={newProjOpen}
        onClose={() => setNewProjOpen(false)}
        title="ایجاد پروژه جدید و چک‌لیست استقرار"
        maxWidth="sm"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!newProjTitle.trim()) return;
            addProject({
              title: newProjTitle.trim(),
              customerId: newProjCustId,
              dueAt:
                jalaliToIsoUtc(newProjDueJalali) ??
                new Date(Date.now() + 14 * 24 * 3600_000).toISOString(),
            });
            setNewProjTitle('');
            setNewProjOpen(false);
          }}
          className="space-y-4"
        >
          <div>
            <label className="mb-1 block text-xs text-slate-500">عنوان پروژه *</label>
            <input
              type="text"
              required
              value={newProjTitle}
              onChange={(e) => setNewProjTitle(e.target.value)}
              placeholder="مثلاً: استقرار نرم‌افزار در هلدینگ سپهر"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">مشتری / کارفرما</label>
            <select
              value={newProjCustId}
              onChange={(e) => setNewProjCustId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
            >
              {state.customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <JalaliDatePicker
            label="تاریخ تحویل هدف (شمسی)"
            value={newProjDueJalali}
            onChange={setNewProjDueJalali}
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setNewProjOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs dark:border-slate-700"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700"
            >
              ایجاد پروژه
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
