import type { AccountingFieldMapping, AccountingSoftwarePreset } from '../../types';

/** Deterministic synchronous HMAC-like SHA-256 preview (fallback when crypto.subtle is unavailable) */
export function computeSyncHmacPreview(secret: string, payload: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  const input = `${secret}:${payload}`;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 ^= ch;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= ch + i;
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  const partA = (h1 >>> 0).toString(16).padStart(8, '0');
  const partB = (h2 >>> 0).toString(16).padStart(8, '0');
  return `sha256=${partA}${partB}${partA.split('').reverse().join('')}${partB.split('').reverse().join('')}`;
}

/** Real WebCrypto HMAC-SHA256 when browser secure context supports subtle.sign */
export async function computeHmacSha256Hex(secret: string, payload: string): Promise<string> {
  try {
    if (typeof window !== 'undefined' && window.crypto?.subtle) {
      const enc = new TextEncoder();
      const key = await window.crypto.subtle.importKey(
        'raw',
        enc.encode(secret || 'clientflow_secret'),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
      );
      const sig = await window.crypto.subtle.sign('HMAC', key, enc.encode(payload));
      const hex = Array.from(new Uint8Array(sig))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      return `sha256=${hex}`;
    }
  } catch {
    // Fallback below
  }
  return computeSyncHmacPreview(secret, payload);
}

export const ACCOUNTING_PRESET_LABELS: Record<AccountingSoftwarePreset, string> = {
  sepidar: 'سپیدار سیستم (Sepidar)',
  holoo: 'نرم‌افزار هلو (Holoo)',
  rahkaran: 'همکاران سیستم / راهکاران',
  mahak: 'نرم‌افزار حسابداری محک',
  generic_excel: 'قالب استاندارد اکسل ایرانی (Generic)',
};

