export type CustomerLifecycle = 'lead' | 'active' | 'vip' | 'churned';
export type CustomerPersonType = 'individual' | 'organization';

export type CustomerContact = {
  id: string;
  name: string;
  role: string;
  phone: string;
  email?: string;
  isPrimary?: boolean;
};

export type CustomerAddress = {
  id: string;
  title: string;
  address: string;
  postalCode?: string;
  isDefault?: boolean;
};

export type CustomerAttachment = {
  id: string;
  name: string;
  category: 'photo_before' | 'photo_after' | 'lab_pdf' | 'consent' | 'other';
  sizeLabel: string;
  mimeType: string;
  dataUrl?: string;
  uploadedAt: string;
  note?: string;
};

export type BaseEntityMeta = {
  tenantId?: string;
  updatedAt?: string;
  createdBy?: string;
  isDeleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
  version?: number;
};

export type ConsentChannel = 'sms' | 'email' | 'photo';
export type ConsentLog = BaseEntityMeta & {
  id: string;
  customerId: string;
  channel: ConsentChannel;
  granted: boolean;
  source: string;
  actor: string;
  note?: string;
  at: string;
  createdAt: string;
};

export type Customer = BaseEntityMeta & {
  id: string;
  name: string;
  phone: string;
  email?: string;
  nationalId?: string;
  personType?: CustomerPersonType;
  companyName?: string;
  economicCode?: string;
  registrationNo?: string;
  contacts?: CustomerContact[];
  addresses?: CustomerAddress[];
  lifecycle?: CustomerLifecycle;
  tags: string[];
  source?: string;
  ownerName?: string;
  createdAt: string;
  notes?: string;
  birthDateJalali?: string; // e.g. 1368/08/27
  anniversaryDateJalali?: string; // e.g. 1402/08/28
  isAnonymized?: boolean;
  mergedIntoCustomerId?: string;
  // Consent flags
  consentSms?: boolean;
  consentEmail?: boolean;
  consentPhoto?: boolean;
  consentUpdatedAt?: string;
  // Legacy optional pack fields (migrated cleanly to pack config / customFields)
  patientCode?: string;
  birthYear?: string;
  allergies?: string;
  attachments?: CustomerAttachment[];
  licenseKey?: string;
  contractExpiresAt?: string;
  branchId?: string;
  // Loyalty & Referral (Phase 8)
  loyaltyPoints?: number;
  lifetimePoints?: number;
  referralCode?: string;
  referredByCustomerId?: string;
  // Dynamic custom fields (cfg.FieldDef -> CustomJson)
  customFields?: Record<string, string>;
};

export type CustomerRelationType = 'referrer' | 'family' | 'colleague';
export type CustomerRelation = BaseEntityMeta & {
  id: string;
  fromCustomerId: string;
  toCustomerId: string;
  relationType: CustomerRelationType;
  note?: string;
  createdAt: string;
};

export type SegmentCondition = {
  id: string;
  field: 'lifecycle' | 'source' | 'personType' | 'tag' | 'ownerName' | 'minSpent' | 'minScore' | 'consentSms' | 'consentEmail';
  op: 'eq' | 'neq' | 'contains' | 'gte';
  value: string;
};

export type CustomerSegment = BaseEntityMeta & {
  id: string;
  name: string;
  description?: string;
  segmentType?: 'dynamic' | 'static';
  staticCustomerIds?: string[];
  logic: 'AND' | 'OR';
  conditions: SegmentCondition[];
  createdAt: string;
};

export type CustomerSavedViewFilter = {
  query: string;
  selectedTag: string;
  lifecycleFilter: 'all' | CustomerLifecycle;
  activeSegmentId: string;
  personTypeFilter: 'all' | CustomerPersonType;
  ownerFilter: string;
  sortBy: 'createdAt' | 'score' | 'name' | 'totalSpent';
  sortDir: 'asc' | 'desc';
};

export type CustomerSavedView = BaseEntityMeta & {
  id: string;
  name: string;
  userKey: string;
  filters: CustomerSavedViewFilter;
  isDefault?: boolean;
  createdAt: string;
};

export type CsvImportBatch = BaseEntityMeta & {
  id: string;
  fileName: string;
  customerIds: string[];
  count: number;
  importedAt: string;
  rolledBack?: boolean;
};

export type CustomFieldEntity =
  | 'customer'
  | 'order'
  | 'appointment'
  | 'opportunity'
  | 'ticket'
  | 'product';

export type CustomFieldType =
  | 'text'
  | 'number'
  | 'select'
  | 'date'
  | 'multiselect'
  | 'checkbox'
  | 'file'
  | 'money'
  | 'phone'
  | 'nationalId'
  | 'lookup'
  | 'formula';

export type CustomFieldValidation = {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  message?: string;
};

export type CustomFieldDef = {
  id: string;
  key: string;
  label: string;
  entity?: CustomFieldEntity;
  type: CustomFieldType;
  options?: string[];
  required?: boolean;
  unique?: boolean;
  active?: boolean;
  showInTable?: boolean;
  validation?: CustomFieldValidation;
  lookupEntity?: 'customer' | 'product' | 'service' | 'resource';
  formulaExpr?: string;
  visibleWhen?: { fieldKey: string; equals: string };
  order?: number;
};

export type EntityRelationType = '1:1' | '1:N' | 'N:M';
export type EntityRelationDef = {
  id: string;
  name: string;
  sourceEntity: string;
  targetEntity: string;
  cardinality: EntityRelationType;
};

export type CustomEntityDef = {
  id: string;
  key: string;
  name: string;
  pluralName: string;
  description?: string;
  fields: CustomFieldDef[];
  createdAt: string;
};

export type CustomEntityRecord = {
  id: string;
  entityKey: string;
  values: Record<string, string>;
  relatedCustomerId?: string;
  createdAt: string;
};

export type ConfigSnapshot = {
  id: string;
  versionLabel: string;
  note: string;
  createdAt: string;
  customFieldDefs: CustomFieldDef[];
  customEntityDefs: CustomEntityDef[];
  entityRelations: EntityRelationDef[];
  pipelineStages: PipelineStageConfig[];
  commissionTiers: CommissionTier[];
};

