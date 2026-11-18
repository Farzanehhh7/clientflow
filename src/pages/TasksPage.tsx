import { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { Plus } from 'lucide-react';
import { Modal } from '../components/Modal';
import { useClientFlow } from '../store/useClientFlowStore';
import { formatJalaliDateTime, isSameDay, toFa } from '../utils/jalali';

export function TasksPage() {
  const { state, toggleTaskDone, addTask } = useClientFlow();
  const [filter, setFilter] = useState<'today_overdue' | 'all' | 'done'>('today_overdue');
  const [createOpen, setCreateOpen] = useState(false);

  const [title, setTitle] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [dueOffsetHours, setDueOffsetHours] = useState(2);

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
    addTask({
      title,
      customerId: customerId || undefined,
      dueAt: dayjs().add(dueOffsetHours, 'hour').toISOString(),
    });
    setTitle('');
    setCustomerId('');
    setCreateOpen(false);
  };

  const renderTaskList = (items: typeof state.tasks, emptyText: string, highlightOverdue = false) => {
    if (items.length === 0) {
      return <p className="py-6 text-center text-xs text-slate-400">{emptyText}</p>;
    }
    return (
      <div className="divide-y divide-slate-200 dark:divide-slate-800">
        {items.map((task) => {
          const cust = state.customers.find((c) => c.id === task.customerId);
          return (
            <div key={task.id} className="flex items-center justify-between gap-3 py-3">
              <label className="flex min-w-0 cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={task.done}
                  onChange={() => toggleTaskDone(task.id)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <div className="min-w-0">
                  <div
                    className={`text-sm font-medium ${
                      task.done ? 'line-through text-slate-400' : 'text-slate-900 dark:text-slate-100'
                    }`}
                  >
                    {task.title}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {cust ? `${cust.name} · ` : ''}
                    {task.createdByRuleId ? 'ایجادشده توسط اتوماسیون · ' : ''}
                    <span className={highlightOverdue ? 'font-medium text-rose-600 dark:text-rose-400' : ''}>
                      <span className="tabular-nums">{formatJalaliDateTime(task.dueAt)}</span>
                    </span>
                  </div>
                </div>
              </label>
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
          پیگیری جدید
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

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="ثبت پیگیری جدید" maxWidth="md">
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
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">زمان سررسید</label>
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
            </div>
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
