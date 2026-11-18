import { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import {
  AlertCircle,
  CalendarClock,
  CalendarOff,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Globe,
  ListChecks,
  MessageSquareReply,
  Plus,
  Trash2,
} from 'lucide-react';
import { Modal } from '../components/Modal';
import { OnlineBookingModal } from '../components/OnlineBookingModal';
import { useClientFlow } from '../store/useClientFlowStore';
import type { Appointment, AppointmentStatus } from '../types';
import {
  formatTimeFa,
  getJalaliMonthGrid,
  getJalaliWeekDays,
  getJalaliWeekRangeLabel,
  PERSIAN_WEEKDAYS,
  toFa,
} from '../utils/jalali';
import { isHolidayOrTimeOff } from '../utils/overlap';

const STATUS_META: Record<AppointmentStatus, { label: string; colorClass: string }> = {
  booked: { label: 'رزرو شده', colorClass: 'text-indigo-600 dark:text-indigo-400' },
  confirmed: { label: 'تأیید شده', colorClass: 'text-sky-600 dark:text-sky-400' },
  checked_in: { label: 'پذیرش در محل', colorClass: 'text-violet-600 dark:text-violet-400' },
  done: { label: 'انجام شده', colorClass: 'text-emerald-600 dark:text-emerald-400' },
  noshow: { label: 'عدم حضور', colorClass: 'text-amber-600 dark:text-amber-400' },
  cancelled: { label: 'لغو شده', colorClass: 'text-slate-400 dark:text-slate-500' },
};

const WEEKDAY_HEADERS_SAT_FIRST = [
  PERSIAN_WEEKDAYS[6],
  PERSIAN_WEEKDAYS[0],
  PERSIAN_WEEKDAYS[1],
  PERSIAN_WEEKDAYS[2],
  PERSIAN_WEEKDAYS[3],
  PERSIAN_WEEKDAYS[4],
  PERSIAN_WEEKDAYS[5],
];

export function AppointmentsPage() {
  const {
    state,
    addAppointment,
    rescheduleAppointment,
    updateAppointmentStatus,
    addResourceTimeOff,
    removeResourceTimeOff,
    addOfficialHoliday,
    removeOfficialHoliday,
    addWaitlistEntry,
    bookFromWaitlist,
    simulateSmsConfirmReply,
    pushToast,
  } = useClientFlow();

  const [viewMode, setViewMode] = useState<'week' | 'month' | 'day'>('week');
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);
  const [resourceFilter, setResourceFilter] = useState('all');
  const [activeDayKey, setActiveDayKey] = useState(() => dayjs().format('YYYY-MM-DD'));

  // Drag & Drop state
  const [dragAptId, setDragAptId] = useState<string | null>(null);
  const [dragTargetKey, setDragTargetKey] = useState<string | null>(null);

  // Create Appointment Modal
  const [createOpen, setCreateOpen] = useState(false);
  const [customerId, setCustomerId] = useState(state.customers[0]?.id ?? '');
  const [serviceId, setServiceId] = useState(state.services[0]?.id ?? '');
  const [resourceId, setResourceId] = useState(state.resources[0]?.id ?? '');
  const [selectedDayKey, setSelectedDayKey] = useState(() => dayjs().format('YYYY-MM-DD'));
  const [startTime, setStartTime] = useState('10:00');
  const [conflictError, setConflictError] = useState('');

  // Reschedule modal
  const [rescheduleTarget, setRescheduleTarget] = useState<Appointment | null>(null);
  const [rescheduleDayKey, setRescheduleDayKey] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('10:00');
  const [rescheduleResourceId, setRescheduleResourceId] = useState('');
  const [rescheduleError, setRescheduleError] = useState('');

  // Cancel reason modal
  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  // Waitlist, TimeOff/Holidays & Online Booking Modals
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [wlCustId, setWlCustId] = useState(state.customers[0]?.id ?? '');
  const [wlServiceId, setWlServiceId] = useState(state.services[0]?.id ?? '');
  const [wlResId, setWlResId] = useState(state.resources[0]?.id ?? '');
  const [wlDayKey, setWlDayKey] = useState(() => dayjs().format('YYYY-MM-DD'));
  const [wlRange, setWlRange] = useState('۱۶:۰۰ تا ۱۸:۰۰');
  const [wlBookSlot, setWlBookSlot] = useState('16:00');

  const [holidaysOpen, setHolidaysOpen] = useState(false);
  const [offResId, setOffResId] = useState(state.resources[0]?.id ?? '');
  const [offStartKey, setOffStartKey] = useState(() => dayjs().add(2, 'day').format('YYYY-MM-DD'));
  const [offEndKey, setOffEndKey] = useState(() => dayjs().add(2, 'day').format('YYYY-MM-DD'));
  const [offReason, setOffReason] = useState('مرخصی پزشک');
  const [holDateKey, setHolDateKey] = useState(() => dayjs().add(5, 'day').format('YYYY-MM-DD'));
  const [holJalali, setHolJalali] = useState('۱۴۰۵/۰۹/۰۲');
  const [holTitle, setHolTitle] = useState('تعطیل رسمی');

  const [portalOpen, setPortalOpen] = useState(false);

  const weekDays = useMemo(() => getJalaliWeekDays(weekOffset), [weekOffset]);
  const weekRangeLabel = useMemo(() => getJalaliWeekRangeLabel(weekDays), [weekDays]);
  const monthGrid = useMemo(() => getJalaliMonthGrid(monthOffset), [monthOffset]);

  const waitingCount = state.waitlist.filter((w) => w.status !== 'booked').length;

  const openModalForDay = (dayKey?: string, defaultResId?: string) => {
    setCustomerId(state.customers[0]?.id ?? '');
    setServiceId(state.services[0]?.id ?? '');
    setResourceId(
      defaultResId ?? (resourceFilter !== 'all' ? resourceFilter : state.resources[0]?.id ?? ''),
    );
    setSelectedDayKey(dayKey ?? activeDayKey);
    setStartTime(`${String(state.settings.workStartHour).padStart(2, '0')}:00`);
    setConflictError('');
    setCreateOpen(true);
  };

  const openReschedule = (apt: Appointment) => {
    setRescheduleTarget(apt);
    setRescheduleDayKey(dayjs(apt.start).format('YYYY-MM-DD'));
    setRescheduleTime(dayjs(apt.start).format('HH:mm'));
    setRescheduleResourceId(apt.resourceId);
    setRescheduleError('');
  };

  const isOutsideWorkHours = (timeStr: string) => {
    const [hh] = timeStr.split(':').map(Number);
    return hh < state.settings.workStartHour || hh >= state.settings.workEndHour;
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const service = state.services.find((s) => s.id === serviceId);
    if (!service || !customerId || !resourceId) return;

    const [hh, mm] = startTime.split(':').map(Number);
    const startDt = dayjs(selectedDayKey).hour(hh).minute(mm).second(0).millisecond(0);
    const endDt = startDt.add(service.durationMin, 'minute');

    const res = addAppointment({
      customerId,
      serviceId,
      resourceId,
      start: startDt.toISOString(),
      end: endDt.toISOString(),
      status: 'booked',
    });

    if (!res.ok) {
      setConflictError(res.error ?? 'خطا در ثبت نوبت');
      return;
    }
    setCreateOpen(false);
  };

  const handleReschedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rescheduleTarget) return;
    const durationMs =
      new Date(rescheduleTarget.end).getTime() - new Date(rescheduleTarget.start).getTime();
    const [hh, mm] = rescheduleTime.split(':').map(Number);
    const startDt = dayjs(rescheduleDayKey).hour(hh).minute(mm).second(0).millisecond(0);
    const endDt = new Date(startDt.toDate().getTime() + durationMs);

    const res = rescheduleAppointment(rescheduleTarget.id, {
      start: startDt.toISOString(),
      end: endDt.toISOString(),
      resourceId: rescheduleResourceId,
    });
    if (!res.ok) {
      setRescheduleError(res.error ?? 'خطا در جابه‌جایی');
      return;
    }
    setRescheduleTarget(null);
  };

  const handleDropOnTarget = (targetDayKey: string, targetResourceId?: string) => {
    setDragTargetKey(null);
    if (!dragAptId) return;
    const apt = state.appointments.find((a) => a.id === dragAptId);
    setDragAptId(null);
    if (!apt) return;

    const oldStart = dayjs(apt.start);
    const durationMs = new Date(apt.end).getTime() - new Date(apt.start).getTime();
    const nextStart = dayjs(targetDayKey)
      .hour(oldStart.hour())
      .minute(oldStart.minute())
      .second(0)
      .millisecond(0);
    const nextEnd = new Date(nextStart.toDate().getTime() + durationMs);

    const res = rescheduleAppointment(apt.id, {
      start: nextStart.toISOString(),
      end: nextEnd.toISOString(),
      resourceId: targetResourceId ?? apt.resourceId,
    });
    if (!res.ok) {
      pushToast(res.error ?? 'امکان انتقال نوبت به این بازه وجود ندارد.', 'error');
    }
  };

  const renderAppointmentCard = (apt: Appointment) => {
    const cust = state.customers.find((c) => c.id === apt.customerId);
    const srv = state.services.find((s) => s.id === apt.serviceId);
    const res = state.resources.find((r) => r.id === apt.resourceId);
    const meta = STATUS_META[apt.status];
    const hasBuffer = Boolean(srv?.bufferBeforeMin || srv?.bufferAfterMin);

    return (
      <div
        key={apt.id}
        draggable
        onDragStart={() => setDragAptId(apt.id)}
        onDragEnd={() => {
          setDragAptId(null);
          setDragTargetKey(null);
        }}
        className="cursor-grab rounded-lg border border-slate-200 bg-slate-50/70 p-2.5 text-xs active:cursor-grabbing dark:border-slate-800 dark:bg-slate-800/40"
      >
        <div className="flex items-center justify-between gap-1 font-medium">
          <span className="tabular-nums text-slate-900 dark:text-slate-100">
            {formatTimeFa(apt.start)} – {formatTimeFa(apt.end)}
          </span>
          <span className={meta.colorClass}>{meta.label}</span>
        </div>
        <div className="mt-1 truncate font-semibold text-slate-800 dark:text-slate-200">
          {cust?.name ?? 'مشتری'}
        </div>
        <div className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">
          {srv?.name} · {res?.name}
        </div>
        {hasBuffer && (
          <div className="mt-0.5 text-[10px] text-slate-400 tabular-nums">
            بافر: {toFa(srv?.bufferBeforeMin ?? 0)} / {toFa(srv?.bufferAfterMin ?? 0)} د
          </div>
        )}
        {apt.status === 'cancelled' && apt.cancelReason && (
          <div className="mt-1 truncate text-[11px] text-rose-600 dark:text-rose-400">
            دلیل لغو: {apt.cancelReason}
          </div>
        )}

        <div className="mt-2 flex items-center gap-1">
          <select
            aria-label="تغییر وضعیت نوبت"
            value={apt.status}
            onChange={(e) => {
              const nextStatus = e.target.value as AppointmentStatus;
              if (nextStatus === 'cancelled') {
                setCancelTarget(apt);
                setCancelReason(apt.cancelReason ?? '');
              } else {
                updateAppointmentStatus(apt.id, nextStatus);
              }
            }}
            className="flex-1 rounded border border-slate-200 bg-white px-1.5 py-1 text-[11px] text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <option value="booked">رزرو شده</option>
            <option value="confirmed">تأیید شده</option>
            <option value="checked_in">پذیرش در محل</option>
            <option value="done">انجام شده</option>
            <option value="noshow">عدم حضور</option>
            <option value="cancelled">لغو شده</option>
          </select>
          <button
            type="button"
            onClick={() => openReschedule(apt)}
            title="جابه‌جایی ساعت یا منبع"
            className="rounded border border-slate-200 bg-white p-1 text-slate-500 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          >
            <CalendarClock size={13} />
          </button>
        </div>

        {(apt.status === 'booked' || apt.status === 'confirmed') && (
          <div className="mt-1.5 flex gap-1">
            {apt.status === 'booked' && (
              <button
                type="button"
                onClick={() => simulateSmsConfirmReply(apt.id)}
                title="شبیه‌سازی پاسخ پیامک تأیید مشتری"
                className="inline-flex flex-1 items-center justify-center gap-1 rounded border border-sky-200 bg-sky-50 py-1 text-[10px] font-medium text-sky-700 hover:bg-sky-100 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-300"
              >
                <MessageSquareReply size={11} />
                تأیید پیامکی
              </button>
            )}
            <button
              type="button"
              onClick={() => updateAppointmentStatus(apt.id, 'checked_in')}
              className="inline-flex flex-1 items-center justify-center gap-1 rounded border border-violet-200 bg-violet-50 py-1 text-[10px] font-medium text-violet-700 hover:bg-violet-100 dark:border-violet-900/60 dark:bg-violet-950/30 dark:text-violet-300"
            >
              <CheckCircle2 size={11} />
              پذیرش در محل
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-900">
            <button
              type="button"
              onClick={() => setViewMode('week')}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium ${
                viewMode === 'week'
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              هفتگی
            </button>
            <button
              type="button"
              onClick={() => setViewMode('month')}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium ${
                viewMode === 'month'
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              ماهانه (شمسی)
            </button>
            <button
              type="button"
              onClick={() => setViewMode('day')}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium ${
                viewMode === 'day'
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              روزانه (تفکیک منبع)
            </button>
          </div>

          {viewMode === 'month' ? (
            <div className="flex items-center rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
              <button
                type="button"
                onClick={() => setMonthOffset((m) => m - 1)}
                className="p-2 text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <ChevronRight size={16} />
              </button>
              <button
                type="button"
                onClick={() => setMonthOffset(0)}
                className="border-x border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {monthGrid.title}
              </button>
              <button
                type="button"
                onClick={() => setMonthOffset((m) => m + 1)}
                className="p-2 text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <ChevronLeft size={16} />
              </button>
            </div>
          ) : (
            <div className="flex items-center rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
              <button
                type="button"
                onClick={() => setWeekOffset((w) => w - 1)}
                aria-label="هفته قبل"
                className="p-2 text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <ChevronRight size={16} />
              </button>
              <button
                type="button"
                onClick={() => {
                  setWeekOffset(0);
                  setActiveDayKey(dayjs().format('YYYY-MM-DD'));
                }}
                className="border-x border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                هفته جاری
              </button>
              <button
                type="button"
                onClick={() => setWeekOffset((w) => w + 1)}
                aria-label="هفته بعد"
                className="p-2 text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <ChevronLeft size={16} />
              </button>
            </div>
          )}

          {viewMode !== 'day' ? (
            <select
              value={resourceFilter}
              onChange={(e) => setResourceFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium dark:border-slate-800 dark:bg-slate-900"
            >
              <option value="all">همه منابع (پزشک / اتاق)</option>
              {state.resources.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          ) : (
            <select
              value={activeDayKey}
              onChange={(e) => setActiveDayKey(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium dark:border-slate-800 dark:bg-slate-900"
            >
              {weekDays.map((d) => (
                <option key={d.dateKey} value={d.dateKey}>
                  {d.weekdayName} — {d.jalaliDayLabel}
                </option>
              ))}
            </select>
          )}
          {viewMode !== 'month' && (
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300 tabular-nums whitespace-nowrap">
              {weekRangeLabel}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setWaitlistOpen(true)}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <ListChecks size={15} />
            لیست انتظار ({toFa(waitingCount)})
          </button>
          <button
            type="button"
            onClick={() => setHolidaysOpen(true)}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <CalendarOff size={15} />
            مرخصی و تعطیلات
          </button>
          <button
            type="button"
            onClick={() => setPortalOpen(true)}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-medium text-indigo-700 hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-300"
          >
            <Globe size={15} />
            پورتال رزرو آنلاین
          </button>
          <button
            type="button"
            onClick={() => openModalForDay()}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700"
          >
            <Plus size={16} />
            ثبت نوبت جدید
          </button>
        </div>
      </div>

      {/* VIEW 1: WEEKLY WITH DRAG & DROP */}
      {viewMode === 'week' && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-7">
          {weekDays.map((day) => {
            const isWorkDay = state.settings.workDays.includes(day.dayIndex);
            const hol = state.officialHolidays.find((h) => h.dateKey === day.dateKey);
            const dayAppointments = state.appointments
              .filter(
                (a) =>
                  dayjs(a.start).format('YYYY-MM-DD') === day.dateKey &&
                  (resourceFilter === 'all' || a.resourceId === resourceFilter),
              )
              .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

            const isDropHover = dragTargetKey === day.dateKey;

            return (
              <div
                key={day.dateKey}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragTargetKey(day.dateKey);
                }}
                onDragLeave={() => setDragTargetKey(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDropOnTarget(day.dateKey);
                }}
                className={`flex min-h-[340px] flex-col rounded-xl border transition-colors ${
                  isDropHover
                    ? 'border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/20'
                    : day.isToday
                      ? 'border-indigo-400 bg-white dark:border-indigo-600 dark:bg-slate-900'
                      : isWorkDay && !hol
                        ? 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
                        : 'border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-900/50'
                }`}
              >
                <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2.5 dark:border-slate-800">
                  <div>
                    <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                      {day.weekdayName}
                      {day.isToday && (
                        <span className="mr-1.5 text-[11px] font-medium text-indigo-600 dark:text-indigo-400">
                          (امروز)
                        </span>
                      )}
                      {hol ? (
                        <span className="mr-1.5 text-[10px] font-normal text-rose-600">
                          ({hol.title})
                        </span>
                      ) : (
                        !isWorkDay && (
                          <span className="mr-1.5 text-[11px] font-normal text-slate-400 dark:text-slate-500">
                            (تعطیل)
                          </span>
                        )
                      )}
                    </div>
                    <div className="text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
                      {day.jalaliDayLabel}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => openModalForDay(day.dateKey)}
                    title={`ثبت نوبت در ${day.weekdayName}`}
                    className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 dark:hover:bg-slate-800"
                  >
                    <Plus size={15} />
                  </button>
                </div>

                <div className="flex-1 space-y-2 p-2.5">
                  {dayAppointments.length === 0 ? (
                    <div className="py-10 text-center text-xs text-slate-400 dark:text-slate-500">
                      نوبتی ثبت نشده
                    </div>
                  ) : (
                    dayAppointments.map(renderAppointmentCard)
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* VIEW 2: JALALI MONTHLY CALENDAR */}
      {viewMode === 'month' && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">
            {WEEKDAY_HEADERS_SAT_FIRST.map((wd) => (
              <div key={wd} className="py-2.5">
                {wd}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 divide-x divide-y divide-x-reverse divide-slate-200 dark:divide-slate-800">
            {monthGrid.cells.map((cell) => {
              const dayApts = state.appointments.filter(
                (a) =>
                  dayjs(a.start).format('YYYY-MM-DD') === cell.dateKey &&
                  a.status !== 'cancelled' &&
                  (resourceFilter === 'all' || a.resourceId === resourceFilter),
              );
              const hol = state.officialHolidays.find((h) => h.dateKey === cell.dateKey);
              const isDropHover = dragTargetKey === cell.dateKey;

              return (
                <div
                  key={cell.dateKey}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragTargetKey(cell.dateKey);
                  }}
                  onDragLeave={() => setDragTargetKey(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleDropOnTarget(cell.dateKey);
                  }}
                  onClick={() => {
                    setActiveDayKey(cell.dateKey);
                    openModalForDay(cell.dateKey);
                  }}
                  className={`min-h-[104px] cursor-pointer p-2 text-xs transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40 ${
                    isDropHover
                      ? 'bg-indigo-50/50 dark:bg-indigo-950/30'
                      : !cell.isCurrentMonth
                        ? 'bg-slate-50/70 text-slate-400 dark:bg-slate-950/40'
                        : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-full tabular-nums font-semibold ${
                        cell.isToday
                          ? 'bg-indigo-600 text-white'
                          : hol
                            ? 'text-rose-600 dark:text-rose-400'
                            : ''
                      }`}
                    >
                      {toFa(cell.jalaliDay)}
                    </span>
                    {dayApts.length > 0 && (
                      <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                        {toFa(dayApts.length)} نوبت
                      </span>
                    )}
                  </div>
                  {hol && (
                    <div className="mt-1 truncate text-[10px] font-medium text-rose-600 dark:text-rose-400">
                      {hol.title}
                    </div>
                  )}
                  <div className="mt-1.5 space-y-1">
                    {dayApts.slice(0, 2).map((a) => {
                      const cust = state.customers.find((c) => c.id === a.customerId);
                      return (
                        <div
                          key={a.id}
                          className="truncate rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        >
                          {formatTimeFa(a.start)} {cust?.name}
                        </div>
                      );
                    })}
                    {dayApts.length > 2 && (
                      <div className="text-[10px] text-slate-400">+{toFa(dayApts.length - 2)} مورد دیگر</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW 3: DAILY RESOURCE VIEW WITH DRAG & DROP */}
      {viewMode === 'day' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {state.resources.map((res) => {
            const list = state.appointments
              .filter((a) => dayjs(a.start).format('YYYY-MM-DD') === activeDayKey && a.resourceId === res.id)
              .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

            const blocked = isHolidayOrTimeOff(
              activeDayKey,
              res.id,
              state.officialHolidays,
              state.resourceTimeOffs,
            );
            const dropKey = `res_${res.id}`;
            const isDropHover = dragTargetKey === dropKey;

            return (
              <div
                key={res.id}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragTargetKey(dropKey);
                }}
                onDragLeave={() => setDragTargetKey(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDropOnTarget(activeDayKey, res.id);
                }}
                className={`flex min-h-[340px] flex-col rounded-xl border transition-colors ${
                  isDropHover
                    ? 'border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/20'
                    : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
                }`}
              >
                <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
                  <div>
                    <div className="text-sm font-semibold">{res.name}</div>
                    <div className="text-xs text-slate-500">
                      {res.type === 'staff' ? 'پزشک / کارشناس' : 'اتاق / تجهیز'} · {toFa(list.length)} نوبت
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => openModalForDay(activeDayKey, res.id)}
                    className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 dark:hover:bg-slate-800"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                {blocked.blocked && (
                  <div className="border-b border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] font-medium text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
                    {blocked.reason}
                  </div>
                )}
                <div className="flex-1 space-y-2 p-3">
                  {list.length === 0 ? (
                    <div className="py-10 text-center text-xs text-slate-400">نوبتی برای این منبع ثبت نشده</div>
                  ) : (
                    list.map(renderAppointmentCard)
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Appointment Modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="ثبت نوبت جدید" maxWidth="md">
        <form onSubmit={handleCreate} className="space-y-4">
          {conflictError && (
            <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{conflictError}</span>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">مشتری</label>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            >
              {state.customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({toFa(c.phone)})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">خدمت</label>
              <select
                value={serviceId}
                onChange={(e) => setServiceId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                {state.services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({toFa(s.durationMin)} د · بافر {toFa((s.bufferBeforeMin ?? 0) + (s.bufferAfterMin ?? 0))} د)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">منبع (پزشک / اتاق)</label>
              <select
                value={resourceId}
                onChange={(e) => {
                  setResourceId(e.target.value);
                  setConflictError('');
                }}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                {state.resources.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">تاریخ (میلادی / انتخاب روز)</label>
              <input
                type="date"
                dir="ltr"
                value={selectedDayKey}
                onChange={(e) => {
                  setSelectedDayKey(e.target.value);
                  setConflictError('');
                }}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm tabular-nums dark:border-slate-700 dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                ساعت شروع (ساعت کاری: {toFa(state.settings.workStartHour)} تا {toFa(state.settings.workEndHour)})
              </label>
              <input
                type="time"
                dir="ltr"
                value={startTime}
                onChange={(e) => {
                  setStartTime(e.target.value);
                  setConflictError('');
                }}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm tabular-nums dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>

          {isOutsideWorkHours(startTime) && (
            <div className="text-xs text-amber-600 dark:text-amber-400">
              توجه: ساعت انتخابی خارج از ساعات کاری استاندارد مجموعه است.
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm dark:border-slate-700"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              ثبت نوبت
            </button>
          </div>
        </form>
      </Modal>

      {/* Reschedule Appointment Modal */}
      <Modal
        open={Boolean(rescheduleTarget)}
        onClose={() => setRescheduleTarget(null)}
        title="جابه‌جایی زمان یا منبع نوبت"
        maxWidth="md"
      >
        <form onSubmit={handleReschedule} className="space-y-4">
          {rescheduleError && (
            <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{rescheduleError}</span>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">منبع جدید</label>
            <select
              value={rescheduleResourceId}
              onChange={(e) => {
                setRescheduleResourceId(e.target.value);
                setRescheduleError('');
              }}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            >
              {state.resources.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">تاریخ جدید</label>
              <input
                type="date"
                dir="ltr"
                value={rescheduleDayKey}
                onChange={(e) => {
                  setRescheduleDayKey(e.target.value);
                  setRescheduleError('');
                }}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm tabular-nums dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">ساعت شروع</label>
              <input
                type="time"
                dir="ltr"
                value={rescheduleTime}
                onChange={(e) => {
                  setRescheduleTime(e.target.value);
                  setRescheduleError('');
                }}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm tabular-nums dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setRescheduleTarget(null)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm dark:border-slate-700"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              ذخیره جابه‌جایی
            </button>
          </div>
        </form>
      </Modal>

      {/* Waitlist Modal */}
      <Modal open={waitlistOpen} onClose={() => setWaitlistOpen(false)} title="لیست انتظار نوبت‌ها و جایگزینی خودکار" maxWidth="xl">
        <div className="space-y-5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              addWaitlistEntry({
                customerId: wlCustId,
                serviceId: wlServiceId,
                preferredResourceId: wlResId || undefined,
                preferredDayKey: wlDayKey,
                preferredTimeRange: wlRange,
              });
            }}
            className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-slate-50/50 p-3 sm:grid-cols-5 dark:border-slate-800 dark:bg-slate-800/40"
          >
            <select
              value={wlCustId}
              onChange={(e) => setWlCustId(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
            >
              {state.customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              value={wlServiceId}
              onChange={(e) => setWlServiceId(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
            >
              {state.services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <input
              type="date"
              dir="ltr"
              value={wlDayKey}
              onChange={(e) => setWlDayKey(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-900"
            />
            <input
              type="text"
              value={wlRange}
              onChange={(e) => setWlRange(e.target.value)}
              placeholder="بازه ساعت..."
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
            />
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
            >
              افزودن به صف انتظار
            </button>
          </form>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Clock size={14} />
            <span>ساعت پیش‌فرض رزرو از صف انتظار:</span>
            <input
              type="time"
              dir="ltr"
              value={wlBookSlot}
              onChange={(e) => setWlBookSlot(e.target.value)}
              className="rounded border border-slate-200 bg-white px-2 py-1 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
            />
            <span>و منبع:</span>
            <select
              value={wlResId}
              onChange={(e) => setWlResId(e.target.value)}
              className="rounded border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
            >
              {state.resources.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
            {state.waitlist.map((w) => {
              const cust = state.customers.find((c) => c.id === w.customerId);
              const srv = state.services.find((s) => s.id === w.serviceId);
              return (
                <div key={w.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-xs">
                  <div>
                    <div className="font-semibold">
                      {cust?.name ?? 'مشتری'} · <span className="text-indigo-600">{srv?.name}</span>
                    </div>
                    <div className="mt-0.5 text-slate-500">
                      بازه درخواستی: {w.preferredTimeRange} (تاریخ: <span dir="ltr">{w.preferredDayKey}</span>) · وضعیت:{' '}
                      <span className="font-medium">
                        {w.status === 'booked'
                          ? 'رزرو شد'
                          : w.status === 'notified'
                            ? 'پیامک جای خالی ارسال شد'
                            : 'در انتظار'}
                      </span>
                    </div>
                  </div>
                  {w.status !== 'booked' && (
                    <button
                      type="button"
                      onClick={() => {
                        const [hh, mm] = wlBookSlot.split(':').map(Number);
                        const startIso = dayjs(w.preferredDayKey)
                          .hour(hh)
                          .minute(mm)
                          .second(0)
                          .millisecond(0)
                          .toISOString();
                        const res = bookFromWaitlist(
                          w.id,
                          startIso,
                          w.preferredResourceId || wlResId || state.resources[0]?.id,
                        );
                        if (!res.ok) {
                          pushToast(res.error ?? 'تداخل زمانی در این ساعت', 'error');
                        }
                      }}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                    >
                      تبدیل فوری به نوبت
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </Modal>

      {/* TimeOff & Official Holidays Modal */}
      <Modal open={holidaysOpen} onClose={() => setHolidaysOpen(false)} title="مدیریت مرخصی پرسنل و تعطیلات رسمی" maxWidth="xl">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            <h3 className="text-xs font-semibold">مرخصی / بازه عدم حضور منبع</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                addResourceTimeOff({
                  resourceId: offResId,
                  startDateKey: offStartKey,
                  endDateKey: offEndKey,
                  reason: offReason.trim() || 'مرخصی',
                });
              }}
              className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-800"
            >
              <select
                value={offResId}
                onChange={(e) => setOffResId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
              >
                {state.resources.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  dir="ltr"
                  value={offStartKey}
                  onChange={(e) => setOffStartKey(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
                <input
                  type="date"
                  dir="ltr"
                  value={offEndKey}
                  onChange={(e) => setOffEndKey(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={offReason}
                  onChange={(e) => setOffReason(e.target.value)}
                  placeholder="دلیل (مثلاً مرخصی یا تعمیرات اتاق)..."
                  className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                >
                  ثبت
                </button>
              </div>
            </form>
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {state.resourceTimeOffs.map((t) => {
                const r = state.resources.find((res) => res.id === t.resourceId);
                return (
                  <div key={t.id} className="flex items-center justify-between py-2 text-xs">
                    <div>
                      <span className="font-semibold">{r?.name ?? 'منبع'}</span> — {t.reason}
                      <div className="text-[11px] text-slate-400" dir="ltr">
                        {t.startDateKey} → {t.endDateKey}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeResourceTimeOff(t.id)}
                      className="p-1 text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-semibold">تقویم تعطیلات رسمی کل مجموعه</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                addOfficialHoliday({
                  dateKey: holDateKey,
                  jalaliDate: holJalali.trim() || holDateKey,
                  title: holTitle.trim() || 'تعطیل رسمی',
                });
              }}
              className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-800"
            >
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  dir="ltr"
                  value={holDateKey}
                  onChange={(e) => setHolDateKey(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
                <input
                  type="text"
                  value={holJalali}
                  onChange={(e) => setHolJalali(e.target.value)}
                  placeholder="تاریخ شمسی (مثلاً ۱۴۰۵/۰۹/۰۲)"
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={holTitle}
                  onChange={(e) => setHolTitle(e.target.value)}
                  placeholder="عنوان مناسبت تعطیل..."
                  className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                >
                  افزودن تعطیلی
                </button>
              </div>
            </form>
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {state.officialHolidays.map((h) => (
                <div key={h.id} className="flex items-center justify-between py-2 text-xs">
                  <div>
                    <span className="font-semibold text-rose-600 dark:text-rose-400">{h.title}</span>
                    <span className="mx-2 text-slate-400">·</span>
                    <span className="tabular-nums text-slate-500">{toFa(h.jalaliDate)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeOfficialHoliday(h.id)}
                    className="p-1 text-slate-400 hover:text-rose-600"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* Cancel Reason Modal */}
      <Modal
        open={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        title="ثبت دلیل لغو نوبت (و بررسی لیست انتظار)"
        maxWidth="sm"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!cancelTarget) return;
            updateAppointmentStatus(
              cancelTarget.id,
              'cancelled',
              cancelReason.trim() || 'لغو توسط پذیرش',
            );
            setCancelTarget(null);
            setCancelReason('');
          }}
          className="space-y-4"
        >
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
              دلیل لغو نوبت (اختیاری)
            </label>
            <input
              type="text"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="مثلاً: درخواست جابه‌جایی مراجع، عدم امکان حضور..."
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              در صورت وجود متقاضی هم‌روز در لیست انتظار، پیامک اطلاع‌رسانی جای خالی به‌صورت خودکار ارسال می‌شود.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setCancelTarget(null)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm dark:border-slate-700"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700"
            >
              تأیید لغو نوبت
            </button>
          </div>
        </form>
      </Modal>

      <OnlineBookingModal open={portalOpen} onClose={() => setPortalOpen(false)} />
    </div>
  );
}
