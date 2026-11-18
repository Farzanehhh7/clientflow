import { useMemo, useState } from 'react';
import { AlertTriangle, Eye, Plus, Receipt, Trash2 } from 'lucide-react';
import { Modal } from '../components/Modal';
import { useClientFlow } from '../store/useClientFlowStore';
import type { Invoice, Order, OrderStatus, PaymentMethod } from '../types';
import { formatJalaliDateTime, formatToman, toFa } from '../utils/jalali';

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

export function OrdersPage() {
  const {
    state,
    addOrder,
    updateOrderStatus,
    addProduct,
    addCoupon,
    toggleCoupon,
    createInvoiceForOrder,
    recordInvoicePayment,
  } = useClientFlow();
  const [activeTab, setActiveTab] = useState<'orders' | 'invoices' | 'catalog'>('orders');
  const [statusFilter, setStatusFilter] = useState<'all' | 'overdue' | OrderStatus>('all');
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  // Payment modal
  const [payInvoice, setPayInvoice] = useState<Invoice | null>(null);
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

  // Catalog form
  const [newProdName, setNewProdName] = useState('');
  const [newProdSku, setNewProdSku] = useState('');
  const [newProdPrice, setNewProdPrice] = useState('450000');
  const [newCouponCode, setNewCouponCode] = useState('');
  const [newCouponPct, setNewCouponPct] = useState('15');

  const nowMs = Date.now();

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

  return (
    <div className="space-y-4">
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
            onClick={() => setActiveTab('catalog')}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === 'catalog'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            محصولات و کد تخفیف ({toFa(state.products.length)})
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
                    <th className="px-4 py-3 font-medium">وضعیت</th>
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
                        <td className={`px-4 py-2.5 text-xs font-medium ${STATUS_COLOR[o.status]}`}>
                          {STATUS_LABEL[o.status]}
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
                              onClick={() => setDetailOrder(o)}
                              className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                              <Eye size={14} />
                              پیگیری
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

      {activeTab === 'catalog' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-3 text-sm font-semibold">کاتالوگ محصولات</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newProdName.trim()) return;
                addProduct({
                  name: newProdName.trim(),
                  sku: newProdSku.trim() || `SK-${state.products.length + 101}`,
                  price: Number(newProdPrice) || 0,
                  stock: 20,
                  active: true,
                });
                setNewProdName('');
                setNewProdSku('');
              }}
              className="mb-4 flex flex-wrap gap-2"
            >
              <input
                type="text"
                placeholder="نام محصول..."
                value={newProdName}
                onChange={(e) => setNewProdName(e.target.value)}
                className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
              <input
                type="number"
                placeholder="قیمت (تومان)"
                value={newProdPrice}
                onChange={(e) => setNewProdPrice(e.target.value)}
                className="w-32 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
              />
              <button
                type="submit"
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
              >
                افزودن
              </button>
            </form>
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {state.products.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-2.5 text-xs">
                  <div>
                    <div className="font-medium text-slate-900 dark:text-slate-100">{p.name}</div>
                    <div className="text-slate-500 tabular-nums">
                      کد: {p.sku} · موجودی: {toFa(p.stock)}
                    </div>
                  </div>
                  <div className="font-semibold tabular-nums">{formatToman(p.price)}</div>
                </div>
              ))}
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
                    {p.name} ({formatToman(p.price)})
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

      {/* Order Detail & Status Log Modal */}
      <Modal
        open={Boolean(liveDetailOrder)}
        onClose={() => setDetailOrder(null)}
        title={`جزئیات سفارش ${liveDetailOrder?.id ?? ''}`}
        maxWidth="lg"
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
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {NEXT_STEPS[liveDetailOrder.status].map((nextSt) => (
                  <button
                    key={nextSt}
                    type="button"
                    onClick={() => updateOrderStatus(liveDetailOrder.id, nextSt)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                      nextSt === 'cancelled'
                        ? 'border border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-400'
                        : 'bg-indigo-600 text-white hover:bg-indigo-700'
                    }`}
                  >
                    تغییر به «{STATUS_LABEL[nextSt]}»
                  </button>
                ))}
              </div>
            </div>

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
    </div>
  );
}
