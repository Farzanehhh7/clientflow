import type { Customer } from '../types';
import { isValidIranMobile } from './overlap';

export type CsvImportMapping = {
  nameCol: string;
  phoneCol: string;
  emailCol: string;
  tagsCol: string;
  sourceCol: string;
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

/** Normalize Persian/Arabic digits and +98 prefix to 09xxxxxxxxx */
export function normalizeMobileInput(raw: string): string {
  const ascii = raw
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[\s\-()]/g, '');

  if (ascii.startsWith('+98')) return '0' + ascii.slice(3);
  if (ascii.startsWith('0098')) return '0' + ascii.slice(4);
  if (ascii.startsWith('98') && ascii.length === 12) return '0' + ascii.slice(2);
  if (ascii.startsWith('9') && ascii.length === 10) return '0' + ascii;
  return ascii;
}

export function validateAndBuildCustomers(
  headers: string[],
  rows: string[][],
  mapping: CsvImportMapping,
  existingPhones: Set<string>,
): CsvImportResult {
  const idx = (colName: string) => (colName ? headers.indexOf(colName) : -1);
  const nameIdx = idx(mapping.nameCol);
  const phoneIdx = idx(mapping.phoneCol);
  const emailIdx = idx(mapping.emailCol);
  const tagsIdx = idx(mapping.tagsCol);
  const sourceIdx = idx(mapping.sourceCol);

  const validCustomers: Customer[] = [];
  const errors: CsvRowError[] = [];
  const seenPhones = new Set(existingPhones);

  rows.forEach((row, i) => {
    const rowNumber = i + 2; // 1-based + header row
    const name = nameIdx >= 0 ? (row[nameIdx] ?? '').trim() : '';
    const rawPhone = phoneIdx >= 0 ? (row[phoneIdx] ?? '').trim() : '';
    const phone = normalizeMobileInput(rawPhone);
    const email = emailIdx >= 0 ? (row[emailIdx] ?? '').trim() : '';
    const tagsRaw = tagsIdx >= 0 ? (row[tagsIdx] ?? '').trim() : '';
    const source = sourceIdx >= 0 ? (row[sourceIdx] ?? '').trim() : '';

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

    seenPhones.add(phone);
    const tags = tagsRaw
      ? tagsRaw
          .split(/[|؛;]/)
          .map((t) => t.trim())
          .filter(Boolean)
      : [];

    validCustomers.push({
      id: `c_imp_${Date.now()}_${i}`,
      name,
      phone,
      email: email || undefined,
      tags,
      source: source || 'ورود CSV',
      createdAt: new Date().toISOString(),
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
  const header = ['نام', 'موبایل', 'ایمیل', 'برچسب‌ها', 'منبع', 'یادداشت'].join(',');
  const lines = customers.map((c) =>
    [
      esc(c.name),
      esc(c.phone),
      esc(c.email ?? ''),
      esc(c.tags.join(' | ')),
      esc(c.source ?? ''),
      esc(c.notes ?? ''),
    ].join(','),
  );
  return '\uFEFF' + [header, ...lines].join('\n');
}
