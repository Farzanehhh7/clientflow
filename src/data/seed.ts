import dayjs from 'dayjs';
import jalaliday from 'jalaliday';
import type {
  AppState,
  Appointment,
  AppointmentStatus,
  AuditLogEntry,
  AutomationRunLog,
  CommissionTier,
  ConfigSnapshot,
  ContentItem,
  Coupon,
  CustomEntityDef,
  CustomEntityRecord,
  CustomFieldDef,
  Customer,
  CustomerRelation,
  CustomerSegment,
  EntityRelationDef,
  Interaction,
  Invoice,
  KbArticle,
  NpsSurvey,
  OfficialHoliday,
  Opportunity,
  Order,
  OrderStatus,
  OrderStatusLog,
  OutboxMessage,
  PipelineStageConfig,
  Product,
  Project,
  Quote,
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
} from '../types';

dayjs.extend(jalaliday);

const now = dayjs();
const iso = (offsetHours: number) => now.add(offsetHours, 'hour').toISOString();
const dayAt = (offsetDays: number, hour: number, minute = 0) =>
  now.add(offsetDays, 'day').hour(hour).minute(minute).second(0).millisecond(0).toISOString();

const jalaliWithOffset = (year: number, dayOffset: number) => {
  const j = now.add(dayOffset, 'day').calendar('jalali');
  return `${year}/${String(j.month() + 1).padStart(2, '0')}/${String(j.date()).padStart(2, '0')}`;
};

const CUSTOMER_NAMES = [
  'مریم صالحی',
  'نازنین رضایی',
  'الهام جعفری',
  'سارا محمدی',
  'زهرا کریمی',
  'فرزانه احمدی',
  'پریسا حسینی',
  'نگار موسوی',
  'فاطمه کاظمی',
  'مهسا شریفی',
  'شیما قاسمی',
  'بهار نجفی',
  'رویا نادری',
  'سپیده مرادی',
  'هانیه یوسفی',
  'آرزو صادقی',
  'سمیرا امینی',
  'لیلا نوروزی',
  'شقایق رحیمی',
  'مهناز اکبری',
  'علیرضا فرهادی',
  'امیرحسین باقری',
  'محمدرضا هاشمی',
  'کیانوش تهرانی',
  'پویا رستگار',
  'سینا عباسی',
  'حامد سلطانی',
  'بهنام ملکی',
  'سجاد پناهی',
  'آرش مظفری',
];

const SOURCES = ['اینستاگرام', 'معرفی', 'سایت', 'حضوری', 'تبلیغات'];
const TAG_POOL = [['VIP'], ['پیگیری'], ['مراجع ثابت'], ['VIP', 'پیگیری'], ['فروشگاه'], ['جدید'], []];
const ALLERGIES = ['', 'حساسیت به لیدوکائین', 'پوست حساس', '', 'حساسیت فصلی', ''];

export const customFieldDefs: CustomFieldDef[] = [
  {
    id: 'cf1',
    key: 'preferred_channel',
    label: 'کانال تماس ترجیحی',
    type: 'select',
    options: ['واتساپ', 'تماس تلفنی', 'پیامک'],
    order: 1,
  },
  {
    id: 'cf2',
    key: 'skin_type',
    label: 'نوع پوست / نیاز اصلی',
    type: 'text',
    order: 2,
  },
  {
    id: 'cf3',
    key: 'insurance_credit',
    label: 'سقف اعتبار / بودجه (تومان)',
    type: 'money',
    order: 3,
  },
];

export const customers: Customer[] = CUSTOMER_NAMES.map((name, idx) => {
  const num = String(idx + 1).padStart(2, '0');
  const prefix = ['0912', '0913', '0917', '0935', '0919'][idx % 5];
  const lifecycles = ['vip', 'active', 'active', 'lead', 'active', 'churned'] as const;
  const isOrg = idx === 3 || idx === 23 || idx === 27;

  // Give first few customers birthdays/anniversaries near today so the calendar & automation shine immediately
  const birthDayOffset = idx === 0 ? 0 : idx === 1 ? 2 : idx === 5 ? 5 : (idx * 17) % 300;
  const birthYearNum = 1365 + (idx % 18);

  return {
    id: `c${idx + 1}`,
    name: isOrg ? (idx === 3 ? 'کلینیک تخصصی مهر (شرکتی)' : idx === 23 ? 'گروه فناوری پارس‌داده' : 'هلدینگ بازرگانی نیکان') : name,
    phone: `${prefix}11100${num}`,
    email: idx % 3 === 0 ? `client${idx + 1}@example.ir` : undefined,
    nationalId: !isOrg && idx % 2 === 0 ? `001${String(4501000 + idx * 37)}` : undefined,
    personType: isOrg ? 'organization' : 'individual',
    companyName: isOrg ? (idx === 3 ? 'شرکت سلامت گستر مهر' : idx === 23 ? 'فناوری اطلاعات پارس‌داده' : 'تجارت الکترونیک نیکان') : undefined,
    economicCode: isOrg ? `4111${String(52000000 + idx * 91)}` : undefined,
    registrationNo: isOrg ? String(452000 + idx * 13) : undefined,
    contacts: isOrg
      ? [
          { id: `cnt_${idx}_1`, name, role: 'مدیر خرید / هماهنگی', phone: `${prefix}11100${num}`, isPrimary: true },
          { id: `cnt_${idx}_2`, name: 'مهندس سهرابی', role: 'مسئول مالی', phone: '09124445566' },
        ]
      : idx === 0
        ? [{ id: 'cnt_0_1', name: 'رضا صالحی', role: 'همراه / همسر', phone: '09122223344' }]
        : [],
    addresses:
      idx % 4 === 0 || isOrg
        ? [
            {
              id: `adr_${idx}_1`,
              title: isOrg ? 'دفتر مرکزی' : 'منزل',
              address: 'تهران، خیابان ولیعصر، بالاتر از پارک ساعی، پلاک ۲۱۰',
              postalCode: '1511914511',
              isDefault: true,
            },
          ]
        : [],
    lifecycle: lifecycles[idx % lifecycles.length],
    tags: TAG_POOL[idx % TAG_POOL.length],
    source: SOURCES[idx % SOURCES.length],
    createdAt: iso(-600 + idx * 18),
    notes: idx % 4 === 0 ? 'مشتری پیگیر و منظم، ترجیح تماس عصرها.' : undefined,
    birthDateJalali: !isOrg ? jalaliWithOffset(birthYearNum, birthDayOffset) : undefined,
    anniversaryDateJalali: idx === 2 ? jalaliWithOffset(1402, 1) : idx === 6 ? jalaliWithOffset(1401, 4) : undefined,
    patientCode: `CF-${140500 + idx + 1}`,
    birthYear: String(birthYearNum),
    allergies: ALLERGIES[idx % ALLERGIES.length] || undefined,
    consentSms: idx % 7 !== 0,
    consentPhoto: idx % 2 === 0,
    attachments:
      idx === 0
        ? [
            {
              id: 'att1',
              name: 'رضایت‌نامه_تکمیلی_فیشیال.pdf',
              category: 'consent',
              sizeLabel: '240 KB',
              mimeType: 'application/pdf',
              uploadedAt: iso(-90),
              note: 'تأیید کتبی مراقبت‌های پوستی',
            },
            {
              id: 'att2',
              name: 'نتیجه_آزمایش_پوست.pdf',
              category: 'lab_pdf',
              sizeLabel: '410 KB',
              mimeType: 'application/pdf',
              uploadedAt: iso(-40),
            },
          ]
        : [],
    licenseKey: idx < 10 ? `LIC-CF-${2026}-${100 + idx}` : undefined,
    contractExpiresAt: idx < 4 ? iso(72 + idx * 24) : idx < 10 ? iso(600 + idx * 48) : undefined,
    customFields: {
      preferred_channel: ['واتساپ', 'تماس تلفنی', 'پیامک'][idx % 3],
      skin_type: ['مختلط', 'چرب', 'خشک', 'حساس'][idx % 4],
      insurance_credit: String((idx % 5 + 1) * 1500000),
    },
  };
});

