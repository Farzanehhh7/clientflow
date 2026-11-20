import { useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  KeyRound,
  LifeBuoy,
  Moon,
  Paperclip,
  Phone,
  Plus,
  Search,
  Send,
  ShoppingBag,
  Sun,
  ThumbsUp,
} from 'lucide-react';
import {
  TICKET_CATEGORIES,
  TICKET_STATUS_LABEL,
} from '../components/support/supportHelpers';
import { useClientFlow } from '../store/useClientFlowStore';
import type { Ticket, TicketAttachment } from '../types';
import { formatJalaliDateTime, formatToman, toFa } from '../utils/jalali';
import { fuzzyMatchPersian } from '../utils/persianSearch';
import { isTicketClosedStatus } from '../utils/slaEngine';

interface CustomerPortalPageProps {
  onExitPortal: () => void;
}

const APT_STATUS_LABEL: Record<string, string> = {
  booked: 'رزرو‌شده',
  confirmed: 'تأییدشده',
  checked_in: 'حضور در مرکز',
  done: 'انجام‌شده',
  noshow: 'عدم حضور',
  cancelled: 'لغوشده',
};

const ORDER_STATUS_LABEL: Record<string, string> = {
  new: 'ثبت جدید',
  confirmed: 'تأیید و در حال آماده‌سازی',
  shipped: 'ارسال‌شده',
  delivered: 'تحویل‌داده‌شده',
  cancelled: 'لغوشده',
};

