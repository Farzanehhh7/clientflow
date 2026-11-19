import { useEffect, useState } from 'react';
import {
  BarChart3,
  Building2,
  CalendarDays,
  Compass,
  Database,
  GitBranch,
  Globe,
  Layers,
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
import { OnboardingTour } from './components/OnboardingTour';
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
import { TicketsPage } from './pages/TicketsPage';
import { WorkflowsPage } from './pages/WorkflowsPage';
import { ClientFlowProvider, useClientFlow } from './store/useClientFlowStore';
import { displayDigits, getUiText, PACK_LABELS } from './utils/i18n';
import { formatJalali } from './utils/jalali';
import { OfflineIndicator, PWAInstallButton } from './utils/usePWA';

type NavItem = {
  key: NavPageKey;
  icon: typeof Users;
  adminOnly?: boolean;
  soloVisible?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', icon: LayoutDashboard, soloVisible: true },
  { key: 'customers', icon: Users, soloVisible: true },
  { key: 'appointments', icon: CalendarDays, soloVisible: true },
  { key: 'orders', icon: ShoppingBag, soloVisible: true },
  { key: 'sales', icon: TrendingUp },
  { key: 'workflows', icon: GitBranch },
  { key: 'marketing', icon: Megaphone },
  { key: 'tasks', icon: ListChecks, soloVisible: true },
  { key: 'tickets', icon: LifeBuoy },
  { key: 'nps', icon: Star },
  { key: 'custom_entities', icon: Database },
  { key: 'reports', icon: BarChart3, soloVisible: true },
  { key: 'automation', icon: Zap, adminOnly: true },
  { key: 'settings', icon: Settings, adminOnly: true, soloVisible: true },
];

function AppShell() {
  const { state, toasts, dismissToast, updateSettings } = useClientFlow();
  const [page, setPage] = useState<NavPageKey>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);

  const lang = state.settings.language ?? 'fa';
  const uiMode = state.settings.uiMode ?? 'enterprise';
  const t = getUiText(lang);
  const isAdmin = state.settings.role === 'admin';

  const visibleNav = NAV_ITEMS.filter((item) => {
    if (item.adminOnly && !isAdmin) return false;
    if (uiMode === 'solo' && !item.soloVisible) return false;
    return true;
  }).map((item) => ({
    ...item,
    label: t.nav[item.key],
  }));

  useEffect(() => {
    const activeItem = NAV_ITEMS.find((n) => n.key === page);
    if (activeItem?.adminOnly && !isAdmin) {
      setPage('dashboard');
    } else if (uiMode === 'solo' && activeItem && !activeItem.soloVisible) {
      setPage('dashboard');
    }
  }, [isAdmin, uiMode, page]);

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
  const openTasksCount = state.tasks.filter((tk) => !tk.done).length;
  const openTicketsCount = state.tickets.filter((tk) => tk.status !== 'resolved').length;
  const runningWorkflowsCount = state.workflows.filter((w) => w.status === 'running').length;

  const renderPage = () => {
    switch (page) {
      case 'dashboard':
        return <DashboardPage onNavigate={setPage} onStartTour={() => setTourOpen(true)} />;
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
        return isAdmin ? (
          <SettingsPage onStartTour={() => setTourOpen(true)} />
        ) : (
          <DashboardPage onNavigate={setPage} />
        );
    }
  };

  const sidebarBorderClass =
    lang === 'en' ? 'border-r border-slate-200 dark:border-slate-800' : 'border-l border-slate-200 dark:border-slate-800';

  const sidebarContent = (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 px-4 py-4 dark:border-slate-800">
        <div className="flex items-center justify-between gap-2">
          <div className="text-lg font-bold tracking-tight text-indigo-600 dark:text-indigo-400">
            {t.appTitle}
          </div>
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {uiMode === 'solo' ? t.soloMode : t.enterpriseMode}
          </span>
        </div>
        <div className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
          {state.settings.businessName}
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label={t.mainMenu}>
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
                  {displayDigits(count, lang, state.settings.latinDigits)}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-slate-200 p-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
        <div className="truncate font-medium text-slate-700 dark:text-slate-300">
          {PACK_LABELS[state.settings.industryPack]?.[lang] ?? state.settings.industryPack}
        </div>
        <div className="mt-0.5 tabular-nums">
          {displayDigits(formatJalali(new Date().toISOString(), 'YYYY/MM/DD'), lang, state.settings.latinDigits)}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-full bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Desktop Sidebar */}
      <aside className={`print-hidden hidden w-60 shrink-0 bg-white lg:block dark:bg-slate-900 ${sidebarBorderClass}`}>
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="print-hidden fixed inset-0 z-40 flex lg:hidden">
          <div className="fixed inset-0 bg-slate-950/40" onClick={() => setMobileMenuOpen(false)} />
          <aside className={`relative z-10 w-64 bg-white dark:bg-slate-900 ${sidebarBorderClass}`}>
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
        <header className="print-hidden flex h-14 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 sm:px-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="باز کردن منو"
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Menu size={18} />
            </button>
            <h1 className="truncate text-base font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
              {currentNav.label}
            </h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Multi-branch switcher (FR-CORE-04) */}
            {state.branches.length > 0 && uiMode === 'enterprise' && (
              <div className="hidden xl:flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-800">
                <Building2 size={13} className="text-indigo-500 shrink-0" />
                <select
                  aria-label="انتخاب شعبه فعال"
                  value={state.settings.activeBranchId}
                  onChange={(e) => updateSettings({ activeBranchId: e.target.value })}
                  className="bg-transparent text-xs font-medium text-slate-700 focus:outline-none dark:text-slate-200"
                >
                  <option value="all">{t.allBranches}</option>
                  {state.branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="hidden md:inline-flex items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              <Search size={14} />
              <span>{t.quickSearch}</span>
              <span className="font-mono text-[11px] text-slate-400" dir="ltr">
                Ctrl+K
              </span>
            </button>

            {/* Solo / Enterprise Switch (FR-CORE-06) */}
            <button
              type="button"
              onClick={() =>
                updateSettings({ uiMode: uiMode === 'solo' ? 'enterprise' : 'solo' })
              }
              title={lang === 'en' ? 'Switch Solo / Enterprise mode' : 'تغییر نمای ساده / سازمانی'}
              className="hidden sm:inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Layers size={13} className="text-indigo-500" />
              <span>{uiMode === 'solo' ? t.soloMode : t.enterpriseMode}</span>
            </button>

            {/* Language Switch fa/en (FR-UX-07) */}
            <button
              type="button"
              onClick={() => updateSettings({ language: lang === 'fa' ? 'en' : 'fa' })}
              title={lang === 'en' ? 'تغییر به فارسی' : 'Switch to English'}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Globe size={13} className="text-sky-500" />
              <span className="font-mono uppercase">{lang}</span>
            </button>

            {/* Guided Tour Button (FR-UX-08) */}
            <button
              type="button"
              onClick={() => setTourOpen(true)}
              title={t.tourBtn}
              className="hidden sm:inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Compass size={13} className="text-emerald-500" />
              <span>{t.tourBtn}</span>
            </button>

            <PWAInstallButton lang={lang} />

            <select
              aria-label="تغییر نقش کاربری"
              value={state.settings.role}
              onChange={(e) => updateSettings({ role: e.target.value as 'admin' | 'staff' })}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="admin">{t.roleAdmin}</option>
              <option value="staff">{t.roleStaff}</option>
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
        <div className="print-hidden fixed bottom-4 left-4 z-50 flex max-w-sm flex-col gap-2">
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

      <OfflineIndicator lang={lang} simulatedOffline={state.settings.simulatedOffline} />
      <OnboardingTour open={tourOpen} onClose={() => setTourOpen(false)} onNavigate={setPage} />

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
