import { useEffect, useState } from 'react';
import {
  BarChart3,
  CalendarDays,
  Database,
  GitBranch,
  LayoutDashboard,
  LifeBuoy,
  ListChecks,
  Megaphone,
  Menu,
  Moon,
  Search,
  Settings,
  ShoppingBag,
  Star,
  Sun,
  TrendingUp,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { CommandPaletteModal } from './components/CommandPaletteModal';
import { NpsSurveyModal } from './components/NpsSurveyModal';
import { AppointmentsPage } from './pages/AppointmentsPage';
import { AutomationPage } from './pages/AutomationPage';
import { CustomEntitiesPage } from './pages/CustomEntitiesPage';
import { CustomersPage } from './pages/CustomersPage';
import { DashboardPage, type NavPageKey } from './pages/DashboardPage';
import { MarketingPage } from './pages/MarketingPage';
import { NpsPage } from './pages/NpsPage';
import { OrdersPage } from './pages/OrdersPage';
import { ReportsPage } from './pages/ReportsPage';
import { SalesPage } from './pages/SalesPage';
import { SettingsPage } from './pages/SettingsPage';
import { TasksPage } from './pages/TasksPage';
import { WorkflowsPage } from './pages/WorkflowsPage';
import { TicketsPage } from './pages/TicketsPage';
import { ClientFlowProvider, useClientFlow } from './store/useClientFlowStore';
import { formatJalali, toFa } from './utils/jalali';

type NavItem = {
  key: NavPageKey;
  label: string;
  icon: typeof Users;
  adminOnly?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'داشبورد', icon: LayoutDashboard },
  { key: 'customers', label: 'مشتریان', icon: Users },
  { key: 'appointments', label: 'نوبت‌ها', icon: CalendarDays },
  { key: 'orders', label: 'سفارش‌ها و مالی', icon: ShoppingBag },
  { key: 'sales', label: 'قیف فروش', icon: TrendingUp },
  { key: 'workflows', label: 'گردش کار (BPMS)', icon: GitBranch },
  { key: 'marketing', label: 'تقویم محتوا', icon: Megaphone },
  { key: 'tasks', label: 'پیگیری‌ها', icon: ListChecks },
  { key: 'tickets', label: 'تیکت و پایگاه دانش', icon: LifeBuoy },
  { key: 'nps', label: 'رضایت‌سنجی (NPS)', icon: Star },
  { key: 'custom_entities', label: 'موجودیت‌های سفارشی', icon: Database },
  { key: 'reports', label: 'گزارش‌ها و تحلیل', icon: BarChart3 },
  { key: 'automation', label: 'اتوماسیون و پیامک', icon: Zap, adminOnly: true },
  { key: 'settings', label: 'تنظیمات', icon: Settings, adminOnly: true },
];

const PACK_LABEL = {
  clinic: 'بسته کلینیک',
  shop: 'بسته فروشگاه',
  software: 'بسته نرم‌افزاری',
  general: 'بسته عمومی',
} as const;

