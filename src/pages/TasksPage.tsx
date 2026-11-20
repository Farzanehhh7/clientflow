import { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { FolderKanban, ListChecks, Plus } from 'lucide-react';
import { Modal } from '../components/Modal';
import { JalaliDatePicker } from '../components/ui/JalaliDatePicker';
import { useClientFlow } from '../store/useClientFlowStore';
import type { Task } from '../types';
import {
  formatJalaliDateTime,
  getTodayJalaliAscii,
  isSameDay,
  jalaliToIsoUtc,
  toFa,
} from '../utils/jalali';

const PRIORITY_META: Record<'low' | 'medium' | 'high', { label: string; cls: string }> = {
  high: { label: 'اولویت بالا', cls: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300' },
  medium: { label: 'اولویت متوسط', cls: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' },
  low: { label: 'عادی', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
};

export function TasksPage() {
  const { state, toggleTaskDone, addTask, addTaskSubtask, toggleTaskSubtask } = useClientFlow();
  const [filter, setFilter] = useState<'today_overdue' | 'all' | 'done'>('today_overdue');
  const [createOpen, setCreateOpen] = useState(false);

  const [title, setTitle] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [assignee, setAssignee] = useState(state.settings.salesTeam[0] ?? '');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [projectId, setProjectId] = useState('');
  const [dueMode, setDueMode] = useState<'preset' | 'jalali'>('preset');
  const [dueOffsetHours, setDueOffsetHours] = useState(2);
  const [dueJalali, setDueJalali] = useState(() => getTodayJalaliAscii());
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [subtaskDrafts, setSubtaskDrafts] = useState<Record<string, string>>({});

  const nowIso = new Date().toISOString();
  const nowMs = Date.now();

  const { overdueTasks, todayTasks, doneTasks, allOpenTasks } = useMemo(() => {
    const overdue = state.tasks
      .filter((t) => !t.done && new Date(t.dueAt).getTime() < nowMs)
      .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());

    const today = state.tasks
      .filter(
        (t) =>
          !t.done &&
          new Date(t.dueAt).getTime() >= nowMs &&
          isSameDay(t.dueAt, nowIso),
      )
      .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());

    const done = state.tasks.filter((t) => t.done);
    const allOpen = state.tasks
      .filter((t) => !t.done)
      .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());

    return { overdueTasks: overdue, todayTasks: today, doneTasks: done, allOpenTasks: allOpen };
  }, [state.tasks, nowIso, nowMs]);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const dueAtIso =
      dueMode === 'jalali'
        ? jalaliToIsoUtc(dueJalali) ?? dayjs().add(24, 'hour').toISOString()
        : dayjs().add(dueOffsetHours, 'hour').toISOString();

    addTask({
      title,
      customerId: customerId || undefined,
      dueAt: dueAtIso,
      assignee: assignee || undefined,
      priority,
      projectId: projectId || undefined,
    });
    setTitle('');
    setCustomerId('');
    setProjectId('');
    setCreateOpen(false);
  };

  const renderTaskList = (items: Task[], emptyText: string, highlightOverdue = false) => {
    if (items.length === 0) {
      return <p className="py-6 text-center text-xs text-slate-400">{emptyText}</p>;
    }
    return (
      <div className="divide-y divide-slate-200 dark:divide-slate-800">
        {items.map((task) => {
          const cust = state.customers.find((c) => c.id === task.customerId);
          const proj = state.projects.find((p) => p.id === task.projectId);
          const subtasks = task.subtasks ?? [];
          const doneSubs = subtasks.filter((s) => s.done).length;
          const isExpanded = expandedTaskId === task.id || subtasks.length > 0;
          const priMeta = PRIORITY_META[task.priority ?? 'medium'];

          return (
            <div key={task.id} className="space-y-2 py-3">
              <div className="flex items-start justify-between gap-3">
                <label className="flex min-w-0 cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={task.done}
                    onChange={() => toggleTaskDone(task.id)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-sm font-medium ${
                          task.done ? 'line-through text-slate-400' : 'text-slate-900 dark:text-slate-100'
                        }`}
                      >
                        {task.title}
                      </span>
                      {task.priority && (
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${priMeta.cls}`}>
                          {priMeta.label}
                        </span>
                      )}
                      {proj && (
                        <span className="inline-flex items-center gap-1 rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                          <FolderKanban size={10} />
                          {proj.title}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {cust ? `${cust.name} · ` : ''}
                      {task.assignee ? `مسئول: ${task.assignee} · ` : ''}
                      {task.createdByRuleId ? 'اتوماسیون · ' : ''}
                      <span className={highlightOverdue ? 'font-medium text-rose-600 dark:text-rose-400' : ''}>
                        <span className="tabular-nums">{formatJalaliDateTime(task.dueAt)}</span>
                      </span>
                      {subtasks.length > 0 && (
                        <span className="mr-2 tabular-nums text-slate-400">
                          · زیرتسک: {toFa(doneSubs)}/{toFa(subtasks.length)}
                        </span>
                      )}
                    </div>
                  </div>
                </label>

                <button
                  type="button"
                  onClick={() => setExpandedTaskId((prev) => (prev === task.id ? null : task.id))}
                  title="مدیریت زیرتسک‌ها"
                  className="inline-flex shrink-0 items-center gap-1 rounded border border-slate-200 px-2 py-1 text-[11px] text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  <ListChecks size={13} />
                  زیرتسک ({toFa(subtasks.length)})
                </button>
              </div>

              {isExpanded && (
                <div className="mr-7 space-y-1.5 border-r border-slate-200 pr-3 dark:border-slate-800">
                  {subtasks.map((sub) => (
                    <label key={sub.id} className="flex cursor-pointer items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={sub.done}
                        onChange={() => toggleTaskSubtask(task.id, sub.id)}
                        className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600"
                      />
                      <span className={sub.done ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-300'}>
                        {sub.title}
                      </span>
                    </label>
                  ))}
                  {expandedTaskId === task.id && (
                    <div className="flex gap-1.5 pt-1">
                      <input
                        type="text"
                        value={subtaskDrafts[task.id] ?? ''}
                        onChange={(e) =>
                          setSubtaskDrafts((prev) => ({ ...prev, [task.id]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const txt = (subtaskDrafts[task.id] ?? '').trim();
                            if (!txt) return;
                            addTaskSubtask(task.id, txt);
                            setSubtaskDrafts((prev) => ({ ...prev, [task.id]: '' }));
                          }
                        }}
                        placeholder="+ افزودن گام اجرایی یا زیرتسک..."
                        className="flex-1 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const txt = (subtaskDrafts[task.id] ?? '').trim();
                          if (!txt) return;
                          addTaskSubtask(task.id, txt);
                          setSubtaskDrafts((prev) => ({ ...prev, [task.id]: '' }));
                        }}
                        className="rounded-md bg-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200"
                      >
                        افزودن
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => setFilter('today_overdue')}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === 'today_overdue'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            امروز و دارای تأخیر ({toFa(overdueTasks.length + todayTasks.length)})
          </button>
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === 'all'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            همه باز ({toFa(allOpenTasks.length)})
          </button>
          <button
            type="button"
            onClick={() => setFilter('done')}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === 'done'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            انجام‌شده ({toFa(doneTasks.length)})
          </button>
        </div>

        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700"
        >
          <Plus size={16} />
          پیگیری / تسک جدید
        </button>
      </div>

      {filter === 'today_overdue' ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-2 flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
              <h2 className="text-sm font-semibold text-rose-600 dark:text-rose-400">
                دارای تأخیر (معوق)
              </h2>
              <span className="text-xs tabular-nums text-slate-500">{toFa(overdueTasks.length)} مورد</span>
            </div>
            {renderTaskList(overdueTasks, 'هیچ پیگیری معوقی وجود ندارد.', true)}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-2 flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">پیگیری‌های امروز</h2>
              <span className="text-xs tabular-nums text-slate-500">{toFa(todayTasks.length)} مورد</span>
            </div>
            {renderTaskList(todayTasks, 'برای امروز پیگیری باز ثبت نشده است.')}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          {filter === 'all'
            ? renderTaskList(allOpenTasks, 'هیچ پیگیری بازی وجود ندارد.')
            : renderTaskList(doneTasks, 'هنوز پیگیری انجام‌شده‌ای ثبت نشده است.')}
        </div>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="ثبت پیگیری / تسک جدید" maxWidth="md">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
              عنوان پیگیری *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثلاً: تماس برای تأیید نوبت یا ارسال کد رهگیری"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                مشتری مرتبط (اختیاری)
              </label>
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="">بدون مشتری خاص</option>
                {state.customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                پروژه مرتبط (اختیاری)
              </label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="">بدون پروژه</option>
                {state.projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                مسئول انجام
              </label>
              <select
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="">تعیین‌نشده</option>
                {state.settings.salesTeam.map((member) => (
                  <option key={member} value={member}>
                    {member}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                اولویت
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as 'low' | 'medium' | 'high')}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="high">اولویت بالا</option>
                <option value="medium">اولویت متوسط</option>
                <option value="low">عادی</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">زمان سررسید</label>
              <div className="flex gap-1 rounded bg-slate-100 p-0.5 text-[11px] dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => setDueMode('preset')}
                  className={`rounded px-2 py-0.5 ${dueMode === 'preset' ? 'bg-white shadow-sm dark:bg-slate-700' : ''}`}
                >
                  سریع
                </button>
                <button
                  type="button"
                  onClick={() => setDueMode('jalali')}
                  className={`rounded px-2 py-0.5 ${dueMode === 'jalali' ? 'bg-white shadow-sm dark:bg-slate-700' : ''}`}
                >
                  تقویم شمسی
                </button>
              </div>
            </div>
            {dueMode === 'preset' ? (
              <select
                value={dueOffsetHours}
                onChange={(e) => setDueOffsetHours(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                <option value={1}>۱ ساعت دیگر (امروز)</option>
                <option value={4}>۴ ساعت دیگر (امروز)</option>
                <option value={24}>فردا</option>
                <option value={48}>۲ روز دیگر</option>
              </select>
            ) : (
              <JalaliDatePicker value={dueJalali} onChange={setDueJalali} />
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
              ثبت پیگیری
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
