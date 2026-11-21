import type {
  AppState,
  CustomFieldDef,
  IndustryPack,
  PackCustomerConfig,
  PackKpiDef,
  PackMarketingConfig,
  PackOrderConfig,
  PackSalesConfig,
  PackTemplate,
} from '../types';
import { PHASE13_PACKS_A } from './packsExtendedA';
import { PHASE13_PACKS_B } from './packsExtendedB';

export const ALL_CRM_MODULE_KEYS = [
  'dashboard',
  'customers',
  'appointments',
  'orders',
  'sales',
  'workflows',
  'marketing',
  'tasks',
  'tickets',
  'nps',
  'custom_entities',
  'reports',
  'automation',
  'integrations',
  'ai_center',
  'packs',
  'settings',
] as const;

export const CRM_MODULE_LABELS: Record<string, { fa: string; en: string }> = {
  dashboard: { fa: 'داشبورد و شاخص‌ها', en: 'Dashboard' },
  customers: { fa: 'مشتریان / پرونده‌ها', en: 'Customers' },
  appointments: { fa: 'نوبت‌دهی و تقویم', en: 'Appointments' },
  orders: { fa: 'سفارش‌ها و مالی', en: 'Orders & Finance' },
  sales: { fa: 'قیف فروش و پیش‌فاکتور', en: 'Sales Pipeline' },
  workflows: { fa: 'گردش کار (BPMS)', en: 'Workflows' },
  marketing: { fa: 'بازاریابی، باشگاه و تقویم محتوا', en: 'Marketing & Loyalty' },
  tasks: { fa: 'پیگیری‌ها و وظایف', en: 'Tasks' },
  tickets: { fa: 'پشتیبانی، تیکت و SLA', en: 'Support & KB' },
  nps: { fa: 'رضایت‌سنجی (NPS/CSAT)', en: 'Surveys' },
  custom_entities: { fa: 'موجودیت‌های تخصصی', en: 'Custom Entities' },
  reports: { fa: 'گزارش‌ها و BI', en: 'Reports' },
  automation: { fa: 'موتور اتوماسیون و پیام', en: 'Automation' },
  integrations: { fa: 'یکپارچه‌سازی و VoIP', en: 'Integrations' },
  ai_center: { fa: 'دستیار هوشمند', en: 'AI Center' },
  packs: { fa: 'مدیر پک‌های صنعت', en: 'Pack Manager' },
  settings: { fa: 'تنظیمات و امنیت', en: 'Settings' },
};

export const PHASE13_TARGET_KEYS: IndustryPack[] = [
  'restaurant',
  'car_service',
  'law_accounting',
  'travel_agency',
  'pharmacy',
  'wholesale',
  'realestate',
  'gym',
  'school',
  'hotel',
];

export const DEFAULT_PACK_KPIS: PackKpiDef[] = [
  { id: 'kpi_rev', metricKey: 'revenue', label: 'درآمد کل وصولی', unit: 'toman', targetValue: 60_000_000, higherIsBetter: true },
  { id: 'kpi_cust', metricKey: 'new_customers', label: 'مشتریان جدید جذب‌شده', unit: 'count', targetValue: 20, higherIsBetter: true },
  { id: 'kpi_sla', metricKey: 'sla_compliance_pct', label: 'انطباق با SLA پشتیبانی', unit: 'pct', targetValue: 90, higherIsBetter: true },
  { id: 'kpi_nps', metricKey: 'nps_score', label: 'شاخص رضایت (NPS)', unit: 'score', targetValue: 60, higherIsBetter: true },
];

const DEFAULT_ORDER_META: PackOrderConfig = {
  channelDefault: 'website',
  statusLabels: {
    new: 'جدید',
    confirmed: 'تأییدشده',
    shipped: 'ارسال‌شده',
    delivered: 'تحویل‌شده',
    cancelled: 'لغوشده',
  },
  transitions: {
    new: ['confirmed', 'cancelled'],
    confirmed: ['shipped', 'cancelled'],
    shipped: ['delivered', 'cancelled'],
    delivered: [],
    cancelled: [],
  },
};

