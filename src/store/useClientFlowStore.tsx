import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createInitialState } from '../data/seed';
import type {
  AppState,
  Appointment,
  AppointmentStatus,
  AuditLogEntry,
  BusinessSettings,
  ContentItem,
  ContentStatus,
  Coupon,
  CustomFieldDef,
  Customer,
  Interaction,
  Invoice,
  KbArticle,
  NpsSurvey,
  Opportunity,
  Order,
  OrderStatus,
  PaymentMethod,
  PipelineStage,
  Product,
  Resource,
  Service,
  Task,
  Ticket,
  WorkflowInstance,
  WorkflowType,
} from '../types';
import { hasConflict, isValidIranMobile } from '../utils/overlap';

const STORAGE_KEY = 'clientflow_state_v2';

export type ToastMessage = {
  id: string;
  type: 'success' | 'error' | 'info';
  text: string;
};

export type PendingNpsPrompt = {
  customerId: string;
  refType: 'appointment' | 'order';
  refId: string;
  label: string;
};

function loadInitialState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialState();
    const parsed = JSON.parse(raw) as Partial<AppState>;
    const fallback = createInitialState();
    return {
      ...fallback,
      ...parsed,
      settings: {
        ...fallback.settings,
        ...(parsed.settings ?? {}),
      },
    };
  } catch {
    return createInitialState();
  }
}

type ClientFlowContextValue = {
  state: AppState;
  toasts: ToastMessage[];
  pendingNps: PendingNpsPrompt | null;
  dismissPendingNps: () => void;
  pushToast: (text: string, type?: ToastMessage['type']) => void;
  dismissToast: (id: string) => void;

  // Customers & Custom Fields & Dedup
  addCustomer: (data: Omit<Customer, 'id' | 'createdAt'>) => { ok: boolean; error?: string; customer?: Customer };
  updateCustomer: (id: string, data: Partial<Customer>) => { ok: boolean; error?: string };
  deleteCustomer: (id: string) => { ok: boolean; error?: string };
  mergeCustomers: (primaryId: string, duplicateId: string) => { ok: boolean; error?: string };
  importCustomersBatch: (items: Customer[]) => number;
  addInteraction: (customerId: string, channel: Interaction['channel'], text: string) => void;
  addCustomFieldDef: (def: Omit<CustomFieldDef, 'id'>) => void;
  removeCustomFieldDef: (id: string) => void;

  // Appointments + Services/Resources
  addAppointment: (data: Omit<Appointment, 'id'>) => { ok: boolean; error?: string };
  rescheduleAppointment: (
    id: string,
    patch: { start: string; end: string; resourceId: string },
  ) => { ok: boolean; error?: string };
  updateAppointmentStatus: (id: string, status: AppointmentStatus, cancelReason?: string) => void;
  addService: (s: Omit<Service, 'id'>) => void;
  addResource: (r: Omit<Resource, 'id'>) => void;

  // Orders, Shop, Invoices
  addOrder: (data: {
    customerId: string;
    items: { name: string; qty: number; price: number }[];
    promisedAt?: string;
    couponCode?: string;
  }) => { ok: boolean; error?: string };
  updateOrderStatus: (id: string, nextStatus: OrderStatus) => void;
  addProduct: (product: Omit<Product, 'id'>) => void;
  toggleCoupon: (id: string) => void;
  addCoupon: (coupon: Omit<Coupon, 'id' | 'usedCount'>) => void;
  createInvoiceForOrder: (orderId: string, method?: PaymentMethod) => void;
  recordInvoicePayment: (invoiceId: string, amount: number, method: PaymentMethod) => void;

  // Sales Pipeline
  addOpportunity: (data: Omit<Opportunity, 'id' | 'createdAt' | 'updatedAt'>) => { ok: boolean; error?: string };
  moveOpportunityStage: (id: string, stage: PipelineStage, lostReason?: string) => void;
  convertOpportunityToCustomer: (oppId: string) => void;

  // Workflows (BPMS)
  createWorkflowInstance: (data: {
    title: string;
    type: WorkflowType;
    customerId?: string;
    relatedRef?: string;
  }) => void;
  decideWorkflowStep: (id: string, decision: 'approved' | 'rejected', comment?: string) => { ok: boolean; error?: string };

  // Marketing Content Calendar
  addContentItem: (item: Omit<ContentItem, 'id' | 'reach' | 'leadsCount'>) => void;
  updateContentStatus: (id: string, status: ContentStatus) => void;

  // Tasks, Tickets, Knowledge Base
  addTask: (data: { title: string; customerId?: string; dueAt: string }) => void;
  toggleTaskDone: (id: string) => void;
  addTicket: (data: { customerId: string; subject: string; priority: Ticket['priority'] }) => void;
  updateTicket: (id: string, patch: Partial<Pick<Ticket, 'status' | 'priority' | 'replyNote'>>) => void;
  addKbArticle: (article: Omit<KbArticle, 'id' | 'helpfulCount' | 'updatedAt'>) => void;
  voteKbHelpful: (id: string) => void;

  // NPS
  submitNpsSurvey: (data: Omit<NpsSurvey, 'id' | 'createdAt'>) => void;
  triggerNpsPrompt: (prompt: PendingNpsPrompt) => void;

  // Automation
  toggleRule: (id: string) => void;
  runAutomationNow: (silent?: boolean) => number;
  clearOutbox: () => void;

  // Settings & System
  updateSettings: (patch: Partial<BusinessSettings>) => void;
  resetDemoData: () => void;
  exportStateJson: () => string;
  importStateJson: (raw: string) => { ok: boolean; error?: string };
};

const ClientFlowContext = createContext<ClientFlowContextValue | null>(null);

const STAGE_PROB: Record<PipelineStage, number> = {
  lead: 20,
  contacted: 35,
  proposal: 55,
  negotiation: 75,
  won: 100,
  lost: 0,
};