export const customerRelations: CustomerRelation[] = [
  { id: 'rel1', fromCustomerId: 'c1', toCustomerId: 'c2', relationType: 'referrer', note: 'معرفی از اینستاگرام', createdAt: iso(-120) },
  { id: 'rel2', fromCustomerId: 'c1', toCustomerId: 'c5', relationType: 'family', note: 'خواهر', createdAt: iso(-90) },
  { id: 'rel3', fromCustomerId: 'c4', toCustomerId: 'c7', relationType: 'colleague', note: 'همکار مجموعه مهر', createdAt: iso(-60) },
];

export const customerSegments: CustomerSegment[] = [
  {
    id: 'seg1',
    name: 'مشتریان VIP ارزشمند',
    description: 'مشتریان VIP با امتیاز بالای ۶۰',
    logic: 'AND',
    conditions: [
      { id: 'sc1', field: 'lifecycle', op: 'eq', value: 'vip' },
      { id: 'sc2', field: 'minScore', op: 'gte', value: '55' },
    ],
    createdAt: iso(-100),
  },
  {
    id: 'seg2',
    name: 'مشتریان حقوقی / شرکتی',
    description: 'کسب‌وکارها و کلینیک‌های طرف قرارداد',
    logic: 'AND',
    conditions: [{ id: 'sc3', field: 'personType', op: 'eq', value: 'organization' }],
    createdAt: iso(-80),
  },
];

export const customEntityDefs: CustomEntityDef[] = [
  {
    id: 'ent_equip',
    key: 'equipment_asset',
    name: 'دستگاه و تجهیز',
    pluralName: 'تجهیزات و دستگاه‌ها',
    description: 'مدیریت دستگاه‌های تخصصی یا سرورهای تحویلی به مشتریان',
    createdAt: iso(-200),
    fields: [
      { id: 'ef1', key: 'device_name', label: 'نام دستگاه / سرور', type: 'text', required: true, order: 1 },
      { id: 'ef2', key: 'serial_no', label: 'شماره سریال', type: 'text', order: 2 },
      { id: 'ef3', key: 'warranty_date', label: 'پایان گارانتی', type: 'date', order: 3 },
      { id: 'ef4', key: 'service_fee', label: 'هزینه سرویس دوره‌ای', type: 'money', order: 4 },
    ],
  },
];

export const customEntityRecords: CustomEntityRecord[] = [
  {
    id: 'er1',
    entityKey: 'equipment_asset',
    relatedCustomerId: 'c4',
    values: {
      device_name: 'دستگاه هیدرودرم آبریژن پرو',
      serial_no: 'HD-2026-881',
      warranty_date: '2027-03-20',
      service_fee: '3500000',
    },
    createdAt: iso(-50),
  },
  {
    id: 'er2',
    entityKey: 'equipment_asset',
    relatedCustomerId: 'c24',
    values: {
      device_name: 'سرور اختصاصی پردازش CRM',
      serial_no: 'SRV-IR-405',
      warranty_date: '2026-12-30',
      service_fee: '6200000',
    },
    createdAt: iso(-20),
  },
];

export const entityRelations: EntityRelationDef[] = [
  { id: 'erel1', name: 'تجهیزات هر مشتری', sourceEntity: 'Customer', targetEntity: 'equipment_asset', cardinality: '1:N' },
  { id: 'erel2', name: 'فاکتورهای سفارش', sourceEntity: 'Order', targetEntity: 'Invoice', cardinality: '1:1' },
];

export const pipelineStages: PipelineStageConfig[] = [
  { key: 'lead', label: 'سرنخ جدید', probability: 20, slaHours: 24 },
  { key: 'contacted', label: 'تماس اولیه', probability: 35, slaHours: 48 },
  { key: 'proposal', label: 'ارسال پیش‌فاکتور', probability: 55, slaHours: 72 },
  { key: 'negotiation', label: 'مذاکره', probability: 75, slaHours: 96 },
  { key: 'won', label: 'برنده‌شده', probability: 100, slaHours: 0 },
  { key: 'lost', label: 'ازدست‌رفته', probability: 0, slaHours: 0 },
];

export const commissionTiers: CommissionTier[] = [
  { id: 'ct1', upToAmount: 10_000_000, ratePct: 5 },
  { id: 'ct2', upToAmount: 25_000_000, ratePct: 8 },
  { id: 'ct3', upToAmount: null, ratePct: 12 },
];

export const salesTargets: SalesTarget[] = [
  { id: 'st1', ownerName: 'مریم (فروش)', periodLabel: 'آبان ۱۴۰۵', targetAmount: 25_000_000 },
  { id: 'st2', ownerName: 'علی (استقرار)', periodLabel: 'آبان ۱۴۰۵', targetAmount: 22_000_000 },
  { id: 'st3', ownerName: 'سارا (پذیرش)', periodLabel: 'آبان ۱۴۰۵', targetAmount: 12_000_000 },
];

