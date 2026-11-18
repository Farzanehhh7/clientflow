export type Customer = {
  id: string;
  name: string;
  phone: string;
  email?: string;
  tags: string[];
  source?: string;
  createdAt: string;
  notes?: string;
  // Clinic pack optional fields
  patientCode?: string;
  birthYear?: string;
  allergies?: string;
  consentSms?: boolean;
  consentPhoto?: boolean;
  // Dynamic custom fields (cfg.FieldDef -> CustomJson)
  customFields?: Record<string, string>;
};

export type CustomFieldDef = {
  id: string;
  key: string;
  label: string;
  type: 'text' | 'number' | 'select';
  options?: string[];
  required?: boolean;
};

export type Interaction = {
  id: string;
  customerId: string;
  channel: 'call' | 'sms' | 'whatsapp' | 'visit' | 'note';
  text: string;
  at: string;
};

export type Service = { id: string; name: string; durationMin: number; price: number };
export type Resource = { id: string; name: string; type: 'staff' | 'room' };

export type AppointmentStatus = 'booked' | 'confirmed' | 'done' | 'noshow' | 'cancelled';
export type Appointment = {
  id: string;
  customerId: string;
  serviceId: string;
  resourceId: string;
  start: string; // ISO UTC
  end: string; // ISO UTC
  status: AppointmentStatus;
  cancelReason?: string;
};

export type OrderStatus = 'new' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
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
  active: boolean;
};

export type Coupon = {
  id: string;
  code: string;
  discountPct: number;
  maxUses: number;
  usedCount: number;
  active: boolean;
};

export type PipelineStage = 'lead' | 'contacted' | 'proposal' | 'negotiation' | 'won' | 'lost';
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
  pack?: 'all' | 'clinic' | 'shop';
};

export type OutboxMessage = {
  id: string;
  to: string;
  customerName?: string;
  body: string;
  channel: 'sms';
  ruleName?: string;
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
export type IndustryPack = 'clinic' | 'shop' | 'general';

export type BusinessSettings = {
  businessName: string;
  workStartHour: number;
  workEndHour: number;
  workDays: number[]; // JS day index 0=Sun..6=Sat
  role: UserRole;
  industryPack: IndustryPack;
  darkMode: boolean;
  commissionPct: number;
};

export type AppState = {
  customers: Customer[];
  customFieldDefs: CustomFieldDef[];
  interactions: Interaction[];
  services: Service[];
  resources: Resource[];
  appointments: Appointment[];
  orders: Order[];
  orderLogs: OrderStatusLog[];
  invoices: Invoice[];
  products: Product[];
  coupons: Coupon[];
  opportunities: Opportunity[];
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
