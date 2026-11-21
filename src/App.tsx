import { lazy, Suspense, useEffect, useState } from 'react';
import {
  BarChart3,
  Building,
  Building2,
  CalendarDays,
  Compass,
  Database,
  GitBranch,
  Globe,
  KeyRound,
  Layers,
  LayoutDashboard,
  LifeBuoy,
  ListChecks,
  Lock,
  Megaphone,
  Menu,
  Moon,
  Package,
  Plug,
  Search,
  Settings,
  ShoppingBag,
  Sparkles,
  Star,
  Sun,
  TrendingUp,
  Users,
  WifiOff,
  X,
  Zap,
} from 'lucide-react';
import { DockedAiChat } from './components/ai/DockedAiChat';
import { CommandPaletteModal } from './components/CommandPaletteModal';
import { IncomingCallPopup } from './components/integrations/IncomingCallPopup';
import { NpsSurveyModal } from './components/NpsSurveyModal';
import { OnboardingTour } from './components/OnboardingTour';
import { DashboardPage, type NavPageKey } from './pages/DashboardPage';
import { ClientFlowProvider, useClientFlow } from './store/useClientFlowStore';
import type { AiRecordReference } from './utils/aiRetrieval';
import { displayDigits, getUiText, PACK_LABELS } from './utils/i18n';
import { formatJalali } from './utils/jalali';
import { isTicketClosedStatus } from './utils/slaEngine';
import {
  DEFAULT_SECURITY_POLICY,
  getEffectiveUserAndRole,
  validatePasswordAgainstPolicy,
} from './utils/security';
import { OfflineIndicator, PWAInstallButton, useOnlineStatus } from './utils/usePWA';

