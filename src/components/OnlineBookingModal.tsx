import { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { CalendarCheck2, Copy, Globe } from 'lucide-react';
import { useClientFlow } from '../store/useClientFlowStore';
import { formatToman, getJalaliWeekDays, toFa } from '../utils/jalali';
import { hasConflict, isHolidayOrTimeOff } from '../utils/overlap';
import { normalizeMobileInput } from '../utils/csv';
import { Modal } from './Modal';

interface OnlineBookingModalProps {
  open: boolean;
  onClose: () => void;
}

export function OnlineBookingModal({ open, onClose }: OnlineBookingModalProps) {
  const { state, addCustomer, addAppointment, pushToast } = useClientFlow();
  const [serviceId, setServiceId] = useState(state.services[0]?.id ?? '');
  const [resourceId, setResourceId] = useState(state.resources[0]?.id ?? '');
  const [dayKey, setDayKey] = useState(() => dayjs().format('YYYY-MM-DD'));
  const [selectedSlot, setSelectedSlot] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [existingCustomerId, setExistingCustomerId] = useState('');
  const [error, setError] = useState('');

  const upcomingDays = useMemo(() => {
    const w0 = getJalaliWeekDays(0);
    const w1 = getJalaliWeekDays(1);
    const todayKey = dayjs().format('YYYY-MM-DD');
    return [...w0, ...w1].filter((d) => d.dateKey >= todayKey).slice(0, 10);
  }, []);

  const selectedService = state.services.find((s) => s.id === serviceId) ?? state.services[0];
  const dayBlockInfo = useMemo(
    () => isHolidayOrTimeOff(dayKey, resourceId, state.officialHolidays, state.resourceTimeOffs),
    [dayKey, resourceId, state.officialHolidays, state.resourceTimeOffs],
  );

  const selectedDayObj = upcomingDays.find((d) => d.dateKey === dayKey);
  const isWorkDay = selectedDayObj ? state.settings.workDays.includes(selectedDayObj.dayIndex) : true;

  const availableSlots = useMemo(() => {
    if (!selectedService || !resourceId || dayBlockInfo.blocked || !isWorkDay) return [];
    const slots: { timeLabel: string; startIso: string; endIso: string; busy: boolean }[] = [];
    const startHour = state.settings.workStartHour;
    const endHour = state.settings.workEndHour;
    const stepMin = Math.max(30, selectedService.durationMin);

    let cursor = dayjs(dayKey).hour(startHour).minute(0).second(0).millisecond(0);
    const limit = dayjs(dayKey).hour(endHour).minute(0).second(0).millisecond(0);

    while (cursor.add(selectedService.durationMin, 'minute').valueOf() <= limit.valueOf()) {
      const startIso = cursor.toISOString();
      const endIso = cursor.add(selectedService.durationMin, 'minute').toISOString();
      const busy = hasConflict(
        state.appointments,
        { resourceId, serviceId: selectedService.id, start: startIso, end: endIso },
        state.services,
      );
      slots.push({
        timeLabel: cursor.format('HH:mm'),
        startIso,
        endIso,
        busy,
      });
      cursor = cursor.add(stepMin, 'minute');
    }
    return slots;
  }, [selectedService, resourceId, dayKey, dayBlockInfo.blocked, isWorkDay, state.settings.workStartHour, state.settings.workEndHour, state.appointments, state.services]);

  const portalUrl = `https://clientflow.app/book/${state.settings.industryPack}`;

  const handleBook = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!selectedSlot || !selectedService) {
      setError('لطفاً یک بازه زمانی آزاد را انتخاب کنید.');
      return;
    }
    const slotObj = availableSlots.find((s) => s.startIso === selectedSlot);
    if (!slotObj || slotObj.busy) {
      setError('این زمان در دسترس نیست.');
      return;
    }

    let custId = existingCustomerId;
    if (!custId) {
      if (!guestName.trim()) {
        setError('نام و نام خانوادگی یا انتخاب مشتری الزامی است.');
        return;
      }
      const normPhone = normalizeMobileInput(guestPhone);
      const existingByPhone = state.customers.find((c) => c.phone === normPhone);
      if (existingByPhone) {
        custId = existingByPhone.id;
      } else {
        const resCust = addCustomer({
          name: guestName.trim(),
          phone: normPhone,
          lifecycle: 'lead',
          tags: ['رزرو آنلاین'],
          source: 'سایت',
          consentSms: true,
        });
        if (!resCust.ok || !resCust.customer) {
          setError(resCust.error ?? 'خطا در ثبت مشخصات مراجع');
          return;
        }
        custId = resCust.customer.id;
      }
    }

    const resApt = addAppointment({
      customerId: custId,
      serviceId: selectedService.id,
      resourceId,
      start: slotObj.startIso,
      end: slotObj.endIso,
      status: 'booked',
    });

    if (!resApt.ok) {
      setError(resApt.error ?? 'خطا در ثبت نوبت آنلاین');
      return;
    }

    setGuestName('');
    setGuestPhone('');
    setSelectedSlot('');
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="پیش‌نمایش پورتال عمومی نوبت‌دهی آنلاین" maxWidth="xl">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-indigo-200 bg-indigo-50/50 px-3 py-2 text-xs dark:border-indigo-900/60 dark:bg-indigo-950/20">
          <div className="flex items-center gap-2 text-indigo-800 dark:text-indigo-300">
            <Globe size={15} />
            <span>لینک اشتراک‌گذاری با مشتریان:</span>
            <span className="font-mono text-[11px]" dir="ltr">
              {portalUrl}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(portalUrl).catch(() => {});
              pushToast('لینک صفحه رزرو آنلاین کپی شد.');
            }}
            className="inline-flex items-center gap-1 rounded border border-indigo-200 bg-white px-2.5 py-1 text-[11px] font-medium text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:bg-slate-900 dark:text-indigo-300"
          >
            <Copy size={12} />
            کپی لینک رزرو
          </button>
        </div>

        <form onSubmit={handleBook} className="space-y-4">
          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">۱. انتخاب خدمت</label>
              <select
                value={serviceId}
                onChange={(e) => {
                  setServiceId(e.target.value);
                  setSelectedSlot('');
                }}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              >
                {state.services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {toFa(s.durationMin)} دقیقه ({formatToman(s.price)})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">۲. انتخاب پزشک / اتاق</label>
              <select
                value={resourceId}
                onChange={(e) => {
                  setResourceId(e.target.value);
                  setSelectedSlot('');
                }}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              >
                {state.resources.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">۳. انتخاب تاریخ</label>
              <select
                value={dayKey}
                onChange={(e) => {
                  setDayKey(e.target.value);
                  setSelectedSlot('');
                }}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              >
                {upcomingDays.map((d) => (
                  <option key={d.dateKey} value={d.dateKey}>
                    {d.weekdayName} — {d.jalaliDayLabel}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between text-xs font-medium text-slate-600 dark:text-slate-400">
              <span>۴. انتخاب اسلات زمانی آزاد (با محاسبه خودکار زمان بافر و مرخصی)</span>
              {selectedService && (selectedService.bufferBeforeMin || selectedService.bufferAfterMin) ? (
                <span className="text-[11px] text-slate-400">
                  بافر: {toFa(selectedService.bufferBeforeMin ?? 0)} قبل / {toFa(selectedService.bufferAfterMin ?? 0)} بعد (دقیقه)
                </span>
              ) : null}
            </div>

            {dayBlockInfo.blocked ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-center text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
                {dayBlockInfo.reason} — نوبت‌دهی در این روز غیرفعال است.
              </div>
            ) : !isWorkDay ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-800/40">
                روز انتخابی جزو روزهای تعطیل هفتگی مجموعه است.
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {availableSlots.map((slot) => {
                  const active = selectedSlot === slot.startIso;
                  return (
                    <button
                      key={slot.startIso}
                      type="button"
                      disabled={slot.busy}
                      onClick={() => setSelectedSlot(slot.startIso)}
                      className={`rounded-lg border py-2 text-xs font-medium tabular-nums transition-colors ${
                        slot.busy
                          ? 'cursor-not-allowed border-slate-100 bg-slate-100 text-slate-400 line-through dark:border-slate-800 dark:bg-slate-800/50'
                          : active
                            ? 'border-indigo-600 bg-indigo-600 text-white'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
                      }`}
                    >
                      {toFa(slot.timeLabel)}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-3 border-t border-slate-200 pt-3 dark:border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">۵. مشخصات مراجع</span>
              <select
                value={existingCustomerId}
                onChange={(e) => setExistingCustomerId(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="">-- مراجع جدید (وارد کردن نام و موبایل) --</option>
                {state.customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    مشتری قبلی: {c.name} ({toFa(c.phone)})
                  </option>
                ))}
              </select>
            </div>

            {!existingCustomerId && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input
                  type="text"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="نام و نام خانوادگی مراجع *"
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
                <input
                  type="tel"
                  dir="ltr"
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                  placeholder="09120000000 *"
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium dark:border-slate-700"
            >
              بستن
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700"
            >
              <CalendarCheck2 size={14} />
              ثبت نهایی رزرو آنلاین
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
