import type {
  AppState,
  Appointment,
  Customer,
  KbArticle,
  Order,
  SalesLead,
  Ticket,
} from '../types';
import { computeCustomerStats } from './crmHelpers';
import { formatJalali, formatToman, isSameDay, toFa } from './jalali';
import { fuzzyMatchPersian } from './persianSearch';
import {
  filterByUserScope,
  getEffectiveUserAndRole,
  hasPermission,
  maskPhone,
  shouldMaskPii,
} from './security';
import { evaluateTicketSla, isTicketClosedStatus, type SlaHealthState } from './slaEngine';

export type AiRecordEntityType = 'customer' | 'order' | 'ticket' | 'kb' | 'lead' | 'appointment';

export type AiRecordReference = {
  id: string;
  entityType: AiRecordEntityType;
  title: string;
  subtitle: string;
  navPage: 'customers' | 'orders' | 'tickets' | 'sales' | 'appointments';
  targetId: string;
};

export type ScopedTenantKnowledge = {
  scopeLabel: string;
  canViewCustomers: boolean;
  canViewOrders: boolean;
  canViewTickets: boolean;
  canViewSales: boolean;
  canViewAppointments: boolean;
  customers: Customer[];
  orders: Order[];
  tickets: Ticket[];
  kbArticles: KbArticle[];
  leads: SalesLead[];
  appointments: Appointment[];
  vipCustomers: { customer: Customer; totalSpent: number; score: number }[];
  overdueOrders: Order[];
  slaRiskTickets: { ticket: Ticket; slaState: SlaHealthState }[];
  matchedReferences: AiRecordReference[];
  contextSummaryForPrompt: Record<string, unknown>;
};

