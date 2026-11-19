import { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Download,
  Edit3,
  Eye,
  EyeOff,
  GripVertical,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react';
import { useClientFlow } from '../../store/useClientFlowStore';
import type { CustomFieldDef, CustomFieldEntity } from '../../types';
import { ENTITY_LABELS, FIELD_TYPE_LABELS } from '../../utils/customFieldValidation';
import { toFa } from '../../utils/jalali';
import { Badge, Button, ConfirmDialog } from '../ui';
import { FieldDefModal } from './FieldDefModal';

export function FieldsAndFormsTab() {
  const {
    state,
    addCustomFieldDef,
    updateCustomFieldDef,
    removeCustomFieldDef,
    reorderCustomFieldDefs,
    exportConfigJson,
    importConfigJson,
    pushToast,
  } = useClientFlow();

  const [entityFilter, setEntityFilter] = useState<'all' | CustomFieldEntity>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CustomFieldDef | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CustomFieldDef | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const sortedAll = useMemo(
    () => [...state.customFieldDefs].sort((a, b) => (a.order ?? 999) - (b.order ?? 999)),
    [state.customFieldDefs],
  );

  const visibleFields = useMemo(
    () =>
      entityFilter === 'all'
        ? sortedAll
        : sortedAll.filter((f) => (f.entity ?? 'customer') === entityFilter),
    [sortedAll, entityFilter],
  );

  const moveFieldByStep = (idx: number, dir: -1 | 1) => {
    const nextIdx = idx + dir;
    if (nextIdx < 0 || nextIdx >= visibleFields.length) return;
    const subset = [...visibleFields];
    const [moved] = subset.splice(idx, 1);
    subset.splice(nextIdx, 0, moved);
    reorderCustomFieldDefs(subset.map((f) => f.id));
  };

  const handleDrop = (targetId: string) => {
    if (!draggingId || draggingId === targetId) return;
    const subset = [...visibleFields];
    const fromIdx = subset.findIndex((f) => f.id === draggingId);
    const toIdx = subset.findIndex((f) => f.id === targetId);
    if (fromIdx < 0 || toIdx < 0) return;
    const [moved] = subset.splice(fromIdx, 1);
    subset.splice(toIdx, 0, moved);
    reorderCustomFieldDefs(subset.map((f) => f.id));
    setDraggingId(null);
  };

  const handleExportConfig = () => {
    const json = exportConfigJson();
    const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clientflow-config-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    pushToast('فایل JSON پیکربندی صادر شد.');
  };

  const handleImportConfig = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const res = importConfigJson(text);
    if (!res.ok) {
      pushToast(res.error ?? 'خطا در ورود پیکربندی', 'error');
    }
    e.target.value = '';
  };

  const entityKeys = Object.keys(ENTITY_LABELS) as CustomFieldEntity[];

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">فیلدها و فرم‌های پویا (۱۲ نوع فیلد + اعتبارسنجی + نمایش شرطی)</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            برای هر بخش از CRM فیلد اختصاصی بسازید، قوانین یکتا/اجباری تعیین کنید، ترتیب را تغییر دهید یا پیکربندی خود را به‌صورت JSON خروجی بگیرید.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" onClick={handleExportConfig}>
            <Download size={14} />
            خروجی JSON پیکربندی من
          </Button>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
            <Upload size={14} />
            ورود پیکربندی JSON
            <input type="file" accept=".json,application/json" onChange={handleImportConfig} className="hidden" />
          </label>
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
          >
            <Plus size={14} />
            فیلد جدید
          </Button>
        </div>
      </div>

      {/* Entity Filter Chips */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-slate-50 p-1.5 dark:bg-slate-800/60">
        <button
          type="button"
          onClick={() => setEntityFilter('all')}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
            entityFilter === 'all'
              ? 'bg-white text-indigo-700 shadow-sm dark:bg-slate-900 dark:text-indigo-300'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
          }`}
        >
          همه بخش‌ها ({toFa(sortedAll.length)})
        </button>
        {entityKeys.map((ent) => {
          const count = sortedAll.filter((f) => (f.entity ?? 'customer') === ent).length;
          return (
            <button
              key={ent}
              type="button"
              onClick={() => setEntityFilter(ent)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                entityFilter === ent
                  ? 'bg-white text-indigo-700 shadow-sm dark:bg-slate-900 dark:text-indigo-300'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
              }`}
            >
              {ENTITY_LABELS[ent]} ({toFa(count)})
            </button>
          );
        })}
      </div>

      {/* Field Definitions List */}
      <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
        {visibleFields.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-slate-500">
            هیچ فیلدی برای این بخش تعریف نشده است. روی «فیلد جدید» کلیک کنید.
          </div>
        ) : (
          visibleFields.map((f, idx) => {
            const isActive = f.active !== false;
            const ent = f.entity ?? 'customer';
            return (
              <div
                key={f.id}
                draggable
                onDragStart={() => setDraggingId(f.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(f.id)}
                className={`flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-xs transition-colors ${
                  isActive
                    ? 'hover:bg-slate-50/70 dark:hover:bg-slate-800/40'
                    : 'bg-slate-50/80 opacity-65 dark:bg-slate-800/20'
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <GripVertical size={15} className="cursor-grab text-slate-400" />
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{f.label}</span>
                  <span className="font-mono text-[11px] text-slate-400" dir="ltr">
                    ({f.key})
                  </span>
                  <Badge tone="indigo">{ENTITY_LABELS[ent]}</Badge>
                  <Badge tone="neutral">{FIELD_TYPE_LABELS[f.type]}</Badge>
                  {f.required && <Badge tone="rose">اجباری</Badge>}
                  {f.unique && <Badge tone="amber">یکتا</Badge>}
                  {f.showInTable && <Badge tone="emerald">ستون جدول</Badge>}
                  {!isActive && <Badge tone="neutral">غیرفعال</Badge>}
                  {f.visibleWhen && (
                    <span className="text-[11px] text-amber-600 dark:text-amber-400">
                      شرط: {f.visibleWhen.fieldKey} = {f.visibleWhen.equals}
                    </span>
                  )}
                  {f.formulaExpr && (
                    <span className="font-mono text-[11px] text-indigo-500" dir="ltr">
                      [{f.formulaExpr}]
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => moveFieldByStep(idx, -1)}
                    disabled={idx === 0}
                    title="انتقال به بالا"
                    className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800"
                  >
                    <ArrowUp size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveFieldByStep(idx, 1)}
                    disabled={idx === visibleFields.length - 1}
                    title="انتقال به پایین"
                    className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800"
                  >
                    <ArrowDown size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => updateCustomFieldDef(f.id, { active: !isActive })}
                    title={isActive ? 'غیرفعال‌سازی فیلد' : 'فعال‌سازی فیلد'}
                    className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 dark:hover:bg-slate-800"
                  >
                    {isActive ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(f);
                      setModalOpen(true);
                    }}
                    title="ویرایش فیلد"
                    className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 dark:hover:bg-slate-800"
                  >
                    <Edit3 size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(f)}
                    title="حذف فیلد"
                    className="rounded p-1 text-slate-400 hover:text-rose-600"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <FieldDefModal
        open={modalOpen}
        editing={editing}
        defaultEntity={entityFilter === 'all' ? 'customer' : entityFilter}
        existingDefs={state.customFieldDefs}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onSave={(def) => {
          if (editing) {
            updateCustomFieldDef(editing.id, def);
            pushToast(`فیلد «${def.label}» به‌روزرسانی شد.`);
          } else {
            addCustomFieldDef(def);
          }
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="حذف تعریف فیلد"
        message={
          deleteTarget
            ? `آیا از حذف فیلد «${deleteTarget.label}» اطمینان دارید؟ مقادیر ذخیره‌شده قبلی در سوابق مشتریان حفظ می‌شوند و در فرم‌های جدید نمایش داده نخواهد شد.`
            : ''
        }
        confirmLabel="حذف فیلد"
        danger
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) removeCustomFieldDef(deleteTarget.id);
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}
