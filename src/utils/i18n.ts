import dayjs from 'dayjs';
import jalaliday from 'jalaliday';
import type { AppLanguage, IndustryPack, NumberingConfig } from '../types';
import { toFa } from './jalali';

dayjs.extend(jalaliday);

export function formatDocumentNumber(
  kind: 'invoice' | 'quote' | 'order',
  seqNumber: number,
  cfg?: NumberingConfig,
): string {
  const conf: NumberingConfig = cfg ?? {
    invoicePrefix: 'INV',
    quotePrefix: 'QT',
    orderPrefix: 'ORD',
    includeJalaliYear: true,
    padLength: 4,
    separator: '-',
  };
  const prefix =
    kind === 'invoice'
      ? conf.invoicePrefix || 'INV'
      : kind === 'quote'
        ? conf.quotePrefix || 'QT'
        : conf.orderPrefix || 'ORD';
  const jYear = String(dayjs().calendar('jalali').year());
  const padded = String(Math.max(1, seqNumber)).padStart(Math.min(8, Math.max(2, conf.padLength || 4)), '0');
  const sep = conf.separator || '-';
  return conf.includeJalaliYear ? `${prefix}${sep}${jYear}${sep}${padded}` : `${prefix}${sep}${padded}`;
}

export function displayDigits(value: string | number, lang: AppLanguage, latinDigits?: boolean): string {
  if (lang === 'en' || latinDigits) return String(value);
  return toFa(value);
}

export const PACK_LABELS: Record<IndustryPack, { fa: string; en: string }> = {
  clinic: { fa: 'بسته کلینیک و مطب', en: 'Clinic & Medical Pack' },
  shop: { fa: 'بسته فروشگاه آنلاین', en: 'E-Commerce Shop Pack' },
  software: { fa: 'بسته شرکت نرم‌افزاری / IT', en: 'SaaS & IT Pack' },
  b2b: { fa: 'بسته خدمات B2B و پیمانکاری', en: 'B2B & Contracting Pack' },
  education: { fa: 'بسته آموزشگاه و دوره‌ها', en: 'Education & Academy Pack' },
  realestate: { fa: 'بسته املاک و خودرو', en: 'Real Estate & Auto Pack' },
  salon: { fa: 'بسته آرایشگاه و باشگاه', en: 'Beauty Salon & Gym Pack' },
  restaurant: { fa: 'بسته رستوران و کافه', en: 'Restaurant & Cafe Pack' },
  freelancer: { fa: 'بسته فریلنسر و آژانس', en: 'Freelancer & Studio Pack' },
  general: { fa: 'بسته عمومی (ساده)', en: 'General CRM Pack' },
};

const DICT = {
  fa: {
    appTitle: 'ClientFlow',
    mainMenu: 'منوی اصلی',
    quickSearch: 'جستجوی سریع',
    roleAdmin: 'نقش: مدیر سیستم',
    roleStaff: 'نقش: کارشناس',
    allBranches: 'همه شعبه‌ها',
    soloMode: 'نمای ساده',
    enterpriseMode: 'نمای سازمانی',
    tourBtn: 'تور راهنما',
    customizeDashboard: 'شخصی‌سازی ویجت‌ها',
    doneCustomizing: 'پایان چیدمان',
    resetLayout: 'بازنشانی چیدمان',
    nav: {
      dashboard: 'داشبورد',
      customers: 'مشتریان',
      appointments: 'نوبت‌ها',
      orders: 'سفارش‌ها و مالی',
      sales: 'قیف فروش',
      workflows: 'گردش کار (BPMS)',
      marketing: 'بازاریابی و محتوا',
      tasks: 'پیگیری‌ها',
      tickets: 'تیکت و پایگاه دانش',
      nps: 'رضایت‌سنجی (NPS)',
      custom_entities: 'موجودیت‌های سفارشی',
      reports: 'گزارش‌ها و تحلیل',
      automation: 'اتوماسیون و اعلان',
      integrations: 'یکپارچه‌سازی و VoIP',
      settings: 'تنظیمات و پک‌ها',
    },
    dash: {
      totalCustomers: 'تعداد کل مشتریان',
      registeredInBranch: 'ثبت‌شده در محدوده شعبه فعال',
      todaysAppointments: 'نوبت‌های امروز',
      activeToday: 'نوبت‌های فعال امروز',
      noShowRate: 'نرخ غیبت (No-Show)',
      settledRatio: 'نسبت به نوبت‌های نهایی‌شده',
      overdueOrders: 'سفارش‌های دارای تأخیر',
      passedPromised: 'عبور از زمان وعده‌داده‌شده',
      weeklyAppts: 'نوبت‌های هفته جاری (شنبه تا جمعه)',
      ordersStatus: 'وضعیت سفارش‌ها',
      financeOverview: 'خلاصه مالی، وصولی و چک‌های صیادی',
      pipelineOverview: 'خلاصه قیف فروش و پیش‌فاکتورها',
      chequesDue: 'چک‌های صیادی در جریان',
      urgentTasks: 'پیگیری‌های فوری و امروز',
      openTickets: 'آخرین تیکت‌های باز',
      viewAll: 'مشاهده همه',
    },
  },
  en: {
    appTitle: 'ClientFlow',
    mainMenu: 'Main Menu',
    quickSearch: 'Quick Search',
    roleAdmin: 'Role: Admin',
    roleStaff: 'Role: Staff',
    allBranches: 'All Branches',
    soloMode: 'Solo Mode',
    enterpriseMode: 'Enterprise',
    tourBtn: 'Guide Tour',
    customizeDashboard: 'Customize Widgets',
    doneCustomizing: 'Done Layout',
    resetLayout: 'Reset Layout',
    nav: {
      dashboard: 'Dashboard',
      customers: 'Customers',
      appointments: 'Appointments',
      orders: 'Orders & Finance',
      sales: 'Sales Pipeline',
      workflows: 'Workflows (BPMS)',
      marketing: 'Marketing',
      tasks: 'Follow-ups',
      tickets: 'Support & KB',
      nps: 'NPS Surveys',
      custom_entities: 'Custom Entities',
      reports: 'Reports & BI',
      automation: 'Automation',
      integrations: 'Integrations & VoIP',
      settings: 'Settings & Packs',
    },
    dash: {
      totalCustomers: 'Total Customers',
      registeredInBranch: 'Active in selected branch scope',
      todaysAppointments: "Today's Appointments",
      activeToday: 'Active sessions today',
      noShowRate: 'No-Show Rate',
      settledRatio: 'Of settled appointments',
      overdueOrders: 'Overdue Orders',
      passedPromised: 'Past promised delivery time',
      weeklyAppts: 'Weekly Appointments (Sat - Fri)',
      ordersStatus: 'Orders by Status',
      financeOverview: 'Finance, Receivables & Sayadi Cheques',
      pipelineOverview: 'Sales Pipeline & Quotes Snapshot',
      chequesDue: 'Active Sayadi Cheques',
      urgentTasks: 'Urgent Follow-up Tasks',
      openTickets: 'Recent Open Tickets',
      viewAll: 'View All',
    },
  },
} as const;

export function getUiText(lang: AppLanguage) {
  return DICT[lang] ?? DICT.fa;
}