export function retrieveTenantKnowledge(
  state: AppState,
  query: string,
): ScopedTenantKnowledge {
  const { effectiveScope, activeRole } = getEffectiveUserAndRole(state);
  const maskForRole = shouldMaskPii(state);

  const canViewCustomers = hasPermission(state, 'customers', 'view');
  const canViewOrders = hasPermission(state, 'orders', 'view');
  const canViewTickets = hasPermission(state, 'tickets', 'view');
  const canViewSales = hasPermission(state, 'sales', 'view');
  const canViewAppointments = hasPermission(state, 'appointments', 'view');

  const customerMap = new Map(state.customers.map((c) => [c.id, c]));

  const customers = canViewCustomers
    ? filterByUserScope(
        state.customers.filter((c) => !c.isDeleted),
        state,
        (c) => c.ownerName,
        (c) => c.branchId,
      )
    : [];

  const orders = canViewOrders
    ? filterByUserScope(
        state.orders.filter((o) => !o.isDeleted),
        state,
        (o) => customerMap.get(o.customerId)?.ownerName,
        (o) => o.branchId ?? customerMap.get(o.customerId)?.branchId,
      )
    : [];

  const tickets = canViewTickets
    ? filterByUserScope(
        state.tickets.filter((t) => !t.isDeleted && !t.mergedIntoTicketId),
        state,
        (t) => t.assignee,
        (t) => customerMap.get(t.customerId)?.branchId,
      )
    : [];

  const leads = canViewSales
    ? filterByUserScope(
        state.leads.filter((l) => !l.isDeleted),
        state,
        (l) => l.ownerName,
        (l) => l.branchId,
      )
    : [];

  const appointments = canViewAppointments
    ? filterByUserScope(
        state.appointments.filter((a) => !a.isDeleted),
        state,
        (a) => customerMap.get(a.customerId)?.ownerName,
        (a) => a.branchId ?? customerMap.get(a.customerId)?.branchId,
      )
    : [];

  const kbArticles = canViewTickets
    ? state.kbArticles.filter((k) =>
        activeRole?.baseRole === 'admin' ? true : k.visibility === 'public' || k.visibility === 'internal',
      )
    : state.kbArticles.filter((k) => k.visibility === 'public');

  const nowMs = Date.now();
  const overdueOrders = orders.filter(
    (o) =>
      o.promisedAt &&
      o.status !== 'delivered' &&
      o.status !== 'cancelled' &&
      new Date(o.promisedAt).getTime() < nowMs,
  );

  const slaRiskTickets = tickets
    .filter((t) => !isTicketClosedStatus(t.status))
    .map((t) => {
      const ev = evaluateTicketSla(
        t,
        state.slaPolicies,
        state.settings,
        state.officialHolidays,
        nowMs,
      );
      return { ticket: t, slaState: ev.overallState };
    })
    .filter((x) => x.slaState === 'breached' || x.slaState === 'warning');

  const vipCustomers = customers
    .map((c) => {
      const st = computeCustomerStats(c, state);
      return { customer: c, totalSpent: st.totalSpent, score: st.score };
    })
    .sort((a, b) => b.totalSpent - a.totalSpent);

  // Build query-matched references respecting RBAC
  const q = query.trim();
  const refs: AiRecordReference[] = [];
  const seen = new Set<string>();
  const pushRef = (ref: AiRecordReference) => {
    const key = `${ref.entityType}:${ref.targetId}`;
    if (seen.has(key) || refs.length >= 8) return;
    seen.add(key);
    refs.push(ref);
  };

  if (canViewCustomers) {
    const matchedCust = q
      ? customers.filter((c) =>
          fuzzyMatchPersian([c.name, c.companyName, c.source, c.ownerName, ...c.tags], q),
        )
      : [];
    const wantVip = /vip|مشتری|بهترین|برتر|فروش|خرید/i.test(q);
    const list = matchedCust.length > 0 ? matchedCust : wantVip ? vipCustomers.slice(0, 4).map((v) => v.customer) : [];
    list.slice(0, 3).forEach((c) => {
      const st = computeCustomerStats(c, state);
      pushRef({
        id: `ref_c_${c.id}`,
        entityType: 'customer',
        title: c.name,
        subtitle: `${maskPhone(c.phone, maskForRole)} · امتیاز ${toFa(st.score)} · ${formatToman(st.totalSpent)}`,
        navPage: 'customers',
        targetId: c.id,
      });
    });
  }

  if (canViewTickets) {
    const wantSla = /sla|تیکت|پشتیبانی|شکایت|باز|تاخیر|نقض/i.test(q);
    const matchedTk = q
      ? tickets.filter((t) => fuzzyMatchPersian([t.subject, t.trackingCode, t.category, t.assignee], q))
      : [];
    const list =
      matchedTk.length > 0
        ? matchedTk
        : wantSla
          ? (slaRiskTickets.length > 0 ? slaRiskTickets.map((x) => x.ticket) : tickets.filter((t) => !isTicketClosedStatus(t.status)))
          : [];
    list.slice(0, 3).forEach((t) => {
      pushRef({
        id: `ref_t_${t.id}`,
        entityType: 'ticket',
        title: `${t.trackingCode ?? t.id} · ${t.subject}`,
        subtitle: `وضعیت: ${t.status} · اولویت: ${t.priority} · کارشناس: ${t.assignee || '—'}`,
        navPage: 'tickets',
        targetId: t.id,
      });
    });
  }

  if (canViewOrders) {
    const wantOverdue = /سفارش|معوق|تاخیر|تأخیر|مرسوله|ارسال/i.test(q);
    const matchedOrd = q
      ? orders.filter((o) =>
          fuzzyMatchPersian([o.id, customerMap.get(o.customerId)?.name, o.items.map((i) => i.name).join(' ')], q),
        )
      : [];
    const list = matchedOrd.length > 0 ? matchedOrd : wantOverdue ? overdueOrders : [];
    list.slice(0, 3).forEach((o) => {
      const cust = customerMap.get(o.customerId);
      const total = o.items.reduce((s, it) => s + it.qty * it.price, 0) - (o.discountAmount ?? 0);
      pushRef({
        id: `ref_o_${o.id}`,
        entityType: 'order',
        title: `سفارش ${o.id} · ${cust?.name ?? 'مشتری'}`,
        subtitle: `${formatToman(total)} · وضعیت: ${o.status}`,
        navPage: 'orders',
        targetId: o.id,
      });
    });
  }

  if (canViewSales && /سرنخ|لید|فروش|امتیاز|قیف/i.test(q)) {
    const topLeads = [...leads].sort((a, b) => b.score - a.score).slice(0, 2);
    topLeads.forEach((l) => {
      pushRef({
        id: `ref_l_${l.id}`,
        entityType: 'lead',
        title: `سرنخ: ${l.name}`,
        subtitle: `امتیاز ${toFa(l.score)} · ${formatToman(l.estimatedAmount)} · منبع: ${l.source}`,
        navPage: 'sales',
        targetId: l.id,
      });
    });
  }

  if (canViewAppointments && /نوبت|امروز|تقویم|غیبت|ویزیت/i.test(q)) {
    const todayIso = new Date().toISOString();
    const todayApts = appointments.filter((a) => isSameDay(a.start, todayIso));
    todayApts.slice(0, 2).forEach((a) => {
      const cust = customerMap.get(a.customerId);
      pushRef({
        id: `ref_a_${a.id}`,
        entityType: 'appointment',
        title: `نوبت ${cust?.name ?? 'مشتری'}`,
        subtitle: `${formatJalali(a.start, 'YYYY/MM/DD HH:mm')} · وضعیت: ${a.status}`,
        navPage: 'appointments',
        targetId: a.id,
      });
    });
  }

  if (kbArticles.length > 0) {
    const matchedKb = q
      ? kbArticles.filter((k) => fuzzyMatchPersian([k.title, k.body, k.category], q))
      : [];
    matchedKb.slice(0, 2).forEach((k) => {
      pushRef({
        id: `ref_kb_${k.id}`,
        entityType: 'kb',
        title: `راهنمای دانش: ${k.title}`,
        subtitle: `${k.category} · نسخه ${toFa(k.version ?? 1)}`,
        navPage: 'tickets',
        targetId: k.id,
      });
    });
  }

  const contextSummaryForPrompt: Record<string, unknown> = {
    businessName: state.settings.businessName,
    industryPack: state.settings.industryPack,
    rbacScope: effectiveScope,
    permissions: {
      customers: canViewCustomers,
      orders: canViewOrders,
      tickets: canViewTickets,
      sales: canViewSales,
      appointments: canViewAppointments,
    },
    counts: {
      customers: customers.length,
      orders: orders.length,
      overdueOrders: overdueOrders.length,
      openTickets: tickets.filter((t) => !isTicketClosedStatus(t.status)).length,
      slaRiskTickets: slaRiskTickets.length,
      leads: leads.length,
      appointments: appointments.length,
      kbArticles: kbArticles.length,
    },
    topCustomers: canViewCustomers
      ? vipCustomers.slice(0, 8).map((v) => ({
          id: v.customer.id,
          name: v.customer.name,
          lifecycle: v.customer.lifecycle ?? 'active',
          score: v.score,
          totalSpent: v.totalSpent,
          owner: v.customer.ownerName ?? '—',
          tags: v.customer.tags,
        }))
      : 'RESTRICTED_BY_RBAC',
    recentOrOverdueOrders: canViewOrders
      ? (overdueOrders.length > 0 ? overdueOrders : orders).slice(0, 8).map((o) => ({
          id: o.id,
          customerName: customerMap.get(o.customerId)?.name ?? 'مشتری',
          status: o.status,
          promisedAt: o.promisedAt,
          total: o.items.reduce((s, it) => s + it.qty * it.price, 0),
        }))
      : 'RESTRICTED_BY_RBAC',
    tickets: canViewTickets
      ? tickets.slice(0, 8).map((t) => ({
          id: t.id,
          trackingCode: t.trackingCode,
          subject: t.subject,
          status: t.status,
          priority: t.priority,
          category: t.category,
          assignee: t.assignee,
        }))
      : 'RESTRICTED_BY_RBAC',
    kbSnippets: kbArticles.slice(0, 5).map((k) => ({
      id: k.id,
      title: k.title,
      category: k.category,
      summary: k.body.slice(0, 220),
    })),
    leads: canViewSales
      ? [...leads]
          .sort((a, b) => b.score - a.score)
          .slice(0, 6)
          .map((l) => ({
            id: l.id,
            name: l.name,
            score: l.score,
            source: l.source,
            estimatedAmount: l.estimatedAmount,
            status: l.status,
          }))
      : 'RESTRICTED_BY_RBAC',
  };

  return {
    scopeLabel: effectiveScope,
    canViewCustomers,
    canViewOrders,
    canViewTickets,
    canViewSales,
    canViewAppointments,
    customers,
    orders,
    tickets,
    kbArticles,
    leads,
    appointments,
    vipCustomers,
    overdueOrders,
    slaRiskTickets,
    matchedReferences: refs,
    contextSummaryForPrompt,
  };
}