export const INDUSTRY_PACKS: PackTemplate[] = [
  {
    id: 'pack_clinic',
    key: 'clinic',
    name: 'کلینیک و مطب پزشکی',
    nameEn: 'Clinic & Medical',
    tier: 'full',
    description: 'پرونده مراجع، حساسیت‌ها، رضایت‌نامه تصویر، نوبت‌دهی پزشکان، ویزیت کنترل و NPS',
    descriptionEn: 'Patient file, allergies, photo consent, doctor schedule, follow-up visit & NPS',
    customerMeta: {
      singularLabel: 'مراجع / بیمار',
      pluralLabel: 'مراجعین',
      highlightFieldKey: 'skin_type',
      highlightColumnLabel: 'نیاز درمانی / پرونده',
    },
    salesMeta: {
      pipelineName: 'قیف پذیرش و طرح درمان',
      leadSingular: 'متقاضی مشاوره',
      leadPlural: 'متقاضیان مشاوره',
      dealSingular: 'طرح درمان / پکیج',
      dealPlural: 'طرح‌های درمان',
      quoteLabel: 'پیش‌فاکتور طرح درمان',
      defaultStages: [
        { key: 'lead', label: 'درخواست مشاوره', probability: 20, slaHours: 12 },
        { key: 'contacted', label: 'مشاوره اولیه', probability: 40, slaHours: 24 },
        { key: 'proposal', label: 'تدوین طرح درمان', probability: 60, slaHours: 48 },
        { key: 'negotiation', label: 'هماهنگی زمان و پرداخت', probability: 80, slaHours: 72 },
        { key: 'won', label: 'تایید و شروع درمان', probability: 100, slaHours: 0 },
        { key: 'lost', label: 'انصراف مراجع', probability: 0, slaHours: 0 },
      ],
    },
    orderMeta: {
      channelDefault: 'store',
      statusLabels: {
        new: 'ثبت نسخه / سفارش',
        confirmed: 'تأیید پذیرش',
        shipped: 'ارسال با پیک / تحویل گیشه',
        delivered: 'تحویل مراجع',
        cancelled: 'لغو پذیرش',
      },
      transitions: DEFAULT_ORDER_META.transitions,
    },
    marketingMeta: {
      showContentCalendar: true,
      contentLabel: 'تقویم محتوای کلینیک و شبکه‌های اجتماعی',
    },
    kpiDefs: [
      { id: 'cl_rev', metricKey: 'revenue', label: 'درآمد کلینیک (وصولی)', unit: 'toman', targetValue: 75_000_000, higherIsBetter: true },
      { id: 'cl_apts', metricKey: 'done_appointments', label: 'ویزیت و جلسات انجام‌شده', unit: 'count', targetValue: 35, higherIsBetter: true },
      { id: 'cl_ns', metricKey: 'no_show_rate', label: 'نرخ عدم حضور (سقف هدف)', unit: 'pct', targetValue: 10, higherIsBetter: false },
      { id: 'cl_nps', metricKey: 'nps_score', label: 'شاخص رضایت مراجعین (NPS)', unit: 'score', targetValue: 70, higherIsBetter: true },
    ],
    customFields: [
      { key: 'allergies', label: 'حساسیت‌ها و آلرژی‌ها', entity: 'customer', type: 'text', active: true, showInTable: true, order: 1 },
      { key: 'skin_type', label: 'نوع پوست / نیاز درمانی', entity: 'customer', type: 'select', options: ['مختلط', 'چرب', 'خشک', 'حساس'], active: true, showInTable: true, order: 2 },
      { key: 'consent_signed', label: 'فرم رضایت‌نامه تکمیل شده', entity: 'customer', type: 'checkbox', active: true, order: 3 },
      { key: 'consent_file', label: 'فایل رضایت‌نامه', entity: 'customer', type: 'file', active: true, order: 4 },
    ],
    customEntities: [
      {
        key: 'treatment_plan',
        name: 'طرح درمان',
        pluralName: 'طرح‌های درمان',
        description: 'ثبت جلسات و پروتکل درمانی مراجعین',
        fields: [
          { id: 'tp_1', key: 'title', label: 'عنوان پروتکل درمانی', type: 'text', required: true, order: 1 },
          { id: 'tp_2', key: 'sessions', label: 'تعداد جلسات پیشنهادی', type: 'number', order: 2 },
          { id: 'tp_3', key: 'fee', label: 'هزینه کل دوره', type: 'money', order: 3 },
        ],
      },
    ],
    services: [
      { name: 'ویزیت و مشاوره پوست و زیبایی', durationMin: 30, price: 650000, bufferBeforeMin: 5, bufferAfterMin: 10 },
      { name: 'فیشیال تخصصی', durationMin: 60, price: 1450000, bufferBeforeMin: 10, bufferAfterMin: 15 },
    ],
    products: [],
    rules: [
      {
        name: 'دعوت به ویزیت کنترل (پک کلینیک)',
        trigger: 'زمان‌بندی (بسته کلینیک)',
        condition: 'نوبت انجام‌شده > ۷۲ ساعت پیش',
        action: 'ایجاد وظیفه ویزیت کنترل + پیامک',
        active: false,
        pack: 'clinic',
        triggerType: 'schedule',
        scheduleCron: 'hourly',
        targetEntity: 'appointment',
        conditionLogic: 'AND',
        conditions: [
          { id: 'rk_cl_1', field: 'status', op: 'eq', value: 'done' },
          { id: 'rk_cl_2', field: 'end', op: 'older_than_hours', value: '72' },
        ],
        actions: [
          { id: 'ra_cl_1', type: 'create_task', taskTitleTemplate: 'دعوت به ویزیت کنترل {{customer.name}}' },
          { id: 'ra_cl_2', type: 'send_sms', channel: 'sms', messageTemplate: '{{customer.name}} عزیز، جهت بررسی نتایج درمان در {{businessName}} برای ویزیت کنترل اقدام فرمایید.' },
        ],
        cooldownMinutes: 1440,
      },
      {
        name: 'ارسال دستورالعمل مراقبت پس از درمان (واتساپ)',
        trigger: 'تغییر وضعیت نوبت به انجام‌شده',
        condition: 'وضعیت نوبت = done',
        action: 'ارسال پیام واتساپ مراقبت‌های بعدی',
        active: false,
        pack: 'clinic',
        triggerType: 'on_stage_change',
        targetEntity: 'appointment',
        conditionLogic: 'AND',
        conditions: [{ id: 'rk_cl_3', field: 'status', op: 'eq', value: 'done' }],
        actions: [
          { id: 'ra_cl_3', type: 'send_whatsapp', channel: 'whatsapp', messageTemplate: '{{customer.name}} گرامی، ضمن تشکر از مراجعه شما به {{businessName}}، راهنمای مراقبت ۲۴ ساعته برای شما ارسال شد.' },
        ],
        cooldownMinutes: 720,
      },
    ],
    workflowTemplates: [
      {
        key: 'clinic_treatment_consent',
        name: 'تأیید پرونده، رضایت‌نامه و شروع درمان کلینیک',
        description: 'چک‌لیست حساسیت و رضایت‌نامه قبل از شروع پروسیجر زیبایی/درمانی',
        type: 'custom',
        version: 1,
        status: 'draft',
        pack: 'clinic',
        slaHours: 12,
        nodes: [
          { id: 'cl_n1', type: 'start', label: 'پذیرش مراجع', role: 'staff', x: 50, y: 110 },
          { id: 'cl_n2', type: 'task', label: 'ثبت آلرژی و فرم رضایت‌نامه', role: 'staff', stepSlaHours: 2, x: 240, y: 110 },
          { id: 'cl_n3', type: 'approval', label: 'تأیید پزشک معالج', role: 'admin', stepSlaHours: 4, x: 450, y: 110 },
          { id: 'cl_n4', type: 'end', label: 'آماده شروع درمان', role: 'staff', x: 660, y: 110 },
        ],
        edges: [
          { id: 'cl_e1', fromId: 'cl_n1', toId: 'cl_n2' },
          { id: 'cl_e2', fromId: 'cl_n2', toId: 'cl_n3' },
          { id: 'cl_e3', fromId: 'cl_n3', toId: 'cl_n4' },
        ],
      },
    ],
  },
  {
    id: 'pack_shop',
    key: 'shop',
    name: 'فروشگاه آنلاین و خرده‌فروشی',
    nameEn: 'Online Store & Retail',
    tier: 'full',
    description: 'کاتالوگ کالا، کسر خودکار انبار، کد تخفیف، مرسولات جزئی، پیگیری سبد رهاشده',
    descriptionEn: 'Product catalog, auto stock deduction, coupons, partial shipments & cart recovery',
    salesMeta: {
      pipelineName: 'قیف فروش و سفارشات عمده',
      leadSingular: 'خریدار بالقوه',
      leadPlural: 'سرنخ‌های فروش',
      dealSingular: 'معامله فروش',
      dealPlural: 'معاملات فروش',
      quoteLabel: 'پیش‌فاکتور فروش',
      defaultStages: [
        { key: 'lead', label: 'سرنخ جدید', probability: 20, slaHours: 24 },
        { key: 'contacted', label: 'استعلام موجودی', probability: 35, slaHours: 24 },
        { key: 'proposal', label: 'ارسال پیش‌فاکتور', probability: 60, slaHours: 48 },
        { key: 'negotiation', label: 'توافق تخفیف و ارسال', probability: 80, slaHours: 48 },
        { key: 'won', label: 'ثبت قطعی سفارش', probability: 100, slaHours: 0 },
        { key: 'lost', label: 'لغو / عدم خرید', probability: 0, slaHours: 0 },
      ],
    },
    orderMeta: DEFAULT_ORDER_META,
    marketingMeta: {
      showContentCalendar: true,
      contentLabel: 'تقویم محتوای فروشگاه و کمپین محصول',
    },
    kpiDefs: [
      { id: 'sh_rev', metricKey: 'revenue', label: 'فروش وصول‌شده فروشگاه', unit: 'toman', targetValue: 90_000_000, higherIsBetter: true },
      { id: 'sh_ord', metricKey: 'orders_count', label: 'تعداد کل سفارش‌ها', unit: 'count', targetValue: 45, higherIsBetter: true },
      { id: 'sh_cust', metricKey: 'new_customers', label: 'خریداران جدید', unit: 'count', targetValue: 25, higherIsBetter: true },
      { id: 'sh_nps', metricKey: 'nps_score', label: 'رضایت خریداران (NPS)', unit: 'score', targetValue: 65, higherIsBetter: true },
    ],
    customFields: [
      { key: 'preferred_carrier', label: 'اولویت ارسال / شرکت حمل', entity: 'customer', type: 'select', options: ['تیپاکس', 'پست پیشتاز', 'اسنپ‌باکس'], active: true, showInTable: true, order: 1 },
      { key: 'gift_wrap', label: 'بسته‌بندی هدیه', entity: 'order', type: 'checkbox', active: true, showInTable: true, order: 2 },
    ],
    customEntities: [],
    services: [],
    products: [
      { name: 'پکیج مراقبت خانگی ویژه', sku: 'SHP-901', price: 1850000, stock: 24, minStock: 5, active: true },
    ],
    rules: [
      {
        name: 'پیگیری سفارش رهاشده (پک فروشگاه)',
        trigger: 'زمان‌بندی (هر ۵ دقیقه)',
        condition: 'سفارش جدید > ۱۲ ساعت بدون تأیید',
        action: 'ارسال پیامک یادآوری + برچسب سبد رهاشده',
        active: false,
        pack: 'shop',
        triggerType: 'schedule',
        scheduleCron: 'every_5m',
        targetEntity: 'order',
        conditionLogic: 'AND',
        conditions: [
          { id: 'rk_sh_1', field: 'status', op: 'eq', value: 'new' },
          { id: 'rk_sh_2', field: 'createdAt', op: 'older_than_hours', value: '12' },
        ],
        actions: [
          { id: 'ra_sh_1', type: 'send_sms', channel: 'sms', messageTemplate: '{{customer.name}} عزیز، سفارش شماره {{order.id}} به مبلغ {{order.total}} در {{businessName}} منتظر تکمیل شماست.' },
          { id: 'ra_sh_2', type: 'add_tag', tag: 'سبد-رهاشده' },
        ],
        cooldownMinutes: 720,
      },
      {
        name: 'اعلان ارسال مرسوله و درخواست نظر (پک فروشگاه)',
        trigger: 'تغییر وضعیت سفارش به ارسال‌شده',
        condition: 'وضعیت سفارش = shipped',
        action: 'ارسال پیامک رهگیری + وب‌هوک لجستیک',
        active: false,
        pack: 'shop',
        triggerType: 'on_stage_change',
        targetEntity: 'order',
        conditionLogic: 'AND',
        conditions: [{ id: 'rk_sh_3', field: 'status', op: 'eq', value: 'shipped' }],
        actions: [
          { id: 'ra_sh_3', type: 'send_sms', channel: 'sms', messageTemplate: '{{customer.name}} گرامی، سفارش شماره {{order.id}} از {{businessName}} ارسال شد.' },
          { id: 'ra_sh_4', type: 'call_webhook', webhookUrl: 'https://hooks.clientflow.ir/shipping-dispatch' },
        ],
      },
    ],
    workflowTemplates: [
      {
        key: 'shop_high_value_order',
        name: 'کنترل سفارش‌های با مبلغ بالا و ارسال ویژه',
        description: 'بررسی اصالت پرداخت برای سفارش‌های بالای ۱۰ میلیون تومان قبل از بسته‌بندی',
        type: 'order_fulfillment',
        version: 1,
        status: 'draft',
        pack: 'shop',
        slaHours: 16,
        nodes: [
          { id: 'sh_n1', type: 'start', label: 'ثبت سفارش فروشگاه', role: 'staff', x: 50, y: 110 },
          { id: 'sh_n2', type: 'task', label: 'تایید موجودی و آدرس', role: 'staff', stepSlaHours: 3, x: 230, y: 110 },
          { id: 'sh_n3', type: 'approval', label: 'تایید مالی سرپرست', role: 'admin', stepSlaHours: 5, x: 430, y: 110 },
          { id: 'sh_n4', type: 'end', label: 'تحویل به تیپاکس/پست', role: 'staff', x: 640, y: 110 },
        ],
        edges: [
          { id: 'sh_e1', fromId: 'sh_n1', toId: 'sh_n2' },
          { id: 'sh_e2', fromId: 'sh_n2', toId: 'sh_n3' },
          { id: 'sh_e3', fromId: 'sh_n3', toId: 'sh_n4' },
        ],
      },
    ],
  },
  {
    id: 'pack_software',
    key: 'software',
    name: 'شرکت نرم‌افزاری / IT / SaaS',
    nameEn: 'Software & IT',
    tier: 'full',
    description: 'مدیریت لایسنس، پروژه استقرار، زمان‌سنجی کارکرد، چک‌لیست استقرار و تمدید قرارداد',
    descriptionEn: 'Licenses, deployment projects, time tracking, SLA tickets & contract renewals',
    customerMeta: {
      singularLabel: 'مشتری / اکانت SaaS',
      pluralLabel: 'مشتریان سازمانی',
      highlightFieldKey: 'server_env',
      highlightColumnLabel: 'محیط استقرار',
    },
    salesMeta: {
      pipelineName: 'قیف فروش B2B و لایسنس SaaS',
      leadSingular: 'سرنخ دمو (MQL)',
      leadPlural: 'سرنخ‌های دمو',
      dealSingular: 'فرصت اشتراک / استقرار',
      dealPlural: 'فرصت‌های اشتراک و لایسنس',
      quoteLabel: 'پیشنهاد فنی و پیش‌فاکتور',
      defaultStages: [
        { key: 'lead', label: 'درخواست دمو (MQL)', probability: 15, slaHours: 12 },
        { key: 'contacted', label: 'جلسه کشف نیاز و دمو', probability: 35, slaHours: 48 },
        { key: 'proposal', label: 'ارسال پروپوزال و لایسنس', probability: 60, slaHours: 72 },
        { key: 'negotiation', label: 'بررسی SLA و قرارداد', probability: 80, slaHours: 96 },
        { key: 'won', label: 'بستن قرارداد و استقرار', probability: 100, slaHours: 0 },
        { key: 'lost', label: 'عدم تمدید / ازدست‌رفته', probability: 0, slaHours: 0 },
      ],
    },
    orderMeta: {
      channelDefault: 'website',
      statusLabels: {
        new: 'درخواست لایسنس',
        confirmed: 'تأیید مالی و صدور کلید',
        shipped: 'ارسال دسترسی / پکیج',
        delivered: 'فعال و تحویل‌شده',
        cancelled: 'لغوشده',
      },
      transitions: DEFAULT_ORDER_META.transitions,
    },
    kpiDefs: [
      { id: 'sw_won', metricKey: 'won_deals_revenue', label: 'ارزش قراردادهای لایسنس قطعی', unit: 'toman', targetValue: 120_000_000, higherIsBetter: true },
      { id: 'sw_pipe', metricKey: 'active_pipeline_value', label: 'ارزش قیف فروش SaaS فعال', unit: 'toman', targetValue: 200_000_000, higherIsBetter: true },
      { id: 'sw_sla', metricKey: 'sla_compliance_pct', label: 'انطباق SLA پشتیبانی فنی', unit: 'pct', targetValue: 95, higherIsBetter: true },
      { id: 'sw_nps', metricKey: 'nps_score', label: 'رضایت مشتریان SaaS (NPS)', unit: 'score', targetValue: 65, higherIsBetter: true },
    ],
    customFields: [
      { key: 'license_key', label: 'کلید لایسنس', entity: 'customer', type: 'text', unique: true, active: true, showInTable: true, order: 1 },
      { key: 'server_env', label: 'اطلاعات سرور / محیط استقرار', entity: 'customer', type: 'select', options: ['ابری (Cloud)', 'سرور داخلی (On-Premise)'], active: true, showInTable: true, order: 2 },
      { key: 'server_info', label: 'آدرس سرور / دامنه', entity: 'customer', type: 'text', active: true, order: 3 },
      { key: 'users_seat', label: 'تعداد کاربران لایسنس', entity: 'customer', type: 'number', active: true, order: 4 },
    ],
    customEntities: [],
    services: [
      { name: 'جلسه تحلیل و دمو نرم‌افزار', durationMin: 45, price: 0, bufferBeforeMin: 10, bufferAfterMin: 10 },
    ],
    products: [
      { name: 'لایسنس سالانه نسخه سازمانی', sku: 'LIC-ENT', price: 24000000, stock: 99, minStock: 5, active: true },
    ],
    rules: [
      {
        name: 'هشدار تمدید قرارداد و لایسنس (پک نرم‌افزار)',
        trigger: 'زمان‌بندی (ساعتی)',
        condition: 'انقضای قرارداد <= now+7d',
        action: 'ایجاد وظیفه تمدید + ارسال ایمیل یادآوری',
        active: false,
        pack: 'software',
        triggerType: 'schedule',
        scheduleCron: 'hourly',
        targetEntity: 'customer',
        conditionLogic: 'AND',
        conditions: [
          { id: 'rk_sw_1', field: 'contractExpiresAt', op: 'lte', value: 'now+7d' },
          { id: 'rk_sw_2', field: 'contractExpiresAt', op: 'gte', value: 'now' },
        ],
        actions: [
          { id: 'ra_sw_1', type: 'create_task', taskTitleTemplate: 'تماس تمدید لایسنس {{customer.name}}' },
          { id: 'ra_sw_2', type: 'send_email', channel: 'email', messageTemplate: '{{customer.name}} گرامی، اعتبار اشتراک نرم‌افزاری شما در {{businessName}} طی ۷ روز آینده به پایان می‌رسد.' },
        ],
        cooldownMinutes: 4320,
      },
      {
        name: 'تخصیص خودکار تیکت بحرانی به تیم فنی',
        trigger: 'در لحظه ثبت تیکت پشتیبانی',
        condition: 'اولویت = high',
        action: 'تخصیص کارشناس استقرار + وب‌هوک تیم فنی',
        active: false,
        pack: 'software',
        triggerType: 'on_ticket_create',
        targetEntity: 'ticket',
        conditionLogic: 'AND',
        conditions: [{ id: 'rk_sw_3', field: 'priority', op: 'eq', value: 'high' }],
        actions: [
          { id: 'ra_sw_3', type: 'assign_owner', ownerName: 'علی (استقرار)' },
          { id: 'ra_sw_4', type: 'call_webhook', webhookUrl: 'https://hooks.clientflow.ir/devops-pager' },
        ],
      },
    ],
    workflowTemplates: [
      {
        key: 'software_onboarding_rollout',
        name: 'استقرار نرم‌افزار و صدور لایسنس مشتری',
        description: 'مراحل نصب، تست امنیت، آموزش تیم کارفرما و تحویل کلید لایسنس',
        type: 'custom',
        version: 1,
        status: 'draft',
        pack: 'software',
        slaHours: 48,
        nodes: [
          { id: 'sw_n1', type: 'start', label: 'عقد قرارداد لایسنس', role: 'staff', x: 40, y: 110 },
          { id: 'sw_n2', type: 'task', label: 'کانفیگ سرور و محیط SaaS', role: 'staff', assigneeType: 'user', assigneeUser: 'علی (استقرار)', stepSlaHours: 16, x: 220, y: 110 },
          { id: 'sw_n3', type: 'approval', label: 'تایید UAT و صدور کلید نهایی', role: 'admin', stepSlaHours: 12, x: 440, y: 110 },
          { id: 'sw_n4', type: 'end', label: 'تحویل لایسنس فعال', role: 'staff', x: 650, y: 110 },
        ],
        edges: [
          { id: 'sw_e1', fromId: 'sw_n1', toId: 'sw_n2' },
          { id: 'sw_e2', fromId: 'sw_n2', toId: 'sw_n3' },
          { id: 'sw_e3', fromId: 'sw_n3', toId: 'sw_n4' },
        ],
      },
    ],
  },
  {
    id: 'pack_b2b',
    key: 'b2b',
    name: 'خدمات B2B، پیمانکاری و فروش عمده',
    nameEn: 'B2B Services & Wholesale',
    tier: 'medium',
    description: 'شخصیت حقوقی، چند مخاطب، پیش‌فاکتور نسخه‌دار، چک صیادی، پیگیری مناقصه و قرارداد',
    descriptionEn: 'Corporate entities, multi-contacts, versioned quotes, Sayadi cheques & contracts',
    salesMeta: {
      pipelineName: 'قیف مناقصات و فروش سازمانی',
      leadSingular: 'متقاضی همکاری B2B',
      leadPlural: 'سرنخ‌های سازمانی',
      dealSingular: 'پرونده فروش / قرارداد',
      dealPlural: 'پرونده‌های فروش B2B',
      quoteLabel: 'پیش‌فاکتور رسمی حقوقی',
      defaultStages: [
        { key: 'lead', label: 'استعلام اولیه', probability: 20, slaHours: 24 },
        { key: 'contacted', label: 'مذاکره فنی و اعتباری', probability: 40, slaHours: 48 },
        { key: 'proposal', label: 'ارسال پیش‌فاکتور رسمی', probability: 60, slaHours: 72 },
        { key: 'negotiation', label: 'تنظیم قرارداد و چک', probability: 80, slaHours: 96 },
        { key: 'won', label: 'امضای قرارداد', probability: 100, slaHours: 0 },
        { key: 'lost', label: 'لغو مناقصه', probability: 0, slaHours: 0 },
      ],
    },
    kpiDefs: [
      { id: 'b2b_won', metricKey: 'won_deals_revenue', label: 'فروش قراردادهای B2B', unit: 'toman', targetValue: 180_000_000, higherIsBetter: true },
      { id: 'b2b_pipe', metricKey: 'active_pipeline_value', label: 'ارزش پرونده‌های در حال مذاکره', unit: 'toman', targetValue: 250_000_000, higherIsBetter: true },
      { id: 'b2b_rec', metricKey: 'open_receivables', label: 'سقف مجاز مطالبات باز', unit: 'toman', targetValue: 40_000_000, higherIsBetter: false },
      { id: 'b2b_sla', metricKey: 'sla_compliance_pct', label: 'انطباق پاسخگویی حقوقی', unit: 'pct', targetValue: 92, higherIsBetter: true },
    ],
    customFields: [
      { key: 'credit_limit', label: 'سقف اعتبار خرید چکی (تومان)', entity: 'customer', type: 'money', active: true, showInTable: true, order: 1 },
      { key: 'industry_sector', label: 'حوزه فعالیت شرکت', entity: 'customer', type: 'select', options: ['تولیدی', 'بازرگانی', 'پیمانکاری', 'خدمات'], active: true, order: 2 },
    ],
    customEntities: [
      {
        key: 'b2b_contract',
        name: 'قرارداد B2B',
        pluralName: 'قراردادهای B2B',
        description: 'پیگیری مفاد قراردادها و تاریخ سررسید اقساط حقوقی',
        fields: [
          { id: 'b2b_1', key: 'contract_title', label: 'موضوع قرارداد', type: 'text', required: true, order: 1 },
          { id: 'b2b_2', key: 'contract_value', label: 'ارزش کل قرارداد (تومان)', type: 'money', order: 2 },
          { id: 'b2b_3', key: 'end_date', label: 'تاریخ پایان قرارداد', type: 'date', order: 3 },
        ],
      },
    ],
    services: [
      { name: 'جلسه مذاکره و بررسی فنی پروژه B2B', durationMin: 60, price: 0, bufferBeforeMin: 15, bufferAfterMin: 15 },
    ],
    products: [],
    rules: [
      {
        name: 'پیگیری پیش‌فاکتورهای ارسال‌شده B2B',
        trigger: 'رویداد تغییر مرحله معامله',
        condition: 'مرحله = ارسال پیشنهاد',
        action: 'ثبت وظیفه پیگیری تماس تلفنی',
        active: false,
        pack: 'b2b',
        triggerType: 'on_stage_change',
        targetEntity: 'opportunity',
        conditionLogic: 'AND',
        conditions: [{ id: 'rc_b2b1', field: 'stage', op: 'eq', value: 'proposal' }],
        actions: [
          { id: 'ra_b2b1', type: 'create_task', taskTitleTemplate: 'پیگیری پیشنهاد قیمت {{customer.name}} ظرف ۴۸ ساعت' },
          { id: 'ra_b2b2', type: 'send_email', channel: 'email', messageTemplate: '{{customer.name}} گرامی، پیش‌فاکتور رسمی مناقصه توسط {{businessName}} ارسال شد.' },
        ],
      },
    ],
    workflowTemplates: [
      {
        key: 'b2b_credit_check_flow',
        name: 'تأیید اعتبار چکی و قرارداد حقوقی B2B',
        description: 'بررسی سقف اعتبار چک صیادی و تأیید نهایی مدیریت برای فروش عمده',
        type: 'custom',
        version: 1,
        status: 'draft',
        pack: 'b2b',
        slaHours: 36,
        nodes: [
          { id: 'b2_n1', type: 'start', label: 'درخواست خرید چکی', role: 'staff', x: 50, y: 110 },
          { id: 'b2_n2', type: 'task', label: 'استعلام حساب و اعتبار صیادی', role: 'staff', stepSlaHours: 8, x: 240, y: 110 },
          { id: 'b2_n3', type: 'approval', label: 'تایید مدیر مالی و مدیرعامل', role: 'admin', stepSlaHours: 16, x: 450, y: 110 },
          { id: 'b2_n4', type: 'end', label: 'صدور قرارداد و فاکتور رسمی', role: 'staff', x: 660, y: 110 },
        ],
        edges: [
          { id: 'b2_e1', fromId: 'b2_n1', toId: 'b2_n2' },
          { id: 'b2_e2', fromId: 'b2_n2', toId: 'b2_n3' },
          { id: 'b2_e3', fromId: 'b2_n3', toId: 'b2_n4' },
        ],
      },
    ],
  },
  {
    id: 'pack_education',
    key: 'education',
    name: 'آموزشگاه و آکادمی آموزشی',
    nameEn: 'Education & Academy',
    tier: 'light',
    description: 'دانشجو/فراگیر، ثبت‌نام دوره، تقویم کلاس‌ها، حضور و غیاب و تمدید ترم بعدی',
    descriptionEn: 'Students, courses, class schedule, attendance tracking & term renewals',
    kpiDefs: [
      { id: 'ed_rev', metricKey: 'revenue', label: 'شهریه وصول‌شده آموزشگاه', unit: 'toman', targetValue: 55_000_000, higherIsBetter: true },
      { id: 'ed_cust', metricKey: 'new_customers', label: 'فراگیران جدید ثبت‌نامی', unit: 'count', targetValue: 30, higherIsBetter: true },
      { id: 'ed_apts', metricKey: 'done_appointments', label: 'جلسات تعیین سطح / کلاس', unit: 'count', targetValue: 25, higherIsBetter: true },
      { id: 'ed_nps', metricKey: 'nps_score', label: 'رضایت فراگیران (NPS)', unit: 'score', targetValue: 70, higherIsBetter: true },
    ],
    salesMeta: {
      pipelineName: 'قیف جذب و ثبت‌نام فراگیران',
      leadSingular: 'متقاضی دوره',
      leadPlural: 'متقاضیان ثبت‌نام',
      dealSingular: 'پرونده ثبت‌نام',
      dealPlural: 'پرونده‌های ثبت‌نام',
      quoteLabel: 'پیش‌فاکتور شهریه دوره',
      defaultStages: [
        { key: 'lead', label: 'استعلام دوره', probability: 25, slaHours: 12 },
        { key: 'contacted', label: 'مشاوره و تعیین سطح', probability: 45, slaHours: 24 },
        { key: 'proposal', label: 'اعلام شهریه و تخفیف', probability: 65, slaHours: 48 },
        { key: 'negotiation', label: 'تایید قسط / ثبت‌نام', probability: 85, slaHours: 48 },
        { key: 'won', label: 'ثبت‌نام قطعی', probability: 100, slaHours: 0 },
        { key: 'lost', label: 'انصراف از دوره', probability: 0, slaHours: 0 },
      ],
    },
    customFields: [
      { key: 'education_level', label: 'سطح دوره آموزشی', entity: 'customer', type: 'select', options: ['مقدماتی', 'متوسط', 'پیشرفته', 'آزمون'], active: true, showInTable: true, order: 1 },
      { key: 'parent_phone', label: 'شماره تماس ولی / سرپرست', entity: 'customer', type: 'phone', active: true, order: 2 },
    ],
    customEntities: [
      {
        key: 'course_enrollment',
        name: 'ثبت‌نام دوره',
        pluralName: 'ثبت‌نام دوره‌ها',
        description: 'مدیریت دوره‌ها، شهریه و وضعیت قبولی فراگیران',
        fields: [
          { id: 'edu_1', key: 'course_name', label: 'نام دوره / کلاس', type: 'text', required: true, order: 1 },
          { id: 'edu_2', key: 'tuition', label: 'شهریه دوره', type: 'money', order: 2 },
          { id: 'edu_3', key: 'start_date', label: 'تاریخ شروع کلاس', type: 'date', order: 3 },
        ],
      },
    ],
    services: [
      { name: 'آزمون تعیین سطح و مشاوره ثبت‌نام', durationMin: 30, price: 250000, bufferBeforeMin: 5, bufferAfterMin: 5 },
      { name: 'کلاس خصوصی ۶۰ دقیقه‌ای', durationMin: 60, price: 950000, bufferBeforeMin: 10, bufferAfterMin: 10 },
    ],
    products: [
      { name: 'پکیج کتاب و جزوه ترم', sku: 'EDU-BK1', price: 380000, stock: 45, minStock: 10, active: true },
    ],
    rules: [
      {
        name: 'یادآوری تعیین سطح دانشجوی جدید آموزشگاه',
        trigger: 'رویداد ثبت دانشجوی جدید',
        condition: 'چرخه عمر = سرنخ',
        action: 'ارسال پیامک معرفی برنامه کلاسی + وظیفه تماس',
        active: false,
        pack: 'education',
        triggerType: 'on_create',
        targetEntity: 'customer',
        conditionLogic: 'AND',
        conditions: [{ id: 'rc_edu1', field: 'lifecycle', op: 'eq', value: 'lead' }],
        actions: [
          { id: 'ra_edu1', type: 'send_sms', channel: 'sms', messageTemplate: 'سلام {{customer.name}} عزیز، جهت تکمیل تعیین سطح در {{businessName}} با شما تماس می‌گیریم.' },
          { id: 'ra_edu2', type: 'create_task', taskTitleTemplate: 'زمان‌بندی آزمون تعیین سطح برای {{customer.name}}' },
        ],
      },
    ],
    workflowTemplates: [
      {
        key: 'edu_placement_enroll',
        name: 'فرایند تعیین سطح تا ثبت‌نام قطعی فراگیر',
        description: 'تعیین سطح علمی، اعلام شهریه و تأیید ظرفیت کلاس',
        type: 'custom',
        version: 1,
        status: 'draft',
        pack: 'education',
        slaHours: 24,
        nodes: [
          { id: 'ed_n1', type: 'start', label: 'درخواست ثبت‌نام', role: 'staff', x: 50, y: 110 },
          { id: 'ed_n2', type: 'task', label: 'برگزاری آزمون تعیین سطح', role: 'staff', stepSlaHours: 6, x: 240, y: 110 },
          { id: 'ed_n3', type: 'approval', label: 'تایید ظرفیت و تخفیف شهریه', role: 'admin', stepSlaHours: 12, x: 450, y: 110 },
          { id: 'ed_n4', type: 'end', label: 'صدور کارت دانشجویی', role: 'staff', x: 660, y: 110 },
        ],
        edges: [
          { id: 'ed_e1', fromId: 'ed_n1', toId: 'ed_n2' },
          { id: 'ed_e2', fromId: 'ed_n2', toId: 'ed_n3' },
          { id: 'ed_e3', fromId: 'ed_n3', toId: 'ed_n4' },
        ],
      },
    ],
  },
  {
    id: 'pack_salon',
    key: 'salon',
    name: 'آرایشگاه، سالن زیبایی و مراقبت',
    nameEn: 'Beauty Salon & Spa',
    tier: 'light',
    category: 'services',
    description: 'عضویت و اشتراک، رزرو آرایشگر/متخصص، یادآور ۲ ساعته نوبت و تبریک خودکار تولد',
    descriptionEn: 'Memberships, stylist booking, 2h reminders & automated birthday perks',
    enabledModules: [
      'dashboard',
      'customers',
      'appointments',
      'orders',
      'sales',
      'workflows',
      'marketing',
      'tasks',
      'tickets',
      'nps',
      'reports',
      'automation',
      'packs',
      'settings',
    ],
    salesMeta: {
      pipelineName: 'قیف عضویت و پکیج خدمات زیبایی',
      leadSingular: 'متقاضی خدمات سالن',
      leadPlural: 'متقاضیان خدمات',
      dealSingular: 'پکیج / اشتراک',
      dealPlural: 'پکیج‌های زیبایی',
      quoteLabel: 'پیش‌فاکتور پکیج خدمات',
      defaultStages: [
        { key: 'lead', label: 'استعلام پکیج', probability: 25, slaHours: 12 },
        { key: 'contacted', label: 'مشاوره و معرفی خدمات', probability: 45, slaHours: 24 },
        { key: 'proposal', label: 'پیشنهاد بسته VIP', probability: 65, slaHours: 48 },
        { key: 'negotiation', label: 'هماهنگی زمان‌بندی', probability: 85, slaHours: 48 },
        { key: 'won', label: 'عضویت فعال‌شده', probability: 100, slaHours: 0 },
        { key: 'lost', label: 'لغو درخواست', probability: 0, slaHours: 0 },
      ],
    },
    marketingMeta: {
      showContentCalendar: true,
      contentLabel: 'تقویم محتوای اینستاگرام و نمونه‌کار',
    },
    kpiDefs: [
      { id: 'sl_rev', metricKey: 'revenue', label: 'درآمد سالن و مراقبت زیبایی', unit: 'toman', targetValue: 65_000_000, higherIsBetter: true },
      { id: 'sl_apts', metricKey: 'done_appointments', label: 'جلسات و نوبت‌های انجام‌شده', unit: 'count', targetValue: 40, higherIsBetter: true },
      { id: 'sl_ns', metricKey: 'no_show_rate', label: 'نرخ کنسلی/عدم حضور', unit: 'pct', targetValue: 8, higherIsBetter: false },
      { id: 'sl_nps', metricKey: 'nps_score', label: 'رضایت مشتریان (NPS)', unit: 'score', targetValue: 75, higherIsBetter: true },
    ],
    customFields: [
      { key: 'preferred_stylist', label: 'متخصص / آرایشگر دلخواه', entity: 'customer', type: 'text', active: true, showInTable: true, order: 1 },
      { key: 'membership_tier', label: 'سطح عضویت VIP سالن', entity: 'customer', type: 'select', options: ['برنزی', 'نقره‌ای', 'طلایی VIP'], active: true, order: 2 },
    ],
    customEntities: [],
    services: [
      { name: 'پکیج رنگ و مراقبت مو', durationMin: 90, price: 2200000, bufferBeforeMin: 10, bufferAfterMin: 15 },
      { name: 'میکاپ و استایلینگ تخصصی', durationMin: 75, price: 3500000, bufferBeforeMin: 10, bufferAfterMin: 15 },
    ],
    products: [
      { name: 'ماسک مو کراتینه حرفه‌ای', sku: 'SLN-201', price: 920000, stock: 18, minStock: 4, active: true },
    ],
    rules: [
      {
        name: 'یادآوری ۲ ساعته نوبت سالن زیبایی',
        trigger: 'زمان‌بندی (بسته سالن)',
        condition: 'زمان نوبت تا ۲ ساعت آینده (now+2h)',
        action: 'ارسال پیامک/واتساپ یادآور با زمان شمسی',
        active: false,
        pack: 'salon',
        triggerType: 'schedule',
        scheduleCron: 'every_5m',
        targetEntity: 'appointment',
        conditionLogic: 'AND',
        conditions: [
          { id: 'rk_sl_1', field: 'status', op: 'eq', value: 'confirmed' },
          { id: 'rk_sl_2', field: 'start', op: 'within_next_hours', value: '2' },
        ],
        actions: [
          { id: 'ra_sl_1', type: 'send_whatsapp', channel: 'whatsapp', messageTemplate: '{{customer.name}} عزیز، نوبت «{{appointment.service}}» شما ساعت {{appointment.hour}} در {{businessName}} آماده است.' },
        ],
        cooldownMinutes: 180,
      },
    ],
    workflowTemplates: [
      {
        key: 'salon_vip_package_freeze',
        name: 'درخواست تعلیق یا تمدید پکیج سالن زیبایی',
        description: 'ثبت درخواست تغییر زمان پکیج و تایید مدیریت سالن',
        type: 'custom',
        version: 1,
        status: 'draft',
        pack: 'salon',
        slaHours: 12,
        nodes: [
          { id: 'sl_n1', type: 'start', label: 'درخواست تغییر زمان پکیج', role: 'staff', x: 50, y: 110 },
          { id: 'sl_n2', type: 'task', label: 'بررسی تعداد جلسات باقی‌مانده', role: 'staff', stepSlaHours: 4, x: 250, y: 110 },
          { id: 'sl_n3', type: 'approval', label: 'تأیید مدیریت سالن', role: 'admin', stepSlaHours: 6, x: 460, y: 110 },
          { id: 'sl_n4', type: 'end', label: 'به‌روزرسانی تاریخ اعتبار', role: 'staff', x: 660, y: 110 },
        ],
        edges: [
          { id: 'sl_e1', fromId: 'sl_n1', toId: 'sl_n2' },
          { id: 'sl_e2', fromId: 'sl_n2', toId: 'sl_n3' },
          { id: 'sl_e3', fromId: 'sl_n3', toId: 'sl_n4' },
        ],
      },
    ],
  },
  ...PHASE13_PACKS_A,
  ...PHASE13_PACKS_B,
  {
    id: 'pack_freelancer',
    key: 'freelancer',
    name: 'فریلنسر، مشاور و استودیو طراحی',
    nameEn: 'Freelancer & Studio',
    tier: 'light',
    description: 'مدیریت کارفرمایان، زمان‌سنجی پروژه، پیش‌فاکتور، پیگیری پرداخت و نمای ساده Solo',
    descriptionEn: 'Clients, project milestones, time tracking, invoices & Solo workspace',
    kpiDefs: [
      { id: 'fr_rev', metricKey: 'revenue', label: 'درآمد وصول‌شده پروژه‌ها', unit: 'toman', targetValue: 45_000_000, higherIsBetter: true },
      { id: 'fr_won', metricKey: 'won_deals_revenue', label: 'قراردادهای پروژه‌ای منعقدشده', unit: 'toman', targetValue: 60_000_000, higherIsBetter: true },
      { id: 'fr_rec', metricKey: 'open_receivables', label: 'سقف مطالبات تسویه‌نشده', unit: 'toman', targetValue: 15_000_000, higherIsBetter: false },
      { id: 'fr_nps', metricKey: 'nps_score', label: 'رضایت کارفرمایان (NPS)', unit: 'score', targetValue: 75, higherIsBetter: true },
    ],
    salesMeta: {
      pipelineName: 'قیف پروژه‌ها و مشاوره',
      leadSingular: 'کارفرمای بالقوه',
      leadPlural: 'سرنخ‌های پروژه',
      dealSingular: 'پروپوزال پروژه',
      dealPlural: 'پروپوزال‌ها',
      quoteLabel: 'پروپوزال و پیش‌فاکتور',
      defaultStages: [
        { key: 'lead', label: 'دریافت بریف', probability: 20, slaHours: 24 },
        { key: 'contacted', label: 'جلسه کشف نیاز', probability: 40, slaHours: 48 },
        { key: 'proposal', label: 'ارسال پروپوزال و زمان‌بندی', probability: 60, slaHours: 72 },
        { key: 'negotiation', label: 'توافق مایلستون و مبلغ', probability: 80, slaHours: 72 },
        { key: 'won', label: 'شروع پروژه', probability: 100, slaHours: 0 },
        { key: 'lost', label: 'رد پروپوزال', probability: 0, slaHours: 0 },
      ],
    },
    customFields: [
      { key: 'hourly_rate', label: 'نرخ ساعتی توافقی (تومان)', entity: 'customer', type: 'money', active: true, showInTable: true, order: 1 },
    ],
    customEntities: [],
    services: [
      { name: 'جلسه بریف و نیازسنجی پروژه', durationMin: 45, price: 450000, bufferBeforeMin: 5, bufferAfterMin: 10 },
    ],
    products: [],
    rules: [
      {
        name: 'پیگیری مایلستون و فاکتور باز فریلنسر',
        trigger: 'تغییر مرحله پروژه به پیشنهاد',
        condition: 'مرحله = proposal',
        action: 'ثبت وظیفه یادآوری پیگیری پیش‌فاکتور',
        active: false,
        pack: 'freelancer',
        triggerType: 'on_stage_change',
        targetEntity: 'opportunity',
        conditionLogic: 'AND',
        conditions: [{ id: 'rk_fr_1', field: 'stage', op: 'eq', value: 'proposal' }],
        actions: [
          { id: 'ra_fr_1', type: 'create_task', taskTitleTemplate: 'پیگیری تایید پروپوزال و پیش‌پرداخت {{customer.name}}' },
        ],
      },
    ],
    workflowTemplates: [
      {
        key: 'freelancer_milestone_signoff',
        name: 'تحویل فاز پروژه و تسویه مایلستون',
        description: 'ارسال دمو برای کارفرما، تایید نهایی و صدور فاکتور تسویه',
        type: 'custom',
        version: 1,
        status: 'draft',
        pack: 'freelancer',
        slaHours: 48,
        nodes: [
          { id: 'fr_n1', type: 'start', label: 'تکمیل فاز پروژه', role: 'staff', x: 50, y: 110 },
          { id: 'fr_n2', type: 'task', label: 'ارسال لینک پیش‌نمایش به کارفرما', role: 'staff', stepSlaHours: 6, x: 240, y: 110 },
          { id: 'fr_n3', type: 'wait', label: 'انتظار ۴۸ ساعته بازبینی کارفرما', role: 'staff', timerHours: 48, stepSlaHours: 48, x: 450, y: 110 },
          { id: 'fr_n4', type: 'end', label: 'صدور فاکتور نهایی', role: 'staff', x: 660, y: 110 },
        ],
        edges: [
          { id: 'fr_e1', fromId: 'fr_n1', toId: 'fr_n2' },
          { id: 'fr_e2', fromId: 'fr_n2', toId: 'fr_n3' },
          { id: 'fr_e3', fromId: 'fr_n3', toId: 'fr_n4' },
        ],
      },
    ],
  },
  {
    id: 'pack_general',
    key: 'general',
    name: 'عمومی (پیکربندی استاندارد)',
    nameEn: 'General Standard',
    tier: 'light',
    description: 'پیکربندی متعادل برای کسب‌وکارهای عمومی بدون فیلدهای تخصصی صنعتی',
    descriptionEn: 'Balanced standard setup suitable for general service businesses',
    kpiDefs: DEFAULT_PACK_KPIS,
    salesMeta: {
      pipelineName: 'قیف فروش اصلی',
      leadSingular: 'سرنخ فروش',
      leadPlural: 'سرنخ‌های فروش',
      dealSingular: 'فرصت فروش',
      dealPlural: 'فرصت‌های فروش',
      quoteLabel: 'پیش‌فاکتور رسمی',
      defaultStages: [
        { key: 'lead', label: 'سرنخ جدید', probability: 20, slaHours: 24 },
        { key: 'contacted', label: 'تماس اولیه', probability: 35, slaHours: 48 },
        { key: 'proposal', label: 'ارسال پیش‌فاکتور', probability: 55, slaHours: 72 },
        { key: 'negotiation', label: 'مذاکره', probability: 75, slaHours: 96 },
        { key: 'won', label: 'برنده‌شده', probability: 100, slaHours: 0 },
        { key: 'lost', label: 'ازدست‌رفته', probability: 0, slaHours: 0 },
      ],
    },
    customFields: [],
    customEntities: [],
    services: [],
    products: [],
    rules: [
      {
        name: 'ایجاد تیکت پیگیری برای مشتریان ناراضی/ریزش‌یافته',
        trigger: 'رویداد تغییر وضعیت مشتری',
        condition: 'چرخه عمر = churned',
        action: 'ثبت وظیفه بازگشت مشتری + تیکت پیگیری',
        active: false,
        pack: 'general',
        triggerType: 'on_stage_change',
        targetEntity: 'customer',
        conditionLogic: 'AND',
        conditions: [{ id: 'rk_gn_1', field: 'lifecycle', op: 'eq', value: 'churned' }],
        actions: [
          { id: 'ra_gn_1', type: 'create_task', taskTitleTemplate: 'تماس بازگشت مشتری ریزش‌شده: {{customer.name}}' },
          { id: 'ra_gn_2', type: 'create_ticket', ticketSubjectTemplate: 'پیگیری دلیل ریزش {{customer.name}}', ticketPriority: 'normal' },
        ],
      },
    ],
    workflowTemplates: [
      {
        key: 'general_standard_approval',
        name: 'فرآیند استاندارد تاییدیه دو مرحله‌ای',
        description: 'ثبت درخواست توسط کارشناس و تاییدیه نهایی مدیر',
        type: 'custom',
        version: 1,
        status: 'draft',
        pack: 'general',
        slaHours: 24,
        nodes: [
          { id: 'gn_n1', type: 'start', label: 'ثبت درخواست', role: 'staff', x: 50, y: 110 },
          { id: 'gn_n2', type: 'task', label: 'تکمیل اطلاعات کارشناس', role: 'staff', stepSlaHours: 4, x: 250, y: 110 },
          { id: 'gn_n3', type: 'approval', label: 'تایید مدیر واحد', role: 'admin', stepSlaHours: 12, x: 460, y: 110 },
          { id: 'gn_n4', type: 'end', label: 'پایان و بایگانی', role: 'staff', x: 660, y: 110 },
        ],
        edges: [
          { id: 'gn_e1', fromId: 'gn_n1', toId: 'gn_n2' },
          { id: 'gn_e2', fromId: 'gn_n2', toId: 'gn_n3' },
          { id: 'gn_e3', fromId: 'gn_n3', toId: 'gn_n4' },
        ],
      },
    ],
  },
];

