import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Compass, Sparkles, X } from 'lucide-react';
import type { NavPageKey } from '../pages/DashboardPage';
import { useClientFlow } from '../store/useClientFlowStore';
import { toFa } from '../utils/jalali';

interface OnboardingTourProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (page: NavPageKey) => void;
}

type TourStep = {
  page: NavPageKey;
  titleFa: string;
  titleEn: string;
  descFa: string;
  descEn: string;
  tipFa: string;
  tipEn: string;
};

const TOUR_STEPS: TourStep[] = [
  {
    page: 'dashboard',
    titleFa: '۱. داشبورد قابل چیدمان و چندشعبه‌ای',
    titleEn: '1. Customizable & Multi-Branch Dashboard',
    descFa: 'روی دکمه «شخصی‌سازی ویجت‌ها» بزنید تا کارت‌ها و نمودارها را با Drag & Drop مرتب کنید، مخفی کنید یا پهنای آن‌ها را تغییر دهید.',
    descEn: 'Click Customize Widgets to reorder cards with Drag & Drop, hide widgets, or toggle half/full width.',
    tipFa: 'فیلتر شعبه در هدر بالای صفحه داده‌های این داشبورد را محدود به شعبه انتخابی می‌کند.',
    tipEn: 'Use the header branch selector to scope metrics to a specific branch.',
  },
  {
    page: 'customers',
    titleFa: '۲. مدیریت مشتریان، اشخاص حقوقی و سگمنت پویا',
    titleEn: '2. Customers, Organizations & Dynamic Segments',
    descFa: 'پرونده مشتریان حقیقی و حقوقی، درخت ارتباطات، تولد/سالگرد، امتیازدهی خودکار، جستجوی فازی فارسی و بازگشت ایمپورت CSV در این بخش قرار دارد.',
    descEn: 'Manage individual & corporate contacts, relationship graphs, birthdays, lead scoring, fuzzy search and CSV rollback.',
    tipFa: 'کلید میانبر Ctrl+K جستجوی سریع را در کل سیستم باز می‌کند.',
    tipEn: 'Press Ctrl+K anywhere for instant Quick Search.',
  },
  {
    page: 'appointments',
    titleFa: '۳. تقویم شمسی نوبت‌دهی و زمان بافر',
    titleEn: '3. Jalali Appointment Calendar & Buffers',
    descFa: 'تقویم هفتگی شمسی با Drag & Drop، جلوگیری از تداخل پزشکان/اتاق‌ها، مرخصی منابع، تعطیلات رسمی و صف انتظار هوشمند.',
    descEn: 'Weekly Jalali calendar with Drag & Drop rescheduling, buffer conflict checks, time-off, holidays & waitlist.',
    tipFa: 'ارسال یادآور ۲ ساعته در اتوماسیون قابل فعال‌سازی است.',
    tipEn: 'Automated 2-hour reminders can be triggered from Automation.',
  },
  {
    page: 'orders',
    titleFa: '۴. سفارش‌ها، درگاه پرداخت و چک صیادی',
    titleEn: '4. Orders, Sandbox Gateway & Sayadi Cheques',
    descFa: 'صدور فاکتور با شماره شمسی خودکار، پرداخت آنلاین از درگاه آزمایشی شاپرک/زرین‌پال و مدیریت کامل چک‌های صیادی و انبار.',
    descEn: 'Issue Jalali-numbered invoices, test online payments via Sandbox gateway, track Sayadi cheques and stock ledger.',
    tipFa: 'با وصول چک متصل به فاکتور، مبلغ به‌طور خودکار در حساب فاکتور می‌نشیند.',
    tipEn: 'Clearing a linked Sayadi cheque automatically updates the invoice paid balance.',
  },
  {
    page: 'reports',
    titleFa: '۵. گزارش‌ها، Cohort، LTV و ارسال زمان‌بندی‌شده',
    titleEn: '5. BI Reports, Cohort, LTV & Scheduled Delivery',
    descFa: 'ماتریس حفظ مشتری (Cohort Retention)، ارزش طول عمر (LTV)، نرخ ریزش، خروجی PDF مستقیم و زمان‌بندی ارسال ایمیلی گزارش‌ها.',
    descEn: 'Analyze Cohort Retention, LTV, Churn, export clean printable PDFs, and schedule recurring report emails.',
    tipFa: 'خروجی PDF بدون منو و نوار ابزار چاپ می‌شود.',
    tipEn: 'Direct PDF print automatically hides sidebar and header chrome.',
  },
  {
    page: 'settings',
    titleFa: '۶. ۱۰ بسته صنعتی، Pack Builder، دوزبانه‌سازی و PWA',
    titleEn: '6. 10 Industry Packs, Pack Builder, i18n & PWA',
    descFa: 'بین ۱۰ بسته صنعتی جابه‌جا شوید، پک سفارشی بسازید، نمای Solo/Enterprise، زبان فارسی/انگلیسی، شماره‌گذاری شمسی و حالت آفلاین PWA را مدیریت کنید.',
    descEn: 'Switch between 10 industry packs, export custom packs, toggle Solo/Enterprise, fa/en language, numbering & PWA offline mode.',
    tipFa: 'هر زمان از دکمه «تور راهنما» در هدر می‌توانید این آموزش را دوباره ببینید.',
    tipEn: 'You can replay this tour anytime from the header Guide button.',
  },
];

