import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Building2,
  Download,
  Eye,
  FileSpreadsheet,
  GitMerge,
  Pencil,
  Plus,
  Trash2,
  Upload,
  Users,
} from 'lucide-react';
import { AiNlFilterBar } from '../components/ai/AiNlFilterBar';
import { CsvImportModal } from '../components/CsvImportModal';
import { Customer360Page } from '../components/customers/Customer360Page';
import { CustomerFilterBar } from '../components/customers/CustomerFilterBar';
import { CustomerFormModal } from '../components/customers/CustomerFormModal';
import { CustomerMergeWizardModal } from '../components/customers/CustomerMergeWizardModal';
import { CustomerOccasionsView } from '../components/customers/CustomerOccasionsView';
import { CustomerSavedViewsBar } from '../components/customers/CustomerSavedViewsBar';
import { CustomerSegmentsView } from '../components/customers/CustomerSegmentsView';
import { Badge, Button, ConfirmDialog, EmptyState, Tabs } from '../components/ui';
import { LIFECYCLE_LABELS, useCustomerCore } from '../hooks/useCustomerCore';
import { useClientFlow } from '../store/useClientFlowStore';
import type { CustomFieldDef, Customer } from '../types';
import { formatCustomFieldValue, getTableCustomFields } from '../utils/customFieldValidation';
import { formatJalali, toFa } from '../utils/jalali';
import { hasPermission, maskPhone, shouldMaskPii } from '../utils/security';
import { computeVirtualWindow } from '../utils/virtualWindow';

const VIRTUAL_THRESHOLD = 40;
const ROW_HEIGHT_PX = 60;
const VIEWPORT_HEIGHT_PX = 540;

interface CustomerTableRowProps {
  customer: Customer;
  score: number;
  piiMasked: boolean;
  highlightColumnLabel?: string;
  highlightValue: string;
  tableCustomFields: CustomFieldDef[];
  canDelete: boolean;
  onSelect: (id: string) => void;
  onEdit: (c: Customer) => void;
  onDelete: (c: Customer) => void;
}

