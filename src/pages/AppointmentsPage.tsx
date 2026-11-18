import { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { AlertCircle, CalendarClock, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Modal } from '../components/Modal';
import { useClientFlow } from '../store/useClientFlowStore';
import type { Appointment, AppointmentStatus } from '../types';
import { formatTimeFa, getJalaliWeekDays, toFa } from '../utils/jalali';

const STATUS_META: Record<AppointmentStatus, { label: string; colorClass: string }> = {
  booked: { label: 'رزرو شده', colorClass: 'text-indigo-600 dark:text-indigo-400' },
  confirmed: { label: 'تأیید شده', colorClass: 'text-sky-600 dark:text-sky-400' },
  done: { label: 'انجام شده', colorClass: 'text-emerald-600 dark:text-emerald-400' },
  noshow: { label: 'عدم حضور', colorClass: 'text-amber-600 dark:text-amber-400' },
  cancelled: { label: 'لغو شده', colorClass: 'text-slate-400 dark:text-slate-500' },
};

export function AppointmentsPage() {
  const { state, addAppointment, rescheduleAppointment, updateAppointmentStatus } = useClientFlow();
  const [viewMode, setViewMode] = useState<'week' | 'day'>('week');
  const [weekOffset, setWeekOffset] = useState(0);
  const [resourceFilter, setResourceFilter] = useState('all');
  const [activeDayKey, setActiveDayKey] = useState(() => dayjs().format('YYYY-MM-DD'));

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

  const weekDays = useMemo(() => getJalaliWeekDays(weekOffset), [weekOffset]);

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
    setRescheduleDayKey(apt.start.slice(0, 10));
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

  const renderAppointmentCard = (apt: Appointment) => {
    const cust = state.customers.find((c) => c.id === apt.customerId);
    const srv = state.services.find((s) => s.id === apt.serviceId);
    const res = state.resources.find((r) => r.id === apt.resourceId);
    const meta = STATUS_META[apt.status];
    return (
      <div
        key={apt.id}
        className="rounded-lg border border-slate-200 bg-slate-50/70 p-2.5 text-xs dark:border-slate-800 dark:bg-slate-800/40"
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
        <div className="mt-2 flex items-center gap-1.5">
          <select
            aria-label="تغییر وضعیت نوبت"
            value={apt.status}
            onChange={(e) =>
              updateAppointmentStatus(apt.id, e.target.value as AppointmentStatus)
            }
            className="flex-1 rounded border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <option value="booked">رزرو شده</option>
            <option value="confirmed">تأیید شده</option>
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
              نمای هفتگی
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
              نمای روزانه (تفکیک منبع)
            </button>
          </div>

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

          {viewMode === 'week' ? (
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
        </div>

        <button
          type="button"
          onClick={() => openModalForDay()}
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700"
        >
          <Plus size={16} />
          ثبت نوبت جدید
        </button>
      </div>

      {viewMode === 'week' ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-7">
          {weekDays.map((day) => {
            const dayAppointments = state.appointments
              .filter(
                (a) =>
                  a.start.slice(0, 10) === day.dateKey &&
                  (resourceFilter === 'all' || a.resourceId === resourceFilter),
              )
              .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

            return (
              <div
                key={day.dateKey}
                className={`flex min-h-[320px] flex-col rounded-xl border bg-white dark:bg-slate-900 ${
                  day.isToday
                    ? 'border-indigo-400 dark:border-indigo-600'
                    : 'border-slate-200 dark:border-slate-800'
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
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {state.resources.map((res) => {
            const list = state.appointments
              .filter((a) => a.start.slice(0, 10) === activeDayKey && a.resourceId === res.id)
              .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

            return (
              <div
                key={res.id}
                className="flex min-h-[340px] flex-col rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
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
                    {s.name} ({toFa(s.durationMin)} دقیقه)
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
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">روز هفته (شمسی)</label>
              <select
                value={selectedDayKey}
                onChange={(e) => {
                  setSelectedDayKey(e.target.value);
                  setConflictError('');
                }}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                {weekDays.map((d) => (
                  <option key={d.dateKey} value={d.dateKey}>
                    {d.weekdayName} — {d.jalaliDayLabel}
                  </option>
                ))}
              </select>
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
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">روز جدید</label>
              <select
                value={rescheduleDayKey}
                onChange={(e) => {
                  setRescheduleDayKey(e.target.value);
                  setRescheduleError('');
                }}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                {weekDays.map((d) => (
                  <option key={d.dateKey} value={d.dateKey}>
                    {d.weekdayName} — {d.jalaliDayLabel}
                  </option>
                ))}
              </select>
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
    </div>
  );
}