export const configSnapshots: ConfigSnapshot[] = [
  {
    id: 'snap_init',
    versionLabel: 'v1.0.0',
    note: 'پیکربندی پایه سیستم و فیلدهای اولیه',
    createdAt: iso(-240),
    customFieldDefs,
    customEntityDefs,
    entityRelations,
    pipelineStages,
    commissionTiers,
  },
];

export const services: Service[] = [
  { id: 's1', name: 'ویزیت اولیه', durationMin: 30, price: 500000, bufferBeforeMin: 0, bufferAfterMin: 5 },
  { id: 's2', name: 'ویزیت کنترل', durationMin: 15, price: 250000, bufferBeforeMin: 0, bufferAfterMin: 0 },
  { id: 's3', name: 'مشاوره پوست و مو', durationMin: 30, price: 650000, bufferBeforeMin: 5, bufferAfterMin: 5 },
  { id: 's4', name: 'فیشیال تخصصی', durationMin: 60, price: 1450000, bufferBeforeMin: 5, bufferAfterMin: 10 },
  { id: 's5', name: 'لیزر درمانی', durationMin: 45, price: 1200000, bufferBeforeMin: 5, bufferAfterMin: 15 },
];

export const resources: Resource[] = [
  { id: 'r1', name: 'دکتر کشاورز', type: 'staff' },
  { id: 'r2', name: 'دکتر راد', type: 'staff' },
  { id: 'r3', name: 'اتاق ۱ (پروسیجر)', type: 'room' },
];

export const resourceTimeOffs: ResourceTimeOff[] = [
  {
    id: 'off1',
    resourceId: 'r2',
    startDateKey: now.add(3, 'day').format('YYYY-MM-DD'),
    endDateKey: now.add(3, 'day').format('YYYY-MM-DD'),
    reason: 'شرکت در همایش تخصصی پوست',
  },
];

export const officialHolidays: OfficialHoliday[] = [
  {
    id: 'hol1',
    dateKey: now.add(6, 'day').format('YYYY-MM-DD'),
    jalaliDate: jalaliWithOffset(now.calendar('jalali').year(), 6),
    title: 'تعطیل رسمی نمونه (تقویم شمسی)',
  },
];

export const waitlist: WaitlistEntry[] = [
  {
    id: 'wl1',
    customerId: 'c8',
    serviceId: 's4',
    preferredResourceId: 'r1',
    preferredDayKey: now.format('YYYY-MM-DD'),
    preferredTimeRange: '۱۶:۰۰ تا ۱۹:۰۰',
    notes: 'در صورت کنسلی سریعاً پیامک ارسال شود',
    status: 'waiting',
    createdAt: iso(-12),
  },
  {
    id: 'wl2',
    customerId: 'c13',
    serviceId: 's1',
    preferredResourceId: 'r2',
    preferredDayKey: now.add(1, 'day').format('YYYY-MM-DD'),
    preferredTimeRange: '۱۰:۰۰ تا ۱۳:۰۰',
    status: 'waiting',
    createdAt: iso(-6),
  },
];

const APT_STATUS_PAST: AppointmentStatus[] = ['done', 'done', 'done', 'noshow', 'cancelled'];
const APT_STATUS_FUTURE: AppointmentStatus[] = ['booked', 'confirmed', 'confirmed', 'booked'];

export const appointments: Appointment[] = Array.from({ length: 40 }, (_, i) => {
  const dayOffset = Math.floor(i / 4) - 4;
  const slotInDay = i % 4;
  const resource = resources[i % resources.length];
  const startHour = 9 + slotInDay * 2 + (i % 3 === 0 ? 0 : 1);
  const service = services[i % services.length];
  const start = dayAt(dayOffset, startHour, slotInDay % 2 === 0 ? 0 : 30);
  const end = dayjs(start).add(service.durationMin, 'minute').toISOString();

  let status: AppointmentStatus;
  if (dayOffset < 0) {
    status = APT_STATUS_PAST[i % APT_STATUS_PAST.length];
  } else if (dayOffset === 0) {
    status = slotInDay === 0 ? 'done' : slotInDay === 1 ? 'checked_in' : slotInDay === 2 ? 'confirmed' : 'booked';
  } else {
    status = APT_STATUS_FUTURE[i % APT_STATUS_FUTURE.length];
  }

  return {
    id: `a${i + 1}`,
    customerId: customers[i % customers.length].id,
    serviceId: service.id,
    resourceId: resource.id,
    start,
    end,
    status,
  };
});

appointments[24] = {
  ...appointments[24],
  start: iso(23.5),
  end: iso(24),
  status: 'confirmed',
  resourceId: 'r1',
};

// Appointment ~1.5h from now to allow immediate testing of 2-hour reminder & client confirmation simulation
appointments[25] = {
  ...appointments[25],
  start: iso(1.5),
  end: iso(2),
  status: 'booked',
  resourceId: 'r2',
};

export const products: Product[] = [
  { id: 'p1', name: 'کرم مرطوب‌کننده هیالورونیک', sku: 'SK-101', price: 420000, stock: 24, minStock: 8, active: true },
  { id: 'p2', name: 'ضدآفتاب بی‌رنگ SPF50', sku: 'SK-102', price: 580000, stock: 18, minStock: 8, active: true },
  { id: 'p3', name: 'سرم ویتامین C تخصصی', sku: 'SK-103', price: 890000, stock: 5, minStock: 8, active: true },
  { id: 'p4', name: 'ژل شست‌وشوی ملایم صورت', sku: 'SK-104', price: 340000, stock: 30, minStock: 10, active: true },
  { id: 'p5', name: 'ماسک ترمیم‌کننده شب', sku: 'SK-105', price: 640000, stock: 6, minStock: 10, active: true },
  { id: 'p6', name: 'کیت مراقبت پس از لیزر', sku: 'SK-106', price: 1150000, stock: 15, minStock: 5, active: true },
];

