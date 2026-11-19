import { z } from 'zod';
import type { CustomFieldDef, CustomFieldEntity, CustomFieldType } from '../types';
import { isFieldVisible } from './crmHelpers';
import { formatToman, toFa } from './jalali';
import { isValidIranMobile, isValidIranNationalId, normalizeDigits } from './validators';

export const ENTITY_LABELS: Record<CustomFieldEntity, string> = {
  customer: 'مشتری',
  order: 'سفارش',
  appointment: 'نوبت',
  opportunity: 'فرصت فروش',
  ticket: 'تیکت پشتیبانی',
  product: 'محصول / کالا',
};

export const FIELD_TYPE_LABELS: Record<CustomFieldType, string> = {
  text: 'متنی',
  number: 'عددی',
  money: 'مبلغ (تومان)',
  date: 'تاریخ شمسی',
  select: 'لیست کشویی (Select)',
  multiselect: 'چندانتخابی (Multi-select)',
  checkbox: 'چک‌باکس (بله/خیر)',
  phone: 'شماره موبایل',
  nationalId: 'کد ملی',
  file: 'پیوست فایل',
  lookup: 'ارجاع به موجودیت (Lookup)',
  formula: 'فرمول محاسباتی',
};

export function getFieldsForEntity(
  defs: CustomFieldDef[],
  entity?: CustomFieldEntity,
  includeInactive = false,
): CustomFieldDef[] {
  return [...defs]
    .filter((f) => (includeInactive ? true : f.active !== false))
    .filter((f) => (!entity ? true : (f.entity ?? 'customer') === entity))
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
}

export function getTableCustomFields(defs: CustomFieldDef[], entity: CustomFieldEntity): CustomFieldDef[] {
  return getFieldsForEntity(defs, entity, false).filter((f) => Boolean(f.showInTable));
}

export function formatCustomFieldValue(def: CustomFieldDef, rawValue?: string): string {
  const val = rawValue?.trim() ?? '';
  if (!val) return '—';
  if (def.type === 'checkbox') {
    return val === 'true' ? 'بله' : 'خیر';
  }
  if (def.type === 'money') {
    const num = Number(normalizeDigits(val).replace(/,/g, ''));
    return Number.isFinite(num) ? formatToman(num) : toFa(val);
  }
  if (def.type === 'number' || def.type === 'date' || def.type === 'phone' || def.type === 'nationalId') {
    return toFa(val);
  }
  return val;
}

export interface ValidateCustomFieldsOptions {
  entity?: CustomFieldEntity;
  existingRecords?: { id: string; customFields?: Record<string, string> }[];
  currentRecordId?: string;
}

export function validateCustomFieldValues(
  defs: CustomFieldDef[],
  values: Record<string, string>,
  options: ValidateCustomFieldsOptions = {},
): { ok: boolean; errors: Record<string, string> } {
  const activeDefs = getFieldsForEntity(defs, options.entity, false);
  const errors: Record<string, string> = {};

  for (const def of activeDefs) {
    if (!isFieldVisible(def, values)) continue;
    if (def.type === 'formula') continue;

    const raw = (values[def.key] ?? '').trim();

    if (def.required) {
      if (def.type === 'checkbox') {
        if (raw !== 'true') {
          errors[def.key] = def.validation?.message || `تایید «${def.label}» الزامی است.`;
          continue;
        }
      } else if (!raw) {
        errors[def.key] = def.validation?.message || `فیلد «${def.label}» الزامی است.`;
        continue;
      }
    }

    if (!raw) continue;

    if (def.type === 'phone' && !isValidIranMobile(raw)) {
      errors[def.key] = def.validation?.message || 'شماره موبایل معتبر نیست (۰۹xxxxxxxxx).';
      continue;
    }

    if (def.type === 'nationalId' && !isValidIranNationalId(raw)) {
      errors[def.key] = def.validation?.message || 'کد ملی ۱۰ رقمی معتبر نیست.';
      continue;
    }

    if (def.type === 'number' || def.type === 'money') {
      const num = Number(normalizeDigits(raw).replace(/,/g, ''));
      if (!Number.isFinite(num)) {
        errors[def.key] = 'مقدار عددی معتبر وارد کنید.';
        continue;
      }
      if (def.validation?.min !== undefined && num < def.validation.min) {
        errors[def.key] =
          def.validation.message || `حداقل مقدار مجاز ${toFa(def.validation.min)} است.`;
        continue;
      }
      if (def.validation?.max !== undefined && num > def.validation.max) {
        errors[def.key] =
          def.validation.message || `حداکثر مقدار مجاز ${toFa(def.validation.max)} است.`;
        continue;
      }
    }

    if (def.validation?.minLength !== undefined && raw.length < def.validation.minLength) {
      errors[def.key] =
        def.validation.message || `حداقل طول مجاز ${toFa(def.validation.minLength)} کاراکتر است.`;
      continue;
    }

    if (def.validation?.maxLength !== undefined && raw.length > def.validation.maxLength) {
      errors[def.key] =
        def.validation.message || `حداکثر طول مجاز ${toFa(def.validation.maxLength)} کاراکتر است.`;
      continue;
    }

    if (def.validation?.pattern) {
      try {
        const re = new RegExp(def.validation.pattern);
        if (!re.test(raw)) {
          errors[def.key] = def.validation.message || `قالب مقدار «${def.label}» صحیح نیست.`;
          continue;
        }
      } catch {
        // Ignore invalid user regex safely
      }
    }

    if (def.unique && options.existingRecords) {
      const norm = normalizeDigits(raw).toLowerCase();
      const conflict = options.existingRecords.find(
        (rec) =>
          rec.id !== options.currentRecordId &&
          normalizeDigits((rec.customFields?.[def.key] ?? '').trim()).toLowerCase() === norm,
      );
      if (conflict) {
        errors[def.key] = `مقدار فیلد «${def.label}» تکراری است و قبلاً ثبت شده.`;
      }
    }
  }

  return { ok: Object.keys(errors).length === 0, errors };
}

export const configBundleSchema = z.object({
  schemaVersion: z.number().optional(),
  businessName: z.string().optional(),
  industryPack: z.string().optional(),
  customFieldDefs: z.array(z.any()),
  customEntityDefs: z.array(z.any()).optional(),
  entityRelations: z.array(z.any()).optional(),
  pipelineStages: z.array(z.any()).optional(),
  commissionTiers: z.array(z.any()).optional(),
  workflowDefinitions: z.array(z.any()).optional(),
  rules: z.array(z.any()).optional(),
  numbering: z.any().optional(),
  dashboardWidgets: z.array(z.any()).optional(),
});
