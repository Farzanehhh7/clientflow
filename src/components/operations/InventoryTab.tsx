import { useMemo, useState } from 'react';
import { Boxes } from 'lucide-react';
import { DynamicFieldsRenderer } from '../DynamicFieldsRenderer';
import { Modal } from '../Modal';
import { useClientFlow } from '../../store/useClientFlowStore';
import type { Product } from '../../types';
import {
  formatCustomFieldValue,
  getFieldsForEntity,
  getTableCustomFields,
  validateCustomFieldValues,
} from '../../utils/customFieldValidation';
import { formatJalaliDateTime, formatToman, toFa } from '../../utils/jalali';

export function InventoryTab() {
  const { state, adjustProductStock, addProduct, addCoupon, toggleCoupon } = useClientFlow();

  const [newProdName, setNewProdName] = useState('');
  const [newProdSku, setNewProdSku] = useState('');
  const [newProdPrice, setNewProdPrice] = useState('450000');
  const [newProdStock, setNewProdStock] = useState('20');
  const [newProdMinStock] = useState('5');
  const [newCouponCode, setNewCouponCode] = useState('');
  const [newCouponPct, setNewCouponPct] = useState('15');
  const [stockAdjustTarget, setStockAdjustTarget] = useState<Product | null>(null);
  const [stockDelta, setStockDelta] = useState('10');
  const [stockReason, setStockReason] = useState('تامین موجودی انبار');
  const [prodCustomFields, setProdCustomFields] = useState<Record<string, string>>({});
  const [prodCustomErrors, setProdCustomErrors] = useState<Record<string, string>>({});

  const productActiveFields = useMemo(
    () => getFieldsForEntity(state.customFieldDefs, 'product', false),
    [state.customFieldDefs],
  );
  const productTableFields = useMemo(
    () => getTableCustomFields(state.customFieldDefs, 'product'),
    [state.customFieldDefs],
  );

  return (
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
              setProdCustomErrors({});
              const cfValidation = validateCustomFieldValues(state.customFieldDefs, prodCustomFields, {
                entity: 'product',
                existingRecords: state.products,
              });
              if (!cfValidation.ok) {
                setProdCustomErrors(cfValidation.errors);
                return;
              }
              addProduct({
                name: newProdName.trim(),
                sku: newProdSku.trim() || `SK-${state.products.length + 101}`,
                price: Number(newProdPrice) || 0,
                stock: Math.max(0, Number(newProdStock) || 0),
                minStock: Math.max(0, Number(newProdMinStock) || 5),
                active: true,
                customFields: prodCustomFields,
              });
              setNewProdName('');
              setNewProdSku('');
              setProdCustomFields({});
            }}
            className="mb-4 space-y-2"
          >
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
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
            </div>
            {productActiveFields.length > 0 && (
              <DynamicFieldsRenderer
                entity="product"
                defs={state.customFieldDefs}
                values={prodCustomFields}
                onChange={setProdCustomFields}
                errors={prodCustomErrors}
              />
            )}
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
                      {productTableFields.map((def) => {
                        const val = p.customFields?.[def.key];
                        if (!val) return null;
                        return ` · ${def.label}: ${formatCustomFieldValue(def, val)}`;
                      })}
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
          با تأیید سفارش موجودی به‌صورت خودکار کسر و با لغو سفارش، مرجوعی یا تعدیل دستی به انبار بازگردانده می‌شود.
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
                  <td className="px-3 py-2 tabular-nums text-slate-400">{formatJalaliDateTime(mv.at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

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
            <label className="mb-1 block text-xs text-slate-500">
              تغییر تعداد (مثبت برای افزایش، منفی برای کسر)
            </label>
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
    </div>
  );
}