export function CustomerPortalPage({ onExitPortal }: CustomerPortalPageProps) {
  const {
    state,
    updateSettings,
    requestPortalOtp,
    submitPortalTicketByPhone,
    addTicketMessage,
    voteKbHelpful,
  } = useClientFlow();

  // Direct ticket tracking by phone + trackingCode
  const [trackPhone, setTrackPhone] = useState(state.customers[0]?.phone ?? '09121110001');
  const [trackCode, setTrackCode] = useState(state.tickets[0]?.trackingCode ?? 'TK-1405-101');
  const [trackedTicketId, setTrackedTicketId] = useState<string | null>(null);
  const [trackError, setTrackError] = useState('');
  const [trackReplyBody, setTrackReplyBody] = useState('');

  // Simulated OTP Auth state
  const [otpPhone, setOtpPhone] = useState('');
  const [sentOtpCode, setSentOtpCode] = useState<string | null>(null);
  const [otpInput, setOtpInput] = useState('');
  const [otpError, setOtpError] = useState('');
  const [verifiedPhone, setVerifiedPhone] = useState<string | null>(null);

  // Authenticated portal tab
  const [portalTab, setPortalTab] = useState<'tickets' | 'appointments' | 'orders'>('tickets');
  const [newName, setNewName] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [newCategory, setNewCategory] = useState(TICKET_CATEGORIES[0]);
  const [newPriority, setNewPriority] = useState<Ticket['priority']>('normal');
  const [newBody, setNewBody] = useState('');
  const [newAttachments, setNewAttachments] = useState<TicketAttachment[]>([]);
  const [createdTicketCode, setCreatedTicketCode] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState('');

  // Customer replies inside "My Tickets"
  const [replyMap, setReplyMap] = useState<Record<string, string>>({});

  // Public Knowledge Base search
  const [kbSearch, setKbSearch] = useState('');

  const verifiedCustomer = useMemo(
    () =>
      verifiedPhone
        ? state.customers.find((c) => c.phone === verifiedPhone && !c.isDeleted) ?? null
        : null,
    [state.customers, verifiedPhone],
  );

  const trackedTicket = useMemo(() => {
    if (!trackedTicketId) return null;
    return state.tickets.find((t) => t.id === trackedTicketId) ?? null;
  }, [state.tickets, trackedTicketId]);

  const trackedCustomer = useMemo(() => {
    if (!trackedTicket) return null;
    return state.customers.find((c) => c.id === trackedTicket.customerId) ?? null;
  }, [state.customers, trackedTicket]);

  const myTickets = useMemo(() => {
    if (!verifiedCustomer) return [];
    return state.tickets.filter(
      (t) => t.customerId === verifiedCustomer.id && !t.mergedIntoTicketId,
    );
  }, [state.tickets, verifiedCustomer]);

  const myAppointments = useMemo(() => {
    if (!verifiedCustomer) return [];
    return state.appointments
      .filter((a) => a.customerId === verifiedCustomer.id)
      .sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime());
  }, [state.appointments, verifiedCustomer]);

  const myOrders = useMemo(() => {
    if (!verifiedCustomer) return [];
    return state.orders
      .filter((o) => o.customerId === verifiedCustomer.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [state.orders, verifiedCustomer]);

  const publicKbArticles = useMemo(() => {
    const onlyPublic = state.kbArticles.filter((a) => a.visibility !== 'internal');
    if (!kbSearch.trim()) return onlyPublic;
    return onlyPublic.filter((a) => fuzzyMatchPersian([a.title, a.body, a.category], kbSearch));
  }, [state.kbArticles, kbSearch]);

  const handleLookupTicket = (e: React.FormEvent) => {
    e.preventDefault();
    setTrackError('');
    const p = trackPhone.trim();
    const code = trackCode.trim().toUpperCase();
    const found = state.tickets.find((t) => {
      const cust = state.customers.find((c) => c.id === t.customerId);
      const phoneMatch = cust?.phone === p;
      const codeMatch =
        (t.trackingCode?.toUpperCase() === code) || t.id.toUpperCase() === code;
      return phoneMatch && codeMatch;
    });
    if (!found) {
      setTrackedTicketId(null);
      setTrackError('تیکتی با این شماره موبایل و کد رهگیری یافت نشد.');
      return;
    }
    setTrackedTicketId(found.id);
  };

  const handleSendOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError('');
    const res = requestPortalOtp(otpPhone);
    if (!res.ok || !res.code) {
      setOtpError(res.error ?? 'خطا در ارسال کد.');
      return;
    }
    setSentOtpCode(res.code);
    setOtpInput('');
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sentOtpCode) return;
    if (otpInput.trim() !== sentOtpCode) {
      setOtpError('کد واردشده صحیح نیست.');
      return;
    }
    setOtpError('');
    setVerifiedPhone(otpPhone.trim());
    setSentOtpCode(null);
    setOtpInput('');
  };

  const handlePortalSubmitTicket = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    const phoneToUse = verifiedPhone || otpPhone.trim() || trackPhone.trim();
    const res = submitPortalTicketByPhone({
      phone: phoneToUse,
      name: newName || verifiedCustomer?.name,
      subject: newSubject,
      category: newCategory,
      priority: newPriority,
      body: newBody,
      attachments: newAttachments.length > 0 ? newAttachments : undefined,
    });
    if (!res.ok || !res.ticket) {
      setSubmitError(res.error ?? 'خطا در ثبت تیکت.');
      return;
    }
    setCreatedTicketCode(res.ticket.trackingCode ?? res.ticket.id);
    setNewSubject('');
    setNewBody('');
    setNewAttachments([]);
    if (!verifiedPhone && phoneToUse) {
      setTrackPhone(phoneToUse);
      setTrackCode(res.ticket.trackingCode ?? res.ticket.id);
      setTrackedTicketId(res.ticket.id);
    }
  };

  const handleAttachFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const sizeKb = Math.max(1, Math.round(file.size / 1024));
    setNewAttachments((prev) => [
      ...prev,
      {
        id: `patt_${Date.now()}`,
        name: file.name,
        sizeLabel: sizeKb >= 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`,
        mimeType: file.type || 'application/octet-stream',
      },
    ]);
    e.target.value = '';
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Standalone Public Header */}
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white">
              <LifeBuoy size={18} />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                پورتال مشتریان — {state.settings.businessName}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                ثبت و پیگیری تیکت، مشاهده نوبت‌ها، سفارش‌ها و پایگاه دانش عمومی
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => updateSettings({ darkMode: !state.settings.darkMode })}
              aria-label={state.settings.darkMode ? 'حالت روشن' : 'حالت تاریک'}
              className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {state.settings.darkMode ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button
              type="button"
              onClick={onExitPortal}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <ArrowRight size={14} />
              بازگشت به پنل داخلی CRM
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
        {/* ROW 1: Quick Ticket Lookup by Phone + Tracking Code + Simulated OTP Account Access */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Card 1: Direct Lookup */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="flex items-center gap-2 text-sm font-bold">
              <Search size={16} className="text-indigo-600 dark:text-indigo-400" />
              پیگیری وضعیت تیکت با موبایل و کد رهگیری
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              شماره موبایل و کد رهگیری (مثلاً <span dir="ltr" className="font-mono">TK-1405-101</span>) را وارد کنید.
            </p>

            <form onSubmit={handleLookupTicket} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <input
                value={trackPhone}
                onChange={(e) => setTrackPhone(e.target.value)}
                placeholder="موبایل (09...)"
                dir="ltr"
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
              />
              <input
                value={trackCode}
                onChange={(e) => setTrackCode(e.target.value)}
                placeholder="کد رهگیری (TK-...)"
                dir="ltr"
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-mono uppercase dark:border-slate-700 dark:bg-slate-800"
              />
              <button
                type="submit"
                className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700"
              >
                استعلام وضعیت
              </button>
            </form>

            {trackError && <p className="mt-2 text-xs font-medium text-rose-600">{trackError}</p>}

            {trackedTicket && (
              <div className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-xs dark:border-slate-800 dark:bg-slate-800/40">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="ml-1.5 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                      {trackedTicket.trackingCode ?? trackedTicket.id}
                    </span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{trackedTicket.subject}</span>
                  </div>
                  <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                    {TICKET_STATUS_LABEL[trackedTicket.status]}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500">
                  ثبت‌کننده: {trackedCustomer?.name ?? 'مشتری'} · تاریخ ثبت:{' '}
                  <span className="tabular-nums">{formatJalaliDateTime(trackedTicket.createdAt)}</span>
                </div>

                <div className="max-h-40 space-y-2 overflow-y-auto border-t border-slate-200 pt-2 dark:border-slate-700">
                  {state.ticketMessages
                    .filter((m) => m.ticketId === trackedTicket.id && m.visibility === 'public')
                    .map((m) => (
                      <div key={m.id} className="rounded-lg bg-white p-2.5 dark:bg-slate-900">
                        <div className="mb-1 flex justify-between text-[11px] text-slate-400">
                          <span className="font-semibold text-slate-700 dark:text-slate-200">{m.authorName}</span>
                          <span className="tabular-nums">{formatJalaliDateTime(m.createdAt)}</span>
                        </div>
                        <p className="text-slate-700 dark:text-slate-300">{m.body}</p>
                      </div>
                    ))}
                </div>

                <div className="flex gap-2">
                  <input
                    value={trackReplyBody}
                    onChange={(e) => setTrackReplyBody(e.target.value)}
                    placeholder="ارسال پیام تکمیلی به کارشناس..."
                    className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!trackReplyBody.trim()) return;
                      addTicketMessage(trackedTicket.id, {
                        authorName: trackedCustomer?.name ?? 'مشتری',
                        authorType: 'customer',
                        visibility: 'public',
                        body: trackReplyBody,
                      });
                      setTrackReplyBody('');
                    }}
                    className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                  >
                    <Send size={12} />
                    ارسال
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Card 2: Simulated OTP Authentication */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="flex items-center gap-2 text-sm font-bold">
              <KeyRound size={16} className="text-emerald-600 dark:text-emerald-400" />
              ورود به پرونده من (احراز هویت پیامکی OTP)
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              برای مشاهده سوابق نوبت‌ها، کد رهگیری سفارش‌ها و ثبت تیکت اختصاصی با شماره موبایل وارد شوید.
            </p>

            {verifiedPhone ? (
              <div className="mt-4 space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-xs dark:border-emerald-900/50 dark:bg-emerald-950/20">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-bold text-emerald-800 dark:text-emerald-300">
                    <CheckCircle2 size={16} />
                    <span>
                      احراز هویت انجام شد: {verifiedCustomer?.name ?? 'مشتری گرامی'} (
                      <span dir="ltr" className="font-mono">
                        {verifiedPhone}
                      </span>
                      )
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setVerifiedPhone(null);
                      setSentOtpCode(null);
                    }}
                    className="text-rose-600 hover:underline dark:text-rose-400"
                  >
                    خروج از حساب
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-white/80 p-2 dark:bg-slate-900">
                    <div className="text-slate-500">تیکت‌های من</div>
                    <div className="mt-0.5 text-base font-bold tabular-nums">{toFa(myTickets.length)}</div>
                  </div>
                  <div className="rounded-lg bg-white/80 p-2 dark:bg-slate-900">
                    <div className="text-slate-500">نوبت‌های من</div>
                    <div className="mt-0.5 text-base font-bold tabular-nums">{toFa(myAppointments.length)}</div>
                  </div>
                  <div className="rounded-lg bg-white/80 p-2 dark:bg-slate-900">
                    <div className="text-slate-500">سفارش‌های من</div>
                    <div className="mt-0.5 text-base font-bold tabular-nums">{toFa(myOrders.length)}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {!sentOtpCode ? (
                  <form onSubmit={handleSendOtp} className="space-y-3">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Phone size={14} className="absolute right-3 top-2.5 text-slate-400" />
                        <input
                          value={otpPhone}
                          onChange={(e) => setOtpPhone(e.target.value)}
                          placeholder="شماره موبایل (مثلاً 09121110001)"
                          dir="ltr"
                          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-9 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
                        />
                      </div>
                      <button
                        type="submit"
                        className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-700"
                      >
                        ارسال کد OTP
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                      <span>شماره‌های نمونه تست:</span>
                      {state.customers.slice(0, 3).map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setOtpPhone(c.phone)}
                          className="rounded border border-slate-200 px-2 py-0.5 font-mono hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                        >
                          {c.phone} ({c.name})
                        </button>
                      ))}
                    </div>
                  </form>
                ) : (
                  <form onSubmit={handleVerifyOtp} className="space-y-3">
                    <div className="rounded-lg border border-indigo-200 bg-indigo-50/70 p-3 text-xs text-indigo-800 dark:border-indigo-900/50 dark:bg-indigo-950/30 dark:text-indigo-200">
                      پیامک شبیه‌سازی‌شده به{' '}
                      <span dir="ltr" className="font-mono font-bold">
                        {otpPhone}
                      </span>{' '}
                      ارسال و در صندوق پیامک CRM ثبت شد — کد تایید:{' '}
                      <span dir="ltr" className="font-mono text-sm font-bold">
                        {sentOtpCode}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <input
                        value={otpInput}
                        onChange={(e) => setOtpInput(e.target.value)}
                        placeholder="کد ۴ رقمی پیامک‌شده"
                        dir="ltr"
                        maxLength={4}
                        className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-center font-mono text-sm tracking-widest dark:border-slate-700 dark:bg-slate-800"
                      />
                      <button
                        type="submit"
                        className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-700"
                      >
                        تایید و ورود
                      </button>
                      <button
                        type="button"
                        onClick={() => setSentOtpCode(null)}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-xs dark:border-slate-700"
                      >
                        تغییر شماره
                      </button>
                    </div>
                  </form>
                )}
                {otpError && <p className="text-xs font-medium text-rose-600">{otpError}</p>}
              </div>
            )}
          </div>
        </div>

        {/* ROW 2: Submit New Ticket & Customer Portal Workspace */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Submit New Ticket Form */}
          <form
            onSubmit={handlePortalSubmitTicket}
            className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
          >
            <h3 className="flex items-center gap-2 text-sm font-bold">
              <Plus size={16} className="text-indigo-600 dark:text-indigo-400" />
              ثبت تیکت پشتیبانی جدید
            </h3>

            {createdTicketCode && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
                تیکت شما ثبت شد! کد رهگیری:{' '}
                <span dir="ltr" className="font-mono font-bold">
                  {createdTicketCode}
                </span>
              </div>
            )}

            {!verifiedPhone && (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input
                  value={trackPhone}
                  onChange={(e) => setTrackPhone(e.target.value)}
                  placeholder="شماره موبایل (09...)"
                  dir="ltr"
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
                />
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="نام و نام خانوادگی (اختیاری)"
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
            )}

            <input
              required
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              placeholder="موضوع درخواست یا شکایت..."
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
            />

            <div className="grid grid-cols-2 gap-2">
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              >
                {TICKET_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value as Ticket['priority'])}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="low">اولویت کم</option>
                <option value="normal">اولویت عادی</option>
                <option value="high">اولویت فوری</option>
              </select>
            </div>

            <textarea
              required
              rows={3}
              value={newBody}
              onChange={(e) => setNewBody(e.target.value)}
              placeholder="توضیحات خود را وارد کنید..."
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
            />

            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                <Paperclip size={12} />
                ضمیمه تصویر / فایل
                <input type="file" className="hidden" onChange={handleAttachFile} />
              </label>
              {newAttachments.map((att) => (
                <span key={att.id} className="text-[11px] text-slate-500" dir="ltr">
                  {att.name}
                </span>
              ))}
            </div>

            {submitError && <p className="text-xs text-rose-600">{submitError}</p>}

            <button
              type="submit"
              className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700"
            >
              ارسال درخواست پشتیبانی
            </button>
          </form>

          {/* Customer Account Records (after OTP verification) */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-2 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPortalTab('tickets')}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${
                    portalTab === 'tickets'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  <LifeBuoy size={14} />
                  تیکت‌های من
                </button>
                <button
                  type="button"
                  onClick={() => setPortalTab('appointments')}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${
                    portalTab === 'appointments'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  <CalendarDays size={14} />
                  نوبت‌های من
                </button>
                <button
                  type="button"
                  onClick={() => setPortalTab('orders')}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${
                    portalTab === 'orders'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  <ShoppingBag size={14} />
                  سفارش‌های من
                </button>
              </div>
            </div>

            {!verifiedPhone ? (
              <div className="py-12 text-center text-xs text-slate-500 dark:text-slate-400">
                برای مشاهده فهرست کامل تیکت‌ها، نوبت‌ها و سفارش‌های خود، از بخش احراز هویت پیامکی (OTP) در بالا وارد شوید.
              </div>
            ) : portalTab === 'tickets' ? (
              myTickets.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-500">تیکتی برای شماره شما ثبت نشده است.</div>
              ) : (
                <div className="space-y-3">
                  {myTickets.map((t) => {
                    const msgs = state.ticketMessages.filter(
                      (m) => m.ticketId === t.id && m.visibility === 'public',
                    );
                    return (
                      <div
                        key={t.id}
                        className="rounded-xl border border-slate-200 p-4 text-xs dark:border-slate-800"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <span className="ml-1.5 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                              {t.trackingCode ?? t.id}
                            </span>
                            <span className="font-bold text-slate-900 dark:text-slate-100">{t.subject}</span>
                          </div>
                          <span
                            className={`font-semibold ${
                              isTicketClosedStatus(t.status)
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-amber-600 dark:text-amber-400'
                            }`}
                          >
                            {TICKET_STATUS_LABEL[t.status]}
                          </span>
                        </div>
                        <div className="mt-1 text-[11px] text-slate-400 tabular-nums">
                          {t.category} · {formatJalaliDateTime(t.createdAt)}
                        </div>
                        {msgs.length > 0 && (
                          <div className="mt-2 space-y-1.5 rounded-lg bg-slate-50 p-2.5 dark:bg-slate-800/50">
                            {msgs.slice(-2).map((m) => (
                              <div key={m.id}>
                                <span className="font-semibold text-slate-700 dark:text-slate-200">
                                  {m.authorName}:{' '}
                                </span>
                                <span className="text-slate-600 dark:text-slate-300">{m.body}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="mt-2.5 flex gap-2">
                          <input
                            value={replyMap[t.id] ?? ''}
                            onChange={(e) => setReplyMap((prev) => ({ ...prev, [t.id]: e.target.value }))}
                            placeholder="پاسخ یا پیگیری جدید..."
                            className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const body = replyMap[t.id] ?? '';
                              if (!body.trim()) return;
                              addTicketMessage(t.id, {
                                authorName: verifiedCustomer?.name ?? 'مشتری',
                                authorType: 'customer',
                                visibility: 'public',
                                body,
                              });
                              setReplyMap((prev) => ({ ...prev, [t.id]: '' }));
                            }}
                            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                          >
                            ارسال
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            ) : portalTab === 'appointments' ? (
              myAppointments.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-500">نوبتی برای شما یافت نشد.</div>
              ) : (
                <div className="divide-y divide-slate-200 dark:divide-slate-800">
                  {myAppointments.map((a) => {
                    const srv = state.services.find((s) => s.id === a.serviceId);
                    const res = state.resources.find((r) => r.id === a.resourceId);
                    return (
                      <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-xs">
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-slate-100">
                            {srv?.name ?? 'خدمت'}
                          </div>
                          <div className="mt-0.5 text-slate-500">
                            ارائه‌دهنده: {res?.name ?? '—'} ·{' '}
                            <span className="tabular-nums">{formatJalaliDateTime(a.start)}</span>
                          </div>
                        </div>
                        <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                          {APT_STATUS_LABEL[a.status] ?? a.status}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )
            ) : myOrders.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-500">سفارشی برای شما یافت نشد.</div>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {myOrders.map((o) => {
                  const total =
                    o.items.reduce((s, it) => s + it.qty * it.price, 0) - (o.discountAmount ?? 0);
                  return (
                    <div key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-xs">
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                          سفارش <span className="font-mono">{o.id}</span> ·{' '}
                          {o.items.map((it) => `${it.name} (${toFa(it.qty)})`).join('، ')}
                        </div>
                        <div className="mt-0.5 text-slate-500 tabular-nums">
                          {formatJalaliDateTime(o.createdAt)} · مبلغ: {formatToman(total)}
                          {o.trackingCode && (
                            <span className="mr-2 font-mono text-indigo-600 dark:text-indigo-400">
                              کد رهگیری مرسوله: {o.trackingCode}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {ORDER_STATUS_LABEL[o.status] ?? o.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ROW 3: Public Knowledge Base */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-bold">
                <BookOpen size={16} className="text-indigo-600 dark:text-indigo-400" />
                راهنماها و سوالات متداول مشتریان
              </h3>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                فقط مقالات عمومی پایگاه دانش در این بخش نمایش داده می‌شوند.
              </p>
            </div>
            <div className="relative w-64">
              <Search size={14} className="absolute right-3 top-2.5 text-slate-400" />
              <input
                value={kbSearch}
                onChange={(e) => setKbSearch(e.target.value)}
                placeholder="جستجو در مقالات..."
                className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-8 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {publicKbArticles.map((art) => (
              <div
                key={art.id}
                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-xs dark:border-slate-800 dark:bg-slate-800/30"
              >
                <div>
                  <div className="mb-1 text-[11px] font-medium text-indigo-600 dark:text-indigo-400">
                    {art.category}
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">{art.title}</h4>
                  <p className="mt-1.5 leading-relaxed text-slate-600 dark:text-slate-300">{art.body}</p>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-2.5 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => voteKbHelpful(art.id)}
                    className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                  >
                    <ThumbsUp size={12} />
                    مفید بود ({toFa(art.helpfulCount)})
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
