import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { getDefaultWidgetsForPersona } from '../data/dashboardCatalog';
import { INDUSTRY_PACKS, buildPackFromState, getPackSalesConfig } from '../data/packs';
import { DEFAULT_TENANT_ID } from '../data/repositories/customerRepository';
import { stampCreateMeta, stampUpdateMeta } from '../data/repositories/types';
import { createInitialState, defaultDashboardWidgets } from '../data/seed';
import { getChatProvider, getSmsProvider } from '../services/providers/messagingAdapters';
import { notificationProvider } from '../services/providers/notificationProvider';
import { getPaymentGatewayProvider } from '../services/providers/paymentGatewayAdapter';
import { getTelephonyProvider } from '../services/providers/telephonyAdapter';
import { computeSyncHmacPreview } from '../services/providers/webhookAndOpenApi';
import type {
  AppState,
  Appointment,
  AppointmentStatus,
  AuditLogEntry,
  AutomationPolicy,
  Branch,
  BusinessSettings,
  CallLogEntry,
  CampaignRecipient,
  CampaignRecipientStatus,
  ChatProviderDriver,
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
  DashboardPersonaRole,
  DashboardWidgetConfig,
  DeploymentCheckItem,
  EntityRelationDef,
  IndustryPack,
  Interaction,
  InteractionOutcome,
  Invoice,
  KbArticle,
  LandingForm,
  LoyaltyConfig,
  LoyaltyReward,
  LoyaltyTransaction,
  MarketingCampaign,
  MediaAsset,
  MessageTemplate,
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
  SavedReportConfig,
  SayadiCheque,
  SayadiChequeStatus,
  ScheduledReport,
  KbVisibility,
  IntegrationsConfig,
  Service,
  SlaPolicy,
  SmsProviderDriver,
  StockMovement,
  SurveyType,
  Task,
  Ticket,
  TicketAttachment,
  TicketChannel,
  TicketMessage,
  TicketSeverity,
  TimeEntry,
  UtmTouch,
  WaitlistEntry,
  WarrantyClaim,
  WarrantyRecord,
  WebhookEndpoint,
  WebhookLogEntry,
  WorkflowDefinition,
  WorkflowHistoryEntry,
  WorkflowInstance,
  WorkflowStep,
  WorkflowType,
} from '../types';
import {
  countTodayCustomerNotifications,
  evaluateRuleConditions,
  evaluateWorkflowEdgeCondition,
  getNormalizedRuleActions,
  getTargetRecordsForRule,
  isChannelCapReached,
  isRuleInCooldown,
  isWithinQuietHours,
  renderRuleTemplate,
  simulateRuleDryRun,
  type DryRunResult,
  type RuleCandidate,
} from '../utils/automationEngine';
import { configBundleSchema } from '../utils/customFieldValidation';
import {
  computeCommissionAmount,
  computeLeadScoreHint,
  computeQuoteFinancials,
  daysUntilJalaliMonthDay,
  getSegmentMatchingCustomers,
} from '../utils/crmHelpers';
import { formatDocumentNumber } from '../utils/i18n';
import { formatJalali } from '../utils/jalali';
import { getDateKeyFromIso, hasConflict, isHolidayOrTimeOff, isValidIranMobile, isValidNationalId } from '../utils/overlap';
import { evaluateTicketSla, isTicketClosedStatus } from '../utils/slaEngine';

const STORAGE_KEY = 'clientflow_state_v2';

export type ToastMessage = {
  id: string;
  type: 'success' | 'error' | 'info';
  text: string;
};

export type PendingNpsPrompt = {
  customerId: string;
  refType: 'appointment' | 'order' | 'ticket';
  refId: string;
  label: string;
  defaultSurveyType?: SurveyType;
};

