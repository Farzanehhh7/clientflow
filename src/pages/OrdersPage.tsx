import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Boxes,
  CheckSquare,
  Clock,
  Eye,
  FolderKanban,
  PackageCheck,
  Plus,
  Printer,
  Receipt,
  RotateCcw,
  Trash2,
  Truck,
} from 'lucide-react';
import { InvoicePreviewModal } from '../components/InvoicePreviewModal';
import { Modal } from '../components/Modal';
import { useClientFlow } from '../store/useClientFlowStore';
import type {
  Invoice,
  Order,
  OrderStatus,
  PaymentMethod,
  Product,
  ProjectStatus,
  ShippingCarrier,
} from '../types';
import { formatJalali, formatJalaliDateTime, formatToman, toFa } from '../utils/jalali';

const STATUS_LABEL: Record<OrderStatus, string> = {
  new: 'جدید',
  confirmed: 'تأییدشده',
  shipped: 'ارسال‌شده',
  delivered: 'تحویل‌شده',
  cancelled: 'لغوشده',
};

const STATUS_COLOR: Record<OrderStatus, string> = {
  new: 'text-indigo-600 dark:text-indigo-400',
  confirmed: 'text-sky-600 dark:text-sky-400',
  shipped: 'text-amber-600 dark:text-amber-400',
  delivered: 'text-emerald-600 dark:text-emerald-400',
  cancelled: 'text-slate-400 dark:text-slate-500',
};

const NEXT_STEPS: Record<OrderStatus, OrderStatus[]> = {
  new: ['confirmed', 'cancelled'],
  confirmed: ['shipped', 'cancelled'],
  shipped: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

const METHOD_LABEL: Record<PaymentMethod, string> = {
  online: 'درگاه آنلاین',
  card: 'کارت‌خوان',
  transfer: 'کارت‌به‌کارت / شبا',
  cash: 'نقدی',
  cheque: 'چک صیادی',
};

const CARRIER_LABEL: Record<ShippingCarrier, string> = {
  post: 'پست پیشتاز',
  tipax: 'تیپاکس',
  snappbox: 'اسنپ‌باکس / پیک شهری',
  chapar: 'چاپار',
  pickup: 'تحویل حضوری',
};

const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  planning: 'برنامه‌ریزی',
  in_progress: 'در حال اجرا',
  testing: 'تست و UAT',
  deployed: 'مستقرشده',
  completed: 'تکمیل‌شده',
};

const CHECK_CAT_LABEL = {
  infra: 'زیرساخت و سرور',
  db: 'دیتابیس و بک‌آپ',
  security: 'امنیت و دسترسی',
  training: 'آموزش کاربر',
} as const;