export const stockMovements: StockMovement[] = [
  {
    id: 'sm1',
    productId: 'p3',
    productName: 'سرم ویتامین C تخصصی',
    orderId: 'o3',
    type: 'out',
    qtyChange: -2,
    balanceAfter: 5,
    reason: 'تأیید و خروج سفارش o3',
    at: iso(-28),
  },
  {
    id: 'sm2',
    productId: 'p5',
    productName: 'ماسک ترمیم‌کننده شب',
    type: 'adjust',
    qtyChange: -3,
    balanceAfter: 6,
    reason: 'کسری انبارگردانی دوره آبان',
    at: iso(-12),
  },
];

export const coupons: Coupon[] = [
  { id: 'cp1', code: 'WELCOME10', discountPct: 10, maxUses: 100, usedCount: 14, active: true },
  { id: 'cp2', code: 'VIP20', discountPct: 20, maxUses: 50, usedCount: 8, active: true },
  { id: 'cp3', code: 'CLINIC15', discountPct: 15, maxUses: 40, usedCount: 5, active: true },
];

const ORDER_STATUSES: OrderStatus[] = [
  'new',
  'confirmed',
  'shipped',
  'delivered',
  'delivered',
  'confirmed',
  'new',
  'cancelled',
];

export const orders: Order[] = Array.from({ length: 25 }, (_, i) => {
  const status = ORDER_STATUSES[i % ORDER_STATUSES.length];
  const pA = products[i % products.length];
  const pB = products[(i + 2) % products.length];
  const createdOffset = -120 + i * 4;
  const promisedOffset = i % 5 === 0 ? -18 : i % 3 === 0 ? -4 : 36;
  const updatedOffset = i % 6 === 0 ? -60 : createdOffset + 2;

  return {
    id: `o${i + 1}`,
    customerId: customers[(i * 2) % customers.length].id,
    items:
      i % 2 === 0
        ? [{ name: pA.name, qty: 1 + (i % 2), price: pA.price }]
        : [
            { name: pA.name, qty: 1, price: pA.price },
            { name: pB.name, qty: 1, price: pB.price },
          ],
    status,
    createdAt: iso(createdOffset),
    updatedAt: iso(updatedOffset),
    promisedAt: iso(promisedOffset),
    couponCode: i % 7 === 0 ? 'WELCOME10' : undefined,
    discountAmount: i % 7 === 0 ? Math.round(pA.price * 0.1) : 0,
    carrier: status === 'shipped' || status === 'delivered' ? (i % 2 === 0 ? 'post' : 'tipax') : undefined,
    trackingCode:
      status === 'shipped' || status === 'delivered'
        ? `TRK-${4058100 + i * 17}`
        : undefined,
    shipments:
      status === 'shipped' || status === 'delivered'
        ? [
            {
              id: `shp_${i + 1}`,
              carrier: i % 2 === 0 ? 'post' : 'tipax',
              trackingCode: `TRK-${4058100 + i * 17}`,
              items: [{ name: pA.name, qty: 1 }],
              shippedAt: iso(createdOffset + 10),
            },
          ]
        : [],
  };
});

export const orderLogs: OrderStatusLog[] = orders.flatMap((o, idx) => {
  const logs: OrderStatusLog[] = [
    { id: `ol_${o.id}_1`, orderId: o.id, from: 'ایجاد', to: 'new', at: o.createdAt },
  ];
  if (o.status !== 'new') {
    logs.push({
      id: `ol_${o.id}_2`,
      orderId: o.id,
      from: 'new',
      to: o.status === 'cancelled' ? 'cancelled' : 'confirmed',
      at: iso(-115 + idx * 4),
    });
  }
  if (o.status === 'shipped' || o.status === 'delivered') {
    logs.push({
      id: `ol_${o.id}_3`,
      orderId: o.id,
      from: 'confirmed',
      to: 'shipped',
      at: iso(-108 + idx * 4),
    });
  }
  if (o.status === 'delivered') {
    logs.push({
      id: `ol_${o.id}_4`,
      orderId: o.id,
      from: 'shipped',
      to: 'delivered',
      at: iso(-100 + idx * 4),
    });
  }
  return logs;
});

export const invoices: Invoice[] = orders.slice(0, 10).map((o, idx) => {
  const subtotal = o.items.reduce((s, it) => s + it.qty * it.price, 0);
  const discount = o.discountAmount ?? 0;
  const tax = Math.round((subtotal - discount) * 0.1);
  const grandTotal = subtotal - discount + tax;
  const paidAmount =
    o.status === 'delivered' ? grandTotal : idx % 3 === 0 ? Math.round(grandTotal * 0.5) : 0;
  return {
    id: `inv_${o.id}`,
    invoiceNo: `INV-1405-${1001 + idx}`,
    orderId: o.id,
    customerId: o.customerId,
    subtotal,
    discount,
    tax,
    grandTotal,
    paidAmount,
    method: (['online', 'card', 'transfer', 'cash'] as const)[idx % 4],
    status: paidAmount >= grandTotal ? 'paid' : paidAmount > 0 ? 'partial' : 'issued',
    issuedAt: o.createdAt,
    dueAt: o.promisedAt ?? iso(48),
  };
});

export const projects: Project[] = [
  {
    id: 'prj1',
    title: 'راه‌اندازی و استقرار پورتال نوبت‌دهی کلینیک مهر',
    customerId: 'c4',
    status: 'testing',
    dueAt: iso(120),
    createdAt: iso(-240),
    tasks: [
      { id: 'pt1', title: 'نصب پایگاه داده و تنظیم پشتیبان‌گیری', assignee: 'علی (استقرار)', estimatedHours: 6, done: true },
      { id: 'pt2', title: 'پیکربندی درگاه پیامک و نوبت‌دهی آنلاین', assignee: 'سارا (پذیرش)', estimatedHours: 8, done: true },
      { id: 'pt3', title: 'تست بار و آموزش کاربران نهایی', assignee: 'علی (استقرار)', estimatedHours: 5, done: false },
    ],
    deploymentChecklist: [
      { id: 'dc1', title: 'گواهی SSL و دامنه فعال شد', category: 'infra', done: true, checkedAt: iso(-96) },
      { id: 'dc2', title: 'بکاپ خودکار شبانه SQL پیکربندی شد', category: 'db', done: true, checkedAt: iso(-72) },
      { id: 'dc3', title: 'اسکن امنیتی و محدودیت دسترسی نقش‌ها', category: 'security', done: false },
      { id: 'dc4', title: 'برگزاری جلسه آموزش کارشناسان پذیرش', category: 'training', done: false },
    ],
  },
  {
    id: 'prj2',
    title: 'ارتقای لایسنس و مهاجرت داده گروه پارس‌داده',
    customerId: 'c24',
    status: 'in_progress',
    dueAt: iso(240),
    createdAt: iso(-72),
    tasks: [
      { id: 'pt4', title: 'انتقال مشتریان و تیکت‌های قبلی از اکسل', assignee: 'علی (استقرار)', estimatedHours: 10, done: false },
    ],
    deploymentChecklist: [
      { id: 'dc5', title: 'تحویل کلید لایسنس سازمانی', category: 'infra', done: true, checkedAt: iso(-24) },
      { id: 'dc6', title: 'تأیید صحت داده‌های مهاجرت‌یافته', category: 'db', done: false },
    ],
  },
];

