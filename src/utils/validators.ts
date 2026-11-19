import { z } from 'zod';

/** Normalize Persian (۰-۹) and Arabic-Indic (٠-٩) digits to ASCII 0-9 */
export function normalizeDigits(raw: string): string {
  return raw
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

/** Normalize +98 / 0098 / 9xxxxxxxxx phone input to 09xxxxxxxxx */
export function normalizeIranMobile(raw: string): string {
  const ascii = normalizeDigits(raw).replace(/[\s\-()]/g, '');
  if (ascii.startsWith('+98')) return '0' + ascii.slice(3);
  if (ascii.startsWith('0098')) return '0' + ascii.slice(4);
  if (ascii.startsWith('98') && ascii.length === 12) return '0' + ascii.slice(2);
  if (ascii.startsWith('9') && ascii.length === 10) return '0' + ascii;
  return ascii;
}

/** Iranian mobile validation: 09xxxxxxxxx */
export function isValidIranMobile(raw: string): boolean {
  return /^09\d{9}$/.test(normalizeIranMobile(raw));
}

/**
 * Iranian National ID (کد ملی) validation with official Mod-11 checksum.
 * Rejects repeated-digit sequences such as 0000000000 or 1111111111.
 */
export function isValidIranNationalId(raw: string): boolean {
  const code = normalizeDigits(raw).trim();
  if (!/^\d{10}$/.test(code)) return false;
  if (/^(\d)\1{9}$/.test(code)) return false;
  const check = Number(code[9]);
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += Number(code[i]) * (10 - i);
  }
  const remainder = sum % 11;
  return remainder < 2 ? check === remainder : check === 11 - remainder;
}

/** Generate a valid checksum National ID (useful for fictional seed records) */
export function makeSampleNationalId(seedNumber: number): string {
  const base9 = String(Math.abs(seedNumber) % 899999999 + 100000000).slice(0, 9);
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += Number(base9[i]) * (10 - i);
  }
  const rem = sum % 11;
  const check = rem < 2 ? rem : 11 - rem;
  return `${base9}${check}`;
}

/** Iranian 10-digit postal code validation (cannot start with 0 or 2 or repeat all digits) */
export function isValidIranPostalCode(raw: string): boolean {
  const code = normalizeDigits(raw).replace(/[\s\-]/g, '');
  if (!/^[13-9]\d{9}$/.test(code)) return false;
  if (/^(\d)\1{9}$/.test(code)) return false;
  return true;
}

/** Integer-safe Toman money helper (guards NaN/Infinity and rounds safely) */
export function toSafeToman(value: number | string | undefined | null): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? Math.round(value) : 0;
  }
  if (typeof value === 'string') {
    const cleaned = normalizeDigits(value).replace(/[,\s]/g, '');
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? Math.round(parsed) : 0;
  }
  return 0;
}

export const customerFormSchema = z
  .object({
    personType: z.enum(['individual', 'organization']),
    name: z.string().trim().min(2, 'نام مشتری باید حداقل ۲ کاراکتر باشد.'),
    phone: z
      .string()
      .transform(normalizeIranMobile)
      .refine((v) => /^09\d{9}$/.test(v), 'شماره موبایل معتبر نیست (فرمت صحیح: ۰۹xxxxxxxxx).'),
    email: z
      .string()
      .trim()
      .optional()
      .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'فرمت ایمیل معتبر نیست.'),
    nationalId: z
      .string()
      .optional()
      .transform((v) => (v ? normalizeDigits(v).trim() : ''))
      .refine((v) => !v || isValidIranNationalId(v), 'کد ملی معتبر نیست (رقم کنترل کد ملی صحیح نیست).'),
    companyName: z.string().trim().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.personType === 'organization' && !val.companyName?.trim() && !val.name.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['companyName'],
        message: 'برای مشتری حقوقی، نام سازمان الزامی است.',
      });
    }
  });

export const contactSchema = z.object({
  name: z.string().trim().min(2, 'نام مخاطب الزامی است.'),
  role: z.string().trim().optional(),
  phone: z
    .string()
    .transform(normalizeIranMobile)
    .refine((v) => /^09\d{9}$/.test(v), 'شماره موبایل مخاطب باید با ۰۹ شروع شود و ۱۱ رقم باشد.'),
  email: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'ایمیل مخاطب معتبر نیست.'),
});

export const addressSchema = z.object({
  title: z.string().trim().min(1, 'عنوان آدرس الزامی است.'),
  address: z.string().trim().min(4, 'نشانی پستی باید کامل‌تر باشد.'),
  postalCode: z
    .string()
    .optional()
    .transform((v) => (v ? normalizeDigits(v).replace(/[\s\-]/g, '') : ''))
    .refine((v) => !v || isValidIranPostalCode(v), 'کد پستی باید ۱۰ رقم معتبر ایرانی باشد.'),
});

export const interactionSchema = z.object({
  channel: z.enum(['call', 'sms', 'whatsapp', 'visit', 'note']),
  text: z.string().trim().min(2, 'شرح تعامل را وارد کنید.'),
  outcome: z.enum(['answered', 'no_answer', 'interested', 'quote_requested', 'follow_up', 'not_interested']).optional(),
  followUpAt: z.string().optional(),
});
