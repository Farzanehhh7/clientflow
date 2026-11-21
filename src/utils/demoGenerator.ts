import type {
  Appointment,
  Customer,
  IndustryPack,
  Interaction,
  Invoice,
  Order,
  SalesLead,
  Ticket,
} from '../types';

const FIRST_NAMES = [
  'سارا', 'امیر', 'مهسا', 'رضا', 'نازنین', 'علی', 'مریم', 'حسین',
  'فاطمه', 'پویا', 'نگار', 'کیوان', 'هانیه', 'آرش', 'الهام', 'فرهاد',
  'نیلوفر', 'سهراب', 'پریسا', 'بهنام', 'شادی', 'دانیال', 'رها', 'سینا',
];

const LAST_NAMES = [
  'احمدی', 'رضایی', 'محمدی', 'حسینی', 'کریمی', 'موسوی', 'نوری', 'صادقی',
  'جعفری', 'قاسمی', 'طاهری', 'اسدی', 'رستگار', 'کاظمی', 'بهرامی', 'شریفی',
  'فرهادی', 'زارع', 'میرزایی', 'پناهی', 'هاشمی', 'اکبری', 'سلیمانی', 'ملکی',
];

const SOURCES = ['اینستاگرام', 'گوگل', 'معرفی مشتری', 'وب‌سایت', 'تماس تلفنی', 'نمایشگاه'];
const TAG_POOL = ['VIP', 'پیگیری فوری', 'مشتری وفادار', 'خرید سازمانی', 'باشگاه مشتریان'];
const LIFECYCLES: Customer['lifecycle'][] = ['lead', 'active', 'vip', 'churned'];

function getDemoPackCustomFields(pack: IndustryPack, i: number): Record<string, string> {
  const map: Partial<Record<IndustryPack, Record<string, string>>> = {
    clinic: { skin_type: i % 2 === 0 ? 'مختلط' : 'خشک' },
    shop: { shipping_pref: i % 2 === 0 ? 'تیپاکس' : 'پست پیشتاز' },
    restaurant: { diet_pref: i % 2 === 0 ? 'معمولی' : 'گیاهخوار', favorite_table: i % 2 === 0 ? 'تراس' : 'سالن VIP' },
    car_service: { car_model: i % 2 === 0 ? 'پژو ۲۰۷ اتومات' : 'دنا پلاس', plate_no: `12ب${100 + (i % 899)}-ایران11` },
    law_accounting: { case_category: i % 2 === 0 ? 'مالیاتی و حسابرسی' : 'حقوقی و ملکی' },
    travel_agency: { preferred_dest: i % 2 === 0 ? 'ترکیه و دبی' : 'تورهای داخلی و کیش' },
    pharmacy: { chronic_need: i % 2 === 0 ? 'مراقبت پوست و مو' : 'مکمل ورزشی' },
    wholesale: { retail_zone: i % 2 === 0 ? 'شمال تهران' : 'غرب و کرج', store_grade: 'گرید B (سوپرمارکت)' },
    realestate: { preferred_zone: i % 2 === 0 ? 'سعادت‌آباد' : 'پونک', property_area: String(90 + (i % 4) * 25) },
    gym: { membership_plan: i % 2 === 0 ? 'سه ماهه + کمد VIP' : 'پکیج مربی اختصاصی', fitness_goal: 'آمادگی جسمانی' },
    school: { grade_level: i % 2 === 0 ? 'پیش‌دبستانی' : 'دبستان دوره اول' },
    hotel: { room_preference: i % 2 === 0 ? 'دوتخته دبل' : 'سوئیت VIP' },
  };
  return map[pack] ?? {};
}

export type GeneratedScaleDataset = {
  customers: Customer[];
  orders: Order[];
  invoices: Invoice[];
  appointments: Appointment[];
  leads: SalesLead[];
  tickets: Ticket[];
  interactions: Interaction[];
};

