import { useState } from 'react';
import { LayoutDashboard, Users, CalendarDays, ShoppingBag, ListChecks, LifeBuoy, Zap, Settings } from 'lucide-react';
import { customers, appointments, orders, tasks, tickets } from './data/seed';
import { formatJalaliDateTime, toFa } from './utils/jalali';

type PageKey = 'dashboard' | 'customers' | 'appointments' | 'orders' | 'tasks' | 'tickets' | 'automation' | 'settings';

const NAV: { key: PageKey; label: string; icon: typeof Users }[] = [
  { key: 'dashboard', label: 'داشبورد', icon: LayoutDashboard },
  { key: 'customers', label: 'مشتریان', icon: Users },
  { key: 'appointments', label: 'نوبت‌ها', icon: CalendarDays },
  { key: 'orders', label: 'سفارش‌ها', icon: ShoppingBag },
  { key: 'tasks', label: 'پیگیری‌ها', icon: ListChecks },
  { key: 'tickets', label: 'تیکت‌ها', icon: LifeBuoy },
  { key: 'automation', label: 'اتوماسیون', icon: Zap },
  { key: 'settings', label: 'تنظیمات', icon: Settings },
];

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-slate-800">
      <div className="text-sm text-slate-500">{title}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState<PageKey>('dashboard');

  return (
    <div className="flex h-full">
      <aside className="w-56 shrink-0 border-l bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
        <div className="mb-4 px-2 text-lg font-bold text-indigo-600">ClientFlow</div>
        <nav className="space-y-1">
          {NAV.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setPage(key)}
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                page === key ? 'bg-indigo-50 text-indigo-700 dark:bg-slate-700' : 'hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="flex-1 overflow-auto p-6">
        {page === 'dashboard' ? (
          <div>
            <h1 className="mb-4 text-xl font-bold">داشبورد</h1>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Card title="تعداد مشتریان" value={toFa(String(customers.length))} />
              <Card title="نوبت‌ها" value={toFa(String(appointments.length))} />
              <Card title="سفارش‌ها" value={toFa(String(orders.length))} />
              <Card title="پیگیری‌های باز" value={toFa(String(tasks.filter((t) => !t.done).length))} />
            </div>
            <p className="mt-6 text-sm text-slate-500">
              آخرین تیکت: {tickets[0]?.subject} — {tickets[0] && formatJalaliDateTime(tickets[0].createdAt)}
            </p>
            <p className="mt-6 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              این یک اسکلت اولیه است. بقیه صفحات را با فایل <code>AI_STUDIO_PROMPT.md</code> بسازید.
            </p>
          </div>
        ) : (
          <div>
            <h1 className="mb-2 text-xl font-bold">{NAV.find((n) => n.key === page)?.label}</h1>
            <p className="text-slate-500">این صفحه هنوز ساخته نشده است (TODO).</p>
          </div>
        )}
      </main>
    </div>
  );
}
