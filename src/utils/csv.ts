import * as XLSX from 'xlsx';
import type { Customer, CustomerLifecycle, CustomerPersonType } from '../types';
import {
  isValidIranMobile,
  isValidIranNationalId,
  normalizeDigits,
  normalizeIranMobile,
} from './validators';

export type CsvImportMapping = {
  nameCol: string;
  phoneCol: string;
  emailCol: string;
  nationalIdCol?: string;
  companyCol?: string;
  tagsCol: string;
  sourceCol: string;
  ownerCol?: string;
};

export type CsvRowError = {
  rowNumber: number;
  rawName: string;
  rawPhone: string;
  reason: string;
};

export type CsvImportResult = {
  validCustomers: Customer[];
  errors: CsvRowError[];
};

/** Parse CSV text respecting quoted fields and commas */
export function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const cleaned = text.replace(/^\uFEFF/, '').trim();
  if (!cleaned) return { headers: [], rows: [] };

  const lines: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    const next = cleaned[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        currentField += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        currentField += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if (ch === '\n' || (ch === '\r' && next === '\n')) {
        if (ch === '\r') i++;
        currentRow.push(currentField.trim());
        if (currentRow.some((c) => c !== '')) lines.push(currentRow);
        currentRow = [];
        currentField = '';
      } else if (ch === '\r') {
        currentRow.push(currentField.trim());
        if (currentRow.some((c) => c !== '')) lines.push(currentRow);
        currentRow = [];
        currentField = '';
      } else {
        currentField += ch;
      }
    }
  }
  currentRow.push(currentField.trim());
  if (currentRow.some((c) => c !== '')) lines.push(currentRow);

  if (lines.length === 0) return { headers: [], rows: [] };
  const [headers, ...rows] = lines;
  return { headers, rows };
}

/** Parse CSV or XLSX/XLS file into uniform headers and string rows */
export async function parseSpreadsheetFile(file: File): Promise<{ headers: string[]; rows: string[][] }> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const firstSheet = workbook.SheetNames[0];
    if (!firstSheet) return { headers: [], rows: [] };
    const sheet = workbook.Sheets[firstSheet];
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
    if (matrix.length === 0) return { headers: [], rows: [] };
    const headers = matrix[0].map((cell) => String(cell ?? '').trim());
    const rows = matrix
      .slice(1)
      .map((r) => r.map((cell) => String(cell ?? '').trim()))
      .filter((r) => r.some((c) => c !== ''));
    return { headers, rows };
  }
  const text = await file.text();
  return parseCsv(text);
}

/** Normalize Persian/Arabic digits and +98 prefix to 09xxxxxxxxx */
export const normalizeMobileInput = normalizeIranMobile;