function mergeLoadedState(parsed: Partial<AppState> | null | undefined): AppState {
  const fallback = createInitialState();
  if (!parsed) return fallback;

  const existingRuleIds = new Set((parsed.rules ?? []).map((r) => r.id));
  const mergedRules = [
    ...(parsed.rules ?? fallback.rules),
    ...fallback.rules.filter((r) => !existingRuleIds.has(r.id)),
  ];

  const existingWfDefIds = new Set((parsed.workflowDefinitions ?? []).map((d) => d.id));
  const mergedWorkflowDefs = [
    ...(parsed.workflowDefinitions ?? fallback.workflowDefinitions),
    ...fallback.workflowDefinitions.filter((d) => !existingWfDefIds.has(d.id)),
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
    workflowDefinitions: mergedWorkflowDefs,
    campaigns: parsed.campaigns ?? fallback.campaigns,
    mediaAssets: parsed.mediaAssets ?? fallback.mediaAssets,
    landingForms: parsed.landingForms ?? fallback.landingForms,
    utmTouches: parsed.utmTouches ?? fallback.utmTouches,
    loyaltyConfig: {
      ...fallback.loyaltyConfig!,
      ...(parsed.loyaltyConfig ?? {}),
    },
    loyaltyRewards: parsed.loyaltyRewards ?? fallback.loyaltyRewards,
    loyaltyTransactions: parsed.loyaltyTransactions ?? fallback.loyaltyTransactions,
    ticketMessages: parsed.ticketMessages ?? fallback.ticketMessages,
    tickets: (parsed.tickets ?? fallback.tickets).map((t, idx) => ({
      ...t,
      trackingCode: t.trackingCode || `TK-1405-${String(101 + idx).padStart(3, '0')}`,
      channel: t.channel ?? 'portal',
      severity: t.severity ?? (t.priority === 'high' ? 'major' : 'minor'),
    })),
    slaPolicies: {
      ...fallback.slaPolicies,
      ...(parsed.slaPolicies ?? {}),
    },
    sayadiCheques: parsed.sayadiCheques ?? fallback.sayadiCheques,
    paymentTransactions: parsed.paymentTransactions ?? fallback.paymentTransactions,
    paymentAllocations: parsed.paymentAllocations ?? fallback.paymentAllocations,
    contracts: parsed.contracts ?? fallback.contracts,
    warranties: parsed.warranties ?? fallback.warranties,
    recentIdempotencyKeys: parsed.recentIdempotencyKeys ?? fallback.recentIdempotencyKeys ?? [],
    scheduledReports: parsed.scheduledReports ?? fallback.scheduledReports,
    savedReports: parsed.savedReports ?? [],
    branches: parsed.branches ?? fallback.branches,
    customPacks: parsed.customPacks ?? fallback.customPacks,
    messageTemplates: parsed.messageTemplates ?? fallback.messageTemplates,
    webhookLogs: parsed.webhookLogs ?? fallback.webhookLogs,
    callLogs: parsed.callLogs ?? fallback.callLogs,
    webhookEndpoints: parsed.webhookEndpoints ?? fallback.webhookEndpoints,
    integrationsConfig: {
      ...(fallback.integrationsConfig as IntegrationsConfig),
      ...(parsed.integrationsConfig ?? {}),
    },
    ruleCooldowns: parsed.ruleCooldowns ?? {},
    lastAutomationRunAt: parsed.lastAutomationRunAt ?? fallback.lastAutomationRunAt,
    automationTickCount: parsed.automationTickCount ?? fallback.automationTickCount ?? 1,
    automationPolicy: {
      ...fallback.automationPolicy,
      ...(parsed.automationPolicy ?? {}),
      channelDailyCaps: {
        ...fallback.automationPolicy.channelDailyCaps,
        ...(parsed.automationPolicy?.channelDailyCaps ?? {}),
      },
    },
    settings: {
      ...fallback.settings,
      ...(parsed.settings ?? {}),
      salesTeam: parsed.settings?.salesTeam ?? fallback.settings.salesTeam,
      numbering: {
        ...fallback.settings.numbering,
        ...(parsed.settings?.numbering ?? {}),
      },
      dashboardWidgets: (() => {
        const current = parsed.settings?.dashboardWidgets;
        if (!current || current.length === 0) return fallback.settings.dashboardWidgets;
        const existingIds = new Set(current.map((w) => w.id));
        const missing = fallback.settings.dashboardWidgets.filter((w) => !existingIds.has(w.id));
        return missing.length > 0 ? [...current, ...missing] : current;
      })(),
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

export type ActiveCallSession = {
  id: string;
  direction: 'inbound' | 'outbound';
  phone: string;
  customerId?: string;
  customerName: string;
  extension: string;
  providerDriver: 'simotel' | 'issabel';
  phase: 'ringing' | 'connected';
  startedAt: string;
};

type ClientFlowContextValue = {
  state: AppState;
  toasts: ToastMessage[];
  pendingNps: PendingNpsPrompt | null;
  activeCall: ActiveCallSession | null;
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

  // Marketing Content Calendar, Campaigns (A/B + ROI), Media Library, Landing Forms, UTM & Loyalty Club
  addContentItem: (item: Omit<ContentItem, 'id' | 'reach' | 'leadsCount'>) => void;
  updateContentStatus: (id: string, status: ContentStatus) => void;
  updateContentItem: (
    id: string,
    patch: Partial<
      Pick<
        ContentItem,
        'title' | 'caption' | 'reach' | 'engagement' | 'leadsCount' | 'hasBeforeAfterConsent' | 'status' | 'mediaAssetId' | 'assignee' | 'platform' | 'format' | 'scheduledAt'
      >
    >,
  ) => void;
  addCampaign: (c: Omit<MarketingCampaign, 'id' | 'createdAt' | 'status'> & { status?: MarketingCampaign['status'] }) => void;
  launchCampaign: (id: string) => void;
  updateCampaignRecipientStatus: (campaignId: string, recipientId: string, status: CampaignRecipientStatus) => void;
  simulateCampaignStats: (id: string) => void;
  addMediaAsset: (asset: Omit<MediaAsset, 'id' | 'uploadedAt'>) => void;
  toggleMediaConsent: (id: string) => void;
  deleteMediaAsset: (id: string) => void;
  addLandingForm: (form: Omit<LandingForm, 'id' | 'submissionsCount' | 'createdAt'>) => void;
  submitLandingForm: (
    formId: string,
    data: { name: string; phone: string; email?: string; companyName?: string; notes?: string },
  ) => { ok: boolean; error?: string };
  updateLoyaltyConfig: (patch: Partial<LoyaltyConfig>) => void;
  addLoyaltyReward: (reward: Omit<LoyaltyReward, 'id' | 'redeemedCount'>) => void;
  toggleLoyaltyReward: (id: string) => void;
  adjustCustomerPoints: (customerId: string, pointsDelta: number, description: string) => void;
  redeemLoyaltyReward: (customerId: string, rewardId: string) => { ok: boolean; error?: string; couponCode?: string };
  sendOccasionReward: (customerId: string, occasionType: 'birthday' | 'anniversary') => { ok: boolean; couponCode?: string };
  registerReferral: (referralCode: string, newCustomerName: string, newCustomerPhone: string) => { ok: boolean; error?: string };

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
    severity?: TicketSeverity;
    channel?: TicketChannel;
    category?: string;
    team?: string;
    assignee?: string;
    isComplaint?: boolean;
    rootCause?: string;
    complaintResolution?: string;
    complaintStatus?: Ticket['complaintStatus'];
    attachments?: TicketAttachment[];
    initialBody?: string;
    customFields?: Record<string, string>;
  }) => Ticket | null;
  updateTicket: (
    id: string,
    patch: Partial<
      Pick<
        Ticket,
        | 'status'
        | 'priority'
        | 'severity'
        | 'channel'
        | 'replyNote'
        | 'assignee'
        | 'team'
        | 'category'
        | 'isComplaint'
        | 'rootCause'
        | 'complaintResolution'
        | 'complaintStatus'
      >
    >,
  ) => void;
  addTicketMessage: (
    ticketId: string,
    msg: {
      authorName: string;
      authorType: 'customer' | 'agent';
      visibility: 'public' | 'internal';
      body: string;
      attachments?: TicketAttachment[];
    },
  ) => void;
  mergeTickets: (primaryId: string, duplicateId: string) => { ok: boolean; error?: string };
  checkAndEscalateTickets: (silent?: boolean) => number;
  escalateTicket: (ticketId: string, escalatedTo?: string) => void;
  updateSlaPolicy: (priority: Ticket['priority'], patch: Partial<Omit<SlaPolicy, 'priority'>>) => void;
  requestPortalOtp: (phone: string) => {
    ok: boolean;
    error?: string;
    code?: string;
    customerId?: string;
    customerName?: string;
  };
  submitPortalTicketByPhone: (data: {
    phone: string;
    name?: string;
    subject: string;
    category: string;
    priority?: Ticket['priority'];
    body: string;
    attachments?: TicketAttachment[];
  }) => { ok: boolean; error?: string; ticket?: Ticket };
  addKbArticle: (article: Omit<KbArticle, 'id' | 'helpfulCount' | 'updatedAt'>) => void;
  updateKbArticle: (
    id: string,
    patch: { title: string; category: string; body: string; visibility?: KbVisibility; changeNote?: string },
  ) => void;
  restoreKbVersion: (id: string, version: number) => void;
  voteKbHelpful: (id: string) => void;

  // NPS / CSAT / CES Surveys
  submitNpsSurvey: (data: Omit<NpsSurvey, 'id' | 'createdAt'>) => void;
  triggerNpsPrompt: (prompt: PendingNpsPrompt) => void;

  // Automation & Multi-Channel Notification Queue
  toggleRule: (id: string) => void;
  addRule: (rule: Omit<Rule, 'id'>) => void;
  updateRule: (id: string, patch: Partial<Rule>) => void;
  deleteRule: (id: string) => void;
  updateAutomationPolicy: (patch: Partial<AutomationPolicy>) => void;
  addMessageTemplate: (tpl: Omit<MessageTemplate, 'id' | 'updatedAt'>) => void;
  updateMessageTemplate: (id: string, patch: Partial<MessageTemplate>) => void;
  deleteMessageTemplate: (id: string) => void;
  dryRunRule: (rule: Rule, hourOverride?: number) => DryRunResult;
  sendSimulatedSms: (customerId: string, body: string, channel?: NotificationChannel) => { ok: boolean; error?: string };
  runAutomationNow: (silent?: boolean) => number;
  fireWebhookTrigger: (topic: string, customerId?: string, payloadSummary?: string) => number;
  fireCustomEventTrigger: (eventName: string, targetEntity: NonNullable<Rule['targetEntity']>, entityId?: string) => number;
  retryAutomationLog: (logId: string) => void;
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
  }) => {
    ok: boolean;
    refId?: string;
    authority?: string;
    errorMessage?: string;
    adapterSteps?: { step: string; detail: string; at: string }[];
  };

  // Phase 10: Integrations (Telephony/VoIP, SMS/Chat Adapters, Webhooks)
  updateIntegrationsConfig: (patch: Partial<IntegrationsConfig>) => void;
  startOutboundCall: (phone: string, customerId?: string) => void;
  triggerIncomingCall: (customerId?: string, phoneOverride?: string) => void;
  answerActiveCall: () => void;
  dismissActiveCall: () => void;
  completeActiveCall: (data: {
    status: CallLogEntry['status'];
    outcome?: InteractionOutcome;
    durationSec: number;
    notes: string;
    createFollowUpTask?: boolean;
  }) => void;
  sendViaSmsAdapter: (data: {
    driver?: SmsProviderDriver;
    to: string;
    body: string;
    customerId?: string;
    customerName?: string;
  }) => OutboxMessage;
  sendViaChatAdapter: (data: {
    driver?: ChatProviderDriver;
    to: string;
    body: string;
    customerId?: string;
    customerName?: string;
  }) => OutboxMessage;
  simulateOutboxDlr: (outboxId: string, outcome: 'delivered' | 'failed') => void;
  addWebhookEndpoint: (data: { name: string; url: string; secret: string; events: string[] }) => void;
  toggleWebhookEndpoint: (id: string) => void;
  deleteWebhookEndpoint: (id: string) => void;
  testFireWebhookEndpoint: (id: string, eventName: string) => void;

  // Reports & Dashboard Customization (FR-RPT-01/04 + Phase 9)
  setDashboardPersona: (persona: DashboardPersonaRole) => void;
  updateDashboardWidgets: (widgets: DashboardWidgetConfig[]) => void;
  resetDashboardWidgets: () => void;
  updateKpiTarget: (kpiId: string, targetValue: number) => void;
  saveCustomReport: (rep: Omit<SavedReportConfig, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => SavedReportConfig;
  deleteCustomReport: (id: string) => void;
  toggleShareSavedReport: (id: string) => void;
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
  const [activeCall, setActiveCall] = useState<ActiveCallSession | null>(null);
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

  const isTickRunningRef = useRef(false);

  // --- UNIFIED MULTI-ACTION RULE EXECUTOR (FR-AUT) ---
  const executeRuleBatch = useCallback(
    (
      rulesToEval: Rule[],
      triggerSource: 'schedule' | 'event' | 'webhook' | 'manual',
      resolveCandidates: (rule: Rule, cur: AppState) => RuleCandidate[],
      extraIncomingWebhook?: WebhookLogEntry,
    ) => {
      const cur = stateRef.current;
      const nowMs = Date.now();
      const nowIso = new Date().toISOString();
      const processed = new Set(cur.processedRuleKeys);
      const nextCooldowns: Record<string, string> = { ...(cur.ruleCooldowns ?? {}) };
      const newOutbox: OutboxMessage[] = [];
      const newTasks: Task[] = [];
      const newTickets: Ticket[] = [];
      const newWebhooks: WebhookLogEntry[] = extraIncomingWebhook ? [extraIncomingWebhook] : [];
      const newLogs: AppState['automationLogs'] = [];

      let nextCustomers = [...cur.customers];
      let nextOrders = [...cur.orders];
      let nextOpportunities = [...cur.opportunities];
      let nextTickets = [...cur.tickets];
      let nextAppointments = [...cur.appointments];
      let rrIdx = cur.settings.roundRobinIndex ?? 0;

      const patchEntityRecord = (
        entityType: NonNullable<Rule['targetEntity']>,
        entityId: string,
        patch: Record<string, unknown>,
      ) => {
        if (entityType === 'customer') {
          nextCustomers = nextCustomers.map((c) => (c.id === entityId ? { ...c, ...patch } : c));
        } else if (entityType === 'order') {
          nextOrders = nextOrders.map((o) => (o.id === entityId ? { ...o, ...patch, updatedAt: nowIso } : o));
        } else if (entityType === 'opportunity') {
          nextOpportunities = nextOpportunities.map((op) => (op.id === entityId ? { ...op, ...patch } : op));
        } else if (entityType === 'ticket') {
          nextTickets = nextTickets.map((t) => (t.id === entityId ? { ...t, ...patch } : t));
        } else if (entityType === 'appointment') {
          nextAppointments = nextAppointments.map((a) => (a.id === entityId ? { ...a, ...patch } : a));
        }
      };

      let totalActions = 0;

      for (const rule of rulesToEval) {
        const candidates = resolveCandidates(rule, cur);
        const quiet = (rule.respectQuietHours ?? true) && isWithinQuietHours(cur.automationPolicy);
        const cap = rule.dailyCapPerCustomer ?? cur.automationPolicy.defaultDailyCap;
        const actions = getNormalizedRuleActions(rule);

        let matchedCount = 0;
        let executedCount = 0;
        let skippedCount = 0;
        const skipReasons: string[] = [];

        for (const cand of candidates) {
          if (!evaluateRuleConditions(rule, cand.record, cand.customer, nowMs)) continue;
          matchedCount++;

          const entityKey =
            triggerSource === 'event'
              ? `${rule.id}_${cand.entityId}_${rule.triggerType ?? 'event'}`
              : `${rule.id}_${cand.entityId}`;

          if (!rule.allowRepeat && processed.has(entityKey)) {
            skippedCount++;
            if (skipReasons.length < 2) skipReasons.push('تکراری (Dedup)');
            continue;
          }
          if (isRuleInCooldown(nextCooldowns, rule, cand.entityId, nowMs)) {
            skippedCount++;
            if (skipReasons.length < 2) skipReasons.push(`در بازه Cooldown (${rule.cooldownMinutes} دقیقه)`);
            continue;
          }

          let candDidAct = false;
          const targetEntity = rule.targetEntity ?? 'customer';

          for (const act of actions) {
            if (act.type === 'send_sms' || act.type === 'send_whatsapp' || act.type === 'send_email') {
              if (!cand.customer) continue;
              const ch: NotificationChannel =
                act.channel ??
                (act.type === 'send_whatsapp'
                  ? 'whatsapp'
                  : act.type === 'send_email'
                    ? 'email'
                    : 'sms');

              if ((ch === 'sms' || ch === 'whatsapp') && cand.customer.consentSms === false) {
                skippedCount++;
                if (skipReasons.length < 2) skipReasons.push('عدم رضایت پیامکی/واتساپ (Opt-out)');
                continue;
              }
              if (ch === 'email' && cand.customer.consentEmail === false) {
                skippedCount++;
                if (skipReasons.length < 2) skipReasons.push('عدم رضایت ایمیل (Opt-out)');
                continue;
              }
              const todayCustCount = countTodayCustomerNotifications(
                [...cur.outbox, ...newOutbox],
                cand.customer.id,
                cand.customer.phone,
              );
              if (cap > 0 && todayCustCount >= cap) {
                skippedCount++;
                if (skipReasons.length < 2) skipReasons.push(`سقف روزانه مشتری (${cap})`);
                continue;
              }
              if (isChannelCapReached([...cur.outbox, ...newOutbox], ch, cur.automationPolicy)) {
                skippedCount++;
                if (skipReasons.length < 2) skipReasons.push(`سقف روزانه کانال ${ch}`);
                continue;
              }

              const body = renderRuleTemplate(
                act.messageTemplate || rule.messageTemplate || 'سلام {{customer.name}} عزیز، پیام خودکار از {{businessName}}.',
                { customer: cand.customer, entity: cand.record, businessName: cur.settings.businessName },
              );
              newOutbox.push({
                id: `msg_r_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                to: ch === 'email' ? cand.customer.email || cand.customer.phone : cand.customer.phone,
                customerId: cand.customer.id,
                customerName: cand.customer.name,
                body,
                channel: ch,
                ruleId: rule.id,
                ruleName: rule.name,
                deliveryStatus: quiet ? 'deferred_quiet' : 'delivered',
                retryCount: 0,
                maxRetries: cur.automationPolicy.maxRetries,
                at: nowIso,
              });
              candDidAct = true;
              executedCount++;
            } else if (act.type === 'create_task') {
              newTasks.push({
                id: `t_r_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                title: renderRuleTemplate(
                  act.taskTitleTemplate || rule.taskTitleTemplate || 'پیگیری خودکار {{customer.name}}',
                  { customer: cand.customer, entity: cand.record, businessName: cur.settings.businessName },
                ),
                customerId: cand.customer?.id,
                dueAt: new Date(nowMs + 24 * 3600_000).toISOString(),
                done: false,
                createdByRuleId: rule.id,
              });
              candDidAct = true;
              executedCount++;
            } else if (act.type === 'update_field' && act.field) {
              if (act.field.startsWith('customFields.')) {
                const cfKey = act.field.slice('customFields.'.length);
                const curCf = (cand.record.customFields as Record<string, string> | undefined) ?? {};
                patchEntityRecord(targetEntity, cand.entityId, {
                  customFields: { ...curCf, [cfKey]: act.value ?? '' },
                });
              } else {
                patchEntityRecord(targetEntity, cand.entityId, { [act.field]: act.value ?? '' });
              }
              candDidAct = true;
              executedCount++;
            } else if (act.type === 'change_stage' && act.stage) {
              if (targetEntity === 'opportunity') {
                patchEntityRecord('opportunity', cand.entityId, { stage: act.stage });
              } else {
                patchEntityRecord(targetEntity, cand.entityId, { status: act.stage });
              }
              candDidAct = true;
              executedCount++;
            } else if (act.type === 'assign_owner') {
              const team = cur.settings.salesTeam.length > 0 ? cur.settings.salesTeam : ['مدیر فروش'];
              const chosenOwner =
                !act.ownerName || act.ownerName === 'round_robin'
                  ? team[rrIdx % team.length]
                  : act.ownerName;
              if (!act.ownerName || act.ownerName === 'round_robin') rrIdx++;
              if (targetEntity === 'opportunity') {
                patchEntityRecord('opportunity', cand.entityId, { ownerName: chosenOwner });
              } else if (targetEntity === 'ticket') {
                patchEntityRecord('ticket', cand.entityId, { assignee: chosenOwner });
              } else if (targetEntity === 'customer') {
                patchEntityRecord('customer', cand.entityId, { owner: chosenOwner });
              }
              candDidAct = true;
              executedCount++;
            } else if (act.type === 'add_tag' && cand.customer && act.tag) {
              const targetCust = nextCustomers.find((c) => c.id === cand.customer!.id) ?? cand.customer;
              if (!targetCust.tags.includes(act.tag)) {
                nextCustomers = nextCustomers.map((c) =>
                  c.id === targetCust.id ? { ...c, tags: [...c.tags, act.tag!] } : c,
                );
              }
              candDidAct = true;
              executedCount++;
            } else if (act.type === 'create_ticket' && cand.customer) {
              const nextNum = cur.tickets.length + newTickets.length + 101;
              newTickets.push({
                id: `tk_auto_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
                trackingCode: `TK-1405-${String(nextNum).padStart(3, '0')}`,
                customerId: cand.customer.id,
                subject: renderRuleTemplate(
                  act.ticketSubjectTemplate || `پیگیری خودکار ${rule.name} — {{customer.name}}`,
                  { customer: cand.customer, entity: cand.record, businessName: cur.settings.businessName },
                ),
                channel: 'portal',
                priority: act.ticketPriority ?? 'normal',
                status: 'open',
                category: 'اتوماسیون',
                createdAt: nowIso,
              });
              candDidAct = true;
              executedCount++;
            } else if (act.type === 'call_webhook') {
              const url = act.webhookUrl || 'https://hooks.clientflow.ir/event';
              newWebhooks.push({
                id: `whl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                direction: 'outgoing',
                urlOrTopic: url,
                ruleId: rule.id,
                ruleName: rule.name,
                statusCode: 200,
                latencyMs: 95 + Math.floor(Math.random() * 110),
                payloadSummary: JSON.stringify({
                  rule: rule.name,
                  entity: targetEntity,
                  entityId: cand.entityId,
                  customer: cand.customer?.name ?? '-',
                }),
                ok: true,
                at: nowIso,
              });
              candDidAct = true;
              executedCount++;
            }
          }

          if (candDidAct) {
            processed.add(entityKey);
            nextCooldowns[`${rule.id}_${cand.entityId}`] = nowIso;
            totalActions++;
          }
        }

        if (matchedCount > 0) {
          const status: 'success' | 'skipped' | 'failed' = executedCount > 0 ? 'success' : 'skipped';
          newLogs.push({
            id: `al_${triggerSource}_${Date.now()}_${rule.id}_${Math.random().toString(36).slice(2, 4)}`,
            ruleId: rule.id,
            ruleName: rule.name,
            summary:
              executedCount > 0
                ? `${executedCount} اقدام برای ${matchedCount} رکورد منطبق اجرا شد.`
                : `قانون برای ${matchedCount} رکورد تطبیق یافت ولی به دلیل محافظ‌های سیستم رد (Skip) شد.`,
            status,
            reason:
              executedCount > 0
                ? skipReasons.length > 0
                  ? `اجرا با ${skippedCount} مورد معوق (${skipReasons.join('، ')})`
                  : 'تمام شروط و سیاست‌های ارسال رعایت شد'
                : skipReasons.join('، ') || 'تطبیق پیش‌تر پردازش شده یا در بازه Cooldown است',
            triggerSource,
            matchedCount,
            executedCount,
            skippedCount,
            at: nowIso,
          });
        }
      }

      if (
        newOutbox.length > 0 ||
        newTasks.length > 0 ||
        newTickets.length > 0 ||
        newWebhooks.length > 0 ||
        newLogs.length > 0 ||
        totalActions > 0
      ) {
        setState((prev) => ({
          ...prev,
          customers: nextCustomers,
          orders: nextOrders,
          opportunities: nextOpportunities,
          tickets: [...newTickets, ...nextTickets],
          appointments: nextAppointments,
          outbox: [...newOutbox, ...prev.outbox],
          tasks: [...newTasks, ...prev.tasks],
          webhookLogs: [...newWebhooks, ...(prev.webhookLogs ?? [])].slice(0, 80),
          automationLogs: [...newLogs, ...prev.automationLogs].slice(0, 150),
          processedRuleKeys: Array.from(processed),
          ruleCooldowns: nextCooldowns,
          settings: { ...prev.settings, roundRobinIndex: rrIdx },
        }));
      }

      return {
        totalActions,
        outboxCount: newOutbox.length,
        taskCount: newTasks.length,
        ticketCount: newTickets.length,
        webhookCount: newWebhooks.length,
      };
    },
    [],
  );

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
          (r.triggerType === triggerType || (triggerType === 'on_event' && r.triggerType === 'on_event')) &&
          (r.targetEntity ?? 'customer') === targetEntity &&
          (!r.pack || r.pack === 'all' || r.pack === cur.settings.industryPack),
      );
      if (matchingRules.length === 0) return;

      executeRuleBatch(matchingRules, 'event', (rule, s) =>
        getTargetRecordsForRule(rule, s, { entity: targetEntity, record }),
      );
    },
    [executeRuleBatch],
  );

  const fireWebhookTrigger = useCallback(
    (topic: string, customerId?: string, payloadSummary?: string) => {
      const cur = stateRef.current;
      const nowIso = new Date().toISOString();
      const normalizedTopic = topic.trim().toLowerCase();
      const matchingRules = cur.rules.filter(
        (r) =>
          r.active &&
          r.triggerType === 'on_webhook' &&
          (!r.webhookTopic || r.webhookTopic.trim().toLowerCase() === normalizedTopic) &&
          (!r.pack || r.pack === 'all' || r.pack === cur.settings.industryPack),
      );

      const incomingEntry: WebhookLogEntry = {
        id: `whl_in_${Date.now()}`,
        direction: 'incoming',
        urlOrTopic: `webhook/${topic || 'generic'}`,
        statusCode: 200,
        latencyMs: 32,
        payloadSummary: payloadSummary || `{"topic":"${topic}","customerId":"${customerId || 'all'}"}`,
        ok: true,
        at: nowIso,
      };

      if (matchingRules.length === 0) {
        setState((prev) => ({
          ...prev,
          webhookLogs: [incomingEntry, ...(prev.webhookLogs ?? [])].slice(0, 80),
          automationLogs: [
            {
              id: `al_wh_skip_${Date.now()}`,
              ruleId: 'webhook',
              ruleName: `وب‌هوک ورودی (${topic})`,
              summary: 'هیچ قانون فعال منطبق با این موضوع وب‌هوک یافت نشد.',
              status: 'skipped' as const,
              reason: 'قانون فعال با محرک on_webhook و موضوع مطابق وجود ندارد',
              triggerSource: 'webhook' as const,
              matchedCount: 0,
              executedCount: 0,
              skippedCount: 0,
              at: nowIso,
            },
            ...prev.automationLogs,
          ].slice(0, 150),
        }));
        pushToast(`وب‌هوک «${topic}» دریافت شد اما قانون فعالی برای آن وجود نداشت.`, 'info');
        return 0;
      }

      const targetCustomer = customerId ? cur.customers.find((c) => c.id === customerId) : undefined;
      const res = executeRuleBatch(
        matchingRules,
        'webhook',
        (rule, s) =>
          targetCustomer
            ? getTargetRecordsForRule(rule, s, {
                entity: rule.targetEntity ?? 'customer',
                record: targetCustomer as unknown as Record<string, unknown>,
              })
            : getTargetRecordsForRule(rule, s),
        incomingEntry,
      );
      pushToast(`وب‌هوک «${topic}» اجرا شد: ${res.totalActions} اقدام ثبت گردید.`);
      return res.totalActions;
    },
    [executeRuleBatch, pushToast],
  );

  const fireCustomEventTrigger = useCallback(
    (eventName: string, targetEntity: NonNullable<Rule['targetEntity']>, entityId?: string) => {
      const cur = stateRef.current;
      const matchingRules = cur.rules.filter(
        (r) =>
          r.active &&
          r.triggerType === 'on_event' &&
          (!r.eventName || r.eventName.trim().toLowerCase() === eventName.trim().toLowerCase()) &&
          (r.targetEntity ?? 'customer') === targetEntity &&
          (!r.pack || r.pack === 'all' || r.pack === cur.settings.industryPack),
      );
      if (matchingRules.length === 0) {
        pushToast(`رویداد «${eventName}» ثبت شد؛ قانون فعالی منطبق نبود.`, 'info');
        return 0;
      }
      const res = executeRuleBatch(matchingRules, 'event', (rule, s) => {
        const all = getTargetRecordsForRule(rule, s);
        return entityId ? all.filter((c) => c.entityId === entityId) : all;
      });
      pushToast(`رویداد «${eventName}» اجرا شد (${res.totalActions} اقدام).`);
      return res.totalActions;
    },
    [executeRuleBatch, pushToast],
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
          loyaltyPoints: data.loyaltyPoints ?? 0,
          lifetimePoints: data.lifetimePoints ?? 0,
          referralCode: data.referralCode ?? `REF-${Math.floor(1000 + Math.random() * 8999)}`,
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
        const lCfg = cur.loyaltyConfig;
        if (lCfg?.enabled && (lCfg.pointsPerVisit ?? 0) > 0) {
          const pts = lCfg.pointsPerVisit;
          const ltx: LoyaltyTransaction = {
            id: `ltx_vis_${Date.now()}`,
            customerId: customer.id,
            customerName: customer.name,
            type: 'earn_visit',
            points: pts,
            description: `کسب امتیاز بابت تکمیل نوبت (${id})`,
            refId: id,
            at: nowIso,
          };
          setState((prev) => ({
            ...prev,
            customers: prev.customers.map((c) =>
              c.id === customer.id
                ? {
                    ...c,
                    loyaltyPoints: (c.loyaltyPoints ?? 0) + pts,
                    lifetimePoints: (c.lifetimePoints ?? 0) + pts,
                  }
                : c,
            ),
            loyaltyTransactions: [ltx, ...(prev.loyaltyTransactions ?? [])].slice(0, 200),
          }));
        }
        const alreadyRated = cur.npsSurveys.some(
          (n) => n.refType === 'appointment' && n.refId === id,
        );
        if (!alreadyRated) {
          setPendingNps({
            customerId: customer.id,
            refType: 'appointment',
            refId: id,
            label: `نوبت انجام‌شده برای ${customer.name}`,
            defaultSurveyType: 'nps',
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
        const lCfg = cur.loyaltyConfig;
        if (lCfg?.enabled && (lCfg.pointsPer100kToman ?? 0) > 0) {
          const orderTotal = Math.max(
            0,
            target.items.reduce((s, it) => s + it.qty * it.price, 0) - (target.discountAmount ?? 0),
          );
          const pts = Math.floor(orderTotal / 100_000) * lCfg.pointsPer100kToman;
          if (pts > 0) {
            const ltx: LoyaltyTransaction = {
              id: `ltx_ord_${Date.now()}`,
              customerId: customer.id,
              customerName: customer.name,
              type: 'earn_purchase',
              points: pts,
              description: `کسب امتیاز بابت تکمیل سفارش ${id}`,
              refId: id,
              at: nowIso,
            };
            setState((prev) => ({
              ...prev,
              customers: prev.customers.map((c) =>
                c.id === customer.id
                  ? {
                      ...c,
                      loyaltyPoints: (c.loyaltyPoints ?? 0) + pts,
                      lifetimePoints: (c.lifetimePoints ?? 0) + pts,
                    }
                  : c,
              ),
              loyaltyTransactions: [ltx, ...(prev.loyaltyTransactions ?? [])].slice(0, 200),
            }));
          }
        }
        const alreadyRated = cur.npsSurveys.some(
          (n) => n.refType === 'order' && n.refId === id,
        );
        if (!alreadyRated) {
          setPendingNps({
            customerId: customer.id,
            refType: 'order',
            refId: id,
            label: `سفارش تحویل‌شده به ${customer.name}`,
            defaultSurveyType: 'csat',
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

      const actorName = cur.settings.role === 'admin' ? 'مدیر سیستم' : 'کارشناس';
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
          assigneeType: n.assigneeType ?? 'role',
          assignee: n.assigneeType === 'user' && n.assigneeUser ? n.assigneeUser : undefined,
          stepSlaHours: n.stepSlaHours ?? (n.type === 'wait' || n.type === 'timer' ? n.timerHours ?? 4 : 8),
          status: 'pending',
          startedAt: idx === 0 ? nowIso : undefined,
          timerHours: n.timerHours,
          timerExpiresAt:
            idx === 0 && (n.type === 'timer' || n.type === 'wait') && n.timerHours
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
          { name: 'بررسی درخواست و ثبت مستندات', nodeType: 'task', role: 'staff', stepSlaHours: 8, status: 'pending', startedAt: nowIso },
          { name: 'تأیید نهایی مدیر سیستم', nodeType: 'approval', role: 'admin', stepSlaHours: 12, status: 'pending' },
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
        history: [
          {
            id: `wfh_${Date.now()}`,
            at: nowIso,
            actor: actorName,
            stepName: 'شروع فرآیند',
            action: 'started',
            detail: `الگوی «${matchedDef?.name ?? data.type}» برای این درخواست آغاز شد.`,
          },
        ],
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
      const cur = stateRef.current;
      const wf = cur.workflows.find((w) => w.id === id);
      if (!wf || wf.status !== 'running') return { ok: false, error: 'فرایند فعال نیست.' };
      const step = wf.steps[wf.currentStepIndex];
      if (!step) return { ok: false, error: 'مرحله معتبر نیست.' };

      const curRole = cur.settings.role;
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
        const histEntry: WorkflowHistoryEntry = {
          id: `wfh_${Date.now()}`,
          at: nowIso,
          actor: actorName,
          stepName: `${step.name} ← ${targetBranch.branchName}`,
          action: decision === 'approved' ? 'approved' : 'rejected',
          detail: comment?.trim() || `رای شاخه موازی: ${decision === 'approved' ? 'تأیید' : 'رد'}`,
        };

        setState((prev) => ({
          ...prev,
          workflows: prev.workflows.map((w) =>
            w.id === id
              ? {
                  ...w,
                  steps: updatedSteps,
                  history: [...(w.history ?? []), histEntry],
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

      // Collect combined stepData across all steps to evaluate conditional transition / decision nodes
      const mergedContext: Record<string, unknown> = {};
      wf.steps.forEach((s) => {
        if (s.stepData) Object.assign(mergedContext, s.stepData);
      });
      if (stepData) Object.assign(mergedContext, stepData);

      let targetNextIndex = wf.currentStepIndex + 1;
      let decisionSummary: string | undefined;
      const newHist: WorkflowHistoryEntry[] = [
        {
          id: `wfh_${Date.now()}_a`,
          at: nowIso,
          actor: step.delegatedTo ? `${actorName} (تفویض: ${step.delegatedTo})` : actorName,
          stepName: step.name,
          action: decision === 'approved' ? 'approved' : 'rejected',
          detail: comment?.trim() || (decision === 'approved' ? 'مرحله تأیید و ثبت شد.' : 'درخواست در این مرحله رد شد.'),
        },
      ];

      // Evaluate conditional transition edges if this step belongs to a WorkflowDefinition
      const def = wf.definitionId ? cur.workflowDefinitions.find((d) => d.id === wf.definitionId) : undefined;
      if (decision === 'approved' && def && step.id) {
        const outEdges = def.edges.filter((e) => e.fromId === step.id);
        const condEdge =
          outEdges.find((e) => e.conditionField && evaluateWorkflowEdgeCondition(e, mergedContext)) ??
          outEdges[0];
        if (condEdge) {
          const destNode = def.nodes.find((n) => n.id === condEdge.toId);
          if (destNode?.type === 'end') {
            targetNextIndex = wf.steps.length; // Jump straight to end
            decisionSummary = condEdge.label || 'مسیر مستقیم پایان';
          } else if (destNode) {
            const matchedStepIdx = wf.steps.findIndex((s) => s.id === destNode.id);
            if (matchedStepIdx > wf.currentStepIndex) {
              targetNextIndex = matchedStepIdx;
              decisionSummary = condEdge.label || destNode.label;
            }
          }
          if (step.nodeType === 'decision' || condEdge.conditionField) {
            newHist.push({
              id: `wfh_${Date.now()}_d`,
              at: nowIso,
              actor: 'موتور تصمیم',
              stepName: step.name,
              action: 'decision',
              detail: `مسیر انتخاب‌شده: ${decisionSummary ?? condEdge.toId}`,
            });
          }
        }
      }

      const willComplete = decision === 'approved' && targetNextIndex >= wf.steps.length;
      const nextStatus: WorkflowInstance['status'] =
        decision === 'rejected' ? 'rejected' : willComplete ? 'approved' : 'running';
      const nextIndex = decision === 'approved' && !willComplete ? targetNextIndex : wf.currentStepIndex;

      if (willComplete) {
        newHist.push({
          id: `wfh_${Date.now()}_end`,
          at: nowIso,
          actor: 'سیستم گردش کار',
          stepName: 'پایان فرآیند',
          action: 'completed',
          detail: 'تمامی مراحل لازم با موفقیت تکمیل و فرآیند بسته شد.',
        });
      }

      const updatedSteps = wf.steps.map((s, idx) => {
        if (idx === wf.currentStepIndex) {
          return {
            ...s,
            status: decision,
            actor: step.delegatedTo ? `${actorName} (تفویض به ${step.delegatedTo})` : actorName,
            comment: comment?.trim() || undefined,
            decisionResult: decisionSummary ?? s.decisionResult,
            stepData: stepData ?? s.stepData,
            at: nowIso,
          };
        }
        // Mark skipped intermediate steps cleanly when decision jumps ahead
        if (decision === 'approved' && idx > wf.currentStepIndex && idx < targetNextIndex) {
          return {
            ...s,
            status: 'approved' as const,
            actor: 'عبور شرطی موتور',
            at: nowIso,
          };
        }
        if (decision === 'approved' && !willComplete && idx === targetNextIndex) {
          return {
            ...s,
            startedAt: nowIso,
            timerExpiresAt:
              (s.nodeType === 'timer' || s.nodeType === 'wait') && s.timerHours
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
                history: [...(w.history ?? []), ...newHist],
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
      const nowIso = new Date().toISOString();
      setState((prev) => ({
        ...prev,
        workflows: prev.workflows.map((w) =>
          w.id === id
            ? {
                ...w,
                steps: w.steps.map((s, idx) =>
                  idx === w.currentStepIndex ? { ...s, claimedBy: roleName, assignee: roleName } : s,
                ),
                history: [
                  ...(w.history ?? []),
                  {
                    id: `wfh_${Date.now()}`,
                    at: nowIso,
                    actor: roleName,
                    stepName: w.steps[w.currentStepIndex]?.name ?? 'گام جاری',
                    action: 'claimed',
                    detail: `گام توسط «${roleName}» در دست گرفته شد.`,
                  },
                ],
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
      const nowIso = new Date().toISOString();
      const actor = stateRef.current.settings.role === 'admin' ? 'مدیر سیستم' : 'کارشناس';
      setState((prev) => ({
        ...prev,
        workflows: prev.workflows.map((w) =>
          w.id === id
            ? {
                ...w,
                steps: w.steps.map((s, idx) =>
                  idx === w.currentStepIndex ? { ...s, assignee, claimedBy: undefined } : s,
                ),
                history: [
                  ...(w.history ?? []),
                  {
                    id: `wfh_${Date.now()}`,
                    at: nowIso,
                    actor,
                    stepName: w.steps[w.currentStepIndex]?.name ?? 'گام جاری',
                    action: 'reassigned',
                    detail: `مسئول گام به «${assignee}» تغییر یافت.`,
                  },
                ],
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
      const nowIso = new Date().toISOString();
      const actor = stateRef.current.settings.role === 'admin' ? 'مدیر سیستم' : 'کارشناس';
      setState((prev) => ({
        ...prev,
        workflows: prev.workflows.map((w) =>
          w.id === id
            ? {
                ...w,
                steps: w.steps.map((s, idx) =>
                  idx === w.currentStepIndex ? { ...s, delegatedTo: delegateTo } : s,
                ),
                history: [
                  ...(w.history ?? []),
                  {
                    id: `wfh_${Date.now()}`,
                    at: nowIso,
                    actor,
                    stepName: w.steps[w.currentStepIndex]?.name ?? 'گام جاری',
                    action: 'delegated',
                    detail: `اختیار تأیید به «${delegateTo}» تفویض شد.`,
                  },
                ],
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
      patch: Partial<
        Pick<
          ContentItem,
          'title' | 'caption' | 'reach' | 'engagement' | 'leadsCount' | 'hasBeforeAfterConsent' | 'status' | 'mediaAssetId' | 'assignee' | 'platform' | 'format' | 'scheduledAt'
        >
      >,
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
    (c: Omit<MarketingCampaign, 'id' | 'createdAt' | 'status'> & { status?: MarketingCampaign['status'] }) => {
      const isFutureSchedule =
        c.scheduledAt && !Number.isNaN(Date.parse(c.scheduledAt)) && Date.parse(c.scheduledAt) > Date.now();
      const created: MarketingCampaign = {
        ...c,
        id: `cmp_${Date.now()}`,
        status: c.status ?? (isFutureSchedule ? 'scheduled' : 'draft'),
        createdAt: new Date().toISOString(),
      };
      setState((prev) => ({
        ...prev,
        campaigns: [created, ...prev.campaigns],
        auditLogs: [makeAudit('بازاریابی', 'create', `کمپین «${created.name}» ایجاد شد.`), ...prev.auditLogs].slice(0, 100),
      }));
      pushToast(`کمپین «${created.name}» ${created.status === 'scheduled' ? 'زمان‌بندی' : 'ایجاد'} شد.`);
    },
    [pushToast],
  );

  const launchCampaign = useCallback(
    (id: string) => {
      const cur = stateRef.current;
      const cmp = cur.campaigns.find((c) => c.id === id);
      if (!cmp) return;
      const nowIso = new Date().toISOString();
      const segCustomers = getSegmentMatchingCustomers(cur, cmp.segmentId);
      const targets = segCustomers.filter((cust) => {
        if ((cmp.channel === 'sms' || cmp.channel === 'whatsapp') && cust.consentSms === false) return false;
        if (cmp.channel === 'email' && cust.consentEmail === false) return false;
        return true;
      });

      const recipients: CampaignRecipient[] = targets.map((cust, idx) => {
        const useB = cmp.abTestEnabled && cmp.variantB && idx % 2 === 1;
        return {
          id: `rcp_${Date.now()}_${idx}`,
          customerId: cust.id,
          customerName: cust.name,
          phone: cust.phone,
          variant: useB ? 'B' : 'A',
          status: idx % 5 === 0 ? 'sent' : 'delivered',
          updatedAt: nowIso,
        };
      });

      const sampleTargets = targets.slice(0, 10);
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

      const sentA = recipients.filter((r) => r.variant === 'A').length;
      const delivA = recipients.filter((r) => r.variant === 'A' && r.status !== 'sent').length;
      const sentB = recipients.filter((r) => r.variant === 'B').length;
      const delivB = recipients.filter((r) => r.variant === 'B' && r.status !== 'sent').length;

      setState((prev) => ({
        ...prev,
        outbox: [...messages, ...prev.outbox],
        campaigns: prev.campaigns.map((c) =>
          c.id === id
            ? {
                ...c,
                status: 'running',
                launchedAt: nowIso,
                recipients,
                variantA: { ...c.variantA, sent: sentA, delivered: delivA },
                variantB: c.variantB ? { ...c.variantB, sent: sentB, delivered: delivB } : undefined,
              }
            : c,
        ),
        auditLogs: [makeAudit('بازاریابی', 'automation', `کمپین «${cmp.name}» برای ${targets.length} مخاطب ارسال شد.`), ...prev.auditLogs].slice(0, 100),
      }));
      pushToast(`کمپین «${cmp.name}» ارسال شد (${targets.length} مخاطب).`);
    },
    [pushToast],
  );

  const updateCampaignRecipientStatus = useCallback(
    (campaignId: string, recipientId: string, status: CampaignRecipientStatus) => {
      const nowIso = new Date().toISOString();
      setState((prev) => ({
        ...prev,
        campaigns: prev.campaigns.map((c) => {
          if (c.id !== campaignId) return c;
          const nextRecipients = (c.recipients ?? []).map((r) =>
            r.id === recipientId ? { ...r, status, updatedAt: nowIso } : r,
          );
          const countFor = (v: 'A' | 'B') => {
            const list = nextRecipients.filter((r) => r.variant === v);
            const sent = Math.max(c[v === 'A' ? 'variantA' : 'variantB']?.sent ?? 0, list.length);
            const delivered = list.filter((r) => r.status !== 'sent').length;
            const clicks = list.filter((r) => r.status === 'clicked' || r.status === 'converted').length;
            const conversions = list.filter((r) => r.status === 'converted').length;
            return { sent, delivered, clicks, conversions };
          };
          const a = countFor('A');
          const b = c.variantB ? countFor('B') : undefined;
          const totalConverted = nextRecipients.filter((r) => r.status === 'converted').length;
          const winner: 'A' | 'B' | undefined =
            c.abTestEnabled && b
              ? b.conversions / Math.max(1, b.sent) > a.conversions / Math.max(1, a.sent)
                ? 'B'
                : 'A'
              : c.winner;
          return {
            ...c,
            recipients: nextRecipients,
            variantA: { ...c.variantA, ...a },
            variantB: c.variantB && b ? { ...c.variantB, ...b } : undefined,
            revenueGenerated: Math.max(c.revenueGenerated ?? 0, totalConverted * 1_650_000),
            winner,
          };
        }),
      }));
      pushToast('وضعیت گیرنده کمپین به‌روزرسانی شد.');
    },
    [pushToast],
  );

  const simulateCampaignStats = useCallback(
    (id: string) => {
      const nowIso = new Date().toISOString();
      setState((prev) => ({
        ...prev,
        campaigns: prev.campaigns.map((c) => {
          if (c.id !== id) return c;
          const baseRecipients =
            c.recipients && c.recipients.length > 0
              ? c.recipients
              : getSegmentMatchingCustomers(prev, c.segmentId)
                  .slice(0, 10)
                  .map((cust, idx) => ({
                    id: `rcp_sim_${Date.now()}_${idx}`,
                    customerId: cust.id,
                    customerName: cust.name,
                    phone: cust.phone,
                    variant: (c.abTestEnabled && c.variantB && idx % 2 === 1 ? 'B' : 'A') as 'A' | 'B',
                    status: 'delivered' as CampaignRecipientStatus,
                    updatedAt: nowIso,
                  }));

          const updatedRecipients: CampaignRecipient[] = baseRecipients.map((r, idx) => {
            const nextStatus: CampaignRecipientStatus =
              idx % 5 === 0
                ? 'converted'
                : idx % 3 === 0
                  ? 'clicked'
                  : idx % 4 === 0 && r.variant === 'B'
                    ? 'converted'
                    : 'delivered';
            return { ...r, status: nextStatus, updatedAt: nowIso };
          });

          const sentA = Math.max(c.variantA.sent, 24);
          const delivA = Math.max(c.variantA.delivered ?? 0, Math.round(sentA * 0.94));
          const clicksA = Math.max(c.variantA.clicks, Math.round(sentA * 0.28));
          const convA = Math.max(c.variantA.conversions, Math.round(sentA * 0.09));
          let variantB = c.variantB;
          let winner: 'A' | 'B' | undefined = 'A';
          let totalConv = convA;
          if (c.abTestEnabled && variantB) {
            const sentB = Math.max(variantB.sent, 24);
            const delivB = Math.max(variantB.delivered ?? 0, Math.round(sentB * 0.96));
            const clicksB = Math.max(variantB.clicks, Math.round(sentB * 0.42));
            const convB = Math.max(variantB.conversions, Math.round(sentB * 0.16));
            variantB = { ...variantB, sent: sentB, delivered: delivB, clicks: clicksB, conversions: convB };
            winner = convB / sentB >= convA / sentA ? 'B' : 'A';
            totalConv += convB;
          }
          const estimatedRev = Math.max(c.revenueGenerated ?? 0, totalConv * 1_650_000);
          return {
            ...c,
            status: 'completed',
            recipients: updatedRecipients,
            variantA: { ...c.variantA, sent: sentA, delivered: delivA, clicks: clicksA, conversions: convA },
            variantB,
            revenueGenerated: estimatedRev,
            winner,
          };
        }),
      }));
      pushToast('نتایج تحویل، کلیک، ROI و برنده تست A/B محاسبه شد.');
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

  const toggleMediaConsent = useCallback(
    (id: string) => {
      setState((prev) => ({
        ...prev,
        mediaAssets: prev.mediaAssets.map((m) =>
          m.id === id ? { ...m, hasModelConsent: !m.hasModelConsent } : m,
        ),
      }));
      pushToast('وضعیت رضایت‌نامه انتشار فایل تغییر کرد.');
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
      const team = cur.settings.salesTeam;
      const rrIdx = cur.settings.roundRobinIndex ?? 0;
      const assignedOwner =
        team.length > 0 && cur.settings.autoAssignLeads ? team[rrIdx % team.length] : team[0] ?? 'مدیر سیستم';

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
            ownerName: assignedOwner,
            notes: data.notes?.trim() || `ثبت‌شده از فرم ${form.title}`,
            consentSms: true,
            loyaltyPoints: 0,
            lifetimePoints: 0,
            referralCode: `REF-${Math.floor(1000 + Math.random() * 8999)}`,
            createdAt: nowIso,
          };

      const newLead: SalesLead = {
        id: `ld_lf_${Date.now()}`,
        name: data.name.trim(),
        phone: data.phone.trim(),
        email: data.email?.trim() || undefined,
        companyName: data.companyName?.trim() || undefined,
        source: form.sourceTag,
        score: computeLeadScoreHint({
          source: form.sourceTag,
          hasEmail: Boolean(data.email?.trim()),
          hasCompany: Boolean(data.companyName?.trim()),
        }),
        estimatedAmount: 5_000_000,
        ownerName: assignedOwner,
        assignedByRule: cur.settings.autoAssignLeads ? 'round_robin' : 'manual',
        status: 'new',
        convertedCustomerId: customerId,
        notes: data.notes?.trim() || `ارسال‌شده از فرم فرود «${form.title}» (${form.utmCampaign})`,
        createdAt: nowIso,
        updatedAt: nowIso,
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
        leads: [newLead, ...prev.leads],
        utmTouches: [touch, ...prev.utmTouches],
        landingForms: prev.landingForms.map((f) =>
          f.id === formId ? { ...f, submissionsCount: f.submissionsCount + 1 } : f,
        ),
        settings: cur.settings.autoAssignLeads
          ? { ...prev.settings, roundRobinIndex: (prev.settings.roundRobinIndex ?? 0) + 1 }
          : prev.settings,
        auditLogs: [
          makeAudit('بازاریابی', 'create', `ثبت سرنخ «${data.name}» از فرم فرود (${form.utmCampaign}).`),
          ...prev.auditLogs,
        ].slice(0, 100),
      }));
      if (newCustomer) {
        setTimeout(() => fireAutomationEvent('on_create', 'customer', newCustomer as unknown as Record<string, unknown>), 50);
      }
      pushToast(`سرنخ «${data.name}» در فروش و ردیابی UTM ثبت شد.`);
      return { ok: true };
    },
    [fireAutomationEvent, pushToast],
  );

  // --- LOYALTY CLUB & REFERRAL PROGRAM ---
  const updateLoyaltyConfig = useCallback(
    (patch: Partial<LoyaltyConfig>) => {
      setState((prev) => ({
        ...prev,
        loyaltyConfig: { ...(prev.loyaltyConfig ?? createInitialState().loyaltyConfig!), ...patch },
      }));
      pushToast('قوانین باشگاه مشتریان ذخیره شد.');
    },
    [pushToast],
  );

  const addLoyaltyReward = useCallback(
    (reward: Omit<LoyaltyReward, 'id' | 'redeemedCount'>) => {
      const created: LoyaltyReward = {
        ...reward,
        id: `rew_${Date.now()}`,
        redeemedCount: 0,
      };
      setState((prev) => ({
        ...prev,
        loyaltyRewards: [created, ...(prev.loyaltyRewards ?? [])],
      }));
      pushToast(`پاداش «${created.title}» به باشگاه اضافه شد.`);
    },
    [pushToast],
  );

  const toggleLoyaltyReward = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      loyaltyRewards: (prev.loyaltyRewards ?? []).map((r) =>
        r.id === id ? { ...r, active: !r.active } : r,
      ),
    }));
  }, []);

  const adjustCustomerPoints = useCallback(
    (customerId: string, pointsDelta: number, description: string) => {
      const cust = stateRef.current.customers.find((c) => c.id === customerId);
      if (!cust || pointsDelta === 0) return;
      const nowIso = new Date().toISOString();
      const ltx: LoyaltyTransaction = {
        id: `ltx_man_${Date.now()}`,
        customerId,
        customerName: cust.name,
        type: 'earn_manual',
        points: pointsDelta,
        description: description.trim() || (pointsDelta > 0 ? 'افزایش دستی امتیاز باشگاه' : 'کسر دستی امتیاز'),
        at: nowIso,
      };
      setState((prev) => ({
        ...prev,
        customers: prev.customers.map((c) =>
          c.id === customerId
            ? {
                ...c,
                loyaltyPoints: Math.max(0, (c.loyaltyPoints ?? 0) + pointsDelta),
                lifetimePoints:
                  pointsDelta > 0 ? (c.lifetimePoints ?? 0) + pointsDelta : c.lifetimePoints ?? 0,
              }
            : c,
        ),
        loyaltyTransactions: [ltx, ...(prev.loyaltyTransactions ?? [])].slice(0, 200),
      }));
      pushToast(`تغییر امتیاز برای «${cust.name}» ثبت شد.`);
    },
    [pushToast],
  );

  const redeemLoyaltyReward = useCallback(
    (customerId: string, rewardId: string) => {
      const cur = stateRef.current;
      const cust = cur.customers.find((c) => c.id === customerId);
      const reward = (cur.loyaltyRewards ?? []).find((r) => r.id === rewardId);
      if (!cust || !reward) return { ok: false, error: 'مشتری یا پاداش یافت نشد.' };
      const bal = cust.loyaltyPoints ?? 0;
      if (bal < reward.pointsCost) {
        return { ok: false, error: `امتیاز مشتری (${bal}) کمتر از امتیاز لازم (${reward.pointsCost}) است.` };
      }

      const nowIso = new Date().toISOString();
      const code = `LOY-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
      const newCoupon: Coupon = {
        id: `cp_loy_${Date.now()}`,
        code,
        discountPct: reward.discountPct,
        maxUses: 1,
        usedCount: 0,
        active: true,
        validFrom: nowIso,
        validTo: new Date(Date.now() + reward.validDays * 86400_000).toISOString(),
        minOrderAmount: reward.minOrderAmount,
      };
      const ltx: LoyaltyTransaction = {
        id: `ltx_red_${Date.now()}`,
        customerId: cust.id,
        customerName: cust.name,
        type: 'redeem_reward',
        points: -reward.pointsCost,
        description: `دریافت جایزه «${reward.title}»`,
        couponCode: code,
        at: nowIso,
      };
      const outboxMsg: OutboxMessage | null =
        cust.consentSms !== false
          ? {
              id: `msg_loy_${Date.now()}`,
              to: cust.phone,
              customerId: cust.id,
              customerName: cust.name,
              body: `${cust.name} عزیز، جایزه «${reward.title}» با کد تخفیف ${code} برای شما در ${cur.settings.businessName} صادر شد.`,
              channel: 'sms',
              ruleName: 'باشگاه مشتریان (Redeem)',
              deliveryStatus: 'delivered',
              retryCount: 0,
              maxRetries: cur.automationPolicy.maxRetries,
              at: nowIso,
            }
          : null;

      setState((prev) => ({
        ...prev,
        customers: prev.customers.map((c) =>
          c.id === cust.id
            ? { ...c, loyaltyPoints: Math.max(0, (c.loyaltyPoints ?? 0) - reward.pointsCost) }
            : c,
        ),
        loyaltyRewards: (prev.loyaltyRewards ?? []).map((r) =>
          r.id === reward.id ? { ...r, redeemedCount: r.redeemedCount + 1 } : r,
        ),
        coupons: [newCoupon, ...prev.coupons],
        loyaltyTransactions: [ltx, ...(prev.loyaltyTransactions ?? [])].slice(0, 200),
        outbox: outboxMsg ? [outboxMsg, ...prev.outbox] : prev.outbox,
        auditLogs: [
          makeAudit('باشگاه مشتریان', 'create', `تبدیل ${reward.pointsCost} امتیاز «${cust.name}» به کد ${code}.`),
          ...prev.auditLogs,
        ].slice(0, 100),
      }));
      pushToast(`کد تخفیف ${code} صادر و در صف ارسال ثبت شد.`);
      return { ok: true, couponCode: code };
    },
    [pushToast],
  );

  const sendOccasionReward = useCallback(
    (customerId: string, occasionType: 'birthday' | 'anniversary') => {
      const cur = stateRef.current;
      const cust = cur.customers.find((c) => c.id === customerId);
      if (!cust) return { ok: false };
      const cfg = cur.loyaltyConfig ?? createInitialState().loyaltyConfig!;
      const nowIso = new Date().toISOString();
      const prefix = occasionType === 'birthday' ? 'BDAY' : 'ANNIV';
      const code = `${prefix}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      const bonusPts = cfg.birthdayBonusPoints ?? 300;
      const discPct = cfg.birthdayDiscountPct ?? 15;
      const labelFa = occasionType === 'birthday' ? 'تولد' : 'سالگرد عضویت';

      const newCoupon: Coupon = {
        id: `cp_occ_${Date.now()}`,
        code,
        discountPct: discPct,
        maxUses: 1,
        usedCount: 0,
        active: true,
        validFrom: nowIso,
        validTo: new Date(Date.now() + 14 * 86400_000).toISOString(),
      };
      const ltx: LoyaltyTransaction = {
        id: `ltx_occ_${Date.now()}`,
        customerId: cust.id,
        customerName: cust.name,
        type: 'birthday_bonus',
        points: bonusPts,
        description: `هدیه مناسبت ${labelFa} + کد تخفیف ${discPct}٪`,
        couponCode: code,
        at: nowIso,
      };
      const outboxMsg: OutboxMessage | null =
        cust.consentSms !== false
          ? {
              id: `msg_occ_${Date.now()}`,
              to: cust.phone,
              customerId: cust.id,
              customerName: cust.name,
              body: `${cust.name} عزیز، ${labelFa}تان مبارک! از طرف ${cur.settings.businessName}، ${bonusPts} امتیاز هدیه و کد تخفیف ${discPct}٪ (${code}) تقدیم شما شد.`,
              channel: 'whatsapp',
              ruleName: `هدیه ${labelFa} باشگاه`,
              deliveryStatus: 'delivered',
              retryCount: 0,
              maxRetries: cur.automationPolicy.maxRetries,
              at: nowIso,
            }
          : null;

      setState((prev) => ({
        ...prev,
        customers: prev.customers.map((c) =>
          c.id === cust.id
            ? {
                ...c,
                loyaltyPoints: (c.loyaltyPoints ?? 0) + bonusPts,
                lifetimePoints: (c.lifetimePoints ?? 0) + bonusPts,
              }
            : c,
        ),
        coupons: [newCoupon, ...prev.coupons],
        loyaltyTransactions: [ltx, ...(prev.loyaltyTransactions ?? [])].slice(0, 200),
        outbox: outboxMsg ? [outboxMsg, ...prev.outbox] : prev.outbox,
      }));
      pushToast(`هدیه ${labelFa} برای «${cust.name}» با کد ${code} ارسال شد.`);
      return { ok: true, couponCode: code };
    },
    [pushToast],
  );

  const registerReferral = useCallback(
    (referralCode: string, newCustomerName: string, newCustomerPhone: string) => {
      const cur = stateRef.current;
      const cleanCode = referralCode.trim().toUpperCase();
      const referrer = cur.customers.find(
        (c) => (c.referralCode ?? '').toUpperCase() === cleanCode,
      );
      if (!referrer) return { ok: false, error: 'کد معرف یافت نشد.' };
      if (!newCustomerName.trim() || !isValidIranMobile(newCustomerPhone)) {
        return { ok: false, error: 'نام و شماره موبایل معتبر برای فرد معرفی‌شده الزامی است.' };
      }
      if (cur.customers.some((c) => c.phone === newCustomerPhone.trim())) {
        return { ok: false, error: 'این شماره موبایل قبلاً در سیستم ثبت شده است.' };
      }

      const cfg = cur.loyaltyConfig ?? createInitialState().loyaltyConfig!;
      const nowIso = new Date().toISOString();
      const newCustId = `c_ref_${Date.now()}`;
      const refPts = cfg.pointsPerReferral ?? 250;
      const welcomePts = cfg.referredWelcomePoints ?? 100;
      const couponCode = `REFW-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

      const newCust: Customer = {
        id: newCustId,
        name: newCustomerName.trim(),
        phone: newCustomerPhone.trim(),
        personType: 'individual',
        lifecycle: 'active',
        tags: ['معرفی‌شده'],
        source: 'معرفی',
        ownerName: referrer.ownerName ?? cur.settings.salesTeam[0],
        consentSms: true,
        loyaltyPoints: welcomePts,
        lifetimePoints: welcomePts,
        referralCode: `REF-${Math.floor(1000 + Math.random() * 8999)}`,
        referredByCustomerId: referrer.id,
        createdAt: nowIso,
      };

      const rel: CustomerRelation = {
        id: `rel_${Date.now()}`,
        fromCustomerId: referrer.id,
        toCustomerId: newCustId,
        relationType: 'referrer',
        note: `ثبت معرفی با کد ${cleanCode}`,
        createdAt: nowIso,
      };

      const txReferrer: LoyaltyTransaction = {
        id: `ltx_ref1_${Date.now()}`,
        customerId: referrer.id,
        customerName: referrer.name,
        type: 'earn_referral',
        points: refPts,
        description: `پاداش معرفی «${newCust.name}» با کد ${cleanCode}`,
        at: nowIso,
      };

      const txWelcome: LoyaltyTransaction = {
        id: `ltx_ref2_${Date.now()}`,
        customerId: newCustId,
        customerName: newCust.name,
        type: 'earn_referral',
        points: welcomePts,
        description: `امتیاز خوش‌آمدگویی معرفی‌شده توسط ${referrer.name}`,
        couponCode,
        at: nowIso,
      };

      const welcomeCoupon: Coupon = {
        id: `cp_ref_${Date.now()}`,
        code: couponCode,
        discountPct: 10,
        maxUses: 1,
        usedCount: 0,
        active: true,
        validFrom: nowIso,
        validTo: new Date(Date.now() + 30 * 86400_000).toISOString(),
      };

      setState((prev) => ({
        ...prev,
        customers: [
          newCust,
          ...prev.customers.map((c) =>
            c.id === referrer.id
              ? {
                  ...c,
                  loyaltyPoints: (c.loyaltyPoints ?? 0) + refPts,
                  lifetimePoints: (c.lifetimePoints ?? 0) + refPts,
                }
              : c,
          ),
        ],
        customerRelations: [rel, ...prev.customerRelations],
        coupons: [welcomeCoupon, ...prev.coupons],
        loyaltyTransactions: [txReferrer, txWelcome, ...(prev.loyaltyTransactions ?? [])].slice(0, 200),
        auditLogs: [
          makeAudit('باشگاه مشتریان', 'create', `معرفی «${newCust.name}» توسط «${referrer.name}» با کد ${cleanCode}.`),
          ...prev.auditLogs,
        ].slice(0, 100),
      }));
      pushToast(`معرفی ثبت شد! ${refPts} امتیاز به «${referrer.name}» و ${welcomePts} امتیاز به «${newCust.name}» تعلق گرفت.`);
      return { ok: true };
    },
    [pushToast],
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
      severity?: TicketSeverity;
      channel?: TicketChannel;
      category?: string;
      team?: string;
      assignee?: string;
      isComplaint?: boolean;
      rootCause?: string;
      complaintResolution?: string;
      complaintStatus?: Ticket['complaintStatus'];
      attachments?: TicketAttachment[];
      initialBody?: string;
      customFields?: Record<string, string>;
    }): Ticket | null => {
      if (!data.subject.trim()) return null;
      const nowIso = new Date().toISOString();
      const cur = stateRef.current;
      const policy = cur.slaPolicies[data.priority];
      const slaHours = policy ? Math.max(1, Math.round(policy.resolutionMin / 60)) : data.priority === 'high' ? 4 : data.priority === 'normal' ? 24 : 48;
      const jYear = formatJalali(nowIso, 'YYYY');
      const seqNum = 101 + cur.tickets.length;
      const trackingCode = `TK-${jYear}-${String(seqNum).padStart(3, '0')}`;
      const cust = cur.customers.find((c) => c.id === data.customerId);
      const isComplaint = Boolean(data.isComplaint || data.category === 'شکایت و کیفیت');
      const ticket: Ticket = {
        id: `k_${Date.now()}`,
        trackingCode,
        customerId: data.customerId,
        subject: data.subject.trim(),
        channel: data.channel || 'portal',
        priority: data.priority,
        severity: data.severity || (data.priority === 'high' ? 'major' : 'minor'),
        status: 'open',
        category: data.category || 'پشتیبانی عمومی',
        team: data.team || 'پذیرش',
        assignee: data.assignee || cur.settings.salesTeam[0],
        slaHours,
        attachments: data.attachments,
        isComplaint,
        rootCause: data.rootCause,
        complaintResolution: data.complaintResolution,
        complaintStatus: isComplaint ? data.complaintStatus || 'investigating' : undefined,
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
            attachments: data.attachments,
            createdAt: nowIso,
          }
        : null;

      setState((prev) => ({
        ...prev,
        tickets: [ticket, ...prev.tickets],
        ticketMessages: initMsg ? [...prev.ticketMessages, initMsg] : prev.ticketMessages,
        auditLogs: [makeAudit('پشتیبانی', 'create', `تیکت ${trackingCode} «${ticket.subject}» ثبت شد.`), ...prev.auditLogs].slice(0, 100),
      }));
      setTimeout(() => fireAutomationEvent('on_ticket_create', 'ticket', ticket as unknown as Record<string, unknown>), 50);
      pushToast(`تیکت جدید با کد رهگیری ${trackingCode} ثبت شد.`);
      return ticket;
    },
    [fireAutomationEvent, pushToast],
  );

  const updateTicket = useCallback(
    (
      id: string,
      patch: Partial<
        Pick<
          Ticket,
          | 'status'
          | 'priority'
          | 'severity'
          | 'channel'
          | 'replyNote'
          | 'assignee'
          | 'team'
          | 'category'
          | 'isComplaint'
          | 'rootCause'
          | 'complaintResolution'
          | 'complaintStatus'
        >
      >,
    ) => {
      const nowIso = new Date().toISOString();
      const cur = stateRef.current;
      const existing = cur.tickets.find((t) => t.id === id);
      const closingNow = patch.status && isTicketClosedStatus(patch.status) && existing && !isTicketClosedStatus(existing.status);

      setState((prev) => ({
        ...prev,
        tickets: prev.tickets.map((t) =>
          t.id === id
            ? {
                ...t,
                ...patch,
                resolvedAt:
                  patch.status && isTicketClosedStatus(patch.status) && !t.resolvedAt
                    ? nowIso
                    : patch.status && !isTicketClosedStatus(patch.status)
                      ? undefined
                      : t.resolvedAt,
              }
            : t,
        ),
      }));
      pushToast('تیکت به‌روزرسانی شد.');

      if (closingNow && existing) {
        const cust = cur.customers.find((c) => c.id === existing.customerId);
        const alreadyRated = cur.npsSurveys.some((n) => n.refType === 'ticket' && n.refId === id);
        if (cust && !alreadyRated) {
          setPendingNps({
            customerId: cust.id,
            refType: 'ticket',
            refId: id,
            label: `تیکت مختومه‌شده «${existing.subject}» (${cust.name})`,
            defaultSurveyType: 'csat',
          });
        }
      }
    },
    [pushToast],
  );

  const addTicketMessage = useCallback(
    (
      ticketId: string,
      msg: {
        authorName: string;
        authorType: 'customer' | 'agent';
        visibility: 'public' | 'internal';
        body: string;
        attachments?: TicketAttachment[];
      },
    ) => {
      if (!msg.body.trim() && (!msg.attachments || msg.attachments.length === 0)) return;
      const nowIso = new Date().toISOString();
      const created: TicketMessage = {
        id: `tm_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        ticketId,
        authorName: msg.authorName,
        authorType: msg.authorType,
        visibility: msg.visibility,
        body: msg.body.trim() || 'فایل پیوست ارسال شد.',
        attachments: msg.attachments,
        createdAt: nowIso,
      };
      setState((prev) => ({
        ...prev,
        ticketMessages: [...prev.ticketMessages, created],
        tickets: prev.tickets.map((t) => {
          if (t.id !== ticketId) return t;
          const isAgentPublicReply = msg.visibility === 'public' && msg.authorType === 'agent';
          return {
            ...t,
            firstRespondedAt: isAgentPublicReply && !t.firstRespondedAt ? nowIso : t.firstRespondedAt,
            replyNote: isAgentPublicReply ? created.body : t.replyNote,
            status: msg.authorType === 'customer' && isTicketClosedStatus(t.status) ? 'open' : t.status,
          };
        }),
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
        body: `تیکت تکراری «${dup.subject}» (${dup.trackingCode ?? dup.id}) با این تیکت ادغام شد.`,
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
              status: 'closed',
              resolvedAt: nowIso,
              mergedIntoTicketId: primaryId,
              replyNote: `ادغام‌شده در تیکت ${primary.trackingCode ?? primaryId}`,
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
        if (isTicketClosedStatus(t.status) || t.escalated) return false;
        const evalRes = evaluateTicketSla(t, cur.slaPolicies, cur.settings, cur.officialHolidays, nowMs);
        return evalRes.overallState === 'breached';
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
        body: `تصعید خودکار: تیکت به دلیل عبور از مهلت SLA ساعات کاری به مدیر پشتیبانی ارجاع شد.`,
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

  const escalateTicket = useCallback(
    (ticketId: string, escalatedTo = 'مدیر پشتیبانی') => {
      const nowIso = new Date().toISOString();
      const t = stateRef.current.tickets.find((x) => x.id === ticketId);
      if (!t) return;
      const escMsg: TicketMessage = {
        id: `tm_esc_manual_${Date.now()}`,
        ticketId,
        authorName: 'سیستم SLA',
        authorType: 'agent',
        visibility: 'internal',
        body: `تصعید فوری به «${escalatedTo}» ثبت و اولویت تیکت به فوری تغییر یافت.`,
        createdAt: nowIso,
      };
      setState((prev) => ({
        ...prev,
        tickets: prev.tickets.map((x) =>
          x.id === ticketId
            ? { ...x, escalated: true, escalatedAt: nowIso, escalatedTo, priority: 'high' }
            : x,
        ),
        ticketMessages: [...prev.ticketMessages, escMsg],
        auditLogs: [
          makeAudit('پشتیبانی', 'update', `تیکت ${t.trackingCode ?? t.id} به ${escalatedTo} تصعید شد.`),
          ...prev.auditLogs,
        ].slice(0, 100),
      }));
      pushToast(`تیکت «${t.subject}» به ${escalatedTo} تصعید شد.`);
    },
    [pushToast],
  );

  const updateSlaPolicy = useCallback(
    (priority: Ticket['priority'], patch: Partial<Omit<SlaPolicy, 'priority'>>) => {
      setState((prev) => ({
        ...prev,
        slaPolicies: {
          ...prev.slaPolicies,
          [priority]: {
            ...prev.slaPolicies[priority],
            ...patch,
          },
        },
      }));
      pushToast('سیاست SLA به‌روزرسانی شد.');
    },
    [pushToast],
  );

  const requestPortalOtp = useCallback(
    (phone: string) => {
      const normalized = phone.trim();
      if (!isValidIranMobile(normalized)) {
        return { ok: false, error: 'لطفاً شماره موبایل معتبر ایرانی (مثلاً 09121110001) وارد کنید.' };
      }
      const cur = stateRef.current;
      const cust = cur.customers.find((c) => c.phone === normalized && !c.isDeleted);
      const code = String(Math.floor(1000 + Math.random() * 9000));
      const nowIso = new Date().toISOString();
      const otpMsg: OutboxMessage = {
        id: `otp_${Date.now()}`,
        to: normalized,
        customerId: cust?.id,
        customerName: cust?.name ?? 'کاربر پورتال',
        body: `کد تایید ورود به پورتال مشتریان ${cur.settings.businessName}: ${code}`,
        channel: 'sms',
        ruleName: 'احراز هویت پورتال مشتری (OTP)',
        deliveryStatus: 'delivered',
        at: nowIso,
      };
      setState((prev) => ({
        ...prev,
        outbox: [otpMsg, ...prev.outbox],
      }));
      pushToast(`کد یک‌بارمصرف شبیه‌سازی‌شده به ${normalized} ارسال شد.`, 'info');
      return {
        ok: true,
        code,
        customerId: cust?.id,
        customerName: cust?.name,
      };
    },
    [pushToast],
  );

  const submitPortalTicketByPhone = useCallback(
    (data: {
      phone: string;
      name?: string;
      subject: string;
      category: string;
      priority?: Ticket['priority'];
      body: string;
      attachments?: TicketAttachment[];
    }) => {
      const normalizedPhone = data.phone.trim();
      if (!isValidIranMobile(normalizedPhone)) {
        return { ok: false, error: 'شماره موبایل معتبر نیست (با 09 شروع شود).' };
      }
      if (!data.subject.trim()) {
        return { ok: false, error: 'عنوان تیکت الزامی است.' };
      }
      const cur = stateRef.current;
      let cust = cur.customers.find((c) => c.phone === normalizedPhone && !c.isDeleted);
      if (!cust) {
        const res = addCustomer({
          name: data.name?.trim() || `مشتری پورتال (${normalizedPhone})`,
          phone: normalizedPhone,
          lifecycle: 'lead',
          source: 'پورتال عمومی',
          tags: ['پورتال'],
        });
        if (!res.ok || !res.customer) {
          return { ok: false, error: res.error || 'خطا در ثبت پروفایل مشتری.' };
        }
        cust = res.customer;
      }
      const created = addTicket({
        customerId: cust.id,
        subject: data.subject.trim(),
        priority: data.priority ?? 'normal',
        channel: 'portal',
        category: data.category,
        team: 'پذیرش',
        isComplaint: data.category === 'شکایت و کیفیت',
        attachments: data.attachments,
        initialBody: data.body.trim(),
      });
      if (!created) return { ok: false, error: 'خطا در ثبت تیکت.' };
      return { ok: true, ticket: created };
    },
    [addCustomer, addTicket],
  );

  const addKbArticle = useCallback(
    (article: Omit<KbArticle, 'id' | 'helpfulCount' | 'updatedAt'>) => {
      const nowIso = new Date().toISOString();
      const editor = stateRef.current.settings.role === 'admin' ? 'مدیر سیستم' : 'کارشناس';
      const vis: KbVisibility = article.visibility ?? 'public';
      setState((prev) => ({
        ...prev,
        kbArticles: [
          {
            ...article,
            visibility: vis,
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
                visibility: vis,
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
    (id: string, patch: { title: string; category: string; body: string; visibility?: KbVisibility; changeNote?: string }) => {
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
              visibility: art.visibility ?? 'public',
              updatedAt: art.updatedAt,
              editor: 'مدیر سیستم',
              changeNote: 'نسخه قبلی',
            },
          ];
          const nextVer = (art.version ?? 1) + 1;
          const nextVis: KbVisibility = patch.visibility ?? art.visibility ?? 'public';
          return {
            ...art,
            title: patch.title.trim(),
            category: patch.category.trim(),
            body: patch.body.trim(),
            visibility: nextVis,
            updatedAt: nowIso,
            version: nextVer,
            versions: [
              ...prevVersions,
              {
                version: nextVer,
                title: patch.title.trim(),
                category: patch.category.trim(),
                body: patch.body.trim(),
                visibility: nextVis,
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
        automationPolicy: {
          ...prev.automationPolicy,
          ...patch,
          channelDailyCaps: {
            ...prev.automationPolicy.channelDailyCaps,
            ...(patch.channelDailyCaps ?? {}),
          },
        },
      }));
      pushToast('تنظیمات ساعات سکوت، سقف کانال و زمان‌بند ذخیره شد.');
    },
    [pushToast],
  );

  const addMessageTemplate = useCallback(
    (tpl: Omit<MessageTemplate, 'id' | 'updatedAt'>) => {
      const created: MessageTemplate = {
        ...tpl,
        id: `tpl_${Date.now()}`,
        updatedAt: new Date().toISOString(),
      };
      setState((prev) => ({
        ...prev,
        messageTemplates: [created, ...(prev.messageTemplates ?? [])],
      }));
      pushToast(`قالب پیام «${created.name}» ذخیره شد.`);
    },
    [pushToast],
  );

  const updateMessageTemplate = useCallback(
    (id: string, patch: Partial<MessageTemplate>) => {
      setState((prev) => ({
        ...prev,
        messageTemplates: (prev.messageTemplates ?? []).map((t) =>
          t.id === id ? { ...t, ...patch, updatedAt: new Date().toISOString() } : t,
        ),
      }));
      pushToast('قالب پیام به‌روزرسانی شد.');
    },
    [pushToast],
  );

  const deleteMessageTemplate = useCallback(
    (id: string) => {
      setState((prev) => ({
        ...prev,
        messageTemplates: (prev.messageTemplates ?? []).filter((t) => t.id !== id),
      }));
      pushToast('قالب پیام حذف شد.', 'info');
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
      const dynamicRulesToRun: Rule[] = [];
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

        // Dynamic Custom Rules Engine (evaluates AND/OR/NOT, relative-time now+24h, multi-action pipeline, cooldown, channel caps)
        if (!['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7'].includes(rule.id) && rule.targetEntity) {
          // Wait for scheduled cadence or manual execution; webhook/event triggers run on their own triggers
          const trig = rule.triggerType ?? 'schedule';
          if (trig === 'on_webhook') continue;
          if (!silent || trig === 'schedule') {
            dynamicRulesToRun.push(rule);
          }
        }
      }

      const legacyTotal = newOutbox.length + newTasks.length;
      let dynTotal = 0;

      if (legacyTotal > 0) {
        setState((prev) => ({
          ...prev,
          outbox: [...newOutbox, ...prev.outbox],
          tasks: [...newTasks, ...prev.tasks],
          automationLogs: [...newLogs, ...prev.automationLogs].slice(0, 150),
          processedRuleKeys: Array.from(processed),
        }));
      }

      if (dynamicRulesToRun.length > 0) {
        const dynRes = executeRuleBatch(
          dynamicRulesToRun,
          silent ? 'schedule' : 'manual',
          (r, s) => getTargetRecordsForRule(r, s),
        );
        dynTotal = dynRes.totalActions;
      }

      const totalActions = legacyTotal + dynTotal;
      setState((prev) => ({
        ...prev,
        lastAutomationRunAt: new Date().toISOString(),
        automationTickCount: (prev.automationTickCount ?? 0) + 1,
      }));

      if (!silent) {
        if (totalActions > 0) {
          pushToast(`موتور اتوماسیون اجرا شد (${totalActions} اقدام جدید ثبت شد).`);
        } else {
          pushToast('قوانین بررسی شدند؛ مورد جدیدی برای اجرا وجود نداشت.', 'info');
        }
      }

      // Also check ticket SLA escalations quietly
      checkAndEscalateTickets(true);

      return totalActions;
    },
    [checkAndEscalateTickets, executeRuleBatch, pushToast],
  );

  const retryAutomationLog = useCallback(
    (logId: string) => {
      const cur = stateRef.current;
      const log = cur.automationLogs.find((l) => l.id === logId);
      if (!log) return;
      const rule = cur.rules.find((r) => r.id === log.ruleId);
      if (!rule) {
        pushToast('قانون مرتبط با این گزارش یافت نشد.', 'error');
        return;
      }
      // Clear cooldowns for this rule so retry can attempt execution cleanly
      const cleanedCooldowns: Record<string, string> = {};
      Object.entries(cur.ruleCooldowns ?? {}).forEach(([k, v]) => {
        if (!k.startsWith(`${rule.id}_`)) cleanedCooldowns[k] = v;
      });
      setState((prev) => ({ ...prev, ruleCooldowns: cleanedCooldowns }));
      if (rule.targetEntity) {
        const res = executeRuleBatch([rule], 'manual', (r, s) => getTargetRecordsForRule(r, s));
        pushToast(`تلاش مجدد قانون «${rule.name}» انجام شد (${res.totalActions} اقدام).`, res.totalActions > 0 ? 'success' : 'info');
      } else {
        runAutomationNow(false);
      }
    },
    [executeRuleBatch, pushToast, runAutomationNow],
  );

  const runnerEnabled = state.automationPolicy.backgroundRunnerEnabled !== false;
  const runnerIntervalSec = Math.max(10, state.automationPolicy.runnerIntervalSec ?? 30);

  useEffect(() => {
    if (!runnerEnabled) return;
    const runSafeTick = () => {
      if (isTickRunningRef.current) return;
      isTickRunningRef.current = true;
      try {
        runAutomationNow(true);
        const nowMs = Date.now();
        const dueCampaigns = stateRef.current.campaigns.filter(
          (c) => c.status === 'scheduled' && c.scheduledAt && Date.parse(c.scheduledAt) <= nowMs,
        );
        dueCampaigns.forEach((c) => launchCampaign(c.id));
      } finally {
        isTickRunningRef.current = false;
      }
    };

    const initialTimer = setTimeout(runSafeTick, 3500);
    const interval = setInterval(runSafeTick, runnerIntervalSec * 1000);
    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [launchCampaign, runAutomationNow, runnerEnabled, runnerIntervalSec]);

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

      const adapter = getPaymentGatewayProvider(data.gateway);
      const reqOut = adapter.requestPayment({
        invoiceId: inv.id,
        invoiceNo: inv.invoiceNo,
        amount: data.amount,
        callbackUrl: `${window.location.origin}/api/payments/callback/${data.gateway}`,
        description: `پرداخت فاکتور ${inv.invoiceNo}`,
      });
      const cbOut = adapter.handleCallback(reqOut.authority, data.outcome);
      const verifyOut = adapter.verifyPayment(cbOut, data.amount, data.cardMasked);

      const adapterSteps = [
        {
          step: '1. RequestPayment (Redirect)',
          detail: `Authority=${reqOut.authority} → ${reqOut.redirectUrl}`,
          at: reqOut.requestedAt,
        },
        {
          step: '2. Gateway Callback',
          detail: `Status=${cbOut.status} · Ref=${cbOut.gatewayRefPreview}`,
          at: cbOut.receivedAt,
        },
        {
          step: '3. VerifyPayment',
          detail: verifyOut.verified
            ? `Verified=true · RefId=${verifyOut.refId}`
            : `Verified=false · ${verifyOut.errorCode}`,
          at: verifyOut.verifiedAt,
        },
      ];

      const nowIso = new Date().toISOString();
      const refId = verifyOut.verified ? verifyOut.refId : undefined;
      const errorMessage =
        data.outcome === 'failed'
          ? 'تراکنش توسط درگاه ناموفق اعلام شد (موجودی ناکافی / خطای رمز پویا)'
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
        authority: reqOut.authority,
        callbackStatus: cbOut.status,
        verifiedAt: verifyOut.verified ? verifyOut.verifiedAt : undefined,
        adapterSteps,
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
            `تراکنش ${inv.invoiceNo} (${adapter.displayName}): ${data.outcome}${refId ? ` (کد پیگیری ${refId})` : ''}`,
          ),
          ...prev.auditLogs,
        ].slice(0, 100),
      }));

      if (data.outcome === 'succeeded') {
        pushToast(`پرداخت آنلاین با موفقیت تأیید شد. کد رهگیری: ${refId}`);
        return { ok: true, refId, authority: reqOut.authority, adapterSteps };
      }
      pushToast(errorMessage ?? 'تراکنش ناموفق بود.', 'error');
      return { ok: false, errorMessage, authority: reqOut.authority, adapterSteps };
    },
    [pushToast],
  );

  // --- PHASE 10: INTEGRATIONS (TELEPHONY, SMS/CHAT ADAPTERS, WEBHOOKS) ---
  const updateIntegrationsConfig = useCallback(
    (patch: Partial<IntegrationsConfig>) => {
      setState((prev) => ({
        ...prev,
        integrationsConfig: {
          ...(prev.integrationsConfig ?? createInitialState().integrationsConfig!),
          ...patch,
        },
        auditLogs: [
          makeAudit('یکپارچه‌سازی', 'update', 'تنظیمات آداپتورها و درگاه‌های ارتباطی به‌روزرسانی شد.'),
          ...prev.auditLogs,
        ].slice(0, 100),
      }));
      pushToast('تنظیمات یکپارچه‌سازی ذخیره شد.');
    },
    [pushToast],
  );

  const startOutboundCall = useCallback(
    (phone: string, customerId?: string) => {
      const cfg = stateRef.current.integrationsConfig;
      const driver = cfg?.telephonyDriver ?? 'simotel';
      const ext = cfg?.telephonyExtension ?? '101';
      const cust =
        (customerId
          ? stateRef.current.customers.find((c) => c.id === customerId)
          : stateRef.current.customers.find((c) => c.phone === phone)) ?? undefined;
      const provider = getTelephonyProvider(driver);
      provider.dial({
        phone,
        customerId: cust?.id,
        customerName: cust?.name ?? 'مخاطب خروجی',
        agentName: stateRef.current.settings.role === 'admin' ? 'مدیر سیستم' : 'کارشناس پاسخگو',
        extension: ext,
      });
      setActiveCall({
        id: `call_out_${Date.now()}`,
        direction: 'outbound',
        phone,
        customerId: cust?.id,
        customerName: cust?.name ?? 'شماره‌گیری خروجی',
        extension: ext,
        providerDriver: driver,
        phase: 'connected',
        startedAt: new Date().toISOString(),
      });
    },
    [],
  );

  const triggerIncomingCall = useCallback((customerId?: string, phoneOverride?: string) => {
    const cfg = stateRef.current.integrationsConfig;
    const driver = cfg?.telephonyDriver ?? 'simotel';
    const ext = cfg?.telephonyExtension ?? '101';
    const cust = customerId
      ? stateRef.current.customers.find((c) => c.id === customerId)
      : stateRef.current.customers[Math.floor(Math.random() * Math.min(8, stateRef.current.customers.length))];
    const phone = phoneOverride || cust?.phone || '09120001122';
    const provider = getTelephonyProvider(driver);
    const inc = provider.buildIncomingCall(phone, ext, cust);
    setActiveCall({
      id: inc.callId,
      direction: 'inbound',
      phone: inc.phone,
      customerId: cust?.id,
      customerName: inc.customerName,
      extension: inc.extension,
      providerDriver: inc.providerDriver,
      phase: 'ringing',
      startedAt: inc.ringingSince,
    });
  }, []);

  const answerActiveCall = useCallback(() => {
    setActiveCall((prev) => (prev ? { ...prev, phase: 'connected' } : null));
  }, []);

  const dismissActiveCall = useCallback(() => {
    setActiveCall(null);
  }, []);

  const completeActiveCall = useCallback(
    (data: {
      status: CallLogEntry['status'];
      outcome?: InteractionOutcome;
      durationSec: number;
      notes: string;
      createFollowUpTask?: boolean;
    }) => {
      const curCall = activeCall;
      if (!curCall) return;
      const nowIso = new Date().toISOString();
      const agentName = stateRef.current.settings.role === 'admin' ? 'مدیر سیستم' : 'کارشناس پاسخگو';
      const entry: CallLogEntry = {
        id: `call_${Date.now()}`,
        direction: curCall.direction,
        customerId: curCall.customerId,
        customerName: curCall.customerName,
        phone: curCall.phone,
        agentName,
        extension: curCall.extension,
        providerDriver: curCall.providerDriver,
        status: data.status,
        outcome: data.outcome,
        durationSec: data.status === 'answered' ? Math.max(5, data.durationSec) : 0,
        recordingAvailable: data.status === 'answered',
        recordingDurationSec: data.status === 'answered' ? Math.max(5, data.durationSec) : 0,
        notes: data.notes.trim() || undefined,
        startedAt: curCall.startedAt,
      };

      const nextInteraction: Interaction | null = curCall.customerId
        ? stampCreateMeta<Interaction>(
            {
              id: `int_call_${Date.now()}`,
              customerId: curCall.customerId,
              channel: 'call',
              text: `[${curCall.direction === 'inbound' ? 'تماس ورودی' : 'تماس خروجی'} VoIP · ${entry.durationSec} ثانیه] ${data.notes.trim() || 'ثبت از پاپ‌آپ تلفن ابری'}`,
              outcome: data.outcome,
              at: nowIso,
            },
            getRepoCtx(),
            nowIso,
          )
        : null;

      const followUpTask: Task | null =
        data.createFollowUpTask && curCall.customerId
          ? {
              id: `tsk_call_${Date.now()}`,
              title: `پیگیری تماس VoIP با ${curCall.customerName}`,
              customerId: curCall.customerId,
              dueAt: new Date(Date.now() + 24 * 3600_000).toISOString(),
              done: false,
              priority: 'high',
            }
          : null;

      setState((prev) => ({
        ...prev,
        callLogs: [entry, ...(prev.callLogs ?? [])],
        interactions: nextInteraction ? [nextInteraction, ...prev.interactions] : prev.interactions,
        tasks: followUpTask ? [followUpTask, ...prev.tasks] : prev.tasks,
        auditLogs: [
          makeAudit('تلفن ابری VoIP', 'create', `ثبت تماس ${curCall.direction === 'inbound' ? 'ورودی' : 'خروجی'} با ${curCall.customerName} (${data.status})`),
          ...prev.auditLogs,
        ].slice(0, 100),
      }));
      setActiveCall(null);
      pushToast('گزارش تماس در تاریخچه VoIP و پرونده مشتری ثبت شد.');
    },
    [activeCall, pushToast],
  );

  const sendViaSmsAdapter = useCallback(
    (data: {
      driver?: SmsProviderDriver;
      to: string;
      body: string;
      customerId?: string;
      customerName?: string;
    }) => {
      const cfg = stateRef.current.integrationsConfig;
      const driver = data.driver ?? cfg?.smsDriver ?? 'kavenegar';
      const adapter = getSmsProvider(driver);
      const msg = adapter.send({
        to: data.to,
        body: data.body,
        senderLine: cfg?.smsSenderLine ?? '10008663',
        customerId: data.customerId,
        customerName: data.customerName,
      });

      setState((prev) => ({
        ...prev,
        outbox: [msg, ...prev.outbox],
        integrationsConfig: prev.integrationsConfig
          ? {
              ...prev.integrationsConfig,
              smsCreditToman: Math.max(0, prev.integrationsConfig.smsCreditToman - 180),
            }
          : prev.integrationsConfig,
      }));
      pushToast(`پیامک از طریق آداپتور ${adapter.displayName} ارسال شد (${msg.providerMessageId}).`);
      return msg;
    },
    [pushToast],
  );

  const sendViaChatAdapter = useCallback(
    (data: {
      driver?: ChatProviderDriver;
      to: string;
      body: string;
      customerId?: string;
      customerName?: string;
    }) => {
      const cfg = stateRef.current.integrationsConfig;
      const driver = data.driver ?? cfg?.chatDriver ?? 'eitaa';
      const adapter = getChatProvider(driver);
      const msg = adapter.send({
        to: data.to,
        body: data.body,
        botName: cfg?.chatBotName ?? '@ClientFlowBot',
        customerId: data.customerId,
        customerName: data.customerName,
      });

      setState((prev) => ({
        ...prev,
        outbox: [msg, ...prev.outbox],
      }));
      pushToast(`پیام از طریق ${adapter.displayName} ارسال شد (${msg.providerMessageId}).`);
      return msg;
    },
    [pushToast],
  );

  const simulateOutboxDlr = useCallback(
    (outboxId: string, outcome: 'delivered' | 'failed') => {
      const target = stateRef.current.outbox.find((m) => m.id === outboxId);
      if (!target) return;
      const msgId = target.providerMessageId ?? `MSG-${outboxId.slice(-6).toUpperCase()}`;
      const dlr =
        target.providerCode === 'whatsapp' || target.providerCode === 'eitaa' || target.providerCode === 'bale'
          ? getChatProvider(target.providerCode).getDeliveryReport(msgId, outcome)
          : getSmsProvider(target.providerCode === 'melipayamak' ? 'melipayamak' : 'kavenegar').getDeliveryReport(
              msgId,
              outcome,
            );

      setState((prev) => ({
        ...prev,
        outbox: prev.outbox.map((m) =>
          m.id === outboxId
            ? {
                ...m,
                providerMessageId: msgId,
                deliveryStatus: dlr.status,
                dlrUpdatedAt: dlr.checkedAt,
                lastError: outcome === 'failed' ? dlr.carrierNote : undefined,
              }
            : m,
        ),
      }));
      pushToast(dlr.carrierNote, outcome === 'delivered' ? 'success' : 'error');
    },
    [pushToast],
  );

  const addWebhookEndpoint = useCallback(
    (data: { name: string; url: string; secret: string; events: string[] }) => {
      const ep: WebhookEndpoint = {
        id: `whe_${Date.now()}`,
        name: data.name.trim(),
        url: data.url.trim(),
        secret: data.secret.trim() || `whsec_${Math.random().toString(36).slice(2, 12)}`,
        events: data.events.length > 0 ? data.events : ['order.created'],
        active: true,
        createdAt: new Date().toISOString(),
      };
      setState((prev) => ({
        ...prev,
        webhookEndpoints: [ep, ...(prev.webhookEndpoints ?? [])],
      }));
      pushToast('اندپوینت وب‌هوک خروجی ثبت شد.');
    },
    [pushToast],
  );

  const toggleWebhookEndpoint = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      webhookEndpoints: (prev.webhookEndpoints ?? []).map((e) =>
        e.id === id ? { ...e, active: !e.active } : e,
      ),
    }));
  }, []);

  const deleteWebhookEndpoint = useCallback(
    (id: string) => {
      setState((prev) => ({
        ...prev,
        webhookEndpoints: (prev.webhookEndpoints ?? []).filter((e) => e.id !== id),
      }));
      pushToast('اندپوینت وب‌هوک حذف شد.', 'info');
    },
    [pushToast],
  );

  const testFireWebhookEndpoint = useCallback(
    (id: string, eventName: string) => {
      const ep = (stateRef.current.webhookEndpoints ?? []).find((e) => e.id === id);
      if (!ep) return;
      const nowIso = new Date().toISOString();
      const payloadJson = JSON.stringify({
        event: eventName,
        timestamp: nowIso,
        tenant: stateRef.current.settings.businessName,
        sampleId: `rec_${Date.now().toString(36)}`,
      });
      const sig = computeSyncHmacPreview(ep.secret, payloadJson);
      const log: WebhookLogEntry = {
        id: `wh_out_${Date.now()}`,
        direction: 'outgoing',
        urlOrTopic: ep.url,
        ruleName: `${ep.name} (${eventName})`,
        statusCode: 200,
        latencyMs: 65 + Math.floor(Math.random() * 90),
        payloadSummary: payloadJson,
        hmacSignature: sig,
        ok: true,
        at: nowIso,
      };
      setState((prev) => ({
        ...prev,
        webhookEndpoints: (prev.webhookEndpoints ?? []).map((e) =>
          e.id === id ? { ...e, lastTriggeredAt: nowIso, lastSignature: sig } : e,
        ),
        webhookLogs: [log, ...(prev.webhookLogs ?? [])].slice(0, 80),
      }));
      pushToast(`وب‌هوک خروجی به ${ep.name} با امضای HMAC ارسال شد.`);
    },
    [pushToast],
  );

  // --- DASHBOARD WIDGETS, ROLE LAYOUTS, KPI TARGETS & SAVED REPORTS (Phase 9) ---
  const setDashboardPersona = useCallback((persona: DashboardPersonaRole) => {
    setState((prev) => {
      const savedForRole = prev.settings.dashboardLayoutsByRole?.[persona];
      const nextWidgets =
        savedForRole && savedForRole.length > 0
          ? savedForRole
          : getDefaultWidgetsForPersona(persona);
      return {
        ...prev,
        settings: {
          ...prev.settings,
          dashboardPersona: persona,
          dashboardWidgets: nextWidgets,
        },
      };
    });
  }, []);

  const updateDashboardWidgets = useCallback((widgets: DashboardWidgetConfig[]) => {
    setState((prev) => {
      const persona: DashboardPersonaRole =
        prev.settings.dashboardPersona ?? (prev.settings.role === 'admin' ? 'admin' : 'receptionist');
      return {
        ...prev,
        settings: {
          ...prev.settings,
          dashboardPersona: persona,
          dashboardWidgets: widgets,
          dashboardLayoutsByRole: {
            ...(prev.settings.dashboardLayoutsByRole ?? {}),
            [persona]: widgets,
          },
        },
      };
    });
  }, []);

  const resetDashboardWidgets = useCallback(() => {
    setState((prev) => {
      const persona: DashboardPersonaRole =
        prev.settings.dashboardPersona ?? (prev.settings.role === 'admin' ? 'admin' : 'receptionist');
      const defaults =
        persona === 'admin' ? getDefaultWidgetsForPersona('admin') : getDefaultWidgetsForPersona(persona);
      return {
        ...prev,
        settings: {
          ...prev.settings,
          dashboardPersona: persona,
          dashboardWidgets: defaults.length > 0 ? defaults : defaultDashboardWidgets,
          dashboardLayoutsByRole: {
            ...(prev.settings.dashboardLayoutsByRole ?? {}),
            [persona]: defaults,
          },
        },
      };
    });
    pushToast('چیدمان ویجت‌های داشبورد به حالت پیش‌فرض نقش بازگشت.', 'info');
  }, [pushToast]);

  const updateKpiTarget = useCallback(
    (kpiId: string, targetValue: number) => {
      setState((prev) => ({
        ...prev,
        settings: {
          ...prev.settings,
          kpiTargets: {
            ...(prev.settings.kpiTargets ?? {}),
            [kpiId]: Math.max(0, targetValue),
          },
        },
      }));
      pushToast('هدف شاخص عملکردی (KPI) به‌روزرسانی شد.');
    },
    [pushToast],
  );

  const saveCustomReport = useCallback(
    (rep: Omit<SavedReportConfig, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): SavedReportConfig => {
      const nowIso = new Date().toISOString();
      const existing = rep.id
        ? (stateRef.current.savedReports ?? []).find((r) => r.id === rep.id)
        : undefined;
      const saved: SavedReportConfig = {
        ...rep,
        id: existing?.id ?? `rpt_${Date.now()}`,
        shareToken: existing?.shareToken ?? `sh_${Math.random().toString(36).slice(2, 9)}`,
        createdAt: existing?.createdAt ?? nowIso,
        updatedAt: nowIso,
      };
      setState((prev) => {
        const list = prev.savedReports ?? [];
        const nextList = existing
          ? list.map((r) => (r.id === existing.id ? saved : r))
          : [saved, ...list];
        return { ...prev, savedReports: nextList };
      });
      pushToast(`گزارش «${saved.title}» ذخیره شد.`);
      return saved;
    },
    [pushToast],
  );

  const deleteCustomReport = useCallback(
    (id: string) => {
      setState((prev) => ({
        ...prev,
        savedReports: (prev.savedReports ?? []).filter((r) => r.id !== id),
      }));
      pushToast('گزارش ذخیره‌شده حذف شد.', 'info');
    },
    [pushToast],
  );

  const toggleShareSavedReport = useCallback(
    (id: string) => {
      setState((prev) => ({
        ...prev,
        savedReports: (prev.savedReports ?? []).map((r) =>
          r.id === id
            ? {
                ...r,
                shared: !r.shared,
                shareToken: r.shareToken || `sh_${Math.random().toString(36).slice(2, 9)}`,
              }
            : r,
        ),
      }));
    },
    [],
  );

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
      // Pack rules pre-created DISABLED by default so the user explicitly enables them
      const newRules: Rule[] = packDef.rules
        .filter((r) => !existingRuleNames.has(r.name))
        .map((r, i) => ({ ...r, active: false, id: `rul_pk_${nowMs}_${i}` }));

      const existingWfKeys = new Set(cur.workflowDefinitions.map((w) => w.key));
      const newWorkflows: WorkflowDefinition[] = (packDef.workflowTemplates ?? [])
        .filter((w) => !existingWfKeys.has(w.key))
        .map((w, i) => ({
          ...w,
          status: 'draft' as const,
          id: `wfd_pk_${nowMs}_${i}`,
          updatedAt: new Date().toISOString(),
        }));

      const packSales = getPackSalesConfig(packKey, cur.customPacks);

      setState((prev) => ({
        ...prev,
        customFieldDefs: [...prev.customFieldDefs, ...newFields],
        customEntityDefs: [...prev.customEntityDefs, ...newEntities],
        services: [...prev.services, ...newServices],
        products: [...prev.products, ...newProducts],
        rules: [...prev.rules, ...newRules],
        workflowDefinitions: [...prev.workflowDefinitions, ...newWorkflows],
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
            `بسته «${packDef.name}» نصب شد (${newFields.length} فیلد، ${newRules.length} قانون آماده غیرفعال، ${newWorkflows.length} الگوی گردش‌کار پیش‌نویس).`,
          ),
          ...prev.auditLogs,
        ].slice(0, 100),
      }));
      pushToast(`بسته «${packDef.name}» نصب شد؛ قوانین و گردش‌کارهای آماده (در حالت پیش‌نویس/متوقف) قابل فعال‌سازی هستند.`);
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
        activeCall,
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
        updateCampaignRecipientStatus,
        simulateCampaignStats,
        addMediaAsset,
        toggleMediaConsent,
        deleteMediaAsset,
        addLandingForm,
        submitLandingForm,
        updateLoyaltyConfig,
        addLoyaltyReward,
        toggleLoyaltyReward,
        adjustCustomerPoints,
        redeemLoyaltyReward,
        sendOccasionReward,
        registerReferral,
        addTask,
        toggleTaskDone,
        addTaskSubtask,
        toggleTaskSubtask,
        addTicket,
        updateTicket,
        addTicketMessage,
        mergeTickets,
        checkAndEscalateTickets,
        escalateTicket,
        updateSlaPolicy,
        requestPortalOtp,
        submitPortalTicketByPhone,
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
        addMessageTemplate,
        updateMessageTemplate,
        deleteMessageTemplate,
        dryRunRule,
        sendSimulatedSms,
        runAutomationNow,
        fireWebhookTrigger,
        fireCustomEventTrigger,
        retryAutomationLog,
        retryNotification,
        processNotificationRetries,
        simulateDeliveryFailure,
        clearOutbox,
        addSayadiCheque,
        updateSayadiChequeStatus,
        processSandboxPayment,
        updateIntegrationsConfig,
        startOutboundCall,
        triggerIncomingCall,
        answerActiveCall,
        dismissActiveCall,
        completeActiveCall,
        sendViaSmsAdapter,
        sendViaChatAdapter,
        simulateOutboxDlr,
        addWebhookEndpoint,
        toggleWebhookEndpoint,
        deleteWebhookEndpoint,
        testFireWebhookEndpoint,
        setDashboardPersona,
        updateDashboardWidgets,
        resetDashboardWidgets,
        updateKpiTarget,
        saveCustomReport,
        deleteCustomReport,
        toggleShareSavedReport,
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
