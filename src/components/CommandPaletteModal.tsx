import { useEffect, useMemo, useState } from 'react';
import { Search, Users, ShoppingBag, LifeBuoy, ArrowLeft } from 'lucide-react';
import type { NavPageKey } from '../pages/DashboardPage';
import { useClientFlow } from '../store/useClientFlowStore';
import { toFa } from '../utils/jalali';
import { Modal } from './Modal';

interface CommandPaletteModalProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (page: NavPageKey) => void;
  pages: { key: NavPageKey; label: string }[];
}

export function CommandPaletteModal({
  open,
  onClose,
  onNavigate,
  pages,
}: CommandPaletteModalProps) {
  const { state } = useClientFlow();
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (open) setQuery('');
  }, [open]);

  const q = query.trim().toLowerCase();

  const matchedPages = useMemo(() => {
    if (!q) return pages.slice(0, 6);
    return pages.filter((p) => p.label.toLowerCase().includes(q));
  }, [pages, q]);

  const matchedCustomers = useMemo(() => {
    if (!q) return state.customers.slice(0, 4);
    return state.customers
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.phone.includes(q) ||
          (c.patientCode ?? '').toLowerCase().includes(q),
      )
      .slice(0, 5);
  }, [state.customers, q]);

  const matchedOrders = useMemo(() => {
    if (!q) return [];
    return state.orders
      .filter((o) => o.id.toLowerCase().includes(q))
      .slice(0, 4);
  }, [state.orders, q]);

  const matchedTickets = useMemo(() => {
    if (!q) return [];
    return state.tickets
      .filter((t) => t.subject.toLowerCase().includes(q) || t.id.toLowerCase().includes(q))
      .slice(0, 4);
  }, [state.tickets, q]);

  const go = (page: NavPageKey) => {
    onNavigate(page);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="جستجوی سراسری و دسترسی سریع (Ctrl+K)" maxWidth="lg">
      <div className="space-y-4">
        <div className="relative">
          <Search
            size={16}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="نام مشتری، شماره موبایل، شماره سفارش، تیکت یا نام بخش را بنویسید..."
            className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pr-9 pl-3 text-sm focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
          />
        </div>

        <div className="max-h-80 space-y-4 overflow-y-auto">
          {matchedPages.length > 0 && (
            <div>
              <div className="mb-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">بخش‌های سامانه</div>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {matchedPages.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => go(p.key)}
                    className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:border-indigo-400 hover:bg-indigo-50/40 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <span>{p.label}</span>
                    <ArrowLeft size={13} className="text-slate-400" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {matchedCustomers.length > 0 && (
            <div>
              <div className="mb-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">مشتریان</div>
              <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                {matchedCustomers.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => go('customers')}
                    className="flex w-full items-center justify-between px-3 py-2 text-right text-xs hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  >
                    <span className="flex items-center gap-2 font-medium">
                      <Users size={14} className="text-indigo-500" />
                      {c.name}
                    </span>
                    <span className="tabular-nums text-slate-500" dir="ltr">
                      {toFa(c.phone)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {matchedOrders.length > 0 && (
            <div>
              <div className="mb-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">سفارش‌ها</div>
              <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                {matchedOrders.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => go('orders')}
                    className="flex w-full items-center justify-between px-3 py-2 text-right text-xs hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  >
                    <span className="flex items-center gap-2 font-medium">
                      <ShoppingBag size={14} className="text-emerald-500" />
                      سفارش {o.id}
                    </span>
                    <span className="text-slate-500">{o.status}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {matchedTickets.length > 0 && (
            <div>
              <div className="mb-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">تیکت‌ها</div>
              <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                {matchedTickets.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => go('tickets')}
                    className="flex w-full items-center justify-between px-3 py-2 text-right text-xs hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  >
                    <span className="flex items-center gap-2 font-medium">
                      <LifeBuoy size={14} className="text-amber-500" />
                      {t.subject}
                    </span>
                    <span className="text-slate-500">{t.status}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
