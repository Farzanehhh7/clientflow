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

export type WorkflowType = 'discount_approval' | 'order_return' | 'vip_schedule' | 'complaint';
export type WorkflowStep = {
  name: string;
  role: 'staff' | 'admin';
  status: 'pending' | 'approved' | 'rejected';
  actor?: string;
  comment?: string;
  at?: string;
};
export type WorkflowInstance = {
  id: string;
  title: string;
  type: WorkflowType;
  customerId?: string;
  relatedRef?: string;
  currentStepIndex: number;
  steps: WorkflowStep[];
  status: 'running' | 'approved' | 'rejected';
  createdAt: string;
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
};

export type KbArticle = {
  id: string;
  title: string;
  category: string;
  body: string;
  helpfulCount: number;
  updatedAt: string;
};

export type Task = {
  id: string;
  title: string;
  customerId?: string;
  dueAt: string;
  done: boolean;
  createdByRuleId?: string;
};

export type Ticket = {
  id: string;
  customerId: string;
  subject: string;
  priority: 'low' | 'normal' | 'high';
  status: 'open' | 'pending' | 'resolved';
  createdAt: string;
  replyNote?: string;
};

export type Rule = {
  id: string;
  name: string;
  trigger: string;
  condition: string;
  action: string;
  active: boolean;
  pack?: 'all' | 'clinic' | 'shop' | 'software';
};

export type OutboxMessage = {
  id: string;
  to: string;
  customerName?: string;
  body: string;
  channel: 'sms';
  ruleName?: string;
  appointmentId?: string;
  canSimulateConfirm?: boolean;
  confirmedByReply?: boolean;
  at: string;
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
export type IndustryPack = 'clinic' | 'shop' | 'software' | 'general';

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
  workflows: WorkflowInstance[];
  contentItems: ContentItem[];
  kbArticles: KbArticle[];
  tasks: Task[];
  tickets: Ticket[];
  rules: Rule[];
  outbox: OutboxMessage[];
  automationLogs: AutomationRunLog[];
  npsSurveys: NpsSurvey[];
  auditLogs: AuditLogEntry[];
  processedRuleKeys: string[];
  settings: BusinessSettings;
};
