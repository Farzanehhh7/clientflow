import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createInitialState } from '../data/seed';
import type {
  AppState,
  Appointment,
  AppointmentStatus,
  AuditLogEntry,
  BusinessSettings,
  CommissionTier,
  ConfigSnapshot,
  ContentItem,
  ContentStatus,
  Coupon,
  CsvImportBatch,
  CustomEntityDef,
  CustomEntityRecord,
  CustomFieldDef,
  Customer,
  CustomerAttachment,
  CustomerRelation,
  CustomerSegment,
  DeploymentCheckItem,
  EntityRelationDef,
  Interaction,
  Invoice,
  KbArticle,
  NpsSurvey,
  OfficialHoliday,
  Opportunity,
  Order,
  OrderShipment,
  OrderStatus,
  OutboxMessage,
  PaymentMethod,
  PipelineStage,
  PipelineStageConfig,
  Product,
  Project,
  ProjectStatus,
  Quote,
  QuoteStatus,
  Resource,
  ResourceTimeOff,
  Rule,
  SalesTarget,
  Service,
  StockMovement,
  Task,
  Ticket,
  TimeEntry,
  WaitlistEntry,
  WorkflowInstance,
  WorkflowType,
} from '../types';
import { daysUntilJalaliMonthDay } from '../utils/crmHelpers';
import { getDateKeyFromIso, hasConflict, isHolidayOrTimeOff, isValidIranMobile, isValidNationalId } from '../utils/overlap';

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

function mergeLoadedState(parsed: Partial<AppState> | null | undefined): AppState {
  const fallback = createInitialState();
  if (!parsed) return fallback;

  const existingRuleIds = new Set((parsed.rules ?? []).map((r) => r.id));
  const mergedRules = [
    ...(parsed.rules ?? fallback.rules),
    ...fallback.rules.filter((r) => !existingRuleIds.has(r.id)),
  ];

  return {
    ...fallback,
    ...parsed,
    rules: mergedRules,
    customerRelations: parsed.customerRelations ?? fallback.customerRelations,
    customerSegments: parsed.customerSegments ?? fallback.customerSegments,
    csvImportBatches: parsed.csvImportBatches ?? fallback.csvImportBatches,
    customEntityDefs: parsed.customEntityDefs ?? fallback.customEntityDefs,
    customEntityRecords: parsed.customEntityRecords ?? fallback.customEntityRecords,
    entityRelations: parsed.entityRelations ?? fallback.entityRelations,
    configSnapshots: parsed.configSnapshots ?? fallback.configSnapshots,
    pipelineStages: parsed.pipelineStages ?? fallback.pipelineStages,
    quotes: parsed.quotes ?? fallback.quotes,
    salesTargets: parsed.salesTargets ?? fallback.salesTargets,
    commissionTiers: parsed.commissionTiers ?? fallback.commissionTiers,
    stockMovements: parsed.stockMovements ?? fallback.stockMovements,
    projects: parsed.projects ?? fallback.projects,
    timeEntries: parsed.timeEntries ?? fallback.timeEntries,
    resourceTimeOffs: parsed.resourceTimeOffs ?? fallback.resourceTimeOffs,
    officialHolidays: parsed.officialHolidays ?? fallback.officialHolidays,
    waitlist: parsed.waitlist ?? fallback.waitlist,
    settings: {
      ...fallback.settings,
      ...(parsed.settings ?? {}),
      salesTeam: parsed.settings?.salesTeam ?? fallback.settings.salesTeam,
    },
  };
}

function loadInitialState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialState();
    const parsed = JSON.parse(raw) as Partial<AppState>;
    return mergeLoadedState(parsed);
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

  // Customers, Relations, Segments, CSV Rollback, PII Anonymization & Attachments
  addCustomer: (data: Omit<Customer, 'id' | 'createdAt'>) => { ok: boolean; error?: string; customer?: Customer };
  updateCustomer: (id: string, data: Partial<Customer>) => { ok: boolean; error?: string };
  deleteCustomer: (id: string) => { ok: boolean; error?: string };
  anonymizeCustomer: (id: string) => { ok: boolean; error?: string };
  mergeCustomers: (primaryId: string, duplicateId: string) => { ok: boolean; error?: string };
  importCustomersBatch: (items: Customer[], fileName?: string) => number;
  rollbackCsvImportBatch: (batchId: string) => void;
  addCustomerRelation: (data: Omit<CustomerRelation, 'id' | 'createdAt'>) => void;
  removeCustomerRelation: (id: string) => void;
  addCustomerSegment: (seg: Omit<CustomerSegment, 'id' | 'createdAt'>) => void;
  deleteCustomerSegment: (id: string) => void;
  addCustomerAttachment: (customerId: string, att: Omit<CustomerAttachment, 'id' | 'uploadedAt'>) => void;
  removeCustomerAttachment: (customerId: string, attachmentId: string) => void;
  sendBirthdayGreeting: (customerId: string, kind: 'birthday' | 'anniversary') => void;
  addInteraction: (customerId: string, channel: Interaction['channel'], text: string) => void;

  // Dynamic Configurator (Fields, Entities, Relations, Versioning)
  addCustomFieldDef: (def: Omit<CustomFieldDef, 'id'>) => void;
  updateCustomFieldDef: (id: string, patch: Partial<CustomFieldDef>) => void;
  removeCustomFieldDef: (id: string) => void;
  reorderCustomFieldDefs: (orderedIds: string[]) => void;
  addCustomEntityDef: (def: Omit<CustomEntityDef, 'id' | 'createdAt'>) => void;
  deleteCustomEntityDef: (id: string) => void;
  addCustomEntityRecord: (rec: Omit<CustomEntityRecord, 'id' | 'createdAt'>) => void;
  deleteCustomEntityRecord: (id: string) => void;
  addEntityRelation: (rel: Omit<EntityRelationDef, 'id'>) => void;
  removeEntityRelation: (id: string) => void;
  saveConfigSnapshot: (versionLabel: string, note: string) => void;
  restoreConfigSnapshot: (snapshotId: string) => void;

  // Appointments + Services/Resources + Buffers/TimeOff/Holidays/Waitlist
  addAppointment: (data: Omit<Appointment, 'id'>) => { ok: boolean; error?: string };
  rescheduleAppointment: (
    id: string,
    patch: { start: string; end: string; resourceId: string },
  ) => { ok: boolean; error?: string };
  updateAppointmentStatus: (id: string, status: AppointmentStatus, cancelReason?: string) => void;
  addService: (s: Omit<Service, 'id'>) => void;
  addResource: (r: Omit<Resource, 'id'>) => void;
  addResourceTimeOff: (off: Omit<ResourceTimeOff, 'id'>) => void;
  removeResourceTimeOff: (id: string) => void;
  addOfficialHoliday: (h: Omit<OfficialHoliday, 'id'>) => void;
  removeOfficialHoliday: (id: string) => void;
  addWaitlistEntry: (entry: Omit<WaitlistEntry, 'id' | 'createdAt' | 'status'>) => void;
  bookFromWaitlist: (waitlistId: string, startIso: string, resourceId: string) => { ok: boolean; error?: string };
  simulateSmsConfirmReply: (appointmentId: string, outboxId?: string) => void;

  // Orders, Shop, Inventory, Shipments, Invoices, Projects
  addOrder: (data: {
    customerId: string;
    items: { name: string; qty: number; price: number }[];
    promisedAt?: string;
    couponCode?: string;
  }) => { ok: boolean; error?: string };
  updateOrderStatus: (id: string, nextStatus: OrderStatus, trackingCode?: string) => void;
  recordOrderShipment: (orderId: string, shipment: Omit<OrderShipment, 'id' | 'shippedAt'>) => void;
  adjustProductStock: (productId: string, delta: number, reason: string) => void;
  addProduct: (product: Omit<Product, 'id'>) => void;
  toggleCoupon: (id: string) => void;
  addCoupon: (coupon: Omit<Coupon, 'id' | 'usedCount'>) => void;
  createInvoiceForOrder: (orderId: string, method?: PaymentMethod) => void;
  recordInvoicePayment: (invoiceId: string, amount: number, method: PaymentMethod) => void;
  addProject: (data: { title: string; customerId: string; dueAt: string }) => void;
  updateProjectStatus: (id: string, status: ProjectStatus) => void;
  addProjectTask: (projectId: string, task: { title: string; assignee: string; estimatedHours: number }) => void;
  toggleProjectTask: (projectId: string, taskId: string) => void;
  addTimeEntry: (entry: Omit<TimeEntry, 'id' | 'loggedAt'>) => void;
  toggleDeploymentCheck: (projectId: string, checkId: string) => void;

  // Sales Pipeline, Quotes, Targets & Stepped Commissions
  addOpportunity: (
    data: Omit<Opportunity, 'id' | 'createdAt' | 'updatedAt'>,
    useRoundRobin?: boolean,
  ) => { ok: boolean; error?: string };
  moveOpportunityStage: (id: string, stage: PipelineStage, lostReason?: string) => void;
  convertOpportunityToCustomer: (oppId: string) => void;
  updatePipelineStages: (stages: PipelineStageConfig[]) => void;
  updateSalesTargets: (targets: SalesTarget[]) => void;
  updateCommissionTiers: (tiers: CommissionTier[]) => void;
  createQuote: (
    data: Omit<Quote, 'id' | 'quoteNo' | 'version' | 'shareToken' | 'createdAt'>,
  ) => void;
  createQuoteVersion: (parentQuoteId: string, patch?: Partial<Pick<Quote, 'items' | 'discountPct' | 'notes'>>) => void;
  updateQuoteStatus: (id: string, status: QuoteStatus, clientComment?: string) => void;

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
  addRule: (rule: Omit<Rule, 'id'>) => void;
  sendSimulatedSms: (customerId: string, body: string) => { ok: boolean; error?: string };
  runAutomationNow: (silent?: boolean) => number;
  clearOutbox: () => void;

  // Settings & System
  updateSettings: (patch: Partial<BusinessSettings>) => void;
  resetDemoData: () => void;
  exportStateJson: () => string;
  importStateJson: (raw: string) => { ok: boolean; error?: string };
};

