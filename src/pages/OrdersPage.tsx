import { useMemo, useState } from 'react';
import { AlertTriangle, Plus } from 'lucide-react';
import { ContractsWarrantiesTab } from '../components/operations/ContractsWarrantiesTab';
import { FinanceInvoicesTab } from '../components/operations/FinanceInvoicesTab';
import { InventoryTab } from '../components/operations/InventoryTab';
import { OrdersTab } from '../components/operations/OrdersTab';
import { ProjectsTab } from '../components/operations/ProjectsTab';
import { useClientFlow } from '../store/useClientFlowStore';
import { toFa } from '../utils/jalali';

type OperationsTab = 'orders' | 'invoices' | 'contracts_warranty' | 'inventory' | 'projects';

export function OrdersPage() {
  const { state } = useClientFlow();
  const [activeTab, setActiveTab] = useState<OperationsTab>('orders');
  const [createOrderOpen, setCreateOrderOpen] = useState(false);

  const activeBranch = state.settings.activeBranchId;

  const branchOrders = useMemo(() => {
    if (!activeBranch || activeBranch === 'all') return state.orders;
    return state.orders.filter((o) => !o.branchId || o.branchId === activeBranch);
  }, [state.orders, activeBranch]);

  const branchInvoices = useMemo(() => {
    if (!activeBranch || activeBranch === 'all') return state.invoices;
    return state.invoices.filter((inv) => !inv.branchId || inv.branchId === activeBranch);
  }, [state.invoices, activeBranch]);

  const lowStockProducts = useMemo(
    () => state.products.filter((p) => p.stock <= (p.minStock ?? 8)),
    [state.products],
  );

  const tabs: { key: OperationsTab; label: string }[] = [
    { key: 'orders', label: `سفارش‌ها (${toFa(branchOrders.length)})` },
    { key: 'invoices', label: `مالی، فاکتورها و چک صیادی (${toFa(branchInvoices.length)})` },
    {
      key: 'contracts_warranty',
      label: `قراردادها و گارانتی (${toFa(state.contracts.length + state.warranties.length)})`,
    },
    { key: 'inventory', label: `انبار و کوپن (${toFa(state.products.length)})` },
    { key: 'projects', label: `پروژه‌ها و استقرار (${toFa(state.projects.length)})` },
  ];

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
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => {
            setActiveTab('orders');
            setCreateOrderOpen(true);
          }}
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700"
        >
          <Plus size={16} />
          ثبت سفارش جدید
        </button>
      </div>

      {activeTab === 'orders' && (
        <OrdersTab
          branchOrders={branchOrders}
          createOpen={createOrderOpen}
          setCreateOpen={setCreateOrderOpen}
        />
      )}
      {activeTab === 'invoices' && <FinanceInvoicesTab branchInvoices={branchInvoices} />}
      {activeTab === 'contracts_warranty' && <ContractsWarrantiesTab />}
      {activeTab === 'inventory' && <InventoryTab />}
      {activeTab === 'projects' && <ProjectsTab />}
    </div>
  );
}
