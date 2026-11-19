import { useEffect, useState } from 'react';
import type {
  CustomFieldDef,
  CustomFieldEntity,
  CustomFieldType,
  CustomFieldValidation,
} from '../../types';
import { ENTITY_LABELS, FIELD_TYPE_LABELS } from '../../utils/customFieldValidation';
import { Button, Input, Modal, Select } from '../ui';

interface FieldDefModalProps {
  open: boolean;
  editing: CustomFieldDef | null;
  defaultEntity?: CustomFieldEntity;
  existingDefs: CustomFieldDef[];
  onClose: () => void;
  onSave: (def: Omit<CustomFieldDef, 'id'>) => void;
}

export function FieldDefModal({
  open,
  editing,
  defaultEntity = 'customer',
  existingDefs,
  onClose,
  onSave,
}: FieldDefModalProps) {
  const [label, setLabel] = useState('');
  const [key, setKey] = useState('');
  const [entity, setEntity] = useState<CustomFieldEntity>(defaultEntity);
  const [type, setType] = useState<CustomFieldType>('text');
  const [optionsText, setOptionsText] = useState('');
  const [lookupEntity, setLookupEntity] = useState<'customer' | 'product' | 'service' | 'resource'>('customer');
  const [formulaExpr, setFormulaExpr] = useState('');
  const [required, setRequired] = useState(false);
  const [unique, setUnique] = useState(false);
  const [showInTable, setShowInTable] = useState(false);
  const [active, setActive] = useState(true);

  const [valMin, setValMin] = useState('');
  const [valMax, setValMax] = useState('');
  const [valMinLen, setValMinLen] = useState('');
  const [valMaxLen, setValMaxLen] = useState('');
  const [valPattern, setValPattern] = useState('');
  const [valMsg, setValMsg] = useState('');

  const [visibleKey, setVisibleKey] = useState('');
  const [visibleEquals, setVisibleEquals] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setLabel(editing.label);
      setKey(editing.key);
      setEntity(editing.entity ?? 'customer');
      setType(editing.type);
      setOptionsText((editing.options ?? []).join('، '));
      setLookupEntity(editing.lookupEntity ?? 'customer');
      setFormulaExpr(editing.formulaExpr ?? '');
      setRequired(Boolean(editing.required));
      setUnique(Boolean(editing.unique));
      setShowInTable(Boolean(editing.showInTable));
      setActive(editing.active !== false);
      setValMin(editing.validation?.min !== undefined ? String(editing.validation.min) : '');
      setValMax(editing.validation?.max !== undefined ? String(editing.validation.max) : '');
      setValMinLen(editing.validation?.minLength !== undefined ? String(editing.validation.minLength) : '');
      setValMaxLen(editing.validation?.maxLength !== undefined ? String(editing.validation.maxLength) : '');
      setValPattern(editing.validation?.pattern ?? '');
      setValMsg(editing.validation?.message ?? '');
      setVisibleKey(editing.visibleWhen?.fieldKey ?? '');
      setVisibleEquals(editing.visibleWhen?.equals ?? '');
    } else {
      setLabel('');
      setKey('');
      setEntity(defaultEntity);
      setType('text');
      setOptionsText('');
      setLookupEntity('customer');
      setFormulaExpr('');
      setRequired(false);
      setUnique(false);
      setShowInTable(false);
      setActive(true);
      setValMin('');
      setValMax('');
      setValMinLen('');
      setValMaxLen('');
      setValPattern('');
      setValMsg('');
      setVisibleKey('');
      setVisibleEquals('');
    }
    setError('');
  }, [open, editing, defaultEntity]);

  const sameEntityCandidates = existingDefs.filter(
    (d) => (d.entity ?? 'customer') === entity && d.id !== editing?.id,
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) {
      setError('عنوان فیلد الزامی است.');
      return;
    }
    const sanitizedKey =
      key.trim().replace(/[^a-zA-Z0-9_]/g, '') || `cf_${Date.now().toString(36)}`;

    const duplicateKey = existingDefs.find(
      (d) => d.key === sanitizedKey && (d.entity ?? 'customer') === entity && d.id !== editing?.id,
    );
    if (duplicateKey) {
      setError(`کلید «${sanitizedKey}» قبلاً برای این موجودیت تعریف شده است.`);
      return;
    }

    const validation: CustomFieldValidation = {};
    if (valMin !== '' && !Number.isNaN(Number(valMin))) validation.min = Number(valMin);
    if (valMax !== '' && !Number.isNaN(Number(valMax))) validation.max = Number(valMax);
    if (valMinLen !== '' && !Number.isNaN(Number(valMinLen))) validation.minLength = Number(valMinLen);
    if (valMaxLen !== '' && !Number.isNaN(Number(valMaxLen))) validation.maxLength = Number(valMaxLen);
    if (valPattern.trim()) validation.pattern = valPattern.trim();
    if (valMsg.trim()) validation.message = valMsg.trim();

    onSave({
      entity,
      key: sanitizedKey,
      label: label.trim(),
      type,
      options:
        type === 'select' || type === 'multiselect'
          ? optionsText
              .split(/[,،]/)
              .map((o) => o.trim())
              .filter(Boolean)
          : undefined,
      lookupEntity: type === 'lookup' ? lookupEntity : undefined,
      formulaExpr: type === 'formula' ? formulaExpr.trim() : undefined,
      required,
      unique,
      showInTable,
      active,
      validation: Object.keys(validation).length > 0 ? validation : undefined,
      visibleWhen:
        visibleKey && visibleEquals.trim()
          ? { fieldKey: visibleKey, equals: visibleEquals.trim() }
          : undefined,
      order: editing?.order,
    });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? `ویرایش فیلد: ${editing.label}` : 'تعریف فیلد سفارشی جدید'}
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="عنوان فیلد *"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="مثلاً: کد پیگیری بیمه / بودجه تخمینی"
          />
          <Input
            label="کلید سیستمی (انگلیسی)"
            dir="ltr"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="insurance_code"
            className="text-left font-mono"
            disabled={Boolean(editing)}
          />
          <Select
            label="موجودیت هدف"
            value={entity}
            onChange={(e) => {
              setEntity(e.target.value as CustomFieldEntity);
              setVisibleKey('');
            }}
            options={(Object.keys(ENTITY_LABELS) as CustomFieldEntity[]).map((k) => ({
              value: k,
              label: ENTITY_LABELS[k],
            }))}
          />
          <Select
            label="نوع فیلد"
            value={type}
            onChange={(e) => setType(e.target.value as CustomFieldType)}
            options={(Object.keys(FIELD_TYPE_LABELS) as CustomFieldType[]).map((t) => ({
              value: t,
              label: FIELD_TYPE_LABELS[t],
            }))}
          />
        </div>

        {(type === 'select' || type === 'multiselect') && (
          <Input
            label="گزینه‌ها (با ویرگول جدا کنید)"
            value={optionsText}
            onChange={(e) => setOptionsText(e.target.value)}
            placeholder="طلایی، نقره‌ای، برنزی"
          />
        )}

        {type === 'lookup' && (
          <Select
            label="ارجاع به موجودیت"
            value={lookupEntity}
            onChange={(e) =>
              setLookupEntity(e.target.value as 'customer' | 'product' | 'service' | 'resource')
            }
            options={[
              { value: 'customer', label: 'مشتریان' },
              { value: 'product', label: 'محصولات' },
              { value: 'service', label: 'خدمات' },
              { value: 'resource', label: 'منابع / کارشناسان' },
            ]}
          />
        )}

        {type === 'formula' && (
          <Input
            label="عبارت فرمول محاسباتی"
            dir="ltr"
            value={formulaExpr}
            onChange={(e) => setFormulaExpr(e.target.value)}
            placeholder="{sessions_count} * 500000"
            className="text-left font-mono"
          />
        )}

        <div className="flex flex-wrap gap-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs dark:border-slate-700 dark:bg-slate-800/50">
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} />
            <span>اجباری (Required)</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={unique} onChange={(e) => setUnique(e.target.checked)} />
            <span>مقدار یکتا (Unique)</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={showInTable} onChange={(e) => setShowInTable(e.target.checked)} />
            <span>نمایش به‌عنوان ستون در جدول / کارت</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            <span>فیلد فعال</span>
          </label>
        </div>

        <div className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">قوانین اعتبارسنجی (Validation Rules)</p>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <Input
              label="حداقل مقدار"
              type="number"
              dir="ltr"
              value={valMin}
              onChange={(e) => setValMin(e.target.value)}
              className="text-left tabular-nums"
            />
            <Input
              label="حداکثر مقدار"
              type="number"
              dir="ltr"
              value={valMax}
              onChange={(e) => setValMax(e.target.value)}
              className="text-left tabular-nums"
            />
            <Input
              label="حداقل طول متن"
              type="number"
              dir="ltr"
              value={valMinLen}
              onChange={(e) => setValMinLen(e.target.value)}
              className="text-left tabular-nums"
            />
            <Input
              label="حداکثر طول متن"
              type="number"
              dir="ltr"
              value={valMaxLen}
              onChange={(e) => setValMaxLen(e.target.value)}
              className="text-left tabular-nums"
            />
          </div>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <Input
              label="الگوی Regex (اختیاری)"
              dir="ltr"
              value={valPattern}
              onChange={(e) => setValPattern(e.target.value)}
              placeholder="^[A-Z0-9-]+$"
              className="text-left font-mono"
            />
            <Input
              label="پیام خطای سفارشی"
              value={valMsg}
              onChange={(e) => setValMsg(e.target.value)}
              placeholder="مثلاً: فرمت کد مجوز معتبر نیست"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2.5 rounded-lg border border-slate-200 p-3 sm:grid-cols-2 dark:border-slate-700">
          <Select
            label="نمایش شرطی (وابسته به فیلد)"
            value={visibleKey}
            onChange={(e) => setVisibleKey(e.target.value)}
            options={[
              { value: '', label: '-- همیشه نمایش داده شود --' },
              ...sameEntityCandidates.map((f) => ({
                value: f.key,
                label: `${f.label} (${f.key})`,
              })),
            ]}
          />
          <Input
            label="فقط وقتی مقدارش برابر باشد با"
            value={visibleEquals}
            onChange={(e) => setVisibleEquals(e.target.value)}
            disabled={!visibleKey}
            placeholder="مثلاً: true یا حضوری"
          />
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
          <Button variant="secondary" size="md" onClick={onClose}>
            انصراف
          </Button>
          <Button type="submit" size="md">
            {editing ? 'ذخیره تغییرات فیلد' : 'افزودن فیلد به فرم'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
