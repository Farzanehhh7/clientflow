import { describe, expect, it } from 'vitest';
import type { CustomFieldDef } from '../types';
import { validateCustomFieldValues } from '../utils/customFieldValidation';
import {
  customerFormSchema,
  isValidIranMobile,
  isValidIranNationalId,
  isValidIranPostalCode,
  makeSampleNationalId,
  normalizeDigits,
  normalizeIranMobile,
  toSafeToman,
} from '../utils/validators';

describe('Iranian Validators & Custom Field Validation', () => {
  it('normalizes Persian/Arabic digits and validates Iranian mobile numbers', () => {
    expect(normalizeDigits('۰۹۱۲-۳۴۵۶٧٨٩')).toBe('0912-3456789');
    expect(normalizeIranMobile('+98 912 345 6789')).toBe('09123456789');
    expect(normalizeIranMobile('00989123456789')).toBe('09123456789');
    expect(isValidIranMobile('۰۹۱۲۳۴۵۶۷۸۹')).toBe(true);
    expect(isValidIranMobile('08123456789')).toBe(false);
  });

  it('validates Iranian National ID Mod-11 checksum and rejects repeated digits', () => {
    const valid = makeSampleNationalId(44556677);
    expect(isValidIranNationalId(valid)).toBe(true);
    // Corrupt check digit
    const badCheck = valid.slice(0, 9) + String((Number(valid[9]) + 1) % 10);
    expect(isValidIranNationalId(badCheck)).toBe(false);
    expect(isValidIranNationalId('1111111111')).toBe(false);
    expect(isValidIranNationalId('12345')).toBe(false);
  });

  it('validates Iranian postal codes and safe Toman numbers', () => {
    expect(isValidIranPostalCode('1417613151')).toBe(true);
    expect(isValidIranPostalCode('0417613151')).toBe(false); // cannot start with 0
    expect(toSafeToman('۱,۲۵۰,۰۰۰')).toBe(1250000);
    expect(toSafeToman(Number.NaN)).toBe(0);
  });

  it('validates customerFormSchema cleanly', () => {
    const validNid = makeSampleNationalId(998877);
    const ok = customerFormSchema.safeParse({
      personType: 'individual',
      name: 'مهسا نوری',
      phone: '+989121234567',
      email: 'mahsa@example.ir',
      nationalId: validNid,
    });
    expect(ok.success).toBe(true);
    if (ok.success) {
      expect(ok.data.phone).toBe('09121234567');
    }

    const bad = customerFormSchema.safeParse({
      personType: 'individual',
      name: 'آ',
      phone: '1234',
    });
    expect(bad.success).toBe(false);
  });

  it('validates dynamic custom fields including required, unique, min/max, and visibleWhen', () => {
    const defs: CustomFieldDef[] = [
      { id: 'f1', key: 'has_insurance', label: 'بیمه تکمیلی', type: 'checkbox', entity: 'customer' },
      {
        id: 'f2',
        key: 'insurance_no',
        label: 'شماره بیمه‌نامه',
        type: 'text',
        entity: 'customer',
        required: true,
        unique: true,
        visibleWhen: { fieldKey: 'has_insurance', equals: 'true' },
      },
      {
        id: 'f3',
        key: 'credit_limit',
        label: 'سقف اعتبار',
        type: 'money',
        entity: 'customer',
        validation: { min: 100_000, max: 50_000_000 },
      },
    ];

    // Hidden required field should NOT fail validation when visibleWhen is unmet
    expect(
      validateCustomFieldValues(defs, { has_insurance: 'false', credit_limit: '500000' }, { entity: 'customer' }).ok,
    ).toBe(true);

    // Visible required field missing -> error; below min -> error
    const resErr = validateCustomFieldValues(
      defs,
      { has_insurance: 'true', insurance_no: '', credit_limit: '50000' },
      { entity: 'customer' },
    );
    expect(resErr.ok).toBe(false);
    expect(resErr.errors.insurance_no).toBeTruthy();
    expect(resErr.errors.credit_limit).toBeTruthy();

    // Uniqueness collision
    const resUnique = validateCustomFieldValues(
      defs,
      { has_insurance: 'true', insurance_no: 'INS-100' },
      {
        entity: 'customer',
        currentRecordId: 'c2',
        existingRecords: [{ id: 'c1', customFields: { insurance_no: 'ins-100' } }],
      },
    );
    expect(resUnique.ok).toBe(false);
    expect(resUnique.errors.insurance_no).toContain('تکراری');
  });
});
