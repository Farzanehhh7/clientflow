import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Eye, Receipt, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';
import { DynamicFieldsRenderer } from '../DynamicFieldsRenderer';
import { Modal } from '../Modal';
import { getPackOrderConfig } from '../../data/packs';
import { useClientFlow } from '../../store/useClientFlowStore';
import type { Order, OrderChannel, OrderStatus } from '../../types';
import {
  formatCustomFieldValue,
  getFieldsForEntity,
  getTableCustomFields,
  validateCustomFieldValues,
} from '../../utils/customFieldValidation';
import { formatJalaliDateTime, formatToman, toFa } from '../../utils/jalali';
import { hasPermission } from '../../utils/security';
import { OrderDetailModal } from './OrderDetailModal';
import {
  CARRIER_LABEL,
  ORDER_CHANNEL_LABEL,
  ORDER_STATUS_COLOR,
  isOrderOverdue,
  orderTotal,
} from './orderHelpers';

type OrdersTabProps = {
  branchOrders: Order[];
  createOpen: boolean;
  setCreateOpen: (open: boolean) => void;
};

const makeIdempotencyKey = () =>
  `ord-key-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export function OrdersTab({ branchOrders, createOpen, setCreateOpen }: OrdersTabProps) {
  const { state, addOrder, createInvoiceForOrder, softDeleteEntity } = useClientFlow();
  const canDeleteOrder = hasPermission(state, 'orders', 'delete');

  const packOrderConfig = useMemo(
    () => getPackOrderConfig(state.settings.industryPack, state.customPacks),
    [state.settings.industryPack, state.customPacks],
  );

  const [statusFilter, setStatusFilter] = useState<'all' | 'overdue' | OrderStatus>('all');
  const [channelFilter, setChannelFilter] = useState<'all' | OrderChannel>('all');
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);

  // Create order modal state
  const [customerId, setCustomerId] = useState(state.customers[0]?.id ?? '');
  const [channel, setChannel] = useState<OrderChannel>(packOrderConfig.channelDefault ?? 'website');
  const [idempotencyKey, setIdempotencyKey] = useState(makeIdempotencyKey);
  const submittingRef = useRef(false);
  const [selectedItems, setSelectedItems] = useState<
    { productId?: string; name: string; qty: number; price: number }[]
  >([
    {
      productId: state.products[0]?.id,
      name: state.products[0]?.name ?? 'محصول نمونه',
      qty: 1,
      price: state.products[0]?.price ?? 420000,
    },
  ]);
  const [couponCode, setCouponCode] = useState('');
  const [promisedHours, setPromisedHours] = useState(48);
  const [orderCustomFields, setOrderCustomFields] = useState<Record<string, string>>({});
  const [orderCustomErrors, setOrderCustomErrors] = useState<Record<string, string>>({});
  const [orderError, setOrderError] = useState('');

  useEffect(() => {
    if (createOpen) {
      setIdempotencyKey(makeIdempotencyKey());
      setChannel(packOrderConfig.channelDefault ?? 'website');
      setOrderError('');
      setOrderCustomErrors({});
    }
  }, [createOpen, packOrderConfig.channelDefault]);

  const nowMs = Date.now();
  const filteredOrders = useMemo(() => {
    return branchOrders
      .filter((o) => !o.isDeleted)
      .filter((o) => {
        if (channelFilter !== 'all' && (o.channel ?? 'website') !== channelFilter) return false;
        if (statusFilter === 'all') return true;
        if (statusFilter === 'overdue') return isOrderOverdue(o, nowMs);
        return o.status === statusFilter;
      });
  }, [branchOrders, statusFilter, channelFilter, nowMs]);

  const orderActiveFields = useMemo(
    () => getFieldsForEntity(state.customFieldDefs, 'order', false),
    [state.customFieldDefs],
  );
  const orderTableCustomFields = useMemo(
    () => getTableCustomFields(state.customFieldDefs, 'order'),
    [state.customFieldDefs],
  );

  const handleCreateOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;
    setOrderError('');
    setOrderCustomErrors({});
    const cfValidation = validateCustomFieldValues(state.customFieldDefs, orderCustomFields, {
      entity: 'order',
      existingRecords: state.orders,
    });
    if (!cfValidation.ok) {
      setOrderCustomErrors(cfValidation.errors);
      return;
    }
    submittingRef.current = true;
    const promisedAt = new Date(Date.now() + promisedHours * 3600_000).toISOString();
    const res = addOrder({
      customerId,
      channel,
      idempotencyKey,
      items: selectedItems,
      promisedAt,
      couponCode: couponCode.trim() || undefined,
      customFields: orderCustomFields,
    });
    submittingRef.current = false;
    if (!res.ok) {
      setOrderError(res.error ?? 'خطا در ثبت سفارش');
      return;
    }
    setCreateOpen(false);
    setCouponCode('');
    setOrderCustomFields({});
  };

  const addDraftProductItem = (productId: string) => {
    const prod = state.products.find((p) => p.id === productId);
    if (!prod) return;
    setSelectedItems((prev) => [
      ...prev,
      { productId: prod.id, name: prod.name, qty: 1, price: prod.price },
    ]);
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-900">
          {(
            [
              ['all', 'همه'],
              ['overdue', 'دارای تأخیر'],
              ['new', packOrderConfig.statusLabels.new],
              ['confirmed', packOrderConfig.statusLabels.confirmed],
              ['shipped', packOrderConfig.statusLabels.shipped],
              ['delivered', packOrderConfig.statusLabels.delivered],
              ['cancelled', packOrderConfig.statusLabels.cancelled],
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

        <select
          value={channelFilter}
          onChange={(e) => setChannelFilter(e.target.value as 'all' | OrderChannel)}
          aria-label="فیلتر کانال سفارش"
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
        >
          <option value="all">همه کانال‌ها</option>
          {(Object.keys(ORDER_CHANNEL_LABEL) as OrderChannel[]).map((ch) => (
            <option key={ch} value={ch}>
              کانال: {ORDER_CHANNEL_LABEL[ch]}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="border-b border-slate-200 bg-slate-50/70 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">شناسه / کانال</th>
                <th className="px-4 py-3 font-medium">مشتری</th>
                <th className="px-4 py-3 font-medium">اقلام</th>
                <th className="px-4 py-3 font-medium">مبلغ نهایی</th>
                <th className="px-4 py-3 font-medium">وضعیت و ارسال</th>
                <th className="px-4 py-3 font-medium">موعد تحویل</th>
                {orderTableCustomFields.map((def) => (
                  <th key={def.id} className="px-4 py-3 font-medium">
                    {def.label}
                  </th>
                ))}
                <th className="px-4 py-3 text-left font-medium">جزئیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filteredOrders.map((o) => {
                const cust = state.customers.find((c) => c.id === o.customerId);
                const overdue = isOrderOverdue(o, nowMs);
                return (
                  <tr
                    key={o.id}
                    className={
                      overdue
                        ? 'bg-rose-50/50 hover:bg-rose-50 dark:bg-rose-950/20 dark:hover:bg-rose-950/30'
                        : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                    }
                  >
                    <td className="px-4 py-2.5 text-xs">
                      <div className="font-mono tabular-nums text-slate-700 dark:text-slate-300">
                        {o.id}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {ORDER_CHANNEL_LABEL[o.channel ?? 'website']}
                      </div>
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
                      <div className={`font-medium ${ORDER_STATUS_COLOR[o.status]}`}>
                        {packOrderConfig.statusLabels[o.status] ?? o.status}
                      </div>
                      {(o.shipments?.length ?? 0) > 0 && (
                        <div className="text-[11px] text-slate-500">
                          {toFa(o.shipments?.length ?? 0)} مرسوله ({CARRIER_LABEL[o.shipments![0].carrier]})
                        </div>
                      )}
                      {(o.returns?.length ?? 0) > 0 && (
                        <div className="text-[11px] text-amber-600 dark:text-amber-400">
                          {toFa(o.returns?.length ?? 0)} مورد مرجوعی
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
                    {orderTableCustomFields.map((def) => (
                      <td key={def.id} className="px-4 py-2.5 text-xs text-slate-600 dark:text-slate-300">
                        {formatCustomFieldValue(def, o.customFields?.[def.key])}
                      </td>
                    ))}
                    <td className="px-4 py-2.5 text-left">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => createInvoiceForOrder(o.id)}
                          title="صدور فاکتور"
                          className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          <Receipt size={13} />
                          فاکتور
                        </button>
                        <button
                          type="button"
                          onClick={() => setDetailOrder(o)}
                          className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          <Eye size={14} />
                          پیگیری / ارسال
                        </button>
                        {canDeleteOrder && (
                          <button
                            type="button"
                            onClick={() => softDeleteEntity('order', o.id)}
                            title="انتقال به سطل بازیافت"
                            aria-label={`حذف سفارش ${o.id}`}
                            className="rounded-md border border-slate-200 p-1 text-slate-400 hover:border-rose-200 hover:text-rose-600 dark:border-slate-700 dark:hover:border-rose-900 dark:hover:text-rose-400"
                          >
                            <Trash2 size={14} />
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

      {/* Create Order Modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="ثبت سفارش جدید" maxWidth="lg">
        <form onSubmit={handleCreateOrder} className="space-y-4">
          {orderError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
              {orderError}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                مشتری
              </label>
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
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                کانال ثبت سفارش
              </label>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value as OrderChannel)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                {(Object.keys(ORDER_CHANNEL_LABEL) as OrderChannel[]).map((ch) => (
                  <option key={ch} value={ch}>
                    {ORDER_CHANNEL_LABEL[ch]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                موعد تحویل
              </label>
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
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                اقلام سفارش (تثبیت قیمت زمان ثبت)
              </label>
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

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
            <div>
              <label className="mb-1 flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-400">
                <ShieldCheck size={13} className="text-emerald-500" />
                کلید ضدتکرار (Idempotency Key)
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  dir="ltr"
                  value={idempotencyKey}
                  onChange={(e) => setIdempotencyKey(e.target.value)}
                  className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-left font-mono text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                />
                <button
                  type="button"
                  onClick={() => setIdempotencyKey(makeIdempotencyKey())}
                  title="تولید کلید یکتای جدید"
                  className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  <RefreshCw size={14} />
                </button>
              </div>
            </div>
          </div>

          {orderActiveFields.length > 0 && (
            <div className="border-t border-slate-200 pt-3 dark:border-slate-800">
              <p className="mb-2 text-xs font-semibold text-slate-500">فیلدهای سفارشی سفارش</p>
              <DynamicFieldsRenderer
                entity="order"
                defs={state.customFieldDefs}
                values={orderCustomFields}
                onChange={setOrderCustomFields}
                errors={orderCustomErrors}
              />
            </div>
          )}

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

      <OrderDetailModal
        order={detailOrder}
        onClose={() => setDetailOrder(null)}
        packOrderConfig={packOrderConfig}
      />
    </>
  );
}