const CustomerTableRow = memo(function CustomerTableRow({
  customer: c,
  score,
  piiMasked,
  highlightColumnLabel,
  highlightValue,
  tableCustomFields,
  canDelete,
  onSelect,
  onEdit,
  onDelete,
}: CustomerTableRowProps) {
  return (
    <tr className="h-[60px] transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
      <td className="px-4 py-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => onSelect(c.id)}
            className="font-medium text-slate-900 hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded dark:text-slate-100 dark:hover:text-indigo-400"
          >
            {c.name}
          </button>
          {c.personType === 'organization' && (
            <Badge tone="violet">
              <Building2 size={10} />
              حقوقی
            </Badge>
          )}
          {c.isAnonymized && <Badge tone="amber">ناشناس</Badge>}
        </div>
        <div className="truncate max-w-[260px] text-xs text-slate-500 dark:text-slate-400">
          {LIFECYCLE_LABELS[c.lifecycle ?? 'active']}
          {c.companyName && ` · ${c.companyName}`}
          {(c.contacts?.length ?? 0) > 0 && ` · ${toFa(c.contacts?.length ?? 0)} مخاطب`}
        </div>
      </td>
      <td className="px-4 py-2 tabular-nums text-slate-700 dark:text-slate-300" dir="ltr">
        <span className="block text-right">{maskPhone(c.phone, piiMasked)}</span>
      </td>
      <td className="px-4 py-2 text-xs text-slate-600 dark:text-slate-300">
        {c.ownerName || '—'}
      </td>
      <td className="px-4 py-2 text-xs font-semibold tabular-nums">
        <span
          className={
            score >= 70 ? 'text-emerald-600 dark:text-emerald-400' : score >= 40 ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'
          }
        >
          {toFa(score)}
        </span>
        <span className="text-[10px] font-normal text-slate-400"> / ۱۰۰</span>
      </td>
      <td className="px-4 py-2 text-xs text-slate-500 dark:text-slate-400">
        <span className="line-clamp-1 max-w-[200px]">
          {[c.tags.join('، '), c.source].filter(Boolean).join(' · ') || '—'}
        </span>
      </td>
      {highlightColumnLabel && (
        <td className="px-4 py-2 text-xs tabular-nums text-slate-600 dark:text-slate-300">
          {highlightValue}
        </td>
      )}
      {tableCustomFields.map((def) => (
        <td key={def.id} className="px-4 py-2 text-xs tabular-nums text-slate-600 dark:text-slate-300">
          {formatCustomFieldValue(def, c.customFields?.[def.key])}
        </td>
      ))}
      <td className="px-4 py-2 text-xs tabular-nums text-slate-500 dark:text-slate-400">
        {formatJalali(c.createdAt)}
      </td>
      <td className="px-4 py-2">
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={() => onSelect(c.id)}
            title="پرونده ۳۶۰ درجه"
            aria-label={`پرونده ۳۶۰ درجه ${c.name}`}
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <Eye size={16} />
          </button>
          <button
            type="button"
            onClick={() => onEdit(c)}
            title="ویرایش"
            aria-label={`ویرایش ${c.name}`}
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <Pencil size={16} />
          </button>
          {canDelete && (
            <button
              type="button"
              onClick={() => onDelete(c)}
              title="انتقال به سطل زباله"
              aria-label={`انتقال ${c.name} به سطل زباله`}
              className="rounded-md p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 dark:text-slate-400 dark:hover:bg-rose-950/40"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
});

interface CustomersPageProps {
  initialCustomerId?: string | null;
  onClearInitialCustomerId?: () => void;
}

export function CustomersPage({ initialCustomerId, onClearInitialCustomerId }: CustomersPageProps = {}) {
  const { state, deleteCustomer } = useClientFlow();
  const core = useCustomerCore();
  const piiMasked = shouldMaskPii(state);
  const canDelete = state.settings.role === 'admin' || hasPermission(state, 'customers', 'delete');

  const [subView, setSubView] = useState<'list' | 'segments' | 'occasions'>('list');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(initialCustomerId ?? null);

  useEffect(() => {
    if (initialCustomerId) {
      setSelectedCustomerId(initialCustomerId);
    }
  }, [initialCustomerId]);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const isAdmin = state.settings.role === 'admin';
  const { packConfig } = core;

  useEffect(() => {
    setScrollTop(0);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [core.filteredCustomers.length, core.filters.sortBy, core.filters.sortDir]);

  const openCreate = useCallback(() => {
    setEditing(null);
    setFormOpen(true);
  }, []);

  const openEdit = useCallback((c: Customer) => {
    setEditing(c);
    setFormOpen(true);
  }, []);

  const renderHighlightValue = useCallback(
    (c: Customer): string => {
      const key = packConfig.highlightFieldKey;
      if (!key) return '—';
      const fromCustom = c.customFields?.[key];
      if (fromCustom) return toFa(fromCustom);
      const legacy = (c as Record<string, unknown>)[key];
      return typeof legacy === 'string' && legacy ? toFa(legacy) : '—';
    },
    [packConfig.highlightFieldKey],
  );

  const tableCustomFields = useMemo(
    () =>
      getTableCustomFields(state.customFieldDefs, 'customer').filter(
        (f) => f.key !== packConfig.highlightFieldKey,
      ),
    [state.customFieldDefs, packConfig.highlightFieldKey],
  );

  const tableHeaders = useMemo(
    () => [
      { key: 'name', label: 'نام / شخصیت' },
      { key: 'phone', label: 'موبایل' },
      { key: 'owner', label: 'مسئول پیگیری' },
      { key: 'score', label: 'امتیاز' },
      { key: 'tags', label: 'برچسب‌ها و منبع' },
      ...(packConfig.highlightColumnLabel
        ? [{ key: 'highlight', label: packConfig.highlightColumnLabel }]
        : []),
      ...tableCustomFields.map((f) => ({ key: `cf_${f.key}`, label: f.label })),
      { key: 'createdAt', label: 'تاریخ ثبت' },
      { key: 'actions', label: 'عملیات', alignLeft: true },
    ],
    [packConfig.highlightColumnLabel, tableCustomFields],
  );

  const isVirtualized = core.filteredCustomers.length > VIRTUAL_THRESHOLD;
  const virtualWindow = useMemo(
    () =>
      isVirtualized
        ? computeVirtualWindow({
            totalCount: core.filteredCustomers.length,
            scrollTop,
            viewportHeight: VIEWPORT_HEIGHT_PX,
            itemHeight: ROW_HEIGHT_PX,
            overscan: 8,
          })
        : {
            startIndex: 0,
            endIndex: core.filteredCustomers.length,
            topSpacerPx: 0,
            bottomSpacerPx: 0,
            totalHeightPx: 0,
          },
    [isVirtualized, core.filteredCustomers.length, scrollTop],
  );

  const visibleCustomers = useMemo(
    () => core.filteredCustomers.slice(virtualWindow.startIndex, virtualWindow.endIndex),
    [core.filteredCustomers, virtualWindow.startIndex, virtualWindow.endIndex],
  );

  if (selectedCustomerId) {
    return (
      <div className="space-y-4">
        <Customer360Page
          customerId={selectedCustomerId}
          singularLabel={packConfig.singularLabel}
          onBack={() => {
            setSelectedCustomerId(null);
            onClearInitialCustomerId?.();
          }}
          onEdit={openEdit}
          onSelectCustomer={(id) => setSelectedCustomerId(id)}
        />
        <CustomerFormModal
          open={formOpen}
          editing={editing}
          singularLabel={packConfig.singularLabel}
          ownersList={core.ownersList}
          onClose={() => setFormOpen(false)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs<'list' | 'segments' | 'occasions'>
          ariaLabel="بخش‌های مدیریت مشتریان"
          activeKey={subView}
          onChange={setSubView}
          items={[
            { key: 'list', label: `فهرست ${packConfig.pluralLabel}`, count: core.branchCustomers.length },
            { key: 'segments', label: 'سگمنت‌ها', count: state.customerSegments.length },
            { key: 'occasions', label: 'تولد و سالگردها', count: core.occasionsList.length },
          ]}
        />

        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <Button variant="secondary" onClick={() => setMergeOpen(true)}>
              <GitMerge size={15} />
              ادغام تکراری‌ها ({toFa(core.duplicateCandidates.length)})
            </Button>
          )}
          <Button variant="secondary" onClick={() => setImportOpen(true)}>
            <Upload size={15} />
            ورود CSV / اکسل
          </Button>
          <Button variant="secondary" onClick={core.exportFilteredCsv}>
            <Download size={15} />
            خروجی CSV
          </Button>
          <Button variant="secondary" onClick={core.exportFilteredXlsx}>
            <FileSpreadsheet size={15} />
            خروجی اکسل
          </Button>
          <Button onClick={openCreate}>
            <Plus size={15} />
            {packConfig.singularLabel} جدید
          </Button>
        </div>
      </div>

      {subView === 'list' && (
        <>
          <CustomerSavedViewsBar
            views={core.savedViews}
            activeViewId={core.activeViewId}
            filters={core.filters}
            onSelectView={core.applySavedView}
            onSaveView={core.handleSaveCurrentView}
            onDeleteView={core.handleDeleteSavedView}
            onResetFilters={core.resetFilters}
            onChangeSortBy={(sortBy) => core.updateFilter('sortBy', sortBy)}
            onToggleSortDir={() =>
              core.updateFilter('sortDir', core.filters.sortDir === 'desc' ? 'asc' : 'desc')
            }
            totalMatched={core.filteredCustomers.length}
          />

          <AiNlFilterBar
            allowedOwners={core.ownersList}
            allowedTags={core.dynamicTags}
            onApplyFilter={core.applyFilterJson}
            onSaveAsView={core.saveFilterViewDirect}
          />

          <CustomerFilterBar
            filters={core.filters}
            segments={state.customerSegments}
            ownersList={core.ownersList}
            dynamicTags={core.dynamicTags}
            onUpdateFilter={core.updateFilter}
          />

          {core.filteredCustomers.length === 0 ? (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
              <EmptyState
                icon={<Users size={28} />}
                title={`${packConfig.singularLabel} مطابق با جستجو یا فیلتر یافت نشد`}
                actionLabel={`ثبت ${packConfig.singularLabel} جدید`}
                onAction={openCreate}
              />
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
              {isVirtualized && (
                <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/70 px-4 py-1.5 text-[11px] text-slate-500 dark:border-slate-800 dark:bg-slate-800/30 dark:text-slate-400">
                  <span>
                    نمایش مجازی‌شده بهینه برای فهرست‌های بزرگ ({toFa(core.filteredCustomers.length)} رکورد)
                  </span>
                  <span className="tabular-nums">
                    ردیف {toFa(virtualWindow.startIndex + 1)} تا {toFa(virtualWindow.endIndex)}
                  </span>
                </div>
              )}
              <div
                ref={scrollContainerRef}
                onScroll={(e) => {
                  if (isVirtualized) {
                    setScrollTop(e.currentTarget.scrollTop);
                  }
                }}
                className={`overflow-x-auto ${isVirtualized ? 'max-h-[540px] overflow-y-auto' : ''}`}
              >
                <table className="w-full text-right text-sm">
                  <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-800/90 dark:text-slate-400">
                    <tr>
                      {tableHeaders.map((h) => (
                        <th
                          key={h.key}
                          scope="col"
                          className={`px-4 py-3 font-medium whitespace-nowrap ${h.alignLeft ? 'text-left' : 'text-right'}`}
                        >
                          {h.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {isVirtualized && virtualWindow.topSpacerPx > 0 && (
                      <tr aria-hidden="true">
                        <td colSpan={tableHeaders.length} className="p-0" style={{ height: virtualWindow.topSpacerPx }} />
                      </tr>
                    )}
                    {visibleCustomers.map((c) => (
                      <CustomerTableRow
                        key={c.id}
                        customer={c}
                        score={core.statsMap.get(c.id)?.score ?? 0}
                        piiMasked={piiMasked}
                        highlightColumnLabel={packConfig.highlightColumnLabel}
                        highlightValue={renderHighlightValue(c)}
                        tableCustomFields={tableCustomFields}
                        canDelete={canDelete}
                        onSelect={setSelectedCustomerId}
                        onEdit={openEdit}
                        onDelete={setDeleteTarget}
                      />
                    ))}
                    {isVirtualized && virtualWindow.bottomSpacerPx > 0 && (
                      <tr aria-hidden="true">
                        <td colSpan={tableHeaders.length} className="p-0" style={{ height: virtualWindow.bottomSpacerPx }} />
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {subView === 'segments' && (
        <CustomerSegmentsView
          customers={core.branchCustomers}
          statsMap={core.statsMap}
          onViewInList={(segmentId) => {
            core.updateFilter('activeSegmentId', segmentId);
            setSubView('list');
          }}
        />
      )}

      {subView === 'occasions' && (
        <CustomerOccasionsView
          occasions={core.occasionsList}
          onOpenCustomer={(id) => setSelectedCustomerId(id)}
        />
      )}

      <CustomerFormModal
        open={formOpen}
        editing={editing}
        singularLabel={packConfig.singularLabel}
        ownersList={core.ownersList}
        onClose={() => setFormOpen(false)}
      />

      <CsvImportModal open={importOpen} onClose={() => setImportOpen(false)} />

      <CustomerMergeWizardModal
        open={mergeOpen}
        onClose={() => setMergeOpen(false)}
        candidates={core.duplicateCandidates}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteCustomer(deleteTarget.id);
        }}
        title={`انتقال ${packConfig.singularLabel} به سطل زباله`}
        message={`«${deleteTarget?.name ?? ''}» به سطل زباله (حذف نرم) منتقل می‌شود و از بخش تنظیمات قابل بازیابی خواهد بود. ادامه می‌دهید؟`}
        confirmLabel="انتقال به سطل زباله"
      />
    </div>
  );
}