export type InteractionOutcome =
  | 'answered'
  | 'no_answer'
  | 'interested'
  | 'quote_requested'
  | 'follow_up'
  | 'not_interested';

export type Interaction = BaseEntityMeta & {
  id: string;
  customerId: string;
  channel: 'call' | 'sms' | 'whatsapp' | 'visit' | 'note';
  text: string;
  outcome?: InteractionOutcome;
  followUpAt?: string; // ISO UTC
  at: string;
};

export type Service = {
  id: string;
  name: string;
  category?: string;
  unit?: string;
  taxRate?: number;
  active?: boolean;
  durationMin: number;
  price: number;
  bufferBeforeMin?: number;
  bufferAfterMin?: number;
};

export type Resource = { id: string; name: string; type: 'staff' | 'room' | 'device' };

export type ResourceTimeOff = {
  id: string;
  resourceId: string;
  startDateKey: string; // YYYY-MM-DD
  endDateKey: string; // YYYY-MM-DD
  reason: string;
};

export type OfficialHoliday = {
  id: string;
  dateKey: string; // YYYY-MM-DD
  jalaliDate: string;
  title: string;
};

export type WaitlistEntry = {
  id: string;
  customerId: string;
  serviceId: string;
  preferredResourceId?: string;
  preferredDayKey: string;
  preferredTimeRange: string;
  notes?: string;
  status: 'waiting' | 'notified' | 'booked';
  createdAt: string;
};

export type AppointmentStatus =
  | 'booked'
  | 'confirmed'
  | 'checked_in'
  | 'done'
  | 'noshow'
  | 'cancelled';

export type Appointment = {
  id: string;
  customerId: string;
  serviceId: string;
  resourceId: string;
  start: string; // ISO UTC
  end: string; // ISO UTC
  status: AppointmentStatus;
  cancelReason?: string;
  reminder2hSent?: boolean;
  reminderSentAt?: string;
  branchId?: string;
  customFields?: Record<string, string>;
  isDeleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
};

export type OrderStatus = 'new' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
export type OrderChannel = 'phone' | 'website' | 'instagram' | 'whatsapp' | 'store';
export type ShippingCarrier = 'post' | 'tipax' | 'snappbox' | 'chapar' | 'pickup';

export type OrderShipment = {
  id: string;
  carrier: ShippingCarrier;
  trackingCode: string;
  items: { name: string; qty: number }[];
  shippedAt: string;
  note?: string;
};

export type OrderReturn = {
  id: string;
  orderId: string;
  customerId: string;
  items: { name: string; qty: number; price: number }[];
  refundAmount: number;
  refundMethod: PaymentMethod;
  reason: string;
  restock: boolean;
  createdAt: string;
};

export type Order = {
  id: string;
  customerId: string;
  channel?: OrderChannel;
  idempotencyKey?: string;
  items: { productId?: string; name: string; qty: number; price: number; unitPriceSnapshot?: number }[];
  status: OrderStatus;
  createdAt: string;
  updatedAt?: string;
  promisedAt?: string;
  couponCode?: string;
  discountAmount?: number;
  trackingCode?: string;
  carrier?: ShippingCarrier;
  shipments?: OrderShipment[];
  returns?: OrderReturn[];
  branchId?: string;
  customFields?: Record<string, string>;
  isDeleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
};

export type OrderStatusLog = { id: string; orderId: string; from: string; to: string; at: string };

export type PaymentMethod = 'cash' | 'card' | 'online' | 'transfer' | 'cheque';
export type Invoice = {
  id: string;
  invoiceNo: string;
  orderId: string;
  contractId?: string;
  customerId: string;
  subtotal: number;
  discount: number;
  tax: number;
  grandTotal: number;
  paidAmount: number;
  method: PaymentMethod;
  status: 'issued' | 'partial' | 'paid';
  issuedAt: string;
  dueAt: string;
  reminderCount?: number;
  lastReminderAt?: string;
  branchId?: string;
  isDeleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
};

export type PaymentAllocation = {
  id: string;
  customerId: string;
  totalAmount: number;
  method: PaymentMethod;
  reference?: string;
  note?: string;
  allocations: { invoiceId: string; invoiceNo: string; amount: number }[];
  createdAt: string;
};

export type ContractStatus = 'draft' | 'active' | 'expiring_soon' | 'renewed' | 'expired';
export type Contract = {
  id: string;
  contractNo: string;
  customerId: string;
  title: string;
  startDate: string; // ISO
  endDate: string; // ISO
  amount: number;
  renewalReminderDays: number;
  autoRenew: boolean;
  status: ContractStatus;
  lastReminderAt?: string;
  notes?: string;
  branchId?: string;
  createdAt: string;
};

export type WarrantyClaim = {
  id: string;
  date: string; // ISO
  issue: string;
  resolution: string;
  costCoveredBy: 'warranty' | 'customer';
  status: 'open' | 'in_repair' | 'resolved';
};

export type WarrantyRecord = {
  id: string;
  customerId: string;
  productId?: string;
  productName: string;
  serialNumber: string;
  orderId?: string;
  startDate: string; // ISO
  endDate: string; // ISO
  status: 'active' | 'expired' | 'void';
  claims: WarrantyClaim[];
  notes?: string;
  createdAt: string;
};