export const timeEntries: TimeEntry[] = [
  { id: 'te1', projectId: 'prj1', taskId: 'pt1', userName: 'علی (استقرار)', hours: 5.5, note: 'پیکربندی کامل کلاستر و زمان‌بندی بکاپ', loggedAt: iso(-120) },
  { id: 'te2', projectId: 'prj1', taskId: 'pt2', userName: 'سارا (پذیرش)', hours: 6, note: 'تست پیامک یادآور و رزرو آزمایشی', loggedAt: iso(-48) },
  { id: 'te3', projectId: 'prj2', taskId: 'pt4', userName: 'علی (استقرار)', hours: 3.5, note: 'پاکسازی شماره موبایل‌ها و نگاشت ستون‌ها', loggedAt: iso(-10) },
];

export const opportunities: Opportunity[] = [
  {
    id: 'opp1',
    title: 'پکیج ۶ جلسه فیشیال و مراقبت پوست',
    customerId: 'c1',
    contactName: 'مریم صالحی',
    phone: '09121110001',
    source: 'اینستاگرام',
    stage: 'negotiation',
    amount: 7800000,
    probability: 75,
    ownerName: 'مریم (فروش)',
    createdAt: iso(-120),
    updatedAt: iso(-110),
  },
  {
    id: 'opp2',
    title: 'قرارداد تأمین محصولات کلینیک زیبایی مهر',
    customerId: 'c4',
    contactName: 'سارا محمدی',
    phone: '09351110004',
    source: 'معرفی',
    stage: 'proposal',
    amount: 14500000,
    probability: 55,
    ownerName: 'مریم (فروش)',
    createdAt: iso(-70),
    updatedAt: iso(-18),
  },
  {
    id: 'opp3',
    title: 'دوره کامل لیزر فول‌بادی',
    contactName: 'الهام کاظمی',
    phone: '09128881122',
    source: 'سایت',
    stage: 'lead',
    amount: 5400000,
    probability: 20,
    ownerName: 'سارا (پذیرش)',
    createdAt: iso(-30),
    updatedAt: iso(-30),
  },
  {
    id: 'opp4',
    title: 'خرید عمده کیت مراقبت پس از لیزر',
    customerId: 'c7',
    contactName: 'پریسا حسینی',
    phone: '09131110007',
    source: 'تبلیغات',
    stage: 'contacted',
    amount: 9200000,
    probability: 35,
    ownerName: 'مریم (فروش)',
    createdAt: iso(-48),
    updatedAt: iso(-12),
  },
  {
    id: 'opp5',
    title: 'پکیج VIP جوان‌سازی فصلی',
    customerId: 'c10',
    contactName: 'مهسا شریفی',
    phone: '09191110010',
    source: 'معرفی',
    stage: 'won',
    amount: 11000000,
    probability: 100,
    ownerName: 'مریم (فروش)',
    createdAt: iso(-160),
    updatedAt: iso(-30),
  },
  {
    id: 'opp6',
    title: 'سفارش هدایای سازمانی مراقبت پوست',
    contactName: 'کیانوش تهرانی',
    phone: '09351110024',
    source: 'سایت',
    stage: 'won',
    amount: 18500000,
    probability: 100,
    ownerName: 'علی (استقرار)',
    createdAt: iso(-200),
    updatedAt: iso(-40),
  },
  {
    id: 'opp7',
    title: 'مشاوره و بسته روتین پوستی',
    contactName: 'بهار نجفی',
    phone: '09131110012',
    source: 'اینستاگرام',
    stage: 'lost',
    amount: 3200000,
    probability: 0,
    ownerName: 'سارا (پذیرش)',
    lostReason: 'محدودیت بودجه مشتری',
    createdAt: iso(-140),
    updatedAt: iso(-50),
  },
];

export const quotes: Quote[] = [
  {
    id: 'q1',
    quoteNo: 'QT-1405-101',
    version: 1,
    opportunityId: 'opp2',
    customerId: 'c4',
    contactName: 'سارا محمدی (کلینیک مهر)',
    phone: '09351110004',
    items: [
      { name: 'کیت مراقبت پس از لیزر', qty: 10, price: 1150000 },
      { name: 'سرم ویتامین C تخصصی', qty: 4, price: 890000 },
    ],
    discountPct: 5,
    taxPct: 10,
    notes: 'اعتبار پیش‌فاکتور ۱۰ روز کاری، ارسال رایگان به آدرس کلینیک.',
    status: 'sent',
    shareToken: 'qt-share-101-v1',
    validUntil: iso(168),
    createdAt: iso(-24),
  },
  {
    id: 'q2',
    quoteNo: 'QT-1405-101',
    version: 2,
    parentQuoteId: 'q1',
    opportunityId: 'opp2',
    customerId: 'c4',
    contactName: 'سارا محمدی (کلینیک مهر)',
    phone: '09351110004',
    items: [
      { name: 'کیت مراقبت پس از لیزر', qty: 12, price: 1150000 },
      { name: 'سرم ویتامین C تخصصی', qty: 4, price: 890000 },
    ],
    discountPct: 10,
    taxPct: 10,
    notes: 'نسخه اصلاح‌شده با تخفیف ۱۰٪ خرید عمده.',
    status: 'approved',
    shareToken: 'qt-share-101-v2',
    validUntil: iso(240),
    clientComment: 'تعداد و تخفیف جدید مورد تأیید است، لطفاً فاکتور نهایی صادر شود.',
    createdAt: iso(-8),
  },
];

