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

export type Customer = {
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
  createdAt: string;
  notes?: string;
  birthDateJalali?: string; // e.g. 1368/08/27
  anniversaryDateJalali?: string; // e.g. 1402/08/28
  isAnonymized?: boolean;
  // Clinic pack optional fields
  patientCode?: string;
  birthYear?: string;
  allergies?: string;
  consentSms?: boolean;
  consentPhoto?: boolean;
  attachments?: CustomerAttachment[];
  // Software pack optional fields
  licenseKey?: string;
  contractExpiresAt?: string;
  branchId?: string;
  // Dynamic custom fields (cfg.FieldDef -> CustomJson)
  customFields?: Record<string, string>;
};

export type CustomerRelationType = 'referrer' | 'family' | 'colleague';
export type CustomerRelation = {
  id: string;
  fromCustomerId: string;
  toCustomerId: string;
  relationType: CustomerRelationType;
  note?: string;
  createdAt: string;
};

export type SegmentCondition = {
  id: string;
  field: 'lifecycle' | 'source' | 'personType' | 'tag' | 'minSpent' | 'minScore' | 'consentSms';
  op: 'eq' | 'neq' | 'contains' | 'gte';
  value: string;
};

export type CustomerSegment = {
  id: string;
  name: string;
  description?: string;
  logic: 'AND' | 'OR';
  conditions: SegmentCondition[];
  createdAt: string;
};

export type CsvImportBatch = {
  id: string;
  fileName: string;
  customerIds: string[];
  count: number;
  importedAt: string;
  rolledBack?: boolean;
};

export type CustomFieldType =
  | 'text'
  | 'number'
  | 'select'
  | 'date'
  | 'multiselect'
  | 'file'
  | 'money'
  | 'phone'
  | 'nationalId'
  | 'lookup'
  | 'formula';

export type CustomFieldDef = {
  id: string;
  key: string;
  label: string;
  type: CustomFieldType;
  options?: string[];
  required?: boolean;
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

export type Interaction = {
  id: string;
  customerId: string;
  channel: 'call' | 'sms' | 'whatsapp' | 'visit' | 'note';
  text: string;
  at: string;
};

export type Service = {
  id: string;
  name: string;
  durationMin: number;
  price: number;
  bufferBeforeMin?: number;
  bufferAfterMin?: number;
};

export type Resource = { id: string; name: string; type: 'staff' | 'room' };

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
  branchId?: string;
};

export type OrderStatus = 'new' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
export type ShippingCarrier = 'post' | 'tipax' | 'snappbox' | 'chapar' | 'pickup';

export type OrderShipment = {
  id: string;
  carrier: ShippingCarrier;
  trackingCode: string;
  items: { name: string; qty: number }[];
  shippedAt: string;
  note?: string;
};

export type Order = {
  id: string;
  customerId: string;
  items: { name: string; qty: number; price: number }[];
  status: OrderStatus;
  createdAt: string;
  updatedAt?: string;
  promisedAt?: string;
  couponCode?: string;
  discountAmount?: number;
  trackingCode?: string;
  carrier?: ShippingCarrier;
  shipments?: OrderShipment[];
  branchId?: string;
};

export type OrderStatusLog = { id: string; orderId: string; from: string; to: string; at: string };

export type PaymentMethod = 'cash' | 'card' | 'online' | 'transfer' | 'cheque';
export type Invoice = {
  id: string;
  invoiceNo: string;
  orderId: string;
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
  branchId?: string;
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
  status: PaymentTransactionStatus;
  errorCode?: string;
  errorMessage?: string;
  at: string;
};