export function validateAndBuildCustomers(
  headers: string[],
  rows: string[][],
  mapping: CsvImportMapping,
  existingPhones: Set<string>,
  defaultBranchId?: string,
): CsvImportResult {
  const idx = (colName?: string) => (colName ? headers.indexOf(colName) : -1);
  const nameIdx = idx(mapping.nameCol);
  const phoneIdx = idx(mapping.phoneCol);
  const emailIdx = idx(mapping.emailCol);
  const nidIdx = idx(mapping.nationalIdCol);
  const companyIdx = idx(mapping.companyCol);
  const tagsIdx = idx(mapping.tagsCol);
  const sourceIdx = idx(mapping.sourceCol);
  const ownerIdx = idx(mapping.ownerCol);

  const validCustomers: Customer[] = [];
  const errors: CsvRowError[] = [];
  const seenPhones = new Set(existingPhones);

  rows.forEach((row, i) => {
    const rowNumber = i + 2;
    const name = nameIdx >= 0 ? (row[nameIdx] ?? '').trim() : '';
    const rawPhone = phoneIdx >= 0 ? (row[phoneIdx] ?? '').trim() : '';
    const phone = normalizeMobileInput(rawPhone);
    const email = emailIdx >= 0 ? (row[emailIdx] ?? '').trim() : '';
    const rawNid = nidIdx >= 0 ? normalizeDigits(row[nidIdx] ?? '').trim() : '';
    const companyName = companyIdx >= 0 ? (row[companyIdx] ?? '').trim() : '';
    const tagsRaw = tagsIdx >= 0 ? (row[tagsIdx] ?? '').trim() : '';
    const source = sourceIdx >= 0 ? (row[sourceIdx] ?? '').trim() : '';
    const ownerName = ownerIdx >= 0 ? (row[ownerIdx] ?? '').trim() : '';

    if (!name) {
      errors.push({ rowNumber, rawName: name, rawPhone, reason: 'نام مشتری خالی است' });
      return;
    }
    if (!isValidIranMobile(phone)) {
      errors.push({
        rowNumber,
        rawName: name,
        rawPhone,
        reason: 'شماره موبایل نامعتبر است (فرمت صحیح: 09xxxxxxxxx)',
      });
      return;
    }
    if (seenPhones.has(phone)) {
      errors.push({
        rowNumber,
        rawName: name,
        rawPhone,
        reason: 'شماره موبایل تکراری است',
      });
      return;
    }
    if (rawNid && !isValidIranNationalId(rawNid)) {
      errors.push({
        rowNumber,
        rawName: name,
        rawPhone,
        reason: 'کد ملی نامعتبر است (خطا در رقم کنترل ۱۰ رقمی)',
      });
      return;
    }

    seenPhones.add(phone);
    const tags = tagsRaw
      ? tagsRaw
          .split(/[|؛;،,]/)
          .map((t) => t.trim())
          .filter(Boolean)
      : [];

    const nowIso = new Date().toISOString();
    const personType: CustomerPersonType = companyName ? 'organization' : 'individual';
    const lifecycle: CustomerLifecycle = 'active';

    validCustomers.push({
      id: `c_imp_${Date.now()}_${i}`,
      tenantId: 'tenant_default_1',
      name,
      phone,
      email: email || undefined,
      nationalId: rawNid || undefined,
      personType,
      companyName: companyName || undefined,
      lifecycle,
      tags,
      source: source || 'ورود فایل',
      ownerName: ownerName || undefined,
      branchId: defaultBranchId,
      consentSms: true,
      consentEmail: Boolean(email),
      createdAt: nowIso,
      updatedAt: nowIso,
      createdBy: 'ورود دسته‌ای',
      isDeleted: false,
      version: 1,
    });
  });

  return { validCustomers, errors };
}

export function exportCustomersToCsv(customers: Customer[]): string {
  const esc = (v: string) => {
    if (v.includes(',') || v.includes('"') || v.includes('\n')) {
      return `"${v.replace(/"/g, '""')}"`;
    }
    return v;
  };
  const header = ['نام', 'نوع', 'شرکت', 'موبایل', 'کد ملی', 'ایمیل', 'چرخه عمر', 'مسئول', 'برچسب‌ها', 'منبع', 'یادداشت'].join(',');
  const lines = customers.map((c) =>
    [
      esc(c.name),
      esc(c.personType === 'organization' ? 'حقوقی' : 'حقیقی'),
      esc(c.companyName ?? ''),
      esc(c.phone),
      esc(c.nationalId ?? ''),
      esc(c.email ?? ''),
      esc(c.lifecycle ?? 'active'),
      esc(c.ownerName ?? ''),
      esc(c.tags.join(' | ')),
      esc(c.source ?? ''),
      esc(c.notes ?? ''),
    ].join(','),
  );
  return '\uFEFF' + [header, ...lines].join('\n');
}

export function exportCustomersToXlsx(customers: Customer[], fileName: string): void {
  const rows = customers.map((c) => ({
    'نام': c.name,
    'شخصیت': c.personType === 'organization' ? 'حقوقی' : 'حقیقی',
    'شرکت': c.companyName ?? '',
    'موبایل': c.phone,
    'کد ملی': c.nationalId ?? '',
    'ایمیل': c.email ?? '',
    'چرخه عمر': c.lifecycle ?? 'active',
    'مسئول پیگیری': c.ownerName ?? '',
    'برچسب‌ها': c.tags.join(' | '),
    'منبع': c.source ?? '',
    'رضایت پیامک': c.consentSms !== false ? 'بله' : 'خیر',
    'رضایت ایمیل': c.consentEmail !== false ? 'بله' : 'خیر',
    'یادداشت': c.notes ?? '',
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'مشتریان');
  XLSX.writeFile(wb, fileName);
}

export function exportRowsToCsv(
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][],
): string {
  const esc = (v: string | number | boolean | null | undefined) => {
    const s = v === null || v === undefined ? '' : String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const headerLine = headers.map(esc).join(',');
  const dataLines = rows.map((row) => row.map(esc).join(','));
  return '\uFEFF' + [headerLine, ...dataLines].join('\n');
}