const ClientFlowContext = createContext<ClientFlowContextValue | null>(null);

const DEFAULT_STAGE_PROB: Record<PipelineStage, number> = {
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

  // --- CRM & CUSTOMERS ---
  const addCustomer = useCallback(
    (data: Omit<Customer, 'id' | 'createdAt'>) => {
      if (!data.name.trim()) return { ok: false, error: 'نام مشتری الزامی است.' };
      if (!isValidIranMobile(data.phone)) {
        return { ok: false, error: 'شماره موبایل معتبر نیست (فرمت صحیح: ۰۹xxxxxxxxx).' };
      }
      if (data.nationalId && !isValidNationalId(data.nationalId)) {
        return { ok: false, error: 'کد ملی معتبر نیست (باید ۱۰ رقم عددی باشد).' };
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
      if (data.nationalId && !isValidNationalId(data.nationalId)) {
        return { ok: false, error: 'کد ملی معتبر نیست (باید ۱۰ رقم عددی باشد).' };
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
        customerRelations: prev.customerRelations.filter(
          (r) => r.fromCustomerId !== id && r.toCustomerId !== id,
        ),
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

  const anonymizeCustomer = useCallback(
    (id: string) => {
      if (stateRef.current.settings.role !== 'admin') {
        pushToast('ناشناس‌سازی داده‌های حساس فقط توسط مدیر مجاز است.', 'error');
        return { ok: false, error: 'فقط مدیر مجاز است.' };
      }
      const target = stateRef.current.customers.find((c) => c.id === id);
      if (!target) return { ok: false, error: 'مشتری یافت نشد.' };

      const suffix = id.slice(-4).toUpperCase();
      setState((prev) => ({
        ...prev,
        customers: prev.customers.map((c) =>
          c.id === id
            ? {
                ...c,
                name: `مشتری ناشناس #${suffix}`,
                phone: `0900000${String(Math.floor(1000 + Math.random() * 8999))}`,
                email: undefined,
                nationalId: undefined,
                companyName: c.companyName ? `شرکت ناشناس #${suffix}` : undefined,
                economicCode: undefined,
                registrationNo: undefined,
                contacts: [],
                addresses: [],
                allergies: undefined,
                notes: 'داده‌های هویتی مطابق درخواست مشتری ناشناس‌سازی (PII Anonymized) شد.',
                birthDateJalali: undefined,
                anniversaryDateJalali: undefined,
                attachments: [],
                consentSms: false,
                consentPhoto: false,
                isAnonymized: true,
              }
            : c,
        ),
        auditLogs: [
          makeAudit('مشتری', 'update', `داده‌های هویتی (PII) مشتری «${target.name}» ناشناس‌سازی شد.`),
          ...prev.auditLogs,
        ].slice(0, 100),
      }));
      pushToast(`اطلاعات هویتی «${target.name}» ناشناس‌سازی شد (سوابق مالی حفظ شد).`, 'info');
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
                  contacts: [...(c.contacts ?? []), ...(dup.contacts ?? [])],
                  addresses: [...(c.addresses ?? []), ...(dup.addresses ?? [])],
                  attachments: [...(c.attachments ?? []), ...(dup.attachments ?? [])],
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
    (items: Customer[], fileName = 'import.csv') => {
      if (items.length === 0) return 0;
      const batch: CsvImportBatch = {
        id: `batch_${Date.now()}`,
        fileName,
        customerIds: items.map((i) => i.id),
        count: items.length,
        importedAt: new Date().toISOString(),
        rolledBack: false,
      };
      setState((prev) => ({
        ...prev,
        customers: [...items, ...prev.customers],
        csvImportBatches: [batch, ...prev.csvImportBatches].slice(0, 20),
        auditLogs: [
          makeAudit('مشتری', 'create', `${items.length} مشتری از فایل «${fileName}» وارد شد.`),
          ...prev.auditLogs,
        ].slice(0, 100),
      }));
      pushToast(`${items.length} مشتری از فایل CSV وارد شد (قابل بازگشت در تاریخچه).`);
      return items.length;
    },
    [pushToast],
  );

  const rollbackCsvImportBatch = useCallback(
    (batchId: string) => {
      const batch = stateRef.current.csvImportBatches.find((b) => b.id === batchId);
      if (!batch || batch.rolledBack) return;
      const removeSet = new Set(batch.customerIds);
      setState((prev) => ({
        ...prev,
        customers: prev.customers.filter((c) => !removeSet.has(c.id)),
        csvImportBatches: prev.csvImportBatches.map((b) =>
          b.id === batchId ? { ...b, rolledBack: true } : b,
        ),
        auditLogs: [
          makeAudit('مشتری', 'delete', `ورود دسته‌ای «${batch.fileName}» (${batch.count} مشتری) بازگشت داده شد.`),
          ...prev.auditLogs,
        ].slice(0, 100),
      }));
      pushToast(`ایمپورت «${batch.fileName}» (${batch.count} رکورد) به‌صورت کامل بازگشت داده شد.`, 'info');
    },
    [pushToast],
  );

  const addCustomerRelation = useCallback(
    (data: Omit<CustomerRelation, 'id' | 'createdAt'>) => {
      if (data.fromCustomerId === data.toCustomerId) return;
      const rel: CustomerRelation = {
        ...data,
        id: `rel_${Date.now()}`,
        createdAt: new Date().toISOString(),
      };
      setState((prev) => ({
        ...prev,
        customerRelations: [rel, ...prev.customerRelations],
      }));
      pushToast('ارتباط جدید بین مشتریان ثبت شد.');
    },
    [pushToast],
  );

  const removeCustomerRelation = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      customerRelations: prev.customerRelations.filter((r) => r.id !== id),
    }));
  }, []);

  const addCustomerSegment = useCallback(
    (seg: Omit<CustomerSegment, 'id' | 'createdAt'>) => {
      const created: CustomerSegment = {
        ...seg,
        id: `seg_${Date.now()}`,
        createdAt: new Date().toISOString(),
      };
      setState((prev) => ({
        ...prev,
        customerSegments: [created, ...prev.customerSegments],
      }));
      pushToast(`سگمنت پویا «${created.name}» ذخیره شد.`);
    },
    [pushToast],
  );

  const deleteCustomerSegment = useCallback(
    (id: string) => {
      setState((prev) => ({
        ...prev,
        customerSegments: prev.customerSegments.filter((s) => s.id !== id),
      }));
      pushToast('سگمنت حذف شد.', 'info');
    },
    [pushToast],
  );

  const addCustomerAttachment = useCallback(
    (customerId: string, att: Omit<CustomerAttachment, 'id' | 'uploadedAt'>) => {
      const created: CustomerAttachment = {
        ...att,
        id: `att_${Date.now()}`,
        uploadedAt: new Date().toISOString(),
      };
      setState((prev) => ({
        ...prev,
        customers: prev.customers.map((c) =>
          c.id === customerId ? { ...c, attachments: [created, ...(c.attachments ?? [])] } : c,
        ),
      }));
      pushToast(`مدرک «${created.name}» در پرونده پیوست شد.`);
    },
    [pushToast],
  );

  const removeCustomerAttachment = useCallback((customerId: string, attachmentId: string) => {
    setState((prev) => ({
      ...prev,
      customers: prev.customers.map((c) =>
        c.id === customerId
          ? { ...c, attachments: (c.attachments ?? []).filter((a) => a.id !== attachmentId) }
          : c,
      ),
    }));
  }, []);

  const sendBirthdayGreeting = useCallback(
    (customerId: string, kind: 'birthday' | 'anniversary') => {
      const cust = stateRef.current.customers.find((c) => c.id === customerId);
      if (!cust) return;
      if (cust.consentSms === false) {
        pushToast('این مشتری رضایت دریافت پیامک را غیرفعال کرده است.', 'error');
        return;
      }
      const nowIso = new Date().toISOString();
      const body =
        kind === 'birthday'
          ? `${cust.name} عزیز، زادروزتان مبارک! به‌مناسبت تولد شما کد هدیه ۲۰٪ (VIP20) در ${stateRef.current.settings.businessName} برایتان فعال شد.`
          : `${cust.name} گرامی، سالگرد همراهی ارزشمندتان با ${stateRef.current.settings.businessName} را تبریک می‌گوییم!`;

      setState((prev) => ({
        ...prev,
        outbox: [
          {
            id: `msg_bday_${Date.now()}`,
            to: cust.phone,
            customerName: cust.name,
            body,
            channel: 'sms',
            ruleName: kind === 'birthday' ? 'تبریک تولد' : 'تبریک سالگرد',
            at: nowIso,
          },
          ...prev.outbox,
        ],
        interactions: [
          {
            id: `int_bday_${Date.now()}`,
            customerId: cust.id,
            channel: 'sms',
            text: body,
            at: nowIso,
          },
          ...prev.interactions,
        ],
      }));
      pushToast(`پیامک تبریک برای «${cust.name}» در صندوق ارسال ثبت شد.`);
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

  // --- DYNAMIC CONFIGURATOR ---
  const addCustomFieldDef = useCallback(
    (def: Omit<CustomFieldDef, 'id'>) => {
      setState((prev) => ({
        ...prev,
        customFieldDefs: [
          ...prev.customFieldDefs,
          { ...def, id: `cf_${Date.now()}`, order: prev.customFieldDefs.length + 1 },
        ],
        auditLogs: [makeAudit('پیکربندی', 'create', `فیلد سفارشی «${def.label}» اضافه شد.`), ...prev.auditLogs].slice(0, 100),
      }));
      pushToast(`فیلد سفارشی «${def.label}» اضافه شد.`);
    },
    [pushToast],
  );

  const updateCustomFieldDef = useCallback((id: string, patch: Partial<CustomFieldDef>) => {
    setState((prev) => ({
      ...prev,
      customFieldDefs: prev.customFieldDefs.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    }));
  }, []);

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

  const reorderCustomFieldDefs = useCallback((orderedIds: string[]) => {
    setState((prev) => {
      const map = new Map(prev.customFieldDefs.map((f) => [f.id, f]));
      const reordered: CustomFieldDef[] = orderedIds
        .map((id, idx): CustomFieldDef | null => {
          const item = map.get(id);
          return item ? { ...item, order: idx + 1 } : null;
        })
        .filter((x): x is CustomFieldDef => x !== null);
      return { ...prev, customFieldDefs: reordered };
    });
  }, []);

  const addCustomEntityDef = useCallback(
    (def: Omit<CustomEntityDef, 'id' | 'createdAt'>) => {
      const created: CustomEntityDef = {
        ...def,
        id: `ent_${Date.now()}`,
        createdAt: new Date().toISOString(),
      };
      setState((prev) => ({
        ...prev,
        customEntityDefs: [...prev.customEntityDefs, created],
        auditLogs: [makeAudit('پیکربندی', 'create', `موجودیت سفارشی «${def.name}» ساخته شد.`), ...prev.auditLogs].slice(0, 100),
      }));
      pushToast(`موجودیت سفارشی «${def.name}» ایجاد شد.`);
    },
    [pushToast],
  );

  const deleteCustomEntityDef = useCallback(
    (id: string) => {
      const target = stateRef.current.customEntityDefs.find((e) => e.id === id);
      setState((prev) => ({
        ...prev,
        customEntityDefs: prev.customEntityDefs.filter((e) => e.id !== id),
        customEntityRecords: target
          ? prev.customEntityRecords.filter((r) => r.entityKey !== target.key)
          : prev.customEntityRecords,
      }));
      pushToast('موجودیت سفارشی حذف شد.', 'info');
    },
    [pushToast],
  );

  const addCustomEntityRecord = useCallback(
    (rec: Omit<CustomEntityRecord, 'id' | 'createdAt'>) => {
      const created: CustomEntityRecord = {
        ...rec,
        id: `er_${Date.now()}`,
        createdAt: new Date().toISOString(),
      };
      setState((prev) => ({
        ...prev,
        customEntityRecords: [created, ...prev.customEntityRecords],
      }));
      pushToast('رکورد جدید در موجودیت سفارشی ثبت شد.');
    },
    [pushToast],
  );

  const deleteCustomEntityRecord = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      customEntityRecords: prev.customEntityRecords.filter((r) => r.id !== id),
    }));
  }, []);

  const addEntityRelation = useCallback(
    (rel: Omit<EntityRelationDef, 'id'>) => {
      setState((prev) => ({
        ...prev,
        entityRelations: [...prev.entityRelations, { ...rel, id: `erel_${Date.now()}` }],
      }));
      pushToast(`رابطه ${rel.cardinality} ثبت شد.`);
    },
    [pushToast],
  );

  const removeEntityRelation = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      entityRelations: prev.entityRelations.filter((r) => r.id !== id),
    }));
  }, []);

  const saveConfigSnapshot = useCallback(
    (versionLabel: string, note: string) => {
      const cur = stateRef.current;
      const snap: ConfigSnapshot = {
        id: `snap_${Date.now()}`,
        versionLabel: versionLabel.trim() || `v1.${cur.configSnapshots.length}.0`,
        note: note.trim() || 'ذخیره دستی پیکربندی',
        createdAt: new Date().toISOString(),
        customFieldDefs: cur.customFieldDefs,
        customEntityDefs: cur.customEntityDefs,
        entityRelations: cur.entityRelations,
        pipelineStages: cur.pipelineStages,
        commissionTiers: cur.commissionTiers,
      };
      setState((prev) => ({
        ...prev,
        configSnapshots: [snap, ...prev.configSnapshots],
        auditLogs: [makeAudit('پیکربندی', 'create', `نسخه پیکربندی ${snap.versionLabel} ذخیره شد.`), ...prev.auditLogs].slice(0, 100),
      }));
      pushToast(`نسخه پیکربندی ${snap.versionLabel} ذخیره شد.`);
    },
    [pushToast],
  );

  const restoreConfigSnapshot = useCallback(
    (snapshotId: string) => {
      const snap = stateRef.current.configSnapshots.find((s) => s.id === snapshotId);
      if (!snap) return;
      setState((prev) => ({
        ...prev,
        customFieldDefs: snap.customFieldDefs,
        customEntityDefs: snap.customEntityDefs,
        entityRelations: snap.entityRelations,
        pipelineStages: snap.pipelineStages,
        commissionTiers: snap.commissionTiers,
        auditLogs: [
          makeAudit('پیکربندی', 'update', `پیکربندی به نسخه ${snap.versionLabel} بازگردانده شد.`),
          ...prev.auditLogs,
        ].slice(0, 100),
      }));
      pushToast(`پیکربندی سیستم به نسخه ${snap.versionLabel} بازگشت داده شد.`);
    },
    [pushToast],
  );

  // --- APPOINTMENTS ---
  const addAppointment = useCallback(
    (data: Omit<Appointment, 'id'>) => {
      if (new Date(data.end) <= new Date(data.start)) {
        return { ok: false, error: 'ساعت پایان باید بعد از ساعت شروع باشد.' };
      }
      const dateKey = getDateKeyFromIso(data.start);
      const blocked = isHolidayOrTimeOff(
        dateKey,
        data.resourceId,
        stateRef.current.officialHolidays,
        stateRef.current.resourceTimeOffs,
      );
      if (blocked.blocked) {
        return { ok: false, error: blocked.reason ?? 'این روز در دسترس نیست.' };
      }
      if (hasConflict(stateRef.current.appointments, data, stateRef.current.services)) {
        return {
          ok: false,
          error: 'تداخل زمانی (با احتساب زمان بافر خدمت)! این منبع در بازه انتخاب‌شده نوبت فعال دیگری دارد.',
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
      const existing = stateRef.current.appointments.find((a) => a.id === id);
      const dateKey = getDateKeyFromIso(patch.start);
      const blocked = isHolidayOrTimeOff(
        dateKey,
        patch.resourceId,
        stateRef.current.officialHolidays,
        stateRef.current.resourceTimeOffs,
      );
      if (blocked.blocked) {
        return { ok: false, error: blocked.reason ?? 'این روز در دسترس نیست.' };
      }
      if (
        hasConflict(
          stateRef.current.appointments,
          { ...patch, id, serviceId: existing?.serviceId },
          stateRef.current.services,
        )
      ) {
        return {
          ok: false,
          error: 'تداخل زمانی (با احتساب زمان بافر)! منبع انتخاب‌شده در این ساعت نوبت دیگری دارد.',
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
      const cur = stateRef.current;
      const target = cur.appointments.find((a) => a.id === id);
      if (!target) return;
      const customer = cur.customers.find((c) => c.id === target.customerId);
      const nowIso = new Date().toISOString();

      const autoSms =
        status === 'confirmed' && customer && customer.consentSms !== false
          ? {
              id: `msg_apt_${Date.now()}`,
              to: customer.phone,
              customerName: customer.name,
              body: `${customer.name} عزیز، نوبت شما در ${cur.settings.businessName} تأیید شد.`,
              channel: 'sms' as const,
              ruleName: 'تأیید خودکار نوبت',
              at: nowIso,
            }
          : null;

      // Auto-notify waitlist entry if cancelled
      const cancelDayKey = getDateKeyFromIso(target.start);
      const matchingWaitlist =
        status === 'cancelled'
          ? cur.waitlist.find(
              (w) =>
                w.status === 'waiting' &&
                w.preferredDayKey === cancelDayKey &&
                (!w.preferredResourceId || w.preferredResourceId === target.resourceId),
            )
          : undefined;
      const waitCust = matchingWaitlist
        ? cur.customers.find((c) => c.id === matchingWaitlist.customerId)
        : undefined;

      const waitSms =
        matchingWaitlist && waitCust && waitCust.consentSms !== false
          ? {
              id: `msg_wl_${Date.now()}`,
              to: waitCust.phone,
              customerName: waitCust.name,
              body: `${waitCust.name} عزیز، یک نوبت در تاریخ درخواستی شما خالی شد! برای رزرو با پذیرش تماس بگیرید.`,
              channel: 'sms' as const,
              ruleName: 'جایگزینی خودکار لیست انتظار',
              at: nowIso,
            }
          : null;

      setState((prev) => ({
        ...prev,
        appointments: prev.appointments.map((a) =>
          a.id === id ? { ...a, status, cancelReason: cancelReason ?? a.cancelReason } : a,
        ),
        waitlist: matchingWaitlist
          ? prev.waitlist.map((w) =>
              w.id === matchingWaitlist.id ? { ...w, status: 'notified' } : w,
            )
          : prev.waitlist,
        outbox: [
          ...([autoSms, waitSms].filter((x): x is NonNullable<typeof x> => Boolean(x)) as OutboxMessage[]),
          ...prev.outbox,
        ],
      }));

      if (matchingWaitlist && waitCust) {
        pushToast(`نوبت لغو شد و پیامک جای خالی برای «${waitCust.name}» در لیست انتظار ارسال گردید.`, 'info');
      } else {
        pushToast('وضعیت نوبت به‌روزرسانی شد.');
      }

      if (status === 'done' && customer) {
        const alreadyRated = cur.npsSurveys.some(
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

  const addResourceTimeOff = useCallback(
    (off: Omit<ResourceTimeOff, 'id'>) => {
      setState((prev) => ({
        ...prev,
        resourceTimeOffs: [{ ...off, id: `off_${Date.now()}` }, ...prev.resourceTimeOffs],
      }));
      pushToast('مرخصی / بازه عدم حضور منبع ثبت شد.');
    },
    [pushToast],
  );

  const removeResourceTimeOff = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      resourceTimeOffs: prev.resourceTimeOffs.filter((t) => t.id !== id),
    }));
  }, []);

  const addOfficialHoliday = useCallback(
    (h: Omit<OfficialHoliday, 'id'>) => {
      setState((prev) => ({
        ...prev,
        officialHolidays: [{ ...h, id: `hol_${Date.now()}` }, ...prev.officialHolidays],
      }));
      pushToast(`تعطیل رسمی «${h.title}» ثبت شد.`);
    },
    [pushToast],
  );

  const removeOfficialHoliday = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      officialHolidays: prev.officialHolidays.filter((h) => h.id !== id),
    }));
  }, []);

  const addWaitlistEntry = useCallback(
    (entry: Omit<WaitlistEntry, 'id' | 'createdAt' | 'status'>) => {
      const created: WaitlistEntry = {
        ...entry,
        id: `wl_${Date.now()}`,
        status: 'waiting',
        createdAt: new Date().toISOString(),
      };
      setState((prev) => ({
        ...prev,
        waitlist: [created, ...prev.waitlist],
      }));
      pushToast('درخواست به لیست انتظار اضافه شد.');
    },
    [pushToast],
  );

  const bookFromWaitlist = useCallback(
    (waitlistId: string, startIso: string, resourceId: string) => {
      const cur = stateRef.current;
      const entry = cur.waitlist.find((w) => w.id === waitlistId);
      if (!entry) return { ok: false, error: 'رکورد لیست انتظار یافت نشد.' };
      const srv = cur.services.find((s) => s.id === entry.serviceId);
      if (!srv) return { ok: false, error: 'خدمت یافت نشد.' };
      const endIso = new Date(new Date(startIso).getTime() + srv.durationMin * 60_000).toISOString();

      const res = addAppointment({
        customerId: entry.customerId,
        serviceId: entry.serviceId,
        resourceId,
        start: startIso,
        end: endIso,
        status: 'confirmed',
      });
      if (!res.ok) return res;

      setState((prev) => ({
        ...prev,
        waitlist: prev.waitlist.map((w) => (w.id === waitlistId ? { ...w, status: 'booked' } : w)),
      }));
      return { ok: true };
    },
    [addAppointment],
  );

  const simulateSmsConfirmReply = useCallback(
    (appointmentId: string, outboxId?: string) => {
      const cur = stateRef.current;
      const apt = cur.appointments.find((a) => a.id === appointmentId);
      if (!apt) return;
      const cust = cur.customers.find((c) => c.id === apt.customerId);
      setState((prev) => ({
        ...prev,
        appointments: prev.appointments.map((a) =>
          a.id === appointmentId && a.status === 'booked' ? { ...a, status: 'confirmed' } : a,
        ),
        outbox: outboxId
          ? prev.outbox.map((m) => (m.id === outboxId ? { ...m, confirmedByReply: true } : m))
          : prev.outbox,
        interactions: cust
          ? [
              {
                id: `int_reply_${Date.now()}`,
                customerId: cust.id,
                channel: 'sms',
                text: 'پاسخ شبیه‌سازی‌شده مشتری: «تأیید» به پیامک یادآور نوبت.',
                at: new Date().toISOString(),
              },
              ...prev.interactions,
            ]
          : prev.interactions,
      }));
      pushToast(`پاسخ «تأیید» از ${cust?.name ?? 'مشتری'} شبیه‌سازی شد و نوبت به وضعیت تأییدشده درآمد.`);
    },
    [pushToast],
  );

  // --- ORDERS, INVENTORY, INVOICES, PROJECTS ---
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
        shipments: [],
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
    (id: string, nextStatus: OrderStatus, trackingCode?: string) => {
      const cur = stateRef.current;
      const target = cur.orders.find((o) => o.id === id);
      if (!target || target.status === nextStatus) return;
      const nowIso = new Date().toISOString();
      const customer = cur.customers.find((c) => c.id === target.customerId);
      const cleanTracking = trackingCode?.trim() || target.trackingCode;

      const statusMsgMap: Partial<Record<OrderStatus, string>> = {
        confirmed: 'سفارش شما تأیید شد و در صف آماده‌سازی قرار گرفت.',
        shipped: cleanTracking
          ? `سفارش شما ارسال شد. کد رهگیری مرسوله: ${cleanTracking}`
          : 'سفارش شما ارسال شد و به‌زودی به دستتان می‌رسد.',
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

      // Auto-decrement stock when confirming from 'new', or restore when cancelling from confirmed/shipped
      const shouldDecrement = target.status === 'new' && nextStatus === 'confirmed';
      const shouldRestore =
        (target.status === 'confirmed' || target.status === 'shipped') && nextStatus === 'cancelled';

      const newMovements: StockMovement[] = [];
      let updatedProducts = cur.products;

      if (shouldDecrement || shouldRestore) {
        updatedProducts = cur.products.map((prod) => {
          const matchedQty = target.items
            .filter((it) => it.name === prod.name)
            .reduce((s, it) => s + it.qty, 0);
          if (matchedQty <= 0) return prod;
          const delta = shouldDecrement ? -matchedQty : matchedQty;
          const nextStock = Math.max(0, prod.stock + delta);
          newMovements.push({
            id: `sm_${Date.now()}_${prod.id}`,
            productId: prod.id,
            productName: prod.name,
            orderId: id,
            type: shouldDecrement ? 'out' : 'in',
            qtyChange: delta,
            balanceAfter: nextStock,
            reason: shouldDecrement
              ? `کسر خودکار بابت تأیید سفارش ${id}`
              : `بازگشت موجودی بابت لغو سفارش ${id}`,
            at: nowIso,
          });
          return { ...prod, stock: nextStock };
        });
      }

      setState((prev) => ({
        ...prev,
        products: updatedProducts,
        stockMovements: [...newMovements, ...prev.stockMovements],
        orders: prev.orders.map((o) =>
          o.id === id
            ? {
                ...o,
                status: nextStatus,
                updatedAt: nowIso,
                trackingCode: cleanTracking,
              }
            : o,
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

      if (newMovements.length > 0) {
        pushToast(
          shouldDecrement
            ? 'وضعیت سفارش تأیید و موجودی انبار به‌صورت خودکار کسر شد.'
            : 'سفارش لغو و موجودی به انبار بازگردانده شد.',
        );
      } else {
        pushToast('وضعیت سفارش تغییر کرد.');
      }

      if (nextStatus === 'delivered' && customer) {
        const alreadyRated = cur.npsSurveys.some(
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

  const recordOrderShipment = useCallback(
    (orderId: string, shipment: Omit<OrderShipment, 'id' | 'shippedAt'>) => {
      const nowIso = new Date().toISOString();
      const created: OrderShipment = {
        ...shipment,
        id: `shp_${Date.now()}`,
        shippedAt: nowIso,
      };
      setState((prev) => ({
        ...prev,
        orders: prev.orders.map((o) =>
          o.id === orderId
            ? {
                ...o,
                carrier: shipment.carrier,
                trackingCode: shipment.trackingCode || o.trackingCode,
                status: o.status === 'new' || o.status === 'confirmed' ? 'shipped' : o.status,
                updatedAt: nowIso,
                shipments: [...(o.shipments ?? []), created],
              }
            : o,
        ),
        orderLogs: [
          {
            id: `ol_shp_${Date.now()}`,
            orderId,
            from: 'مرسوله جزئی',
            to: `${shipment.carrier} (${shipment.trackingCode})`,
            at: nowIso,
          },
          ...prev.orderLogs,
        ],
      }));
      pushToast('مرسوله جزئی ثبت و کد رهگیری ذخیره شد.');
    },
    [pushToast],
  );

  const adjustProductStock = useCallback(
    (productId: string, delta: number, reason: string) => {
      if (delta === 0) return;
      const prod = stateRef.current.products.find((p) => p.id === productId);
      if (!prod) return;
      const nextStock = Math.max(0, prod.stock + delta);
      const mv: StockMovement = {
        id: `sm_adj_${Date.now()}`,
        productId,
        productName: prod.name,
        type: delta > 0 ? 'in' : 'adjust',
        qtyChange: delta,
        balanceAfter: nextStock,
        reason: reason.trim() || (delta > 0 ? 'ورود دستی به انبار' : 'تعدیل دستی انبار'),
        at: new Date().toISOString(),
      };
      setState((prev) => ({
        ...prev,
        products: prev.products.map((p) => (p.id === productId ? { ...p, stock: nextStock } : p)),
        stockMovements: [mv, ...prev.stockMovements],
      }));
      pushToast(`موجودی «${prod.name}» به‌روزرسانی شد.`);
    },
    [pushToast],
  );

  const addProduct = useCallback(
    (product: Omit<Product, 'id'>) => {
      setState((prev) => ({
        ...prev,
        products: [{ minStock: 8, ...product, id: `p_${Date.now()}` }, ...prev.products],
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

  // --- PROJECTS & DEPLOYMENT ---
  const addProject = useCallback(
    (data: { title: string; customerId: string; dueAt: string }) => {
      if (!data.title.trim()) return;
      const defaultChecklist: DeploymentCheckItem[] = [
        { id: `dc_${Date.now()}_1`, title: 'تأمین سرور و گواهی SSL', category: 'infra', done: false },
        { id: `dc_${Date.now()}_2`, title: 'پیکربندی پایگاه داده و بکاپ خودکار', category: 'db', done: false },
        { id: `dc_${Date.now()}_3`, title: 'تنظیم سطح دسترسی نقش‌ها و امنیت', category: 'security', done: false },
        { id: `dc_${Date.now()}_4`, title: 'جلسه آموزش کاربران و تحویل مستندات', category: 'training', done: false },
      ];
      const prj: Project = {
        id: `prj_${Date.now()}`,
        title: data.title.trim(),
        customerId: data.customerId,
        status: 'planning',
        dueAt: data.dueAt,
        tasks: [],
        deploymentChecklist: defaultChecklist,
        createdAt: new Date().toISOString(),
      };
      setState((prev) => ({
        ...prev,
        projects: [prj, ...prev.projects],
      }));
      pushToast(`پروژه «${prj.title}» با چک‌لیست استقرار ایجاد شد.`);
    },
    [pushToast],
  );

  const updateProjectStatus = useCallback((id: string, status: ProjectStatus) => {
    setState((prev) => ({
      ...prev,
      projects: prev.projects.map((p) => (p.id === id ? { ...p, status } : p)),
    }));
  }, []);

  const addProjectTask = useCallback(
    (projectId: string, task: { title: string; assignee: string; estimatedHours: number }) => {
      if (!task.title.trim()) return;
      setState((prev) => ({
        ...prev,
        projects: prev.projects.map((p) =>
          p.id === projectId
            ? {
                ...p,
                tasks: [
                  ...p.tasks,
                  {
                    id: `pt_${Date.now()}`,
                    title: task.title.trim(),
                    assignee: task.assignee,
                    estimatedHours: Math.max(0.5, task.estimatedHours),
                    done: false,
                  },
                ],
              }
            : p,
        ),
      }));
      pushToast('زیرتسک پروژه اضافه شد.');
    },
    [pushToast],
  );

  const toggleProjectTask = useCallback((projectId: string, taskId: string) => {
    setState((prev) => ({
      ...prev,
      projects: prev.projects.map((p) =>
        p.id === projectId
          ? {
              ...p,
              tasks: p.tasks.map((t) => (t.id === taskId ? { ...t, done: !t.done } : t)),
            }
          : p,
      ),
    }));
  }, []);

  const addTimeEntry = useCallback(
    (entry: Omit<TimeEntry, 'id' | 'loggedAt'>) => {
      if (entry.hours <= 0) return;
      const created: TimeEntry = {
        ...entry,
        id: `te_${Date.now()}`,
        loggedAt: new Date().toISOString(),
      };
      setState((prev) => ({
        ...prev,
        timeEntries: [created, ...prev.timeEntries],
      }));
      pushToast(`${entry.hours} ساعت کارکرد ثبت شد.`);
    },
    [pushToast],
  );

  const toggleDeploymentCheck = useCallback((projectId: string, checkId: string) => {
    const nowIso = new Date().toISOString();
    setState((prev) => ({
      ...prev,
      projects: prev.projects.map((p) =>
        p.id === projectId
          ? {
              ...p,
              deploymentChecklist: p.deploymentChecklist.map((dc) =>
                dc.id === checkId
                  ? { ...dc, done: !dc.done, checkedAt: !dc.done ? nowIso : undefined }
                  : dc,
              ),
            }
          : p,
      ),
    }));
  }, []);

  // --- SALES PIPELINE & QUOTES ---
  const addOpportunity = useCallback(
    (data: Omit<Opportunity, 'id' | 'createdAt' | 'updatedAt'>, useRoundRobin = false) => {
      if (!data.title.trim() || !data.contactName.trim()) {
        return { ok: false, error: 'عنوان فرصت و نام مخاطب الزامی است.' };
      }
      if (!isValidIranMobile(data.phone)) {
        return { ok: false, error: 'شماره موبایل معتبر نیست (فرمت صحیح: ۰۹xxxxxxxxx).' };
      }

      const cur = stateRef.current;
      const team = cur.settings.salesTeam.length > 0 ? cur.settings.salesTeam : ['مریم (فروش)'];
      const rrIdx = cur.settings.roundRobinIndex % team.length;
      const assignedOwner = useRoundRobin ? team[rrIdx] : data.ownerName;

      const stageCfg = cur.pipelineStages.find((s) => s.key === data.stage);
      const nowIso = new Date().toISOString();
      const opp: Opportunity = {
        ...data,
        ownerName: assignedOwner,
        id: `opp_${Date.now()}`,
        probability: stageCfg?.probability ?? DEFAULT_STAGE_PROB[data.stage],
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      setState((prev) => ({
        ...prev,
        opportunities: [opp, ...prev.opportunities],
        settings: useRoundRobin
          ? { ...prev.settings, roundRobinIndex: (rrIdx + 1) % team.length }
          : prev.settings,
        auditLogs: [
          makeAudit(
            'فروش',
            'create',
            `فرصت «${opp.title}» ثبت${useRoundRobin ? ` و به‌صورت چرخشی به ${assignedOwner} تخصیص داده` : ''} شد.`,
          ),
          ...prev.auditLogs,
        ].slice(0, 100),
      }));
      pushToast(
        useRoundRobin
          ? `فرصت جدید ثبت و به ${assignedOwner} تخصیص داده شد.`
          : 'فرصت فروش جدید در قیف ثبت شد.',
      );
      return { ok: true };
    },
    [pushToast],
  );

  const moveOpportunityStage = useCallback(
    (id: string, stage: PipelineStage, lostReason?: string) => {
      const stageCfg = stateRef.current.pipelineStages.find((s) => s.key === stage);
      const nextProb = stageCfg?.probability ?? DEFAULT_STAGE_PROB[stage];
      setState((prev) => ({
        ...prev,
        opportunities: prev.opportunities.map((o) =>
          o.id === id
            ? {
                ...o,
                stage,
                probability: nextProb,
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

  const updatePipelineStages = useCallback(
    (stages: PipelineStageConfig[]) => {
      setState((prev) => ({ ...prev, pipelineStages: stages }));
      pushToast('مراحل و SLA قیف فروش به‌روزرسانی شد.');
    },
    [pushToast],
  );

  const updateSalesTargets = useCallback(
    (targets: SalesTarget[]) => {
      setState((prev) => ({ ...prev, salesTargets: targets }));
      pushToast('تارگت‌های فروش ذخیره شد.');
    },
    [pushToast],
  );

  const updateCommissionTiers = useCallback(
    (tiers: CommissionTier[]) => {
      setState((prev) => ({ ...prev, commissionTiers: tiers }));
      pushToast('پلکان پورسانت ذخیره شد.');
    },
    [pushToast],
  );

  const createQuote = useCallback(
    (data: Omit<Quote, 'id' | 'quoteNo' | 'version' | 'shareToken' | 'createdAt'>) => {
      const seq = 101 + stateRef.current.quotes.length;
      const quote: Quote = {
        ...data,
        id: `q_${Date.now()}`,
        quoteNo: `QT-1405-${seq}`,
        version: 1,
        shareToken: `qt-share-${seq}-v1`,
        createdAt: new Date().toISOString(),
      };
      setState((prev) => ({
        ...prev,
        quotes: [quote, ...prev.quotes],
        auditLogs: [makeAudit('فروش', 'create', `پیش‌فاکتور ${quote.quoteNo} (نسخه ۱) صادر شد.`), ...prev.auditLogs].slice(0, 100),
      }));
      pushToast(`پیش‌فاکتور ${quote.quoteNo} نسخه ۱ ایجاد شد.`);
    },
    [pushToast],
  );

  const createQuoteVersion = useCallback(
    (parentQuoteId: string, patch?: Partial<Pick<Quote, 'items' | 'discountPct' | 'notes'>>) => {
      const parent = stateRef.current.quotes.find((q) => q.id === parentQuoteId);
      if (!parent) return;
      const siblings = stateRef.current.quotes.filter((q) => q.quoteNo === parent.quoteNo);
      const nextVersion = Math.max(...siblings.map((s) => s.version)) + 1;
      const newQuote: Quote = {
        ...parent,
        ...patch,
        id: `q_${Date.now()}`,
        version: nextVersion,
        parentQuoteId: parent.id,
        status: 'draft',
        clientComment: undefined,
        shareToken: `${parent.quoteNo.toLowerCase()}-v${nextVersion}`,
        createdAt: new Date().toISOString(),
      };
      setState((prev) => ({
        ...prev,
        quotes: [newQuote, ...prev.quotes],
      }));
      pushToast(`نسخه ${nextVersion} پیش‌فاکتور ${parent.quoteNo} ایجاد شد.`);
    },
    [pushToast],
  );

  const updateQuoteStatus = useCallback(
    (id: string, status: QuoteStatus, clientComment?: string) => {
      setState((prev) => ({
        ...prev,
        quotes: prev.quotes.map((q) =>
          q.id === id ? { ...q, status, clientComment: clientComment ?? q.clientComment } : q,
        ),
      }));
      pushToast(
        status === 'approved'
          ? 'پیش‌فاکتور توسط مشتری تأیید شد.'
          : status === 'rejected'
            ? 'پیش‌فاکتور رد شد.'
            : 'وضعیت پیش‌فاکتور به‌روزرسانی شد.',
      );
    },
    [pushToast],
  );

  // --- WORKFLOWS, MARKETING, TASKS, TICKETS, KB, NPS, AUTOMATION ---
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

  const addRule = useCallback(
    (rule: Omit<Rule, 'id'>) => {
      const created: Rule = { ...rule, id: `u_custom_${Date.now()}` };
      setState((prev) => ({
        ...prev,
        rules: [created, ...prev.rules],
        auditLogs: [makeAudit('اتوماسیون', 'create', `قانون «${created.name}» ایجاد شد.`), ...prev.auditLogs].slice(0, 100),
      }));
      pushToast(`قانون «${created.name}» ثبت شد.`);
    },
    [pushToast],
  );

  const sendSimulatedSms = useCallback(
    (customerId: string, body: string) => {
      const cust = stateRef.current.customers.find((c) => c.id === customerId);
      if (!cust) return { ok: false, error: 'مشتری انتخاب‌شده یافت نشد.' };
      if (!body.trim()) return { ok: false, error: 'متن پیامک نمی‌تواند خالی باشد.' };
      if (cust.consentSms === false) {
        return { ok: false, error: 'این مشتری رضایت دریافت پیامک را غیرفعال کرده است.' };
      }
      const nowIso = new Date().toISOString();
      const msg = {
        id: `msg_manual_${Date.now()}`,
        to: cust.phone,
        customerName: cust.name,
        body: body.trim(),
        channel: 'sms' as const,
        ruleName: 'ارسال دستی کارشناس',
        at: nowIso,
      };
      const interaction: Interaction = {
        id: `int_sms_${Date.now()}`,
        customerId: cust.id,
        channel: 'sms',
        text: `پیامک شبیه‌سازی‌شده: ${body.trim()}`,
        at: nowIso,
      };
      setState((prev) => ({
        ...prev,
        outbox: [msg, ...prev.outbox],
        interactions: [interaction, ...prev.interactions],
        auditLogs: [makeAudit('پیامک', 'create', `پیامک دستی برای «${cust.name}» ثبت شد.`), ...prev.auditLogs].slice(0, 100),
      }));
      pushToast(`پیامک شبیه‌سازی‌شده برای «${cust.name}» در صندوق ارسال ثبت شد.`);
      return { ok: true };
    },
    [pushToast],
  );

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
                  appointmentId: apt.id,
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
              summary: `${count} پیامک یادآوری نوبت ۲۴ ساعته ثبت شد.`,
              at: nowIso,
            });
          }
        }

        if (rule.id === 'u7') {
          let count = 0;
          for (const apt of cur.appointments) {
            if (apt.status !== 'booked' && apt.status !== 'confirmed') continue;
            const diffH = (new Date(apt.start).getTime() - nowMs) / 3600_000;
            const key = `u7_${apt.id}`;
            if (diffH > 0 && diffH <= 2.5 && !processed.has(key)) {
              const cust = cur.customers.find((c) => c.id === apt.customerId);
              if (cust && cust.consentSms !== false) {
                processed.add(key);
                count++;
                newOutbox.push({
                  id: `msg_2h_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                  to: cust.phone,
                  customerName: cust.name,
                  body: `${cust.name} عزیز، تا ۲ ساعت دیگر نوبت شما در ${cur.settings.businessName} شروع می‌شود. لطفاً عدد ۱ یا کلمه «تأیید» را ارسال کنید.`,
                  channel: 'sms',
                  ruleName: rule.name,
                  appointmentId: apt.id,
                  canSimulateConfirm: apt.status === 'booked',
                  at: nowIso,
                });
              }
            }
          }
          if (count > 0) {
            newLogs.push({
              id: `al_${Date.now()}_u7`,
              ruleId: rule.id,
              ruleName: rule.name,
              summary: `${count} پیامک یادآور ۲ ساعت قبل از نوبت ثبت شد.`,
              at: nowIso,
            });
          }
        }

        if (rule.id === 'u6') {
          let count = 0;
          const todayKey = new Date().toISOString().slice(0, 10);
          for (const cust of cur.customers) {
            if (cust.consentSms === false) continue;
            const bDays = daysUntilJalaliMonthDay(cust.birthDateJalali);
            const aDays = daysUntilJalaliMonthDay(cust.anniversaryDateJalali);
            if (bDays === 0) {
              const key = `u6_b_${cust.id}_${todayKey}`;
              if (!processed.has(key)) {
                processed.add(key);
                count++;
                newOutbox.push({
                  id: `msg_b_${Date.now()}_${cust.id}`,
                  to: cust.phone,
                  customerName: cust.name,
                  body: `${cust.name} عزیز، تولدتان مبارک! هدیه ۲۰٪ (کد VIP20) از طرف ${cur.settings.businessName} تقدیم شما می‌شود.`,
                  channel: 'sms',
                  ruleName: rule.name,
                  at: nowIso,
                });
              }
            }
            if (aDays === 0) {
              const key = `u6_a_${cust.id}_${todayKey}`;
              if (!processed.has(key)) {
                processed.add(key);
                count++;
                newOutbox.push({
                  id: `msg_a_${Date.now()}_${cust.id}`,
                  to: cust.phone,
                  customerName: cust.name,
                  body: `${cust.name} گرامی، سالگرد همراهی شما با ${cur.settings.businessName} را صمیمانه تبریک می‌گوییم!`,
                  channel: 'sms',
                  ruleName: rule.name,
                  at: nowIso,
                });
              }
            }
          }
          if (count > 0) {
            newLogs.push({
              id: `al_${Date.now()}_u6`,
              ruleId: rule.id,
              ruleName: rule.name,
              summary: `${count} پیامک خودکار تبریک تولد/سالگرد ارسال شد.`,
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

        if (rule.id === 'u5') {
          let count = 0;
          for (const cust of cur.customers) {
            if (!cust.contractExpiresAt) continue;
            const diffDays = (new Date(cust.contractExpiresAt).getTime() - nowMs) / (24 * 3600_000);
            const key = `u5_${cust.id}`;
            if (diffDays >= 0 && diffDays <= 7 && !processed.has(key) && count < 3) {
              processed.add(key);
              count++;
              newTasks.push({
                id: `t_auto_${Date.now()}_u5_${count}`,
                title: `تمدید قرارداد و لایسنس ${cust.name} (${cust.licenseKey ?? 'پشتیبانی'})`,
                customerId: cust.id,
                dueAt: cust.contractExpiresAt,
                done: false,
                createdByRuleId: rule.id,
              });
              if (cust.consentSms !== false) {
                newOutbox.push({
                  id: `msg_${Date.now()}_u5_${count}`,
                  to: cust.phone,
                  customerName: cust.name,
                  body: `${cust.name} گرامی، اعتبار قرارداد پشتیبانی شما در ${cur.settings.businessName} طی روزهای آینده به پایان می‌رسد.`,
                  channel: 'sms',
                  ruleName: rule.name,
                  at: nowIso,
                });
              }
            }
          }
          if (count > 0) {
            newLogs.push({
              id: `al_${Date.now()}_u5`,
              ruleId: rule.id,
              ruleName: rule.name,
              summary: `${count} هشدار تمدید قرارداد و پیامک یادآوری ثبت شد.`,
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
        schemaVersion: '3.0',
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
        const next = mergeLoadedState(payload);
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
        anonymizeCustomer,
        mergeCustomers,
        importCustomersBatch,
        rollbackCsvImportBatch,
        addCustomerRelation,
        removeCustomerRelation,
        addCustomerSegment,
        deleteCustomerSegment,
        addCustomerAttachment,
        removeCustomerAttachment,
        sendBirthdayGreeting,
        addInteraction,
        addCustomFieldDef,
        updateCustomFieldDef,
        removeCustomFieldDef,
        reorderCustomFieldDefs,
        addCustomEntityDef,
        deleteCustomEntityDef,
        addCustomEntityRecord,
        deleteCustomEntityRecord,
        addEntityRelation,
        removeEntityRelation,
        saveConfigSnapshot,
        restoreConfigSnapshot,
        addAppointment,
        rescheduleAppointment,
        updateAppointmentStatus,
        addService,
        addResource,
        addResourceTimeOff,
        removeResourceTimeOff,
        addOfficialHoliday,
        removeOfficialHoliday,
        addWaitlistEntry,
        bookFromWaitlist,
        simulateSmsConfirmReply,
        addOrder,
        updateOrderStatus,
        recordOrderShipment,
        adjustProductStock,
        addProduct,
        toggleCoupon,
        addCoupon,
        createInvoiceForOrder,
        recordInvoicePayment,
        addProject,
        updateProjectStatus,
        addProjectTask,
        toggleProjectTask,
        addTimeEntry,
        toggleDeploymentCheck,
        addOpportunity,
        moveOpportunityStage,
        convertOpportunityToCustomer,
        updatePipelineStages,
        updateSalesTargets,
        updateCommissionTiers,
        createQuote,
        createQuoteVersion,
        updateQuoteStatus,
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
        addRule,
        sendSimulatedSms,
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
