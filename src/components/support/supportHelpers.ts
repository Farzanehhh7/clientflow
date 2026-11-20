import type {
  ComplaintStatus,
  Ticket,
  TicketChannel,
  TicketSeverity,
  TicketStatus,
} from '../../types';

export const TICKET_PRIORITY_LABEL: Record<Ticket['priority'], string> = {
  low: 'کم',
  normal: 'عادی',
  high: 'فوری',
};

export const TICKET_PRIORITY_COLOR: Record<Ticket['priority'], string> = {
  low: 'text-slate-500 dark:text-slate-400',
  normal: 'text-sky-600 dark:text-sky-400',
  high: 'text-rose-600 dark:text-rose-400',
};

export const TICKET_SEVERITY_LABEL: Record<TicketSeverity, string> = {
  minor: 'جزئی',
  major: 'مهم',
  critical: 'بحرانی',
};

export const TICKET_SEVERITY_COLOR: Record<TicketSeverity, string> = {
  minor: 'text-slate-500 dark:text-slate-400',
  major: 'text-amber-600 dark:text-amber-400',
  critical: 'text-rose-600 dark:text-rose-400',
};

export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  open: 'باز',
  in_progress: 'در دست بررسی',
  pending: 'در انتظار مشتری',
  resolved: 'حل‌شده',
  closed: 'بسته',
};

export const TICKET_CHANNEL_LABEL: Record<TicketChannel, string> = {
  portal: 'پورتال وب',
  phone: 'تلفن',
  whatsapp: 'واتساپ',
  email: 'ایمیل',
  instagram: 'اینستاگرام',
  visit: 'حضوری',
};

export const COMPLAINT_STATUS_LABEL: Record<ComplaintStatus, string> = {
  investigating: 'در حال بررسی',
  resolved: 'حل و فصل شده',
  compensated: 'جبران خسارت شده',
};

export const TICKET_CATEGORIES = [
  'نوبت‌دهی',
  'سفارش و ارسال',
  'مراقبت و مشاوره',
  'فنی و نرم‌افزار',
  'مالی و فاکتور',
  'شکایت و کیفیت',
];

export const SUPPORT_TEAMS = ['پذیرش', 'لجستیک و فروشگاه', 'فنی و پشتیبانی', 'مالی', 'فروش'];

export const ROOT_CAUSES = [
  'درخواست تغییر برنامه مراجع',
  'تأخیر شرکت حمل / پست',
  'سوال آموزشی محصول',
  'آسیب بسته‌بندی در ارسال',
  'لغو پیامک تبلیغاتی خط مشتری',
  'نیاز به مدارک حسابداری شرکتی',
  'واکنش پوستی موقت',
  'خطای کاربری / پیکربندی',
];

export const CANNED_RESPONSES = [
  'سلام و احترام؛ درخواست شما بررسی و زمان نوبت مطابق درخواست به‌روزرسانی شد.',
  'بسته شما تحویل شرکت پست شده و کد رهگیری به‌زودی پیامک می‌شود.',
  'پوزش بابت تأخیر پیش‌آمده؛ کد تخفیف جبرانی برای خرید بعدی شما فعال گردید.',
  'لطفاً تا ۲۴ ساعت پس از پروسیجر از کرم ترمیم‌کننده و ضدآفتاب استفاده نمایید.',
];
