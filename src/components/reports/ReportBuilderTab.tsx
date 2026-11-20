import { useMemo, useState } from 'react';
import {
  Bookmark,
  CalendarClock,
  Check,
  Copy,
  Download,
  FileSpreadsheet,
  Filter,
  Plus,
  Printer,
  Share2,
  Trash2,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Modal } from '../Modal';
import { JalaliDateRangePicker } from '../ui/JalaliDateRangePicker';
import { useClientFlow } from '../../store/useClientFlowStore';
import type {
  ReportAggType,
  ReportChartType,
  ReportEntityKey,
  ReportFilterOp,
  ReportFilterRule,
  SavedReportConfig,
  ScheduledReport,
} from '../../types';
import { exportRowsToCsv, exportRowsToXlsx } from '../../utils/csv';
import {
  formatJalali,
  formatJalaliDateTime,
  getJalaliDateRangePreset,
  isIsoInJalaliRange,
  type JalaliDatePreset,
  toFa,
} from '../../utils/jalali';

type FieldDef = {
  key: string;
  label: string;
  numeric?: boolean;
  groupable?: boolean;
};

type EntitySchema = {
  label: string;
  dateField: string;
  fields: FieldDef[];
};

const ENTITY_SCHEMAS: Record<ReportEntityKey, EntitySchema> = {
  orders: {
    label: 'سفارش‌ها',
    dateField: 'createdAt',
    fields: [
      { key: 'id', label: 'شناسه' },
      { key: 'customerName', label: 'مشتری', groupable: true },
      { key: 'channel', label: 'کانال ثبت', groupable: true },
      { key: 'status', label: 'وضعیت', groupable: true },
      { key: 'itemsCount', label: 'تعداد اقلام', numeric: true },
      { key: 'totalAmount', label: 'مبلغ نهایی (تومان)', numeric: true },
      { key: 'dateJalali', label: 'تاریخ ثبت' },
    ],
  },
  customers: {
    label: 'مشتریان',
    dateField: 'createdAt',
    fields: [
      { key: 'name', label: 'نام مشتری' },
      { key: 'phone', label: 'موبایل' },
      { key: 'lifecycle', label: 'مرحله عمر', groupable: true },
      { key: 'personType', label: 'شخصیت', groupable: true },
      { key: 'source', label: 'منبع جذب', groupable: true },
      { key: 'ownerName', label: 'مسئول پیگیری', groupable: true },
      { key: 'loyaltyPoints', label: 'امتیاز باشگاه', numeric: true },
      { key: 'dateJalali', label: 'تاریخ عضویت' },
    ],
  },
  appointments: {
    label: 'نوبت‌ها و مراجعات',
    dateField: 'start',
    fields: [
      { key: 'customerName', label: 'مشتری', groupable: true },
      { key: 'serviceName', label: 'خدمت', groupable: true },
      { key: 'resourceName', label: 'منبع / پزشک', groupable: true },
      { key: 'status', label: 'وضعیت', groupable: true },
      { key: 'price', label: 'تعرفه (تومان)', numeric: true },
      { key: 'dateJalali', label: 'زمان نوبت' },
    ],
  },
  invoices: {
    label: 'فاکتورها و مطالبات',
    dateField: 'issuedAt',
    fields: [
      { key: 'invoiceNo', label: 'شماره فاکتور' },
      { key: 'customerName', label: 'مشتری', groupable: true },
      { key: 'status', label: 'وضعیت', groupable: true },
      { key: 'grandTotal', label: 'مبلغ کل (تومان)', numeric: true },
      { key: 'paidAmount', label: 'پرداخت‌شده (تومان)', numeric: true },
      { key: 'balance', label: 'مانده بدهی (تومان)', numeric: true },
      { key: 'dateJalali', label: 'تاریخ صدور' },
    ],
  },
  opportunities: {
    label: 'فرصت‌های فروش (قیف)',
    dateField: 'createdAt',
    fields: [
      { key: 'title', label: 'عنوان فرصت' },
      { key: 'contactName', label: 'مخاطب' },
      { key: 'ownerName', label: 'کارشناس فروش', groupable: true },
      { key: 'source', label: 'منبع', groupable: true },
      { key: 'stage', label: 'مرحله', groupable: true },
      { key: 'amount', label: 'مبلغ معامله (تومان)', numeric: true },
      { key: 'probability', label: 'احتمال (٪)', numeric: true },
      { key: 'dateJalali', label: 'تاریخ ایجاد' },
    ],
  },
  tickets: {
    label: 'تیکت‌های پشتیبانی',
    dateField: 'createdAt',
    fields: [
      { key: 'trackingCode', label: 'کد پیگیری' },
      { key: 'customerName', label: 'مشتری' },
      { key: 'subject', label: 'موضوع' },
      { key: 'channel', label: 'کانال', groupable: true },
      { key: 'priority', label: 'اولویت', groupable: true },
      { key: 'status', label: 'وضعیت', groupable: true },
      { key: 'category', label: 'دسته‌بندی', groupable: true },
      { key: 'dateJalali', label: 'تاریخ ثبت' },
    ],
  },
  leads: {
    label: 'سرنخ‌های فروش (Leads)',
    dateField: 'createdAt',
    fields: [
      { key: 'name', label: 'نام سرنخ' },
      { key: 'phone', label: 'موبایل' },
      { key: 'source', label: 'منبع جذب', groupable: true },
      { key: 'status', label: 'وضعیت', groupable: true },
      { key: 'ownerName', label: 'مسئول', groupable: true },
      { key: 'estimatedAmount', label: 'ارزش برآوردی (تومان)', numeric: true },
      { key: 'score', label: 'امتیاز سرنخ', numeric: true },
      { key: 'dateJalali', label: 'تاریخ ثبت' },
    ],
  },
  payments: {
    label: 'تراکنش‌های پرداخت',
    dateField: 'at',
    fields: [
      { key: 'refId', label: 'کد رهگیری' },
      { key: 'gateway', label: 'درگاه / روش', groupable: true },
      { key: 'status', label: 'وضعیت', groupable: true },
      { key: 'amount', label: 'مبلغ (تومان)', numeric: true },
      { key: 'dateJalali', label: 'زمان تراکنش' },
    ],
  },
};