export function buildPackFromState(
  state: AppState,
  meta: { key: string; name: string; nameEn?: string; description: string; tier?: PackTemplate['tier'] },
): PackTemplate {
  const curKey = state.settings.industryPack;
  const basePack =
    INDUSTRY_PACKS.find((p) => p.key === curKey) ??
    state.customPacks.find((p) => p.key === curKey);
  const currentKpis = getPackKpiDefs(curKey, state.customPacks).map((k) => ({
    ...k,
    targetValue: state.settings.kpiTargets?.[k.id] ?? k.targetValue,
  }));
  const currentSales = getPackSalesConfig(curKey, state.customPacks);

  return {
    id: `pack_custom_${Date.now()}`,
    key: meta.key.trim().replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase() || `custom_${Date.now().toString(36)}`,
    name: meta.name.trim() || 'بسته سفارشی',
    nameEn: meta.nameEn?.trim() || 'Custom Pack',
    tier: meta.tier ?? 'medium',
    category: basePack?.category ?? 'services',
    description: meta.description.trim() || 'ساخته‌شده از پیکربندی فعلی Tenant در Pack Manager',
    descriptionEn: 'Exported from current Tenant configuration',
    enabledModules: state.settings.enabledModules ?? basePack?.enabledModules ?? [...ALL_CRM_MODULE_KEYS],
    customerMeta: basePack?.customerMeta ?? getPackCustomerConfig(curKey, state.customFieldDefs, state.customPacks),
    salesMeta: {
      ...currentSales,
      defaultStages: state.pipelineStages.length > 0 ? state.pipelineStages : currentSales.defaultStages,
    },
    orderMeta: basePack?.orderMeta ?? DEFAULT_ORDER_META,
    marketingMeta: basePack?.marketingMeta ?? { showContentCalendar: true },
    kpiDefs: currentKpis,
    customFields: state.customFieldDefs.map(({ id: _id, ...rest }) => rest),
    customEntities: state.customEntityDefs.map(({ id: _id, createdAt: _ca, ...rest }) => rest),
    services: state.services.map(({ id: _id, ...rest }) => rest),
    products: state.products.map(({ id: _id, ...rest }) => rest),
    rules: state.rules.map(({ id: _id, ...rest }) => rest),
    workflowTemplates: state.workflowDefinitions.map(({ id: _id, updatedAt: _ua, ...rest }) => rest),
    messageTemplates: (state.messageTemplates ?? []).map(({ id: _id, updatedAt: _ua, ...rest }) => rest),
    defaultReports: (state.savedReports ?? []).map(({ id: _id, createdAt: _ca, updatedAt: _ua, ...rest }) => rest),
    sampleData: {
      customers: state.customers
        .filter((c) => !c.isDeleted)
        .slice(0, 3)
        .map((c) => ({
          name: c.name,
          phone: c.phone,
          personType: c.personType,
          companyName: c.companyName,
          lifecycle: c.lifecycle,
          source: c.source,
          tags: c.tags,
          customFields: c.customFields,
        })),
    },
    exportedAt: new Date().toISOString(),
    isCustom: true,
  };
}