export const workflows: WorkflowInstance[] = [
  {
    id: 'wf1',
    title: 'درخواست تأیید تخفیف ۲۵٪ برای پکیج فیشیال',
    type: 'discount_approval',
    customerId: 'c1',
    relatedRef: 'o5',
    currentStepIndex: 1,
    slaHours: 24,
    status: 'running',
    createdAt: iso(-14),
    steps: [
      {
        name: 'ثبت درخواست و توجیه فروش توسط کارشناس',
        role: 'staff',
        status: 'approved',
        actor: 'کارشناس فروش',
        comment: 'مشتری وفادار با سابقه ۵ خرید قبلی',
        at: iso(-14),
      },
      {
        name: 'تأیید نهایی مدیر فروش (تخفیف بالای ۲۰٪)',
        role: 'admin',
        status: 'pending',
      },
      {
        name: 'اعمال کد تخفیف و اطلاع‌رسانی پیامکی',
        role: 'staff',
        status: 'pending',
      },
    ],
  },
  {
    id: 'wf2',
    title: 'رسیدگی به درخواست مرجوعی کرم مرطوب‌کننده',
    type: 'order_return',
    customerId: 'c9',
    relatedRef: 'o9',
    currentStepIndex: 0,
    slaHours: 12,
    status: 'running',
    createdAt: iso(-6),
    steps: [
      {
        name: 'بررسی سلامت پلمپ و تماس اولیه کارشناس',
        role: 'staff',
        status: 'pending',
      },
      {
        name: 'تأیید استرداد وجه / تعویض کالا توسط مدیر',
        role: 'admin',
        status: 'pending',
      },
    ],
  },
  {
    id: 'wf3',
    title: 'رسیدگی به شکایت تأخیر ارسال مرسوله',
    type: 'complaint',
    customerId: 'c3',
    relatedRef: 'k2',
    currentStepIndex: 2,
    slaHours: 24,
    status: 'approved',
    createdAt: iso(-72),
    steps: [
      {
        name: 'ثبت ریشه‌یابی تأخیر پست',
        role: 'staff',
        status: 'approved',
        actor: 'کارشناس پشتیبانی',
        comment: 'تأخیر از سمت مرکز مبادلات پستی بود؛ کد پیگیری جدید ارسال شد.',
        at: iso(-66),
      },
      {
        name: 'تأیید ارسال کد تخفیف جبرانی توسط مدیر',
        role: 'admin',
        status: 'approved',
        actor: 'مدیر سیستم',
        comment: 'کد WELCOME10 صادر شد.',
        at: iso(-60),
      },
    ],
  },
];

export const contentItems: ContentItem[] = [
  {
    id: 'cnt1',
    title: 'ریلز: ۳ اشتباه رایج پس از لیزر پوست',
    platform: 'instagram',
    format: 'reel',
    status: 'published',
    scheduledAt: iso(-48),
    assignee: 'نگار (محتوا)',
    reach: 18400,
    leadsCount: 23,
    hasBeforeAfterConsent: true,
    caption: 'مراقبت ۲۴ ساعت اول بعد از لیزر اهمیت زیادی دارد...',
  },
  {
    id: 'cnt2',
    title: 'پست اسلایدی: مقایسه ضدآفتاب‌های بی‌رنگ SPF50',
    platform: 'instagram',
    format: 'post',
    status: 'scheduled',
    scheduledAt: iso(20),
    assignee: 'نگار (محتوا)',
    reach: 0,
    leadsCount: 0,
    caption: 'چطور ضدآفتاب مناسب پوست چرب انتخاب کنیم؟',
  },
  {
    id: 'cnt3',
    title: 'نمونه‌کار قبل و بعد فیشیال تخصصی (با رضایت مراجع)',
    platform: 'instagram',
    format: 'story',
    status: 'review',
    scheduledAt: iso(36),
    assignee: 'نگار (محتوا)',
    reach: 0,
    leadsCount: 0,
    hasBeforeAfterConsent: true,
  },
  {
    id: 'cnt4',
    title: 'مقاله سئو: راهنمای روتین پوستی پاییز و زمستان',
    platform: 'blog',
    format: 'article',
    status: 'draft',
    scheduledAt: iso(72),
    assignee: 'علی (سایت)',
    reach: 0,
    leadsCount: 0,
  },
  {
    id: 'cnt5',
    title: 'معرفی پکیج مراقبت خانگی پس از پروسیجر',
    platform: 'site',
    format: 'article',
    status: 'idea',
    scheduledAt: iso(120),
    assignee: 'نگار (محتوا)',
    reach: 0,
    leadsCount: 0,
  },
];

export const kbArticles: KbArticle[] = [
  {
    id: 'kb1',
    title: 'نحوه تغییر ساعت نوبت یا لغو بدون جریمه',
    category: 'نوبت‌دهی و پذیرش',
    body: 'مراجعان محترم تا ۱۲ ساعت پیش از زمان نوبت می‌توانند ساعت ویزیت خود را بدون هزینه جابه‌جا کنند. در سامانه بخش نوبت‌ها، روی وضعیت کلیک کرده و زمان جدید را بدون تداخل ثبت نمایید.',
    helpfulCount: 34,
    updatedAt: iso(-120),
  },
  {
    id: 'kb2',
    title: 'پیگیری کد رهگیری مرسولات پستی و تیپاکس',
    category: 'سفارش و ارسال',
    body: 'سفارش‌های تأییدشده حداکثر طی ۲۴ ساعت کاری بسته‌بندی و تحویل پست یا تیپاکس می‌شوند. پس از تغییر وضعیت به «ارسال‌شده»، پیامک حاوی کد رهگیری به‌صورت خودکار برای مشتری ارسال می‌گردد.',
    helpfulCount: 41,
    updatedAt: iso(-80),
  },
  {
    id: 'kb3',
    title: 'دستورالعمل مراقبت ۲۴ ساعته پس از لیزر و فیشیال',
    category: 'مراقبت‌های کلینیک',
    body: 'تا ۲۴ ساعت از شست‌وشو با آب داغ، لایه‌بردارها و قرار گرفتن مستقیم در معرض آفتاب خودداری کرده و استفاده منظم از کرم ترمیم‌کننده و ضدآفتاب SPF50 الزامی است.',
    helpfulCount: 52,
    updatedAt: iso(-45),
  },
  {
    id: 'kb4',
    title: 'شرایط استفاده از کد تخفیف و مرجوعی کالا',
    category: 'سفارش و مالی',
    body: 'کدهای تخفیف (مانند WELCOME10) هنگام ثبت سفارش قابل اعمال هستند. در صورت آسیب‌دیدگی فیزیکی بسته، تا ۴۸ ساعت امکان ثبت درخواست مرجوعی در گردش کار پشتیبانی وجود دارد.',
    helpfulCount: 19,
    updatedAt: iso(-30),
  },
];