const CHART_COLORS = ['#4f46e5', '#10b981', '#0ea5e9', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6'];

export function ReportBuilderTab() {
  const {
    state,
    saveCustomReport,
    deleteCustomReport,
    toggleShareSavedReport,
    addScheduledReport,
  } = useClientFlow();

  const [entity, setEntity] = useState<ReportEntityKey>('orders');
  const [selectedCols, setSelectedCols] = useState<string[]>(
    ENTITY_SCHEMAS.orders.fields.map((f) => f.key),
  );
  const [filters, setFilters] = useState<ReportFilterRule[]>([]);
  const [groupBy, setGroupBy] = useState<string>('status');
  const [aggregation, setAggregation] = useState<ReportAggType>('sum');
  const [metricField, setMetricField] = useState<string>('totalAmount');
  const [chartType, setChartType] = useState<ReportChartType>('bar');

  const [datePreset, setDatePreset] = useState<JalaliDatePreset | 'custom'>('all');
  const [fromJalali, setFromJalali] = useState('');
  const [toJalali, setToJalali] = useState('');

  // Save / Share / Schedule Modals
  const [saveOpen, setSaveOpen] = useState(false);
  const [reportTitle, setReportTitle] = useState('');
  const [editingReportId, setEditingReportId] = useState<string | undefined>(undefined);

  const [shareModalRpt, setShareModalRpt] = useState<SavedReportConfig | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);

  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [schedTitle, setSchedTitle] = useState('');
  const [schedFreq, setSchedFreq] = useState<ScheduledReport['frequency']>('weekly');
  const [schedFormat, setSchedFormat] = useState<ScheduledReport['format']>('csv');
  const [schedRecipients, setSchedRecipients] = useState('manager@clientflow.ir');

  const schema = ENTITY_SCHEMAS[entity];
  const numericFields = schema.fields.filter((f) => f.numeric);
  const groupableFields = schema.fields.filter((f) => f.groupable);

  const handleEntityChange = (nextEntity: ReportEntityKey) => {
    setEntity(nextEntity);
    const nextSchema = ENTITY_SCHEMAS[nextEntity];
    setSelectedCols(nextSchema.fields.map((f) => f.key));
    setFilters([]);
    const defGroup = nextSchema.fields.find((f) => f.groupable)?.key ?? 'none';
    const defMetric = nextSchema.fields.find((f) => f.numeric)?.key ?? nextSchema.fields[0].key;
    setGroupBy(defGroup);
    setMetricField(defMetric);
    setAggregation(nextSchema.fields.some((f) => f.numeric) ? 'sum' : 'count');
  };

  // Build uniform flat rows for selected entity
  const rawRecords = useMemo<Array<Record<string, string | number> & { _isoDate?: string }>>(() => {
    const custMap = new Map(state.customers.map((c) => [c.id, c.name]));
    const srvMap = new Map(state.services.map((s) => [s.id, s]));
    const resMap = new Map(state.resources.map((r) => [r.id, r.name]));
    const branch = state.settings.activeBranchId;
    const matchBranch = (bId?: string) => !branch || branch === 'all' || !bId || bId === branch;

    if (entity === 'orders') {
      return state.orders
        .filter((o) => matchBranch(o.branchId))
        .map((o) => ({
          id: o.id,
          customerName: custMap.get(o.customerId) ?? 'مشتری',
          channel: o.channel ?? 'store',
          status: o.status,
          itemsCount: o.items.reduce((s, it) => s + it.qty, 0),
          totalAmount: o.items.reduce((s, it) => s + it.qty * it.price, 0) - (o.discountAmount ?? 0),
          dateJalali: formatJalali(o.createdAt),
          _isoDate: o.createdAt,
        }));
    }
    if (entity === 'customers') {
      return state.customers
        .filter((c) => !c.isDeleted && matchBranch(c.branchId))
        .map((c) => ({
          name: c.name,
          phone: c.phone,
          lifecycle: c.lifecycle ?? 'active',
          personType: c.personType === 'organization' ? 'حقوقی' : 'حقیقی',
          source: c.source ?? 'مستقیم',
          ownerName: c.ownerName ?? 'تخصیص‌نیافته',
          loyaltyPoints: c.loyaltyPoints ?? 0,
          dateJalali: formatJalali(c.createdAt),
          _isoDate: c.createdAt,
        }));
    }
    if (entity === 'appointments') {
      return state.appointments
        .filter((a) => matchBranch(a.branchId))
        .map((a) => ({
          customerName: custMap.get(a.customerId) ?? 'مشتری',
          serviceName: srvMap.get(a.serviceId)?.name ?? 'خدمت',
          resourceName: resMap.get(a.resourceId) ?? 'منبع',
          status: a.status,
          price: srvMap.get(a.serviceId)?.price ?? 0,
          dateJalali: formatJalaliDateTime(a.start),
          _isoDate: a.start,
        }));
    }
    if (entity === 'invoices') {
      return state.invoices
        .filter((inv) => matchBranch(inv.branchId))
        .map((inv) => ({
          invoiceNo: inv.invoiceNo,
          customerName: custMap.get(inv.customerId) ?? 'مشتری',
          status: inv.status,
          grandTotal: inv.grandTotal,
          paidAmount: inv.paidAmount,
          balance: Math.max(0, inv.grandTotal - inv.paidAmount),
          dateJalali: formatJalali(inv.issuedAt),
          _isoDate: inv.issuedAt,
        }));
    }
    if (entity === 'opportunities') {
      return state.opportunities
        .filter((o) => matchBranch(o.branchId))
        .map((o) => ({
          title: o.title,
          contactName: o.contactName,
          ownerName: o.ownerName,
          source: o.source,
          stage: o.stage,
          amount: o.amount,
          probability: o.probability,
          dateJalali: formatJalali(o.createdAt),
          _isoDate: o.createdAt,
        }));
    }
    if (entity === 'tickets') {
      return state.tickets
        .filter((t) => !t.mergedIntoTicketId)
        .map((t) => ({
          trackingCode: t.trackingCode ?? t.id,
          customerName: custMap.get(t.customerId) ?? 'مشتری',
          subject: t.subject,
          channel: t.channel ?? 'portal',
          priority: t.priority,
          status: t.status,
          category: t.category ?? 'عمومی',
          dateJalali: formatJalali(t.createdAt),
          _isoDate: t.createdAt,
        }));
    }
    if (entity === 'leads') {
      return state.leads.map((l) => ({
        name: l.name,
        phone: l.phone,
        source: l.source,
        status: l.status,
        ownerName: l.ownerName ?? 'تخصیص‌نیافته',
        estimatedAmount: l.estimatedAmount ?? 0,
        score: l.score ?? 50,
        dateJalali: formatJalali(l.createdAt),
        _isoDate: l.createdAt,
      }));
    }
    return state.paymentTransactions.map((p) => ({
      refId: p.refId ?? p.id,
      gateway: p.gateway,
      status: p.status,
      amount: p.amount,
      dateJalali: formatJalaliDateTime(p.at),
      _isoDate: p.at,
    }));
  }, [entity, state]);

  // Apply Jalali date range + multi-filters
  const filteredRecords = useMemo(() => {
    return rawRecords.filter((rec) => {
      if (!isIsoInJalaliRange(rec._isoDate, fromJalali, toJalali)) return false;
      for (const f of filters) {
        if (!f.value.trim()) continue;
        const cellVal = rec[f.field];
        const strVal = String(cellVal ?? '').toLowerCase();
        const target = f.value.trim().toLowerCase();
        if (f.op === 'eq' && strVal !== target) return false;
        if (f.op === 'neq' && strVal === target) return false;
        if (f.op === 'contains' && !strVal.includes(target)) return false;
        if (f.op === 'gte' && (Number(cellVal) || 0) < (Number(f.value) || 0)) return false;
        if (f.op === 'lte' && (Number(cellVal) || 0) > (Number(f.value) || 0)) return false;
      }
      return true;
    });
  }, [rawRecords, fromJalali, toJalali, filters]);

  // Grouped aggregation data
  const groupedData = useMemo(() => {
    if (groupBy === 'none') return [];
    const groups = new Map<string, number[]>();
    for (const rec of filteredRecords) {
      const k = String(rec[groupBy] ?? 'نامشخص') || 'نامشخص';
      const val = Number(rec[metricField] ?? 0) || 0;
      const arr = groups.get(k) ?? [];
      arr.push(val);
      groups.set(k, arr);
    }

    return Array.from(groups.entries()).map(([groupLabel, nums]) => {
      let value = nums.length;
      if (aggregation === 'sum') value = nums.reduce((s, n) => s + n, 0);
      else if (aggregation === 'avg') value = Math.round(nums.reduce((s, n) => s + n, 0) / nums.length);
      else if (aggregation === 'min') value = Math.min(...nums);
      else if (aggregation === 'max') value = Math.max(...nums);
      return {
        name: groupLabel,
        count: nums.length,
        value,
      };
    });
  }, [filteredRecords, groupBy, aggregation, metricField]);

  // Build tabular export rows (either grouped summary or raw columns)
  const exportPayload = useMemo(() => {
    if (groupBy !== 'none' && chartType !== 'table') {
      const groupLabel = schema.fields.find((f) => f.key === groupBy)?.label ?? groupBy;
      const metricLabel =
        aggregation === 'count'
          ? 'تعداد'
          : schema.fields.find((f) => f.key === metricField)?.label ?? metricField;
      return {
        headers: [groupLabel, 'تعداد ردیف', metricLabel],
        rows: groupedData.map((g) => [g.name, g.count, g.value]),
      };
    }

    const activeCols = schema.fields.filter((f) => selectedCols.includes(f.key));
    return {
      headers: activeCols.map((c) => c.label),
      rows: filteredRecords.map((rec) => activeCols.map((c) => rec[c.key] ?? '—')),
    };
  }, [groupBy, chartType, schema.fields, aggregation, metricField, groupedData, selectedCols, filteredRecords]);

  const toggleColumn = (key: string) => {
    setSelectedCols((prev) =>
      prev.includes(key)
        ? prev.length > 1
          ? prev.filter((k) => k !== key)
          : prev
        : [...prev, key],
    );
  };

  const addFilterRule = () => {
    setFilters((prev) => [
      ...prev,
      {
        id: `flt_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        field: schema.fields[0].key,
        op: 'contains',
        value: '',
      },
    ]);
  };

  const handleSaveReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportTitle.trim()) return;
    saveCustomReport({
      id: editingReportId,
      title: reportTitle.trim(),
      entity,
      columns: selectedCols,
      filters,
      groupBy,
      aggregation,
      metricField,
      chartType,
      datePreset,
      dateFromJalali: fromJalali,
      dateToJalali: toJalali,
    });
    setSaveOpen(false);
    setEditingReportId(undefined);
  };

  const loadSavedReport = (rpt: SavedReportConfig) => {
    setEntity(rpt.entity);
    setSelectedCols(rpt.columns);
    setFilters(rpt.filters);
    setGroupBy(rpt.groupBy);
    setAggregation(rpt.aggregation);
    setMetricField(rpt.metricField);
    setChartType(rpt.chartType);
    setDatePreset((rpt.datePreset as JalaliDatePreset | 'custom') ?? 'all');
    if (rpt.datePreset && rpt.datePreset !== 'custom') {
      const p = getJalaliDateRangePreset(rpt.datePreset as JalaliDatePreset);
      setFromJalali(p.fromJalali);
      setToJalali(p.toJalali);
    } else {
      setFromJalali(rpt.dateFromJalali ?? '');
      setToJalali(rpt.dateToJalali ?? '');
    }
    setEditingReportId(rpt.id);
    setReportTitle(rpt.title);
  };

  const handleScheduleFromBuilder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!schedTitle.trim() || !schedRecipients.trim()) return;
    const mappedDataset: ScheduledReport['dataset'] =
      entity === 'customers' || entity === 'orders' || entity === 'invoices' || entity === 'opportunities' || entity === 'tickets'
        ? entity
        : 'customers';
    addScheduledReport({
      title: schedTitle.trim(),
      dataset: mappedDataset,
      frequency: schedFreq,
      format: schedFormat,
      recipients: schedRecipients.trim(),
      active: true,
    });
    setScheduleOpen(false);
  };

  const handleDownloadCsv = () => {
    const csv = exportRowsToCsv(exportPayload.headers, exportPayload.rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clientflow-report-${entity}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadXlsx = () => {
    exportRowsToXlsx(
      schema.label,
      exportPayload.headers,
      exportPayload.rows,
      `clientflow-report-${entity}-${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  };

  const isDark = state.settings.darkMode;
  const gridStroke = isDark ? '#1e293b' : '#e2e8f0';
  const axisColor = isDark ? '#94a3b8' : '#64748b';
  const savedReports = state.savedReports ?? [];

  return (
    <div className="space-y-5">
      {/* Saved Reports Shelf */}
      {savedReports.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 print-hidden dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-2.5 flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
            <Bookmark size={14} className="text-indigo-500" />
            گزارش‌های ذخیره‌شده ({toFa(savedReports.length)})
          </div>
          <div className="flex flex-wrap gap-2">
            {savedReports.map((rpt) => (
              <div
                key={rpt.id}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
              >
                <button
                  type="button"
                  onClick={() => loadSavedReport(rpt)}
                  className="font-medium text-slate-800 hover:text-indigo-600 dark:text-slate-100"
                >
                  {rpt.title}
                </button>
                <span className="text-[10px] text-slate-400">
                  ({ENTITY_SCHEMAS[rpt.entity].label})
                </span>
                <button
                  type="button"
                  onClick={() => setShareModalRpt(rpt)}
                  title="اشتراک‌گذاری گزارش"
                  className="rounded p-1 text-slate-400 hover:text-indigo-600"
                >
                  <Share2 size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => deleteCustomReport(rpt.id)}
                  title="حذف"
                  className="rounded p-1 text-slate-400 hover:text-rose-600"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Builder Config Panel */}
      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 print-hidden dark:border-slate-800 dark:bg-slate-900">
        {/* Top Row: Entity + Grouping + Aggregation + Chart Type */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-slate-500">موجودیت (Entity)</label>
            <select
              value={entity}
              onChange={(e) => handleEntityChange(e.target.value as ReportEntityKey)}
              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium dark:border-slate-700 dark:bg-slate-800"
            >
              {(Object.keys(ENTITY_SCHEMAS) as ReportEntityKey[]).map((k) => (
                <option key={k} value={k}>
                  {ENTITY_SCHEMAS[k].label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium text-slate-500">گروه‌بندی (Group By)</label>
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="none">بدون گروه‌بندی (لیست ردیف‌ها)</option>
              {groupableFields.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium text-slate-500">تابع تجمیع (Aggregation)</label>
            <select
              value={aggregation}
              onChange={(e) => setAggregation(e.target.value as ReportAggType)}
              disabled={groupBy === 'none'}
              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="count">تعداد (Count)</option>
              <option value="sum">مجموع (Sum)</option>
              <option value="avg">میانگین (Average)</option>
              <option value="min">حداقل (Min)</option>
              <option value="max">حداکثر (Max)</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium text-slate-500">ستون عددی شاخص</label>
            <select
              value={metricField}
              onChange={(e) => setMetricField(e.target.value)}
              disabled={groupBy === 'none' || aggregation === 'count'}
              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800"
            >
              {numericFields.length === 0 ? (
                <option value={schema.fields[0].key}>تعداد ردیف</option>
              ) : (
                numericFields.map((f) => (
                  <option key={f.key} value={f.key}>
                    {f.label}
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium text-slate-500">نوع نمایش / نمودار</label>
            <select
              value={chartType}
              onChange={(e) => setChartType(e.target.value as ReportChartType)}
              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="table">جدول داده خام</option>
              <option value="bar">نمودار ستونی (Bar)</option>
              <option value="line">نمودار خطی (Line)</option>
              <option value="area">نمودار مساحتی (Area)</option>
              <option value="pie">نمودار دایره‌ای (Pie)</option>
            </select>
          </div>
        </div>

        {/* Date Range Filter */}
        <JalaliDateRangePicker
          preset={datePreset}
          fromJalali={fromJalali}
          toJalali={toJalali}
          onChange={(next) => {
            setDatePreset(next.preset);
            setFromJalali(next.fromJalali);
            setToJalali(next.toJalali);
          }}
        />

        {/* Columns Selection */}
        <div>
          <div className="mb-1.5 text-[11px] font-medium text-slate-500">ستون‌های جدول:</div>
          <div className="flex flex-wrap gap-2">
            {schema.fields.map((f) => (
              <label
                key={f.key}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-xs dark:border-slate-700"
              >
                <input
                  type="checkbox"
                  checked={selectedCols.includes(f.key)}
                  onChange={() => toggleColumn(f.key)}
                />
                {f.label}
              </label>
            ))}
          </div>
        </div>

        {/* Dynamic Multi-Rule Filters */}
        <div className="space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
              <Filter size={13} />
              فیلترهای سفارشی ({toFa(filters.length)})
            </span>
            <button
              type="button"
              onClick={addFilterRule}
              className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
            >
              <Plus size={12} />
              افزودن شرط فیلتر
            </button>
          </div>

          {filters.map((flt) => (
            <div key={flt.id} className="flex flex-wrap items-center gap-2">
              <select
                value={flt.field}
                onChange={(e) =>
                  setFilters((prev) =>
                    prev.map((x) => (x.id === flt.id ? { ...x, field: e.target.value } : x)),
                  )
                }
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
              >
                {schema.fields.map((f) => (
                  <option key={f.key} value={f.key}>
                    {f.label}
                  </option>
                ))}
              </select>

              <select
                value={flt.op}
                onChange={(e) =>
                  setFilters((prev) =>
                    prev.map((x) =>
                      x.id === flt.id ? { ...x, op: e.target.value as ReportFilterOp } : x,
                    ),
                  )
                }
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="contains">شامل</option>
                <option value="eq">مساوی</option>
                <option value="neq">نامساوی</option>
                <option value="gte">بزرگ‌تر یا مساوی</option>
                <option value="lte">کوچک‌تر یا مساوی</option>
              </select>

              <input
                value={flt.value}
                onChange={(e) =>
                  setFilters((prev) =>
                    prev.map((x) => (x.id === flt.id ? { ...x, value: e.target.value } : x)),
                  )
                }
                placeholder="مقدار..."
                className="flex-1 min-w-[140px] rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
              />

              <button
                type="button"
                onClick={() => setFilters((prev) => prev.filter((x) => x.id !== flt.id))}
                className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>

        {/* Actions Bar: Save / Schedule / Export CSV / XLSX / Print PDF */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setReportTitle(reportTitle || `گزارش ${schema.label}`);
                setSaveOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950/50 dark:text-indigo-300"
            >
              <Bookmark size={14} />
              ذخیره گزارش
            </button>
            <button
              type="button"
              onClick={() => {
                setSchedTitle(`گزارش دوره‌ای ${schema.label}`);
                setScheduleOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <CalendarClock size={14} />
              زمان‌بندی ایمیل خودکار
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Printer size={14} />
              چاپ / PDF
            </button>
            <button
              type="button"
              onClick={handleDownloadXlsx}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300"
            >
              <FileSpreadsheet size={14} />
              خروجی اکسل (XLSX)
            </button>
            <button
              type="button"
              onClick={handleDownloadCsv}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
            >
              <Download size={14} />
              خروجی CSV ({toFa(exportPayload.rows.length)} ردیف)
            </button>
          </div>
        </div>
      </div>

      {/* Live Recharts Visualization when chartType !== 'table' and groupBy !== 'none' */}
      {chartType !== 'table' && groupBy !== 'none' && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              خروجی نموداری: {schema.label} بر اساس{' '}
              {schema.fields.find((f) => f.key === groupBy)?.label}
            </h3>
            <span className="text-xs text-slate-500 tabular-nums">
              {toFa(groupedData.length)} گروه
            </span>
          </div>

          <div className="h-72 w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'bar' ? (
                <BarChart data={groupedData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: axisColor, fontSize: 11 }} />
                  <YAxis tick={{ fill: axisColor, fontSize: 11 }} />
                  <Tooltip
                    formatter={(v: number) => [toFa(v.toLocaleString('en-US')), 'مقدار']}
                    contentStyle={{
                      borderRadius: 8,
                      backgroundColor: isDark ? '#0f172a' : '#ffffff',
                      border: `1px solid ${gridStroke}`,
                    }}
                  />
                  <Bar dataKey="value" fill="#4f46e5" radius={[6, 6, 0, 0]} maxBarSize={42} />
                </BarChart>
              ) : chartType === 'line' ? (
                <LineChart data={groupedData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: axisColor, fontSize: 11 }} />
                  <YAxis tick={{ fill: axisColor, fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => [toFa(v.toLocaleString('en-US')), 'مقدار']} />
                  <Line type="monotone" dataKey="value" stroke="#4f46e5" strokeWidth={2.5} />
                </LineChart>
              ) : chartType === 'area' ? (
                <AreaChart data={groupedData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: axisColor, fontSize: 11 }} />
                  <YAxis tick={{ fill: axisColor, fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => [toFa(v.toLocaleString('en-US')), 'مقدار']} />
                  <Area type="monotone" dataKey="value" stroke="#10b981" fill="#10b98133" strokeWidth={2.5} />
                </AreaChart>
              ) : (
                <PieChart>
                  <Pie
                    data={groupedData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={105}
                    label={(e) => `${e.name}: ${toFa(e.value)}`}
                  >
                    {groupedData.map((_, idx) => (
                      <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => [toFa(v.toLocaleString('en-US')), 'مقدار']} />
                </PieChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Results Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="border-b border-slate-200 bg-slate-50/70 text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
              <tr>
                {exportPayload.headers.map((h) => (
                  <th key={h} className="px-4 py-3 font-medium whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {exportPayload.rows.slice(0, 40).map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="px-4 py-2.5 tabular-nums text-slate-700 dark:text-slate-300">
                      {typeof cell === 'number'
                        ? toFa(cell.toLocaleString('en-US'))
                        : toFa(String(cell))}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {exportPayload.rows.length > 40 && (
          <div className="border-t border-slate-200 px-4 py-2 text-xs text-slate-500 dark:border-slate-800">
            نمایش ۴۰ ردیف اول در پیش‌نمایش؛ خروجی CSV/XLSX شامل تمام {toFa(exportPayload.rows.length)} ردیف است.
          </div>
        )}
      </div>

      {/* Save Report Modal */}
      <Modal
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        title="ذخیره پیکربندی گزارش"
        maxWidth="sm"
      >
        <form onSubmit={handleSaveReport} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium">عنوان گزارش *</label>
            <input
              required
              value={reportTitle}
              onChange={(e) => setReportTitle(e.target.value)}
              placeholder="مثلاً فروش تفکیکی بهار ۱۴۰۵"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setSaveOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs dark:border-slate-700"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700"
            >
              ذخیره گزارش
            </button>
          </div>
        </form>
      </Modal>

      {/* Share Report Modal */}
      <Modal
        open={Boolean(shareModalRpt)}
        onClose={() => setShareModalRpt(null)}
        title="اشتراک‌گذاری گزارش ذخیره‌شده"
        maxWidth="md"
      >
        {shareModalRpt && (
          <div className="space-y-3 text-xs">
            <p className="text-slate-600 dark:text-slate-300">
              لینک اشتراک‌گذاری داخلی گزارش «{shareModalRpt.title}» برای اعضای تیم:
            </p>
            <div className="flex items-center gap-2">
              <input
                readOnly
                dir="ltr"
                value={`https://clientflow.ir/reports/shared/${shareModalRpt.shareToken ?? shareModalRpt.id}`}
                className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
              />
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(
                      `https://clientflow.ir/reports/shared/${shareModalRpt.shareToken ?? shareModalRpt.id}`,
                    );
                    setCopiedToken(true);
                    setTimeout(() => setCopiedToken(false), 2000);
                  } catch {
                    // ignore
                  }
                }}
                className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 font-medium text-white hover:bg-indigo-700"
              >
                {copiedToken ? <Check size={14} /> : <Copy size={14} />}
                {copiedToken ? 'کپی شد' : 'کپی لینک'}
              </button>
            </div>
            <label className="flex items-center gap-2 pt-1 font-medium">
              <input
                type="checkbox"
                checked={Boolean(shareModalRpt.shared)}
                onChange={() => toggleShareSavedReport(shareModalRpt.id)}
              />
              دسترسی عمومی لینک فعال باشد
            </label>
          </div>
        )}
      </Modal>

      {/* Schedule Report Email Modal */}
      <Modal
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        title="زمان‌بندی ارسال ایمیل گزارش"
        maxWidth="md"
      >
        <form onSubmit={handleScheduleFromBuilder} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium">عنوان ایمیل گزارش *</label>
            <input
              required
              value={schedTitle}
              onChange={(e) => setSchedTitle(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium">تناوب ارسال</label>
              <select
                value={schedFreq}
                onChange={(e) => setSchedFreq(e.target.value as ScheduledReport['frequency'])}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="daily">روزانه</option>
                <option value="weekly">هفتگی</option>
                <option value="monthly">ماهانه</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">فرمت پیوست</label>
              <select
                value={schedFormat}
                onChange={(e) => setSchedFormat(e.target.value as ScheduledReport['format'])}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs uppercase dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="csv">CSV</option>
                <option value="pdf">PDF</option>
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">ایمیل گیرندگان (جداشده با کاما)</label>
            <input
              required
              dir="ltr"
              value={schedRecipients}
              onChange={(e) => setSchedRecipients(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setScheduleOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs dark:border-slate-700"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700"
            >
              ثبت زمان‌بندی ارسال
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