function AppShell() {
  const { state, toasts, dismissToast, updateSettings } = useClientFlow();
  const [page, setPage] = useState<NavPageKey>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const isAdmin = state.settings.role === 'admin';
  const visibleNav = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);

  useEffect(() => {
    const activeItem = NAV_ITEMS.find((n) => n.key === page);
    if (activeItem?.adminOnly && !isAdmin) {
      setPage('dashboard');
    }
  }, [isAdmin, page]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const currentNav = visibleNav.find((n) => n.key === page) ?? visibleNav[0];
  const openTasksCount = state.tasks.filter((t) => !t.done).length;
  const openTicketsCount = state.tickets.filter((t) => t.status !== 'resolved').length;
  const runningWorkflowsCount = state.workflows.filter((w) => w.status === 'running').length;

  const renderPage = () => {
    switch (page) {
      case 'dashboard':
        return <DashboardPage onNavigate={setPage} />;
      case 'customers':
        return <CustomersPage />;
      case 'appointments':
        return <AppointmentsPage />;
      case 'orders':
        return <OrdersPage />;
      case 'sales':
        return <SalesPage />;
      case 'workflows':
        return <WorkflowsPage />;
      case 'marketing':
        return <MarketingPage />;
      case 'tasks':
        return <TasksPage />;
      case 'tickets':
        return <TicketsPage />;
      case 'nps':
        return <NpsPage />;
      case 'custom_entities':
        return <CustomEntitiesPage />;
      case 'reports':
        return <ReportsPage />;
      case 'automation':
        return isAdmin ? <AutomationPage /> : <DashboardPage onNavigate={setPage} />;
      case 'settings':
        return isAdmin ? <SettingsPage /> : <DashboardPage onNavigate={setPage} />;
    }
  };

  const sidebarContent = (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 px-4 py-4 dark:border-slate-800">
        <div className="text-lg font-bold tracking-tight text-indigo-600 dark:text-indigo-400">
          ClientFlow
        </div>
        <div className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
          {state.settings.businessName}
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="منوی اصلی">
        {visibleNav.map(({ key, label, icon: Icon }) => {
          const active = page === key;
          const count =
            key === 'tasks'
              ? openTasksCount
              : key === 'tickets'
                ? openTicketsCount
                : key === 'workflows'
                  ? runningWorkflowsCount
                  : key === 'automation'
                    ? state.outbox.length
                    : null;
          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                setPage(key);
                setMobileMenuOpen(false);
              }}
              className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                active
                  ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-100'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <Icon size={17} className="shrink-0" />
                <span>{label}</span>
              </span>
              {count !== null && count > 0 && (
                <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
                  {toFa(count)}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-slate-200 p-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
        <div>{PACK_LABEL[state.settings.industryPack]}</div>
        <div className="mt-0.5 tabular-nums">{formatJalali(new Date().toISOString(), 'YYYY/MM/DD')}</div>
      </div>
    </div>
  );

  return (
    <div className="flex h-full bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Desktop Sidebar */}
      <aside className="hidden w-60 shrink-0 border-l border-slate-200 bg-white lg:block dark:border-slate-800 dark:bg-slate-900">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div className="fixed inset-0 bg-slate-950/40" onClick={() => setMobileMenuOpen(false)} />
          <aside className="relative z-10 w-64 border-l border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="بستن منو"
              className="absolute left-3 top-3 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X size={18} />
            </button>
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main Column */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 sm:px-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="باز کردن منو"
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Menu size={18} />
            </button>
            <h1 className="text-base font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
              {currentNav.label}
            </h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="hidden sm:inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              <Search size={14} />
              <span>جستجوی سریع</span>
              <span className="font-mono text-[11px] text-slate-400" dir="ltr">
                Ctrl+K
              </span>
            </button>

            <select
              aria-label="تغییر نقش کاربری"
              value={state.settings.role}
              onChange={(e) => updateSettings({ role: e.target.value as 'admin' | 'staff' })}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="admin">نقش: مدیر سیستم</option>
              <option value="staff">نقش: کارشناس</option>
            </select>

            <button
              type="button"
              onClick={() => updateSettings({ darkMode: !state.settings.darkMode })}
              aria-label={state.settings.darkMode ? 'حالت روشن' : 'حالت تاریک'}
              className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {state.settings.darkMode ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">{renderPage()}</main>
      </div>

      {/* Toast Container */}
      {toasts.length > 0 && (
        <div className="fixed bottom-4 left-4 z-50 flex max-w-sm flex-col gap-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-2.5 text-xs font-medium shadow-md ${
                toast.type === 'error'
                  ? 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200'
                  : toast.type === 'info'
                    ? 'border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200'
              }`}
            >
              <span>{toast.text}</span>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                className="text-current opacity-60 hover:opacity-100"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <CommandPaletteModal
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onNavigate={setPage}
        pages={visibleNav.map((n) => ({ key: n.key, label: n.label }))}
      />
      <NpsSurveyModal />
    </div>
  );
}

export default function App() {
  return (
    <ClientFlowProvider>
      <AppShell />
    </ClientFlowProvider>
  );
}
