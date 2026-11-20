import { useEffect, useMemo, useState } from 'react';
import { PackageCheck, RotateCcw, Truck } from 'lucide-react';
import { Modal } from '../Modal';
import { useClientFlow } from '../../store/useClientFlowStore';
import type { Order, OrderStatus, PackOrderConfig, PaymentMethod, ShippingCarrier } from '../../types';
import { formatJalaliDateTime, formatToman, toFa } from '../../utils/jalali';
import {
  CARRIER_LABEL,
  ORDER_CHANNEL_LABEL,
  ORDER_STATUS_COLOR,
  PAYMENT_METHOD_LABEL,
  orderTotal,
} from './orderHelpers';

type OrderDetailModalProps = {
  order: Order | null;
  onClose: () => void;
  packOrderConfig: PackOrderConfig;
};

export function OrderDetailModal({ order, onClose, packOrderConfig }: OrderDetailModalProps) {
  const {
    state,
    updateOrderStatus,
    recordOrderShipment,
    recordOrderReturn,
    createWorkflowInstance,
  } = useClientFlow();

  const liveOrder = order ? state.orders.find((o) => o.id === order.id) ?? order : null;

  const [trackingDraft, setTrackingDraft] = useState('');
  const [shipCarrier, setShipCarrier] = useState<ShippingCarrier>('tipax');
  const [shipTracking, setShipTracking] = useState('');
  const [shipNote, setShipNote] = useState('');
  const [shipQtys, setShipQtys] = useState<Record<string, number>>({});

  // Return & Refund State
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnQtys, setReturnQtys] = useState<Record<string, number>>({});
  const [refundMethod, setRefundMethod] = useState<PaymentMethod>('transfer');
  const [returnReason, setReturnReason] = useState('انصراف / مغایرت کالا');
  const [returnRestock, setReturnRestock] = useState(true);
  const [customRefund, setCustomRefund] = useState('');

  useEffect(() => {
    if (!order) return;
    setTrackingDraft(order.trackingCode ?? '');
    const defaults: Record<string, number> = {};
    order.items.forEach((it) => {
      defaults[it.name] = it.qty;
    });
    setShipQtys(defaults);
    setReturnQtys(Object.fromEntries(order.items.map((it) => [it.name, 0])));
    setReturnOpen(false);
    setCustomRefund('');
  }, [order?.id]);

  const shippedTotals = useMemo(() => {
    const map = new Map<string, number>();
    if (!liveOrder) return map;
    for (const sh of liveOrder.shipments ?? []) {
      for (const it of sh.items) {
        map.set(it.name, (map.get(it.name) ?? 0) + it.qty);
      }
    }
    return map;
  }, [liveOrder]);

  const activeLogs = useMemo(() => {
    if (!liveOrder) return [];
    return state.orderLogs
      .filter((l) => l.orderId === liveOrder.id)
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [liveOrder, state.orderLogs]);

  const calculatedRefund = useMemo(() => {
    if (!liveOrder) return 0;
    return liveOrder.items.reduce(
      (sum, it) => sum + (returnQtys[it.name] ?? 0) * (it.unitPriceSnapshot ?? it.price),
      0,
    );
  }, [liveOrder, returnQtys]);

  const statusLabel = (s: OrderStatus | string) =>
    packOrderConfig.statusLabels[s as OrderStatus] ?? s;

  const nextTransitions = liveOrder
    ? packOrderConfig.transitions[liveOrder.status] ?? []
    : [];

  return (
    <Modal
      open={Boolean(liveOrder)}
      onClose={onClose}
      title={`جزئیات، ارسال جزئی و مرجوعی سفارش ${liveOrder?.id ?? ''}`}
      maxWidth="xl"
    >
      {liveOrder && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4 dark:border-slate-800">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                <span>
                  مشتری: {state.customers.find((c) => c.id === liveOrder.customerId)?.name ?? 'مشتری'}
                </span>
                <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-normal text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  کانال: {ORDER_CHANNEL_LABEL[liveOrder.channel ?? 'website']}
                </span>
              </div>
              <div className="mt-1 text-xs text-slate-500 tabular-nums">
                وضعیت فعلی:{' '}
                <span className={`font-semibold ${ORDER_STATUS_COLOR[liveOrder.status]}`}>
                  {statusLabel(liveOrder.status)}
                </span>
                <span className="mx-2">·</span>
                مبلغ: {formatToman(orderTotal(liveOrder))}
                {liveOrder.trackingCode && (
                  <>
                    <span className="mx-2">·</span>
                    کد رهگیری: <span className="font-mono font-medium">{liveOrder.trackingCode}</span>
                  </>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {liveOrder.status === 'confirmed' && (
                <input
                  type="text"
                  dir="ltr"
                  value={trackingDraft}
                  onChange={(e) => setTrackingDraft(e.target.value)}
                  placeholder="کد رهگیری پست/تیپاکس"
                  className="w-40 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
                />
              )}
              {nextTransitions.map((nextSt) => (
                <button
                  key={nextSt}
                  type="button"
                  onClick={() =>
                    updateOrderStatus(
                      liveOrder.id,
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
                  تغییر به «{statusLabel(nextSt)}»
                </button>
              ))}
              {liveOrder.status !== 'cancelled' && (
                <button
                  type="button"
                  onClick={() => setReturnOpen((prev) => !prev)}
                  className="inline-flex items-center gap-1 rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-950/30"
                >
                  <RotateCcw size={13} />
                  {returnOpen ? 'بستن فرم مرجوعی' : 'ثبت مرجوعی و استرداد'}
                </button>
              )}
            </div>
          </div>

          {/* Line items with Price Snapshot */}
          <div className="rounded-lg border border-slate-200 p-3 text-xs dark:border-slate-800">
            <div className="mb-2 font-semibold text-slate-600 dark:text-slate-300">
              اقلام سفارش (همراه با Price Snapshot زمان ثبت)
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {liveOrder.items.map((it) => {
                const snapPrice = it.unitPriceSnapshot ?? it.price;
                return (
                  <div key={it.name} className="flex items-center justify-between py-1.5">
                    <span>
                      {it.name} × <span className="tabular-nums">{toFa(it.qty)}</span>
                    </span>
                    <span className="tabular-nums text-slate-600 dark:text-slate-300">
                      فی تثبیت‌شده: {formatToman(snapPrice)} · جمع: {formatToman(snapPrice * it.qty)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Explicit Order Return & Refund Form */}
          {returnOpen && (
            <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/40 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                  ثبت مرجوعی کالا و استرداد وجه
                </span>
                <button
                  type="button"
                  onClick={() => {
                    createWorkflowInstance({
                      title: `درخواست مرجوعی سفارش ${liveOrder.id}`,
                      type: 'order_return',
                      customerId: liveOrder.customerId,
                      relatedRef: liveOrder.id,
                    });
                  }}
                  className="text-[11px] font-medium text-indigo-600 underline dark:text-indigo-400"
                >
                  ارسال همزمان به گردش‌کار تأیید (BPMS)
                </button>
              </div>
              <div className="space-y-2">
                {liveOrder.items.map((it) => (
                  <div
                    key={it.name}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200/70 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
                  >
                    <span>
                      {it.name} (خریداری‌شده: {toFa(it.qty)})
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={it.qty}
                      value={returnQtys[it.name] ?? 0}
                      onChange={(e) =>
                        setReturnQtys((prev) => ({
                          ...prev,
                          [it.name]: Math.max(0, Math.min(it.qty, Number(e.target.value) || 0)),
                        }))
                      }
                      className="w-20 rounded border border-slate-200 bg-white px-2 py-1 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <input
                  type="number"
                  min={0}
                  value={customRefund !== '' ? customRefund : calculatedRefund}
                  onChange={(e) => setCustomRefund(e.target.value)}
                  placeholder="مبلغ استرداد (تومان)"
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-900"
                />
                <select
                  value={refundMethod}
                  onChange={(e) => setRefundMethod(e.target.value as PaymentMethod)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
                >
                  {(Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map((m) => (
                    <option key={m} value={m}>
                      {PAYMENT_METHOD_LABEL[m]}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  placeholder="دلیل مرجوعی..."
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={returnRestock}
                    onChange={(e) => setReturnRestock(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                  />
                  بازگشت خودکار اقلام به موجودی انبار (StockMovement ورودی)
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const returnedItems = liveOrder.items
                      .map((it) => ({
                        name: it.name,
                        qty: returnQtys[it.name] ?? 0,
                        price: it.unitPriceSnapshot ?? it.price,
                      }))
                      .filter((x) => x.qty > 0);
                    if (returnedItems.length === 0) return;
                    const finalRefund =
                      customRefund !== '' ? Math.max(0, Number(customRefund) || 0) : calculatedRefund;
                    recordOrderReturn(liveOrder.id, {
                      items: returnedItems,
                      refundAmount: finalRefund,
                      refundMethod,
                      reason: returnReason.trim() || 'مرجوعی سفارش',
                      restock: returnRestock,
                    });
                    setReturnOpen(false);
                  }}
                  className="rounded-lg bg-amber-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-amber-700"
                >
                  ثبت نهایی مرجوعی و استرداد
                </button>
              </div>
            </div>
          )}

          {/* Recorded Returns History */}
          {(liveOrder.returns?.length ?? 0) > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-semibold text-amber-700 dark:text-amber-400">
                سوابق مرجوعی و استرداد وجه ({toFa(liveOrder.returns?.length ?? 0)})
              </h3>
              <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                {(liveOrder.returns ?? []).map((ret) => (
                  <div key={ret.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs">
                    <div>
                      <span className="font-medium">
                        {ret.items.map((x) => `${x.name} × ${toFa(x.qty)}`).join('، ')}
                      </span>
                      <span className="mx-2 text-slate-400">·</span>
                      <span className="text-slate-600 dark:text-slate-300">{ret.reason}</span>
                      {ret.restock && (
                        <span className="mr-2 text-[11px] text-emerald-600 dark:text-emerald-400">
                          (بازگشت به انبار)
                        </span>
                      )}
                    </div>
                    <div className="tabular-nums text-rose-600 dark:text-rose-400">
                      استرداد {formatToman(ret.refundAmount)} ({PAYMENT_METHOD_LABEL[ret.refundMethod]})
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Partial Shipments & Carrier Section */}
          {liveOrder.status !== 'cancelled' && liveOrder.status !== 'delivered' && (
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/30">
              <div className="flex items-center gap-1.5 text-xs font-semibold">
                <Truck size={15} className="text-indigo-500" />
                ثبت ارسال جزئی (Partial Shipment) و انتخاب شرکت حمل
              </div>
              <div className="space-y-2">
                {liveOrder.items.map((it) => {
                  const alreadyShipped = shippedTotals.get(it.name) ?? 0;
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
                    const itemsToShip = liveOrder.items
                      .map((it) => ({
                        name: it.name,
                        qty: shipQtys[it.name] ?? Math.max(0, it.qty - (shippedTotals.get(it.name) ?? 0)),
                      }))
                      .filter((x) => x.qty > 0);
                    if (itemsToShip.length === 0) return;
                    recordOrderShipment(liveOrder.id, {
                      carrier: shipCarrier,
                      trackingCode:
                        shipTracking.trim() || `TRK-${Math.floor(100000 + Math.random() * 899999)}`,
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

          {(liveOrder.shipments?.length ?? 0) > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                بسته‌ها و مرسوله‌های ثبت‌شده ({toFa(liveOrder.shipments?.length ?? 0)})
              </h3>
              <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                {(liveOrder.shipments ?? []).map((sh) => (
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
              {activeLogs.map((log) => (
                <div key={log.id} className="flex items-center justify-between px-3 py-2 text-xs">
                  <span>
                    {statusLabel(log.from)} ←{' '}
                    <span className="font-semibold">{statusLabel(log.to)}</span>
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
  );
}
