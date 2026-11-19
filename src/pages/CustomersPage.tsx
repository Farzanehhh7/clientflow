import { useState } from 'react';
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
import { CsvImportModal } from '../components/CsvImportModal';
import { Customer360Page } from '../components/customers/Customer360Page';
import { CustomerFilterBar } from '../components/customers/CustomerFilterBar';
import { CustomerFormModal } from '../components/customers/CustomerFormModal';
import { CustomerMergeWizardModal } from '../components/customers/CustomerMergeWizardModal';
import { CustomerOccasionsView } from '../components/customers/CustomerOccasionsView';
import { CustomerSavedViewsBar } from '../components/customers/CustomerSavedViewsBar';
import { CustomerSegmentsView } from '../components/customers/CustomerSegmentsView';
import { Badge, Button, ConfirmDialog, EmptyState, Table, Tabs } from '../components/ui';
import { LIFECYCLE_LABELS, useCustomerCore } from '../hooks/useCustomerCore';
import { useClientFlow } from '../store/useClientFlowStore';
import type { Customer } from '../types';
import { formatCustomFieldValue, getTableCustomFields } from '../utils/customFieldValidation';
import { formatJalali, toFa } from '../utils/jalali';

export function CustomersPage() {
  const { state, deleteCustomer } = useClientFlow();
  const core = useCustomerCore();

  const [subView, setSubView] = useState<'list' | 'segments' | 'occasions'>('list');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);

  const isAdmin = state.settings.role === 'admin';
  const { packConfig } = core;

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (c: Customer) => {
    setEditing(c);
    setFormOpen(true);
  };

  const renderHighlightValue = (c: Customer): string => {
    const key = packConfig.highlightFieldKey;
    if (!key) return '—';
    const fromCustom = c.customFields?.[key];
    if (fromCustom) return toFa(fromCustom);
    const legacy = (c as Record<string, unknown>)[key];
    return typeof legacy === 'string' && legacy ? toFa(legacy) : '—';
  };

  if (selectedCustomerId) {
    return (
      <div className="space-y-4">
        <Customer360Page
          customerId={selectedCustomerId}
          singularLabel={packConfig.singularLabel}
          onBack={() => setSelectedCustomerId(null)}
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

  const tableCustomFields = getTableCustomFields(state.customFieldDefs, 'customer').filter(
    (f) => f.key !== packConfig.highlightFieldKey,
  );

  const tableHeaders = [
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
  ];

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

          <CustomerFilterBar
            filters={core.filters}
            segments={state.customerSegments}
            ownersList={core.ownersList}
            dynamicTags={core.dynamicTags}
            onUpdateFilter={core.updateFilter}
          />

          <Table
            headers={tableHeaders}
            isEmpty={core.filteredCustomers.length === 0}
            emptyState={
              <EmptyState
                icon={<Users size={28} />}
                title={`${packConfig.singularLabel} مطابق با جستجو یا فیلتر یافت نشد`}
                actionLabel={`ثبت ${packConfig.singularLabel} جدید`}
                onAction={openCreate}
              />
            }
          >
            {core.filteredCustomers.map((c) => {
              const score = core.statsMap.get(c.id)?.score ?? 0;
              return (
                <tr key={c.id} className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectedCustomerId(c.id)}
                        className="font-medium text-slate-900 hover:text-indigo-600 dark:text-slate-100 dark:hover:text-indigo-400"
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
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {LIFECYCLE_LABELS[c.lifecycle ?? 'active']}
                      {c.companyName && ` · ${c.companyName}`}
                      {(c.contacts?.length ?? 0) > 0 && ` · ${toFa(c.contacts?.length ?? 0)} مخاطب`}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 tabular-nums text-slate-700 dark:text-slate-300" dir="ltr">
                    <span className="block text-right">{toFa(c.phone)}</span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-600 dark:text-slate-300">
                    {c.ownerName || '—'}
                  </td>
                  <td className="px-4 py-2.5 text-xs font-semibold tabular-nums">
                    <span
                      className={
                        score >= 70 ? 'text-emerald-600' : score >= 40 ? 'text-indigo-600' : 'text-slate-500'
                      }
                    >
                      {toFa(score)}
                    </span>
                    <span className="text-[10px] font-normal text-slate-400"> / ۱۰۰</span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-500 dark:text-slate-400">
                    {[c.tags.join('، '), c.source].filter(Boolean).join(' · ') || '—'}
                  </td>
                  {packConfig.highlightColumnLabel && (
                    <td className="px-4 py-2.5 text-xs tabular-nums text-slate-600 dark:text-slate-300">
                      {renderHighlightValue(c)}
                    </td>
                  )}
                  {tableCustomFields.map((def) => (
                    <td key={def.id} className="px-4 py-2.5 text-xs tabular-nums text-slate-600 dark:text-slate-300">
                      {formatCustomFieldValue(def, c.customFields?.[def.key])}
                    </td>
                  ))}
                  <td className="px-4 py-2.5 text-xs tabular-nums text-slate-500 dark:text-slate-400">
                    {formatJalali(c.createdAt)}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => setSelectedCustomerId(c.id)}
                        title="پرونده ۳۶۰ درجه"
                        className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-indigo-600 dark:text-slate-400 dark:hover:bg-slate-800"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => openEdit(c)}
                        title="ویرایش"
                        className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
                      >
                        <Pencil size={16} />
                      </button>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(c)}
                          title="حذف"
                          className="rounded-md p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600 dark:text-slate-400 dark:hover:bg-rose-950/40"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </Table>
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
        title={`حذف ${packConfig.singularLabel}`}
        message={`آیا از حذف «${deleteTarget?.name ?? ''}» مطمئن هستید؟ این عملیات غیرقابل بازگشت است.`}
        confirmLabel="حذف قطعی"
      />
    </div>
  );
}