export function generateScaleDataset(
  customerCount: 10 | 100 | 1000 | 10000,
  pack: IndustryPack,
  branchIds: string[],
  owners: string[],
  serviceIds: string[],
  resourceIds: string[],
  productNames: { id: string; name: string; price: number }[],
): GeneratedScaleDataset {
  const nowMs = Date.now();
  const safeBranches = branchIds.length > 0 ? branchIds : ['br1'];
  const safeOwners = owners.length > 0 ? owners : ['مریم (فروش)', 'سارا (پذیرش)'];

  const customers: Customer[] = new Array(customerCount);
  const prefixBase = nowMs.toString(36);

  for (let i = 0; i < customerCount; i++) {
    const fn = FIRST_NAMES[i % FIRST_NAMES.length];
    const ln = LAST_NAMES[(i * 7 + Math.floor(i / FIRST_NAMES.length)) % LAST_NAMES.length];
    const phoneSuffix = String(1000000 + ((i * 7919) % 8999999)).padStart(7, '0');
    const createdMs = nowMs - ((i % 180) * 86400_000 + (i % 12) * 3600_000);
    const createdAt = new Date(createdMs).toISOString();
    const isOrg = i % 9 === 0;

    customers[i] = {
      id: `c_gen_${prefixBase}_${i}`,
      name: isOrg ? `شرکت ${ln} (${fn})` : `${fn} ${ln}`,
      personType: isOrg ? 'organization' : 'individual',
      companyName: isOrg ? `گروه ${ln}` : undefined,
      phone: `0912${phoneSuffix}`,
      email: i % 3 === 0 ? `user${i}@example.ir` : undefined,
      nationalId: i % 4 === 0 ? `001${String(1000000 + (i % 8999999)).slice(0, 7)}` : undefined,
      lifecycle: LIFECYCLES[i % LIFECYCLES.length],
      source: SOURCES[i % SOURCES.length],
      ownerName: safeOwners[i % safeOwners.length],
      branchId: safeBranches[i % safeBranches.length],
      tags: i % 2 === 0 ? [TAG_POOL[i % TAG_POOL.length]] : [],
      consentSms: i % 15 !== 0,
      consentEmail: i % 20 !== 0,
      loyaltyPoints: (i * 45) % 900,
      lifetimePoints: 200 + ((i * 95) % 2500),
      referralCode: `REF-${1000 + (i % 8999)}`,
      customFields: getDemoPackCustomFields(pack, i),
      createdAt,
      isDeleted: false,
    };
  }

  // Keep relational records bounded so 10,000 customers runs smoothly in browser memory & localStorage
  const relCount = Math.min(customerCount, 120);
  const orders: Order[] = [];
  const invoices: Invoice[] = [];
  const appointments: Appointment[] = [];
  const leads: SalesLead[] = [];
  const tickets: Ticket[] = [];
  const interactions: Interaction[] = [];

  for (let i = 0; i < relCount; i++) {
    const cust = customers[i];
    const prod = productNames[i % Math.max(1, productNames.length)] ?? {
      id: 'p1',
      name: 'محصول / پکیج استاندارد',
      price: 650000,
    };
    const qty = (i % 3) + 1;
    const subtotal = prod.price * qty;
    const tax = Math.round(subtotal * 0.09);
    const grandTotal = subtotal + tax;
    const ordId = `o_gen_${prefixBase}_${i}`;
    const ordAt = new Date(nowMs - (i % 45) * 86400_000).toISOString();

    orders.push({
      id: ordId,
      customerId: cust.id,
      channel: (['website', 'instagram', 'whatsapp', 'phone', 'store'] as const)[i % 5],
      items: [{ productId: prod.id, name: prod.name, qty, price: prod.price, unitPriceSnapshot: prod.price }],
      status: (['new', 'confirmed', 'shipped', 'delivered'] as const)[i % 4],
      createdAt: ordAt,
      branchId: cust.branchId,
      isDeleted: false,
    });

    invoices.push({
      id: `inv_gen_${prefixBase}_${i}`,
      invoiceNo: `INV-1404-${String(5000 + i)}`,
      orderId: ordId,
      customerId: cust.id,
      subtotal,
      discount: 0,
      tax,
      grandTotal,
      paidAmount: i % 3 === 0 ? 0 : grandTotal,
      method: (['online', 'card', 'transfer'] as const)[i % 3],
      status: i % 3 === 0 ? 'issued' : 'paid',
      issuedAt: ordAt,
      dueAt: new Date(nowMs + ((i % 20) - 5) * 86400_000).toISOString(),
      branchId: cust.branchId,
      isDeleted: false,
    });

    if (i < Math.min(40, customerCount)) {
      const startMs = nowMs + ((i % 10) - 3) * 86400_000 + (9 + (i % 7)) * 3600_000;
      appointments.push({
        id: `apt_gen_${prefixBase}_${i}`,
        customerId: cust.id,
        serviceId: serviceIds[i % Math.max(1, serviceIds.length)] ?? 's1',
        resourceId: resourceIds[i % Math.max(1, resourceIds.length)] ?? 'r1',
        start: new Date(startMs).toISOString(),
        end: new Date(startMs + 30 * 60_000).toISOString(),
        status: (['booked', 'confirmed', 'done'] as const)[i % 3],
        branchId: cust.branchId,
        isDeleted: false,
      });

      leads.push({
        id: `ld_gen_${prefixBase}_${i}`,
        name: cust.name,
        phone: cust.phone,
        source: cust.source ?? 'وب‌سایت',
        score: 40 + ((i * 13) % 60),
        estimatedAmount: 2500000 + (i % 8) * 1200000,
        ownerName: cust.ownerName ?? safeOwners[0],
        status: (['new', 'qualified'] as const)[i % 2],
        branchId: cust.branchId,
        createdAt: cust.createdAt,
        updatedAt: cust.createdAt,
        isDeleted: false,
      });

      tickets.push({
        id: `tk_gen_${prefixBase}_${i}`,
        trackingCode: `TK-${9000 + i}`,
        customerId: cust.id,
        subject: `پیگیری سفارش / خدمات #${i + 1}`,
        channel: 'portal',
        priority: (['low', 'normal', 'high'] as const)[i % 3],
        status: (['open', 'in_progress', 'resolved'] as const)[i % 3],
        assignee: cust.ownerName,
        createdAt: cust.createdAt,
        isDeleted: false,
      });

      interactions.push({
        id: `int_gen_${prefixBase}_${i}`,
        customerId: cust.id,
        channel: 'call',
        text: 'تماس پیگیری و معرفی بسته پیشنهادی',
        outcome: 'answered',
        at: cust.createdAt,
      });
    }
  }

  return {
    customers,
    orders,
    invoices,
    appointments,
    leads,
    tickets,
    interactions,
  };
}