export type Product = {
  id: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
  minStock?: number;
  active: boolean;
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

export type Coupon = {
  id: string;
  code: string;
  discountPct: number;
  maxUses: number;
  usedCount: number;
  active: boolean;
};

export type ProjectStatus = 'planning' | 'in_progress' | 'testing' | 'deployed' | 'completed';
export type ProjectTask = {
  id: string;
  title: string;
  assignee: string;
  estimatedHours: number;
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

export type PipelineStage = 'lead' | 'contacted' | 'proposal' | 'negotiation' | 'won' | 'lost';
export type PipelineStageConfig = {
  key: PipelineStage;
  label: string;
  probability: number;
  slaHours: number;
};

export type Opportunity = {
  id: string;
  title: string;
  customerId?: string;
  contactName: string;
  phone: string;
  source: string;
  stage: PipelineStage;
  amount: number;
  probability: number;
  ownerName: string;
  lostReason?: string;
  branchId?: string;
  createdAt: string;
  updatedAt: string;
};

export type QuoteStatus = 'draft' | 'sent' | 'approved' | 'rejected';
export type Quote = {
  id: string;
  quoteNo: string;
  version: number;
  parentQuoteId?: string;
  opportunityId?: string;
  customerId?: string;
  contactName: string;
  phone?: string;
  items: { name: string; qty: number; price: number }[];
  discountPct: number;
  taxPct: number;
  notes?: string;
  status: QuoteStatus;
  shareToken: string;
  validUntil: string;
  clientComment?: string;
  createdAt: string;
};

export type SalesTarget = {
  id: string;
  ownerName: string;
  periodLabel: string;
  targetAmount: number;
};

export type CommissionTier = {
  id: string;
  upToAmount: number | null; // null = infinity
  ratePct: number;
};

export type WorkflowType = 'discount_approval' | 'order_return' | 'vip_schedule' | 'complaint' | 'custom';
export type WorkflowNodeType = 'start' | 'task' | 'parallel_gateway' | 'timer' | 'end';

export type WorkflowNodeDef = {
  id: string;
  type: WorkflowNodeType;
  label: string;
  role: 'staff' | 'admin';
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
};

export type WorkflowDefinition = {
  id: string;
  key: string;
  name: string;
  description?: string;
  type: WorkflowType;
  version: number;
  status: 'draft' | 'published';
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
  parallelBranches?: WorkflowParallelBranchState[];
  formFields?: CustomFieldDef[];
  stepData?: Record<string, string>;
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
  leadsCount: number;
  hasBeforeAfterConsent?: boolean;
  caption?: string;
  mediaAssetId?: string;
};

export type CampaignVariant = {
  subject: string;
  body: string;
  sent: number;
  clicks: number;
  conversions: number;
};

export type MarketingCampaign = {
  id: string;
  name: string;
  segmentId?: string;
  channel: NotificationChannel;
  status: 'draft' | 'running' | 'completed';
  abTestEnabled: boolean;
  variantA: CampaignVariant;
  variantB?: CampaignVariant;
  winner?: 'A' | 'B';
  utmCampaign: string;
  createdAt: string;
  launchedAt?: string;
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

export type KbArticleVersion = {
  version: number;
  title: string;
  category: string;
  body: string;
  updatedAt: string;
  editor: string;
  changeNote?: string;
};

export type KbArticle = {
  id: string;
  title: string;
  category: string;
  body: string;
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
  createdByRuleId?: string;
};

export type TicketMessage = {
  id: string;
  ticketId: string;
  authorName: string;
  authorType: 'customer' | 'agent';
  visibility: 'public' | 'internal';
  body: string;
  createdAt: string;
};

export type Ticket = {
  id: string;
  customerId: string;
  subject: string;
  priority: 'low' | 'normal' | 'high';
  status: 'open' | 'pending' | 'resolved';
  category?: string;
  team?: string;
  assignee?: string;
  slaHours?: number;
  escalated?: boolean;
  escalatedAt?: string;
  escalatedTo?: string;
  mergedIntoTicketId?: string;
  mergedFromIds?: string[];
  rootCause?: string;
  createdAt: string;
  resolvedAt?: string;
  replyNote?: string;
};

export type RuleTriggerType = 'schedule' | 'on_create' | 'on_update' | 'on_stage_change' | 'on_ticket_create';
export type RuleTargetEntity = 'customer' | 'order' | 'appointment' | 'opportunity' | 'ticket';
export type RuleCondition = {
  id: string;
  field: string;
  op: 'eq' | 'neq' | 'contains' | 'gte' | 'lte';
  value: string;
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
  targetEntity?: RuleTargetEntity;
  conditionLogic?: 'AND' | 'OR' | 'NOT';
  conditions?: RuleCondition[];
  actionType?: 'send_notification' | 'create_task' | 'both';
  actionChannel?: NotificationChannel;
  messageTemplate?: string;
  taskTitleTemplate?: string;
  dailyCapPerCustomer?: number;
  respectQuietHours?: boolean;
};

export type NotificationChannel = 'sms' | 'email' | 'push' | 'in_app';
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

export type AutomationPolicy = {
  quietHoursEnabled: boolean;
  quietStartHour: number;
  quietEndHour: number;
  defaultDailyCap: number;
  maxRetries: number;
};

export type AutomationRunLog = {
  id: string;
  ruleId: string;
  ruleName: string;
  summary: string;
  at: string;
};

export type NpsSurvey = {
  id: string;
  customerId: string;
  refType: 'appointment' | 'order';
  refId: string;
  score: number; // 0..10
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
  | 'general';

export type PackTemplate = {
  id: string;
  key: string;
  name: string;
  nameEn: string;
  tier: 'full' | 'medium' | 'light';
  description: string;
  descriptionEn: string;
  customFields: Omit<CustomFieldDef, 'id'>[];
  customEntities: Omit<CustomEntityDef, 'id' | 'createdAt'>[];
  services: Omit<Service, 'id'>[];
  products: Omit<Product, 'id'>[];
  rules: Omit<Rule, 'id'>[];
  exportedAt?: string;
  isCustom?: boolean;
};

export type DashboardWidgetId =
  | 'kpi_summary'
  | 'chart_appointments'
  | 'chart_orders'
  | 'chart_finance'
  | 'list_tasks'
  | 'list_tickets'
  | 'kpi_pipeline'
  | 'list_cheques';

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

export type UiMode = 'solo' | 'enterprise';
export type AppLanguage = 'fa' | 'en';

export type BusinessSettings = {
  businessName: string;
  workStartHour: number;
  workEndHour: number;
  workDays: number[]; // JS day index 0=Sun..6=Sat
  role: UserRole;
  industryPack: IndustryPack;
  darkMode: boolean;
  commissionPct: number;
  salesTeam: string[];
  roundRobinIndex: number;
  autoAssignLeads: boolean;
  activeBranchId: string; // 'all' or branch.id
  numbering: NumberingConfig;
  uiMode: UiMode;
  language: AppLanguage;
  latinDigits?: boolean;
  onboardingCompleted: boolean;
  simulatedOffline?: boolean;
  dashboardWidgets: DashboardWidgetConfig[];
};

export type AppState = {
  customers: Customer[];
  customerRelations: CustomerRelation[];
  customerSegments: CustomerSegment[];
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
  sayadiCheques: SayadiCheque[];
  paymentTransactions: PaymentTransaction[];
  products: Product[];
  stockMovements: StockMovement[];
  coupons: Coupon[];
  projects: Project[];
  timeEntries: TimeEntry[];
  pipelineStages: PipelineStageConfig[];
  opportunities: Opportunity[];
  quotes: Quote[];
  salesTargets: SalesTarget[];
  commissionTiers: CommissionTier[];
  workflowDefinitions: WorkflowDefinition[];
  workflows: WorkflowInstance[];
  contentItems: ContentItem[];
  campaigns: MarketingCampaign[];
  mediaAssets: MediaAsset[];
  landingForms: LandingForm[];
  utmTouches: UtmTouch[];
  kbArticles: KbArticle[];
  tasks: Task[];
  tickets: Ticket[];
  ticketMessages: TicketMessage[];
  rules: Rule[];
  automationPolicy: AutomationPolicy;
  outbox: OutboxMessage[];
  automationLogs: AutomationRunLog[];
  npsSurveys: NpsSurvey[];
  scheduledReports: ScheduledReport[];
  branches: Branch[];
  customPacks: PackTemplate[];
  auditLogs: AuditLogEntry[];
  processedRuleKeys: string[];
  settings: BusinessSettings;
};