export function ClientFlowProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(() => loadInitialState());
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [pendingNps, setPendingNps] = useState<PendingNpsPrompt | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore quota errors
    }
  }, [state]);

  useEffect(() => {
    const root = document.documentElement;
    if (state.settings.darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [state.settings.darkMode]);

  const makeAudit = (
    entity: string,
    action: AuditLogEntry['action'],
    summary: string,
    role = stateRef.current.settings.role,
  ): AuditLogEntry => ({
    id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    actorRole: role,
    entity,
    action,
    summary,
    at: new Date().toISOString(),
  });

  const pushToast = useCallback((text: string, type: ToastMessage['type'] = 'success') => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, type, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const dismissPendingNps = useCallback(() => setPendingNps(null), []);
  const triggerNpsPrompt = useCallback((prompt: PendingNpsPrompt) => setPendingNps(prompt), []);

  const addCustomer = useCallback(
    (data: Omit<Customer, 'id' | 'createdAt'>) => {
      if (!data.name.trim()) return { ok: false, error: 'نام مشتری الزامی است.' };
      if (!isValidIranMobile(data.phone)) {
        return { ok: false, error: 'شماره موبایل معتبر نیست (فرمت صحیح: ۰۹xxxxxxxxx).' };
      }
      const customer: Customer = {
        ...data,
        id: `c_${Date.now()}`,
        createdAt: new Date().toISOString(),
      };
      setState((prev) => ({
        ...prev,
        customers: [customer, ...prev.customers],
        auditLogs: [makeAudit('مشتری', 'create', `مشتری «${customer.name}» ثبت شد.`), ...prev.auditLogs].slice(0, 100),
      }));
      pushToast(`مشتری «${customer.name}» ثبت شد.`);
      return { ok: true, customer };
    },
    [pushToast],
  );

  const updateCustomer = useCallback(
    (id: string, data: Partial<Customer>) => {
      if (data.phone !== undefined && !isValidIranMobile(data.phone)) {
        return { ok: false, error: 'شماره موبایل معتبر نیست (فرمت صحیح: ۰۹xxxxxxxxx).' };
      }
      setState((prev) => ({
        ...prev,
        customers: prev.customers.map((c) => (c.id === id ? { ...c, ...data } : c)),
        auditLogs: [makeAudit('مشتری', 'update', `اطلاعات مشتری ${data.name ?? id} ویرایش شد.`), ...prev.auditLogs].slice(0, 100),
      }));
      pushToast('اطلاعات مشتری به‌روزرسانی شد.');
      return { ok: true };
    },
    [pushToast],
  );

  const deleteCustomer = useCallback(
    (id: string) => {
      if (stateRef.current.settings.role !== 'admin') {
        pushToast('کارشناس مجاز به حذف مشتری نیست.', 'error');
        return { ok: false, error: 'کارشناس مجاز به حذف مشتری نیست.' };
      }
      const target = stateRef.current.customers.find((c) => c.id === id);
      setState((prev) => ({
        ...prev,
        customers: prev.customers.filter((c) => c.id !== id),
        auditLogs: [
          makeAudit('مشتری', 'delete', `مشتری «${target?.name ?? id}» حذف شد.`),
          ...prev.auditLogs,
        ].slice(0, 100),
      }));
      pushToast('مشتری حذف شد.', 'info');
      return { ok: true };
    },
    [pushToast],
  );

  const mergeCustomers = useCallback(
    (primaryId: string, duplicateId: string) => {
      if (stateRef.current.settings.role !== 'admin') {
        return { ok: false, error: 'ادغام پرونده مشتریان فقط برای مدیر مجاز است.' };
      }
      if (primaryId === duplicateId) return { ok: false, error: 'مشتری مبدأ و مقصد یکسان است.' };
      const primary = stateRef.current.customers.find((c) => c.id === primaryId);
      const dup = stateRef.current.customers.find((c) => c.id === duplicateId);
      if (!primary || !dup) return { ok: false, error: 'رکورد مشتری یافت نشد.' };

      const mergedTags = Array.from(new Set([...primary.tags, ...dup.tags]));
      setState((prev) => ({
        ...prev,
        customers: prev.customers
          .filter((c) => c.id !== duplicateId)
          .map((c) =>
            c.id === primaryId
              ? {
                  ...c,
                  tags: mergedTags,
                  email: c.email || dup.email,
                  notes: [c.notes, dup.notes].filter(Boolean).join(' | ') || undefined,
                }
              : c,
          ),
        interactions: prev.interactions.map((i) =>
          i.customerId === duplicateId ? { ...i, customerId: primaryId } : i,
        ),
        appointments: prev.appointments.map((a) =>
          a.customerId === duplicateId ? { ...a, customerId: primaryId } : a,
        ),
        orders: prev.orders.map((o) =>
          o.customerId === duplicateId ? { ...o, customerId: primaryId } : o,
        ),
        invoices: prev.invoices.map((inv) =>
          inv.customerId === duplicateId ? { ...inv, customerId: primaryId } : inv,
        ),
        tickets: prev.tickets.map((t) =>
          t.customerId === duplicateId ? { ...t, customerId: primaryId } : t,
        ),
        tasks: prev.tasks.map((t) =>
          t.customerId === duplicateId ? { ...t, customerId: primaryId } : t,
        ),
        npsSurveys: prev.npsSurveys.map((n) =>
          n.customerId === duplicateId ? { ...n, customerId: primaryId } : n,
        ),
        auditLogs: [
          makeAudit('مشتری', 'merge', `پرونده «${dup.name}» در «${primary.name}» ادغام شد.`),
          ...prev.auditLogs,
        ].slice(0, 100),
      }));
      pushToast(`پرونده «${dup.name}» با «${primary.name}» ادغام شد.`);
      return { ok: true };
    },
    [pushToast],
  );

  const importCustomersBatch = useCallback(
    (items: Customer[]) => {
      if (items.length === 0) return 0;
      setState((prev) => ({
        ...prev,
        customers: [...items, ...prev.customers],
        auditLogs: [
          makeAudit('مشتری', 'create', `${items.length} مشتری از فایل CSV وارد شد.`),
          ...prev.auditLogs,
        ].slice(0, 100),
      }));
      pushToast(`${items.length} مشتری از فایل CSV وارد شد.`);
      return items.length;
    },
    [pushToast],
  );

  const addInteraction = useCallback(
    (customerId: string, channel: Interaction['channel'], text: string) => {
      if (!text.trim()) return;
      const item: Interaction = {
        id: `int_${Date.now()}`,
        customerId,
        channel,
        text: text.trim(),
        at: new Date().toISOString(),
      };
      setState((prev) => ({
        ...prev,
        interactions: [item, ...prev.interactions],
      }));
      pushToast('تعامل جدید در پرونده مشتری ثبت شد.');
    },
    [pushToast],
  );

  const addCustomFieldDef = useCallback(
    (def: Omit<CustomFieldDef, 'id'>) => {
      setState((prev) => ({
        ...prev,
        customFieldDefs: [...prev.customFieldDefs, { ...def, id: `cf_${Date.now()}` }],
        auditLogs: [makeAudit('پیکربندی', 'create', `فیلد سفارشی «${def.label}» اضافه شد.`), ...prev.auditLogs].slice(0, 100),
      }));
      pushToast(`فیلد سفارشی «${def.label}» اضافه شد.`);
    },
    [pushToast],
  );

  const removeCustomFieldDef = useCallback(
    (id: string) => {
      setState((prev) => ({
        ...prev,
        customFieldDefs: prev.customFieldDefs.filter((f) => f.id !== id),
      }));
      pushToast('فیلد سفارشی حذف شد.', 'info');
    },
    [pushToast],
  );

  const addAppointment = useCallback(
    (data: Omit<Appointment, 'id'>) => {
      if (new Date(data.end) <= new Date(data.start)) {
        return { ok: false, error: 'ساعت پایان باید بعد از ساعت شروع باشد.' };
      }
      if (hasConflict(stateRef.current.appointments, data)) {
        return {
          ok: false,
          error: 'تداخل زمانی! این منبع در بازه انتخاب‌شده نوبت فعال دیگری دارد.',
        };
      }
      const apt: Appointment = { ...data, id: `a_${Date.now()}` };
      setState((prev) => ({
        ...prev,
        appointments: [apt, ...prev.appointments],
        auditLogs: [makeAudit('نوبت', 'create', `نوبت جدید ${apt.id} ثبت شد.`), ...prev.auditLogs].slice(0, 100),
      }));
      pushToast('نوبت جدید با موفقیت ثبت شد.');
      return { ok: true };
    },
    [pushToast],
  );

  const rescheduleAppointment = useCallback(
    (id: string, patch: { start: string; end: string; resourceId: string }) => {
      if (new Date(patch.end) <= new Date(patch.start)) {
        return { ok: false, error: 'ساعت پایان باید بعد از ساعت شروع باشد.' };
      }
      if (hasConflict(stateRef.current.appointments, { ...patch, id })) {
        return {
          ok: false,
          error: 'تداخل زمانی! منبع انتخاب‌شده در این ساعت نوبت دیگری دارد.',
        };
      }
      setState((prev) => ({
        ...prev,
        appointments: prev.appointments.map((a) => (a.id === id ? { ...a, ...patch } : a)),
        auditLogs: [makeAudit('نوبت', 'update', `زمان نوبت ${id} تغییر کرد.`), ...prev.auditLogs].slice(0, 100),
      }));
      pushToast('زمان نوبت جابه‌جا شد.');
      return { ok: true };
    },
    [pushToast],
  );

  const updateAppointmentStatus = useCallback(
    (id: string, status: AppointmentStatus, cancelReason?: string) => {
      const target = stateRef.current.appointments.find((a) => a.id === id);
      if (!target) return;
      const customer = stateRef.current.customers.find((c) => c.id === target.customerId);
      const nowIso = new Date().toISOString();

      const autoSms =
        status === 'confirmed' && customer && customer.consentSms !== false
          ? {
              id: `msg_apt_${Date.now()}`,
              to: customer.phone,
              customerName: customer.name,
              body: `${customer.name} عزیز، نوبت شما در ${stateRef.current.settings.businessName} تأیید شد.`,
              channel: 'sms' as const,
              ruleName: 'تأیید خودکار نوبت',
              at: nowIso,
            }
          : null;

      setState((prev) => ({
        ...prev,
        appointments: prev.appointments.map((a) =>
          a.id === id ? { ...a, status, cancelReason: cancelReason ?? a.cancelReason } : a,
        ),
        outbox: autoSms ? [autoSms, ...prev.outbox] : prev.outbox,
      }));
      pushToast('وضعیت نوبت به‌روزرسانی شد.');
      if (status === 'done' && customer) {
        const alreadyRated = stateRef.current.npsSurveys.some(
          (n) => n.refType === 'appointment' && n.refId === id,
        );
        if (!alreadyRated) {
          setPendingNps({
            customerId: customer.id,
            refType: 'appointment',
            refId: id,
            label: `نوبت انجام‌شده برای ${customer.name}`,
          });
        }
      }
    },
    [pushToast],
  );

  const addService = useCallback(
    (s: Omit<Service, 'id'>) => {
      setState((prev) => ({
        ...prev,
        services: [...prev.services, { ...s, id: `s_${Date.now()}` }],
      }));
      pushToast(`خدمت «${s.name}» اضافه شد.`);
    },
    [pushToast],
  );

  const addResource = useCallback(
    (r: Omit<Resource, 'id'>) => {
      setState((prev) => ({
        ...prev,
        resources: [...prev.resources, { ...r, id: `r_${Date.now()}` }],
      }));
      pushToast(`منبع «${r.name}» اضافه شد.`);
    },
    [pushToast],
  );

  const addOrder = useCallback(
    (data: {
      customerId: string;
      items: { name: string; qty: number; price: number }[];
      promisedAt?: string;
      couponCode?: string;
    }) => {
      if (!data.customerId || data.items.length === 0) {
        return { ok: false, error: 'مشتری و حداقل یک قلم کالا الزامی است.' };
      }
      const subtotal = data.items.reduce((sum, it) => sum + it.qty * it.price, 0);
      let discountAmount = 0;
      let validCoupon: string | undefined;

      if (data.couponCode?.trim()) {
        const codeUpper = data.couponCode.trim().toUpperCase();
        const coupon = stateRef.current.coupons.find(
          (c) => c.code === codeUpper && c.active && c.usedCount < c.maxUses,
        );
        if (!coupon) {
          return { ok: false, error: 'کد تخفیف معتبر نیست یا منقضی شده است.' };
        }
        discountAmount = Math.round((subtotal * coupon.discountPct) / 100);
        validCoupon = coupon.code;
      }

      const nowIso = new Date().toISOString();
      const order: Order = {
        id: `o_${Date.now()}`,
        customerId: data.customerId,
        items: data.items,
        status: 'new',
        createdAt: nowIso,
        updatedAt: nowIso,
        promisedAt: data.promisedAt,
        couponCode: validCoupon,
        discountAmount,
      };

      setState((prev) => ({
        ...prev,
        orders: [order, ...prev.orders],
        orderLogs: [
          { id: `ol_${Date.now()}`, orderId: order.id, from: 'ایجاد', to: 'new', at: nowIso },
          ...prev.orderLogs,
        ],
        coupons: validCoupon
          ? prev.coupons.map((c) => (c.code === validCoupon ? { ...c, usedCount: c.usedCount + 1 } : c))
          : prev.coupons,
        auditLogs: [makeAudit('سفارش', 'create', `سفارش ${order.id} ثبت شد.`), ...prev.auditLogs].slice(0, 100),
      }));
      pushToast('سفارش جدید ثبت شد.');
      return { ok: true };
    },
    [pushToast],
  );

  const updateOrderStatus = useCallback(
    (id: string, nextStatus: OrderStatus) => {
      const target = stateRef.current.orders.find((o) => o.id === id);
      if (!target || target.status === nextStatus) return;
      const nowIso = new Date().toISOString();
      const customer = stateRef.current.customers.find((c) => c.id === target.customerId);

      const statusMsgMap: Partial<Record<OrderStatus, string>> = {
        confirmed: 'سفارش شما تأیید شد و در صف آماده‌سازی قرار گرفت.',
        shipped: 'سفارش شما ارسال شد و به‌زودی به دستتان می‌رسد.',
        delivered: 'سفارش شما تحویل داده شد. از خرید شما سپاسگزاریم!',
      };

      const smsBody = statusMsgMap[nextStatus];
      const autoSms =
        smsBody && customer && customer.consentSms !== false
          ? {
              id: `msg_ord_${Date.now()}`,
              to: customer.phone,
              customerName: customer.name,
              body: `${customer.name} عزیز، ${smsBody}`,
              channel: 'sms' as const,
              ruleName: 'اطلاع‌رسانی وضعیت سفارش',
              at: nowIso,
            }
          : null;

      setState((prev) => ({
        ...prev,
        orders: prev.orders.map((o) =>
          o.id === id ? { ...o, status: nextStatus, updatedAt: nowIso } : o,
        ),
        orderLogs: [
          { id: `ol_${Date.now()}`, orderId: id, from: target.status, to: nextStatus, at: nowIso },
          ...prev.orderLogs,
        ],
        outbox: autoSms ? [autoSms, ...prev.outbox] : prev.outbox,
        auditLogs: [
          makeAudit('سفارش', 'update', `وضعیت سفارش ${id} از ${target.status} به ${nextStatus} تغییر کرد.`),
          ...prev.auditLogs,
        ].slice(0, 100),
      }));
      pushToast('وضعیت سفارش تغییر کرد.');

      if (nextStatus === 'delivered' && customer) {
        const alreadyRated = stateRef.current.npsSurveys.some(
          (n) => n.refType === 'order' && n.refId === id,
        );
        if (!alreadyRated) {
          setPendingNps({
            customerId: customer.id,
            refType: 'order',
            refId: id,
            label: `سفارش تحویل‌شده به ${customer.name}`,
          });
        }
      }
    },
    [pushToast],
  );

  const addProduct = useCallback(
    (product: Omit<Product, 'id'>) => {
      setState((prev) => ({
        ...prev,
        products: [{ ...product, id: `p_${Date.now()}` }, ...prev.products],
      }));
      pushToast(`محصول «${product.name}» افزوده شد.`);
    },
    [pushToast],
  );

  const toggleCoupon = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      coupons: prev.coupons.map((c) => (c.id === id ? { ...c, active: !c.active } : c)),
    }));
  }, []);

  const addCoupon = useCallback(
    (coupon: Omit<Coupon, 'id' | 'usedCount'>) => {
      setState((prev) => ({
        ...prev,
        coupons: [
          { ...coupon, code: coupon.code.toUpperCase(), id: `cp_${Date.now()}`, usedCount: 0 },
          ...prev.coupons,
        ],
      }));
      pushToast(`کد تخفیف ${coupon.code.toUpperCase()} ثبت شد.`);
    },
    [pushToast],
  );

  const createInvoiceForOrder = useCallback(
    (orderId: string, method: PaymentMethod = 'online') => {
      const existing = stateRef.current.invoices.find((inv) => inv.orderId === orderId);
      if (existing) {
        pushToast(`برای این سفارش قبلاً فاکتور ${existing.invoiceNo} صادر شده است.`, 'info');
        return;
      }
      const order = stateRef.current.orders.find((o) => o.id === orderId);
      if (!order) return;
      const subtotal = order.items.reduce((s, it) => s + it.qty * it.price, 0);
      const discount = order.discountAmount ?? 0;
      const tax = Math.round((subtotal - discount) * 0.1);
      const grandTotal = subtotal - discount + tax;
      const nowIso = new Date().toISOString();
      const inv: Invoice = {
        id: `inv_${Date.now()}`,
        invoiceNo: `INV-1405-${1001 + stateRef.current.invoices.length}`,
        orderId,
        customerId: order.customerId,
        subtotal,
        discount,
        tax,
        grandTotal,
        paidAmount: 0,
        method,
        status: 'issued',
        issuedAt: nowIso,
        dueAt: order.promisedAt ?? new Date(Date.now() + 48 * 3600_000).toISOString(),
      };
      setState((prev) => ({
        ...prev,
        invoices: [inv, ...prev.invoices],
        auditLogs: [makeAudit('مالی', 'create', `فاکتور ${inv.invoiceNo} صادر شد.`), ...prev.auditLogs].slice(0, 100),
      }));
      pushToast(`فاکتور ${inv.invoiceNo} صادر شد.`);
    },
    [pushToast],
  );

  const recordInvoicePayment = useCallback(
    (invoiceId: string, amount: number, method: PaymentMethod) => {
      if (amount <= 0) return;
      setState((prev) => ({
        ...prev,
        invoices: prev.invoices.map((inv) => {
          if (inv.id !== invoiceId) return inv;
          const nextPaid = Math.min(inv.grandTotal, inv.paidAmount + amount);
          return {
            ...inv,
            paidAmount: nextPaid,
            method,
            status: nextPaid >= inv.grandTotal ? 'paid' : 'partial',
          };
        }),
        auditLogs: [makeAudit('مالی', 'update', `پرداخت مبلغ برای فاکتور ثبت شد.`), ...prev.auditLogs].slice(0, 100),
      }));
      pushToast('پرداخت فاکتور ثبت شد.');
    },
    [pushToast],
  );

  const addOpportunity = useCallback(
    (data: Omit<Opportunity, 'id' | 'createdAt' | 'updatedAt'>) => {
      if (!data.title.trim() || !data.contactName.trim()) {
        return { ok: false, error: 'عنوان فرصت و نام مخاطب الزامی است.' };
      }
      if (!isValidIranMobile(data.phone)) {
        return { ok: false, error: 'شماره موبایل معتبر نیست (فرمت صحیح: ۰۹xxxxxxxxx).' };
      }
      const nowIso = new Date().toISOString();
      const opp: Opportunity = {
        ...data,
        id: `opp_${Date.now()}`,
        probability: STAGE_PROB[data.stage],
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      setState((prev) => ({
        ...prev,
        opportunities: [opp, ...prev.opportunities],
        auditLogs: [makeAudit('فروش', 'create', `فرصت فروش «${opp.title}» ثبت شد.`), ...prev.auditLogs].slice(0, 100),
      }));
      pushToast('فرصت فروش جدید در قیف ثبت شد.');
      return { ok: true };
    },
    [pushToast],
  );

  const moveOpportunityStage = useCallback(
    (id: string, stage: PipelineStage, lostReason?: string) => {
      setState((prev) => ({
        ...prev,
        opportunities: prev.opportunities.map((o) =>
          o.id === id
            ? {
                ...o,
                stage,
                probability: STAGE_PROB[stage],
                lostReason: stage === 'lost' ? lostReason : o.lostReason,
                updatedAt: new Date().toISOString(),
              }
            : o,
        ),
      }));
      pushToast('مرحله فرصت فروش به‌روزرسانی شد.');
    },
    [pushToast],
  );

  const convertOpportunityToCustomer = useCallback(
    (oppId: string) => {
      const opp = stateRef.current.opportunities.find((o) => o.id === oppId);
      if (!opp) return;
      const existing = stateRef.current.customers.find((c) => c.phone === opp.phone);
      if (existing) {
        setState((prev) => ({
          ...prev,
          opportunities: prev.opportunities.map((o) =>
            o.id === oppId ? { ...o, customerId: existing.id } : o,
          ),
        }));
        pushToast(`فرصت به مشتری موجود «${existing.name}» متصل شد.`, 'info');
        return;
      }
      const newCust: Customer = {
        id: `c_conv_${Date.now()}`,
        name: opp.contactName,
        phone: opp.phone,
        tags: ['فروش', 'جدید'],
        source: opp.source,
        createdAt: new Date().toISOString(),
      };
      setState((prev) => ({
        ...prev,
        customers: [newCust, ...prev.customers],
        opportunities: prev.opportunities.map((o) =>
          o.id === oppId ? { ...o, customerId: newCust.id } : o,
        ),
        auditLogs: [makeAudit('فروش', 'create', `سرنخ «${opp.contactName}» به مشتری تبدیل شد.`), ...prev.auditLogs].slice(0, 100),
      }));
      pushToast(`«${newCust.name}» به لیست مشتریان اضافه شد.`);
    },
    [pushToast],
  );

  const createWorkflowInstance = useCallback(
    (data: { title: string; type: WorkflowType; customerId?: string; relatedRef?: string }) => {
      const templateSteps: Record<WorkflowType, WorkflowInstance['steps']> = {
        discount_approval: [
          { name: 'بررسی درخواست و توجیه کارشناس', role: 'staff', status: 'pending' },
          { name: 'تأیید نهایی مدیر (تخفیف > ۲۰٪)', role: 'admin', status: 'pending' },
        ],
        order_return: [
          { name: 'بررسی دلیل مرجوعی و سلامت کالا', role: 'staff', status: 'pending' },
          { name: 'تأیید استرداد / جایگزینی توسط مدیر', role: 'admin', status: 'pending' },
        ],
        vip_schedule: [
          { name: 'هماهنگی زمان ویژه با پذیرش', role: 'staff', status: 'pending' },
          { name: 'تأیید سرپرست کلینیک', role: 'admin', status: 'pending' },
        ],
        complaint: [
          { name: 'ریشه‌یابی و تماس با مشتری', role: 'staff', status: 'pending' },
          { name: 'بستن نهایی و تأیید مدیر پشتیبانی', role: 'admin', status: 'pending' },
        ],
      };

      const wf: WorkflowInstance = {
        id: `wf_${Date.now()}`,
        title: data.title.trim(),
        type: data.type,
        customerId: data.customerId || undefined,
        relatedRef: data.relatedRef || undefined,
        currentStepIndex: 0,
        steps: templateSteps[data.type],
        status: 'running',
        createdAt: new Date().toISOString(),
        slaHours: 24,
      };
      setState((prev) => ({
        ...prev,
        workflows: [wf, ...prev.workflows],
        auditLogs: [makeAudit('گردش کار', 'create', `فرایند «${wf.title}» آغاز شد.`), ...prev.auditLogs].slice(0, 100),
      }));
      pushToast('فرایند گردش کار جدید آغاز شد.');
    },
    [pushToast],
  );

  const decideWorkflowStep = useCallback(
    (id: string, decision: 'approved' | 'rejected', comment?: string) => {
      const wf = stateRef.current.workflows.find((w) => w.id === id);
      if (!wf || wf.status !== 'running') return { ok: false, error: 'فرایند فعال نیست.' };
      const step = wf.steps[wf.currentStepIndex];
      if (!step) return { ok: false, error: 'مرحله معتبر نیست.' };

      const curRole = stateRef.current.settings.role;
      if (step.role === 'admin' && curRole !== 'admin') {
        pushToast('این مرحله نیازمند تأیید مدیر سیستم (Admin) است.', 'error');
        return { ok: false, error: 'این مرحله نیازمند تأیید مدیر سیستم (Admin) است.' };
      }

      const nowIso = new Date().toISOString();
      const updatedSteps = wf.steps.map((s, idx) =>
        idx === wf.currentStepIndex
          ? {
              ...s,
              status: decision,
              actor: curRole === 'admin' ? 'مدیر سیستم' : 'کارشناس',
              comment: comment?.trim() || undefined,
              at: nowIso,
            }
          : s,
      );

      const isLast = wf.currentStepIndex >= wf.steps.length - 1;
      const nextStatus: WorkflowInstance['status'] =
        decision === 'rejected' ? 'rejected' : isLast ? 'approved' : 'running';
      const nextIndex = decision === 'approved' && !isLast ? wf.currentStepIndex + 1 : wf.currentStepIndex;

      setState((prev) => ({
        ...prev,
        workflows: prev.workflows.map((w) =>
          w.id === id
            ? { ...w, steps: updatedSteps, status: nextStatus, currentStepIndex: nextIndex }
            : w,
        ),
        auditLogs: [
          makeAudit(
            'گردش کار',
            'approve',
            `مرحله «${step.name}» در فرایند «${wf.title}» ${decision === 'approved' ? 'تأیید' : 'رد'} شد.`,
          ),
          ...prev.auditLogs,
        ].slice(0, 100),
      }));
      pushToast(decision === 'approved' ? 'مرحله گردش کار تأیید شد.' : 'فرایند رد شد.', decision === 'approved' ? 'success' : 'info');
      return { ok: true };
    },
    [pushToast],
  );

  const addContentItem = useCallback(
    (item: Omit<ContentItem, 'id' | 'reach' | 'leadsCount'>) => {
      const created: ContentItem = {
        ...item,
        id: `cnt_${Date.now()}`,
        reach: 0,
        leadsCount: 0,
      };
      setState((prev) => ({
        ...prev,
        contentItems: [created, ...prev.contentItems],
      }));
      pushToast(`محتوای «${created.title}» به تقویم اضافه شد.`);
    },
    [pushToast],
  );

  const updateContentStatus = useCallback(
    (id: string, status: ContentStatus) => {
      setState((prev) => ({
        ...prev,
        contentItems: prev.contentItems.map((c) => (c.id === id ? { ...c, status } : c)),
      }));
      pushToast('وضعیت محتوا تغییر کرد.');
    },
    [pushToast],
  );

  const addTask = useCallback(
    (data: { title: string; customerId?: string; dueAt: string }) => {
      if (!data.title.trim()) return;
      const task: Task = {
        id: `t_${Date.now()}`,
        title: data.title.trim(),
        customerId: data.customerId || undefined,
        dueAt: data.dueAt,
        done: false,
      };
      setState((prev) => ({ ...prev, tasks: [task, ...prev.tasks] }));
      pushToast('پیگیری جدید ثبت شد.');
    },
    [pushToast],
  );

  const toggleTaskDone = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
    }));
  }, []);

  const addTicket = useCallback(
    (data: { customerId: string; subject: string; priority: Ticket['priority'] }) => {
      if (!data.subject.trim()) return;
      const ticket: Ticket = {
        id: `k_${Date.now()}`,
        customerId: data.customerId,
        subject: data.subject.trim(),
        priority: data.priority,
        status: 'open',
        createdAt: new Date().toISOString(),
      };
      setState((prev) => ({ ...prev, tickets: [ticket, ...prev.tickets] }));
      pushToast('تیکت جدید ثبت شد.');
    },
    [pushToast],
  );

  const updateTicket = useCallback(
    (id: string, patch: Partial<Pick<Ticket, 'status' | 'priority' | 'replyNote'>>) => {
      setState((prev) => ({
        ...prev,
        tickets: prev.tickets.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      }));
      pushToast('تیکت به‌روزرسانی شد.');
    },
    [pushToast],
  );

  const addKbArticle = useCallback(
    (article: Omit<KbArticle, 'id' | 'helpfulCount' | 'updatedAt'>) => {
      setState((prev) => ({
        ...prev,
        kbArticles: [
          {
            ...article,
            id: `kb_${Date.now()}`,
            helpfulCount: 0,
            updatedAt: new Date().toISOString(),
          },
          ...prev.kbArticles,
        ],
      }));
      pushToast(`مقاله «${article.title}» در پایگاه دانش ثبت شد.`);
    },
    [pushToast],
  );

  const voteKbHelpful = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      kbArticles: prev.kbArticles.map((k) =>
        k.id === id ? { ...k, helpfulCount: k.helpfulCount + 1 } : k,
      ),
    }));
  }, []);

  const submitNpsSurvey = useCallback(
    (data: Omit<NpsSurvey, 'id' | 'createdAt'>) => {
      const survey: NpsSurvey = {
        ...data,
        id: `nps_${Date.now()}`,
        createdAt: new Date().toISOString(),
      };
      setState((prev) => ({
        ...prev,
        npsSurveys: [survey, ...prev.npsSurveys],
      }));
      setPendingNps(null);
      pushToast('نظرسنجی رضایت مشتری ثبت شد.');
    },
    [pushToast],
  );

  const toggleRule = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      rules: prev.rules.map((r) => (r.id === id ? { ...r, active: !r.active } : r)),
    }));
  }, []);

  const runAutomationNow = useCallback(
    (silent = false) => {
      const cur = stateRef.current;
      const nowMs = Date.now();
      const processed = new Set(cur.processedRuleKeys);
      const newOutbox: AppState['outbox'] = [];
      const newTasks: Task[] = [];
      const newLogs: AppState['automationLogs'] = [];
      const nowIso = new Date().toISOString();

      const activeRules = cur.rules.filter(
        (r) =>
          r.active &&
          (!r.pack || r.pack === 'all' || r.pack === cur.settings.industryPack),
      );

      for (const rule of activeRules) {
        if (rule.id === 'u1') {
          let count = 0;
          for (const apt of cur.appointments) {
            if (apt.status !== 'confirmed') continue;
            const diffH = (new Date(apt.start).getTime() - nowMs) / 3600_000;
            const key = `u1_${apt.id}`;
            if (diffH >= 20 && diffH <= 28 && !processed.has(key)) {
              const cust = cur.customers.find((c) => c.id === apt.customerId);
              if (cust && cust.consentSms !== false) {
                processed.add(key);
                count++;
                newOutbox.push({
                  id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                  to: cust.phone,
                  customerName: cust.name,
                  body: `${cust.name} عزیز، یادآوری نوبت تأییدشده شما در ${cur.settings.businessName} برای ۲۴ ساعت آینده ثبت شده است.`,
                  channel: 'sms',
                  ruleName: rule.name,
                  at: nowIso,
                });
              }
            }
          }
          if (count > 0) {
            newLogs.push({
              id: `al_${Date.now()}_u1`,
              ruleId: rule.id,
              ruleName: rule.name,
              summary: `${count} پیامک یادآوری نوبت در صندوق ارسال ثبت شد.`,
              at: nowIso,
            });
          }
        }

        if (rule.id === 'u2') {
          let count = 0;
          for (const ord of cur.orders) {
            if (ord.status !== 'new' && ord.status !== 'confirmed') continue;
            const refIso = ord.updatedAt || ord.createdAt;
            const ageH = (nowMs - new Date(refIso).getTime()) / 3600_000;
            const key = `u2_${ord.id}`;
            if (ageH >= 48 && !processed.has(key)) {
              processed.add(key);
              count++;
              const cust = cur.customers.find((c) => c.id === ord.customerId);
              newTasks.push({
                id: `t_auto_${Date.now()}_${count}`,
                title: `پیگیری خودکار سفارش ${ord.id} (${cust?.name ?? 'مشتری'}) — بیش از ۴۸ ساعت بدون تغییر`,
                customerId: ord.customerId,
                dueAt: nowIso,
                done: false,
                createdByRuleId: rule.id,
              });
            }
          }
          if (count > 0) {
            newLogs.push({
              id: `al_${Date.now()}_u2`,
              ruleId: rule.id,
              ruleName: rule.name,
              summary: `${count} وظیفه پیگیری برای سفارش‌های معطل ایجاد شد.`,
              at: nowIso,
            });
          }
        }

        if (rule.id === 'u3') {
          let count = 0;
          for (const apt of cur.appointments) {
            if (apt.status !== 'done') continue;
            const ageH = (nowMs - new Date(apt.end).getTime()) / 3600_000;
            const key = `u3_${apt.id}`;
            if (ageH >= 72 && !processed.has(key) && count < 2) {
              processed.add(key);
              count++;
              const cust = cur.customers.find((c) => c.id === apt.customerId);
              if (cust) {
                newTasks.push({
                  id: `t_auto_${Date.now()}_u3_${count}`,
                  title: `دعوت به ویزیت کنترل برای ${cust.name}`,
                  customerId: cust.id,
                  dueAt: new Date(nowMs + 24 * 3600_000).toISOString(),
                  done: false,
                  createdByRuleId: rule.id,
                });
                if (cust.consentSms !== false) {
                  newOutbox.push({
                    id: `msg_${Date.now()}_u3_${count}`,
                    to: cust.phone,
                    customerName: cust.name,
                    body: `${cust.name} گرامی، جهت رزرو ویزیت کنترل خود در ${cur.settings.businessName} با ما در ارتباط باشید.`,
                    channel: 'sms',
                    ruleName: rule.name,
                    at: nowIso,
                  });
                }
              }
            }
          }
          if (count > 0) {
            newLogs.push({
              id: `al_${Date.now()}_u3`,
              ruleId: rule.id,
              ruleName: rule.name,
              summary: `${count} پیگیری ویزیت کنترل و پیامک ثبت شد.`,
              at: nowIso,
            });
          }
        }

        if (rule.id === 'u4') {
          let count = 0;
          for (const ord of cur.orders) {
            if (ord.status !== 'new') continue;
            const ageH = (nowMs - new Date(ord.createdAt).getTime()) / 3600_000;
            const key = `u4_${ord.id}`;
            if (ageH >= 12 && !processed.has(key) && count < 2) {
              processed.add(key);
              count++;
              const cust = cur.customers.find((c) => c.id === ord.customerId);
              if (cust && cust.consentSms !== false) {
                newOutbox.push({
                  id: `msg_${Date.now()}_u4_${count}`,
                  to: cust.phone,
                  customerName: cust.name,
                  body: `${cust.name} عزیز، سفارش شما در ${cur.settings.businessName} در انتظار تأیید نهایی است.`,
                  channel: 'sms',
                  ruleName: rule.name,
                  at: nowIso,
                });
              }
            }
          }
          if (count > 0) {
            newLogs.push({
              id: `al_${Date.now()}_u4`,
              ruleId: rule.id,
              ruleName: rule.name,
              summary: `${count} پیامک یادآوری سفارش رهاشده ارسال شد.`,
              at: nowIso,
            });
          }
        }
      }

      const totalActions = newOutbox.length + newTasks.length;
      if (totalActions > 0) {
        setState((prev) => ({
          ...prev,
          outbox: [...newOutbox, ...prev.outbox],
          tasks: [...newTasks, ...prev.tasks],
          automationLogs: [...newLogs, ...prev.automationLogs],
          processedRuleKeys: Array.from(processed),
        }));
        if (!silent) {
          pushToast(`موتور اتوماسیون اجرا شد: ${newOutbox.length} پیامک و ${newTasks.length} وظیفه ثبت شد.`);
        }
      } else if (!silent) {
        pushToast('قوانین بررسی شدند؛ مورد جدیدی برای اجرا وجود نداشت.', 'info');
      }

      return totalActions;
    },
    [pushToast],
  );

  useEffect(() => {
    const initialTimer = setTimeout(() => {
      runAutomationNow(true);
    }, 3500);
    const interval = setInterval(() => {
      runAutomationNow(true);
    }, 30_000);
    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [runAutomationNow]);

  const clearOutbox = useCallback(() => {
    setState((prev) => ({ ...prev, outbox: [] }));
    pushToast('صندوق پیامک‌های شبیه‌سازی‌شده پاک شد.', 'info');
  }, [pushToast]);

  const updateSettings = useCallback(
    (patch: Partial<BusinessSettings>) => {
      setState((prev) => ({
        ...prev,
        settings: { ...prev.settings, ...patch },
        auditLogs: [makeAudit('تنظیمات', 'update', 'تنظیمات سیستم به‌روزرسانی شد.'), ...prev.auditLogs].slice(0, 100),
      }));
      pushToast('تنظیمات ذخیره شد.');
    },
    [pushToast],
  );

  const resetDemoData = useCallback(() => {
    const fresh = createInitialState();
    setState(fresh);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
    pushToast('داده‌های نمونه به حالت اولیه بازنشانی شدند.', 'info');
  }, [pushToast]);

  const exportStateJson = useCallback(() => {
    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        schemaVersion: '2.0',
        data: stateRef.current,
      },
      null,
      2,
    );
  }, []);

  const importStateJson = useCallback(
    (raw: string) => {
      try {
        const parsed = JSON.parse(raw) as { data?: Partial<AppState> } & Partial<AppState>;
        const payload = parsed.data ?? parsed;
        if (!payload || !Array.isArray(payload.customers)) {
          return { ok: false, error: 'ساختار فایل JSON معتبر نیست.' };
        }
        const fallback = createInitialState();
        const next: AppState = {
          ...fallback,
          ...payload,
          settings: { ...fallback.settings, ...(payload.settings ?? {}) },
        };
        setState(next);
        pushToast('پشتیبان JSON با موفقیت بازیابی شد.');
        return { ok: true };
      } catch {
        return { ok: false, error: 'فایل JSON قابل خواندن نیست.' };
      }
    },
    [pushToast],
  );

  return (
    <ClientFlowContext.Provider
      value={{
        state,
        toasts,
        pendingNps,
        dismissPendingNps,
        pushToast,
        dismissToast,
        addCustomer,
        updateCustomer,
        deleteCustomer,
        mergeCustomers,
        importCustomersBatch,
        addInteraction,
        addCustomFieldDef,
        removeCustomFieldDef,
        addAppointment,
        rescheduleAppointment,
        updateAppointmentStatus,
        addService,
        addResource,
        addOrder,
        updateOrderStatus,
        addProduct,
        toggleCoupon,
        addCoupon,
        createInvoiceForOrder,
        recordInvoicePayment,
        addOpportunity,
        moveOpportunityStage,
        convertOpportunityToCustomer,
        createWorkflowInstance,
        decideWorkflowStep,
        addContentItem,
        updateContentStatus,
        addTask,
        toggleTaskDone,
        addTicket,
        updateTicket,
        addKbArticle,
        voteKbHelpful,
        submitNpsSurvey,
        triggerNpsPrompt,
        toggleRule,
        runAutomationNow,
        clearOutbox,
        updateSettings,
        resetDemoData,
        exportStateJson,
        importStateJson,
      }}
    >
      {children}
    </ClientFlowContext.Provider>
  );
}

export function useClientFlow() {
  const ctx = useContext(ClientFlowContext);
  if (!ctx) throw new Error('useClientFlow must be used inside ClientFlowProvider');
  return ctx;
}