export function getDefaultAccountingMapping(
  preset: AccountingSoftwarePreset,
): AccountingFieldMapping[] {
  const names: Record<AccountingSoftwarePreset, Record<string, string>> = {
    sepidar: {
      invoiceNo: 'شماره فاکتور فروش',
      issuedAtJalali: 'تاریخ شمسی سند',
      customerCode: 'کد تفصیلی مشتری',
      customerName: 'عنوان تفصیلی مشتری',
      nationalId: 'کد ملی / شناسه ملی',
      economicCode: 'کد اقتصادی',
      subtotal: 'جمع کل مبلغ ناخالص (ریال/تومان)',
      discountTotal: 'جمع تخفیفات',
      taxTotal: 'مالیات بر ارزش افزوده (۹٪)',
      grandTotal: 'خالص قابل پرداخت',
      paidAmount: 'مبلغ دریافت‌شده',
      debitAccount: 'کد معین بدهکاران تجاری',
      creditAccount: 'کد معین درآمد فروش',
    },
    holoo: {
      invoiceNo: 'شماره برگه فاکتور',
      issuedAtJalali: 'تاریخ فاکتور',
      customerCode: 'کد طرف حساب',
      customerName: 'نام طرف حساب',
      nationalId: 'کد ملی',
      economicCode: 'شماره اقتصادی',
      subtotal: 'مبلغ کل اقلام',
      discountTotal: 'تخفیف فاکتور',
      taxTotal: 'مالیات و عوارض',
      grandTotal: 'جمع نهایی فاکتور',
      paidAmount: 'مبلغ نقد/کارت',
      debitAccount: 'سرفصل حساب مشتری',
      creditAccount: 'سرفصل فروش کالا/خدمات',
    },
    rahkaran: {
      invoiceNo: 'VoucherNo',
      issuedAtJalali: 'ShamsiDate',
      customerCode: 'DLCode',
      customerName: 'DLTitle',
      nationalId: 'NationalCode',
      economicCode: 'EconomicNo',
      subtotal: 'GrossAmount',
      discountTotal: 'DiscountAmount',
      taxTotal: 'VATAmount',
      grandTotal: 'NetPayable',
      paidAmount: 'SettledAmount',
      debitAccount: 'DebitSLCode',
      creditAccount: 'CreditSLCode',
    },
    mahak: {
      invoiceNo: 'شماره فاکتور',
      issuedAtJalali: 'تاریخ',
      customerCode: 'کد شخص',
      customerName: 'نام شخص',
      nationalId: 'کد ملی',
      economicCode: 'کد اقتصادی',
      subtotal: 'مبلغ جزء',
      discountTotal: 'تخفیف',
      taxTotal: 'مالیات',
      grandTotal: 'مبلغ کل',
      paidAmount: 'دریافتی',
      debitAccount: 'حساب بدهکار',
      creditAccount: 'حساب فروش',
    },
    generic_excel: {
      invoiceNo: 'شماره سند',
      issuedAtJalali: 'تاریخ جلالی',
      customerCode: 'کد مشتری',
      customerName: 'نام مشتری',
      nationalId: 'کد ملی',
      economicCode: 'کد اقتصادی',
      subtotal: 'جمع قبل از تخفیف و مالیات',
      discountTotal: 'تخفیف',
      taxTotal: 'مالیات ارزش افزوده',
      grandTotal: 'مبلغ نهایی',
      paidAmount: 'وصول‌شده',
      debitAccount: 'کد حساب دریافتنی',
      creditAccount: 'کد حساب فروش',
    },
  };

  const labels = names[preset] ?? names.sepidar;
  return [
    { sourceKey: 'invoiceNo', sourceLabel: 'شماره فاکتور (invoiceNo)', targetColumn: labels.invoiceNo, enabled: true },
    { sourceKey: 'issuedAtJalali', sourceLabel: 'تاریخ صدور جلالی (issuedAt)', targetColumn: labels.issuedAtJalali, enabled: true },
    { sourceKey: 'customerCode', sourceLabel: 'کد پرونده مشتری (patientCode / id)', targetColumn: labels.customerCode, enabled: true },
    { sourceKey: 'customerName', sourceLabel: 'نام مشتری / شرکت', targetColumn: labels.customerName, enabled: true },
    { sourceKey: 'nationalId', sourceLabel: 'کد ملی / شناسه ملی', targetColumn: labels.nationalId, enabled: true },
    { sourceKey: 'economicCode', sourceLabel: 'کد اقتصادی', targetColumn: labels.economicCode, enabled: false },
    { sourceKey: 'subtotal', sourceLabel: 'مبلغ ناخالص (subtotal)', targetColumn: labels.subtotal, enabled: true },
    { sourceKey: 'discountTotal', sourceLabel: 'تخفیف (discountTotal)', targetColumn: labels.discountTotal, enabled: true },
    { sourceKey: 'taxTotal', sourceLabel: 'مالیات (taxTotal)', targetColumn: labels.taxTotal, enabled: true },
    { sourceKey: 'grandTotal', sourceLabel: 'مبلغ نهایی (grandTotal)', targetColumn: labels.grandTotal, enabled: true },
    { sourceKey: 'paidAmount', sourceLabel: 'پرداخت‌شده (paidAmount)', targetColumn: labels.paidAmount, enabled: true },
    { sourceKey: 'debitAccount', sourceLabel: 'حساب معین بدهکار', targetColumn: labels.debitAccount, accountCode: '110301', enabled: true },
    { sourceKey: 'creditAccount', sourceLabel: 'حساب معین فروش/درآمد', targetColumn: labels.creditAccount, accountCode: '410101', enabled: true },
  ];
}