export function OnboardingTour({ open, onClose, onNavigate }: OnboardingTourProps) {
  const { state, updateSettings } = useClientFlow();
  const [stepIndex, setStepIndex] = useState(0);
  const lang = state.settings.language ?? 'fa';
  const isEn = lang === 'en';

  useEffect(() => {
    if (open) {
      setStepIndex(0);
      onNavigate(TOUR_STEPS[0].page);
    }
  }, [open]);

  if (!open) return null;

  const step = TOUR_STEPS[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === TOUR_STEPS.length - 1;

  const goTo = (nextIdx: number) => {
    setStepIndex(nextIdx);
    onNavigate(TOUR_STEPS[nextIdx].page);
  };

  const finishTour = () => {
    updateSettings({ onboardingCompleted: true });
    onClose();
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-xl print-hidden sm:left-6 sm:right-auto">
      <div className="rounded-2xl border border-indigo-200 bg-white p-5 shadow-2xl dark:border-indigo-900 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
            <Compass size={18} />
            <span className="text-xs font-bold">
              {isEn
                ? `Interactive Onboarding Tour (${stepIndex + 1}/${TOUR_STEPS.length})`
                : `تور راهنمای تعاملی ClientFlow (${toFa(stepIndex + 1)} از ${toFa(TOUR_STEPS.length)})`}
            </span>
          </div>
          <button
            type="button"
            onClick={finishTour}
            aria-label={isEn ? 'Close tour' : 'بستن تور'}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
          >
            <X size={16} />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="mt-3 flex gap-1.5">
          {TOUR_STEPS.map((s, idx) => (
            <button
              key={s.page}
              type="button"
              onClick={() => goTo(idx)}
              aria-label={isEn ? s.titleEn : s.titleFa}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                idx <= stepIndex ? 'bg-indigo-600 dark:bg-indigo-400' : 'bg-slate-200 dark:bg-slate-800'
              }`}
            />
          ))}
        </div>

        <div className="mt-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            {isEn ? step.titleEn : step.titleFa}
          </h3>
          <p className="mt-1.5 text-xs leading-6 text-slate-600 dark:text-slate-300">
            {isEn ? step.descEn : step.descFa}
          </p>
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-indigo-50/70 px-3 py-2 text-[11px] text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200">
            <Sparkles size={14} className="mt-0.5 shrink-0" />
            <span>{isEn ? step.tipEn : step.tipFa}</span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
          <button
            type="button"
            onClick={finishTour}
            className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
          >
            {isEn ? 'Skip Tour' : 'رد کردن راهنما'}
          </button>

          <div className="flex items-center gap-2">
            {!isFirst && (
              <button
                type="button"
                onClick={() => goTo(stepIndex - 1)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {isEn ? <ArrowLeft size={14} /> : <ArrowRight size={14} />}
                {isEn ? 'Previous' : 'قبلی'}
              </button>
            )}
            {!isLast ? (
              <button
                type="button"
                onClick={() => goTo(stepIndex + 1)}
                className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
              >
                {isEn ? 'Next Step' : 'گام بعدی'}
                {isEn ? <ArrowRight size={14} /> : <ArrowLeft size={14} />}
              </button>
            ) : (
              <button
                type="button"
                onClick={finishTour}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
              >
                <CheckCircle2 size={14} />
                {isEn ? 'Finish Tour' : 'پایان تور و شروع کار'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
