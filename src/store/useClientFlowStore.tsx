import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { INDUSTRY_PACKS, buildPackFromState, getPackSalesConfig } from '../data/packs';
import { DEFAULT_TENANT_ID } from '../data/repositories/customerRepository';
import { stampCreateMeta, stampUpdateMeta } from '../data/repositories/types';
import { createInitialState, defaultDashboardWidgets } from '../data/seed';
import { notificationProvider } from '../services/providers/notificationProvider';
import type {
  AppState,
  Appointment,
  AppointmentStatus,
  AuditLogEntry,
  AutomationPolicy,
  Branch,
  BusinessSettings,
  ClientFlowConfigBundle,
  CommissionLedgerEntry,
  CommissionLedgerStatus,
  CommissionRuleConfig,
  CommissionTier,
  ConfigSnapshot,
  ConsentChannel,
  ConsentLog,
  ContentItem,
  ContentStatus,
  Contract,
  ContractStatus,
  Coupon,
  CsvImportBatch,
  CustomEntityDef,
  CustomEntityRecord,
  CustomFieldDef,
  Customer,
  CustomerAttachment,
  CustomerRelation,
  CustomerSavedView,
  CustomerSegment,
  DashboardWidgetConfig,
  DeploymentCheckItem,
  EntityRelationDef,
  IndustryPack,
  Interaction,
  InteractionOutcome,
  Invoice,
  KbArticle,
  LandingForm,
  MarketingCampaign,
  MediaAsset,
  NotificationChannel,
  NpsSurvey,
  OfficialHoliday,
  Opportunity,
  Order,
  OrderChannel,
  OrderReturn,
  OrderShipment,
  OrderStatus,
  OutboxMessage,
  PackTemplate,
  PaymentAllocation,
  PaymentMethod,
  PaymentTransaction,
  PipelineStage,
  PipelineStageConfig,
  PriceList,
  Product,
  Project,
  ProjectStatus,
  Quote,
  QuoteStatus,
  Resource,
  ResourceTimeOff,
  Rule,
  RuleTriggerType,
  SalesLead,
  SalesPipeline,
  SalesTarget,
  SayadiCheque,
  SayadiChequeStatus,
  ScheduledReport,
  Service,
  StockMovement,
  Task,
  Ticket,
  TicketMessage,
  TimeEntry,
  UtmTouch,
  WaitlistEntry,
  WarrantyClaim,
  WarrantyRecord,
  WorkflowDefinition,
  WorkflowInstance,
  WorkflowStep,
  WorkflowType,
} from '../types';
import {
  countTodayCustomerNotifications,
  evaluateRuleConditions,
  getTargetRecordsForRule,
  isWithinQuietHours,
  renderRuleTemplate,
  simulateRuleDryRun,
  type DryRunResult,
} from '../utils/automationEngine';
import { configBundleSchema } from '../utils/customFieldValidation';
import { computeCommissionAmount, computeQuoteFinancials, daysUntilJalaliMonthDay } from '../utils/crmHelpers';
import { formatDocumentNumber } from '../utils/i18n';
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

  const normalizedFields = (parsed.customFieldDefs ?? fallback.customFieldDefs).map((f, idx) => ({
    ...f,
    entity: f.entity ?? 'customer',
    active: f.active ?? true,
    order: f.order ?? idx + 1,
  }));

  return {
    ...fallback,
    ...parsed,
    customFieldDefs: normalizedFields,
    rules: mergedRules,
    customerRelations: parsed.customerRelations ?? fallback.customerRelations,
    customerSegments: parsed.customerSegments ?? fallback.customerSegments,
    customerSavedViews: parsed.customerSavedViews ?? fallback.customerSavedViews,
    consentLogs: parsed.consentLogs ?? fallback.consentLogs,
    csvImportBatches: parsed.csvImportBatches ?? fallback.csvImportBatches,
    customEntityDefs: parsed.customEntityDefs ?? fallback.customEntityDefs,
    customEntityRecords: parsed.customEntityRecords ?? fallback.customEntityRecords,
    entityRelations: parsed.entityRelations ?? fallback.entityRelations,
    configSnapshots: parsed.configSnapshots ?? fallback.configSnapshots,
    leads: parsed.leads ?? fallback.leads,
    pipelines:
      parsed.pipelines && parsed.pipelines.length > 0
        ? parsed.pipelines
        : fallback.pipelines,
    pipelineStages: parsed.pipelineStages ?? fallback.pipelineStages,
    priceLists: parsed.priceLists ?? fallback.priceLists,
    quotes: parsed.quotes ?? fallback.quotes,
    salesTargets: parsed.salesTargets ?? fallback.salesTargets,
    commissionTiers: parsed.commissionTiers ?? fallback.commissionTiers,
    commissionRule: parsed.commissionRule ?? fallback.commissionRule,
    commissionLedger: parsed.commissionLedger ?? fallback.commissionLedger,
    stockMovements: parsed.stockMovements ?? fallback.stockMovements,
    projects: parsed.projects ?? fallback.projects,
    timeEntries: parsed.timeEntries ?? fallback.timeEntries,
    resourceTimeOffs: parsed.resourceTimeOffs ?? fallback.resourceTimeOffs,
    officialHolidays: parsed.officialHolidays ?? fallback.officialHolidays,
    waitlist: parsed.waitlist ?? fallback.waitlist,
    workflowDefinitions: parsed.workflowDefinitions ?? fallback.workflowDefinitions,
    campaigns: parsed.campaigns ?? fallback.campaigns,
    mediaAssets: parsed.mediaAssets ?? fallback.mediaAssets,
    landingForms: parsed.landingForms ?? fallback.landingForms,
    utmTouches: parsed.utmTouches ?? fallback.utmTouches,
    ticketMessages: parsed.ticketMessages ?? fallback.ticketMessages,
    sayadiCheques: parsed.sayadiCheques ?? fallback.sayadiCheques,
    paymentTransactions: parsed.paymentTransactions ?? fallback.paymentTransactions,
    paymentAllocations: parsed.paymentAllocations ?? fallback.paymentAllocations,
    contracts: parsed.contracts ?? fallback.contracts,
    warranties: parsed.warranties ?? fallback.warranties,
    recentIdempotencyKeys: parsed.recentIdempotencyKeys ?? fallback.recentIdempotencyKeys ?? [],
    scheduledReports: parsed.scheduledReports ?? fallback.scheduledReports,
    branches: parsed.branches ?? fallback.branches,
    customPacks: parsed.customPacks ?? fallback.customPacks,
    automationPolicy: {
      ...fallback.automationPolicy,
      ...(parsed.automationPolicy ?? {}),
    },
    settings: {
      ...fallback.settings,
      ...(parsed.settings ?? {}),
      salesTeam: parsed.settings?.salesTeam ?? fallback.settings.salesTeam,
      numbering: {
        ...fallback.settings.numbering,
        ...(parsed.settings?.numbering ?? {}),
      },
      dashboardWidgets:
        parsed.settings?.dashboardWidgets && parsed.settings.dashboardWidgets.length > 0
          ? parsed.settings.dashboardWidgets
          : fallback.settings.dashboardWidgets,
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

  // Customers, Relations, Segments, Saved Views, Consent Logs, CSV Rollback, PII Anonymization & Attachments
  addCustomer: (data: Omit<Customer, 'id' | 'createdAt'>) => { ok: boolean; error?: string; customer?: Customer };
  updateCustomer: (id: string, data: Partial<Customer>) => { ok: boolean; error?: string };
  updateCustomerConsent: (
    customerId: string,
    channel: ConsentChannel,
    granted: boolean,
    source?: string,
    note?: string,
  ) => void;
  deleteCustomer: (id: string) => { ok: boolean; error?: string };
  anonymizeCustomer: (id: string) => { ok: boolean; error?: string };
  mergeCustomers: (
    primaryId: string,
    duplicateId: string,
    mergedCustomerPatch?: Partial<Customer>,
  ) => { ok: boolean; error?: string };
  importCustomersBatch: (items: Customer[], fileName?: string) => number;
  rollbackCsvImportBatch: (batchId: string) => void;
  addCustomerRelation: (data: Omit<CustomerRelation, 'id' | 'createdAt'>) => void;
  removeCustomerRelation: (id: string) => void;
  addCustomerSegment: (seg: Omit<CustomerSegment, 'id' | 'createdAt'>) => void;
  updateCustomerSegment: (id: string, patch: Partial<CustomerSegment>) => void;
  deleteCustomerSegment: (id: string) => void;
  saveCustomerView: (view: Omit<CustomerSavedView, 'id' | 'createdAt'>) => void;
  deleteCustomerView: (id: string) => void;
  addCustomerAttachment: (customerId: string, att: Omit<CustomerAttachment, 'id' | 'uploadedAt'>) => void;
  removeCustomerAttachment: (customerId: string, attachmentId: string) => void;
  sendBirthdayGreeting: (customerId: string, kind: 'birthday' | 'anniversary') => void;
  addInteraction: (
    customerId: string,
    channel: Interaction['channel'],
    text: string,
    options?: { outcome?: InteractionOutcome; followUpAt?: string; createFollowUpTask?: boolean },
  ) => void;

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
  sendAppointmentReminder: (appointmentId: string) => { ok: boolean; error?: string };

  // Orders, Shop, Inventory, Shipments, Returns, Invoices, Allocations, Contracts, Warranties, Projects
  addOrder: (data: {
    customerId: string;
    channel?: OrderChannel;
    idempotencyKey?: string;
    items: { productId?: string; name: string; qty: number; price: number }[];
    promisedAt?: string;
    couponCode?: string;
    customFields?: Record<string, string>;
  }) => { ok: boolean; error?: string; order?: Order };
  updateOrderStatus: (id: string, nextStatus: OrderStatus, trackingCode?: string) => void;
  recordOrderShipment: (orderId: string, shipment: Omit<OrderShipment, 'id' | 'shippedAt'>) => void;
  recordOrderReturn: (
    orderId: string,
    data: {
      items: { name: string; qty: number; price: number }[];
      refundAmount: number;
      refundMethod: PaymentMethod;
      reason: string;
      restock: boolean;
    },
  ) => void;
  adjustProductStock: (productId: string, delta: number, reason: string) => void;
  addProduct: (product: Omit<Product, 'id'>) => void;
  toggleCoupon: (id: string) => void;
  addCoupon: (coupon: Omit<Coupon, 'id' | 'usedCount'>) => void;
  createInvoiceForOrder: (orderId: string, method?: PaymentMethod) => void;
  createInvoiceFromContract: (contractId: string, method?: PaymentMethod) => void;
  recordInvoicePayment: (invoiceId: string, amount: number, method: PaymentMethod) => void;
  allocatePaymentToInvoices: (data: {
    customerId: string;
    totalAmount: number;
    method: PaymentMethod;
    reference?: string;
    note?: string;
    allocations: { invoiceId: string; amount: number }[];
  }) => { ok: boolean; error?: string };
  sendOverdueInvoiceReminder: (invoiceId: string) => { ok: boolean; error?: string };
  addContract: (data: Omit<Contract, 'id' | 'contractNo' | 'createdAt'>) => void;
  renewContract: (contractId: string) => void;
  updateContractStatus: (contractId: string, status: ContractStatus) => void;
  runContractRenewalReminders: () => number;
  addWarrantyRecord: (data: Omit<WarrantyRecord, 'id' | 'claims' | 'createdAt'>) => void;
  addWarrantyClaim: (warrantyId: string, claim: Omit<WarrantyClaim, 'id'>) => void;
  updateWarrantyClaimStatus: (warrantyId: string, claimId: string, status: WarrantyClaim['status']) => void;
  addProject: (data: { title: string; customerId: string; dueAt: string }) => void;
  updateProjectStatus: (id: string, status: ProjectStatus) => void;
  addProjectTask: (projectId: string, task: { title: string; assignee: string; estimatedHours: number; dueAt?: string }) => void;
  toggleProjectTask: (projectId: string, taskId: string) => void;
  addProjectTaskSubtask: (projectId: string, taskId: string, title: string) => void;
  toggleProjectTaskSubtask: (projectId: string, taskId: string, subtaskId: string) => void;
  addTimeEntry: (entry: Omit<TimeEntry, 'id' | 'loggedAt'>) => void;
  toggleDeploymentCheck: (projectId: string, checkId: string) => void;

  // Sales Leads, Multiple Pipelines, Catalog/PriceLists, Quotes Approval, Targets & Commissions
  addLead: (
    data: Omit<SalesLead, 'id' | 'createdAt' | 'updatedAt' | 'assignedByRule'>,
    useRoundRobin?: boolean,
  ) => { ok: boolean; error?: string; lead?: SalesLead };
  updateLead: (id: string, patch: Partial<SalesLead>) => void;
  convertLeadToCustomerAndOpportunity: (
    leadId: string,
    options?: { pipelineId?: string; opportunityTitle?: string; expectedCloseDate?: string },
  ) => { ok: boolean; error?: string };
  addPipeline: (pipeline: Omit<SalesPipeline, 'id'>) => void;
  updatePipeline: (id: string, patch: Partial<SalesPipeline>) => void;
  deletePipeline: (id: string) => void;
  updateProduct: (id: string, patch: Partial<Product>) => void;
  updateService: (id: string, patch: Partial<Service>) => void;
  addPriceList: (pl: Omit<PriceList, 'id'>) => void;
  updatePriceList: (id: string, patch: Partial<PriceList>) => void;
  deletePriceList: (id: string) => void;
  addOpportunity: (
    data: Omit<Opportunity, 'id' | 'createdAt' | 'updatedAt'>,
    useRoundRobin?: boolean,
  ) => { ok: boolean; error?: string };
  moveOpportunityStage: (id: string, stage: PipelineStage, lostReason?: string) => void;
  convertOpportunityToCustomer: (oppId: string) => void;
  updatePipelineStages: (stages: PipelineStageConfig[]) => void;
  updateSalesTargets: (targets: SalesTarget[]) => void;
  updateCommissionTiers: (tiers: CommissionTier[]) => void;
  updateCommissionRule: (rule: CommissionRuleConfig) => void;
  approveCommissionEntry: (id: string, nextStatus: CommissionLedgerStatus) => void;
  generateMissingCommissions: () => void;
  createQuote: (
    data: Omit<Quote, 'id' | 'quoteNo' | 'version' | 'shareToken' | 'createdAt'>,
  ) => void;
  createQuoteVersion: (
    parentQuoteId: string,
    patch?: Partial<Pick<Quote, 'items' | 'discountPct' | 'taxPct' | 'priceListId' | 'priceListName' | 'notes' | 'validUntil'>>,
  ) => void;
  updateQuoteStatus: (id: string, status: QuoteStatus, clientComment?: string) => { ok: boolean; error?: string };
  approveQuoteDiscount: (id: string, approved: boolean) => void;

  // Workflows (BPMS + Visual BPMN Designer)
  saveWorkflowDefinition: (def: Omit<WorkflowDefinition, 'id' | 'updatedAt'> & { id?: string }) => void;
  publishWorkflowDefinition: (id: string) => void;
  cloneWorkflowDraft: (id: string) => void;
  deleteWorkflowDefinition: (id: string) => void;
  createWorkflowInstance: (data: {
    title: string;
    type: WorkflowType;
    definitionId?: string;
    customerId?: string;
    relatedRef?: string;
  }) => void;
  decideWorkflowStep: (
    id: string,
    decision: 'approved' | 'rejected',
    comment?: string,
    stepData?: Record<string, string>,
    branchIndex?: number,
  ) => { ok: boolean; error?: string };
  claimWorkflowStep: (id: string) => void;
  reassignWorkflowStep: (id: string, assignee: string) => void;
  delegateWorkflowStep: (id: string, delegateTo: string) => void;
  advanceWorkflowTimer: (id: string) => void;

  // Marketing Content Calendar, Campaigns (A/B), Media Library, Landing Forms & UTM
  addContentItem: (item: Omit<ContentItem, 'id' | 'reach' | 'leadsCount'>) => void;
  updateContentStatus: (id: string, status: ContentStatus) => void;
  updateContentItem: (
    id: string,
    patch: Partial<Pick<ContentItem, 'title' | 'caption' | 'reach' | 'leadsCount' | 'hasBeforeAfterConsent' | 'status' | 'mediaAssetId'>>,
  ) => void;
  addCampaign: (c: Omit<MarketingCampaign, 'id' | 'createdAt' | 'status'>) => void;
  launchCampaign: (id: string) => void;
  simulateCampaignStats: (id: string) => void;
  addMediaAsset: (asset: Omit<MediaAsset, 'id' | 'uploadedAt'>) => void;
  deleteMediaAsset: (id: string) => void;
  addLandingForm: (form: Omit<LandingForm, 'id' | 'submissionsCount' | 'createdAt'>) => void;
  submitLandingForm: (
    formId: string,
    data: { name: string; phone: string; email?: string; companyName?: string; notes?: string },
  ) => { ok: boolean; error?: string };

  // Tasks, Tickets, TicketMessages, SLA Escalation, Merge & Knowledge Base Versioning
  addTask: (data: {
    title: string;
    customerId?: string;
    dueAt: string;
    assignee?: string;
    priority?: Task['priority'];
    subtasks?: { id: string; title: string; done: boolean }[];
    projectId?: string;
  }) => void;
  toggleTaskDone: (id: string) => void;
  addTaskSubtask: (taskId: string, title: string) => void;
  toggleTaskSubtask: (taskId: string, subtaskId: string) => void;
  addTicket: (data: {
    customerId: string;
    subject: string;
    priority: Ticket['priority'];
    category?: string;
    team?: string;
    assignee?: string;
    rootCause?: string;
    initialBody?: string;
    customFields?: Record<string, string>;
  }) => void;
  updateTicket: (
    id: string,
    patch: Partial<Pick<Ticket, 'status' | 'priority' | 'replyNote' | 'assignee' | 'team' | 'category' | 'rootCause'>>,
  ) => void;
  addTicketMessage: (
    ticketId: string,
    msg: { authorName: string; authorType: 'customer' | 'agent'; visibility: 'public' | 'internal'; body: string },
  ) => void;
  mergeTickets: (primaryId: string, duplicateId: string) => { ok: boolean; error?: string };
  checkAndEscalateTickets: (silent?: boolean) => number;
  addKbArticle: (article: Omit<KbArticle, 'id' | 'helpfulCount' | 'updatedAt'>) => void;
  updateKbArticle: (
    id: string,
    patch: { title: string; category: string; body: string; changeNote?: string },
  ) => void;
  restoreKbVersion: (id: string, version: number) => void;
  voteKbHelpful: (id: string) => void;

  // NPS
  submitNpsSurvey: (data: Omit<NpsSurvey, 'id' | 'createdAt'>) => void;
  triggerNpsPrompt: (prompt: PendingNpsPrompt) => void;

  // Automation & Multi-Channel Notification Queue
  toggleRule: (id: string) => void;
  addRule: (rule: Omit<Rule, 'id'>) => void;
  updateRule: (id: string, patch: Partial<Rule>) => void;
  deleteRule: (id: string) => void;
  updateAutomationPolicy: (patch: Partial<AutomationPolicy>) => void;
  dryRunRule: (rule: Rule, hourOverride?: number) => DryRunResult;
  sendSimulatedSms: (customerId: string, body: string, channel?: NotificationChannel) => { ok: boolean; error?: string };
  runAutomationNow: (silent?: boolean) => number;
  retryNotification: (id: string) => void;
  processNotificationRetries: () => void;
  simulateDeliveryFailure: (id: string) => void;
  clearOutbox: () => void;

  // Finance: Sayadi Cheques & Sandbox Payment Gateway (FR-FIN-04/05)
  addSayadiCheque: (data: Omit<SayadiCheque, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateSayadiChequeStatus: (id: string, status: SayadiChequeStatus, note?: string) => void;
  processSandboxPayment: (data: {
    invoiceId: string;
    gateway: PaymentTransaction['gateway'];
    amount: number;
    cardMasked: string;
    outcome: 'succeeded' | 'failed' | 'cancelled';
  }) => { ok: boolean; refId?: string; errorMessage?: string };

  // Reports & Dashboard Customization (FR-RPT-01/04)
  updateDashboardWidgets: (widgets: DashboardWidgetConfig[]) => void;
  resetDashboardWidgets: () => void;
  addScheduledReport: (rep: Omit<ScheduledReport, 'id' | 'nextRunAt'>) => void;
  toggleScheduledReport: (id: string) => void;
  deleteScheduledReport: (id: string) => void;
  runScheduledReportNow: (id: string) => void;

  // Packs & Pack Builder (Section 7)
  applyIndustryPack: (packKey: IndustryPack, installDefaults?: boolean) => void;
  saveCustomPack: (meta: { key: string; name: string; nameEn?: string; description: string }) => PackTemplate;
  importCustomPack: (pack: PackTemplate) => void;

  // Multi-Branch (FR-CORE-04) & Settings & System
  addBranch: (branch: Omit<Branch, 'id'>) => void;
  updateBranch: (id: string, patch: Partial<Branch>) => void;
  deleteBranch: (id: string) => void;
  updateSettings: (patch: Partial<BusinessSettings>) => void;
  resetDemoData: () => void;
  exportStateJson: () => string;
  importStateJson: (raw: string) => { ok: boolean; error?: string };
  exportConfigJson: () => string;
  importConfigJson: (raw: string) => { ok: boolean; error?: string };
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
    const lang = state.settings.language ?? 'fa';
    root.lang = lang;
    root.dir = lang === 'en' ? 'ltr' : 'rtl';
  }, [state.settings.darkMode, state.settings.language]);

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

  // --- EVENT-DRIVEN AUTOMATION ENGINE (FR-AUT) ---
  const fireAutomationEvent = useCallback(
    (
      triggerType: RuleTriggerType,
      targetEntity: NonNullable<Rule['targetEntity']>,
      record: Record<string, unknown>,
    ) => {
      const cur = stateRef.current;
      const matchingRules = cur.rules.filter(
        (r) =>
          r.active &&
          r.triggerType === triggerType &&
          (r.targetEntity ?? 'customer') === targetEntity &&
          (!r.pack || r.pack === 'all' || r.pack === cur.settings.industryPack),
      );
      if (matchingRules.length === 0) return;

      const nowIso = new Date().toISOString();
      const newOutbox: OutboxMessage[] = [];
      const newTasks: Task[] = [];
      const newLogs: AppState['automationLogs'] = [];
      const newProcessed: string[] = [];

      for (const rule of matchingRules) {
        const candidates = getTargetRecordsForRule(rule, cur, { entity: targetEntity, record });
        let ruleActions = 0;
        for (const cand of candidates) {
          if (!evaluateRuleConditions(rule, cand.record, cand.customer)) continue;
          const key = `${rule.id}_${cand.entityId}_${triggerType}`;
          if (cur.processedRuleKeys.includes(key)) continue;
          newProcessed.push(key);

          const actionType = rule.actionType ?? 'send_notification';
          const ch = rule.actionChannel ?? 'sms';
          const quiet = (rule.respectQuietHours ?? true) && isWithinQuietHours(cur.automationPolicy);
          const cap = rule.dailyCapPerCustomer ?? cur.automationPolicy.defaultDailyCap;
          const todayCount = countTodayCustomerNotifications(
            [...cur.outbox, ...newOutbox],
            cand.customer?.id,
            cand.customer?.phone,
          );

          if ((actionType === 'send_notification' || actionType === 'both') && cand.customer) {
            const consentOk = ch !== 'sms' || cand.customer.consentSms !== false;
            if (consentOk && (cap <= 0 || todayCount < cap)) {
              ruleActions++;
              newOutbox.push({
                id: `msg_evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                to: cand.customer.phone,
                customerId: cand.customer.id,
                customerName: cand.customer.name,
                body: renderRuleTemplate(
                  rule.messageTemplate || 'سلام {{customer.name}}، رویداد جدید در {{businessName}} ثبت شد.',
                  { customer: cand.customer, entity: cand.record, businessName: cur.settings.businessName },
                ),
                channel: ch,
                ruleId: rule.id,
                ruleName: rule.name,
                deliveryStatus: quiet ? 'deferred_quiet' : 'delivered',
                retryCount: 0,
                maxRetries: cur.automationPolicy.maxRetries,
                at: nowIso,
              });
            }
          }

          if (actionType === 'create_task' || actionType === 'both') {
            ruleActions++;
            newTasks.push({
              id: `t_evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              title: renderRuleTemplate(
                rule.taskTitleTemplate || 'پیگیری خودکار {{customer.name}}',
                { customer: cand.customer, entity: cand.record, businessName: cur.settings.businessName },
              ),
              customerId: cand.customer?.id,
              dueAt: new Date(Date.now() + 24 * 3600_000).toISOString(),
              done: false,
              createdByRuleId: rule.id,
            });
          }
        }
        if (ruleActions > 0) {
          newLogs.push({
            id: `al_evt_${Date.now()}_${rule.id}`,
            ruleId: rule.id,
            ruleName: rule.name,
            summary: `اجرای رویدادمحور (${triggerType}): ${ruleActions} اقدام انجام شد.`,
            at: nowIso,
          });
        }
      }

      if (newOutbox.length > 0 || newTasks.length > 0) {
        setState((prev) => ({
          ...prev,
          outbox: [...newOutbox, ...prev.outbox],
          tasks: [...newTasks, ...prev.tasks],
          automationLogs: [...newLogs, ...prev.automationLogs],
          processedRuleKeys: [...prev.processedRuleKeys, ...newProcessed],
        }));
      }
    },
    [],
  );

  // --- CRM & CUSTOMERS ---
  const getRepoCtx = () => ({
    tenantId: DEFAULT_TENANT_ID,
    actorName: stateRef.current.settings.role === 'admin' ? 'مدیر سیستم' : 'کارشناس',
  });

  const addCustomer = useCallback(
    (data: Omit<Customer, 'id' | 'createdAt'>) => {
      if (!data.name.trim()) return { ok: false, error: 'نام مشتری الزامی است.' };
      if (!isValidIranMobile(data.phone)) {
        return { ok: false, error: 'شماره موبایل معتبر نیست (فرمت صحیح: ۰۹xxxxxxxxx).' };
      }
      if (data.nationalId && !isValidNationalId(data.nationalId)) {
        return { ok: false, error: 'کد ملی معتبر نیست (رقم کنترل کد ملی صحیح نیست).' };
      }
      const activeBranch =
        stateRef.current.settings.activeBranchId !== 'all'
          ? stateRef.current.settings.activeBranchId
          : stateRef.current.branches[0]?.id;
      const nowIso = new Date().toISOString();
      const ctx = getRepoCtx();
      const customer = stampCreateMeta<Customer>(
        {
          ...data,
          branchId: data.branchId ?? activeBranch,
          consentUpdatedAt: nowIso,
          id: `c_${Date.now()}`,
          createdAt: nowIso,
        },
        ctx,
        nowIso,
      );
      const initialLogs: ConsentLog[] = [
        stampCreateMeta<ConsentLog>(
          {
            id: `cl_${Date.now()}_sms`,
            customerId: customer.id,
            channel: 'sms',
            granted: customer.consentSms !== false,
            source: 'فرم ثبت مشتری',
            actor: ctx.actorName,
            at: nowIso,
            createdAt: nowIso,
          },
          ctx,
          nowIso,
        ),
        stampCreateMeta<ConsentLog>(
          {
            id: `cl_${Date.now()}_email`,
            customerId: customer.id,
            channel: 'email',
            granted: customer.consentEmail !== false,
            source: 'فرم ثبت مشتری',
            actor: ctx.actorName,
            at: nowIso,
            createdAt: nowIso,
          },
          ctx,
          nowIso,
        ),
      ];
      setState((prev) => ({
        ...prev,
        customers: [customer, ...prev.customers],
        consentLogs: [...initialLogs, ...(prev.consentLogs ?? [])],
        auditLogs: [makeAudit('مشتری', 'create', `مشتری «${customer.name}» ثبت شد.`), ...prev.auditLogs].slice(0, 100),
      }));
      setTimeout(() => fireAutomationEvent('on_create', 'customer', customer as unknown as Record<string, unknown>), 50);
      pushToast(`مشتری «${customer.name}» ثبت شد.`);
      return { ok: true, customer };
    },
    [fireAutomationEvent, pushToast],
  );

  const updateCustomer = useCallback(
    (id: string, data: Partial<Customer>) => {
      if (data.phone !== undefined && !isValidIranMobile(data.phone)) {
        return { ok: false, error: 'شماره موبایل معتبر نیست (فرمت صحیح: ۰۹xxxxxxxxx).' };
      }
      if (data.nationalId && !isValidNationalId(data.nationalId)) {
        return { ok: false, error: 'کد ملی معتبر نیست (رقم کنترل کد ملی صحیح نیست).' };
      }
      const existing = stateRef.current.customers.find((c) => c.id === id);
      if (!existing) return { ok: false, error: 'مشتری یافت نشد.' };

      const ctx = getRepoCtx();
      const nowIso = new Date().toISOString();
      const newConsentLogs: ConsentLog[] = [];
      if (data.consentSms !== undefined && data.consentSms !== (existing.consentSms !== false)) {
        newConsentLogs.push(
          stampCreateMeta<ConsentLog>(
            {
              id: `cl_${Date.now()}_sms`,
              customerId: id,
              channel: 'sms',
              granted: data.consentSms,
              source: 'ویرایش پرونده مشتری',
              actor: ctx.actorName,
              at: nowIso,
              createdAt: nowIso,
            },
            ctx,
            nowIso,
          ),
        );
      }
      if (data.consentEmail !== undefined && data.consentEmail !== (existing.consentEmail !== false)) {
        newConsentLogs.push(
          stampCreateMeta<ConsentLog>(
            {
              id: `cl_${Date.now()}_email`,
              customerId: id,
              channel: 'email',
              granted: data.consentEmail,
              source: 'ویرایش پرونده مشتری',
              actor: ctx.actorName,
              at: nowIso,
              createdAt: nowIso,
            },
            ctx,
            nowIso,
          ),
        );
      }

      const updatedCustomer = stampUpdateMeta(
        {
          ...existing,
          ...data,
          consentUpdatedAt: newConsentLogs.length > 0 ? nowIso : existing.consentUpdatedAt,
        },
        ctx,
        nowIso,
      );

      setState((prev) => ({
        ...prev,
        customers: prev.customers.map((c) => (c.id === id ? updatedCustomer : c)),
        consentLogs:
          newConsentLogs.length > 0
            ? [...newConsentLogs, ...(prev.consentLogs ?? [])]
            : prev.consentLogs ?? [],
        auditLogs: [makeAudit('مشتری', 'update', `اطلاعات مشتری ${data.name ?? existing.name} ویرایش شد.`), ...prev.auditLogs].slice(0, 100),
      }));
      setTimeout(() => fireAutomationEvent('on_update', 'customer', updatedCustomer as unknown as Record<string, unknown>), 50);
      pushToast('اطلاعات مشتری به‌روزرسانی شد.');
      return { ok: true };
    },
    [fireAutomationEvent, pushToast],
  );

  const updateCustomerConsent = useCallback(
    (customerId: string, channel: ConsentChannel, granted: boolean, source = 'پرونده ۳۶۰ مشتری', note?: string) => {
      const existing = stateRef.current.customers.find((c) => c.id === customerId);
      if (!existing) return;
      const ctx = getRepoCtx();
      const nowIso = new Date().toISOString();
      const patch: Partial<Customer> =
        channel === 'sms'
          ? { consentSms: granted }
          : channel === 'email'
            ? { consentEmail: granted }
            : { consentPhoto: granted };

      const log = stampCreateMeta<ConsentLog>(
        {
          id: `cl_${Date.now()}_${channel}`,
          customerId,
          channel,
          granted,
          source,
          actor: ctx.actorName,
          note,
          at: nowIso,
          createdAt: nowIso,
        },
        ctx,
        nowIso,
      );

      setState((prev) => ({
        ...prev,
        customers: prev.customers.map((c) =>
          c.id === customerId
            ? stampUpdateMeta({ ...c, ...patch, consentUpdatedAt: nowIso }, ctx, nowIso)
            : c,
        ),
        consentLogs: [log, ...(prev.consentLogs ?? [])],
        auditLogs: [
          makeAudit(
            'مشتری',
            'update',
            `وضعیت رضایت ${channel.toUpperCase()} برای «${existing.name}» به ${granted ? 'تأیید' : 'لغو'} تغییر یافت.`,
          ),
          ...prev.auditLogs,
        ].slice(0, 100),
      }));
      pushToast(`وضعیت رضایت (${channel === 'sms' ? 'پیامک' : channel === 'email' ? 'ایمیل' : 'تصویر'}) به‌روزرسانی و ثبت شد.`);
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
      const ctx = getRepoCtx();
      const nowIso = new Date().toISOString();
      setState((prev) => ({
        ...prev,
        customers: prev.customers.map((c) =>
          c.id === id
            ? stampUpdateMeta(
                {
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
                  consentEmail: false,
                  consentPhoto: false,
                  consentUpdatedAt: nowIso,
                  isAnonymized: true,
                },
                ctx,
                nowIso,
              )
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
    (primaryId: string, duplicateId: string, mergedCustomerPatch?: Partial<Customer>) => {
      if (stateRef.current.settings.role !== 'admin') {
        return { ok: false, error: 'ادغام پرونده مشتریان فقط برای مدیر مجاز است.' };
      }
      if (primaryId === duplicateId) return { ok: false, error: 'مشتری مبدأ و مقصد یکسان است.' };
      const primary = stateRef.current.customers.find((c) => c.id === primaryId);
      const dup = stateRef.current.customers.find((c) => c.id === duplicateId);
      if (!primary || !dup) return { ok: false, error: 'رکورد مشتری یافت نشد.' };

      const ctx = getRepoCtx();
      const nowIso = new Date().toISOString();
      const mergedTags = Array.from(new Set([...primary.tags, ...dup.tags]));

      setState((prev) => {
        const remappedRelations = prev.customerRelations
          .map((r) => ({
            ...r,
            fromCustomerId: r.fromCustomerId === duplicateId ? primaryId : r.fromCustomerId,
            toCustomerId: r.toCustomerId === duplicateId ? primaryId : r.toCustomerId,
          }))
          .filter((r) => r.fromCustomerId !== r.toCustomerId);

        const seenRel = new Set<string>();
        const dedupedRelations = remappedRelations.filter((r) => {
          const key = `${r.fromCustomerId}::${r.toCustomerId}::${r.relationType}`;
          if (seenRel.has(key)) return false;
          seenRel.add(key);
          return true;
        });

        return {
          ...prev,
          customers: prev.customers
            .filter((c) => c.id !== duplicateId)
            .map((c) =>
              c.id === primaryId
                ? stampUpdateMeta(
                    {
                      ...c,
                      email: c.email || dup.email,
                      nationalId: c.nationalId || dup.nationalId,
                      companyName: c.companyName || dup.companyName,
                      economicCode: c.economicCode || dup.economicCode,
                      registrationNo: c.registrationNo || dup.registrationNo,
                      birthDateJalali: c.birthDateJalali || dup.birthDateJalali,
                      anniversaryDateJalali: c.anniversaryDateJalali || dup.anniversaryDateJalali,
                      ownerName: c.ownerName || dup.ownerName,
                      ...mergedCustomerPatch,
                      tags: mergedTags,
                      contacts: [...(c.contacts ?? []), ...(dup.contacts ?? [])],
                      addresses: [...(c.addresses ?? []), ...(dup.addresses ?? [])],
                      attachments: [...(c.attachments ?? []), ...(dup.attachments ?? [])],
                      customFields: { ...(dup.customFields ?? {}), ...(c.customFields ?? {}) },
                      notes: [c.notes, dup.notes].filter(Boolean).join(' | ') || undefined,
                    },
                    ctx,
                    nowIso,
                  )
                : c,
            ),
          customerRelations: dedupedRelations,
          interactions: prev.interactions.map((i) =>
            i.customerId === duplicateId ? { ...i, customerId: primaryId } : i,
          ),
          appointments: prev.appointments.map((a) =>
            a.customerId === duplicateId ? { ...a, customerId: primaryId } : a,
          ),
          waitlist: prev.waitlist.map((w) =>
            w.customerId === duplicateId ? { ...w, customerId: primaryId } : w,
          ),
          orders: prev.orders.map((o) =>
            o.customerId === duplicateId ? { ...o, customerId: primaryId } : o,
          ),
          invoices: prev.invoices.map((inv) =>
            inv.customerId === duplicateId ? { ...inv, customerId: primaryId } : inv,
          ),
          sayadiCheques: prev.sayadiCheques.map((ch) =>
            ch.customerId === duplicateId ? { ...ch, customerId: primaryId } : ch,
          ),
          paymentTransactions: prev.paymentTransactions.map((pt) =>
            pt.customerId === duplicateId ? { ...pt, customerId: primaryId } : pt,
          ),
          paymentAllocations: (prev.paymentAllocations ?? []).map((pa) =>
            pa.customerId === duplicateId ? { ...pa, customerId: primaryId } : pa,
          ),
          contracts: (prev.contracts ?? []).map((ct) =>
            ct.customerId === duplicateId ? { ...ct, customerId: primaryId } : ct,
          ),
          warranties: (prev.warranties ?? []).map((wr) =>
            wr.customerId === duplicateId ? { ...wr, customerId: primaryId } : wr,
          ),
          projects: prev.projects.map((pr) =>
            pr.customerId === duplicateId ? { ...pr, customerId: primaryId } : pr,
          ),
          opportunities: prev.opportunities.map((opp) =>
            opp.customerId === duplicateId ? { ...opp, customerId: primaryId } : opp,
          ),
          quotes: prev.quotes.map((q) =>
            q.customerId === duplicateId ? { ...q, customerId: primaryId } : q,
          ),
          workflows: prev.workflows.map((wf) =>
            wf.customerId === duplicateId ? { ...wf, customerId: primaryId } : wf,
          ),
          customEntityRecords: prev.customEntityRecords.map((er) =>
            er.relatedCustomerId === duplicateId ? { ...er, relatedCustomerId: primaryId } : er,
          ),
          utmTouches: prev.utmTouches.map((u) =>
            u.customerId === duplicateId ? { ...u, customerId: primaryId } : u,
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
          consentLogs: (prev.consentLogs ?? []).map((cl) =>
            cl.customerId === duplicateId ? { ...cl, customerId: primaryId } : cl,
          ),
          outbox: prev.outbox.map((m) =>
            m.customerId === duplicateId ? { ...m, customerId: primaryId, customerName: primary.name } : m,
          ),
          customerSegments: prev.customerSegments.map((seg) =>
            seg.staticCustomerIds?.includes(duplicateId)
              ? {
                  ...seg,
                  staticCustomerIds: Array.from(
                    new Set(seg.staticCustomerIds.map((cid) => (cid === duplicateId ? primaryId : cid))),
                  ),
                }
              : seg,
          ),
          auditLogs: [
            makeAudit('مشتری', 'merge', `پرونده «${dup.name}» در «${primary.name}» ادغام کامل شد.`),
            ...prev.auditLogs,
          ].slice(0, 100),
        };
      });
      pushToast(`پرونده «${dup.name}» با حفظ تمام سوابق در «${primary.name}» ادغام شد.`);
      return { ok: true };
    },
    [pushToast],
  );

  const importCustomersBatch = useCallback(
    (items: Customer[], fileName = 'import.csv') => {
      if (items.length === 0) return 0;
      const ctx = getRepoCtx();
      const nowIso = new Date().toISOString();
      const stampedItems = items.map((i) => stampCreateMeta(i, ctx, nowIso));
      const batch = stampCreateMeta<CsvImportBatch>(
        {
          id: `batch_${Date.now()}`,
          fileName,
          customerIds: stampedItems.map((i) => i.id),
          count: stampedItems.length,
          importedAt: nowIso,
          rolledBack: false,
        },
        ctx,
        nowIso,
      );
      setState((prev) => ({
        ...prev,
        customers: [...stampedItems, ...prev.customers],
        csvImportBatches: [batch, ...prev.csvImportBatches].slice(0, 20),
        auditLogs: [
          makeAudit('مشتری', 'create', `${stampedItems.length} مشتری از فایل «${fileName}» وارد شد.`),
          ...prev.auditLogs,
        ].slice(0, 100),
      }));
      pushToast(`${stampedItems.length} مشتری از فایل وارد شد (قابل بازگشت در تاریخچه).`);
      return stampedItems.length;
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
      const ctx = getRepoCtx();
      const nowIso = new Date().toISOString();
      const rel = stampCreateMeta<CustomerRelation>(
        {
          ...data,
          id: `rel_${Date.now()}`,
          createdAt: nowIso,
        },
        ctx,
        nowIso,
      );
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
      const ctx = getRepoCtx();
      const nowIso = new Date().toISOString();
      const created = stampCreateMeta<CustomerSegment>(
        {
          ...seg,
          segmentType: seg.segmentType ?? 'dynamic',
          id: `seg_${Date.now()}`,
          createdAt: nowIso,
        },
        ctx,
        nowIso,
      );
      setState((prev) => ({
        ...prev,
        customerSegments: [created, ...prev.customerSegments],
      }));
      pushToast(`سگمنت «${created.name}» ذخیره شد.`);
    },
    [pushToast],
  );

  const updateCustomerSegment = useCallback(
    (id: string, patch: Partial<CustomerSegment>) => {
      const ctx = getRepoCtx();
      const nowIso = new Date().toISOString();
      setState((prev) => ({
        ...prev,
        customerSegments: prev.customerSegments.map((s) =>
          s.id === id ? stampUpdateMeta({ ...s, ...patch }, ctx, nowIso) : s,
        ),
      }));
      pushToast('سگمنت به‌روزرسانی شد.');
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

  const saveCustomerView = useCallback(
    (view: Omit<CustomerSavedView, 'id' | 'createdAt'>) => {
      const ctx = getRepoCtx();
      const nowIso = new Date().toISOString();
      const created = stampCreateMeta<CustomerSavedView>(
        {
          ...view,
          id: `view_${Date.now()}`,
          createdAt: nowIso,
        },
        ctx,
        nowIso,
      );
      setState((prev) => ({
        ...prev,
        customerSavedViews: [created, ...(prev.customerSavedViews ?? [])],
      }));
      pushToast(`نمای فیلتر «${created.name}» ذخیره شد.`);
    },
    [pushToast],
  );

  const deleteCustomerView = useCallback(
    (id: string) => {
      setState((prev) => ({
        ...prev,
        customerSavedViews: (prev.customerSavedViews ?? []).filter((v) => v.id !== id),
      }));
      pushToast('نمای ذخیره‌شده حذف شد.', 'info');
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

      const outboxMsg = notificationProvider.send({
        to: cust.phone,
        customerId: cust.id,
        customerName: cust.name,
        body,
        channel: 'sms',
        ruleName: kind === 'birthday' ? 'تبریک تولد' : 'تبریک سالگرد',
      });

      setState((prev) => ({
        ...prev,
        outbox: [outboxMsg, ...prev.outbox],
        interactions: [
          {
            id: `int_bday_${Date.now()}`,
            customerId: cust.id,
            channel: 'sms',
            text: body,
            outcome: 'answered',
            at: nowIso,
          },
          ...prev.interactions,
        ],
      }));
      pushToast(`پیامک تبریک برای «${cust.name}» از طریق آداپتور پیامک در صندوق ارسال ثبت شد.`);
    },
    [pushToast],
  );

  const addInteraction = useCallback(
    (
      customerId: string,
      channel: Interaction['channel'],
      text: string,
      options?: { outcome?: InteractionOutcome; followUpAt?: string; createFollowUpTask?: boolean },
    ) => {
      if (!text.trim()) return;
      const ctx = getRepoCtx();
      const nowIso = new Date().toISOString();
      const item = stampCreateMeta<Interaction>(
        {
          id: `int_${Date.now()}`,
          customerId,
          channel,
          text: text.trim(),
          outcome: options?.outcome,
          followUpAt: options?.followUpAt,
          at: nowIso,
        },
        ctx,
        nowIso,
      );

      const cust = stateRef.current.customers.find((c) => c.id === customerId);
      const shouldCreateTask = Boolean(options?.followUpAt) && options?.createFollowUpTask !== false;
      const followTask: Task | null =
        shouldCreateTask && options?.followUpAt
          ? {
              id: `t_int_${Date.now()}`,
              title: `پیگیری ${cust?.name ?? 'مشتری'}: ${text.trim().slice(0, 50)}`,
              customerId,
              dueAt: options.followUpAt,
              done: false,
            }
          : null;

      setState((prev) => ({
        ...prev,
        interactions: [item, ...prev.interactions],
        tasks: followTask ? [followTask, ...prev.tasks] : prev.tasks,
      }));
      pushToast(
        followTask
          ? 'تعامل در پرونده ثبت شد و وظیفه پیگیری در تاریخ مقرر ایجاد گردید.'
          : 'تعامل جدید در پرونده مشتری ثبت شد.',
      );
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
          {
            ...def,
            entity: def.entity ?? 'customer',
            active: def.active ?? true,
            id: `cf_${Date.now()}`,
            order: prev.customFieldDefs.length + 1,
          },
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
      const pickedIds = new Set(orderedIds);
      const orderedSubset: CustomFieldDef[] = orderedIds
        .map((id): CustomFieldDef | null => map.get(id) ?? null)
        .filter((x): x is CustomFieldDef => x !== null);
      const remaining = prev.customFieldDefs.filter((f) => !pickedIds.has(f.id));
      const reordered = [...orderedSubset, ...remaining].map((item, idx) => ({
        ...item,
        order: idx + 1,
      }));
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
      const activeBranch =
        stateRef.current.settings.activeBranchId !== 'all'
          ? stateRef.current.settings.activeBranchId
          : stateRef.current.branches[0]?.id;
      const apt: Appointment = { ...data, branchId: data.branchId ?? activeBranch, id: `a_${Date.now()}` };
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

  const sendAppointmentReminder = useCallback(
    (appointmentId: string) => {
      const cur = stateRef.current;
      const apt = cur.appointments.find((a) => a.id === appointmentId);
      if (!apt) return { ok: false, error: 'نوبت یافت نشد.' };
      const cust = cur.customers.find((c) => c.id === apt.customerId);
      if (!cust) return { ok: false, error: 'مشتری یافت نشد.' };
      if (cust.consentSms === false) {
        pushToast(`ارسال پیامک به ${cust.name} به علت عدم رضایت پیامکی مسدود است.`, 'error');
        return { ok: false, error: 'مشتری رضایت پیامکی ندارد.' };
      }
      const srv = cur.services.find((s) => s.id === apt.serviceId);
      const nowIso = new Date().toISOString();
      const timeLabel = new Date(apt.start).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
      const msg: OutboxMessage = {
        id: `msg_apt_rem_${Date.now()}`,
        to: cust.phone,
        customerId: cust.id,
        customerName: cust.name,
        appointmentId: apt.id,
        canSimulateConfirm: apt.status === 'booked',
        body: `${cust.name} گرامی، یادآور نوبت «${srv?.name ?? 'خدمت'}» شما ساعت ${timeLabel} در ${cur.settings.businessName}. جهت تأیید عدد ۱ را ارسال کنید.`,
        channel: 'sms',
        ruleName: 'یادآور نوبت (ارسال به Outbox)',
        deliveryStatus: 'delivered',
        retryCount: 0,
        maxRetries: cur.automationPolicy.maxRetries,
        at: nowIso,
      };
      setState((prev) => ({
        ...prev,
        appointments: prev.appointments.map((a) =>
          a.id === appointmentId ? { ...a, reminder2hSent: true, reminderSentAt: nowIso } : a,
        ),
        outbox: [msg, ...prev.outbox],
        auditLogs: [makeAudit('نوبت', 'update', `یادآور نوبت ${cust.name} در Outbox ثبت شد.`), ...prev.auditLogs].slice(0, 100),
      }));
      pushToast(`یادآور نوبت ${cust.name} در صندوق ارسال (Outbox) قرار گرفت.`);
      return { ok: true };
    },
    [pushToast],
  );

  // --- ORDERS, INVENTORY, INVOICES, PROJECTS ---
  const addOrder = useCallback(
    (data: {
      customerId: string;
      channel?: OrderChannel;
      idempotencyKey?: string;
      items: { productId?: string; name: string; qty: number; price: number }[];
      promisedAt?: string;
      couponCode?: string;
      customFields?: Record<string, string>;
    }) => {
      if (!data.customerId || data.items.length === 0) {
        return { ok: false, error: 'مشتری و حداقل یک قلم کالا الزامی است.' };
      }
      const cur = stateRef.current;
      if (data.idempotencyKey) {
        const recentKeys = cur.recentIdempotencyKeys ?? [];
        const dupOrder = cur.orders.find((o) => o.idempotencyKey === data.idempotencyKey);
        if (recentKeys.includes(data.idempotencyKey) || dupOrder) {
          pushToast('ثبت تکراری سفارش با کلید یکتای مشابه مسدود شد (Idempotency).', 'info');
          return { ok: false, error: 'این سفارش قبلاً ثبت شده است (جلوگیری از ارسال تکراری / Idempotency).' };
        }
      }

      const subtotal = data.items.reduce((sum, it) => sum + it.qty * it.price, 0);
      let discountAmount = 0;
      let validCoupon: string | undefined;

      if (data.couponCode?.trim()) {
        const codeUpper = data.couponCode.trim().toUpperCase();
        const coupon = cur.coupons.find(
          (c) => c.code === codeUpper && c.active && c.usedCount < c.maxUses,
        );
        if (!coupon) {
          return { ok: false, error: 'کد تخفیف معتبر نیست یا منقضی شده است.' };
        }
        discountAmount = Math.round((subtotal * coupon.discountPct) / 100);
        validCoupon = coupon.code;
      }

      const nowIso = new Date().toISOString();
      const activeBranch =
        cur.settings.activeBranchId !== 'all'
          ? cur.settings.activeBranchId
          : cur.branches[0]?.id;
      const orderSeq = 1 + cur.orders.length;
      const candidateNo = formatDocumentNumber('order', orderSeq, cur.settings.numbering);
      const uniqueOrderId = cur.orders.some((o) => o.id === candidateNo)
        ? `${candidateNo}-${Date.now().toString().slice(-3)}`
        : candidateNo;

      const snapItems = data.items.map((it) => {
        const catalogProd = it.productId
          ? cur.products.find((p) => p.id === it.productId)
          : cur.products.find((p) => p.name === it.name);
        return {
          productId: it.productId ?? catalogProd?.id,
          name: it.name,
          qty: it.qty,
          price: it.price,
          unitPriceSnapshot: it.price,
        };
      });

      const order: Order = {
        id: uniqueOrderId,
        customerId: data.customerId,
        channel: data.channel ?? 'website',
        idempotencyKey: data.idempotencyKey,
        items: snapItems,
        status: 'new',
        createdAt: nowIso,
        updatedAt: nowIso,
        promisedAt: data.promisedAt,
        couponCode: validCoupon,
        discountAmount,
        shipments: [],
        returns: [],
        branchId: activeBranch,
        customFields: data.customFields,
      };

      setState((prev) => ({
        ...prev,
        orders: [order, ...prev.orders],
        recentIdempotencyKeys: data.idempotencyKey
          ? [data.idempotencyKey, ...(prev.recentIdempotencyKeys ?? [])].slice(0, 50)
          : prev.recentIdempotencyKeys,
        orderLogs: [
          { id: `ol_${Date.now()}`, orderId: order.id, from: 'ایجاد', to: 'new', at: nowIso },
          ...prev.orderLogs,
        ],
        coupons: validCoupon
          ? prev.coupons.map((c) => (c.code === validCoupon ? { ...c, usedCount: c.usedCount + 1 } : c))
          : prev.coupons,
        auditLogs: [makeAudit('سفارش', 'create', `سفارش ${order.id} (کانال: ${order.channel}) ثبت شد.`), ...prev.auditLogs].slice(0, 100),
      }));
      setTimeout(() => fireAutomationEvent('on_create', 'order', order as unknown as Record<string, unknown>), 50);
      pushToast(`سفارش ${order.id} با قیمت لحظه‌ای (Snapshot) ثبت شد.`);
      return { ok: true, order };
    },
    [fireAutomationEvent, pushToast],
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

      setTimeout(
        () =>
          fireAutomationEvent('on_stage_change', 'order', {
            ...target,
            status: nextStatus,
          } as unknown as Record<string, unknown>),
        50,
      );

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

  const recordOrderReturn = useCallback(
    (
      orderId: string,
      data: {
        items: { name: string; qty: number; price: number }[];
        refundAmount: number;
        refundMethod: PaymentMethod;
        reason: string;
        restock: boolean;
      },
    ) => {
      const cur = stateRef.current;
      const ord = cur.orders.find((o) => o.id === orderId);
      if (!ord || data.items.length === 0) return;
      const nowIso = new Date().toISOString();
      const ret: OrderReturn = {
        id: `ret_${Date.now()}`,
        orderId,
        customerId: ord.customerId,
        items: data.items,
        refundAmount: Math.max(0, data.refundAmount),
        refundMethod: data.refundMethod,
        reason: data.reason.trim() || 'مرجوعی سفارش',
        restock: data.restock,
        createdAt: nowIso,
      };

      const newMovements: StockMovement[] = [];
      let nextProducts = cur.products;
      if (data.restock) {
        nextProducts = cur.products.map((prod) => {
          const retQty = data.items
            .filter((it) => it.name === prod.name)
            .reduce((s, it) => s + it.qty, 0);
          if (retQty <= 0) return prod;
          const nextStock = prod.stock + retQty;
          newMovements.push({
            id: `sm_ret_${Date.now()}_${prod.id}`,
            productId: prod.id,
            productName: prod.name,
            orderId,
            type: 'in',
            qtyChange: retQty,
            balanceAfter: nextStock,
            reason: `بازگشت به انبار از مرجوعی سفارش ${orderId}`,
            at: nowIso,
          });
          return { ...prod, stock: nextStock };
        });
      }

      setState((prev) => ({
        ...prev,
        products: nextProducts,
        stockMovements: [...newMovements, ...prev.stockMovements],
        orders: prev.orders.map((o) =>
          o.id === orderId
            ? {
                ...o,
                updatedAt: nowIso,
                returns: [...(o.returns ?? []), ret],
              }
            : o,
        ),
        orderLogs: [
          {
            id: `ol_ret_${Date.now()}`,
            orderId,
            from: 'مرجوعی / استرداد وجه',
            to: `${ret.reason} (${ret.refundAmount.toLocaleString('en-US')} تومان)`,
            at: nowIso,
          },
          ...prev.orderLogs,
        ],
        auditLogs: [
          makeAudit('سفارش', 'update', `مرجوعی و استرداد وجه برای سفارش ${orderId} ثبت شد.`),
          ...prev.auditLogs,
        ].slice(0, 100),
      }));
      pushToast(
        data.restock
          ? 'مرجوعی، استرداد وجه و بازگشت کالا به موجودی انبار ثبت شد.'
          : 'مرجوعی و استرداد وجه برای سفارش ثبت شد.',
      );
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
      const invSeq = 1 + stateRef.current.invoices.length;
      const invNo = formatDocumentNumber('invoice', invSeq, stateRef.current.settings.numbering);
      const inv: Invoice = {
        id: `inv_${Date.now()}`,
        invoiceNo: invNo,
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
        branchId: order.branchId,
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

  const createInvoiceFromContract = useCallback(
    (contractId: string, method: PaymentMethod = 'transfer') => {
      const cur = stateRef.current;
      const contract = cur.contracts.find((c) => c.id === contractId);
      if (!contract) return;
      const existing = cur.invoices.find((i) => i.contractId === contractId && i.status !== 'paid');
      if (existing) {
        pushToast(`فاکتور باز ${existing.invoiceNo} قبلاً برای این قرارداد صادر شده است.`, 'info');
        return;
      }
      const subtotal = contract.amount;
      const tax = Math.round(subtotal * 0.1);
      const grandTotal = subtotal + tax;
      const nowIso = new Date().toISOString();
      const invNo = formatDocumentNumber('invoice', 1 + cur.invoices.length, cur.settings.numbering);
      const inv: Invoice = {
        id: `inv_ctr_${Date.now()}`,
        invoiceNo: invNo,
        orderId: `قرارداد ${contract.contractNo}`,
        contractId: contract.id,
        customerId: contract.customerId,
        subtotal,
        discount: 0,
        tax,
        grandTotal,
        paidAmount: 0,
        method,
        status: 'issued',
        issuedAt: nowIso,
        dueAt: new Date(Date.now() + 7 * 24 * 3600_000).toISOString(),
        branchId: contract.branchId,
      };
      setState((prev) => ({
        ...prev,
        invoices: [inv, ...prev.invoices],
        auditLogs: [
          makeAudit('مالی', 'create', `فاکتور ${inv.invoiceNo} از قرارداد ${contract.contractNo} صادر شد.`),
          ...prev.auditLogs,
        ].slice(0, 100),
      }));
      pushToast(`فاکتور ${inv.invoiceNo} از قرارداد صادر شد.`);
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

  const allocatePaymentToInvoices = useCallback(
    (data: {
      customerId: string;
      totalAmount: number;
      method: PaymentMethod;
      reference?: string;
      note?: string;
      allocations: { invoiceId: string; amount: number }[];
    }) => {
      const validLines = data.allocations.filter((a) => a.amount > 0);
      if (validLines.length === 0) {
        return { ok: false, error: 'حداقل یک فاکتور با مبلغ تخصیص بیشتر از صفر انتخاب کنید.' };
      }
      const allocatedSum = validLines.reduce((s, a) => s + a.amount, 0);
      if (allocatedSum > data.totalAmount) {
        return { ok: false, error: 'جمع مبالغ تخصیص‌یافته نمی‌تواند از کل پرداخت بیشتر باشد.' };
      }

      const cur = stateRef.current;
      const nowIso = new Date().toISOString();
      const allocMap = new Map<string, number>();
      const detailLines: { invoiceId: string; invoiceNo: string; amount: number }[] = [];

      for (const line of validLines) {
        const inv = cur.invoices.find((i) => i.id === line.invoiceId);
        if (!inv) continue;
        allocMap.set(inv.id, line.amount);
        detailLines.push({ invoiceId: inv.id, invoiceNo: inv.invoiceNo, amount: line.amount });
      }

      const record: PaymentAllocation = {
        id: `pa_${Date.now()}`,
        customerId: data.customerId,
        totalAmount: data.totalAmount,
        method: data.method,
        reference: data.reference?.trim() || undefined,
        note: data.note?.trim() || undefined,
        allocations: detailLines,
        createdAt: nowIso,
      };

      setState((prev) => ({
        ...prev,
        paymentAllocations: [record, ...(prev.paymentAllocations ?? [])],
        invoices: prev.invoices.map((inv) => {
          const addAmt = allocMap.get(inv.id);
          if (!addAmt) return inv;
          const nextPaid = Math.min(inv.grandTotal, inv.paidAmount + addAmt);
          return {
            ...inv,
            paidAmount: nextPaid,
            method: data.method,
            status: nextPaid >= inv.grandTotal ? 'paid' : 'partial',
          };
        }),
        auditLogs: [
          makeAudit('مالی', 'update', `تخصیص پرداخت تجمیعی به ${detailLines.length} فاکتور ثبت شد.`),
          ...prev.auditLogs,
        ].slice(0, 100),
      }));
      pushToast(`پرداخت با موفقیت به ${detailLines.length} فاکتور تخصیص یافت.`);
      return { ok: true };
    },
    [pushToast],
  );

  const sendOverdueInvoiceReminder = useCallback(
    (invoiceId: string) => {
      const cur = stateRef.current;
      const inv = cur.invoices.find((i) => i.id === invoiceId);
      if (!inv) return { ok: false, error: 'فاکتور یافت نشد.' };
      const cust = cur.customers.find((c) => c.id === inv.customerId);
      if (!cust) return { ok: false, error: 'مشتری یافت نشد.' };
      const balance = Math.max(0, inv.grandTotal - inv.paidAmount);
      if (balance <= 0) return { ok: false, error: 'این فاکتور تسویه شده است.' };
      if (cust.consentSms === false) {
        pushToast(`ارسال پیامک به ${cust.name} به دلیل عدم رضایت پیامکی انجام نشد.`, 'error');
        return { ok: false, error: 'مشتری رضایت پیامکی ندارد.' };
      }

      const nowIso = new Date().toISOString();
      const msg: OutboxMessage = {
        id: `msg_inv_${Date.now()}`,
        to: cust.phone,
        customerId: cust.id,
        customerName: cust.name,
        body: `${cust.name} گرامی، مانده فاکتور ${inv.invoiceNo} به مبلغ ${balance.toLocaleString('en-US')} تومان در ${cur.settings.businessName} سررسید شده است. لطفاً جهت تسویه اقدام فرمایید.`,
        channel: 'sms',
        ruleName: 'یادآور سررسید فاکتور معوق',
        deliveryStatus: 'delivered',
        retryCount: 0,
        maxRetries: cur.automationPolicy.maxRetries,
        at: nowIso,
      };
      setState((prev) => ({
        ...prev,
        invoices: prev.invoices.map((i) =>
          i.id === invoiceId
            ? { ...i, reminderCount: (i.reminderCount ?? 0) + 1, lastReminderAt: nowIso }
            : i,
        ),
        outbox: [msg, ...prev.outbox],
        auditLogs: [
          makeAudit('مالی', 'automation', `یادآور سررسید فاکتور ${inv.invoiceNo} در Outbox ثبت شد.`),
          ...prev.auditLogs,
        ].slice(0, 100),
      }));
      pushToast(`یادآور سررسید فاکتور ${inv.invoiceNo} به Outbox ارسال شد.`);
      return { ok: true };
    },
    [pushToast],
  );

  // --- CONTRACTS & WARRANTIES ---
  const addContract = useCallback(
    (data: Omit<Contract, 'id' | 'contractNo' | 'createdAt'>) => {
      const cur = stateRef.current;
      const nowIso = new Date().toISOString();
      const contractNo = `CTR-${new Date().getFullYear() - 621}-${101 + (cur.contracts?.length ?? 0)}`;
      const activeBranch =
        cur.settings.activeBranchId !== 'all' ? cur.settings.activeBranchId : cur.branches[0]?.id;
      const created: Contract = {
        ...data,
        id: `ctr_${Date.now()}`,
        contractNo,
        branchId: data.branchId ?? activeBranch,
        createdAt: nowIso,
      };
      setState((prev) => ({
        ...prev,
        contracts: [created, ...(prev.contracts ?? [])],
        auditLogs: [
          makeAudit('قراردادها', 'create', `قرارداد ${created.contractNo} ثبت شد.`),
          ...prev.auditLogs,
        ].slice(0, 100),
      }));
      pushToast(`قرارداد ${created.contractNo} ثبت شد.`);
    },
    [pushToast],
  );

  const renewContract = useCallback(
    (contractId: string) => {
      const cur = stateRef.current;
      const target = (cur.contracts ?? []).find((c) => c.id === contractId);
      if (!target) return;
      const nowMs = Date.now();
      const durMs = Math.max(
        30 * 24 * 3600_000,
        new Date(target.endDate).getTime() - new Date(target.startDate).getTime(),
      );
      const nextStart = new Date(Math.max(nowMs, new Date(target.endDate).getTime()));
      const nextEnd = new Date(nextStart.getTime() + durMs);

      setState((prev) => ({
        ...prev,
        contracts: (prev.contracts ?? []).map((c) =>
          c.id === contractId
            ? {
                ...c,
                startDate: nextStart.toISOString(),
                endDate: nextEnd.toISOString(),
                status: 'renewed',
              }
            : c,
        ),
        auditLogs: [
          makeAudit('قراردادها', 'update', `قرارداد ${target.contractNo} تمدید شد.`),
          ...prev.auditLogs,
        ].slice(0, 100),
      }));
      pushToast(`قرارداد ${target.contractNo} برای یک دوره جدید تمدید شد.`);
    },
    [pushToast],
  );

  const updateContractStatus = useCallback((contractId: string, status: ContractStatus) => {
    setState((prev) => ({
      ...prev,
      contracts: (prev.contracts ?? []).map((c) => (c.id === contractId ? { ...c, status } : c)),
    }));
  }, []);

  const runContractRenewalReminders = useCallback(() => {
    const cur = stateRef.current;
    const nowMs = Date.now();
    const nowIso = new Date().toISOString();
    const msgs: OutboxMessage[] = [];
    const updatedIds = new Set<string>();

    for (const c of cur.contracts ?? []) {
      if (c.status === 'expired' || c.status === 'draft') continue;
      const daysLeft = (new Date(c.endDate).getTime() - nowMs) / (24 * 3600_000);
      if (daysLeft <= c.renewalReminderDays && daysLeft >= -5) {
        const cust = cur.customers.find((cu) => cu.id === c.customerId);
        updatedIds.add(c.id);
        if (cust && cust.consentSms !== false) {
          msgs.push({
            id: `msg_ctr_${Date.now()}_${c.id}`,
            to: cust.phone,
            customerId: cust.id,
            customerName: cust.name,
            body: `${cust.name} گرامی، قرارداد «${c.title}» (${c.contractNo}) در حال نزدیک شدن به تاریخ پایان است. جهت تمدید با ${cur.settings.businessName} در ارتباط باشید.`,
            channel: 'sms',
            ruleName: 'قانون یادآور تمدید قرارداد',
            deliveryStatus: 'delivered',
            retryCount: 0,
            maxRetries: cur.automationPolicy.maxRetries,
            at: nowIso,
          });
        }
      }
    }

    if (updatedIds.size === 0) {
      pushToast('قرارداد در آستانه انقضای جدیدی برای ارسال یادآور یافت نشد.', 'info');
      return 0;
    }

    setState((prev) => ({
      ...prev,
      contracts: (prev.contracts ?? []).map((c) =>
        updatedIds.has(c.id)
          ? {
              ...c,
              status: c.status === 'active' || c.status === 'renewed' ? 'expiring_soon' : c.status,
              lastReminderAt: nowIso,
            }
          : c,
      ),
      outbox: [...msgs, ...prev.outbox],
      auditLogs: [
        makeAudit('قراردادها', 'automation', `یادآور تمدید برای ${updatedIds.size} قرارداد در Outbox ثبت شد.`),
        ...prev.auditLogs,
      ].slice(0, 100),
    }));
    pushToast(`یادآور تمدید برای ${updatedIds.size} قرارداد در صف Outbox ثبت شد.`);
    return updatedIds.size;
  }, [pushToast]);

  const addWarrantyRecord = useCallback(
    (data: Omit<WarrantyRecord, 'id' | 'claims' | 'createdAt'>) => {
      const created: WarrantyRecord = {
        ...data,
        id: `war_${Date.now()}`,
        claims: [],
        createdAt: new Date().toISOString(),
      };
      setState((prev) => ({
        ...prev,
        warranties: [created, ...(prev.warranties ?? [])],
        auditLogs: [
          makeAudit('گارانتی', 'create', `رکورد گارانتی شماره سریال ${created.serialNumber} ثبت شد.`),
          ...prev.auditLogs,
        ].slice(0, 100),
      }));
      pushToast(`کارت گارانتی ${created.serialNumber} ثبت شد.`);
    },
    [pushToast],
  );

  const addWarrantyClaim = useCallback(
    (warrantyId: string, claim: Omit<WarrantyClaim, 'id'>) => {
      const createdClaim: WarrantyClaim = { ...claim, id: `wc_${Date.now()}` };
      setState((prev) => ({
        ...prev,
        warranties: (prev.warranties ?? []).map((w) =>
          w.id === warrantyId ? { ...w, claims: [createdClaim, ...w.claims] } : w,
        ),
        auditLogs: [
          makeAudit('گارانتی', 'update', `درخواست خدمات پس از فروش جدید برای گارانتی ثبت شد.`),
          ...prev.auditLogs,
        ].slice(0, 100),
      }));
      pushToast('پرونده پذیرش خدمات پس از فروش ثبت شد.');
    },
    [pushToast],
  );

  const updateWarrantyClaimStatus = useCallback(
    (warrantyId: string, claimId: string, status: WarrantyClaim['status']) => {
      setState((prev) => ({
        ...prev,
        warranties: (prev.warranties ?? []).map((w) =>
          w.id === warrantyId
            ? { ...w, claims: w.claims.map((cl) => (cl.id === claimId ? { ...cl, status } : cl)) }
            : w,
        ),
      }));
    },
    [],
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
    (projectId: string, task: { title: string; assignee: string; estimatedHours: number; dueAt?: string }) => {
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
                    dueAt: task.dueAt,
                    subtasks: [],
                    done: false,
                  },
                ],
              }
            : p,
        ),
      }));
      pushToast('تسک پروژه اضافه شد.');
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

  const addProjectTaskSubtask = useCallback((projectId: string, taskId: string, title: string) => {
    if (!title.trim()) return;
    setState((prev) => ({
      ...prev,
      projects: prev.projects.map((p) =>
        p.id === projectId
          ? {
              ...p,
              tasks: p.tasks.map((t) =>
                t.id === taskId
                  ? {
                      ...t,
                      subtasks: [...(t.subtasks ?? []), { id: `pts_${Date.now()}`, title: title.trim(), done: false }],
                    }
                  : t,
              ),
            }
          : p,
      ),
    }));
  }, []);

  const toggleProjectTaskSubtask = useCallback((projectId: string, taskId: string, subtaskId: string) => {
    setState((prev) => ({
      ...prev,
      projects: prev.projects.map((p) =>
        p.id === projectId
          ? {
              ...p,
              tasks: p.tasks.map((t) =>
                t.id === taskId
                  ? {
                      ...t,
                      subtasks: (t.subtasks ?? []).map((s) => (s.id === subtaskId ? { ...s, done: !s.done } : s)),
                    }
                  : t,
              ),
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

  // --- SALES LEADS, MULTIPLE PIPELINES, PRICE LISTS, QUOTES & COMMISSIONS ---
  const addLead = useCallback(
    (
      data: Omit<SalesLead, 'id' | 'createdAt' | 'updatedAt' | 'assignedByRule'>,
      useRoundRobin = false,
    ) => {
      if (!data.name.trim()) {
        return { ok: false, error: 'نام سرنخ الزامی است.' };
      }
      if (!isValidIranMobile(data.phone)) {
        return { ok: false, error: 'شماره موبایل معتبر نیست (فرمت صحیح: ۰۹xxxxxxxxx).' };
      }
      const cur = stateRef.current;
      const team = cur.settings.salesTeam.length > 0 ? cur.settings.salesTeam : ['مریم (فروش)'];
      const rrIdx = cur.settings.roundRobinIndex % team.length;
      const assignedOwner = useRoundRobin ? team[rrIdx] : data.ownerName || team[0];
      const nowIso = new Date().toISOString();
      const lead: SalesLead = {
        ...data,
        id: `ld_${Date.now()}`,
        ownerName: assignedOwner,
        assignedByRule: useRoundRobin ? 'round_robin' : 'manual',
        branchId: data.branchId ?? (cur.settings.activeBranchId !== 'all' ? cur.settings.activeBranchId : undefined),
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      setState((prev) => ({
        ...prev,
        leads: [lead, ...prev.leads],
        settings: useRoundRobin
          ? { ...prev.settings, roundRobinIndex: (rrIdx + 1) % team.length }
          : prev.settings,
        auditLogs: [
          makeAudit(
            'فروش',
            'create',
            `سرنخ «${lead.name}» ثبت${useRoundRobin ? ` و به‌صورت چرخشی به ${assignedOwner} تخصیص داده` : ''} شد.`,
          ),
          ...prev.auditLogs,
        ].slice(0, 100),
      }));
      pushToast(
        useRoundRobin
          ? `سرنخ «${lead.name}» ثبت و به ${assignedOwner} تخصیص داده شد.`
          : `سرنخ «${lead.name}» ثبت شد.`,
      );
      return { ok: true, lead };
    },
    [pushToast],
  );

  const updateLead = useCallback(
    (id: string, patch: Partial<SalesLead>) => {
      const nowIso = new Date().toISOString();
      setState((prev) => ({
        ...prev,
        leads: prev.leads.map((l) => (l.id === id ? { ...l, ...patch, updatedAt: nowIso } : l)),
      }));
      pushToast('اطلاعات سرنخ به‌روزرسانی شد.');
    },
    [pushToast],
  );

  const convertLeadToCustomerAndOpportunity = useCallback(
    (
      leadId: string,
      options?: { pipelineId?: string; opportunityTitle?: string; expectedCloseDate?: string },
    ) => {
      const cur = stateRef.current;
      const lead = cur.leads.find((l) => l.id === leadId);
      if (!lead) return { ok: false, error: 'سرنخ یافت نشد.' };
      if (lead.status === 'converted' && lead.convertedOpportunityId) {
        return { ok: false, error: 'این سرنخ قبلاً تبدیل شده است.' };
      }

      const nowIso = new Date().toISOString();
      const existingCustomer = cur.customers.find((c) => c.phone === lead.phone);
      const customerId = existingCustomer?.id ?? `c_ld_${Date.now()}`;
      const createdCustomer: Customer | null = existingCustomer
        ? null
        : {
            id: customerId,
            name: lead.name,
            phone: lead.phone,
            email: lead.email,
            companyName: lead.companyName,
            personType: lead.companyName ? 'organization' : 'individual',
            lifecycle: 'lead',
            ownerName: lead.ownerName,
            tags: ['سرنخ تبدیل‌شده'],
            source: lead.source,
            branchId: lead.branchId,
            createdAt: nowIso,
          };

      const targetPipeline =
        cur.pipelines.find((p) => p.id === options?.pipelineId) ??
        cur.pipelines.find((p) => p.isDefault) ??
        cur.pipelines[0];
      const pipelineId = targetPipeline?.id ?? 'pl_main';
      const firstStage = targetPipeline?.stages.find((s) => s.key === 'lead') ??
        cur.pipelineStages[0] ?? { key: 'lead' as PipelineStage, label: 'سرنخ جدید', probability: 20, slaHours: 24 };

      const oppId = `opp_ld_${Date.now()}`;
      const newOpp: Opportunity = {
        id: oppId,
        pipelineId,
        title: options?.opportunityTitle?.trim() || `فرصت ${lead.companyName ? lead.companyName : lead.name}`,
        customerId,
        contactName: lead.name,
        phone: lead.phone,
        source: lead.source,
        stage: firstStage.key,
        amount: Math.max(0, lead.estimatedAmount),
        probability: firstStage.probability,
        expectedCloseDate: options?.expectedCloseDate ?? new Date(Date.now() + 14 * 24 * 3600_000).toISOString(),
        leadScore: lead.score,
        ownerName: lead.ownerName,
        branchId: lead.branchId,
        stageHistory: [
          {
            stage: firstStage.key,
            label: firstStage.label,
            enteredAt: nowIso,
          },
        ],
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      setState((prev) => ({
        ...prev,
        customers: createdCustomer ? [createdCustomer, ...prev.customers] : prev.customers,
        opportunities: [newOpp, ...prev.opportunities],
        leads: prev.leads.map((l) =>
          l.id === leadId
            ? {
                ...l,
                status: 'converted',
                convertedCustomerId: customerId,
                convertedOpportunityId: oppId,
                updatedAt: nowIso,
              }
            : l,
        ),
        auditLogs: [
          makeAudit('فروش', 'create', `سرنخ «${lead.name}» به مشتری و فرصت فروش «${newOpp.title}» تبدیل شد.`),
          ...prev.auditLogs,
        ].slice(0, 100),
      }));
      pushToast(`سرنخ «${lead.name}» به مشتری و فرصت فروش تبدیل شد.`);
      return { ok: true };
    },
    [pushToast],
  );

  const addPipeline = useCallback(
    (pipeline: Omit<SalesPipeline, 'id'>) => {
      const created: SalesPipeline = {
        ...pipeline,
        id: `pl_${Date.now()}`,
      };
      setState((prev) => {
        const nextPipelines: SalesPipeline[] = created.isDefault
          ? [...prev.pipelines.map((p) => ({ ...p, isDefault: false })), created]
          : [...prev.pipelines, created];
        return {
          ...prev,
          pipelines: nextPipelines,
          pipelineStages: created.isDefault ? created.stages : prev.pipelineStages,
        };
      });
      pushToast(`قیف فروش «${created.name}» ایجاد شد.`);
    },
    [pushToast],
  );

  const updatePipeline = useCallback(
    (id: string, patch: Partial<SalesPipeline>) => {
      setState((prev) => {
        const nextPipelines = prev.pipelines.map((p) => {
          if (p.id === id) return { ...p, ...patch };
          if (patch.isDefault) return { ...p, isDefault: false };
          return p;
        });
        const def = nextPipelines.find((p) => p.isDefault) ?? nextPipelines[0];
        return {
          ...prev,
          pipelines: nextPipelines,
          pipelineStages: def ? def.stages : prev.pipelineStages,
        };
      });
      pushToast('تنظیمات قیف فروش به‌روزرسانی شد.');
    },
    [pushToast],
  );

  const deletePipeline = useCallback(
    (id: string) => {
      if (stateRef.current.pipelines.length <= 1) {
        pushToast('حداقل یک قیف فروش باید فعال بماند.', 'error');
        return;
      }
      setState((prev) => {
        const remaining = prev.pipelines.filter((p) => p.id !== id);
        if (!remaining.some((p) => p.isDefault) && remaining[0]) {
          remaining[0] = { ...remaining[0], isDefault: true };
        }
        const def = remaining.find((p) => p.isDefault) ?? remaining[0];
        const fallbackId = def?.id ?? 'pl_main';
        return {
          ...prev,
          pipelines: remaining,
          pipelineStages: def ? def.stages : prev.pipelineStages,
          opportunities: prev.opportunities.map((o) =>
            o.pipelineId === id ? { ...o, pipelineId: fallbackId } : o,
          ),
        };
      });
      pushToast('قیف فروش حذف و فرصت‌های آن منتقل شد.', 'info');
    },
    [pushToast],
  );

  const updateProduct = useCallback(
    (id: string, patch: Partial<Product>) => {
      setState((prev) => ({
        ...prev,
        products: prev.products.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      }));
      pushToast('مشخصات کالا در کاتالوگ به‌روزرسانی شد.');
    },
    [pushToast],
  );

  const updateService = useCallback(
    (id: string, patch: Partial<Service>) => {
      setState((prev) => ({
        ...prev,
        services: prev.services.map((s) => (s.id === id ? { ...s, ...patch } : s)),
      }));
      pushToast('مشخصات خدمت در کاتالوگ به‌روزرسانی شد.');
    },
    [pushToast],
  );

  const addPriceList = useCallback(
    (pl: Omit<PriceList, 'id'>) => {
      const created: PriceList = { ...pl, id: `plst_${Date.now()}` };
      setState((prev) => ({
        ...prev,
        priceLists: [created, ...prev.priceLists],
      }));
      pushToast(`لیست قیمت «${created.name}» ایجاد شد.`);
    },
    [pushToast],
  );

  const updatePriceList = useCallback(
    (id: string, patch: Partial<PriceList>) => {
      setState((prev) => ({
        ...prev,
        priceLists: prev.priceLists.map((pl) => (pl.id === id ? { ...pl, ...patch } : pl)),
      }));
      pushToast('لیست قیمت به‌روزرسانی شد.');
    },
    [pushToast],
  );

  const deletePriceList = useCallback(
    (id: string) => {
      setState((prev) => ({
        ...prev,
        priceLists: prev.priceLists.filter((pl) => pl.id !== id),
      }));
      pushToast('لیست قیمت حذف شد.', 'info');
    },
    [pushToast],
  );

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

      const targetPipeline =
        cur.pipelines.find((p) => p.id === data.pipelineId) ??
        cur.pipelines.find((p) => p.isDefault) ??
        cur.pipelines[0];
      const pipelineId = data.pipelineId ?? targetPipeline?.id ?? 'pl_main';
      const stagesForPipeline = targetPipeline?.stages ?? cur.pipelineStages;
      const stageCfg = stagesForPipeline.find((s) => s.key === data.stage);
      const nowIso = new Date().toISOString();
      const opp: Opportunity = {
        ...data,
        pipelineId,
        ownerName: assignedOwner,
        id: `opp_${Date.now()}`,
        probability: stageCfg?.probability ?? DEFAULT_STAGE_PROB[data.stage],
        expectedCloseDate: data.expectedCloseDate ?? new Date(Date.now() + 14 * 24 * 3600_000).toISOString(),
        stageHistory: data.stageHistory ?? [
          {
            stage: data.stage,
            label: stageCfg?.label ?? data.stage,
            enteredAt: nowIso,
          },
        ],
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
      const cur = stateRef.current;
      const existingOpp = cur.opportunities.find((o) => o.id === id);
      if (!existingOpp) return;
      const oppPipeline =
        cur.pipelines.find((p) => p.id === existingOpp.pipelineId) ??
        cur.pipelines.find((p) => p.isDefault) ??
        cur.pipelines[0];
      const stagesList = oppPipeline?.stages ?? cur.pipelineStages;
      const stageCfg = stagesList.find((s) => s.key === stage);
      const nextProb = stageCfg?.probability ?? DEFAULT_STAGE_PROB[stage];
      const nextLabel = stageCfg?.label ?? stage;
      const nowIso = new Date().toISOString();

      setState((prev) => {
        const updatedOpps = prev.opportunities.map((o) => {
          if (o.id !== id) return o;
          const prevHistory = o.stageHistory && o.stageHistory.length > 0
            ? [...o.stageHistory]
            : [{ stage: o.stage, label: stagesList.find((s) => s.key === o.stage)?.label ?? o.stage, enteredAt: o.createdAt }];

          const lastIdx = prevHistory.length - 1;
          const lastEntry = prevHistory[lastIdx];
          if (lastEntry && !lastEntry.exitedAt) {
            const hrs = Math.max(
              0.1,
              Math.round(((new Date(nowIso).getTime() - new Date(lastEntry.enteredAt).getTime()) / 3600_000) * 10) / 10,
            );
            prevHistory[lastIdx] = { ...lastEntry, exitedAt: nowIso, durationHours: hrs };
          }
          prevHistory.push({ stage, label: nextLabel, enteredAt: nowIso });

          return {
            ...o,
            stage,
            probability: nextProb,
            lostReason: stage === 'lost' ? lostReason : o.lostReason,
            stageHistory: prevHistory,
            updatedAt: nowIso,
          };
        });

        let nextLedger = prev.commissionLedger;
        if (
          stage === 'won' &&
          prev.commissionRule.autoCreateLedgerOnWon &&
          !prev.commissionLedger.some((cl) => cl.opportunityId === id)
        ) {
          const comm = computeCommissionAmount(existingOpp.amount, prev.commissionTiers, prev.commissionRule);
          if (comm.total > 0) {
            const entry: CommissionLedgerEntry = {
              id: `cl_${Date.now()}`,
              opportunityId: existingOpp.id,
              opportunityTitle: existingOpp.title,
              ownerName: existingOpp.ownerName,
              dealAmount: existingOpp.amount,
              commissionAmount: comm.total,
              rateSummary: comm.summary,
              status: 'pending',
              createdAt: nowIso,
            };
            nextLedger = [entry, ...prev.commissionLedger];
          }
        }

        return {
          ...prev,
          opportunities: updatedOpps,
          commissionLedger: nextLedger,
        };
      });

      setTimeout(
        () =>
          fireAutomationEvent('on_stage_change', 'opportunity', {
            ...existingOpp,
            stage,
          } as unknown as Record<string, unknown>),
        50,
      );
      pushToast(
        stage === 'won'
          ? 'معامله برنده‌شده ثبت و ردیف پورسانت در دفتر پورسانت ایجاد شد.'
          : 'مرحله فرصت فروش و تاریخچه زمان ماندگاری به‌روزرسانی شد.',
      );
    },
    [fireAutomationEvent, pushToast],
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
        ownerName: opp.ownerName,
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
      setState((prev) => ({
        ...prev,
        pipelineStages: stages,
        pipelines: prev.pipelines.map((p) => (p.isDefault ? { ...p, stages } : p)),
      }));
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

  const updateCommissionRule = useCallback(
    (rule: CommissionRuleConfig) => {
      setState((prev) => ({ ...prev, commissionRule: rule }));
      pushToast('قانون محاسبه پورسانت ذخیره شد.');
    },
    [pushToast],
  );

  const approveCommissionEntry = useCallback(
    (id: string, nextStatus: CommissionLedgerStatus) => {
      const cur = stateRef.current;
      if (cur.settings.role !== 'admin') {
        pushToast('تأیید یا پرداخت پورسانت فقط توسط نقش مدیر (admin) مجاز است.', 'error');
        return;
      }
      const nowIso = new Date().toISOString();
      setState((prev) => ({
        ...prev,
        commissionLedger: prev.commissionLedger.map((entry) =>
          entry.id === id
            ? {
                ...entry,
                status: nextStatus,
                approvedBy: nextStatus === 'approved' || nextStatus === 'paid' ? 'مدیر فروش' : entry.approvedBy,
                approvedAt: nextStatus === 'approved' ? nowIso : entry.approvedAt,
                paidAt: nextStatus === 'paid' ? nowIso : entry.paidAt,
              }
            : entry,
        ),
        auditLogs: [
          makeAudit('پورسانت', 'update', `وضعیت ردیف پورسانت ${id} به ${nextStatus === 'approved' ? 'تأییدشده' : 'پرداخت‌شده'} تغییر یافت.`),
          ...prev.auditLogs,
        ].slice(0, 100),
      }));
      pushToast(nextStatus === 'approved' ? 'پورسانت توسط مدیر تأیید شد.' : 'پرداخت پورسانت ثبت شد.');
    },
    [pushToast],
  );

  const generateMissingCommissions = useCallback(() => {
    const cur = stateRef.current;
    const existingOppIds = new Set(cur.commissionLedger.map((c) => c.opportunityId));
    const wonMissing = cur.opportunities.filter((o) => o.stage === 'won' && !existingOppIds.has(o.id));
    if (wonMissing.length === 0) {
      pushToast('برای همه معاملات برنده‌شده قبلاً ردیف پورسانت ثبت شده است.', 'info');
      return;
    }
    const nowIso = new Date().toISOString();
    const newEntries: CommissionLedgerEntry[] = wonMissing.map((opp, idx) => {
      const comm = computeCommissionAmount(opp.amount, cur.commissionTiers, cur.commissionRule);
      return {
        id: `cl_gen_${Date.now()}_${idx}`,
        opportunityId: opp.id,
        opportunityTitle: opp.title,
        ownerName: opp.ownerName,
        dealAmount: opp.amount,
        commissionAmount: comm.total,
        rateSummary: comm.summary,
        status: 'pending',
        createdAt: nowIso,
      };
    });
    setState((prev) => ({
      ...prev,
      commissionLedger: [...newEntries, ...prev.commissionLedger],
    }));
    pushToast(`${newEntries.length} ردیف جدید در دفتر پورسانت ثبت شد.`);
  }, [pushToast]);

  const createQuote = useCallback(
    (data: Omit<Quote, 'id' | 'quoteNo' | 'version' | 'shareToken' | 'createdAt'>) => {
      const seq = 1 + stateRef.current.quotes.length;
      const quoteNo = formatDocumentNumber('quote', seq, stateRef.current.settings.numbering);
      const fin = computeQuoteFinancials({
        items: data.items,
        discountPct: data.discountPct,
        taxPct: data.taxPct,
      });
      const approvalStatus = data.approvalStatus ?? (fin.requiresManagerApproval ? 'pending_manager' : 'not_required');
      const quote: Quote = {
        ...data,
        status: fin.requiresManagerApproval && data.status !== 'draft' ? 'draft' : data.status,
        approvalStatus,
        id: `q_${Date.now()}`,
        quoteNo,
        version: 1,
        shareToken: `qt-share-${seq}-v1`,
        createdAt: new Date().toISOString(),
      };
      setState((prev) => ({
        ...prev,
        quotes: [quote, ...prev.quotes],
        auditLogs: [makeAudit('فروش', 'create', `پیش‌فاکتور ${quote.quoteNo} (نسخه ۱) صادر شد.`), ...prev.auditLogs].slice(0, 100),
      }));
      pushToast(
        fin.requiresManagerApproval
          ? `پیش‌فاکتور ${quote.quoteNo} ثبت شد؛ به دلیل تخفیف بالای ۲۰٪ نیازمند تأیید مدیر است.`
          : `پیش‌فاکتور ${quote.quoteNo} نسخه ۱ ایجاد شد.`,
        fin.requiresManagerApproval ? 'info' : 'success',
      );
    },
    [pushToast],
  );

  const createQuoteVersion = useCallback(
    (
      parentQuoteId: string,
      patch?: Partial<Pick<Quote, 'items' | 'discountPct' | 'taxPct' | 'priceListId' | 'priceListName' | 'notes' | 'validUntil'>>,
    ) => {
      const parent = stateRef.current.quotes.find((q) => q.id === parentQuoteId);
      if (!parent) return;
      const siblings = stateRef.current.quotes.filter((q) => q.quoteNo === parent.quoteNo);
      const nextVersion = Math.max(...siblings.map((s) => s.version)) + 1;
      const mergedItems = patch?.items ?? parent.items;
      const mergedDisc = patch?.discountPct ?? parent.discountPct;
      const mergedTax = patch?.taxPct ?? parent.taxPct;
      const fin = computeQuoteFinancials({
        items: mergedItems,
        discountPct: mergedDisc,
        taxPct: mergedTax,
      });
      const newQuote: Quote = {
        ...parent,
        ...patch,
        id: `q_${Date.now()}`,
        version: nextVersion,
        parentQuoteId: parent.id,
        status: 'draft',
        approvalStatus: fin.requiresManagerApproval ? 'pending_manager' : 'not_required',
        approvedBy: undefined,
        approvedAt: undefined,
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

  const approveQuoteDiscount = useCallback(
    (id: string, approved: boolean) => {
      if (stateRef.current.settings.role !== 'admin') {
        pushToast('تأیید تخفیف بالای ۲۰٪ فقط توسط مدیر (admin) امکان‌پذیر است.', 'error');
        return;
      }
      const nowIso = new Date().toISOString();
      setState((prev) => ({
        ...prev,
        quotes: prev.quotes.map((q) =>
          q.id === id
            ? {
                ...q,
                approvalStatus: approved ? 'approved' : 'rejected',
                approvedBy: approved ? 'مدیر فروش' : undefined,
                approvedAt: approved ? nowIso : undefined,
              }
            : q,
        ),
        auditLogs: [
          makeAudit('فروش', 'update', `درخواست تخفیف ویژه پیش‌فاکتور ${id} توسط مدیر ${approved ? 'تأیید' : 'رد'} شد.`),
          ...prev.auditLogs,
        ].slice(0, 100),
      }));
      pushToast(approved ? 'تخفیف پیش‌فاکتور توسط مدیر تأیید شد و آماده ارسال است.' : 'درخواست تخفیف ویژه رد شد.', approved ? 'success' : 'error');
    },
    [pushToast],
  );

  const updateQuoteStatus = useCallback(
    (id: string, status: QuoteStatus, clientComment?: string) => {
      const target = stateRef.current.quotes.find((q) => q.id === id);
      if (
        target &&
        (status === 'sent' || status === 'accepted' || status === 'approved') &&
        (target.approvalStatus === 'pending_manager' || target.approvalStatus === 'rejected')
      ) {
        pushToast('پیش‌فاکتور دارای تخفیف بالای ۲۰٪ است و پیش از ارسال یا تأیید باید توسط مدیر تأیید شود.', 'error');
        return { ok: false, error: 'نیازمند تأیید تخفیف توسط مدیر' };
      }
      setState((prev) => ({
        ...prev,
        quotes: prev.quotes.map((q) =>
          q.id === id ? { ...q, status, clientComment: clientComment ?? q.clientComment } : q,
        ),
      }));
      pushToast(
        status === 'accepted' || status === 'approved'
          ? 'پیش‌فاکتور توسط مشتری پذیرفته شد.'
          : status === 'rejected'
            ? 'پیش‌فاکتور رد شد.'
            : status === 'expired'
              ? 'پیش‌فاکتور منقضی علامت‌گذاری شد.'
              : 'وضعیت پیش‌فاکتور به‌روزرسانی شد.',
      );
      return { ok: true };
    },
    [pushToast],
  );

  // --- WORKFLOWS, VISUAL BPMN, MARKETING, TASKS, TICKETS, KB, NPS, AUTOMATION ---
  const saveWorkflowDefinition = useCallback(
    (def: Omit<WorkflowDefinition, 'id' | 'updatedAt'> & { id?: string }) => {
      const nowIso = new Date().toISOString();
      if (def.id) {
        setState((prev) => ({
          ...prev,
          workflowDefinitions: prev.workflowDefinitions.map((d) =>
            d.id === def.id ? { ...d, ...def, updatedAt: nowIso } : d,
          ),
          auditLogs: [makeAudit('گردش کار', 'update', `طراحی بصری فرآیند «${def.name}» ذخیره شد.`), ...prev.auditLogs].slice(0, 100),
        }));
        pushToast(`طراحی «${def.name}» ذخیره شد.`);
      } else {
        const created: WorkflowDefinition = {
          ...def,
          id: `wfd_${Date.now()}`,
          updatedAt: nowIso,
        };
        setState((prev) => ({
          ...prev,
          workflowDefinitions: [created, ...prev.workflowDefinitions],
          auditLogs: [makeAudit('گردش کار', 'create', `الگوی جدید فرآیند «${def.name}» ساخته شد.`), ...prev.auditLogs].slice(0, 100),
        }));
        pushToast(`الگوی «${def.name}» ساخته شد.`);
      }
    },
    [pushToast],
  );

  const publishWorkflowDefinition = useCallback(
    (id: string) => {
      const target = stateRef.current.workflowDefinitions.find((d) => d.id === id);
      if (!target) return;
      setState((prev) => ({
        ...prev,
        workflowDefinitions: prev.workflowDefinitions.map((d) =>
          d.id === id
            ? {
                ...d,
                status: 'published',
                version: d.status === 'published' ? d.version + 1 : d.version,
                updatedAt: new Date().toISOString(),
              }
            : d,
        ),
        auditLogs: [makeAudit('گردش کار', 'approve', `نسخه جدید فرآیند «${target.name}» منتشر شد.`), ...prev.auditLogs].slice(0, 100),
      }));
      pushToast(`فرآیند «${target.name}» منتشر (Published) شد.`);
    },
    [pushToast],
  );

  const cloneWorkflowDraft = useCallback(
    (id: string) => {
      const target = stateRef.current.workflowDefinitions.find((d) => d.id === id);
      if (!target) return;
      const cloned: WorkflowDefinition = {
        ...target,
        id: `wfd_draft_${Date.now()}`,
        version: target.version + 1,
        status: 'draft',
        name: `${target.name} (پیش‌نویس ویرایش)`,
        updatedAt: new Date().toISOString(),
      };
      setState((prev) => ({
        ...prev,
        workflowDefinitions: [cloned, ...prev.workflowDefinitions],
      }));
      pushToast(`نسخه پیش‌نویس جدید از «${target.name}» ایجاد شد.`, 'info');
    },
    [pushToast],
  );

  const deleteWorkflowDefinition = useCallback(
    (id: string) => {
      setState((prev) => ({
        ...prev,
        workflowDefinitions: prev.workflowDefinitions.filter((d) => d.id !== id),
      }));
      pushToast('الگوی فرآیند حذف شد.', 'info');
    },
    [pushToast],
  );

  const createWorkflowInstance = useCallback(
    (data: {
      title: string;
      type: WorkflowType;
      definitionId?: string;
      customerId?: string;
      relatedRef?: string;
    }) => {
      const cur = stateRef.current;
      const nowIso = new Date().toISOString();
      const matchedDef =
        (data.definitionId && cur.workflowDefinitions.find((d) => d.id === data.definitionId)) ||
        cur.workflowDefinitions.find((d) => d.type === data.type && d.status === 'published') ||
        cur.workflowDefinitions.find((d) => d.type === data.type);

      let steps: WorkflowStep[] = [];
      let slaHours = 24;
      if (matchedDef) {
        slaHours = matchedDef.slaHours;
        const execNodes = matchedDef.nodes.filter((n) => n.type !== 'start' && n.type !== 'end');
        steps = execNodes.map((n, idx) => ({
          id: n.id,
          name: n.label,
          nodeType: n.type,
          role: n.role,
          status: 'pending',
          startedAt: idx === 0 ? nowIso : undefined,
          timerHours: n.timerHours,
          timerExpiresAt:
            idx === 0 && n.type === 'timer' && n.timerHours
              ? new Date(Date.now() + n.timerHours * 3600_000).toISOString()
              : undefined,
          formFields: n.formFields,
          parallelBranches:
            n.type === 'parallel_gateway'
              ? (n.parallelBranches && n.parallelBranches.length > 0
                  ? n.parallelBranches
                  : ['تأیید اول', 'تأیید دوم']
                ).map((bn) => ({
                  branchName: bn,
                  role: n.role,
                  status: 'pending' as const,
                }))
              : undefined,
        }));
      }

      if (steps.length === 0) {
        steps = [
          { name: 'بررسی درخواست و ثبت مستندات', nodeType: 'task', role: 'staff', status: 'pending', startedAt: nowIso },
          { name: 'تأیید نهایی مدیر سیستم', nodeType: 'task', role: 'admin', status: 'pending' },
        ];
      }

      const wf: WorkflowInstance = {
        id: `wf_${Date.now()}`,
        title: data.title.trim(),
        type: matchedDef?.type ?? data.type,
        definitionId: matchedDef?.id,
        definitionVersion: matchedDef?.version,
        customerId: data.customerId || undefined,
        relatedRef: data.relatedRef || undefined,
        currentStepIndex: 0,
        steps,
        status: 'running',
        createdAt: nowIso,
        slaHours,
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
    (
      id: string,
      decision: 'approved' | 'rejected',
      comment?: string,
      stepData?: Record<string, string>,
      branchIndex?: number,
    ) => {
      const wf = stateRef.current.workflows.find((w) => w.id === id);
      if (!wf || wf.status !== 'running') return { ok: false, error: 'فرایند فعال نیست.' };
      const step = wf.steps[wf.currentStepIndex];
      if (!step) return { ok: false, error: 'مرحله معتبر نیست.' };

      const curRole = stateRef.current.settings.role;
      const actorName = curRole === 'admin' ? 'مدیر سیستم' : 'کارشناس';
      const nowIso = new Date().toISOString();

      // Handle parallel gateway branch vote
      if (step.nodeType === 'parallel_gateway' && step.parallelBranches && typeof branchIndex === 'number') {
        const targetBranch = step.parallelBranches[branchIndex];
        if (!targetBranch) return { ok: false, error: 'شاخه موازی نامعتبر است.' };
        if (targetBranch.role === 'admin' && curRole !== 'admin') {
          pushToast('این شاخه موازی نیازمند تأیید مدیر سیستم است.', 'error');
          return { ok: false, error: 'نیازمند نقش مدیر سیستم' };
        }
        const nextBranches = step.parallelBranches.map((b, i) =>
          i === branchIndex ? { ...b, status: decision, actor: actorName, at: nowIso } : b,
        );
        const anyRejected = nextBranches.some((b) => b.status === 'rejected');
        const allApproved = nextBranches.every((b) => b.status === 'approved');
        const isLast = wf.currentStepIndex >= wf.steps.length - 1;

        const updatedSteps = wf.steps.map((s, idx) => {
          if (idx === wf.currentStepIndex) {
            return {
              ...s,
              parallelBranches: nextBranches,
              status: anyRejected ? ('rejected' as const) : allApproved ? ('approved' as const) : ('pending' as const),
              actor: allApproved || anyRejected ? actorName : s.actor,
              at: allApproved || anyRejected ? nowIso : s.at,
              comment: comment?.trim() || s.comment,
            };
          }
          if (allApproved && idx === wf.currentStepIndex + 1) {
            return { ...s, startedAt: nowIso };
          }
          return s;
        });

        const nextStatus: WorkflowInstance['status'] = anyRejected
          ? 'rejected'
          : allApproved && isLast
            ? 'approved'
            : 'running';
        const nextIndex = allApproved && !isLast ? wf.currentStepIndex + 1 : wf.currentStepIndex;

        setState((prev) => ({
          ...prev,
          workflows: prev.workflows.map((w) =>
            w.id === id
              ? {
                  ...w,
                  steps: updatedSteps,
                  status: nextStatus,
                  currentStepIndex: nextIndex,
                  completedAt: nextStatus !== 'running' ? nowIso : w.completedAt,
                }
              : w,
          ),
          auditLogs: [
            makeAudit('گردش کار', 'approve', `شاخه «${targetBranch.branchName}» در «${wf.title}» ${decision === 'approved' ? 'تأیید' : 'رد'} شد.`),
            ...prev.auditLogs,
          ].slice(0, 100),
        }));
        pushToast(`شاخه «${targetBranch.branchName}» ${decision === 'approved' ? 'تأیید' : 'رد'} شد.`);
        return { ok: true };
      }

      if (step.role === 'admin' && curRole !== 'admin' && !step.delegatedTo) {
        pushToast('این مرحله نیازمند تأیید مدیر سیستم (Admin) است.', 'error');
        return { ok: false, error: 'این مرحله نیازمند تأیید مدیر سیستم (Admin) است.' };
      }

      const isLast = wf.currentStepIndex >= wf.steps.length - 1;
      const nextStatus: WorkflowInstance['status'] =
        decision === 'rejected' ? 'rejected' : isLast ? 'approved' : 'running';
      const nextIndex = decision === 'approved' && !isLast ? wf.currentStepIndex + 1 : wf.currentStepIndex;

      const updatedSteps = wf.steps.map((s, idx) => {
        if (idx === wf.currentStepIndex) {
          return {
            ...s,
            status: decision,
            actor: step.delegatedTo ? `${actorName} (تفویض به ${step.delegatedTo})` : actorName,
            comment: comment?.trim() || undefined,
            stepData: stepData ?? s.stepData,
            at: nowIso,
          };
        }
        if (decision === 'approved' && !isLast && idx === wf.currentStepIndex + 1) {
          return {
            ...s,
            startedAt: nowIso,
            timerExpiresAt:
              s.nodeType === 'timer' && s.timerHours
                ? new Date(Date.now() + s.timerHours * 3600_000).toISOString()
                : s.timerExpiresAt,
          };
        }
        return s;
      });

      setState((prev) => ({
        ...prev,
        workflows: prev.workflows.map((w) =>
          w.id === id
            ? {
                ...w,
                steps: updatedSteps,
                status: nextStatus,
                currentStepIndex: nextIndex,
                completedAt: nextStatus !== 'running' ? nowIso : w.completedAt,
              }
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
      pushToast(
        decision === 'approved' ? 'مرحله گردش کار تأیید شد.' : 'فرایند رد شد.',
        decision === 'approved' ? 'success' : 'info',
      );
      return { ok: true };
    },
    [pushToast],
  );

  const claimWorkflowStep = useCallback(
    (id: string) => {
      const roleName = stateRef.current.settings.role === 'admin' ? 'مدیر سیستم' : 'کارشناس';
      setState((prev) => ({
        ...prev,
        workflows: prev.workflows.map((w) =>
          w.id === id
            ? {
                ...w,
                steps: w.steps.map((s, idx) =>
                  idx === w.currentStepIndex ? { ...s, claimedBy: roleName, assignee: roleName } : s,
                ),
              }
            : w,
        ),
        auditLogs: [makeAudit('گردش کار', 'update', `گام فعلی گردش کار ${id} توسط «${roleName}» Claim شد.`), ...prev.auditLogs].slice(0, 100),
      }));
      pushToast('این گام به نام شما در دست گرفته شد (Claimed).');
    },
    [pushToast],
  );

  const reassignWorkflowStep = useCallback(
    (id: string, assignee: string) => {
      setState((prev) => ({
        ...prev,
        workflows: prev.workflows.map((w) =>
          w.id === id
            ? {
                ...w,
                steps: w.steps.map((s, idx) =>
                  idx === w.currentStepIndex ? { ...s, assignee, claimedBy: undefined } : s,
                ),
              }
            : w,
        ),
        auditLogs: [makeAudit('گردش کار', 'update', `مسئول گام فعلی به «${assignee}» تغییر کرد.`), ...prev.auditLogs].slice(0, 100),
      }));
      pushToast(`مسئول گام به «${assignee}» تغییر یافت.`);
    },
    [pushToast],
  );

  const delegateWorkflowStep = useCallback(
    (id: string, delegateTo: string) => {
      setState((prev) => ({
        ...prev,
        workflows: prev.workflows.map((w) =>
          w.id === id
            ? {
                ...w,
                steps: w.steps.map((s, idx) =>
                  idx === w.currentStepIndex ? { ...s, delegatedTo: delegateTo } : s,
                ),
              }
            : w,
        ),
        auditLogs: [makeAudit('گردش کار', 'update', `اختیار تأیید گام به «${delegateTo}» تفویض شد.`), ...prev.auditLogs].slice(0, 100),
      }));
      pushToast(`اختیار این گام به «${delegateTo}» تفویض شد.`, 'info');
    },
    [pushToast],
  );

  const advanceWorkflowTimer = useCallback(
    (id: string) => {
      decideWorkflowStep(id, 'approved', 'تایمر انتظار منقضی و گام به‌صورت خودکار عبور داده شد.');
    },
    [decideWorkflowStep],
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

  const updateContentItem = useCallback(
    (
      id: string,
      patch: Partial<Pick<ContentItem, 'title' | 'caption' | 'reach' | 'leadsCount' | 'hasBeforeAfterConsent' | 'status' | 'mediaAssetId'>>,
    ) => {
      setState((prev) => ({
        ...prev,
        contentItems: prev.contentItems.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      }));
      pushToast('مشخصات و شاخص‌های محتوا ذخیره شد.');
    },
    [pushToast],
  );

  const addCampaign = useCallback(
    (c: Omit<MarketingCampaign, 'id' | 'createdAt' | 'status'>) => {
      const created: MarketingCampaign = {
        ...c,
        id: `cmp_${Date.now()}`,
        status: 'draft',
        createdAt: new Date().toISOString(),
      };
      setState((prev) => ({
        ...prev,
        campaigns: [created, ...prev.campaigns],
        auditLogs: [makeAudit('بازاریابی', 'create', `کمپین «${created.name}» ایجاد شد.`), ...prev.auditLogs].slice(0, 100),
      }));
      pushToast(`کمپین «${created.name}» ایجاد شد.`);
    },
    [pushToast],
  );

  const launchCampaign = useCallback(
    (id: string) => {
      const cur = stateRef.current;
      const cmp = cur.campaigns.find((c) => c.id === id);
      if (!cmp) return;
      const nowIso = new Date().toISOString();
      const targets = cur.customers.filter((cust) => {
        if (cmp.channel === 'sms' && cust.consentSms === false) return false;
        return !cust.isAnonymized;
      });
      const sampleTargets = targets.slice(0, 8);
      const messages: OutboxMessage[] = sampleTargets.map((cust, idx) => {
        const useB = cmp.abTestEnabled && cmp.variantB && idx % 2 === 1;
        const tpl = useB ? cmp.variantB!.body : cmp.variantA.body;
        return {
          id: `msg_cmp_${Date.now()}_${idx}`,
          to: cust.phone,
          customerId: cust.id,
          customerName: cust.name,
          body: renderRuleTemplate(tpl, {
            customer: cust,
            businessName: cur.settings.businessName,
          }),
          channel: cmp.channel,
          ruleName: `کمپین: ${cmp.name} (${useB ? 'نسخه B' : 'نسخه A'})`,
          deliveryStatus: 'delivered',
          retryCount: 0,
          maxRetries: cur.automationPolicy.maxRetries,
          at: nowIso,
        };
      });

      const sentA = cmp.abTestEnabled ? Math.ceil(targets.length / 2) : targets.length;
      const sentB = cmp.abTestEnabled ? Math.floor(targets.length / 2) : 0;

      setState((prev) => ({
        ...prev,
        outbox: [...messages, ...prev.outbox],
        campaigns: prev.campaigns.map((c) =>
          c.id === id
            ? {
                ...c,
                status: 'running',
                launchedAt: nowIso,
                variantA: { ...c.variantA, sent: sentA },
                variantB: c.variantB ? { ...c.variantB, sent: sentB } : undefined,
              }
            : c,
        ),
        auditLogs: [makeAudit('بازاریابی', 'automation', `کمپین «${cmp.name}» برای ${targets.length} مخاطب ارسال شد.`), ...prev.auditLogs].slice(0, 100),
      }));
      pushToast(`کمپین «${cmp.name}» ارسال شد (${targets.length} مخاطب).`);
    },
    [pushToast],
  );

  const simulateCampaignStats = useCallback(
    (id: string) => {
      setState((prev) => ({
        ...prev,
        campaigns: prev.campaigns.map((c) => {
          if (c.id !== id) return c;
          const sentA = Math.max(c.variantA.sent, 20);
          const clicksA = Math.max(c.variantA.clicks, Math.round(sentA * 0.28));
          const convA = Math.max(c.variantA.conversions, Math.round(sentA * 0.09));
          let variantB = c.variantB;
          let winner: 'A' | 'B' | undefined = 'A';
          if (c.abTestEnabled && variantB) {
            const sentB = Math.max(variantB.sent, 20);
            const clicksB = Math.max(variantB.clicks, Math.round(sentB * 0.42));
            const convB = Math.max(variantB.conversions, Math.round(sentB * 0.16));
            variantB = { ...variantB, sent: sentB, clicks: clicksB, conversions: convB };
            winner = convB / sentB >= convA / sentA ? 'B' : 'A';
          }
          return {
            ...c,
            status: 'completed',
            variantA: { ...c.variantA, sent: sentA, clicks: clicksA, conversions: convA },
            variantB,
            winner,
          };
        }),
      }));
      pushToast('نتایج بازخورد و تست A/B کمپین شبیه‌سازی و برنده مشخص شد.');
    },
    [pushToast],
  );

  const addMediaAsset = useCallback(
    (asset: Omit<MediaAsset, 'id' | 'uploadedAt'>) => {
      const created: MediaAsset = {
        ...asset,
        id: `med_${Date.now()}`,
        uploadedAt: new Date().toISOString(),
      };
      setState((prev) => ({
        ...prev,
        mediaAssets: [created, ...prev.mediaAssets],
      }));
      pushToast(`فایل «${created.name}» به کتابخانه رسانه اضافه شد.`);
    },
    [pushToast],
  );

  const deleteMediaAsset = useCallback(
    (id: string) => {
      setState((prev) => ({
        ...prev,
        mediaAssets: prev.mediaAssets.filter((m) => m.id !== id),
      }));
      pushToast('فایل از کتابخانه رسانه حذف شد.', 'info');
    },
    [pushToast],
  );

  const addLandingForm = useCallback(
    (form: Omit<LandingForm, 'id' | 'submissionsCount' | 'createdAt'>) => {
      const created: LandingForm = {
        ...form,
        id: `lf_${Date.now()}`,
        submissionsCount: 0,
        createdAt: new Date().toISOString(),
      };
      setState((prev) => ({
        ...prev,
        landingForms: [created, ...prev.landingForms],
      }));
      pushToast(`فرم فرود «${created.title}» ساخته شد.`);
    },
    [pushToast],
  );

  const submitLandingForm = useCallback(
    (
      formId: string,
      data: { name: string; phone: string; email?: string; companyName?: string; notes?: string },
    ) => {
      const cur = stateRef.current;
      const form = cur.landingForms.find((f) => f.id === formId);
      if (!form) return { ok: false, error: 'فرم یافت نشد.' };
      if (!data.name.trim() || !isValidIranMobile(data.phone)) {
        return { ok: false, error: 'نام و شماره موبایل معتبر الزامی است.' };
      }
      const nowIso = new Date().toISOString();
      const existing = cur.customers.find((c) => c.phone === data.phone.trim());
      const customerId = existing ? existing.id : `c_lf_${Date.now()}`;
      const newCustomer: Customer | null = existing
        ? null
        : {
            id: customerId,
            name: data.name.trim(),
            phone: data.phone.trim(),
            email: data.email?.trim() || undefined,
            personType: data.companyName?.trim() ? 'organization' : 'individual',
            companyName: data.companyName?.trim() || undefined,
            lifecycle: form.defaultLifecycle,
            tags: ['فرم فرود', form.utmCampaign],
            source: form.sourceTag,
            notes: data.notes?.trim() || `ثبت‌شده از فرم ${form.title}`,
            consentSms: true,
            createdAt: nowIso,
          };

      const touch: UtmTouch = {
        id: `utm_${Date.now()}`,
        customerId,
        customerName: data.name.trim(),
        formId: form.id,
        utmSource: form.utmSource,
        utmMedium: form.utmMedium,
        utmCampaign: form.utmCampaign,
        landedAt: nowIso,
        converted: true,
      };

      setState((prev) => ({
        ...prev,
        customers: newCustomer ? [newCustomer, ...prev.customers] : prev.customers,
        utmTouches: [touch, ...prev.utmTouches],
        landingForms: prev.landingForms.map((f) =>
          f.id === formId ? { ...f, submissionsCount: f.submissionsCount + 1 } : f,
        ),
        auditLogs: [
          makeAudit('بازاریابی', 'create', `ثبت سرنخ «${data.name}» از فرم فرود (${form.utmCampaign}).`),
          ...prev.auditLogs,
        ].slice(0, 100),
      }));
      if (newCustomer) {
        setTimeout(() => fireAutomationEvent('on_create', 'customer', newCustomer as unknown as Record<string, unknown>), 50);
      }
      pushToast(`اطلاعات «${data.name}» از فرم فرود ثبت و در ردیابی UTM ذخیره شد.`);
      return { ok: true };
    },
    [fireAutomationEvent, pushToast],
  );

  const addTask = useCallback(
    (data: {
      title: string;
      customerId?: string;
      dueAt: string;
      assignee?: string;
      priority?: Task['priority'];
      subtasks?: { id: string; title: string; done: boolean }[];
      projectId?: string;
    }) => {
      if (!data.title.trim()) return;
      const task: Task = {
        id: `t_${Date.now()}`,
        title: data.title.trim(),
        customerId: data.customerId || undefined,
        dueAt: data.dueAt,
        done: false,
        assignee: data.assignee?.trim() || undefined,
        priority: data.priority ?? 'medium',
        subtasks: data.subtasks ?? [],
        projectId: data.projectId,
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

  const addTaskSubtask = useCallback((taskId: string, title: string) => {
    if (!title.trim()) return;
    setState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) =>
        t.id === taskId
          ? {
              ...t,
              subtasks: [...(t.subtasks ?? []), { id: `ts_${Date.now()}`, title: title.trim(), done: false }],
            }
          : t,
      ),
    }));
  }, []);

  const toggleTaskSubtask = useCallback((taskId: string, subtaskId: string) => {
    setState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) =>
        t.id === taskId
          ? {
              ...t,
              subtasks: (t.subtasks ?? []).map((s) => (s.id === subtaskId ? { ...s, done: !s.done } : s)),
            }
          : t,
      ),
    }));
  }, []);

  const addTicket = useCallback(
    (data: {
      customerId: string;
      subject: string;
      priority: Ticket['priority'];
      category?: string;
      team?: string;
      assignee?: string;
      rootCause?: string;
      initialBody?: string;
      customFields?: Record<string, string>;
    }) => {
      if (!data.subject.trim()) return;
      const nowIso = new Date().toISOString();
      const slaHours = data.priority === 'high' ? 4 : data.priority === 'normal' ? 24 : 48;
      const cust = stateRef.current.customers.find((c) => c.id === data.customerId);
      const ticket: Ticket = {
        id: `k_${Date.now()}`,
        customerId: data.customerId,
        subject: data.subject.trim(),
        priority: data.priority,
        status: 'open',
        category: data.category || 'پشتیبانی عمومی',
        team: data.team || 'پذیرش',
        assignee: data.assignee || stateRef.current.settings.salesTeam[0],
        slaHours,
        rootCause: data.rootCause,
        createdAt: nowIso,
        customFields: data.customFields,
      };
      const initMsg: TicketMessage | null = data.initialBody?.trim()
        ? {
            id: `tm_${Date.now()}`,
            ticketId: ticket.id,
            authorName: cust?.name ?? 'مشتری',
            authorType: 'customer',
            visibility: 'public',
            body: data.initialBody.trim(),
            createdAt: nowIso,
          }
        : null;

      setState((prev) => ({
        ...prev,
        tickets: [ticket, ...prev.tickets],
        ticketMessages: initMsg ? [...prev.ticketMessages, initMsg] : prev.ticketMessages,
        auditLogs: [makeAudit('پشتیبانی', 'create', `تیکت «${ticket.subject}» ثبت شد.`), ...prev.auditLogs].slice(0, 100),
      }));
      setTimeout(() => fireAutomationEvent('on_ticket_create', 'ticket', ticket as unknown as Record<string, unknown>), 50);
      pushToast('تیکت جدید ثبت شد.');
    },
    [fireAutomationEvent, pushToast],
  );

  const updateTicket = useCallback(
    (
      id: string,
      patch: Partial<Pick<Ticket, 'status' | 'priority' | 'replyNote' | 'assignee' | 'team' | 'category' | 'rootCause'>>,
    ) => {
      const nowIso = new Date().toISOString();
      setState((prev) => ({
        ...prev,
        tickets: prev.tickets.map((t) =>
          t.id === id
            ? {
                ...t,
                ...patch,
                resolvedAt: patch.status === 'resolved' && !t.resolvedAt ? nowIso : t.resolvedAt,
              }
            : t,
        ),
      }));
      pushToast('تیکت به‌روزرسانی شد.');
    },
    [pushToast],
  );

  const addTicketMessage = useCallback(
    (
      ticketId: string,
      msg: { authorName: string; authorType: 'customer' | 'agent'; visibility: 'public' | 'internal'; body: string },
    ) => {
      if (!msg.body.trim()) return;
      const nowIso = new Date().toISOString();
      const created: TicketMessage = {
        id: `tm_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        ticketId,
        authorName: msg.authorName,
        authorType: msg.authorType,
        visibility: msg.visibility,
        body: msg.body.trim(),
        createdAt: nowIso,
      };
      setState((prev) => ({
        ...prev,
        ticketMessages: [...prev.ticketMessages, created],
        tickets: prev.tickets.map((t) =>
          t.id === ticketId
            ? {
                ...t,
                replyNote: msg.visibility === 'public' && msg.authorType === 'agent' ? msg.body.trim() : t.replyNote,
                status: msg.authorType === 'customer' && t.status === 'resolved' ? 'open' : t.status,
              }
            : t,
        ),
      }));
      pushToast(msg.visibility === 'internal' ? 'یادداشت داخلی کارشناس ثبت شد.' : 'پیام در رشته تیکت ثبت شد.');
    },
    [pushToast],
  );

  const mergeTickets = useCallback(
    (primaryId: string, duplicateId: string) => {
      if (primaryId === duplicateId) return { ok: false, error: 'دو تیکت نمی‌توانند یکسان باشند.' };
      const cur = stateRef.current;
      const primary = cur.tickets.find((t) => t.id === primaryId);
      const dup = cur.tickets.find((t) => t.id === duplicateId);
      if (!primary || !dup) return { ok: false, error: 'تیکت یافت نشد.' };
      const nowIso = new Date().toISOString();
      const mergeNote: TicketMessage = {
        id: `tm_merge_${Date.now()}`,
        ticketId: primaryId,
        authorName: 'سیستم پشتیبانی',
        authorType: 'agent',
        visibility: 'internal',
        body: `تیکت تکراری «${dup.subject}» (${dup.id}) با این تیکت ادغام شد.`,
        createdAt: nowIso,
      };
      setState((prev) => ({
        ...prev,
        ticketMessages: [
          ...prev.ticketMessages.map((m) => (m.ticketId === duplicateId ? { ...m, ticketId: primaryId } : m)),
          mergeNote,
        ],
        tickets: prev.tickets.map((t) => {
          if (t.id === primaryId) {
            return { ...t, mergedFromIds: [...(t.mergedFromIds ?? []), duplicateId] };
          }
          if (t.id === duplicateId) {
            return {
              ...t,
              status: 'resolved',
              resolvedAt: nowIso,
              mergedIntoTicketId: primaryId,
              replyNote: `ادغام‌شده در تیکت ${primaryId}`,
            };
          }
          return t;
        }),
        auditLogs: [makeAudit('پشتیبانی', 'merge', `تیکت ${duplicateId} در ${primaryId} ادغام شد.`), ...prev.auditLogs].slice(0, 100),
      }));
      pushToast(`تیکت «${dup.subject}» با موفقیت ادغام شد.`);
      return { ok: true };
    },
    [pushToast],
  );

  const checkAndEscalateTickets = useCallback(
    (silent = false) => {
      const cur = stateRef.current;
      const nowMs = Date.now();
      const nowIso = new Date().toISOString();
      const toEscalate = cur.tickets.filter((t) => {
        if (t.status === 'resolved' || t.escalated) return false;
        const limitH = t.slaHours ?? (t.priority === 'high' ? 4 : t.priority === 'normal' ? 24 : 48);
        const ageH = (nowMs - new Date(t.createdAt).getTime()) / 3600_000;
        return ageH >= limitH;
      });

      if (toEscalate.length === 0) {
        if (!silent) pushToast('تیکت جدیدی با نقض SLA برای تصعید یافت نشد.', 'info');
        return 0;
      }

      const escIds = new Set(toEscalate.map((t) => t.id));
      const newMsgs: TicketMessage[] = toEscalate.map((t, idx) => ({
        id: `tm_esc_${Date.now()}_${idx}`,
        ticketId: t.id,
        authorName: 'سیستم SLA',
        authorType: 'agent',
        visibility: 'internal',
        body: `تصعید خودکار: تیکت به دلیل عبور از مهلت پاسخگویی (${t.slaHours ?? 24} ساعت) به مدیر پشتیبانی ارجاع شد.`,
        createdAt: nowIso,
      }));

      setState((prev) => ({
        ...prev,
        tickets: prev.tickets.map((t) =>
          escIds.has(t.id)
            ? {
                ...t,
                escalated: true,
                escalatedAt: nowIso,
                escalatedTo: 'مدیر پشتیبانی',
                priority: 'high',
              }
            : t,
        ),
        ticketMessages: [...prev.ticketMessages, ...newMsgs],
        auditLogs: [
          makeAudit('پشتیبانی', 'automation', `${toEscalate.length} تیکت به دلیل نقض SLA به مدیر پشتیبانی تصعید شد.`),
          ...prev.auditLogs,
        ].slice(0, 100),
      }));
      if (!silent) {
        pushToast(`${toEscalate.length} تیکت دارای نقض SLA به مدیر پشتیبانی تصعید شد.`, 'info');
      }
      return toEscalate.length;
    },
    [pushToast],
  );

  const addKbArticle = useCallback(
    (article: Omit<KbArticle, 'id' | 'helpfulCount' | 'updatedAt'>) => {
      const nowIso = new Date().toISOString();
      const editor = stateRef.current.settings.role === 'admin' ? 'مدیر سیستم' : 'کارشناس';
      setState((prev) => ({
        ...prev,
        kbArticles: [
          {
            ...article,
            id: `kb_${Date.now()}`,
            helpfulCount: 0,
            updatedAt: nowIso,
            version: 1,
            versions: [
              {
                version: 1,
                title: article.title,
                category: article.category,
                body: article.body,
                updatedAt: nowIso,
                editor,
                changeNote: 'ایجاد مقاله',
              },
            ],
          },
          ...prev.kbArticles,
        ],
      }));
      pushToast(`مقاله «${article.title}» در پایگاه دانش ثبت شد.`);
    },
    [pushToast],
  );

  const updateKbArticle = useCallback(
    (id: string, patch: { title: string; category: string; body: string; changeNote?: string }) => {
      const nowIso = new Date().toISOString();
      const editor = stateRef.current.settings.role === 'admin' ? 'مدیر سیستم' : 'کارشناس';
      setState((prev) => ({
        ...prev,
        kbArticles: prev.kbArticles.map((art) => {
          if (art.id !== id) return art;
          const prevVersions = art.versions ?? [
            {
              version: art.version ?? 1,
              title: art.title,
              category: art.category,
              body: art.body,
              updatedAt: art.updatedAt,
              editor: 'مدیر سیستم',
              changeNote: 'نسخه قبلی',
            },
          ];
          const nextVer = (art.version ?? 1) + 1;
          return {
            ...art,
            title: patch.title.trim(),
            category: patch.category.trim(),
            body: patch.body.trim(),
            updatedAt: nowIso,
            version: nextVer,
            versions: [
              ...prevVersions,
              {
                version: nextVer,
                title: patch.title.trim(),
                category: patch.category.trim(),
                body: patch.body.trim(),
                updatedAt: nowIso,
                editor,
                changeNote: patch.changeNote?.trim() || 'ویرایش محتوا',
              },
            ],
          };
        }),
      }));
      pushToast('نسخه جدید مقاله پایگاه دانش ذخیره شد.');
    },
    [pushToast],
  );

  const restoreKbVersion = useCallback(
    (id: string, version: number) => {
      const art = stateRef.current.kbArticles.find((a) => a.id === id);
      const targetVer = art?.versions?.find((v) => v.version === version);
      if (!art || !targetVer) return;
      const nowIso = new Date().toISOString();
      const nextVer = (art.version ?? 1) + 1;
      setState((prev) => ({
        ...prev,
        kbArticles: prev.kbArticles.map((a) =>
          a.id === id
            ? {
                ...a,
                title: targetVer.title,
                category: targetVer.category,
                body: targetVer.body,
                updatedAt: nowIso,
                version: nextVer,
                versions: [
                  ...(a.versions ?? []),
                  {
                    version: nextVer,
                    title: targetVer.title,
                    category: targetVer.category,
                    body: targetVer.body,
                    updatedAt: nowIso,
                    editor: 'مدیر سیستم',
                    changeNote: `بازگردانی از نسخه ${version}`,
                  },
                ],
              }
            : a,
        ),
      }));
      pushToast(`نسخه ${version} مقاله بازیابی شد.`, 'info');
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

  const updateRule = useCallback(
    (id: string, patch: Partial<Rule>) => {
      setState((prev) => ({
        ...prev,
        rules: prev.rules.map((r) => (r.id === id ? { ...r, ...patch } : r)),
      }));
      pushToast('قانون اتوماسیون به‌روزرسانی شد.');
    },
    [pushToast],
  );

  const deleteRule = useCallback(
    (id: string) => {
      setState((prev) => ({
        ...prev,
        rules: prev.rules.filter((r) => r.id !== id),
      }));
      pushToast('قانون اتوماسیون حذف شد.', 'info');
    },
    [pushToast],
  );

  const updateAutomationPolicy = useCallback(
    (patch: Partial<AutomationPolicy>) => {
      setState((prev) => ({
        ...prev,
        automationPolicy: { ...prev.automationPolicy, ...patch },
      }));
      pushToast('تنظیمات ساعات سکوت و سقف ارسال ذخیره شد.');
    },
    [pushToast],
  );

  const dryRunRule = useCallback((rule: Rule, hourOverride?: number) => {
    return simulateRuleDryRun(rule, stateRef.current, hourOverride);
  }, []);

  const sendSimulatedSms = useCallback(
    (customerId: string, body: string, channel: NotificationChannel = 'sms') => {
      const cur = stateRef.current;
      const cust = cur.customers.find((c) => c.id === customerId);
      if (!cust) return { ok: false, error: 'مشتری انتخاب‌شده یافت نشد.' };
      if (!body.trim()) return { ok: false, error: 'متن پیام نمی‌تواند خالی باشد.' };
      if (channel === 'sms' && cust.consentSms === false) {
        return { ok: false, error: 'این مشتری رضایت دریافت پیامک را غیرفعال کرده است.' };
      }
      const nowIso = new Date().toISOString();
      const quiet = isWithinQuietHours(cur.automationPolicy);
      const msg: OutboxMessage = {
        id: `msg_manual_${Date.now()}`,
        to: channel === 'email' ? cust.email || cust.phone : cust.phone,
        customerId: cust.id,
        customerName: cust.name,
        body: body.trim(),
        channel,
        ruleName: 'ارسال دستی کارشناس',
        deliveryStatus: quiet ? 'deferred_quiet' : 'delivered',
        retryCount: 0,
        maxRetries: cur.automationPolicy.maxRetries,
        at: nowIso,
      };
      const interaction: Interaction = {
        id: `int_sms_${Date.now()}`,
        customerId: cust.id,
        channel: channel === 'sms' ? 'sms' : 'note',
        text: `اعلان شبیه‌سازی‌شده (${channel}): ${body.trim()}`,
        at: nowIso,
      };
      setState((prev) => ({
        ...prev,
        outbox: [msg, ...prev.outbox],
        interactions: [interaction, ...prev.interactions],
        auditLogs: [makeAudit('اعلان', 'create', `اعلان ${channel} دستی برای «${cust.name}» ثبت شد.`), ...prev.auditLogs].slice(0, 100),
      }));
      pushToast(`اعلان ${channel} برای «${cust.name}» ثبت شد.`);
      return { ok: true };
    },
    [pushToast],
  );

  const retryNotification = useCallback(
    (id: string) => {
      setState((prev) => ({
        ...prev,
        outbox: prev.outbox.map((m) =>
          m.id === id
            ? {
                ...m,
                deliveryStatus: 'delivered',
                retryCount: (m.retryCount ?? 0) + 1,
                lastError: undefined,
                nextRetryAt: undefined,
              }
            : m,
        ),
      }));
      pushToast('ارسال مجدد با موفقیت انجام و تحویل شد.');
    },
    [pushToast],
  );

  const simulateDeliveryFailure = useCallback(
    (id: string) => {
      setState((prev) => ({
        ...prev,
        outbox: prev.outbox.map((m) => {
          if (m.id !== id) return m;
          const nextRetry = (m.retryCount ?? 0) + 1;
          const maxR = m.maxRetries ?? prev.automationPolicy.maxRetries;
          const isDead = nextRetry >= maxR;
          return {
            ...m,
            retryCount: nextRetry,
            maxRetries: maxR,
            deliveryStatus: isDead ? 'dead_letter' : 'retrying',
            nextRetryAt: isDead ? undefined : new Date(Date.now() + nextRetry * 5 * 60_000).toISOString(),
            lastError: isDead ? 'عبور از سقف تلاش مجدد — انتقال به صف خطای دائم (Dead-letter)' : `خطای موقت درگاه (تلاش ${nextRetry} از ${maxR})`,
          };
        }),
      }));
      pushToast('وضعیت خطا و تلاش مجدد شبیه‌سازی شد.', 'info');
    },
    [pushToast],
  );

  const processNotificationRetries = useCallback(() => {
    const cur = stateRef.current;
    let movedToDead = 0;
    let delivered = 0;
    const nextOutbox = cur.outbox.map((m) => {
      if (m.deliveryStatus === 'deferred_quiet' && !isWithinQuietHours(cur.automationPolicy)) {
        delivered++;
        return { ...m, deliveryStatus: 'delivered' as const };
      }
      if (m.deliveryStatus !== 'retrying') return m;
      const nextRetry = (m.retryCount ?? 0) + 1;
      const maxR = m.maxRetries ?? cur.automationPolicy.maxRetries;
      if (nextRetry >= maxR) {
        movedToDead++;
        return {
          ...m,
          retryCount: nextRetry,
          deliveryStatus: 'dead_letter' as const,
          nextRetryAt: undefined,
          lastError: 'تلاش‌های مجدد به اتمام رسید (Dead-letter)',
        };
      }
      delivered++;
      return {
        ...m,
        retryCount: nextRetry,
        deliveryStatus: 'delivered' as const,
        nextRetryAt: undefined,
        lastError: undefined,
      };
    });

    if (delivered === 0 && movedToDead === 0) {
      pushToast('موردی در صف تلاش مجدد یا ساعات سکوت یافت نشد.', 'info');
      return;
    }
    setState((prev) => ({ ...prev, outbox: nextOutbox }));
    pushToast(`پردازش صف انجام شد: ${delivered} تحویل شد، ${movedToDead} به Dead-letter منتقل شد.`);
  }, [pushToast]);

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
                  customerId: cust.id,
                  customerName: cust.name,
                  body: `${cust.name} عزیز، یادآوری نوبت تأییدشده شما در ${cur.settings.businessName} برای ۲۴ ساعت آینده ثبت شده است.`,
                  channel: 'sms',
                  ruleId: rule.id,
                  ruleName: rule.name,
                  appointmentId: apt.id,
                  deliveryStatus: 'delivered',
                  retryCount: 0,
                  maxRetries: cur.automationPolicy.maxRetries,
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
                  customerId: cust.id,
                  customerName: cust.name,
                  body: `${cust.name} عزیز، تا ۲ ساعت دیگر نوبت شما در ${cur.settings.businessName} شروع می‌شود. لطفاً عدد ۱ یا کلمه «تأیید» را ارسال کنید.`,
                  channel: 'sms',
                  ruleId: rule.id,
                  ruleName: rule.name,
                  appointmentId: apt.id,
                  canSimulateConfirm: apt.status === 'booked',
                  deliveryStatus: 'delivered',
                  retryCount: 0,
                  maxRetries: cur.automationPolicy.maxRetries,
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
                  customerId: cust.id,
                  customerName: cust.name,
                  body: `${cust.name} عزیز، تولدتان مبارک! هدیه ۲۰٪ (کد VIP20) از طرف ${cur.settings.businessName} تقدیم شما می‌شود.`,
                  channel: 'sms',
                  ruleId: rule.id,
                  ruleName: rule.name,
                  deliveryStatus: 'delivered',
                  retryCount: 0,
                  maxRetries: cur.automationPolicy.maxRetries,
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
                  customerId: cust.id,
                  customerName: cust.name,
                  body: `${cust.name} گرامی، سالگرد همراهی شما با ${cur.settings.businessName} را صمیمانه تبریک می‌گوییم!`,
                  channel: 'sms',
                  ruleId: rule.id,
                  ruleName: rule.name,
                  deliveryStatus: 'delivered',
                  retryCount: 0,
                  maxRetries: cur.automationPolicy.maxRetries,
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
                    customerId: cust.id,
                    customerName: cust.name,
                    body: `${cust.name} گرامی، جهت رزرو ویزیت کنترل خود در ${cur.settings.businessName} با ما در ارتباط باشید.`,
                    channel: 'sms',
                    ruleId: rule.id,
                    ruleName: rule.name,
                    deliveryStatus: 'delivered',
                    retryCount: 0,
                    maxRetries: cur.automationPolicy.maxRetries,
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
                  customerId: cust.id,
                  customerName: cust.name,
                  body: `${cust.name} عزیز، سفارش شما در ${cur.settings.businessName} در انتظار تأیید نهایی است.`,
                  channel: 'sms',
                  ruleId: rule.id,
                  ruleName: rule.name,
                  deliveryStatus: 'delivered',
                  retryCount: 0,
                  maxRetries: cur.automationPolicy.maxRetries,
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
                  customerId: cust.id,
                  customerName: cust.name,
                  body: `${cust.name} گرامی، اعتبار قرارداد پشتیبانی شما در ${cur.settings.businessName} طی روزهای آینده به پایان می‌رسد.`,
                  channel: 'sms',
                  ruleId: rule.id,
                  ruleName: rule.name,
                  deliveryStatus: 'delivered',
                  retryCount: 0,
                  maxRetries: cur.automationPolicy.maxRetries,
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

        // Dynamic Custom Rules Engine (evaluates AND/OR/NOT conditions, {{vars}}, Quiet Hours & Daily Cap!)
        if (!['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7'].includes(rule.id) && rule.targetEntity) {
          const candidates = getTargetRecordsForRule(rule, cur);
          const quiet = (rule.respectQuietHours ?? true) && isWithinQuietHours(cur.automationPolicy);
          const cap = rule.dailyCapPerCustomer ?? cur.automationPolicy.defaultDailyCap;
          let count = 0;

          for (const cand of candidates) {
            if (!evaluateRuleConditions(rule, cand.record, cand.customer)) continue;
            const key = `${rule.id}_${cand.entityId}`;
            if (processed.has(key)) continue;

            const actionType = rule.actionType ?? 'send_notification';
            const ch = rule.actionChannel ?? 'sms';
            const todayCount = countTodayCustomerNotifications(
              [...cur.outbox, ...newOutbox],
              cand.customer?.id,
              cand.customer?.phone,
            );

            if ((actionType === 'send_notification' || actionType === 'both') && cand.customer) {
              if (ch === 'sms' && cand.customer.consentSms === false) continue;
              if (cap > 0 && todayCount >= cap) continue;
              processed.add(key);
              count++;
              newOutbox.push({
                id: `msg_dyn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                to: ch === 'email' ? cand.customer.email || cand.customer.phone : cand.customer.phone,
                customerId: cand.customer.id,
                customerName: cand.customer.name,
                body: renderRuleTemplate(
                  rule.messageTemplate || 'سلام {{customer.name}}، پیام خودکار از {{businessName}}.',
                  { customer: cand.customer, entity: cand.record, businessName: cur.settings.businessName },
                ),
                channel: ch,
                ruleId: rule.id,
                ruleName: rule.name,
                deliveryStatus: quiet ? 'deferred_quiet' : 'delivered',
                retryCount: 0,
                maxRetries: cur.automationPolicy.maxRetries,
                at: nowIso,
              });
            }

            if (actionType === 'create_task' || actionType === 'both') {
              processed.add(key);
              count++;
              newTasks.push({
                id: `t_dyn_${Date.now()}_${count}_${Math.random().toString(36).slice(2, 5)}`,
                title: renderRuleTemplate(
                  rule.taskTitleTemplate || 'پیگیری خودکار {{customer.name}}',
                  { customer: cand.customer, entity: cand.record, businessName: cur.settings.businessName },
                ),
                customerId: cand.customer?.id,
                dueAt: new Date(nowMs + 24 * 3600_000).toISOString(),
                done: false,
                createdByRuleId: rule.id,
              });
            }
          }

          if (count > 0) {
            newLogs.push({
              id: `al_${Date.now()}_${rule.id}`,
              ruleId: rule.id,
              ruleName: rule.name,
              summary: `اجرای قانون پویا: ${count} اقدام با موفقیت ثبت شد.`,
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
          pushToast(`موتور اتوماسیون اجرا شد: ${newOutbox.length} اعلان و ${newTasks.length} وظیفه ثبت شد.`);
        }
      } else if (!silent) {
        pushToast('قوانین بررسی شدند؛ مورد جدیدی برای اجرا وجود نداشت.', 'info');
      }

      // Also check ticket SLA escalations quietly
      checkAndEscalateTickets(true);

      return totalActions;
    },
    [checkAndEscalateTickets, pushToast],
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
    pushToast('صف اعلان‌های شبیه‌سازی‌شده پاک شد.', 'info');
  }, [pushToast]);

  // --- SAYADI CHEQUES & PAYMENT GATEWAY (FR-FIN-04/05) ---
  const addSayadiCheque = useCallback(
    (data: Omit<SayadiCheque, 'id' | 'createdAt' | 'updatedAt'>) => {
      const nowIso = new Date().toISOString();
      const chq: SayadiCheque = {
        ...data,
        id: `chq_${Date.now()}`,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      setState((prev) => ({
        ...prev,
        sayadiCheques: [chq, ...prev.sayadiCheques],
        auditLogs: [
          makeAudit('مالی (چک صیادی)', 'create', `چک صیادی ${chq.chequeNo} به مبلغ ${chq.amount} ثبت شد.`),
          ...prev.auditLogs,
        ].slice(0, 100),
      }));
      pushToast(`چک صیادی شماره ${chq.chequeNo} ثبت شد.`);
    },
    [pushToast],
  );

  const updateSayadiChequeStatus = useCallback(
    (id: string, status: SayadiChequeStatus, note?: string) => {
      const cur = stateRef.current;
      const target = cur.sayadiCheques.find((c) => c.id === id);
      if (!target) return;
      const nowIso = new Date().toISOString();
      const wasCleared = target.status === 'cleared';
      const newlyCleared = status === 'cleared' && !wasCleared && Boolean(target.invoiceId);
      const bouncedTask: Task | null =
        status === 'bounced'
          ? {
              id: `t_chq_${Date.now()}`,
              title: `پیگیری فوری چک برگشتی ${target.chequeNo} (${target.drawerName})`,
              customerId: target.customerId,
              dueAt: new Date(Date.now() + 12 * 3600_000).toISOString(),
              done: false,
            }
          : null;

      setState((prev) => ({
        ...prev,
        sayadiCheques: prev.sayadiCheques.map((c) =>
          c.id === id ? { ...c, status, notes: note ?? c.notes, updatedAt: nowIso } : c,
        ),
        invoices: newlyCleared
          ? prev.invoices.map((inv) => {
              if (inv.id !== target.invoiceId) return inv;
              const nextPaid = Math.min(inv.grandTotal, inv.paidAmount + target.amount);
              return {
                ...inv,
                paidAmount: nextPaid,
                method: 'cheque',
                status: nextPaid >= inv.grandTotal ? 'paid' : 'partial',
              };
            })
          : prev.invoices,
        tasks: bouncedTask ? [bouncedTask, ...prev.tasks] : prev.tasks,
        auditLogs: [
          makeAudit('مالی (چک صیادی)', 'update', `وضعیت چک ${target.chequeNo} به ${status} تغییر یافت.`),
          ...prev.auditLogs,
        ].slice(0, 100),
      }));

      if (newlyCleared) {
        pushToast(`چک ${target.chequeNo} وصول شد و مبلغ به فاکتور متصل تخصیص یافت.`);
      } else if (status === 'bounced') {
        pushToast(`چک ${target.chequeNo} برگشت خورد و وظیفه پیگیری فوری ایجاد شد.`, 'error');
      } else {
        pushToast('وضعیت چک صیادی به‌روزرسانی شد.');
      }
    },
    [pushToast],
  );

  const processSandboxPayment = useCallback(
    (data: {
      invoiceId: string;
      gateway: PaymentTransaction['gateway'];
      amount: number;
      cardMasked: string;
      outcome: 'succeeded' | 'failed' | 'cancelled';
    }) => {
      const inv = stateRef.current.invoices.find((i) => i.id === data.invoiceId);
      if (!inv) return { ok: false, errorMessage: 'فاکتور یافت نشد.' };
      const nowIso = new Date().toISOString();
      const refId =
        data.outcome === 'succeeded' ? `SHP-${Math.floor(10000000 + Math.random() * 89999999)}` : undefined;
      const errorMessage =
        data.outcome === 'failed'
          ? 'تراکنش توسط شاپرک ناموفق اعلام شد (موجودی ناکافی / خطای رمز پویا)'
          : data.outcome === 'cancelled'
            ? 'پرداخت توسط کاربر در صفحه درگاه لغو شد'
            : undefined;

      const tx: PaymentTransaction = {
        id: `ptx_${Date.now()}`,
        invoiceId: inv.id,
        invoiceNo: inv.invoiceNo,
        customerId: inv.customerId,
        gateway: data.gateway,
        amount: data.amount,
        cardMasked: data.cardMasked,
        refId,
        status: data.outcome,
        errorCode: data.outcome === 'failed' ? 'ERR_51_FUNDS' : data.outcome === 'cancelled' ? 'ERR_USER_CANCEL' : undefined,
        errorMessage,
        at: nowIso,
      };

      setState((prev) => ({
        ...prev,
        paymentTransactions: [tx, ...prev.paymentTransactions],
        invoices:
          data.outcome === 'succeeded'
            ? prev.invoices.map((i) => {
                if (i.id !== inv.id) return i;
                const nextPaid = Math.min(i.grandTotal, i.paidAmount + data.amount);
                return {
                  ...i,
                  paidAmount: nextPaid,
                  method: 'online',
                  status: nextPaid >= i.grandTotal ? 'paid' : 'partial',
                };
              })
            : prev.invoices,
        auditLogs: [
          makeAudit(
            'درگاه پرداخت',
            data.outcome === 'succeeded' ? 'approve' : 'system',
            `تراکنش ${inv.invoiceNo} در درگاه ${data.gateway}: ${data.outcome}${refId ? ` (کد پیگیری ${refId})` : ''}`,
          ),
          ...prev.auditLogs,
        ].slice(0, 100),
      }));

      if (data.outcome === 'succeeded') {
        pushToast(`پرداخت آنلاین با موفقیت تأیید شد. کد رهگیری: ${refId}`);
        return { ok: true, refId };
      }
      pushToast(errorMessage ?? 'تراکنش ناموفق بود.', 'error');
      return { ok: false, errorMessage };
    },
    [pushToast],
  );

  // --- DASHBOARD WIDGETS & SCHEDULED REPORTS (FR-RPT-01/04) ---
  const updateDashboardWidgets = useCallback((widgets: DashboardWidgetConfig[]) => {
    setState((prev) => ({
      ...prev,
      settings: { ...prev.settings, dashboardWidgets: widgets },
    }));
  }, []);

  const resetDashboardWidgets = useCallback(() => {
    setState((prev) => ({
      ...prev,
      settings: { ...prev.settings, dashboardWidgets: defaultDashboardWidgets },
    }));
    pushToast('چیدمان ویجت‌های داشبورد به حالت پیش‌فرض بازگشت.', 'info');
  }, [pushToast]);

  const addScheduledReport = useCallback(
    (rep: Omit<ScheduledReport, 'id' | 'nextRunAt'>) => {
      const hours = rep.frequency === 'daily' ? 24 : rep.frequency === 'weekly' ? 168 : 720;
      const created: ScheduledReport = {
        ...rep,
        id: `sr_${Date.now()}`,
        nextRunAt: new Date(Date.now() + hours * 3600_000).toISOString(),
      };
      setState((prev) => ({
        ...prev,
        scheduledReports: [created, ...prev.scheduledReports],
      }));
      pushToast(`ارسال زمان‌بندی‌شده «${created.title}» ثبت شد.`);
    },
    [pushToast],
  );

  const toggleScheduledReport = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      scheduledReports: prev.scheduledReports.map((r) => (r.id === id ? { ...r, active: !r.active } : r)),
    }));
  }, []);

  const deleteScheduledReport = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      scheduledReports: prev.scheduledReports.filter((r) => r.id !== id),
    }));
  }, []);

  const runScheduledReportNow = useCallback(
    (id: string) => {
      const rep = stateRef.current.scheduledReports.find((r) => r.id === id);
      if (!rep) return;
      const nowIso = new Date().toISOString();
      const emailMsg: OutboxMessage = {
        id: `msg_rpt_${Date.now()}`,
        to: rep.recipients,
        customerName: 'گیرندگان گزارش زمان‌بندی‌شده',
        body: `گزارش «${rep.title}» در قالب ${rep.format.toUpperCase()} آماده و به ${rep.recipients} ارسال شد.`,
        channel: 'email',
        ruleName: 'ارسال زمان‌بندی‌شده گزارش',
        deliveryStatus: 'delivered',
        retryCount: 0,
        maxRetries: 3,
        at: nowIso,
      };
      setState((prev) => ({
        ...prev,
        scheduledReports: prev.scheduledReports.map((r) =>
          r.id === id ? { ...r, lastSentAt: nowIso } : r,
        ),
        outbox: [emailMsg, ...prev.outbox],
      }));
      pushToast(`گزارش «${rep.title}» به‌صورت ایمیل ارسال شد و در صف اعلان ثبت گردید.`);
    },
    [pushToast],
  );

  // --- INDUSTRY PACKS & PACK BUILDER (Section 7) ---
  const applyIndustryPack = useCallback(
    (packKey: IndustryPack, installDefaults = true) => {
      const packDef =
        INDUSTRY_PACKS.find((p) => p.key === packKey) ??
        stateRef.current.customPacks.find((p) => p.key === packKey);

      if (!installDefaults || !packDef) {
        setState((prev) => ({
          ...prev,
          settings: { ...prev.settings, industryPack: packKey },
          auditLogs: [makeAudit('پیکربندی', 'update', `بسته صنعتی به ${packKey} تغییر یافت.`), ...prev.auditLogs].slice(0, 100),
        }));
        pushToast('بسته صنعتی فعال تغییر کرد.');
        return;
      }

      const cur = stateRef.current;
      const nowMs = Date.now();
      const existingFieldKeys = new Set(cur.customFieldDefs.map((f) => f.key));
      const newFields: CustomFieldDef[] = packDef.customFields
        .filter((f) => !existingFieldKeys.has(f.key))
        .map((f, i) => ({ ...f, id: `cf_pk_${nowMs}_${i}` }));

      const existingEntKeys = new Set(cur.customEntityDefs.map((e) => e.key));
      const newEntities: CustomEntityDef[] = packDef.customEntities
        .filter((e) => !existingEntKeys.has(e.key))
        .map((e, i) => ({ ...e, id: `ent_pk_${nowMs}_${i}`, createdAt: new Date().toISOString() }));

      const existingSvcNames = new Set(cur.services.map((s) => s.name));
      const newServices: Service[] = packDef.services
        .filter((s) => !existingSvcNames.has(s.name))
        .map((s, i) => ({ ...s, id: `srv_pk_${nowMs}_${i}` }));

      const existingProdNames = new Set(cur.products.map((p) => p.name));
      const newProducts: Product[] = packDef.products
        .filter((p) => !existingProdNames.has(p.name))
        .map((p, i) => ({ ...p, id: `prd_pk_${nowMs}_${i}` }));

      const existingRuleNames = new Set(cur.rules.map((r) => r.name));
      const newRules: Rule[] = packDef.rules
        .filter((r) => !existingRuleNames.has(r.name))
        .map((r, i) => ({ ...r, id: `rul_pk_${nowMs}_${i}` }));

      const packSales = getPackSalesConfig(packKey, cur.customPacks);

      setState((prev) => ({
        ...prev,
        customFieldDefs: [...prev.customFieldDefs, ...newFields],
        customEntityDefs: [...prev.customEntityDefs, ...newEntities],
        services: [...prev.services, ...newServices],
        products: [...prev.products, ...newProducts],
        rules: [...prev.rules, ...newRules],
        pipelineStages: packSales.defaultStages,
        pipelines: prev.pipelines.map((pl) =>
          pl.isDefault ? { ...pl, name: packSales.pipelineName, stages: packSales.defaultStages } : pl,
        ),
        settings: {
          ...prev.settings,
          industryPack: packKey,
          uiMode: packKey === 'freelancer' ? 'solo' : prev.settings.uiMode,
        },
        auditLogs: [
          makeAudit(
            'بسته صنعتی',
            'update',
            `بسته «${packDef.name}» نصب شد (${newFields.length} فیلد، ${newEntities.length} موجودیت، ${newServices.length} خدمت).`,
          ),
          ...prev.auditLogs,
        ].slice(0, 100),
      }));
      pushToast(`بسته «${packDef.name}» نصب و فیلدها/خدمات تخصصی آن به سیستم اضافه شد.`);
    },
    [pushToast],
  );

  const saveCustomPack = useCallback(
    (meta: { key: string; name: string; nameEn?: string; description: string }) => {
      const pack = buildPackFromState(stateRef.current, meta);
      setState((prev) => ({
        ...prev,
        customPacks: [pack, ...prev.customPacks],
        auditLogs: [makeAudit('Pack Builder', 'create', `بسته سفارشی «${pack.name}» از پیکربندی فعلی ساخته شد.`), ...prev.auditLogs].slice(0, 100),
      }));
      pushToast(`بسته سفارشی «${pack.name}» ذخیره شد و آماده خروجی JSON است.`);
      return pack;
    },
    [pushToast],
  );

  const importCustomPack = useCallback(
    (pack: PackTemplate) => {
      const normalized: PackTemplate = {
        ...pack,
        id: pack.id || `pack_imp_${Date.now()}`,
        isCustom: true,
      };
      setState((prev) => ({
        ...prev,
        customPacks: [normalized, ...prev.customPacks.filter((p) => p.key !== normalized.key)],
      }));
      pushToast(`بسته «${normalized.name}» به کتابخانه پک‌های شما وارد شد.`);
    },
    [pushToast],
  );

  // --- MULTI-BRANCH (FR-CORE-04) ---
  const addBranch = useCallback(
    (branch: Omit<Branch, 'id'>) => {
      const created: Branch = { ...branch, id: `br_${Date.now()}` };
      setState((prev) => ({
        ...prev,
        branches: [...prev.branches, created],
        auditLogs: [makeAudit('شعبه‌ها', 'create', `شعبه «${created.name}» اضافه شد.`), ...prev.auditLogs].slice(0, 100),
      }));
      pushToast(`شعبه «${created.name}» ایجاد شد.`);
    },
    [pushToast],
  );

  const updateBranch = useCallback((id: string, patch: Partial<Branch>) => {
    setState((prev) => ({
      ...prev,
      branches: prev.branches.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    }));
  }, []);

  const deleteBranch = useCallback(
    (id: string) => {
      if (stateRef.current.branches.length <= 1) {
        pushToast('حداقل یک شعبه فعال باید وجود داشته باشد.', 'error');
        return;
      }
      setState((prev) => ({
        ...prev,
        branches: prev.branches.filter((b) => b.id !== id),
        settings:
          prev.settings.activeBranchId === id
            ? { ...prev.settings, activeBranchId: 'all' }
            : prev.settings,
      }));
      pushToast('شعبه حذف شد.', 'info');
    },
    [pushToast],
  );

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

  const exportConfigJson = useCallback(() => {
    const cur = stateRef.current;
    const bundle: ClientFlowConfigBundle = {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      businessName: cur.settings.businessName,
      industryPack: cur.settings.industryPack,
      customFieldDefs: cur.customFieldDefs,
      customEntityDefs: cur.customEntityDefs,
      entityRelations: cur.entityRelations,
      pipelineStages: cur.pipelineStages,
      commissionTiers: cur.commissionTiers,
      workflowDefinitions: cur.workflowDefinitions,
      rules: cur.rules,
      numbering: cur.settings.numbering,
      dashboardWidgets: cur.settings.dashboardWidgets,
    };
    return JSON.stringify(bundle, null, 2);
  }, []);

  const importConfigJson = useCallback(
    (raw: string) => {
      try {
        const json = JSON.parse(raw);
        const parsed = configBundleSchema.safeParse(json);
        if (!parsed.success) {
          return { ok: false, error: 'ساختار فایل پیکربندی JSON معتبر نیست.' };
        }
        const cfg = parsed.data;
        const normalizedFields: CustomFieldDef[] = (cfg.customFieldDefs as CustomFieldDef[]).map((f, idx) => ({
          ...f,
          entity: f.entity ?? 'customer',
          active: f.active ?? true,
          order: f.order ?? idx + 1,
        }));

        setState((prev) => ({
          ...prev,
          customFieldDefs: normalizedFields,
          customEntityDefs: (cfg.customEntityDefs as CustomEntityDef[] | undefined) ?? prev.customEntityDefs,
          entityRelations: (cfg.entityRelations as EntityRelationDef[] | undefined) ?? prev.entityRelations,
          pipelineStages: (cfg.pipelineStages as PipelineStageConfig[] | undefined) ?? prev.pipelineStages,
          commissionTiers: (cfg.commissionTiers as CommissionTier[] | undefined) ?? prev.commissionTiers,
          workflowDefinitions: (cfg.workflowDefinitions as WorkflowDefinition[] | undefined) ?? prev.workflowDefinitions,
          rules: (cfg.rules as Rule[] | undefined) ?? prev.rules,
          settings: {
            ...prev.settings,
            industryPack: (cfg.industryPack as IndustryPack | undefined) ?? prev.settings.industryPack,
            numbering: (cfg.numbering as BusinessSettings['numbering'] | undefined) ?? prev.settings.numbering,
            dashboardWidgets:
              (cfg.dashboardWidgets as DashboardWidgetConfig[] | undefined) ?? prev.settings.dashboardWidgets,
          },
          auditLogs: [
            makeAudit('پیکربندی', 'update', `پیکربندی از فایل JSON (${normalizedFields.length} فیلد سفارشی) وارد شد بدون حذف داده‌های کاربران.`),
            ...prev.auditLogs,
          ].slice(0, 100),
        }));
        pushToast('پیکربندی با موفقیت وارد شد (داده‌های مشتریان و سفارش‌ها دست‌نخورده باقی ماند).');
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
        updateCustomerConsent,
        deleteCustomer,
        anonymizeCustomer,
        mergeCustomers,
        importCustomersBatch,
        rollbackCsvImportBatch,
        addCustomerRelation,
        removeCustomerRelation,
        addCustomerSegment,
        updateCustomerSegment,
        deleteCustomerSegment,
        saveCustomerView,
        deleteCustomerView,
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
        sendAppointmentReminder,
        addOrder,
        updateOrderStatus,
        recordOrderShipment,
        recordOrderReturn,
        adjustProductStock,
        addProduct,
        toggleCoupon,
        addCoupon,
        createInvoiceForOrder,
        createInvoiceFromContract,
        recordInvoicePayment,
        allocatePaymentToInvoices,
        sendOverdueInvoiceReminder,
        addContract,
        renewContract,
        updateContractStatus,
        runContractRenewalReminders,
        addWarrantyRecord,
        addWarrantyClaim,
        updateWarrantyClaimStatus,
        addProject,
        updateProjectStatus,
        addProjectTask,
        toggleProjectTask,
        addProjectTaskSubtask,
        toggleProjectTaskSubtask,
        addTimeEntry,
        toggleDeploymentCheck,
        addLead,
        updateLead,
        convertLeadToCustomerAndOpportunity,
        addPipeline,
        updatePipeline,
        deletePipeline,
        updateProduct,
        updateService,
        addPriceList,
        updatePriceList,
        deletePriceList,
        addOpportunity,
        moveOpportunityStage,
        convertOpportunityToCustomer,
        updatePipelineStages,
        updateSalesTargets,
        updateCommissionTiers,
        updateCommissionRule,
        approveCommissionEntry,
        generateMissingCommissions,
        createQuote,
        createQuoteVersion,
        updateQuoteStatus,
        approveQuoteDiscount,
        saveWorkflowDefinition,
        publishWorkflowDefinition,
        cloneWorkflowDraft,
        deleteWorkflowDefinition,
        createWorkflowInstance,
        decideWorkflowStep,
        claimWorkflowStep,
        reassignWorkflowStep,
        delegateWorkflowStep,
        advanceWorkflowTimer,
        addContentItem,
        updateContentStatus,
        updateContentItem,
        addCampaign,
        launchCampaign,
        simulateCampaignStats,
        addMediaAsset,
        deleteMediaAsset,
        addLandingForm,
        submitLandingForm,
        addTask,
        toggleTaskDone,
        addTaskSubtask,
        toggleTaskSubtask,
        addTicket,
        updateTicket,
        addTicketMessage,
        mergeTickets,
        checkAndEscalateTickets,
        addKbArticle,
        updateKbArticle,
        restoreKbVersion,
        voteKbHelpful,
        submitNpsSurvey,
        triggerNpsPrompt,
        toggleRule,
        addRule,
        updateRule,
        deleteRule,
        updateAutomationPolicy,
        dryRunRule,
        sendSimulatedSms,
        runAutomationNow,
        retryNotification,
        processNotificationRetries,
        simulateDeliveryFailure,
        clearOutbox,
        addSayadiCheque,
        updateSayadiChequeStatus,
        processSandboxPayment,
        updateDashboardWidgets,
        resetDashboardWidgets,
        addScheduledReport,
        toggleScheduledReport,
        deleteScheduledReport,
        runScheduledReportNow,
        applyIndustryPack,
        saveCustomPack,
        importCustomPack,
        addBranch,
        updateBranch,
        deleteBranch,
        updateSettings,
        resetDemoData,
        exportStateJson,
        importStateJson,
        exportConfigJson,
        importConfigJson,
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