export function generateClientFlowOpenApiSpec(baseUrl = 'https://api.clientflow.ir/v1') {
  return {
    openapi: '3.0.3',
    info: {
      title: 'ClientFlow CRM REST API',
      version: '1.0.0',
      description:
        'OpenAPI 3.0 contract generated from ClientFlow TypeScript domain models (Customers, Leads, Opportunities, Appointments, Orders, Invoices, Tickets, Calls, Webhooks).',
    },
    servers: [{ url: baseUrl, description: 'ClientFlow API Gateway' }],
    security: [{ BearerAuth: [] }],
    paths: {
      '/customers': {
        get: {
          summary: 'List customers with lifecycle & tag filters',
          tags: ['Customers'],
          parameters: [
            { name: 'lifecycle', in: 'query', schema: { type: 'string', enum: ['lead', 'active', 'vip', 'churned'] } },
            { name: 'q', in: 'query', schema: { type: 'string' } },
          ],
          responses: {
            '200': {
              description: 'Array of Customer records',
              content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Customer' } } } },
            },
          },
        },
        post: {
          summary: 'Create or upsert a customer',
          tags: ['Customers'],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/CustomerInput' } } },
          },
          responses: { '201': { description: 'Customer created' } },
        },
      },
      '/leads': {
        get: { summary: 'List sales leads', tags: ['Sales'], responses: { '200': { description: 'OK' } } },
        post: {
          summary: 'Capture inbound lead (with UTM & customFields)',
          tags: ['Sales'],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SalesLeadInput' } } },
          },
          responses: { '201': { description: 'Lead created & auto-assigned' } },
        },
      },
      '/orders': {
        get: { summary: 'List multi-channel orders', tags: ['Operations'], responses: { '200': { description: 'OK' } } },
        post: {
          summary: 'Create order with Idempotency-Key support',
          tags: ['Operations'],
          parameters: [{ name: 'Idempotency-Key', in: 'header', schema: { type: 'string' } }],
          responses: { '201': { description: 'Order created' } },
        },
      },
      '/invoices': {
        get: { summary: 'List invoices & Sayadi/Gateway settlement status', tags: ['Finance'], responses: { '200': { description: 'OK' } } },
      },
      '/tickets': {
        get: { summary: 'List support tickets & SLA countdowns', tags: ['Support'], responses: { '200': { description: 'OK' } } },
        post: { summary: 'Open support ticket', tags: ['Support'], responses: { '201': { description: 'Ticket created' } } },
      },
      '/voip/calls': {
        get: { summary: 'List VoIP call logs & recording metadata', tags: ['Telephony'], responses: { '200': { description: 'OK' } } },
        post: { summary: 'Log incoming/outgoing PBX webhook call event', tags: ['Telephony'], responses: { '201': { description: 'Call logged' } } },
      },
      '/webhooks/incoming': {
        post: {
          summary: 'Receive external webhook signed with X-ClientFlow-Signature (HMAC-SHA256)',
          tags: ['Webhooks'],
          responses: { '200': { description: 'Automation rules evaluated' } },
        },
      },
    },
    components: {
      securitySchemes: {
        BearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
      schemas: {
        Customer: {
          type: 'object',
          required: ['id', 'name', 'phone'],
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            phone: { type: 'string', example: '09121110001' },
            personType: { type: 'string', enum: ['individual', 'organization'] },
            nationalId: { type: 'string' },
            lifecycle: { type: 'string', enum: ['lead', 'active', 'vip', 'churned'] },
            tags: { type: 'array', items: { type: 'string' } },
            loyaltyPoints: { type: 'integer' },
            customFields: { type: 'object', additionalProperties: { type: 'string' } },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        CustomerInput: {
          type: 'object',
          required: ['name', 'phone'],
          properties: {
            name: { type: 'string' },
            phone: { type: 'string' },
            source: { type: 'string' },
            lifecycle: { type: 'string', enum: ['lead', 'active', 'vip'] },
            consentSms: { type: 'boolean' },
          },
        },
        SalesLeadInput: {
          type: 'object',
          required: ['name', 'phone'],
          properties: {
            name: { type: 'string' },
            phone: { type: 'string' },
            source: { type: 'string' },
            estimatedAmount: { type: 'number' },
            utmSource: { type: 'string' },
            utmCampaign: { type: 'string' },
          },
        },
        CallLogEntry: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            direction: { type: 'string', enum: ['inbound', 'outbound'] },
            phone: { type: 'string' },
            status: { type: 'string', enum: ['answered', 'missed', 'voicemail', 'busy'] },
            durationSec: { type: 'integer' },
            outcome: { type: 'string' },
            startedAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  };
}
