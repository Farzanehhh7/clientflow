import { useMemo, useState } from 'react';
import { Pencil, Plus, Tag, Trash2 } from 'lucide-react';
import { useClientFlow } from '../../store/useClientFlowStore';
import type { PriceList, PriceListTier, Product, Service } from '../../types';
import { formatJalali, formatToman, isoToJalaliInput, jalaliToIsoUtc, toFa } from '../../utils/jalali';
import { Modal } from '../Modal';
import { Badge } from '../ui/Badge';
import { JalaliDatePicker } from '../ui/JalaliDatePicker';

const TIER_LABEL: Record<PriceListTier, { label: string; tone: 'neutral' | 'sky' | 'violet' }> = {
  retail: { label: 'خرده‌فروشی', tone: 'neutral' },
  wholesale: { label: 'عمده‌فروشی', tone: 'sky' },
  vip: { label: 'مشتریان VIP', tone: 'violet' },
};

export function CatalogPriceListsTab() {
  const {
    state,
    addProduct,
    updateProduct,
    addService,
    updateService,
    addPriceList,
    updatePriceList,
    deletePriceList,
    addCoupon,
    toggleCoupon,
    softDeleteEntity,
  } = useClientFlow();

  const [section, setSection] = useState<'catalog' | 'pricelists' | 'coupons'>('catalog');
  const [catFilter, setCatFilter] = useState('all');

  // Product/Service Modal
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [itemKind, setItemKind] = useState<'product' | 'service'>('product');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [itemName, setItemName] = useState('');
  const [itemSku, setItemSku] = useState('');
  const [itemCategory, setItemCategory] = useState('عمومی');
  const [itemUnit, setItemUnit] = useState('عدد');
  const [itemTax, setItemTax] = useState('10');
  const [itemPrice, setItemPrice] = useState('500000');
  const [itemStock, setItemStock] = useState('20');
  const [itemDuration, setItemDuration] = useState('30');

  // PriceList Modal
  const [plOpen, setPlOpen] = useState(false);
  const [editingPlId, setEditingPlId] = useState<string | null>(null);
  const [plName, setPlName] = useState('');
  const [plTier, setPlTier] = useState<PriceListTier>('wholesale');
  const [plDiscount, setPlDiscount] = useState('10');
  const [plFrom, setPlFrom] = useState(() => isoToJalaliInput(new Date().toISOString()));
  const [plTo, setPlTo] = useState(() =>
    isoToJalaliInput(new Date(Date.now() + 30 * 24 * 3600_000).toISOString()),
  );
  const [plNotes, setPlNotes] = useState('');
  const [plOverrides, setPlOverrides] = useState<Record<string, number>>({});
  const [overrideItemId, setOverrideItemId] = useState('');
  const [overridePrice, setOverridePrice] = useState('');

  // Coupon Modal
  const [cpOpen, setCpOpen] = useState(false);
  const [cpCode, setCpCode] = useState('');
  const [cpDiscount, setCpDiscount] = useState('15');
  const [cpMaxUses, setCpMaxUses] = useState('50');
  const [cpMinOrder, setCpMinOrder] = useState('1000000');
  const [cpValidTo, setCpValidTo] = useState(() =>
    isoToJalaliInput(new Date(Date.now() + 30 * 24 * 3600_000).toISOString()),
  );

  const catalogItems = useMemo(() => {
    const prods = state.products
      .filter((p) => !p.isDeleted)
      .map((p) => ({
        kind: 'product' as const,
        id: p.id,
        name: p.name,
        code: p.sku,
        category: p.category || 'کالا',
        unit: p.unit || 'عدد',
        taxRate: p.taxRate ?? 10,
        price: p.price,
        active: p.active,
        raw: p,
      }));
    const svcs = state.services.map((s) => ({
      kind: 'service' as const,
      id: s.id,
      name: s.name,
      code: `${toFa(s.durationMin)} دقیقه`,
      category: s.category || 'خدمات',
      unit: s.unit || 'جلسه',
      taxRate: s.taxRate ?? 10,
      price: s.price,
      active: s.active !== false,
      raw: s,
    }));
    return [...prods, ...svcs];
  }, [state.products, state.services]);

  const categories = useMemo(
    () => Array.from(new Set(catalogItems.map((i) => i.category))),
    [catalogItems],
  );

  const visibleCatalog = useMemo(
    () => catalogItems.filter((i) => (catFilter === 'all' ? true : i.category === catFilter)),
    [catalogItems, catFilter],
  );

  const openEditProduct = (p: Product) => {
    setItemKind('product');
    setEditingId(p.id);
    setItemName(p.name);
    setItemSku(p.sku);
    setItemCategory(p.category || 'عمومی');
    setItemUnit(p.unit || 'عدد');
    setItemTax(String(p.taxRate ?? 10));
    setItemPrice(String(p.price));
    setItemStock(String(p.stock));
    setItemModalOpen(true);
  };

  const openEditService = (s: Service) => {
    setItemKind('service');
    setEditingId(s.id);
    setItemName(s.name);
    setItemCategory(s.category || 'خدمات');
    setItemUnit(s.unit || 'جلسه');
    setItemTax(String(s.taxRate ?? 10));
    setItemPrice(String(s.price));
    setItemDuration(String(s.durationMin));
    setItemModalOpen(true);
  };

  const handleSaveCatalogItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim()) return;
    const priceNum = Math.max(0, Number(itemPrice) || 0);
    const taxNum = Math.max(0, Number(itemTax) || 0);
    if (itemKind === 'product') {
      const payload = {
        name: itemName.trim(),
        sku: itemSku.trim() || `SKU-${Date.now().toString().slice(-4)}`,
        category: itemCategory.trim() || 'عمومی',
        unit: itemUnit.trim() || 'عدد',
        taxRate: taxNum,
        price: priceNum,
        stock: Math.max(0, Number(itemStock) || 0),
        active: true,
      };
      if (editingId) updateProduct(editingId, payload);
      else addProduct(payload);
    } else {
      const payload = {
        name: itemName.trim(),
        category: itemCategory.trim() || 'خدمات',
        unit: itemUnit.trim() || 'جلسه',
        taxRate: taxNum,
        price: priceNum,
        durationMin: Math.max(5, Number(itemDuration) || 30),
        active: true,
      };
      if (editingId) updateService(editingId, payload);
      else addService(payload);
    }
    setItemModalOpen(false);
    setEditingId(null);
  };

  const openPriceListModal = (pl?: PriceList) => {
    if (pl) {
      setEditingPlId(pl.id);
      setPlName(pl.name);
      setPlTier(pl.tier);
      setPlDiscount(String(pl.discountPct));
      setPlFrom(isoToJalaliInput(pl.validFrom));
      setPlTo(isoToJalaliInput(pl.validTo));
      setPlNotes(pl.notes ?? '');
      setPlOverrides(pl.itemOverrides ?? {});
    } else {
      setEditingPlId(null);
      setPlName('');
      setPlTier('wholesale');
      setPlDiscount('12');
      setPlNotes('');
      setPlOverrides({});
    }
    setOverrideItemId(catalogItems[0]?.id ?? '');
    setOverridePrice('');
    setPlOpen(true);
  };

  const handleSavePriceList = (e: React.FormEvent) => {
    e.preventDefault();
    if (!plName.trim()) return;
    const fromIso = jalaliToIsoUtc(plFrom) ?? new Date().toISOString();
    const toIso = jalaliToIsoUtc(plTo) ?? new Date(Date.now() + 30 * 24 * 3600_000).toISOString();
    const payload = {
      name: plName.trim(),
      tier: plTier,
      discountPct: Math.min(80, Math.max(0, Number(plDiscount) || 0)),
      validFrom: fromIso,
      validTo: toIso,
      active: true,
      itemOverrides: plOverrides,
      notes: plNotes.trim() || undefined,
    };
    if (editingPlId) updatePriceList(editingPlId, payload);
    else addPriceList(payload);
    setPlOpen(false);
  };

  const handleCreateCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cpCode.trim()) return;
    addCoupon({
      code: cpCode.trim().toUpperCase(),
      discountPct: Math.min(80, Math.max(1, Number(cpDiscount) || 10)),
      maxUses: Math.max(1, Number(cpMaxUses) || 50),
      active: true,
      validFrom: new Date().toISOString(),
      validTo: jalaliToIsoUtc(cpValidTo) ?? new Date(Date.now() + 30 * 24 * 3600_000).toISOString(),
      minOrderAmount: Math.max(0, Number(cpMinOrder) || 0),
    });
    setCpCode('');
    setCpOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1 text-xs dark:bg-slate-800">
          {(
            [
              ['catalog', `کاتالوگ کالا و خدمات (${toFa(catalogItems.length)})`],
              ['pricelists', `لیست‌های قیمت (${toFa(state.priceLists.length)})`],
              ['coupons', `کدهای تخفیف (${toFa(state.coupons.length)})`],
            ] as const
          ).map(([k, lbl]) => (
            <button
              key={k}
              type="button"
              onClick={() => setSection(k)}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 font-medium transition-colors ${
                section === k
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {lbl}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {section === 'catalog' && (
            <>
              <select
                aria-label="فیلتر دسته‌بندی"
                value={catFilter}
                onChange={(e) => setCatFilter(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="all">همه دسته‌ها</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setItemKind('product');
                  setItemName('');
                  setItemSku('');
                  setItemPrice('500000');
                  setItemModalOpen(true);
                }}
                className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
              >
                <Plus size={14} />
                افزودن آیتم کاتالوگ
              </button>
            </>
          )}
          {section === 'pricelists' && (
            <button
              type="button"
              onClick={() => openPriceListModal()}
              className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
            >
              <Plus size={14} />
              لیست قیمت جدید
            </button>
          )}
          {section === 'coupons' && (
            <button
              type="button"
              onClick={() => setCpOpen(true)}
              className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
            >
              <Plus size={14} />
              کد تخفیف جدید
            </button>
          )}
        </div>
      </div>

      {section === 'catalog' && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="border-b border-slate-200 bg-slate-50/70 text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">نام کالا / خدمت</th>
                  <th className="px-4 py-3 font-medium">نوع · کد / مدت</th>
                  <th className="px-4 py-3 font-medium">دسته‌بندی</th>
                  <th className="px-4 py-3 font-medium">واحد · مالیات</th>
                  <th className="px-4 py-3 font-medium">قیمت پایه</th>
                  <th className="px-4 py-3 font-medium">وضعیت</th>
                  <th className="px-4 py-3 font-medium">ویرایش</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {visibleCatalog.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 font-semibold">{item.name}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {item.kind === 'product' ? 'کالا' : 'خدمت'} ·{' '}
                      <span className="font-mono text-[11px]">{item.code}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{item.category}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-600 dark:text-slate-300">
                      {item.unit} · مالیات {toFa(item.taxRate)}٪
                    </td>
                    <td className="px-4 py-3 font-medium tabular-nums">{formatToman(item.price)}</td>
                    <td className="px-4 py-3">
                      <Badge tone={item.active ? 'emerald' : 'neutral'}>
                        {item.active ? 'فعال' : 'غیرفعال'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            item.kind === 'product'
                              ? openEditProduct(item.raw as Product)
                              : openEditService(item.raw as Service)
                          }
                          className="inline-flex items-center gap-1 whitespace-nowrap rounded border border-slate-200 px-2.5 py-1 text-[11px] hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                        >
                          <Pencil size={11} />
                          ویرایش
                        </button>
                        {item.kind === 'product' && (
                          <button
                            type="button"
                            onClick={() => softDeleteEntity('product', item.id)}
                            title="انتقال به سطل بازیافت"
                            aria-label={`حذف محصول ${item.name}`}
                            className="rounded border border-slate-200 p-1 text-slate-400 hover:border-rose-200 hover:text-rose-600 dark:border-slate-700 dark:hover:border-rose-900 dark:hover:text-rose-400"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {section === 'pricelists' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {state.priceLists.map((pl) => {
            const tierMeta = TIER_LABEL[pl.tier];
            const overrideCount = Object.keys(pl.itemOverrides ?? {}).length;
            return (
              <div
                key={pl.id}
                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold">{pl.name}</div>
                      <div className="mt-1 flex items-center gap-2">
                        <Badge tone={tierMeta.tone}>{tierMeta.label}</Badge>
                        <Badge tone={pl.active ? 'emerald' : 'neutral'}>
                          {pl.active ? 'فعال' : 'غیرفعال'}
                        </Badge>
                      </div>
                    </div>
                    <span className="text-base font-bold tabular-nums text-indigo-600 dark:text-indigo-400">
                      {toFa(pl.discountPct)}٪ تخفیف
                    </span>
                  </div>
                  <div className="text-xs tabular-nums text-slate-500">
                    اعتبار: {formatJalali(pl.validFrom)} تا {formatJalali(pl.validTo)}
                  </div>
                  <div className="text-xs text-slate-500">
                    قیمت اختصاصی آیتم‌ها: {toFa(overrideCount)} مورد
                  </div>
                  {pl.notes && <p className="text-xs text-slate-500">{pl.notes}</p>}
                </div>

                <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-200 pt-3 text-xs dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => updatePriceList(pl.id, { active: !pl.active })}
                    className="rounded border border-slate-200 px-2.5 py-1 hover:bg-slate-50 dark:border-slate-700"
                  >
                    {pl.active ? 'غیرفعال‌سازی' : 'فعال‌سازی'}
                  </button>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => openPriceListModal(pl)}
                      className="inline-flex items-center gap-1 rounded border border-slate-200 px-2.5 py-1 hover:bg-slate-50 dark:border-slate-700"
                    >
                      <Pencil size={11} />
                      ویرایش
                    </button>
                    <button
                      type="button"
                      onClick={() => deletePriceList(pl.id)}
                      className="rounded border border-rose-200 p-1 text-rose-600 hover:bg-rose-50 dark:border-rose-900/50"
                      aria-label="حذف لیست قیمت"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {section === 'coupons' && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="border-b border-slate-200 bg-slate-50/70 text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">کد تخفیف</th>
                  <th className="px-4 py-3 font-medium">درصد تخفیف</th>
                  <th className="px-4 py-3 font-medium">سقف استفاده</th>
                  <th className="px-4 py-3 font-medium">حداقل سفارش</th>
                  <th className="px-4 py-3 font-medium">اعتبار تا</th>
                  <th className="px-4 py-3 font-medium">وضعیت</th>
                  <th className="px-4 py-3 font-medium">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {state.coupons.map((cp) => (
                  <tr key={cp.id}>
                    <td className="px-4 py-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                      <span className="inline-flex items-center gap-1.5">
                        <Tag size={12} />
                        {cp.code}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold tabular-nums">{toFa(cp.discountPct)}٪</td>
                    <td className="px-4 py-3 tabular-nums">
                      {toFa(cp.usedCount)} از {toFa(cp.maxUses)} بار
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {cp.minOrderAmount ? formatToman(cp.minOrderAmount) : 'ندارد'}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-500">
                      {cp.validTo ? formatJalali(cp.validTo) : 'نامحدود'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={cp.active ? 'emerald' : 'neutral'}>
                        {cp.active ? 'فعال' : 'متوقف'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => toggleCoupon(cp.id)}
                        className="rounded border border-slate-200 px-2.5 py-1 text-[11px] hover:bg-slate-50 dark:border-slate-700"
                      >
                        {cp.active ? 'توقف' : 'فعال‌سازی'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        open={itemModalOpen}
        onClose={() => setItemModalOpen(false)}
        title={editingId ? 'ویرایش آیتم کاتالوگ' : 'افزودن کالا یا خدمت به کاتالوگ'}
      >
        <form onSubmit={handleSaveCatalogItem} className="space-y-3 text-xs">
          {!editingId && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setItemKind('product')}
                className={`flex-1 rounded-lg border py-2 font-medium ${
                  itemKind === 'product'
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300'
                    : 'border-slate-200 dark:border-slate-700'
                }`}
              >
                کالای فیزیکی / دیجیتال
              </button>
              <button
                type="button"
                onClick={() => setItemKind('service')}
                className={`flex-1 rounded-lg border py-2 font-medium ${
                  itemKind === 'service'
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300'
                    : 'border-slate-200 dark:border-slate-700'
                }`}
              >
                خدمت / مشاوره
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block font-medium">نام</label>
              <input
                type="text"
                required
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block font-medium">دسته‌بندی</label>
              <input
                type="text"
                value={itemCategory}
                onChange={(e) => setItemCategory(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block font-medium">واحد (عدد / جلسه / پک / لایسنس)</label>
              <input
                type="text"
                value={itemUnit}
                onChange={(e) => setItemUnit(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block font-medium">نرخ مالیات (٪)</label>
              <input
                type="number"
                value={itemTax}
                onChange={(e) => setItemTax(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 tabular-nums dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block font-medium">قیمت واحد (تومان)</label>
              <input
                type="number"
                value={itemPrice}
                onChange={(e) => setItemPrice(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 tabular-nums dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            {itemKind === 'product' ? (
              <div>
                <label className="mb-1 block font-medium">موجودی و SKU</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={itemSku}
                    onChange={(e) => setItemSku(e.target.value)}
                    placeholder="SKU"
                    className="w-1/2 rounded-lg border border-slate-200 px-2.5 py-2 dark:border-slate-700 dark:bg-slate-800"
                  />
                  <input
                    type="number"
                    value={itemStock}
                    onChange={(e) => setItemStock(e.target.value)}
                    placeholder="موجودی"
                    className="w-1/2 rounded-lg border border-slate-200 px-2.5 py-2 tabular-nums dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="mb-1 block font-medium">مدت زمان (دقیقه)</label>
                <input
                  type="number"
                  value={itemDuration}
                  onChange={(e) => setItemDuration(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 tabular-nums dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setItemModalOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 font-medium dark:border-slate-700"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700"
            >
              ذخیره در کاتالوگ
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={plOpen}
        onClose={() => setPlOpen(false)}
        title={editingPlId ? 'ویرایش لیست قیمت' : 'ایجاد لیست قیمت جدید'}
      >
        <form onSubmit={handleSavePriceList} className="space-y-3 text-xs">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block font-medium">عنوان لیست قیمت</label>
              <input
                type="text"
                required
                value={plName}
                onChange={(e) => setPlName(e.target.value)}
                placeholder="مثلاً تعرفه همکار پاییز"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block font-medium">سطح قیمت‌گذاری (Tier)</label>
              <select
                value={plTier}
                onChange={(e) => setPlTier(e.target.value as PriceListTier)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="retail">خرده‌فروشی (Retail)</option>
                <option value="wholesale">عمده‌فروشی (Wholesale)</option>
                <option value="vip">مشتریان VIP</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block font-medium">تخفیف عمومی لیست (٪)</label>
              <input
                type="number"
                min={0}
                max={80}
                value={plDiscount}
                onChange={(e) => setPlDiscount(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 tabular-nums dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block font-medium">توضیحات</label>
              <input
                type="text"
                value={plNotes}
                onChange={(e) => setPlNotes(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <JalaliDatePicker label="تاریخ شروع اعتبار" value={plFrom} onChange={setPlFrom} />
            <JalaliDatePicker label="تاریخ پایان اعتبار" value={plTo} onChange={setPlTo} />
          </div>

          <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <div className="mb-2 font-medium">قیمت اختصاصی برای آیتم‌های خاص (Override)</div>
            <div className="flex flex-wrap gap-2">
              <select
                value={overrideItemId}
                onChange={(e) => setOverrideItemId(e.target.value)}
                className="flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-800"
              >
                {catalogItems.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} ({formatToman(i.price)})
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={overridePrice}
                onChange={(e) => setOverridePrice(e.target.value)}
                placeholder="قیمت جدید (تومان)"
                className="w-36 rounded-lg border border-slate-200 px-2.5 py-1.5 tabular-nums dark:border-slate-700 dark:bg-slate-800"
              />
              <button
                type="button"
                onClick={() => {
                  const p = Number(overridePrice);
                  if (!overrideItemId || !p) return;
                  setPlOverrides((prev) => ({ ...prev, [overrideItemId]: p }));
                  setOverridePrice('');
                }}
                className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium hover:bg-slate-50 dark:border-slate-700"
              >
                افزودن
              </button>
            </div>
            {Object.keys(plOverrides).length > 0 && (
              <div className="mt-2 space-y-1">
                {Object.entries(plOverrides).map(([id, val]) => {
                  const item = catalogItems.find((c) => c.id === id);
                  return (
                    <div key={id} className="flex items-center justify-between rounded bg-slate-50 px-2.5 py-1 dark:bg-slate-800">
                      <span>{item?.name ?? id}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold tabular-nums">{formatToman(val)}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setPlOverrides((prev) => {
                              const copy = { ...prev };
                              delete copy[id];
                              return copy;
                            })
                          }
                          className="text-rose-500"
                        >
                          حذف
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setPlOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 font-medium dark:border-slate-700"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700"
            >
              ذخیره لیست قیمت
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={cpOpen} onClose={() => setCpOpen(false)} title="ایجاد کد تخفیف جدید">
        <form onSubmit={handleCreateCoupon} className="space-y-3 text-xs">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block font-medium">کد تخفیف (انگلیسی)</label>
              <input
                type="text"
                required
                dir="ltr"
                value={cpCode}
                onChange={(e) => setCpCode(e.target.value)}
                placeholder="SPRING20"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono uppercase dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block font-medium">درصد تخفیف (٪)</label>
              <input
                type="number"
                min={1}
                max={80}
                value={cpDiscount}
                onChange={(e) => setCpDiscount(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 tabular-nums dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block font-medium">سقف تعداد استفاده</label>
              <input
                type="number"
                min={1}
                value={cpMaxUses}
                onChange={(e) => setCpMaxUses(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 tabular-nums dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block font-medium">حداقل مبلغ خرید (تومان)</label>
              <input
                type="number"
                min={0}
                value={cpMinOrder}
                onChange={(e) => setCpMinOrder(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 tabular-nums dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>
          <JalaliDatePicker label="تاریخ انقضا" value={cpValidTo} onChange={setCpValidTo} />
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setCpOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 font-medium dark:border-slate-700"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700"
            >
              ایجاد کد تخفیف
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