export type SayadiChequeStatus = 'received' | 'deposited' | 'cleared' | 'bounced';
export type SayadiCheque = {
  id: string;
  chequeNo: string;
  sayadiId: string;
  bankName: string;
  drawerName: string;
  customerId: string;
  invoiceId?: string;
  amount: number;
  dueDateJalali: string;
  dueDateIso: string;
  status: SayadiChequeStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type PaymentTransactionStatus = 'pending' | 'succeeded' | 'failed' | 'cancelled';
export type PaymentTransaction = {
  id: string;
  invoiceId: string;
  invoiceNo: string;
  customerId: string;
  gateway: 'zarinpal' | 'shaparak' | 'saman';
  amount: number;
  cardMasked?: string;
  refId?: string;
  authority?: string;
  callbackStatus?: 'OK' | 'NOK';
  verifiedAt?: string;
  adapterSteps?: { step: string; detail: string; at: string }[];
  status: PaymentTransactionStatus;
  errorCode?: string;
  errorMessage?: string;
  at: string;
};

export type Product = {
  id: string;
  name: string;
  sku: string;
  category?: string;
  unit?: string;
  taxRate?: number;
  price: number;
  stock: number;
  minStock?: number;
  active: boolean;
  customFields?: Record<string, string>;
  isDeleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
};

export type StockMovement = {
  id: string;
  productId: string;
  productName: string;
  orderId?: string;
  type: 'out' | 'in' | 'adjust';
  qtyChange: number;
  balanceAfter: number;
  reason: string;
  at: string;
};

export type PriceListTier = 'retail' | 'wholesale' | 'vip';
export type PriceList = {
  id: string;
  name: string;
  tier: PriceListTier;
  discountPct: number;
  validFrom: string; // ISO
  validTo: string; // ISO
  active: boolean;
  itemOverrides?: Record<string, number>; // productId or serviceId -> unit price
  notes?: string;
};

export type Coupon = {
  id: string;
  code: string;
  discountPct: number;
  maxUses: number;
  usedCount: number;
  active: boolean;
  validFrom?: string;
  validTo?: string;
  minOrderAmount?: number;
};

export type TaskSubtask = {
  id: string;
  title: string;
  done: boolean;
};

export type ProjectStatus = 'planning' | 'in_progress' | 'testing' | 'deployed' | 'completed';
export type ProjectTask = {
  id: string;
  title: string;
  assignee: string;
  estimatedHours: number;
  dueAt?: string;
  subtasks?: TaskSubtask[];
  done: boolean;
};
export type TimeEntry = {
  id: string;
  projectId: string;
  taskId?: string;
  userName: string;
  hours: number;
  note: string;
  loggedAt: string;
};
export type DeploymentCheckItem = {
  id: string;
  title: string;
  category: 'infra' | 'db' | 'security' | 'training';
  done: boolean;
  checkedAt?: string;
};
export type Project = {
  id: string;
  title: string;
  customerId: string;
  status: ProjectStatus;
  dueAt: string;
  tasks: ProjectTask[];
  deploymentChecklist: DeploymentCheckItem[];
  createdAt: string;
};

export type SalesLeadStatus = 'new' | 'qualified' | 'converted' | 'disqualified';
export type SalesLead = {
  id: string;
  name: string;
  phone: string;
  email?: string;
  companyName?: string;
  source: string;
  score: number; // 0..100
  estimatedAmount: number;
  ownerName: string;
  assignedByRule?: 'manual' | 'round_robin';
  status: SalesLeadStatus;
  convertedCustomerId?: string;
  convertedOpportunityId?: string;
  notes?: string;
  branchId?: string;
  createdAt: string;
  updatedAt: string;
  isDeleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
};

export type PipelineStage = 'lead' | 'contacted' | 'proposal' | 'negotiation' | 'won' | 'lost';
export type PipelineStageConfig = {
  key: PipelineStage;
  label: string;
  probability: number;
  slaHours: number;
};

export type SalesPipeline = {
  id: string;
  name: string;
  description?: string;
  isDefault?: boolean;
  stages: PipelineStageConfig[];
};

export type OpportunityStageHistoryEntry = {
  stage: PipelineStage;
  label: string;
  enteredAt: string;
  exitedAt?: string;
  durationHours?: number;
};

export type Opportunity = {
  id: string;
  pipelineId?: string;
  title: string;
  customerId?: string;
  contactName: string;
  phone: string;
  source: string;
  stage: PipelineStage;
  amount: number;
  probability: number;
  expectedCloseDate?: string; // ISO
  leadScore?: number;
  ownerName: string;
  lostReason?: string;
  branchId?: string;
  stageHistory?: OpportunityStageHistoryEntry[];
  customFields?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  isDeleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
};

export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'approved';
export type QuoteApprovalStatus = 'not_required' | 'pending_manager' | 'approved' | 'rejected';

export type QuoteLineItem = {
  productId?: string;
  name: string;
  unit?: string;
  qty: number;
  price: number;
  discountPct?: number;
  taxRate?: number;
};

export type Quote = {
  id: string;
  quoteNo: string;
  version: number;
  parentQuoteId?: string;
  opportunityId?: string;
  customerId?: string;
  contactName: string;
  phone?: string;
  priceListId?: string;
  priceListName?: string;
  items: QuoteLineItem[];
  discountPct: number;
  taxPct: number;
  notes?: string;
  status: QuoteStatus;
  approvalStatus?: QuoteApprovalStatus;
  approvedBy?: string;
  approvedAt?: string;
  shareToken: string;
  validUntil: string;
  clientComment?: string;
  createdAt: string;
};

export type SalesTarget = {
  id: string;
  targetType?: 'user' | 'team';
  teamName?: string;
  ownerName: string;
  periodLabel: string;
  targetAmount: number;
};

export type CommissionTier = {
  id: string;
  upToAmount: number | null; // null = infinity
  ratePct: number;
};

export type CommissionRuleMode = 'percentage' | 'tiered';
export type CommissionRuleConfig = {
  mode: CommissionRuleMode;
  flatRatePct: number;
  autoCreateLedgerOnWon: boolean;
};

export type CommissionLedgerStatus = 'pending' | 'approved' | 'paid';
export type CommissionLedgerEntry = {
  id: string;
  opportunityId: string;
  opportunityTitle: string;
  ownerName: string;
  dealAmount: number;
  commissionAmount: number;
  rateSummary: string;
  status: CommissionLedgerStatus;
  approvedBy?: string;
  approvedAt?: string;
  paidAt?: string;
  createdAt: string;
};

export type WorkflowType =
  | 'discount_approval'
  | 'order_fulfillment'
  | 'order_return'
  | 'vip_schedule'
  | 'complaint'
  | 'custom';

export type WorkflowNodeType =
  | 'start'
  | 'task'
  | 'approval'
  | 'decision'
  | 'wait'
  | 'parallel_gateway'
  | 'timer'
  | 'end';

export type WorkflowNodeDef = {
  id: string;
  type: WorkflowNodeType;
  label: string;
  role: 'staff' | 'admin';
  assigneeType?: 'role' | 'user';
  assigneeUser?: string;
  stepSlaHours?: number;
  x: number;
  y: number;
  timerHours?: number;
  parallelBranches?: string[];
  formFields?: CustomFieldDef[];
};

export type WorkflowEdgeDef = {
  id: string;
  fromId: string;
  toId: string;
  label?: string;
  conditionField?: string;
  conditionOp?: 'eq' | 'neq' | 'gte' | 'lte' | 'contains';
  conditionValue?: string;
};

export type WorkflowDefinition = {
  id: string;
  key: string;
  name: string;
  description?: string;
  type: WorkflowType;
  version: number;
  status: 'draft' | 'published';
  pack?: 'all' | IndustryPack;
  slaHours: number;
  nodes: WorkflowNodeDef[];
  edges: WorkflowEdgeDef[];
  updatedAt: string;
};

export type WorkflowParallelBranchState = {
  branchName: string;
  role: 'staff' | 'admin';
  status: 'pending' | 'approved' | 'rejected';
  actor?: string;
  at?: string;
};

export type WorkflowStep = {
  id?: string;
  name: string;
  nodeType?: WorkflowNodeType;
  role: 'staff' | 'admin';
  assigneeType?: 'role' | 'user';
  stepSlaHours?: number;
  status: 'pending' | 'approved' | 'rejected';
  assignee?: string;
  claimedBy?: string;
  delegatedTo?: string;
  actor?: string;
  comment?: string;
  at?: string;
  startedAt?: string;
  timerHours?: number;
  timerExpiresAt?: string;
  decisionResult?: string;
  parallelBranches?: WorkflowParallelBranchState[];
  formFields?: CustomFieldDef[];
  stepData?: Record<string, string>;
};

export type WorkflowHistoryEntry = {
  id: string;
  at: string;
  actor: string;
  stepName: string;
  action: 'started' | 'approved' | 'rejected' | 'decision' | 'claimed' | 'reassigned' | 'delegated' | 'timer_expired' | 'completed';
  detail: string;
};

export type WorkflowInstance = {
  id: string;
  title: string;
  type: WorkflowType;
  definitionId?: string;
  definitionVersion?: number;
  customerId?: string;
  relatedRef?: string;
  currentStepIndex: number;
  steps: WorkflowStep[];
  history?: WorkflowHistoryEntry[];
  status: 'running' | 'approved' | 'rejected';
  createdAt: string;
  completedAt?: string;
  slaHours: number;
};

export type ContentStatus = 'idea' | 'draft' | 'review' | 'scheduled' | 'published';
export type ContentItem = {
  id: string;
  title: string;
  platform: 'instagram' | 'site' | 'blog';
  format: 'post' | 'reel' | 'story' | 'article';
  status: ContentStatus;
  scheduledAt: string;
  assignee: string;
  reach: number;
  engagement?: number;
  leadsCount: number;
  hasBeforeAfterConsent?: boolean;
  caption?: string;
  mediaAssetId?: string;
};

export type CampaignVariant = {
  subject: string;
  body: string;
  sent: number;
  delivered?: number;
  clicks: number;
  conversions: number;
};

export type CampaignRecipientStatus = 'sent' | 'delivered' | 'clicked' | 'converted';
export type CampaignRecipient = {
  id: string;
  customerId: string;
  customerName: string;
  phone: string;
  variant: 'A' | 'B';
  status: CampaignRecipientStatus;
  updatedAt: string;
};

export type MarketingCampaign = {
  id: string;
  name: string;
  segmentId?: string;
  channel: NotificationChannel;
  status: 'draft' | 'scheduled' | 'running' | 'completed';
  abTestEnabled: boolean;
  variantA: CampaignVariant;
  variantB?: CampaignVariant;
  winner?: 'A' | 'B';
  utmCampaign: string;
  scheduledAt?: string;
  cost?: number;
  revenueGenerated?: number;
  recipients?: CampaignRecipient[];
  createdAt: string;
  launchedAt?: string;
};

export type LoyaltyTier = 'bronze' | 'silver' | 'gold' | 'vip';
export type LoyaltyTxType =
  | 'earn_purchase'
  | 'earn_visit'
  | 'earn_referral'
  | 'earn_manual'
  | 'redeem_reward'
  | 'birthday_bonus';

export type LoyaltyConfig = {
  enabled: boolean;
  pointsPer100kToman: number;
  pointsPerVisit: number;
  pointsPerReferral: number;
  referredWelcomePoints: number;
  birthdayBonusPoints: number;
  birthdayDiscountPct: number;
  silverMinPoints: number;
  goldMinPoints: number;
  vipMinPoints: number;
};

export type LoyaltyReward = {
  id: string;
  title: string;
  pointsCost: number;
  discountPct: number;
  minOrderAmount?: number;
  validDays: number;
  active: boolean;
  redeemedCount: number;
};

export type LoyaltyTransaction = {
  id: string;
  customerId: string;
  customerName: string;
  type: LoyaltyTxType;
  points: number;
  description: string;
  couponCode?: string;
  refId?: string;
  at: string;
};

export type MediaAsset = {
  id: string;
  name: string;
  type: 'image' | 'video' | 'pdf';
  folder: string;
  sizeLabel: string;
  tags: string[];
  urlOrDataUrl: string;
  hasModelConsent?: boolean;
  uploadedAt: string;
};

export type LandingFormFieldKey = 'name' | 'phone' | 'email' | 'companyName' | 'notes';
export type LandingForm = {
  id: string;
  title: string;
  slug: string;
  sourceTag: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  defaultLifecycle: CustomerLifecycle;
  fields: LandingFormFieldKey[];
  submissionsCount: number;
  active: boolean;
  createdAt: string;
};

export type UtmTouch = {
  id: string;
  customerId?: string;
  customerName?: string;
  formId?: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent?: string;
  landedAt: string;
  converted: boolean;
};

export type KbVisibility = 'public' | 'internal';

export type KbArticleVersion = {
  version: number;
  title: string;
  category: string;
  body: string;
  visibility?: KbVisibility;
  updatedAt: string;
  editor: string;
  changeNote?: string;
};

export type KbArticle = {
  id: string;
  title: string;
  category: string;
  body: string;
  visibility?: KbVisibility;
  helpfulCount: number;
  updatedAt: string;
  version?: number;
  versions?: KbArticleVersion[];
};

export type Task = {
  id: string;
  title: string;
  customerId?: string;
  dueAt: string;
  done: boolean;
  assignee?: string;
  priority?: 'low' | 'medium' | 'high';
  subtasks?: TaskSubtask[];
  projectId?: string;
  createdByRuleId?: string;
  isDeleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
};

export type TicketChannel = 'portal' | 'phone' | 'whatsapp' | 'email' | 'instagram' | 'visit';
export type TicketSeverity = 'minor' | 'major' | 'critical';
export type TicketStatus = 'open' | 'in_progress' | 'pending' | 'resolved' | 'closed';
export type ComplaintStatus = 'investigating' | 'resolved' | 'compensated';

export type TicketAttachment = {
  id: string;
  name: string;
  sizeLabel: string;
  mimeType: string;
};

export type TicketMessage = {
  id: string;
  ticketId: string;
  authorName: string;
  authorType: 'customer' | 'agent';
  visibility: 'public' | 'internal';
  body: string;
  attachments?: TicketAttachment[];
  createdAt: string;
};

export type Ticket = {
  id: string;
  trackingCode?: string;
  customerId: string;
  subject: string;
  channel?: TicketChannel;
  priority: 'low' | 'normal' | 'high';
  severity?: TicketSeverity;
  status: TicketStatus;
  category?: string;
  team?: string;
  assignee?: string;
  slaHours?: number;
  firstRespondedAt?: string;
  escalated?: boolean;
  escalatedAt?: string;
  escalatedTo?: string;
  slaWarningSent?: boolean;
  mergedIntoTicketId?: string;
  mergedFromIds?: string[];
  attachments?: TicketAttachment[];
  isComplaint?: boolean;
  rootCause?: string;
  complaintResolution?: string;
  complaintStatus?: ComplaintStatus;
  createdAt: string;
  resolvedAt?: string;
  replyNote?: string;
  customFields?: Record<string, string>;
  isDeleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
};

export type SlaPolicy = {
  priority: Ticket['priority'];
  firstResponseMin: number;
  resolutionMin: number;
  warnPct: number;
};

export type ClientFlowConfigBundle = {
  schemaVersion: number;
  exportedAt: string;
  businessName: string;
  industryPack: IndustryPack;
  customFieldDefs: CustomFieldDef[];
  customEntityDefs: CustomEntityDef[];
  entityRelations: EntityRelationDef[];
  pipelineStages: PipelineStageConfig[];
  commissionTiers: CommissionTier[];
  workflowDefinitions: WorkflowDefinition[];
  rules: Rule[];
  numbering: NumberingConfig;
  dashboardWidgets: DashboardWidgetConfig[];
};

export type RuleTriggerType =
  | 'schedule'
  | 'on_create'
  | 'on_update'
  | 'on_stage_change'
  | 'on_ticket_create'
  | 'on_webhook'
  | 'on_event';

export type RuleScheduleCron = 'every_30s' | 'every_5m' | 'hourly' | 'daily_09';

export type RuleTargetEntity = 'customer' | 'order' | 'appointment' | 'opportunity' | 'ticket';

export type RuleConditionOp =
  | 'eq'
  | 'neq'
  | 'contains'
  | 'gte'
  | 'lte'
  | 'within_next_hours'
  | 'older_than_hours'
  | 'before_rel'
  | 'after_rel';

export type RuleCondition = {
  id: string;
  field: string;
  op: RuleConditionOp;
  value: string;
};

export type RuleActionType =
  | 'send_sms'
  | 'send_whatsapp'
  | 'send_email'
  | 'create_task'
  | 'update_field'
  | 'change_stage'
  | 'assign_owner'
  | 'call_webhook'
  | 'add_tag'
  | 'create_ticket';

export type RuleAction = {
  id: string;
  type: RuleActionType;
  channel?: NotificationChannel;
  messageTemplate?: string;
  taskTitleTemplate?: string;
  field?: string;
  value?: string;
  stage?: string;
  ownerName?: string;
  webhookUrl?: string;
  tag?: string;
  ticketSubjectTemplate?: string;
  ticketPriority?: 'low' | 'normal' | 'high';
};

export type Rule = {
  id: string;
  name: string;
  trigger: string;
  condition: string;
  action: string;
  active: boolean;
  pack?: 'all' | IndustryPack;
  // Structured dynamic rule fields (FR-AUT)
  triggerType?: RuleTriggerType;
  scheduleCron?: RuleScheduleCron;
  webhookTopic?: string;
  eventName?: string;
  targetEntity?: RuleTargetEntity;
  conditionLogic?: 'AND' | 'OR' | 'NOT';
  conditions?: RuleCondition[];
  actionType?: 'send_notification' | 'create_task' | 'both';
  actionChannel?: NotificationChannel;
  actions?: RuleAction[];
  messageTemplate?: string;
  taskTitleTemplate?: string;
  dailyCapPerCustomer?: number;
  cooldownMinutes?: number;
  allowRepeat?: boolean;
  respectQuietHours?: boolean;
};

export type NotificationChannel = 'sms' | 'whatsapp' | 'email' | 'push' | 'in_app';
export type NotificationDeliveryStatus =
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'retrying'
  | 'failed'
  | 'dead_letter'
  | 'deferred_quiet';

export type OutboxMessage = {
  id: string;
  to: string;
  customerId?: string;
  customerName?: string;
  body: string;
  channel: NotificationChannel;
  subChannel?: 'sms' | 'whatsapp' | 'eitaa' | 'bale' | 'email' | 'push' | 'in_app';
  providerCode?: string;
  providerMessageId?: string;
  dlrUpdatedAt?: string;
  ruleId?: string;
  ruleName?: string;
  appointmentId?: string;
  canSimulateConfirm?: boolean;
  confirmedByReply?: boolean;
  deliveryStatus?: NotificationDeliveryStatus;
  retryCount?: number;
  maxRetries?: number;
  nextRetryAt?: string;
  lastError?: string;
  at: string;
};

export type MessageTemplate = {
  id: string;
  name: string;
  channel: NotificationChannel;
  category: 'appointment' | 'order' | 'sales' | 'support' | 'retention';
  body: string;
  pack?: 'all' | IndustryPack;
  updatedAt: string;
};

export type WebhookLogEntry = {
  id: string;
  direction: 'outgoing' | 'incoming';
  urlOrTopic: string;
  ruleId?: string;
  ruleName?: string;
  statusCode: number;
  latencyMs: number;
  payloadSummary: string;
  hmacSignature?: string;
  ok: boolean;
  at: string;
};

export type SmsProviderDriver = 'kavenegar' | 'melipayamak';
export type ChatProviderDriver = 'whatsapp' | 'eitaa' | 'bale';
export type TelephonyProviderDriver = 'simotel' | 'issabel';

export type CallDirection = 'inbound' | 'outbound';
export type CallStatus = 'answered' | 'missed' | 'voicemail' | 'busy' | 'ringing';

export type CallLogEntry = {
  id: string;
  direction: CallDirection;
  customerId?: string;
  customerName: string;
  phone: string;
  agentName: string;
  extension: string;
  providerDriver: TelephonyProviderDriver;
  status: CallStatus;
  outcome?: InteractionOutcome;
  durationSec: number;
  recordingAvailable: boolean;
  recordingDurationSec?: number;
  notes?: string;
  startedAt: string;
};

export type WebhookEndpoint = {
  id: string;
  name: string;
  url: string;
  secret: string;
  events: string[];
  active: boolean;
  lastTriggeredAt?: string;
  lastSignature?: string;
  createdAt: string;
};

export type AccountingSoftwarePreset = 'sepidar' | 'holoo' | 'rahkaran' | 'mahak' | 'generic_excel';

export type AccountingFieldMapping = {
  sourceKey: string;
  sourceLabel: string;
  targetColumn: string;
  accountCode?: string;
  enabled: boolean;
};

export type IntegrationsConfig = {
  smsDriver: SmsProviderDriver;
  smsSenderLine: string;
  smsApiKeyMasked: string;
  smsCreditToman: number;
  chatDriver: ChatProviderDriver;
  chatBotName: string;
  telephonyDriver: TelephonyProviderDriver;
  telephonyExtension: string;
  telephonyServerUrl: string;
  accountingPreset: AccountingSoftwarePreset;
  accountingMappings: AccountingFieldMapping[];
};

export type AutomationPolicy = {
  quietHoursEnabled: boolean;
  quietStartHour: number;
  quietEndHour: number;
  defaultDailyCap: number;
  maxRetries: number;
  backgroundRunnerEnabled?: boolean;
  runnerIntervalSec?: number;
  channelDailyCaps?: Partial<Record<NotificationChannel, number>>;
};

export type AutomationRunLog = {
  id: string;
  ruleId: string;
  ruleName: string;
  summary: string;
  status?: 'success' | 'skipped' | 'failed';
  reason?: string;
  triggerSource?: 'schedule' | 'event' | 'webhook' | 'manual';
  matchedCount?: number;
  executedCount?: number;
  skippedCount?: number;
  at: string;
};

export type SurveyType = 'nps' | 'csat' | 'ces';

export type NpsSurvey = {
  id: string;
  surveyType?: SurveyType;
  customerId: string;
  refType: 'appointment' | 'order' | 'ticket';
  refId: string;
  score: number; // nps: 0..10 | csat: 1..5 | ces: 1..7
  maxScale?: number;
  comment?: string;
  createdAt: string;
};

export type AuditLogEntry = {
  id: string;
  actorRole: UserRole;
  entity: string;
  action: 'create' | 'update' | 'delete' | 'merge' | 'approve' | 'automation' | 'system';
  summary: string;
  at: string;
};

export type UserRole = 'admin' | 'staff';
export type IndustryPack =
  | 'clinic'
  | 'shop'
  | 'software'
  | 'b2b'
  | 'education'
  | 'realestate'
  | 'salon'
  | 'restaurant'
  | 'freelancer'
  | 'car_service'
  | 'law_accounting'
  | 'travel_agency'
  | 'pharmacy'
  | 'wholesale'
  | 'gym'
  | 'school'
  | 'hotel'
  | 'general';

export type PackCustomerConfig = {
  singularLabel: string;
  pluralLabel: string;
  highlightFieldKey?: string;
  highlightColumnLabel?: string;
};

export type PackSalesConfig = {
  pipelineName: string;
  leadSingular: string;
  leadPlural: string;
  dealSingular: string;
  dealPlural: string;
  quoteLabel: string;
  defaultStages: PipelineStageConfig[];
};

export type PackOrderConfig = {
  channelDefault?: OrderChannel;
  statusLabels: Record<OrderStatus, string>;
  transitions: Record<OrderStatus, OrderStatus[]>;
};

export type PackMarketingConfig = {
  showContentCalendar: boolean;
  contentLabel?: string;
};

export type PackKpiMetricKey =
  | 'revenue'
  | 'orders_count'
  | 'appointments_count'
  | 'done_appointments'
  | 'no_show_rate'
  | 'new_customers'
  | 'active_pipeline_value'
  | 'won_deals_revenue'
  | 'sla_compliance_pct'
  | 'nps_score'
  | 'open_receivables';

export type PackKpiDef = {
  id: string;
  metricKey: PackKpiMetricKey;
  label: string;
  unit: 'toman' | 'count' | 'pct' | 'score';
  targetValue: number;
  higherIsBetter: boolean;
};

export type PackSampleData = {
  customers: {
    name: string;
    phone: string;
    personType?: CustomerPersonType;
    companyName?: string;
    lifecycle?: CustomerLifecycle;
    source?: string;
    tags?: string[];
    customFields?: Record<string, string>;
  }[];
  leads?: {
    name: string;
    phone: string;
    source: string;
    estimatedAmount?: number;
    score?: number;
    notes?: string;
  }[];
  orders?: {
    customerIndex: number;
    productName: string;
    qty: number;
    price: number;
    status: OrderStatus;
    notes?: string;
  }[];
  appointments?: {
    customerIndex: number;
    serviceName: string;
    offsetHours: number;
    status: AppointmentStatus;
    notes?: string;
  }[];
  tickets?: {
    customerIndex: number;
    subject: string;
    priority: 'low' | 'normal' | 'high';
    category?: string;
    status: TicketStatus;
  }[];
};

export type PackTemplate = {
  id: string;
  key: string;
  name: string;
  nameEn: string;
  tier: 'full' | 'medium' | 'light';
  category?: 'healthcare' | 'commerce' | 'services' | 'hospitality' | 'b2b' | 'education';
  description: string;
  descriptionEn: string;
  enabledModules?: string[];
  customerMeta?: PackCustomerConfig;
  salesMeta?: PackSalesConfig;
  orderMeta?: PackOrderConfig;
  marketingMeta?: PackMarketingConfig;
  kpiDefs?: PackKpiDef[];
  customFields: Omit<CustomFieldDef, 'id'>[];
  customEntities: Omit<CustomEntityDef, 'id' | 'createdAt'>[];
  services: Omit<Service, 'id'>[];
  products: Omit<Product, 'id'>[];
  rules: Omit<Rule, 'id'>[];
  workflowTemplates?: Omit<WorkflowDefinition, 'id' | 'updatedAt'>[];
  messageTemplates?: Omit<MessageTemplate, 'id' | 'updatedAt'>[];
  defaultReports?: Omit<SavedReportConfig, 'id' | 'createdAt' | 'updatedAt'>[];
  sampleData?: PackSampleData;
  exportedAt?: string;
  isCustom?: boolean;
};

export type DashboardPersonaRole = 'admin' | 'manager' | 'sales' | 'support' | 'receptionist';

export type DashboardWidgetId =
  | 'pack_kpis_goals'
  | 'kpi_summary'
  | 'chart_revenue_trend'
  | 'chart_sales_funnel'
  | 'chart_revenue_breakdown'
  | 'chart_cohort_retention'
  | 'chart_aging'
  | 'chart_sla_nps'
  | 'chart_appointments'
  | 'chart_orders'
  | 'chart_finance'
  | 'list_tasks'
  | 'list_tickets'
  | 'kpi_pipeline'
  | 'list_cheques'
  | 'sla_overview';

export type ReportEntityKey =
  | 'customers'
  | 'appointments'
  | 'orders'
  | 'invoices'
  | 'opportunities'
  | 'tickets'
  | 'leads'
  | 'payments';

export type ReportFilterOp = 'eq' | 'neq' | 'contains' | 'gte' | 'lte';
export type ReportFilterRule = {
  id: string;
  field: string;
  op: ReportFilterOp;
  value: string;
};

export type ReportAggType = 'count' | 'sum' | 'avg' | 'min' | 'max';
export type ReportChartType = 'table' | 'bar' | 'line' | 'area' | 'pie';

export type SavedReportConfig = {
  id: string;
  title: string;
  entity: ReportEntityKey;
  columns: string[];
  filters: ReportFilterRule[];
  groupBy: string;
  aggregation: ReportAggType;
  metricField: string;
  chartType: ReportChartType;
  datePreset?: string;
  dateFromJalali?: string;
  dateToJalali?: string;
  shared?: boolean;
  shareToken?: string;
  createdAt: string;
  updatedAt: string;
};

export type DashboardWidgetConfig = {
  id: DashboardWidgetId;
  title: string;
  titleEn: string;
  visible: boolean;
  size: 'half' | 'full';
  order: number;
};

export type ScheduledReport = {
  id: string;
  title: string;
  dataset: 'aging' | 'resources' | 'cohort' | 'customers' | 'orders' | 'invoices' | 'opportunities' | 'tickets';
  frequency: 'daily' | 'weekly' | 'monthly';
  format: 'pdf' | 'csv';
  recipients: string;
  active: boolean;
  lastSentAt?: string;
  nextRunAt: string;
};

export type Branch = {
  id: string;
  name: string;
  code: string;
  city: string;
  parentBranchId?: string;
  managerName?: string;
  active: boolean;
};

export type NumberingConfig = {
  invoicePrefix: string;
  quotePrefix: string;
  orderPrefix: string;
  includeJalaliYear: boolean;
  padLength: number;
  separator: '-' | '/';
};

export type DataScope = 'own' | 'team' | 'branch' | 'all';

export type PermissionResource =
  | 'customers'
  | 'sales'
  | 'orders'
  | 'appointments'
  | 'invoices'
  | 'tickets'
  | 'marketing'
  | 'reports'
  | 'automation'
  | 'integrations'
  | 'settings'
  | 'trash';

export type PermissionAction = 'view' | 'create' | 'edit' | 'delete' | 'export' | 'view_pii';

export type RoleDefinition = {
  id: string;
  key: string;
  name: string;
  description: string;
  baseRole: UserRole;
  dataScope: DataScope;
  maskPii: boolean;
  isSystem?: boolean;
  permissions: Record<PermissionResource, PermissionAction[]>;
};

export type TeamDefinition = {
  id: string;
  name: string;
  branchId?: string;
  leadUserId?: string;
  memberIds: string[];
};

export type CrmUser = {
  id: string;
  name: string;
  email: string;
  phone: string;
  roleId: string;
  teamId?: string;
  branchId?: string;
  dataScope?: DataScope;
  active: boolean;
  lastLoginAt?: string;
  createdAt: string;
};

export type BusinessProfileSettings = {
  legalName?: string;
  economicCode?: string;
  registrationNo?: string;
  phone?: string;
  email?: string;
  city?: string;
  address?: string;
  website?: string;
};

export type CurrencyCode = 'toman' | 'rial' | 'usd';

export type NotificationPreferences = {
  smsReminders: boolean;
  emailDigest: boolean;
  inAppToasts: boolean;
  slaBreachAlerts: boolean;
  dailySummaryHour: number;
  quietHoursStart: number;
  quietHoursEnd: number;
};

export type SecurityPolicyConfig = {
  sessionTimeoutMin: number; // 0 = disabled
  requireMfaSimulated: boolean;
  minPasswordLength: number;
  requireUppercase: boolean;
  requireNumber: boolean;
  requireSymbol: boolean;
  passwordExpiryDays: number;
  maxFailedAttempts: number;
  logCustomerAccess: boolean;
};

export type DataAccessLogEntry = {
  id: string;
  actorUserId?: string;
  actorName: string;
  actorRole: string;
  entityType: 'customer' | 'invoice' | 'ticket';
  entityId: string;
  entityLabel: string;
  action: 'view_360' | 'view_pii' | 'export';
  piiMasked: boolean;
  at: string;
};

export type TrashEntityType =
  | 'customer'
  | 'lead'
  | 'opportunity'
  | 'order'
  | 'appointment'
  | 'ticket'
  | 'task'
  | 'product';

export type TenantMeta = {
  id: string;
  name: string;
  industryPack: IndustryPack;
  customerCount: number;
  createdAt: string;
  updatedAt: string;
};

export type AiBrandTone = 'friendly' | 'formal' | 'clinical_expert' | 'luxury';

export type AiFeatureKey =
  | 'chat_rag'
  | 'timeline_summary'
  | 'ticket_reply'
  | 'ticket_triage'
  | 'lead_scoring'
  | 'nl_to_filter'
  | 'campaign_draft'
  | 'content_ideas'
  | 'evaluation';

export type AiConfig = {
  enabled: boolean;
  brandTone: AiBrandTone;
  maskPiiBeforeSend: boolean;
  logUsage: boolean;
  model: string;
};

export type AiUsageLogEntry = {
  id: string;
  feature: AiFeatureKey;
  mode: 'gemini' | 'fallback';
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  piiRedactedCount: number;
  latencyMs: number;
  actorName: string;
  actorRole: string;
  promptPreview: string;
  status: 'success' | 'fallback' | 'blocked';
  createdAt: string;
};

export type UiMode = 'solo' | 'enterprise';
export type AppLanguage = 'fa' | 'en';

export type BusinessSettings = {
  businessName: string;
  workStartHour: number;
  workEndHour: number;
  workDays: number[]; // JS day index 0=Sun..6=Sat
  role: UserRole;
  activeUserId?: string;
  industryPack: IndustryPack;
  darkMode: boolean;
  commissionPct: number;
  salesTeam: string[];
  roundRobinIndex: number;
  autoAssignLeads: boolean;
  activeBranchId: string; // 'all' or branch.id
  numbering: NumberingConfig;
  profile?: BusinessProfileSettings;
  taxRatePct?: number;
  currency?: CurrencyCode;
  defaultUnit?: string;
  notifications?: NotificationPreferences;
  security?: SecurityPolicyConfig;
  ai?: AiConfig;
  uiMode: UiMode;
  language: AppLanguage;
  latinDigits?: boolean;
  onboardingCompleted: boolean;
  simulatedOffline?: boolean;
  dashboardPersona?: DashboardPersonaRole;
  dashboardWidgets: DashboardWidgetConfig[];
  dashboardLayoutsByRole?: Partial<Record<DashboardPersonaRole, DashboardWidgetConfig[]>>;
  kpiTargets?: Record<string, number>;
  enabledModules?: string[];
};

export type AppState = {
  schemaVersion?: number;
  customers: Customer[];
  customerRelations: CustomerRelation[];
  customerSegments: CustomerSegment[];
  customerSavedViews: CustomerSavedView[];
  consentLogs: ConsentLog[];
  csvImportBatches: CsvImportBatch[];
  customFieldDefs: CustomFieldDef[];
  customEntityDefs: CustomEntityDef[];
  customEntityRecords: CustomEntityRecord[];
  entityRelations: EntityRelationDef[];
  configSnapshots: ConfigSnapshot[];
  interactions: Interaction[];
  services: Service[];
  resources: Resource[];
  resourceTimeOffs: ResourceTimeOff[];
  officialHolidays: OfficialHoliday[];
  waitlist: WaitlistEntry[];
  appointments: Appointment[];
  orders: Order[];
  orderLogs: OrderStatusLog[];
  invoices: Invoice[];
  paymentAllocations: PaymentAllocation[];
  sayadiCheques: SayadiCheque[];
  paymentTransactions: PaymentTransaction[];
  contracts: Contract[];
  warranties: WarrantyRecord[];
  products: Product[];
  stockMovements: StockMovement[];
  coupons: Coupon[];
  projects: Project[];
  timeEntries: TimeEntry[];
  leads: SalesLead[];
  pipelines: SalesPipeline[];
  pipelineStages: PipelineStageConfig[];
  opportunities: Opportunity[];
  priceLists: PriceList[];
  quotes: Quote[];
  salesTargets: SalesTarget[];
  commissionTiers: CommissionTier[];
  commissionRule: CommissionRuleConfig;
  commissionLedger: CommissionLedgerEntry[];
  workflowDefinitions: WorkflowDefinition[];
  workflows: WorkflowInstance[];
  contentItems: ContentItem[];
  campaigns: MarketingCampaign[];
  mediaAssets: MediaAsset[];
  landingForms: LandingForm[];
  utmTouches: UtmTouch[];
  loyaltyConfig?: LoyaltyConfig;
  loyaltyRewards?: LoyaltyReward[];
  loyaltyTransactions?: LoyaltyTransaction[];
  kbArticles: KbArticle[];
  tasks: Task[];
  tickets: Ticket[];
  ticketMessages: TicketMessage[];
  slaPolicies: Record<Ticket['priority'], SlaPolicy>;
  rules: Rule[];
  automationPolicy: AutomationPolicy;
  messageTemplates?: MessageTemplate[];
  webhookLogs?: WebhookLogEntry[];
  ruleCooldowns?: Record<string, string>;
  lastAutomationRunAt?: string;
  automationTickCount?: number;
  outbox: OutboxMessage[];
  automationLogs: AutomationRunLog[];
  callLogs?: CallLogEntry[];
  webhookEndpoints?: WebhookEndpoint[];
  integrationsConfig?: IntegrationsConfig;
  npsSurveys: NpsSurvey[];
  scheduledReports: ScheduledReport[];
  savedReports?: SavedReportConfig[];
  branches: Branch[];
  roles?: RoleDefinition[];
  teams?: TeamDefinition[];
  users?: CrmUser[];
  dataAccessLogs?: DataAccessLogEntry[];
  aiUsageLogs?: AiUsageLogEntry[];
  customPacks: PackTemplate[];
  auditLogs: AuditLogEntry[];
  processedRuleKeys: string[];
  recentIdempotencyKeys?: string[];
  settings: BusinessSettings;
};
