import dayjs from 'dayjs';
import type {
  AppState,
  Appointment,
  AppointmentStatus,
  AuditLogEntry,
  AutomationRunLog,
  ContentItem,
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
  OrderStatusLog,
  OutboxMessage,
  Product,
  Resource,
  Rule,
  Service,
  Task,
  Ticket,
  WorkflowInstance,
} from '../types';

const now = dayjs();
const iso = (offsetHours: number) => now.add(offsetHours, 'hour').toISOString();
const dayAt = (offsetDays: number, hour: number, minute = 0) =>
  now.add(offsetDays, 'day').hour(hour).minute(minute).second(0).millisecond(0).toISOString();

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
  },
  {
    id: 'cf2',
    key: 'skin_type',
    label: 'نوع پوست / نیاز اصلی',
    type: 'text',
  },
];

export const customers: Customer[] = CUSTOMER_NAMES.map((name, idx) => {
  const num = String(idx + 1).padStart(2, '0');
  const prefix = ['0912', '0913', '0917', '0935', '0919'][idx % 5];
  return {
    id: `c${idx + 1}`,
    name,
    phone: `${prefix}11100${num}`,
    email: idx % 3 === 0 ? `client${idx + 1}@example.ir` : undefined,
    tags: TAG_POOL[idx % TAG_POOL.length],
    source: SOURCES[idx % SOURCES.length],
    createdAt: iso(-600 + idx * 18),
    notes: idx % 4 === 0 ? 'مشتری پیگیر و منظم، ترجیح تماس عصرها.' : undefined,
    patientCode: `CF-${140500 + idx + 1}`,
    birthYear: String(1365 + (idx % 18)),
    allergies: ALLERGIES[idx % ALLERGIES.length] || undefined,
    consentSms: idx % 7 !== 0,
    consentPhoto: idx % 2 === 0,
    customFields: {
      preferred_channel: ['واتساپ', 'تماس تلفنی', 'پیامک'][idx % 3],
      skin_type: ['مختلط', 'چرب', 'خشک', 'حساس'][idx % 4],
    },
  };
});

export const services: Service[] = [
  { id: 's1', name: 'ویزیت اولیه', durationMin: 30, price: 500000 },
  { id: 's2', name: 'ویزیت کنترل', durationMin: 15, price: 250000 },
  { id: 's3', name: 'مشاوره پوست و مو', durationMin: 30, price: 650000 },
  { id: 's4', name: 'فیشیال تخصصی', durationMin: 60, price: 1450000 },
  { id: 's5', name: 'لیزر درمانی', durationMin: 45, price: 1200000 },
];

export const resources: Resource[] = [
  { id: 'r1', name: 'دکتر کشاورز', type: 'staff' },
  { id: 'r2', name: 'دکتر راد', type: 'staff' },
  { id: 'r3', name: 'اتاق ۱ (پروسیجر)', type: 'room' },
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
    status = slotInDay === 0 ? 'done' : slotInDay === 1 ? 'confirmed' : 'booked';
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

export const products: Product[] = [
  { id: 'p1', name: 'کرم مرطوب‌کننده هیالورونیک', sku: 'SK-101', price: 420000, stock: 24, active: true },
  { id: 'p2', name: 'ضدآفتاب بی‌رنگ SPF50', sku: 'SK-102', price: 580000, stock: 18, active: true },
  { id: 'p3', name: 'سرم ویتامین C تخصصی', sku: 'SK-103', price: 890000, stock: 11, active: true },
  { id: 'p4', name: 'ژل شست‌وشوی ملایم صورت', sku: 'SK-104', price: 340000, stock: 30, active: true },
  { id: 'p5', name: 'ماسک ترمیم‌کننده شب', sku: 'SK-105', price: 640000, stock: 9, active: true },
  { id: 'p6', name: 'کیت مراقبت پس از لیزر', sku: 'SK-106', price: 1150000, stock: 15, active: true },
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
    createdAt: iso(-90),
    updatedAt: iso(-10),
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
    probability: 50,
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
    createdAt: iso(-24),
    updatedAt: iso(-24),
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
  customFieldDefs,
  interactions,
  services,
  resources,
  appointments,
  orders,
  orderLogs,
  invoices,
  products,
  coupons,
  opportunities,
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
  },
});
