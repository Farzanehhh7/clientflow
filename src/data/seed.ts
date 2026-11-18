import type { Customer, Service, Resource, Appointment, Order, Task, Ticket, Rule } from '../types';

// Minimal seed. Ask the AI (see AI_STUDIO_PROMPT.md) to expand to 30 customers, 40 appointments, etc.
// All data is fictional.

const now = new Date();
const iso = (offsetHours: number) => new Date(now.getTime() + offsetHours * 3600_000).toISOString();

export const customers: Customer[] = [
  { id: 'c1', name: 'مریم صالحی', phone: '09121110001', tags: ['VIP'], source: 'اینستاگرام', createdAt: iso(-500) },
  { id: 'c2', name: 'نازنین رضایی', phone: '09131110002', tags: [], source: 'معرفی', createdAt: iso(-300) },
  { id: 'c3', name: 'الهام جعفری', phone: '09171110003', tags: ['پیگیری'], source: 'سایت', createdAt: iso(-100) },
];

export const services: Service[] = [
  { id: 's1', name: 'ویزیت اولیه', durationMin: 30, price: 500000 },
  { id: 's2', name: 'ویزیت کنترل', durationMin: 15, price: 250000 },
];

export const resources: Resource[] = [
  { id: 'r1', name: 'دکتر کشاورز', type: 'staff' },
  { id: 'r2', name: 'اتاق ۱', type: 'room' },
];

export const appointments: Appointment[] = [
  { id: 'a1', customerId: 'c1', serviceId: 's1', resourceId: 'r1', start: iso(2), end: iso(2.5), status: 'booked' },
  { id: 'a2', customerId: 'c2', serviceId: 's2', resourceId: 'r1', start: iso(26), end: iso(26.25), status: 'confirmed' },
];

export const orders: Order[] = [
  {
    id: 'o1',
    customerId: 'c3',
    items: [{ name: 'کرم مرطوب‌کننده', qty: 2, price: 320000 }],
    status: 'confirmed',
    createdAt: iso(-60),
    promisedAt: iso(-12),
  },
];

export const tasks: Task[] = [
  { id: 't1', title: 'تماس پیگیری سفارش', customerId: 'c3', dueAt: iso(-2), done: false },
  { id: 't2', title: 'یادآوری نوبت فردا', customerId: 'c2', dueAt: iso(3), done: false },
];

export const tickets: Ticket[] = [
  { id: 'k1', customerId: 'c1', subject: 'تغییر ساعت نوبت', priority: 'normal', status: 'open', createdAt: iso(-10) },
];

export const rules: Rule[] = [
  {
    id: 'u1',
    name: 'یادآوری نوبت ۲۴ ساعت قبل',
    trigger: 'زمان‌بندی (هر ساعت)',
    condition: 'نوبت تأییدشده ۲۴ ساعت دیگر',
    action: 'ارسال پیامک شبیه‌سازی‌شده',
    active: true,
  },
  {
    id: 'u2',
    name: 'سفارش بدون به‌روزرسانی ۴۸ ساعته',
    trigger: 'زمان‌بندی (روزانه)',
    condition: 'وضعیت سفارش > ۴۸ ساعت تغییر نکرده',
    action: 'ایجاد وظیفه پیگیری',
    active: true,
  },
];