export const tasks: Task[] = [
  { id: 't1', title: 'تماس پیگیری سفارش دارای تأخیر', customerId: 'c1', dueAt: iso(-5), done: false },
  { id: 't2', title: 'یادآوری نوبت فردا به مراجع', customerId: 'c2', dueAt: iso(2), done: false },
  { id: 't3', title: 'ارسال دستور مراقبت پس از لیزر', customerId: 'c5', dueAt: iso(4), done: false },
  { id: 't4', title: 'تأیید آدرس ارسال بسته پستی', customerId: 'c3', dueAt: iso(-14), done: false },
  { id: 't5', title: 'پیگیری پرداخت پیش‌فاکتور مشاوره', customerId: 'c7', dueAt: iso(-24), done: false },
  { id: 't6', title: 'تماس رضایت‌سنجی یک هفته بعد از ویزیت', customerId: 'c4', dueAt: iso(5), done: false },
  { id: 't7', title: 'ثبت شماره پیگیری تیپاکس', customerId: 'c9', dueAt: iso(1), done: false },
  { id: 't8', title: 'بررسی موجودی سرم ویتامین C', dueAt: iso(-8), done: false },
  { id: 't9', title: 'هماهنگی تغییر ساعت ویزیت دکتر راد', customerId: 'c11', dueAt: iso(6), done: false },
  { id: 't10', title: 'ارسال پیش‌فاکتور پکیج فیشیال', customerId: 'c12', dueAt: iso(-30), done: true },
  { id: 't11', title: 'تکمیل پرونده رضایت‌نامه عکس', customerId: 'c6', dueAt: iso(-48), done: true },
  { id: 't12', title: 'به‌روزرسانی برچسب مشتریان VIP', dueAt: iso(24), done: false },
];

export const tickets: Ticket[] = [
  { id: 'k1', customerId: 'c1', subject: 'تغییر ساعت نوبت عصر به صبح', priority: 'normal', status: 'open', createdAt: iso(-10) },
  { id: 'k2', customerId: 'c3', subject: 'پیگیری کد رهگیری مرسوله پستی', priority: 'high', status: 'open', createdAt: iso(-6) },
  { id: 'k3', customerId: 'c5', subject: 'سوال درباره نحوه مصرف سرم ویتامین C', priority: 'low', status: 'pending', createdAt: iso(-20) },
  { id: 'k4', customerId: 'c7', subject: 'درخواست فاکتور رسمی برای سفارش', priority: 'normal', status: 'open', createdAt: iso(-15) },
  { id: 'k5', customerId: 'c2', subject: 'عدم دریافت پیامک تأیید نوبت', priority: 'high', status: 'pending', createdAt: iso(-5) },
  { id: 'k6', customerId: 'c9', subject: 'تعویض محصول مرجوعی کرم مرطوب‌کننده', priority: 'high', status: 'open', createdAt: iso(-12) },
  { id: 'k7', customerId: 'c10', subject: 'مشاوره انتخاب ضدآفتاب مناسب پوست چرب', priority: 'low', status: 'resolved', createdAt: iso(-72), replyNote: 'ضدآفتاب بی‌رنگ SPF50 پیشنهاد و ثبت شد.' },
  { id: 'k8', customerId: 'c14', subject: 'درخواست تخفیف مشتریان وفادار', priority: 'normal', status: 'resolved', createdAt: iso(-50), replyNote: 'کد VIP20 ارسال گردید.' },
  { id: 'k9', customerId: 'c18', subject: 'گزارش حساسیت خفیف پس از فیشیال', priority: 'high', status: 'pending', createdAt: iso(-3) },
  { id: 'k10', customerId: 'c22', subject: 'سوال درباره ساعات کاری روز پنج‌شنبه', priority: 'low', status: 'resolved', createdAt: iso(-90), replyNote: 'پاسخ داده شد.' },
];

export const interactions: Interaction[] = [
  { id: 'i1', customerId: 'c1', channel: 'visit', text: 'ویزیت اولیه انجام شد و برنامه مراقبتی تجویز گردید.', at: iso(-96) },
  { id: 'i2', customerId: 'c1', channel: 'whatsapp', text: 'ارسال راهنمای استفاده از محصولات در واتساپ.', at: iso(-72) },
  { id: 'i3', customerId: 'c1', channel: 'call', text: 'تماس برای هماهنگی جلسه بعدی.', at: iso(-12) },
  { id: 'i4', customerId: 'c2', channel: 'sms', text: 'پیامک تأیید نوبت ارسال شد.', at: iso(-24) },
  { id: 'i5', customerId: 'c3', channel: 'call', text: 'مشتری زمان ارسال بسته را جویا شد.', at: iso(-8) },
  { id: 'i6', customerId: 'c5', channel: 'note', text: 'پوست حساس به ترکیبات اسیدی؛ در پرونده ثبت شود.', at: iso(-40) },
];