export function OrdersPage() {
  const {
    state,
    addOrder,
    updateOrderStatus,
    recordOrderShipment,
    adjustProductStock,
    addProduct,
    addCoupon,
    toggleCoupon,
    createInvoiceForOrder,
    recordInvoicePayment,
    createWorkflowInstance,
    addProject,
    updateProjectStatus,
    addProjectTask,
    toggleProjectTask,
    addTimeEntry,
    toggleDeploymentCheck,
  } = useClientFlow();

  const [activeTab, setActiveTab] = useState<'orders' | 'invoices' | 'inventory' | 'projects'>('orders');
  const [statusFilter, setStatusFilter] = useState<'all' | 'overdue' | OrderStatus>('all');
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);
  const [trackingDraft, setTrackingDraft] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  // Partial Shipment Form inside Order Detail
  const [shipCarrier, setShipCarrier] = useState<ShippingCarrier>('tipax');
  const [shipTracking, setShipTracking] = useState('');
  const [shipNote, setShipNote] = useState('');
  const [shipQtys, setShipQtys] = useState<Record<string, number>>({});

  // Payment & Preview modals
  const [payInvoice, setPayInvoice] = useState<Invoice | null>(null);
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);
  const [payAmount, setPayAmount] = useState('0');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('online');

  // Create Order form
  const [customerId, setCustomerId] = useState(state.customers[0]?.id ?? '');
  const [selectedItems, setSelectedItems] = useState<{ name: string; qty: number; price: number }[]>([
    {
      name: state.products[0]?.name ?? 'محصول نمونه',
      qty: 1,
      price: state.products[0]?.price ?? 420000,
    },
  ]);
  const [couponCode, setCouponCode] = useState('');
  const [promisedHours, setPromisedHours] = useState(48);
  const [orderError, setOrderError] = useState('');

  // Inventory & Catalog form
  const [newProdName, setNewProdName] = useState('');
  const [newProdSku, setNewProdSku] = useState('');
  const [newProdPrice, setNewProdPrice] = useState('450000');
  const [newProdStock, setNewProdStock] = useState('20');
  const [newProdMinStock, setNewProdMinStock] = useState('5');
  const [newCouponCode, setNewCouponCode] = useState('');
  const [newCouponPct, setNewCouponPct] = useState('15');
  const [stockAdjustTarget, setStockAdjustTarget] = useState<Product | null>(null);
  const [stockDelta, setStockDelta] = useState('10');
  const [stockReason, setStockReason] = useState('تامین موجودی انبار');

  // Projects & Deployment State
  const [selectedProjectId, setSelectedProjectId] = useState(state.projects[0]?.id ?? '');
  const [newProjOpen, setNewProjOpen] = useState(false);
  const [newProjTitle, setNewProjTitle] = useState('');
  const [newProjCustId, setNewProjCustId] = useState(state.customers[0]?.id ?? '');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskAssignee, setNewTaskAssignee] = useState('تیم فنی');
  const [newTaskHours, setNewTaskHours] = useState('4');
  const [timeUser, setTimeUser] = useState('مهندس استقرار');
  const [timeHours, setTimeHours] = useState('2');
  const [timeNote, setTimeNote] = useState('');

  const nowMs = Date.now();

  const lowStockProducts = useMemo(
    () => state.products.filter((p) => p.stock <= (p.minStock ?? 8)),
    [state.products],
  );

  const isOrderOverdue = (o: Order) =>
    Boolean(
      o.promisedAt &&
        new Date(o.promisedAt).getTime() < nowMs &&
        o.status !== 'delivered' &&
        o.status !== 'cancelled',
    );

  const filteredOrders = useMemo(() => {
    return state.orders.filter((o) => {
      if (statusFilter === 'all') return true;
      if (statusFilter === 'overdue') return isOrderOverdue(o);
      return o.status === statusFilter;
    });
  }, [state.orders, statusFilter]);

  const financeSummary = useMemo(() => {
    const totalBilled = state.invoices.reduce((s, inv) => s + inv.grandTotal, 0);
    const totalPaid = state.invoices.reduce((s, inv) => s + inv.paidAmount, 0);
    const receivables = totalBilled - totalPaid;
    return { totalBilled, totalPaid, receivables };
  }, [state.invoices]);

  const orderTotal = (o: Order) =>
    o.items.reduce((sum, it) => sum + it.qty * it.price, 0) - (o.discountAmount ?? 0);

  const handleCreateOrder = (e: React.FormEvent) => {
    e.preventDefault();
    setOrderError('');
    const promisedAt = new Date(Date.now() + promisedHours * 3600_000).toISOString();
    const res = addOrder({
      customerId,
      items: selectedItems,
      promisedAt,
      couponCode: couponCode.trim() || undefined,
    });
    if (!res.ok) {
      setOrderError(res.error ?? 'خطا در ثبت سفارش');
      return;
    }
    setCreateOpen(false);
    setCouponCode('');
  };

  const addDraftProductItem = (productId: string) => {
    const prod = state.products.find((p) => p.id === productId);
    if (!prod) return;
    setSelectedItems((prev) => [...prev, { name: prod.name, qty: 1, price: prod.price }]);
  };

  const activeOrderLogs = useMemo(() => {
    if (!detailOrder) return [];
    return state.orderLogs
      .filter((l) => l.orderId === detailOrder.id)
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [detailOrder, state.orderLogs]);

  const liveDetailOrder = detailOrder
    ? state.orders.find((o) => o.id === detailOrder.id) ?? detailOrder
    : null;

  const shippedTotalsByItem = useMemo(() => {
    const map = new Map<string, number>();
    if (!liveDetailOrder) return map;
    for (const sh of liveDetailOrder.shipments ?? []) {
      for (const it of sh.items) {
        map.set(it.name, (map.get(it.name) ?? 0) + it.qty);
      }
    }
    return map;
  }, [liveDetailOrder]);

  const activeProject =
    state.projects.find((p) => p.id === selectedProjectId) ?? state.projects[0];

  const activeProjectTimeEntries = useMemo(() => {
    if (!activeProject) return [];
    return state.timeEntries.filter((t) => t.projectId === activeProject.id);
  }, [activeProject, state.timeEntries]);

  return (
    <div className="space-y-4">
      {lowStockProducts.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-2.5 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
          <div className="flex items-center gap-2">
            <AlertTriangle size={15} className="shrink-0 text-amber-600" />
            <span>
              هشدار کمبود موجودی انبار:{' '}
              {lowStockProducts.map((p) => `${p.name} (${toFa(p.stock)} عدد)`).join('، ')}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('inventory')}
            className="font-semibold text-amber-800 underline dark:text-amber-300"
          >
            مدیریت انبار
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => setActiveTab('orders')}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === 'orders'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            سفارش‌ها ({toFa(state.orders.length)})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('invoices')}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === 'invoices'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            فاکتورها و مالی ({toFa(state.invoices.length)})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('inventory')}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === 'inventory'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            انبار، گردش موجودی و کوپن ({toFa(state.products.length)})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('projects')}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === 'projects'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            پروژه‌ها، زمان‌سنجی و استقرار ({toFa(state.projects.length)})
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            setOrderError('');
            setCreateOpen(true);
          }}
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700"
        >
          <Plus size={16} />
          ثبت سفارش جدید
        </button>
      </div>

      {/* TAB 1: ORDERS */}
      {activeTab === 'orders' && (
        <>
          <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1 w-fit dark:bg-slate-900">
            {(
              [
                ['all', 'همه'],
                ['overdue', 'دارای تأخیر'],
                ['new', 'جدید'],
                ['confirmed', 'تأییدشده'],
                ['shipped', 'ارسال‌شده'],
                ['delivered', 'تحویل‌شده'],
                ['cancelled', 'لغوشده'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setStatusFilter(key)}
                className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  statusFilter === key
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead className="border-b border-slate-200 bg-slate-50/70 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">شناسه</th>
                    <th className="px-4 py-3 font-medium">مشتری</th>
                    <th className="px-4 py-3 font-medium">اقلام</th>
                    <th className="px-4 py-3 font-medium">مبلغ نهایی</th>
                    <th className="px-4 py-3 font-medium">وضعیت و ارسال</th>
                    <th className="px-4 py-3 font-medium">موعد تحویل</th>
                    <th className="px-4 py-3 font-medium text-left">جزئیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filteredOrders.map((o) => {
                    const cust = state.customers.find((c) => c.id === o.customerId);
                    const overdue = isOrderOverdue(o);
                    return (
                      <tr
                        key={o.id}
                        className={
                          overdue
                            ? 'bg-rose-50/50 hover:bg-rose-50 dark:bg-rose-950/20 dark:hover:bg-rose-950/30'
                            : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                        }
                      >
                        <td className="px-4 py-2.5 text-xs font-mono tabular-nums text-slate-600 dark:text-slate-400">
                          {o.id}
                        </td>
                        <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-slate-100">
                          {cust?.name ?? 'مشتری'}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-slate-600 dark:text-slate-300">
                          {o.items.map((it) => `${it.name} × ${toFa(it.qty)}`).join('، ')}
                        </td>
                        <td className="px-4 py-2.5 text-xs font-medium tabular-nums">
                          {formatToman(orderTotal(o))}
                          {o.couponCode && (
                            <span className="mr-1.5 text-emerald-600 dark:text-emerald-400">
                              (کد {o.couponCode})
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-xs">
                          <div className={`font-medium ${STATUS_COLOR[o.status]}`}>{STATUS_LABEL[o.status]}</div>
                          {(o.shipments?.length ?? 0) > 0 && (
                            <div className="text-[11px] text-slate-500">
                              {toFa(o.shipments?.length ?? 0)} مرسوله ({CARRIER_LABEL[o.shipments![0].carrier]})
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-xs tabular-nums">
                          {o.promisedAt ? (
                            <span
                              className={
                                overdue
                                  ? 'inline-flex items-center gap-1 font-medium text-rose-600 dark:text-rose-400'
                                  : 'text-slate-500 dark:text-slate-400'
                              }
                            >
                              {overdue && <AlertTriangle size={13} />}
                              {overdue ? 'تأخیر · ' : ''}
                              {formatJalaliDateTime(o.promisedAt)}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-left">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => createInvoiceForOrder(o.id)}
                              title="صدور فاکتور"
                              className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                              <Receipt size={13} />
                              فاکتور
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setDetailOrder(o);
                                setTrackingDraft(o.trackingCode ?? '');
                                const defaults: Record<string, number> = {};
                                o.items.forEach((it) => {
                                  defaults[it.name] = it.qty;
                                });
                                setShipQtys(defaults);
                              }}
                              className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                              <Eye size={14} />
                              پیگیری / ارسال
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* TAB 2: INVOICES */}
      {activeTab === 'invoices' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="text-xs text-slate-500">جمع کل فاکتورهای صادره (با ۱۰٪ مالیات)</div>
              <div className="mt-1.5 text-xl font-bold tabular-nums">{formatToman(financeSummary.totalBilled)}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="text-xs text-slate-500">مجموع وصول‌شده</div>
              <div className="mt-1.5 text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                {formatToman(financeSummary.totalPaid)}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="text-xs text-slate-500">مطالبات باز (مانده بدهی)</div>
              <div className="mt-1.5 text-xl font-bold tabular-nums text-rose-600 dark:text-rose-400">
                {formatToman(financeSummary.receivables)}
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead className="border-b border-slate-200 bg-slate-50/70 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">شماره فاکتور</th>
                    <th className="px-4 py-3 font-medium">مشتری</th>
                    <th className="px-4 py-3 font-medium">مبلغ کل</th>
                    <th className="px-4 py-3 font-medium">پرداخت‌شده</th>
                    <th className="px-4 py-3 font-medium">مانده</th>
                    <th className="px-4 py-3 font-medium">وضعیت</th>
                    <th className="px-4 py-3 font-medium text-left">اقدام</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {state.invoices.map((inv) => {
                    const cust = state.customers.find((c) => c.id === inv.customerId);
                    const balance = Math.max(0, inv.grandTotal - inv.paidAmount);
                    return (
                      <tr key={inv.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                        <td className="px-4 py-2.5 text-xs font-mono tabular-nums">{inv.invoiceNo}</td>
                        <td className="px-4 py-2.5 font-medium">{cust?.name ?? 'مشتری'}</td>
                        <td className="px-4 py-2.5 text-xs tabular-nums">{formatToman(inv.grandTotal)}</td>
                        <td className="px-4 py-2.5 text-xs tabular-nums text-emerald-600 dark:text-emerald-400">
                          {formatToman(inv.paidAmount)}
                        </td>
                        <td className="px-4 py-2.5 text-xs tabular-nums text-rose-600 dark:text-rose-400">
                          {formatToman(balance)}
                        </td>
                        <td className="px-4 py-2.5 text-xs font-medium">
                          {inv.status === 'paid'
                            ? 'تسویه‌شده'
                            : inv.status === 'partial'
                              ? 'پرداخت جزئی'
                              : 'صادرشده'}
                          <span className="mr-1.5 text-slate-400">· {METHOD_LABEL[inv.method]}</span>
                        </td>
                        <td className="px-4 py-2.5 text-left">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setPreviewInvoice(inv)}
                              title="پیش‌نمایش و چاپ فاکتور"
                              className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                              <Printer size={13} />
                              چاپ
                            </button>
                            {balance > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setPayInvoice(inv);
                                  setPayAmount(String(balance));
                                  setPayMethod(inv.method);
                                }}
                                className="rounded-md bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700"
                              >
                                ثبت پرداخت
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: INVENTORY, STOCK LEDGER & COUPONS */}
      {activeTab === 'inventory' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <Boxes size={16} className="text-indigo-500" />
                کاتالوگ محصولات و مدیریت موجودی انبار
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newProdName.trim()) return;
                  addProduct({
                    name: newProdName.trim(),
                    sku: newProdSku.trim() || `SK-${state.products.length + 101}`,
                    price: Number(newProdPrice) || 0,
                    stock: Math.max(0, Number(newProdStock) || 0),
                    minStock: Math.max(0, Number(newProdMinStock) || 5),
                    active: true,
                  });
                  setNewProdName('');
                  setNewProdSku('');
                }}
                className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5"
              >
                <input
                  type="text"
                  placeholder="نام محصول..."
                  value={newProdName}
                  onChange={(e) => setNewProdName(e.target.value)}
                  className="col-span-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
                <input
                  type="number"
                  placeholder="قیمت"
                  value={newProdPrice}
                  onChange={(e) => setNewProdPrice(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
                />
                <input
                  type="number"
                  placeholder="موجودی"
                  value={newProdStock}
                  onChange={(e) => setNewProdStock(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                >
                  افزودن
                </button>
              </form>
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {state.products.map((p) => {
                  const isLow = p.stock <= (p.minStock ?? 8);
                  return (
                    <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-xs">
                      <div>
                        <div className="flex items-center gap-2 font-medium text-slate-900 dark:text-slate-100">
                          <span>{p.name}</span>
                          {isLow && (
                            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                              کمبود موجودی
                            </span>
                          )}
                        </div>
                        <div className="text-slate-500 tabular-nums">
                          کد: {p.sku} · موجودی فعلی:{' '}
                          <span className={isLow ? 'font-bold text-rose-600' : 'font-semibold'}>
                            {toFa(p.stock)}
                          </span>{' '}
                          (حداقل مجاز: {toFa(p.minStock ?? 8)})
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold tabular-nums">{formatToman(p.price)}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setStockAdjustTarget(p);
                            setStockDelta('10');
                            setStockReason('شارژ موجودی انبار');
                          }}
                          className="rounded border border-slate-200 px-2 py-1 text-[11px] hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                        >
                          تعدیل انبار
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="mb-3 text-sm font-semibold">کدهای تخفیف (کوپن)</h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newCouponCode.trim()) return;
                  addCoupon({
                    code: newCouponCode.trim(),
                    discountPct: Math.min(90, Math.max(1, Number(newCouponPct) || 10)),
                    maxUses: 50,
                    active: true,
                  });
                  setNewCouponCode('');
                }}
                className="mb-4 flex flex-wrap gap-2"
              >
                <input
                  type="text"
                  dir="ltr"
                  placeholder="SUMMER20"
                  value={newCouponCode}
                  onChange={(e) => setNewCouponCode(e.target.value)}
                  className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs uppercase dark:border-slate-700 dark:bg-slate-800"
                />
                <input
                  type="number"
                  min={1}
                  max={90}
                  value={newCouponPct}
                  onChange={(e) => setNewCouponPct(e.target.value)}
                  className="w-20 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                >
                  ثبت کد
                </button>
              </form>
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {state.coupons.map((cp) => (
                  <div key={cp.id} className="flex items-center justify-between py-2.5 text-xs">
                    <div>
                      <div className="font-mono font-semibold text-slate-900 dark:text-slate-100">{cp.code}</div>
                      <div className="text-slate-500 tabular-nums">
                        {toFa(cp.discountPct)}٪ تخفیف · استفاده‌شده: {toFa(cp.usedCount)} از {toFa(cp.maxUses)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleCoupon(cp.id)}
                      className={`rounded-md border px-2.5 py-1 text-xs font-medium ${
                        cp.active
                          ? 'border-emerald-200 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400'
                          : 'border-slate-200 text-slate-400 dark:border-slate-700'
                      }`}
                    >
                      {cp.active ? 'فعال' : 'غیرفعال'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Stock Movements Ledger */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-3 text-sm font-semibold">دفتر کل گردش موجودی انبار (StockMovement)</h2>
            <p className="mb-3 text-xs text-slate-500">
              با تأیید سفارش موجودی به‌صورت خودکار کسر و با لغو سفارش یا تعدیل دستی به انبار بازگردانده می‌شود.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="border-b border-slate-200 bg-slate-50/70 text-slate-500 dark:border-slate-800 dark:bg-slate-800/40">
                  <tr>
                    <th className="px-3 py-2 font-medium">محصول</th>
                    <th className="px-3 py-2 font-medium">نوع حرکت</th>
                    <th className="px-3 py-2 font-medium">تغییر تعداد</th>
                    <th className="px-3 py-2 font-medium">مانده پس از حرکت</th>
                    <th className="px-3 py-2 font-medium">دلیل / مرجع</th>
                    <th className="px-3 py-2 font-medium">زمان</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {state.stockMovements.map((mv) => (
                    <tr key={mv.id}>
                      <td className="px-3 py-2 font-medium">{mv.productName}</td>
                      <td className="px-3 py-2">
                        {mv.type === 'out' ? 'خروج / حواله' : mv.type === 'in' ? 'ورود / برگشت' : 'تعدیل دستی'}
                      </td>
                      <td
                        className={`px-3 py-2 font-bold tabular-nums ${
                          mv.qtyChange < 0 ? 'text-rose-600' : 'text-emerald-600'
                        }`}
                        dir="ltr"
                      >
                        {mv.qtyChange > 0 ? `+${toFa(mv.qtyChange)}` : toFa(mv.qtyChange)}
                      </td>
                      <td className="px-3 py-2 tabular-nums">{toFa(mv.balanceAfter)}</td>
                      <td className="px-3 py-2 text-slate-500">{mv.reason}</td>
                      <td className="px-3 py-2 tabular-nums text-slate-400">
                        {formatJalaliDateTime(mv.at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: PROJECTS, TIME TRACKING & DEPLOYMENT CHECKLIST */}
      {activeTab === 'projects' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {state.projects.map((p) => {
                const active = activeProject?.id === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedProjectId(p.id)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                      active
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:border-indigo-500 dark:bg-indigo-950/40 dark:text-indigo-300'
                        : 'border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'
                    }`}
                  >
                    {p.title}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => setNewProjOpen(true)}
              className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
            >
              <Plus size={14} />
              پروژه استقرار جدید
            </button>
          </div>

          {activeProject && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <div>
                  <div className="flex items-center gap-2 text-sm font-bold">
                    <FolderKanban size={17} className="text-indigo-500" />
                    {activeProject.title}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    مشتری: {state.customers.find((c) => c.id === activeProject.customerId)?.name ?? 'مشتری'} · موعد:{' '}
                    <span className="tabular-nums">{formatJalali(activeProject.dueAt)}</span>
                  </div>
                </div>
                <select
                  value={activeProject.status}
                  onChange={(e) => updateProjectStatus(activeProject.id, e.target.value as ProjectStatus)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium dark:border-slate-700 dark:bg-slate-800"
                >
                  {(Object.keys(PROJECT_STATUS_LABEL) as ProjectStatus[]).map((st) => (
                    <option key={st} value={st}>
                      وضعیت: {PROJECT_STATUS_LABEL[st]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                {/* Tasks */}
                <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                  <div className="text-xs font-semibold">وظایف اجرایی پروژه</div>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!newTaskTitle.trim()) return;
                      addProjectTask(activeProject.id, {
                        title: newTaskTitle.trim(),
                        assignee: newTaskAssignee.trim() || 'تیم فنی',
                        estimatedHours: Math.max(1, Number(newTaskHours) || 2),
                      });
                      setNewTaskTitle('');
                    }}
                    className="space-y-2"
                  >
                    <input
                      type="text"
                      placeholder="عنوان تسک فنی..."
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                    />
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="مسئول"
                        value={newTaskAssignee}
                        onChange={(e) => setNewTaskAssignee(e.target.value)}
                        className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                      />
                      <input
                        type="number"
                        min={1}
                        value={newTaskHours}
                        onChange={(e) => setNewTaskHours(e.target.value)}
                        className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
                      />
                      <button
                        type="submit"
                        className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                      >
                        افزودن
                      </button>
                    </div>
                  </form>
                  <div className="divide-y divide-slate-200 dark:divide-slate-800">
                    {activeProject.tasks.map((t) => (
                      <label key={t.id} className="flex cursor-pointer items-start gap-2 py-2 text-xs">
                        <input
                          type="checkbox"
                          checked={t.done}
                          onChange={() => toggleProjectTask(activeProject.id, t.id)}
                          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600"
                        />
                        <div className={t.done ? 'line-through text-slate-400' : ''}>
                          <div className="font-medium">{t.title}</div>
                          <div className="text-[11px] text-slate-500">
                            {t.assignee} · برآورد: {toFa(t.estimatedHours)} ساعت
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Time Entries */}
                <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="flex items-center gap-1.5">
                      <Clock size={14} className="text-sky-500" />
                      زمان‌سنجی کارکرد (TimeEntry)
                    </span>
                    <span className="tabular-nums text-indigo-600 dark:text-indigo-400">
                      مجموع: {toFa(activeProjectTimeEntries.reduce((s, e) => s + e.hours, 0))} ساعت
                    </span>
                  </div>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!timeNote.trim()) return;
                      addTimeEntry({
                        projectId: activeProject.id,
                        userName: timeUser.trim() || 'کارشناس فنی',
                        hours: Math.max(0.5, Number(timeHours) || 1),
                        note: timeNote.trim(),
                      });
                      setTimeNote('');
                    }}
                    className="space-y-2"
                  >
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={timeUser}
                        onChange={(e) => setTimeUser(e.target.value)}
                        placeholder="نام کارشناس"
                        className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                      />
                      <input
                        type="number"
                        step="0.5"
                        min={0.5}
                        value={timeHours}
                        onChange={(e) => setTimeHours(e.target.value)}
                        className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
                      />
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={timeNote}
                        onChange={(e) => setTimeNote(e.target.value)}
                        placeholder="شرح کار انجام‌شده..."
                        className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                      />
                      <button
                        type="submit"
                        className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                      >
                        ثبت ساعت
                      </button>
                    </div>
                  </form>
                  <div className="divide-y divide-slate-200 dark:divide-slate-800">
                    {activeProjectTimeEntries.map((te) => (
                      <div key={te.id} className="py-2 text-xs">
                        <div className="flex justify-between font-medium">
                          <span>{te.userName}</span>
                          <span className="tabular-nums text-sky-600 dark:text-sky-400">
                            {toFa(te.hours)} ساعت
                          </span>
                        </div>
                        <div className="mt-0.5 text-[11px] text-slate-500">{te.note}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Deployment Checklist */}
                <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                  {(() => {
                    const doneCount = activeProject.deploymentChecklist.filter((c) => c.done).length;
                    const total = activeProject.deploymentChecklist.length;
                    const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;
                    return (
                      <>
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span className="flex items-center gap-1.5">
                            <CheckSquare size={14} className="text-emerald-500" />
                            چک‌لیست استقرار (Deployment)
                          </span>
                          <span className="tabular-nums text-emerald-600 dark:text-emerald-400">
                            {toFa(pct)}٪ تکمیل
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                          <div
                            className="h-full rounded-full bg-emerald-500 transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="divide-y divide-slate-200 dark:divide-slate-800">
                          {activeProject.deploymentChecklist.map((chk) => (
                            <label key={chk.id} className="flex cursor-pointer items-start gap-2 py-2 text-xs">
                              <input
                                type="checkbox"
                                checked={chk.done}
                                onChange={() => toggleDeploymentCheck(activeProject.id, chk.id)}
                                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600"
                              />
                              <div>
                                <div className={chk.done ? 'line-through text-slate-400' : 'font-medium'}>
                                  {chk.title}
                                </div>
                                <div className="text-[10px] text-slate-500">
                                  {CHECK_CAT_LABEL[chk.category]}
                                  {chk.checkedAt && ` · تأیید: ${formatJalaliDateTime(chk.checkedAt)}`}
                                </div>
                              </div>
                            </label>
                          ))}
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create Order Modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="ثبت سفارش جدید" maxWidth="lg">
        <form onSubmit={handleCreateOrder} className="space-y-4">
          {orderError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
              {orderError}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">مشتری</label>
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                {state.customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">موعد تحویل</label>
              <select
                value={promisedHours}
                onChange={(e) => setPromisedHours(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                <option value={24}>۲۴ ساعت آینده</option>
                <option value={48}>۴۸ ساعت آینده</option>
                <option value={72}>۷۲ ساعت آینده</option>
              </select>
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">اقلام سفارش</label>
              <select
                onChange={(e) => {
                  if (e.target.value) addDraftProductItem(e.target.value);
                  e.target.value = '';
                }}
                defaultValue=""
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="" disabled>
                  + افزودن محصول از کاتالوگ
                </option>
                {state.products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (موجودی: {toFa(p.stock)} · {formatToman(p.price)})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              {selectedItems.map((it, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={it.name}
                    onChange={(e) =>
                      setSelectedItems((prev) =>
                        prev.map((row, rIdx) => (rIdx === idx ? { ...row, name: e.target.value } : row)),
                      )
                    }
                    className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
                  />
                  <input
                    type="number"
                    min={1}
                    value={it.qty}
                    onChange={(e) =>
                      setSelectedItems((prev) =>
                        prev.map((row, rIdx) =>
                          rIdx === idx ? { ...row, qty: Math.max(1, Number(e.target.value)) } : row,
                        ),
                      )
                    }
                    className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm tabular-nums dark:border-slate-700 dark:bg-slate-800"
                  />
                  <input
                    type="number"
                    min={0}
                    value={it.price}
                    onChange={(e) =>
                      setSelectedItems((prev) =>
                        prev.map((row, rIdx) =>
                          rIdx === idx ? { ...row, price: Math.max(0, Number(e.target.value)) } : row,
                        ),
                      )
                    }
                    className="w-28 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm tabular-nums dark:border-slate-700 dark:bg-slate-800"
                  />
                  {selectedItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setSelectedItems((prev) => prev.filter((_, rIdx) => rIdx !== idx))}
                      className="p-1.5 text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
              کد تخفیف (نمونه: WELCOME10 یا VIP20)
            </label>
            <input
              type="text"
              dir="ltr"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value)}
              placeholder="WELCOME10"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm uppercase dark:border-slate-700 dark:bg-slate-800"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm dark:border-slate-700"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              ثبت سفارش
            </button>
          </div>
        </form>
      </Modal>

      {/* Order Detail, Partial Shipments & Carrier Modal */}
      <Modal
        open={Boolean(liveDetailOrder)}
        onClose={() => setDetailOrder(null)}
        title={`جزئیات، ارسال جزئی و پیگیری سفارش ${liveDetailOrder?.id ?? ''}`}
        maxWidth="xl"
      >
        {liveDetailOrder && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4 dark:border-slate-800">
              <div>
                <div className="text-sm font-semibold">
                  مشتری: {state.customers.find((c) => c.id === liveDetailOrder.customerId)?.name ?? 'مشتری'}
                </div>
                <div className="mt-1 text-xs text-slate-500 tabular-nums">
                  وضعیت فعلی:{' '}
                  <span className={`font-semibold ${STATUS_COLOR[liveDetailOrder.status]}`}>
                    {STATUS_LABEL[liveDetailOrder.status]}
                  </span>
                  <span className="mx-2">·</span>
                  مبلغ: {formatToman(orderTotal(liveDetailOrder))}
                  {liveDetailOrder.trackingCode && (
                    <>
                      <span className="mx-2">·</span>
                      کد رهگیری: <span className="font-mono font-medium">{liveDetailOrder.trackingCode}</span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {liveDetailOrder.status === 'confirmed' && (
                  <input
                    type="text"
                    dir="ltr"
                    value={trackingDraft}
                    onChange={(e) => setTrackingDraft(e.target.value)}
                    placeholder="کد رهگیری پست/تیپاکس"
                    className="w-40 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-mono dark:border-slate-700 dark:bg-slate-800"
                  />
                )}
                {NEXT_STEPS[liveDetailOrder.status].map((nextSt) => (
                  <button
                    key={nextSt}
                    type="button"
                    onClick={() =>
                      updateOrderStatus(
                        liveDetailOrder.id,
                        nextSt,
                        nextSt === 'shipped' ? trackingDraft : undefined,
                      )
                    }
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                      nextSt === 'cancelled'
                        ? 'border border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-400'
                        : 'bg-indigo-600 text-white hover:bg-indigo-700'
                    }`}
                  >
                    تغییر به «{STATUS_LABEL[nextSt]}»
                  </button>
                ))}
                {liveDetailOrder.status === 'delivered' && (
                  <button
                    type="button"
                    onClick={() => {
                      createWorkflowInstance({
                        title: `درخواست مرجوعی سفارش ${liveDetailOrder.id}`,
                        type: 'order_return',
                        customerId: liveDetailOrder.customerId,
                        relatedRef: liveDetailOrder.id,
                      });
                      setDetailOrder(null);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-950/30"
                  >
                    <RotateCcw size={13} />
                    درخواست مرجوعی
                  </button>
                )}
              </div>
            </div>

            {/* Partial Shipments & Carrier Section */}
            {liveDetailOrder.status !== 'cancelled' && liveDetailOrder.status !== 'delivered' && (
              <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/30">
                <div className="flex items-center gap-1.5 text-xs font-semibold">
                  <Truck size={15} className="text-indigo-500" />
                  ثبت ارسال جزئی (Partial Shipment) و انتخاب شرکت حمل
                </div>
                <div className="space-y-2">
                  {liveDetailOrder.items.map((it) => {
                    const alreadyShipped = shippedTotalsByItem.get(it.name) ?? 0;
                    const remaining = Math.max(0, it.qty - alreadyShipped);
                    return (
                      <div
                        key={it.name}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900"
                      >
                        <div>
                          <span className="font-medium">{it.name}</span>
                          <span className="mx-2 text-slate-400">·</span>
                          <span className="tabular-nums text-slate-500">
                            کل: {toFa(it.qty)} | ارسال‌شده: {toFa(alreadyShipped)} | مانده: {toFa(remaining)}
                          </span>
                        </div>
                        <input
                          type="number"
                          min={0}
                          max={remaining}
                          value={shipQtys[it.name] ?? remaining}
                          onChange={(e) =>
                            setShipQtys((prev) => ({
                              ...prev,
                              [it.name]: Math.max(0, Math.min(remaining, Number(e.target.value) || 0)),
                            }))
                          }
                          className="w-20 rounded border border-slate-200 bg-white px-2 py-1 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <select
                    value={shipCarrier}
                    onChange={(e) => setShipCarrier(e.target.value as ShippingCarrier)}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
                  >
                    {(Object.keys(CARRIER_LABEL) as ShippingCarrier[]).map((c) => (
                      <option key={c} value={c}>
                        {CARRIER_LABEL[c]}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    dir="ltr"
                    value={shipTracking}
                    onChange={(e) => setShipTracking(e.target.value)}
                    placeholder="کد رهگیری مرسوله..."
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-left font-mono text-xs dark:border-slate-700 dark:bg-slate-900"
                  />
                  <input
                    type="text"
                    value={shipNote}
                    onChange={(e) => setShipNote(e.target.value)}
                    placeholder="یادداشت بسته..."
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      const itemsToShip = liveDetailOrder.items
                        .map((it) => ({
                          name: it.name,
                          qty: shipQtys[it.name] ?? Math.max(0, it.qty - (shippedTotalsByItem.get(it.name) ?? 0)),
                        }))
                        .filter((x) => x.qty > 0);
                      if (itemsToShip.length === 0) return;
                      recordOrderShipment(liveDetailOrder.id, {
                        carrier: shipCarrier,
                        trackingCode: shipTracking.trim() || `TRK-${Math.floor(100000 + Math.random() * 899999)}`,
                        items: itemsToShip,
                        note: shipNote.trim() || undefined,
                      });
                      setShipTracking('');
                      setShipNote('');
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                  >
                    <PackageCheck size={14} />
                    ثبت مرسوله ارسالی
                  </button>
                </div>
              </div>
            )}

            {(liveDetailOrder.shipments?.length ?? 0) > 0 && (
              <div>
                <h3 className="mb-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                  بسته‌ها و مرسوله‌های ثبت‌شده ({toFa(liveDetailOrder.shipments?.length ?? 0)})
                </h3>
                <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                  {(liveDetailOrder.shipments ?? []).map((sh) => (
                    <div key={sh.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs">
                      <div>
                        <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                          {CARRIER_LABEL[sh.carrier]}
                        </span>
                        <span className="mx-2 font-mono text-slate-500">({sh.trackingCode})</span>
                        <span>{sh.items.map((x) => `${x.name} × ${toFa(x.qty)}`).join('، ')}</span>
                      </div>
                      <span className="tabular-nums text-slate-400">{formatJalaliDateTime(sh.shippedAt)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h3 className="mb-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                تاریخچه تغییر وضعیت (OrderStatusLog)
              </h3>
              <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                {activeOrderLogs.map((log) => (
                  <div key={log.id} className="flex items-center justify-between px-3 py-2 text-xs">
                    <span>
                      {STATUS_LABEL[log.from as OrderStatus] ?? log.from} ←{' '}
                      <span className="font-semibold">
                        {STATUS_LABEL[log.to as OrderStatus] ?? log.to}
                      </span>
                    </span>
                    <span className="tabular-nums text-slate-500 dark:text-slate-400">
                      {formatJalaliDateTime(log.at)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Stock Adjustment Modal */}
      <Modal
        open={Boolean(stockAdjustTarget)}
        onClose={() => setStockAdjustTarget(null)}
        title={`تعدیل موجودی انبار: ${stockAdjustTarget?.name ?? ''}`}
        maxWidth="sm"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!stockAdjustTarget) return;
            const delta = Number(stockDelta);
            if (!Number.isFinite(delta) || delta === 0) return;
            adjustProductStock(stockAdjustTarget.id, delta, stockReason || 'تعدیل دستی انبار');
            setStockAdjustTarget(null);
          }}
          className="space-y-4"
        >
          <div className="text-xs text-slate-500">
            موجودی فعلی: <span className="font-bold tabular-nums">{toFa(stockAdjustTarget?.stock ?? 0)} عدد</span>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">تغییر تعداد (مثبت برای افزایش، منفی برای کسر)</label>
            <input
              type="number"
              value={stockDelta}
              onChange={(e) => setStockDelta(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm tabular-nums dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">دلیل تعدیل</label>
            <input
              type="text"
              value={stockReason}
              onChange={(e) => setStockReason(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setStockAdjustTarget(null)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs dark:border-slate-700"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700"
            >
              ثبت تعدیل انبار
            </button>
          </div>
        </form>
      </Modal>

      {/* New Project Modal */}
      <Modal open={newProjOpen} onClose={() => setNewProjOpen(false)} title="ایجاد پروژه جدید و چک‌لیست استقرار" maxWidth="sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!newProjTitle.trim()) return;
            addProject({
              title: newProjTitle.trim(),
              customerId: newProjCustId,
              dueAt: new Date(Date.now() + 14 * 24 * 3600_000).toISOString(),
            });
            setNewProjTitle('');
            setNewProjOpen(false);
          }}
          className="space-y-4"
        >
          <div>
            <label className="mb-1 block text-xs text-slate-500">عنوان پروژه *</label>
            <input
              type="text"
              required
              value={newProjTitle}
              onChange={(e) => setNewProjTitle(e.target.value)}
              placeholder="مثلاً: استقرار نرم‌افزار در هلدینگ سپهر"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">مشتری / کارفرما</label>
            <select
              value={newProjCustId}
              onChange={(e) => setNewProjCustId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
            >
              {state.customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setNewProjOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs dark:border-slate-700"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700"
            >
              ایجاد پروژه
            </button>
          </div>
        </form>
      </Modal>

      {/* Record Payment Modal */}
      <Modal
        open={Boolean(payInvoice)}
        onClose={() => setPayInvoice(null)}
        title={`ثبت پرداخت فاکتور ${payInvoice?.invoiceNo ?? ''}`}
        maxWidth="sm"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!payInvoice) return;
            recordInvoicePayment(payInvoice.id, Number(payAmount) || 0, payMethod);
            setPayInvoice(null);
          }}
          className="space-y-4"
        >
          <div>
            <label className="mb-1 block text-xs text-slate-500">مبلغ پرداختی (تومان)</label>
            <input
              type="number"
              min={1}
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm tabular-nums dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">روش پرداخت</label>
            <select
              value={payMethod}
              onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="online">درگاه آنلاین</option>
              <option value="card">کارت‌خوان</option>
              <option value="transfer">کارت‌به‌کارت / شبا</option>
              <option value="cash">نقدی</option>
              <option value="cheque">چک صیادی</option>
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setPayInvoice(null)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm dark:border-slate-700"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              ثبت پرداخت
            </button>
          </div>
        </form>
      </Modal>

      <InvoicePreviewModal
        invoice={previewInvoice}
        onClose={() => setPreviewInvoice(null)}
      />
    </div>
  );
}
