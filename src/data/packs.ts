import type {
  AppState,
  CustomFieldDef,
  IndustryPack,
  PackCustomerConfig,
  PackOrderConfig,
  PackSalesConfig,
  PackTemplate,
} from '../types';

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
        condition: 'نوبت انجام‌شده بیش از ۳ روز پیش',
        action: 'ایجاد وظیفه ویزیت کنترل + پیامک',
        active: true,
        pack: 'clinic',
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
        trigger: 'زمان‌بندی',
        condition: 'سفارش جدید > ۱۲ ساعت بدون تأیید',
        action: 'ارسال پیامک یادآوری تکمیل سفارش',
        active: true,
        pack: 'shop',
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
        trigger: 'زمان‌بندی',
        condition: 'انقضای قرارداد در ۷ روز آینده',
        action: 'وظیفه تمدید + پیامک یادآوری',
        active: true,
        pack: 'software',
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
        active: true,
        pack: 'b2b',
        triggerType: 'on_stage_change',
        targetEntity: 'opportunity',
        conditionLogic: 'AND',
        conditions: [{ id: 'rc_b2b1', field: 'stage', op: 'eq', value: 'proposal' }],
        actionType: 'create_task',
        taskTitleTemplate: 'پیگیری پیشنهاد قیمت {{customer.name}} ظرف ۴۸ ساعت',
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
        name: 'یادآوری ثبت‌نام ترم جدید آموزشگاه',
        trigger: 'رویداد ثبت دانشجوی جدید',
        condition: 'چرخه عمر = سرنخ',
        action: 'ارسال پیامک معرفی برنامه کلاسی',
        active: true,
        pack: 'education',
        triggerType: 'on_create',
        targetEntity: 'customer',
        conditionLogic: 'AND',
        conditions: [{ id: 'rc_edu1', field: 'lifecycle', op: 'eq', value: 'lead' }],
        actionType: 'send_notification',
        actionChannel: 'sms',
        messageTemplate: 'سلام {{customer.name}} عزیز، جهت تکمیل تعیین سطح در {{businessName}} با شما تماس می‌گیریم.',
      },
    ],
  },
  {
    id: 'pack_realestate',
    key: 'realestate',
    name: 'املاک و نمایشگاه خودرو',
    nameEn: 'Real Estate & Auto',
    tier: 'light',
    description: 'پرونده ملک/خودرو، ثبت بازدید حضوری، قیف مذاکره و تطبیق بودجه خریدار',
    descriptionEn: 'Property/Vehicle listings, viewing appointments, negotiation pipeline & buyer matching',
    salesMeta: {
      pipelineName: 'قیف معاملات ملک و خودرو',
      leadSingular: 'خریدار / متقاضی',
      leadPlural: 'متقاضیان خرید',
      dealSingular: 'پرونده معامله',
      dealPlural: 'پرونده‌های معامله',
      quoteLabel: 'برآورد هزینه و مبایعه‌نامه',
      defaultStages: [
        { key: 'lead', label: 'ثبت تقاضای خرید', probability: 20, slaHours: 12 },
        { key: 'contacted', label: 'معرفی فایل و بازدید', probability: 40, slaHours: 24 },
        { key: 'proposal', label: 'پیشنهاد قیمت و شرایط', probability: 60, slaHours: 48 },
        { key: 'negotiation', label: 'نشست مبایعه‌نامه', probability: 80, slaHours: 72 },
        { key: 'won', label: 'عقد قرارداد قطعی', probability: 100, slaHours: 0 },
        { key: 'lost', label: 'منتفی‌شده', probability: 0, slaHours: 0 },
      ],
    },
    customFields: [
      { key: 'budget_max', label: 'بودجه خریدار (تومان)', entity: 'customer', type: 'money', active: true, showInTable: true, order: 1 },
      { key: 'property_area', label: 'متراژ درخواستی (متر مربع)', entity: 'customer', type: 'number', active: true, showInTable: true, order: 2 },
      { key: 'preferred_zone', label: 'منطقه / مدل درخواستی', entity: 'customer', type: 'text', active: true, order: 3 },
    ],
    customEntities: [
      {
        key: 'property_listing',
        name: 'فایل ملک / خودرو',
        pluralName: 'فایل‌های ملک و خودرو',
        description: 'ثبت مشخصات، قیمت و وضعیت آگهی ملک یا خودرو',
        fields: [
          { id: 're_1', key: 'listing_title', label: 'عنوان فایل (متراژ / مدل)', type: 'text', required: true, order: 1 },
          { id: 're_2', key: 'asking_price', label: 'قیمت اعلامی', type: 'money', order: 2 },
          { id: 're_3', key: 'district', label: 'محله / موقعیت', type: 'text', order: 3 },
        ],
      },
    ],
    services: [
      { name: 'بازدید حضوری ملک / کارشناسی خودرو', durationMin: 45, price: 0, bufferBeforeMin: 15, bufferAfterMin: 15 },
    ],
    products: [],
    rules: [
      {
        name: 'پیگیری پس از بازدید ملک/خودرو',
        trigger: 'رویداد ثبت فرصت فروش',
        condition: 'مرحله = تماس اولیه',
        action: 'ثبت وظیفه هماهنگی بازدید دوم',
        active: true,
        pack: 'realestate',
        triggerType: 'on_stage_change',
        targetEntity: 'opportunity',
        conditionLogic: 'AND',
        conditions: [{ id: 'rc_re1', field: 'stage', op: 'eq', value: 'negotiation' }],
        actionType: 'create_task',
        taskTitleTemplate: 'تهیه پیش‌نویس مبایعه‌نامه برای {{customer.name}}',
      },
    ],
  },
  {
    id: 'pack_salon',
    key: 'salon',
    name: 'آرایشگاه، سالن زیبایی و باشگاه',
    nameEn: 'Beauty Salon & Fitness',
    tier: 'light',
    description: 'عضویت و اشتراک، رزرو آرایشگر/مربی، یادآور ۲ ساعته نوبت و تبریک خودکار تولد',
    descriptionEn: 'Memberships, stylist/coach booking, 2h reminders & automated birthday perks',
    salesMeta: {
      pipelineName: 'قیف عضویت و پکیج خدمات',
      leadSingular: 'متقاضی عضویت',
      leadPlural: 'متقاضیان عضویت',
      dealSingular: 'پکیج / اشتراک',
      dealPlural: 'پکیج‌های عضویت',
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
    customFields: [
      { key: 'preferred_stylist', label: 'متخصص / مربی دلخواه', entity: 'customer', type: 'text', active: true, showInTable: true, order: 1 },
      { key: 'membership_tier', label: 'سطح عضویت باشگاه/سالن', entity: 'customer', type: 'select', options: ['برنزی', 'نقره‌ای', 'طلایی VIP'], active: true, order: 2 },
    ],
    customEntities: [],
    services: [
      { name: 'پکیج رنگ و مراقبت مو', durationMin: 90, price: 2200000, bufferBeforeMin: 10, bufferAfterMin: 15 },
      { name: 'جلسه تمرین اختصاصی (PT)', durationMin: 60, price: 750000, bufferBeforeMin: 5, bufferAfterMin: 10 },
    ],
    products: [
      { name: 'ماسک مو کراتینه حرفه‌ای', sku: 'SLN-201', price: 920000, stock: 18, minStock: 4, active: true },
    ],
    rules: [],
  },
  {
    id: 'pack_restaurant',
    key: 'restaurant',
    name: 'رستوران، کافه و کترینگ',
    nameEn: 'Restaurant & Cafe',
    tier: 'light',
    description: 'منوی غذا و نوشیدنی، ثبت سفارش سریع، باشگاه مشتریان و کد تخفیف وفاداری',
    descriptionEn: 'Menu items, fast order tracking, loyalty club & promo coupons',
    salesMeta: {
      pipelineName: 'قیف قراردادهای کترینگ و رویداد',
      leadSingular: 'متقاضی کترینگ',
      leadPlural: 'متقاضیان کترینگ',
      dealSingular: 'سفارش رویداد / شرکتی',
      dealPlural: 'قراردادهای کترینگ',
      quoteLabel: 'پیش‌فاکتور منو و پذیرایی',
      defaultStages: [
        { key: 'lead', label: 'درخواست منو', probability: 25, slaHours: 12 },
        { key: 'contacted', label: 'تست و انتخاب غذا', probability: 45, slaHours: 24 },
        { key: 'proposal', label: 'ارسال پیش‌فاکتور رویداد', probability: 65, slaHours: 36 },
        { key: 'negotiation', label: 'تایید نهایی تعداد نفرات', probability: 85, slaHours: 24 },
        { key: 'won', label: 'رزرو قطعی کترینگ', probability: 100, slaHours: 0 },
        { key: 'lost', label: 'لغو رویداد', probability: 0, slaHours: 0 },
      ],
    },
    orderMeta: {
      channelDefault: 'phone',
      statusLabels: {
        new: 'دریافت سفارش',
        confirmed: 'در حال آماده‌سازی',
        shipped: 'ارسال با پیک',
        delivered: 'تحویل مشتری',
        cancelled: 'لغوشده',
      },
      transitions: DEFAULT_ORDER_META.transitions,
    },
    customFields: [
      { key: 'favorite_table', label: 'ترجیح میز / ذائقه غذایی', entity: 'customer', type: 'text', active: true, order: 1 },
      { key: 'diet_pref', label: 'رژیم غذایی', entity: 'customer', type: 'select', options: ['معمولی', 'گیاهخوار', 'بدون گلوتن'], active: true, showInTable: true, order: 2 },
    ],
    customEntities: [],
    services: [
      { name: 'رزرو میز VIP (تولد / جلسه)', durationMin: 120, price: 500000, bufferBeforeMin: 15, bufferAfterMin: 15 },
    ],
    products: [
      { name: 'پکیج پذیرایی ویژه کافه و برانچ', sku: 'RST-101', price: 680000, stock: 50, minStock: 10, active: true },
    ],
    rules: [],
  },
  {
    id: 'pack_freelancer',
    key: 'freelancer',
    name: 'فریلنسر، مشاور و استودیو طراحی',
    nameEn: 'Freelancer & Studio',
    tier: 'light',
    description: 'مدیریت کارفرمایان، زمان‌سنجی پروژه، پیش‌فاکتور، پیگیری پرداخت و نمای ساده Solo',
    descriptionEn: 'Clients, project milestones, time tracking, invoices & Solo workspace',
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
    rules: [],
  },
  {
    id: 'pack_general',
    key: 'general',
    name: 'عمومی (پیکربندی استاندارد)',
    nameEn: 'General Standard',
    tier: 'light',
    description: 'پیکربندی متعادل برای کسب‌وکارهای عمومی بدون فیلدهای تخصصی صنعتی',
    descriptionEn: 'Balanced standard setup suitable for general service businesses',
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
    rules: [],
  },
];

