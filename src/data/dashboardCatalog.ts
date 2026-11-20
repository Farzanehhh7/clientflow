import type { DashboardPersonaRole, DashboardWidgetConfig, DashboardWidgetId } from '../types';

export type DashboardCatalogItem = {
  id: DashboardWidgetId;
  title: string;
  titleEn: string;
  defaultSize: 'half' | 'full';
  category: 'kpi' | 'sales' | 'finance' | 'support' | 'ops';
};

export const DASHBOARD_PERSONA_LABELS: Record<DashboardPersonaRole, { fa: string; en: string }> = {
  admin: { fa: 'مدیر کل (Admin)', en: 'Admin' },
  manager: { fa: 'مدیر اجرایی (Manager)', en: 'Manager' },
  sales: { fa: 'تیم فروش (Sales)', en: 'Sales Rep' },
  support: { fa: 'پشتیبانی (Support)', en: 'Support Agent' },
  receptionist: { fa: 'پذیرش و نوبت‌دهی (Receptionist)', en: 'Receptionist' },
};

export const DASHBOARD_WIDGET_CATALOG: DashboardCatalogItem[] = [
  { id: 'pack_kpis_goals', title: 'شاخص‌های صنعت و پیشرفت اهداف (KPI vs Goal)', titleEn: 'Industry KPIs & Goals', defaultSize: 'full', category: 'kpi' },
  { id: 'kpi_summary', title: 'کارت‌های خلاصه عملیاتی امروز', titleEn: 'Operational KPI Cards', defaultSize: 'full', category: 'kpi' },
  { id: 'chart_revenue_trend', title: 'روند درآمد و فعالیت‌ها در بازه زمانی', titleEn: 'Revenue & Activity Trend', defaultSize: 'half', category: 'finance' },
  { id: 'chart_sales_funnel', title: 'قیف تبدیل فروش و مراحل معامله', titleEn: 'Sales Funnel Chart', defaultSize: 'half', category: 'sales' },
  { id: 'chart_revenue_breakdown', title: 'تفکیک درآمد بر اساس منبع / کارشناس / محصول', titleEn: 'Revenue Breakdown', defaultSize: 'half', category: 'sales' },
  { id: 'chart_cohort_retention', title: 'تحلیل Cohort و نرخ ماندگاری مشتریان', titleEn: 'Cohort & Retention Trend', defaultSize: 'half', category: 'kpi' },
  { id: 'chart_aging', title: 'نمودار تراز سنی مطالبات (Aging)', titleEn: 'Receivables Aging Chart', defaultSize: 'half', category: 'finance' },
  { id: 'chart_sla_nps', title: 'روند انطباق SLA و شاخص رضایت NPS', titleEn: 'SLA Compliance & NPS Trend', defaultSize: 'half', category: 'support' },
  { id: 'chart_appointments', title: 'روند نوبت‌ها و نرخ عدم حضور (No-Show)', titleEn: 'Appointments & No-Show Over Time', defaultSize: 'half', category: 'ops' },
  { id: 'chart_orders', title: 'نمودار وضعیت سفارش‌ها', titleEn: 'Orders by Status Chart', defaultSize: 'half', category: 'ops' },
  { id: 'chart_finance', title: 'خلاصه مالی، وصولی و چک صیادی', titleEn: 'Finance & Sayadi Overview', defaultSize: 'half', category: 'finance' },
  { id: 'kpi_pipeline', title: 'وضعیت قیف فروش و پیش‌فاکتورها', titleEn: 'Sales Pipeline Snapshot', defaultSize: 'half', category: 'sales' },
  { id: 'sla_overview', title: 'پایش SLA و عملکرد پشتیبانی', titleEn: 'Support SLA Monitor', defaultSize: 'half', category: 'support' },
  { id: 'list_tasks', title: 'پیگیری‌های فوری و امروز', titleEn: 'Urgent Tasks', defaultSize: 'half', category: 'ops' },
  { id: 'list_tickets', title: 'آخرین تیکت‌های باز', titleEn: 'Open Tickets', defaultSize: 'half', category: 'support' },
  { id: 'list_cheques', title: 'سررسید چک‌های صیادی', titleEn: 'Sayadi Cheques Due', defaultSize: 'full', category: 'finance' },
];

const PERSONA_WIDGET_PRESETS: Record<DashboardPersonaRole, DashboardWidgetId[]> = {
  admin: [
    'pack_kpis_goals',
    'kpi_summary',
    'chart_revenue_trend',
    'chart_sales_funnel',
    'chart_revenue_breakdown',
    'chart_cohort_retention',
    'chart_aging',
    'chart_sla_nps',
    'chart_appointments',
    'list_cheques',
  ],
  manager: [
    'pack_kpis_goals',
    'chart_revenue_trend',
    'chart_revenue_breakdown',
    'chart_cohort_retention',
    'chart_sla_nps',
    'chart_aging',
    'kpi_pipeline',
    'sla_overview',
  ],
  sales: [
    'pack_kpis_goals',
    'kpi_pipeline',
    'chart_sales_funnel',
    'chart_revenue_trend',
    'chart_revenue_breakdown',
    'chart_orders',
    'list_tasks',
  ],
  support: [
    'sla_overview',
    'chart_sla_nps',
    'list_tickets',
    'list_tasks',
    'chart_cohort_retention',
  ],
  receptionist: [
    'kpi_summary',
    'chart_appointments',
    'list_tasks',
    'chart_orders',
    'list_tickets',
    'list_cheques',
  ],
};

export function getDefaultWidgetsForPersona(role: DashboardPersonaRole): DashboardWidgetConfig[] {
  const ids = PERSONA_WIDGET_PRESETS[role] ?? PERSONA_WIDGET_PRESETS.admin;
  return ids.map((id, idx) => {
    const def = DASHBOARD_WIDGET_CATALOG.find((c) => c.id === id)!;
    return {
      id: def.id,
      title: def.title,
      titleEn: def.titleEn,
      visible: true,
      size: def.defaultSize,
      order: idx + 1,
    };
  });
}