export const rules: Rule[] = [
  {
    id: 'u1',
    name: 'یادآوری نوبت ۲۴ ساعت قبل',
    trigger: 'زمان‌بندی (هر ۳۰ ثانیه)',
    condition: 'نوبت تأییدشده در بازه ۲۰ تا ۲۸ ساعت آینده',
    action: 'ارسال پیامک شبیه‌سازی‌شده به صندوق ارسال',
    active: true,
    pack: 'all',
  },
  {
    id: 'u7',
    name: 'یادآور ۲ ساعت قبل از نوبت (با امکان تأیید پاسخ مشتری)',
    trigger: 'زمان‌بندی (هر ۳۰ ثانیه)',
    condition: 'نوبت در وضعیت رزرو/تأیید در ۲ ساعت آینده',
    action: 'ارسال پیامک یادآور فوری + دکمه شبیه‌سازی تأیید مشتری',
    active: true,
    pack: 'all',
  },
  {
    id: 'u6',
    name: 'تبریک خودکار تولد و سالگرد مشتریان (شمسی)',
    trigger: 'روزانه / تطبیق تاریخ شمسی',
    condition: 'تولد یا سالگرد امروز مشتری دارای رضایت پیامک',
    action: 'ارسال پیامک تبریک خودکار با کد هدیه',
    active: true,
    pack: 'all',
  },
  {
    id: 'u2',
    name: 'سفارش بدون به‌روزرسانی ۴۸ ساعته',
    trigger: 'زمان‌بندی (هر ۳۰ ثانیه)',
    condition: 'سفارش در وضعیت ثبت/تأیید > ۴۸ ساعت بدون تغییر',
    action: 'ایجاد وظیفه پیگیری خودکار',
    active: true,
    pack: 'all',
  },
  {
    id: 'u3',
    name: 'دعوت به ویزیت کنترل (بسته کلینیک)',
    trigger: 'زمان‌بندی (بسته کلینیک)',
    condition: 'نوبت انجام‌شده بیش از ۳ روز پیش بدون وظیفه پیگیری',
    action: 'ایجاد وظیفه ویزیت کنترل + پیامک یادآوری',
    active: true,
    pack: 'clinic',
  },
  {
    id: 'u4',
    name: 'پیگیری سفارش رهاشده (بسته فروشگاه)',
    trigger: 'زمان‌بندی (بسته فروشگاه)',
    condition: 'سفارش در وضعیت «جدید» بیش از ۱۲ ساعت',
    action: 'ارسال پیامک یادآوری تکمیل سفارش',
    active: true,
    pack: 'shop',
  },
  {
    id: 'u5',
    name: 'هشدار تمدید قرارداد و لایسنس (بسته نرم‌افزاری)',
    trigger: 'زمان‌بندی (بسته نرم‌افزاری)',
    condition: 'تاریخ انقضای قرارداد در ۷ روز آینده',
    action: 'ایجاد وظیفه تمدید + پیامک یادآوری',
    active: true,
    pack: 'software',
  },
];

export const initialOutbox: OutboxMessage[] = [
  {
    id: 'm1',
    to: '09131110002',
    customerName: 'نازنین رضایی',
    body: 'نازنین رضایی عزیز، یادآوری نوبت شما در مرکز درمانی فردا ساعت ۱۰:۳۰ ثبت شده است.',
    channel: 'sms',
    ruleName: 'یادآوری نوبت ۲۴ ساعت قبل',
    at: iso(-18),
  },
  {
    id: 'm2',
    to: '09121110001',
    customerName: 'مریم صالحی',
    body: 'مریم صالحی گرامی، سفارش شما تأیید شد و در حال آماده‌سازی برای ارسال است.',
    channel: 'sms',
    ruleName: 'اطلاع‌رسانی وضعیت سفارش',
    at: iso(-30),
  },
];

export const initialAutomationLogs: AutomationRunLog[] = [
  {
    id: 'al1',
    ruleId: 'u1',
    ruleName: 'یادآوری نوبت ۲۴ ساعت قبل',
    summary: '۱ پیامک یادآوری شبیه‌سازی‌شده در صندوق ارسال ثبت شد.',
    at: iso(-18),
  },
];

export const initialNpsSurveys: NpsSurvey[] = [
  { id: 'n1', customerId: 'c1', refType: 'appointment', refId: 'a1', score: 10, comment: 'برخورد بسیار حرفه‌ای و بدون معطلی.', createdAt: iso(-90) },
  { id: 'n2', customerId: 'c4', refType: 'order', refId: 'o4', score: 9, comment: 'بسته‌بندی بسیار تمیز و ارسال سریع.', createdAt: iso(-60) },
  { id: 'n3', customerId: 'c6', refType: 'appointment', refId: 'a5', score: 8, comment: 'همه‌چیز خوب بود، فقط جای پارک کمی سخت بود.', createdAt: iso(-45) },
  { id: 'n4', customerId: 'c8', refType: 'order', refId: 'o5', score: 5, comment: 'سفارش با یک روز تأخیر به دستم رسید.', createdAt: iso(-32) },
  { id: 'n5', customerId: 'c10', refType: 'appointment', refId: 'a9', score: 10, comment: 'نتیجه مشاوره عالی بود.', createdAt: iso(-25) },
  { id: 'n6', customerId: 'c12', refType: 'order', refId: 'o12', score: 9, comment: 'کیفیت محصولات اصلی و عالی.', createdAt: iso(-16) },
  { id: 'n7', customerId: 'c15', refType: 'appointment', refId: 'a13', score: 7, comment: 'خوب بود.', createdAt: iso(-10) },
  { id: 'n8', customerId: 'c20', refType: 'order', refId: 'o20', score: 10, comment: 'پشتیبانی سریع و پاسخگو.', createdAt: iso(-5) },
];

export const initialAuditLogs: AuditLogEntry[] = [
  {
    id: 'aud1',
    actorRole: 'admin',
    entity: 'سیستم',
    action: 'system',
    summary: 'بسته صنعتی کلینیک و داده‌های نمونه اولیه بارگذاری شدند.',
    at: iso(-48),
  },
  {
    id: 'aud2',
    actorRole: 'staff',
    entity: 'گردش کار',
    action: 'create',
    summary: 'درخواست تأیید تخفیف ۲۵٪ برای مریم صالحی ثبت و به مدیر ارسال شد.',
    at: iso(-14),
  },
];

export const createInitialState = (): AppState => ({
  customers,
  customerRelations,
  customerSegments,
  csvImportBatches: [],
  customFieldDefs,
  customEntityDefs,
  customEntityRecords,
  entityRelations,
  configSnapshots,
  interactions,
  services,
  resources,
  resourceTimeOffs,
  officialHolidays,
  waitlist,
  appointments,
  orders,
  orderLogs,
  invoices,
  products,
  stockMovements,
  coupons,
  projects,
  timeEntries,
  pipelineStages,
  opportunities,
  quotes,
  salesTargets,
  commissionTiers,
  workflows,
  contentItems,
  kbArticles,
  tasks,
  tickets,
  rules,
  outbox: initialOutbox,
  automationLogs: initialAutomationLogs,
  npsSurveys: initialNpsSurveys,
  auditLogs: initialAuditLogs,
  processedRuleKeys: ['u1_a2', 'u2_o1'],
  settings: {
    businessName: 'کلینیک و فروشگاه تخصصی آوا',
    workStartHour: 9,
    workEndHour: 19,
    workDays: [6, 0, 1, 2, 3, 4],
    role: 'admin',
    industryPack: 'clinic',
    darkMode: false,
    commissionPct: 5,
    salesTeam: ['مریم (فروش)', 'سارا (پذیرش)', 'علی (استقرار)'],
    roundRobinIndex: 0,
    autoAssignLeads: true,
  },
});