export function buildPackFromState(
  state: AppState,
  meta: { key: string; name: string; nameEn?: string; description: string; tier?: PackTemplate['tier'] },
): PackTemplate {
  return {
    id: `pack_custom_${Date.now()}`,
    key: meta.key.trim().replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase() || `custom_${Date.now().toString(36)}`,
    name: meta.name.trim() || 'بسته سفارشی',
    nameEn: meta.nameEn?.trim() || 'Custom Pack',
    tier: meta.tier ?? 'medium',
    description: meta.description.trim() || 'ساخته‌شده از پیکربندی فعلی Tenant در Pack Builder',
    descriptionEn: 'Exported from current Tenant configuration',
    customFields: state.customFieldDefs.map(({ id: _id, ...rest }) => rest),
    customEntities: state.customEntityDefs.map(({ id: _id, createdAt: _ca, ...rest }) => rest),
    services: state.services.map(({ id: _id, ...rest }) => rest),
    products: state.products.map(({ id: _id, ...rest }) => rest),
    rules: state.rules.map(({ id: _id, ...rest }) => rest),
    exportedAt: new Date().toISOString(),
    isCustom: true,
  };
}

export function getPackCustomerConfig(
  packKey: IndustryPack,
  customFieldDefs: CustomFieldDef[],
): PackCustomerConfig {
  const pack = INDUSTRY_PACKS.find((p) => p.key === packKey);
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
  const pack =
    INDUSTRY_PACKS.find((p) => p.key === packKey) ??
    customPacks?.find((p) => p.key === packKey);
  if (pack?.salesMeta) return pack.salesMeta;
  const generalPack = INDUSTRY_PACKS.find((p) => p.key === 'general')!;
  return generalPack.salesMeta!;
}

export function getPackOrderConfig(
  packKey: IndustryPack,
  customPacks?: PackTemplate[],
): PackOrderConfig {
  const pack =
    INDUSTRY_PACKS.find((p) => p.key === packKey) ??
    customPacks?.find((p) => p.key === packKey);
  return pack?.orderMeta ?? DEFAULT_ORDER_META;
}