// Lazy-loaded route pages for code splitting & faster initial bundle
const AiCenterPage = lazy(() => import('./pages/AiCenterPage').then((m) => ({ default: m.AiCenterPage })));
const AppointmentsPage = lazy(() => import('./pages/AppointmentsPage').then((m) => ({ default: m.AppointmentsPage })));
const AutomationPage = lazy(() => import('./pages/AutomationPage').then((m) => ({ default: m.AutomationPage })));
const CustomerPortalPage = lazy(() => import('./pages/CustomerPortalPage').then((m) => ({ default: m.CustomerPortalPage })));
const CustomEntitiesPage = lazy(() => import('./pages/CustomEntitiesPage').then((m) => ({ default: m.CustomEntitiesPage })));
const CustomersPage = lazy(() => import('./pages/CustomersPage').then((m) => ({ default: m.CustomersPage })));
const IntegrationsPage = lazy(() => import('./pages/IntegrationsPage').then((m) => ({ default: m.IntegrationsPage })));
const MarketingPage = lazy(() => import('./pages/MarketingPage').then((m) => ({ default: m.MarketingPage })));
const NpsPage = lazy(() => import('./pages/NpsPage').then((m) => ({ default: m.NpsPage })));
const OrdersPage = lazy(() => import('./pages/OrdersPage').then((m) => ({ default: m.OrdersPage })));
const PackManagerPage = lazy(() => import('./pages/PackManagerPage').then((m) => ({ default: m.PackManagerPage })));
const ReportsPage = lazy(() => import('./pages/ReportsPage').then((m) => ({ default: m.ReportsPage })));
const SalesPage = lazy(() => import('./pages/SalesPage').then((m) => ({ default: m.SalesPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const TasksPage = lazy(() => import('./pages/TasksPage').then((m) => ({ default: m.TasksPage })));
const TicketsPage = lazy(() => import('./pages/TicketsPage').then((m) => ({ default: m.TicketsPage })));
const WorkflowsPage = lazy(() => import('./pages/WorkflowsPage').then((m) => ({ default: m.WorkflowsPage })));

function PageSuspenseFallback() {
  return (
    <div
      role="status"
      aria-label="در حال بارگذاری صفحه"
      className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="h-5 w-48 rounded bg-slate-200 dark:bg-slate-800" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="h-24 rounded-lg bg-slate-100 dark:bg-slate-800/60" />
        <div className="h-24 rounded-lg bg-slate-100 dark:bg-slate-800/60" />
        <div className="h-24 rounded-lg bg-slate-100 dark:bg-slate-800/60" />
      </div>
      <div className="h-44 rounded-lg bg-slate-100 dark:bg-slate-800/50" />
    </div>
  );
}

function isPortalRouteLocation(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.location.pathname.endsWith('/portal') ||
    window.location.hash === '#/portal'
  );
}

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
  { key: 'integrations', icon: Plug, soloVisible: true },
  { key: 'ai_center', icon: Sparkles, soloVisible: true },
  { key: 'packs', icon: Package, adminOnly: true },
  { key: 'settings', icon: Settings, adminOnly: true, soloVisible: true },
];

function AppShell() {
  const {
    state,
    toasts,
    dismissToast,
    updateSettings,
    tenants,
    activeTenantId,
    switchTenant,
  } = useClientFlow();
  const [page, setPage] = useState<NavPageKey>('dashboard');
  const [isPortalRoute, setIsPortalRoute] = useState<boolean>(() => isPortalRouteLocation());
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [sessionLocked, setSessionLocked] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const [deepLinkCustomerId, setDeepLinkCustomerId] = useState<string | null>(null);
  const [deepLinkTicketId, setDeepLinkTicketId] = useState<string | null>(null);

  const realOnline = useOnlineStatus();
  const isOffline = !realOnline || Boolean(state.settings.simulatedOffline);

  const handleAiNavigateToRecord = (ref: AiRecordReference) => {
    if (ref.entityType === 'customer') {
      setDeepLinkCustomerId(ref.targetId);
      setPage('customers');
      return;
    }
    if (ref.entityType === 'ticket') {
      setDeepLinkTicketId(ref.targetId);
      setPage('tickets');
      return;
    }
    setPage(ref.navPage);
  };

  const openPortalRoute = () => {
    try {
      window.history.pushState({}, '', '/portal');
    } catch {
      window.location.hash = '#/portal';
    }
    setIsPortalRoute(true);
  };

  const exitPortalRoute = () => {
    try {
      window.history.pushState({}, '', '/');
    } catch {
      window.location.hash = '';
    }
    setIsPortalRoute(false);
  };

  useEffect(() => {
    const onPopState = () => setIsPortalRoute(isPortalRouteLocation());
    window.addEventListener('popstate', onPopState);
    window.addEventListener('hashchange', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('hashchange', onPopState);
    };
  }, []);

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
      } else if (e.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileMenuOpen]);

  const { activeUser, activeRole } = getEffectiveUserAndRole(state);
  const securityPolicy = state.settings.security ?? DEFAULT_SECURITY_POLICY;

  useEffect(() => {
    if (sessionLocked || isPortalRoute || securityPolicy.sessionTimeoutMin <= 0) return;
    let timerId: number | undefined;
    const timeoutMs = securityPolicy.sessionTimeoutMin * 60_000;
    const resetTimer = () => {
      if (timerId !== undefined) window.clearTimeout(timerId);
      timerId = window.setTimeout(() => {
        setUnlockPassword('');
        setUnlockError('');
        setSessionLocked(true);
      }, timeoutMs);
    };
    resetTimer();
    const events: (keyof WindowEventMap)[] = ['mousemove', 'keydown', 'mousedown', 'touchstart'];
    events.forEach((ev) => window.addEventListener(ev, resetTimer, { passive: true }));
    return () => {
      if (timerId !== undefined) window.clearTimeout(timerId);
      events.forEach((ev) => window.removeEventListener(ev, resetTimer));
    };
  }, [sessionLocked, isPortalRoute, securityPolicy.sessionTimeoutMin]);

  const currentNav = visibleNav.find((n) => n.key === page) ?? visibleNav[0];
  const openTasksCount = state.tasks.filter((tk) => !tk.isDeleted && !tk.done).length;
  const openTicketsCount = state.tickets.filter((tk) => !tk.isDeleted && !isTicketClosedStatus(tk.status)).length;
  const runningWorkflowsCount = state.workflows.filter((w) => w.status === 'running').length;

  if (isPortalRoute) {
    return (
      <Suspense fallback={<PageSuspenseFallback />}>
        <CustomerPortalPage onExitPortal={exitPortalRoute} />
      </Suspense>
    );
  }

  const renderPage = () => {
    switch (page) {
      case 'dashboard':
        return <DashboardPage onNavigate={setPage} onStartTour={() => setTourOpen(true)} />;
      case 'customers':
        return (
          <CustomersPage
            initialCustomerId={deepLinkCustomerId}
            onClearInitialCustomerId={() => setDeepLinkCustomerId(null)}
          />
        );
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
        return (
          <TicketsPage
            onOpenPortal={openPortalRoute}
            initialTicketId={deepLinkTicketId}
            onClearInitialTicketId={() => setDeepLinkTicketId(null)}
          />
        );
      case 'nps':
        return <NpsPage />;
      case 'custom_entities':
        return <CustomEntitiesPage />;
      case 'reports':
        return <ReportsPage />;
      case 'automation':
        return isAdmin ? <AutomationPage /> : <DashboardPage onNavigate={setPage} />;
      case 'integrations':
        return <IntegrationsPage />;
      case 'ai_center':
        return <AiCenterPage />;
      case 'packs':
        return isAdmin ? <PackManagerPage /> : <DashboardPage onNavigate={setPage} />;
      case 'settings':
        return isAdmin ? (
          <SettingsPage
            onStartTour={() => setTourOpen(true)}
            onOpenAiCenter={() => setPage('ai_center')}
            onOpenPackManager={() => setPage('packs')}
            onTriggerLockScreen={() => {
              setUnlockPassword('');
              setUnlockError('');
              setSessionLocked(true);
            }}
          />
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
        {tenants.length > 0 && (
          <div className="mt-2.5 flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 dark:border-slate-700 dark:bg-slate-800/70">
            <Building size={13} className="shrink-0 text-indigo-500" />
            <select
              aria-label="تغییر کسب‌وکار (Tenant)"
              value={activeTenantId}
              onChange={(e) => switchTenant(e.target.value)}
              className="w-full truncate bg-transparent text-[11px] font-medium text-slate-700 focus:outline-none dark:text-slate-200"
            >
              {tenants.map((tn) => (
                <option key={tn.id} value={tn.id} className="bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100">
                  {tn.name}
                </option>
              ))}
            </select>
          </div>
        )}
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
              aria-current={active ? 'page' : undefined}
              onClick={() => {
                setPage(key);
                setMobileMenuOpen(false);
              }}
              className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                active
                  ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-100'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <Icon size={17} aria-hidden="true" className="shrink-0" />
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

      {/* Mobile-friendly quick shortcuts inside drawer */}
      <div className="border-t border-slate-200 px-3 py-2 lg:hidden dark:border-slate-800">
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              openPortalRoute();
            }}
            className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1 text-[11px] font-medium text-indigo-700 dark:border-indigo-900/50 dark:bg-indigo-950/40 dark:text-indigo-300"
          >
            <LifeBuoy size={12} />
            {lang === 'en' ? 'Customer Portal' : 'پورتال مشتری'}
          </button>
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              setPaletteOpen(true);
            }}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-700 dark:border-slate-700 dark:text-slate-300"
          >
            <Search size={12} />
            {t.quickSearch}
          </button>
        </div>
      </div>

      <div className="border-t border-slate-200 p-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
        {activeUser && (
          <div className="mb-1.5 flex items-center justify-between gap-2 rounded-md bg-slate-50 px-2 py-1 text-[11px] dark:bg-slate-800/60">
            <span className="truncate font-semibold text-slate-700 dark:text-slate-200">
              {activeUser.name}
            </span>
            <span className="shrink-0 text-[10px] text-indigo-600 dark:text-indigo-400">
              {activeRole?.name ?? (state.settings.role === 'admin' ? t.roleAdmin : t.roleStaff)}
            </span>
          </div>
        )}
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
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:right-4 focus:top-3 focus:z-[120] focus:rounded-lg focus:bg-indigo-600 focus:px-3 focus:py-2 focus:text-xs focus:font-semibold focus:text-white focus:shadow-lg"
      >
        {lang === 'en' ? 'Skip to main content' : 'پرش به محتوای اصلی'}
      </a>

      {/* Desktop Sidebar */}
      <aside
        aria-label="نوار ناوبری"
        className={`print-hidden hidden w-60 shrink-0 bg-white lg:block dark:bg-slate-900 ${sidebarBorderClass}`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="منوی ناوبری موبایل"
          className="print-hidden fixed inset-0 z-40 flex lg:hidden"
        >
          <div className="fixed inset-0 bg-slate-950/40" onClick={() => setMobileMenuOpen(false)} />
          <aside className={`relative z-10 w-64 bg-white dark:bg-slate-900 ${sidebarBorderClass}`}>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="بستن منو"
              className="absolute left-3 top-3 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:hover:bg-slate-800"
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
              aria-expanded={mobileMenuOpen}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 lg:hidden dark:text-slate-300 dark:hover:bg-slate-800"
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
              aria-label={t.quickSearch}
              onClick={() => setPaletteOpen(true)}
              className="hidden md:inline-flex items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
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
              className="hidden sm:inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Layers size={13} className="text-indigo-500" />
              <span>{uiMode === 'solo' ? t.soloMode : t.enterpriseMode}</span>
            </button>

            {/* Language Switch fa/en (FR-UX-07) */}
            <button
              type="button"
              onClick={() => updateSettings({ language: lang === 'fa' ? 'en' : 'fa' })}
              aria-label={lang === 'en' ? 'تغییر به فارسی' : 'Switch to English'}
              title={lang === 'en' ? 'تغییر به فارسی' : 'Switch to English'}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Globe size={13} className="text-sky-500" />
              <span className="font-mono uppercase">{lang}</span>
            </button>

            {/* Guided Tour Button (FR-UX-08) */}
            <button
              type="button"
              onClick={() => setTourOpen(true)}
              title={t.tourBtn}
              className="hidden sm:inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Compass size={13} className="text-emerald-500" />
              <span>{t.tourBtn}</span>
            </button>

            <button
              type="button"
              onClick={openPortalRoute}
              title={lang === 'en' ? 'Public Customer Portal (/portal)' : 'پورتال عمومی مشتری (/portal)'}
              className="hidden lg:inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50/70 px-2.5 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-indigo-900/50 dark:bg-indigo-950/30 dark:text-indigo-300"
            >
              <LifeBuoy size={13} />
              <span>{lang === 'en' ? 'Portal' : 'پورتال مشتری'}</span>
            </button>

            <PWAInstallButton lang={lang} />

            <select
              aria-label="تغییر نقش کاربری"
              value={state.settings.role}
              onChange={(e) => updateSettings({ role: e.target.value as 'admin' | 'staff' })}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="admin">{t.roleAdmin}</option>
              <option value="staff">{t.roleStaff}</option>
            </select>

            <button
              type="button"
              onClick={() => updateSettings({ darkMode: !state.settings.darkMode })}
              aria-label={state.settings.darkMode ? 'حالت روشن' : 'حالت تاریک'}
              className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {state.settings.darkMode ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </header>

        <main id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto p-4 sm:p-6 focus:outline-none">
          {isOffline && (
            <div
              role="status"
              className="print-hidden mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
            >
              <span className="flex items-center gap-2 font-medium">
                <WifiOff size={14} className="shrink-0" />
                {lang === 'en'
                  ? 'Offline Shell Active — Reading cached PWA shell and LocalStorage state.'
                  : 'پوسته آفلاین PWA فعال است — داده‌های کش‌شده و حافظه محلی قابل مشاهده هستند.'}
              </span>
              {state.settings.simulatedOffline && (
                <button
                  type="button"
                  onClick={() => updateSettings({ simulatedOffline: false })}
                  className="rounded-md border border-amber-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:bg-slate-900 dark:text-amber-200"
                >
                  {lang === 'en' ? 'Restore Online Mode' : 'بازگشت به حالت آنلاین'}
                </button>
              )}
            </div>
          )}

          <Suspense fallback={<PageSuspenseFallback />}>{renderPage()}</Suspense>
        </main>
      </div>

      {/* Toast Container */}
      {toasts.length > 0 && (
        <div
          aria-live="polite"
          className="print-hidden fixed bottom-4 left-4 z-50 flex max-w-sm flex-col gap-2"
        >
          {toasts.map((toast) => (
            <div
              key={toast.id}
              role="status"
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
                aria-label="بستن اعلان"
                onClick={() => dismissToast(toast.id)}
                className="text-current opacity-60 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
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
      <IncomingCallPopup />
      <DockedAiChat
        onNavigateToRecord={handleAiNavigateToRecord}
        onOpenAiCenter={() => setPage('ai_center')}
      />

      {sessionLocked && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="قفل نشست کاربری"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
                <Lock size={22} />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  نشست کاربری قفل شد
                </h2>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                  {state.settings.businessName} · {activeUser?.name ?? 'کاربر'} ({activeRole?.name ?? t.roleAdmin})
                </p>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const res = validatePasswordAgainstPolicy(unlockPassword, securityPolicy);
                if (!res.valid) {
                  const firstFail = res.checks.find((c) => !c.passed)?.label ?? 'رمز عبور مطابق خط‌مشی امنیتی نیست.';
                  setUnlockError(`خطا در خط‌مشی رمز عبور: ${firstFail}`);
                  return;
                }
                setUnlockError('');
                setUnlockPassword('');
                setSessionLocked(false);
              }}
              className="mt-5 space-y-3"
            >
              <div>
                <label
                  htmlFor="unlock-password-input"
                  className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300"
                >
                  <KeyRound size={13} />
                  رمز عبور مطابق خط‌مشی امنیتی را وارد کنید
                </label>
                <input
                  id="unlock-password-input"
                  type="password"
                  dir="ltr"
                  autoFocus
                  value={unlockPassword}
                  onChange={(e) => {
                    setUnlockPassword(e.target.value);
                    setUnlockError('');
                  }}
                  placeholder="Abc12345"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm dark:border-slate-700 dark:bg-slate-800"
                />
                {unlockError && (
                  <p className="mt-1.5 text-xs text-rose-600 dark:text-rose-400">{unlockError}</p>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setUnlockError('');
                    setUnlockPassword('');
                    setSessionLocked(false);
                  }}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  بازگشایی آزمایشی (Demo)
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
                >
                  تأیید و ورود مجدد
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
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
