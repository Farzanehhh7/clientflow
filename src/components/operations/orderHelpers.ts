import type {
  Order,
  OrderChannel,
  OrderStatus,
  PaymentMethod,
  ProjectStatus,
  ShippingCarrier,
} from '../../types';

export const ORDER_CHANNEL_LABEL: Record<OrderChannel, string> = {
  phone: 'تلفنی',
  website: 'وب‌سایت',
  instagram: 'اینستاگرام',
  whatsapp: 'واتساپ',
  store: 'فروشگاه حضوری',
};

export const ORDER_STATUS_COLOR: Record<OrderStatus, string> = {
  new: 'text-indigo-600 dark:text-indigo-400',
  confirmed: 'text-sky-600 dark:text-sky-400',
  shipped: 'text-amber-600 dark:text-amber-400',
  delivered: 'text-emerald-600 dark:text-emerald-400',
  cancelled: 'text-slate-400 dark:text-slate-500',
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  online: 'درگاه آنلاین',
  card: 'کارت‌خوان',
  transfer: 'کارت‌به‌کارت / شبا',
  cash: 'نقدی',
  cheque: 'چک صیادی',
};

export const CARRIER_LABEL: Record<ShippingCarrier, string> = {
  post: 'پست پیشتاز',
  tipax: 'تیپاکس',
  snappbox: 'اسنپ‌باکس / پیک شهری',
  chapar: 'چاپار',
  pickup: 'تحویل حضوری',
};

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  planning: 'برنامه‌ریزی',
  in_progress: 'در حال اجرا',
  testing: 'تست و UAT',
  deployed: 'مستقرشده',
  completed: 'تکمیل‌شده',
};

export const CHECK_CAT_LABEL = {
  infra: 'زیرساخت و سرور',
  db: 'دیتابیس و بک‌آپ',
  security: 'امنیت و دسترسی',
  training: 'آموزش کاربر',
} as const;

export function orderTotal(o: Order): number {
  return o.items.reduce((sum, it) => sum + it.qty * it.price, 0) - (o.discountAmount ?? 0);
}

export function isOrderOverdue(o: Order, nowMs = Date.now()): boolean {
  return Boolean(
    o.promisedAt &&
      new Date(o.promisedAt).getTime() < nowMs &&
      o.status !== 'delivered' &&
      o.status !== 'cancelled',
  );
}