export function findPackByKey(
  packKey: IndustryPack | string,
  customPacks?: PackTemplate[],
): PackTemplate | undefined {
  return (
    INDUSTRY_PACKS.find((p) => p.key === packKey) ??
    customPacks?.find((p) => p.key === packKey)
  );
}

export function getPackCustomerConfig(
  packKey: IndustryPack,
  customFieldDefs: CustomFieldDef[],
  customPacks?: PackTemplate[],
): PackCustomerConfig {
  const pack = findPackByKey(packKey, customPacks);
  if (pack?.customerMeta) return pack.customerMeta;
  const firstField = customFieldDefs
    .filter((f) => (f.entity ?? 'customer') === 'customer' && f.active !== false)
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99))[0];
  return {
    singularLabel: 'مشتری',
    pluralLabel: 'مشتریان',
    highlightFieldKey: firstField?.key,
    highlightColumnLabel: firstField?.label,
  };
}

export function getPackSalesConfig(
  packKey: IndustryPack,
  customPacks?: PackTemplate[],
): PackSalesConfig {
  const pack = findPackByKey(packKey, customPacks);
  if (pack?.salesMeta) return pack.salesMeta;
  const generalPack = INDUSTRY_PACKS.find((p) => p.key === 'general')!;
  return generalPack.salesMeta!;
}

export function getPackOrderConfig(
  packKey: IndustryPack,
  customPacks?: PackTemplate[],
): PackOrderConfig {
  const pack = findPackByKey(packKey, customPacks);
  return pack?.orderMeta ?? DEFAULT_ORDER_META;
}

export function getPackMarketingConfig(
  packKey: IndustryPack,
  customPacks?: PackTemplate[],
): PackMarketingConfig {
  const pack = findPackByKey(packKey, customPacks);
  return pack?.marketingMeta ?? { showContentCalendar: false };
}

export function getPackKpiDefs(
  packKey: IndustryPack,
  customPacks?: PackTemplate[],
): PackKpiDef[] {
  const pack = findPackByKey(packKey, customPacks);
  return pack?.kpiDefs && pack.kpiDefs.length > 0 ? pack.kpiDefs : DEFAULT_PACK_KPIS;
}

export function getPackEnabledModules(
  packKey: IndustryPack,
  customPacks?: PackTemplate[],
): string[] {
  const pack = findPackByKey(packKey, customPacks);
  return pack?.enabledModules && pack.enabledModules.length > 0
    ? pack.enabledModules
    : [...ALL_CRM_MODULE_KEYS];
}



