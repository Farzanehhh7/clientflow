import { useEffect, useMemo, useState } from 'react';
import {
  Pause,
  PhoneCall,
  PhoneIncoming,
  PhoneMissed,
  PhoneOutgoing,
  Play,
  Volume2,
} from 'lucide-react';
import { getTelephonyProvider } from '../../services/providers/telephonyAdapter';
import { useClientFlow } from '../../store/useClientFlowStore';
import type { CallDirection, CallLogEntry, TelephonyProviderDriver } from '../../types';
import { formatJalaliDateTime, toFa } from '../../utils/jalali';

const CALL_STATUS_LABELS: Record<CallLogEntry['status'], { label: string; cls: string }> = {
  answered: { label: 'پاسخ‌داده‌شده', cls: 'text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300' },
  missed: { label: 'از دست‌رفته', cls: 'text-rose-700 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-300' },
  voicemail: { label: 'پیام‌گیر', cls: 'text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300' },
  busy: { label: 'اشغال', cls: 'text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-300' },
  ringing: { label: 'در حال زنگ', cls: 'text-indigo-700 bg-indigo-50 dark:bg-indigo-950/40 dark:text-indigo-300' },
};

export function TelephonyTab() {
  const {
    state,
    updateIntegrationsConfig,
    startOutboundCall,
    triggerIncomingCall,
  } = useClientFlow();

  const cfg = state.integrationsConfig;
  const driver = cfg?.telephonyDriver ?? 'simotel';
  const extension = cfg?.telephonyExtension ?? '101';
  const serverUrl = cfg?.telephonyServerUrl ?? 'https://pbx.local.clientflow.ir/api/v4';
  const callLogs = state.callLogs ?? [];
  const adapter = getTelephonyProvider(driver);

  const [dirFilter, setDirFilter] = useState<'all' | CallDirection | 'missed'>('all');
  const [dialCustomerId, setDialCustomerId] = useState(state.customers[0]?.id ?? '');
  const [dialPhone, setDialPhone] = useState(state.customers[0]?.phone ?? '09121110001');
  const [playingCallId, setPlayingCallId] = useState<string | null>(null);
  const [playProgress, setPlayProgress] = useState(0);

  useEffect(() => {
    if (!playingCallId) {
      setPlayProgress(0);
      return;
    }
    const timer = window.setInterval(() => {
      setPlayProgress((p) => (p >= 100 ? 0 : p + 8));
    }, 300);
    return () => window.clearInterval(timer);
  }, [playingCallId]);

  const filteredCalls = useMemo(() => {
    return callLogs.filter((c) => {
      if (dirFilter === 'missed') return c.status === 'missed';
      if (dirFilter === 'inbound' || dirFilter === 'outbound') return c.direction === dirFilter;
      return true;
    });
  }, [callLogs, dirFilter]);

  const stats = useMemo(() => {
    const answered = callLogs.filter((c) => c.status === 'answered');
    const missed = callLogs.filter((c) => c.status === 'missed').length;
    const avgDur = answered.length
      ? Math.round(answered.reduce((s, c) => s + c.durationSec, 0) / answered.length)
      : 0;
    return { total: callLogs.length, answered: answered.length, missed, avgDur };
  }, [callLogs]);

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${toFa(String(m).padStart(2, '0'))}:${toFa(String(s).padStart(2, '0'))}`;
  };

  return (
    <div className="space-y-5">
      {/* Adapter Config + Quick Dialer + Incoming Simulator */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 lg:col-span-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">پیکربندی آداپتور مرکز تلفن ابری (VoIP)</h3>
            <span className="font-mono text-[11px] text-indigo-600 dark:text-indigo-400">
              ITelephonyProvider
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2.5 text-xs sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] text-slate-500">درایور مرکز تلفن</label>
              <select
                value={driver}
                onChange={(e) =>
                  updateIntegrationsConfig({ telephonyDriver: e.target.value as TelephonyProviderDriver })
                }
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="simotel">سیموتل (Simotel PBX)</option>
                <option value="issabel">ایزابل / استریسک (Issabel)</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-slate-500">داخلی کارشناس (Extension)</label>
              <input
                type="text"
                dir="ltr"
                value={extension}
                onChange={(e) => updateIntegrationsConfig({ telephonyExtension: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>

          <div className="text-xs">
            <label className="mb-1 block text-[11px] text-slate-500">آدرس وب‌سرویس AMI / Event API</label>
            <input
              type="text"
              dir="ltr"
              value={serverUrl}
              onChange={(e) => updateIntegrationsConfig({ telephonyServerUrl: e.target.value })}
              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-[11px] dark:border-slate-700 dark:bg-slate-800"
            />
          </div>

          <div className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500 dark:bg-slate-800/40">
            آداپتور فعال: <span className="font-semibold text-slate-700 dark:text-slate-200">{adapter.displayName}</span>
            <span className="mx-1.5">·</span>
            <span dir="ltr" className="font-mono">{adapter.protocolLabel}</span>
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 lg:col-span-7 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-sm font-semibold">شماره‌گیری کلیک-به-تماس (Click-to-Call) و شبیه‌ساز تماس ورودی</h3>
          <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] text-slate-500">انتخاب مشتری</label>
              <select
                value={dialCustomerId}
                onChange={(e) => {
                  const id = e.target.value;
                  setDialCustomerId(id);
                  const found = state.customers.find((c) => c.id === id);
                  if (found) setDialPhone(found.phone);
                }}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="">شماره دلخواه</option>
                {state.customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({toFa(c.phone)})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-slate-500">شماره تماس مقصد / مبدا</label>
              <input
                type="text"
                dir="ltr"
                value={dialPhone}
                onChange={(e) => setDialPhone(e.target.value)}
                placeholder="09121110001"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono tabular-nums dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => startOutboundCall(dialPhone.trim() || '09121110001', dialCustomerId || undefined)}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
            >
              <PhoneOutgoing size={14} />
              تماس خروجی (Click-to-Call)
            </button>
            <button
              type="button"
              onClick={() => triggerIncomingCall(dialCustomerId || undefined, dialPhone.trim() || undefined)}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-300"
            >
              <PhoneIncoming size={14} />
              شبیه‌سازی پاپ‌آپ تماس ورودی
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 border-t border-slate-200 pt-3 text-xs sm:grid-cols-4 dark:border-slate-800">
            <div>
              <div className="text-[11px] text-slate-500">کل تماس‌ها</div>
              <div className="mt-0.5 font-bold tabular-nums">{toFa(stats.total)}</div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500">پاسخ‌داده‌شده</div>
              <div className="mt-0.5 font-bold tabular-nums text-emerald-600">{toFa(stats.answered)}</div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500">بی‌پاسخ (Missed)</div>
              <div className="mt-0.5 font-bold tabular-nums text-rose-600">{toFa(stats.missed)}</div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500">میانگین مکالمه</div>
              <div className="mt-0.5 font-bold tabular-nums">{formatDuration(stats.avgDur)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Call Log + Recording Player */}
      <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <h3 className="text-sm font-semibold">دفتر ثبت تماس‌ها و آرشیو فایل ضبط‌شده ({toFa(filteredCalls.length)})</h3>
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 text-xs dark:bg-slate-800">
            {(
              [
                ['all', 'همه'],
                ['inbound', 'ورودی'],
                ['outbound', 'خروجی'],
                ['missed', 'بی‌پاسخ'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setDirFilter(k)}
                className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                  dirFilter === k
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {filteredCalls.length === 0 ? (
            <p className="p-8 text-center text-xs text-slate-500">تماسی در این فیلتر ثبت نشده است.</p>
          ) : (
            filteredCalls.map((call) => {
              const st = CALL_STATUS_LABELS[call.status];
              const isPlaying = playingCallId === call.id;
              const recMeta = adapter.getRecordingMeta(call);
              return (
                <div key={call.id} className="space-y-2 p-4 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {call.direction === 'inbound' ? (
                        call.status === 'missed' ? (
                          <PhoneMissed size={15} className="text-rose-500" />
                        ) : (
                          <PhoneIncoming size={15} className="text-sky-600" />
                        )
                      ) : (
                        <PhoneOutgoing size={15} className="text-emerald-600" />
                      )}
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {call.customerName}
                      </span>
                      <span className="font-mono tabular-nums text-slate-500" dir="ltr">
                        {toFa(call.phone)}
                      </span>
                      <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${st.cls}`}>
                        {st.label}
                      </span>
                      <span className="text-[11px] tabular-nums text-slate-400">
                        داخلی {toFa(call.extension)} · کارشناس: {call.agentName} · مدت: {formatDuration(call.durationSec)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="tabular-nums text-[11px] text-slate-400">
                        {formatJalaliDateTime(call.startedAt)}
                      </span>
                      <button
                        type="button"
                        onClick={() => startOutboundCall(call.phone, call.customerId)}
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                      >
                        <PhoneCall size={12} />
                        تماس مجدد
                      </button>
                    </div>
                  </div>

                  {call.notes && (
                    <p className="text-slate-600 dark:text-slate-300">{call.notes}</p>
                  )}

                  {recMeta.available && (
                    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 dark:border-slate-800 dark:bg-slate-800/40">
                      <button
                        type="button"
                        onClick={() => setPlayingCallId(isPlaying ? null : call.id)}
                        className="inline-flex items-center gap-1 rounded bg-indigo-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-indigo-700"
                      >
                        {isPlaying ? <Pause size={12} /> : <Play size={12} />}
                        {isPlaying ? 'توقف پخش' : 'پخش صدای ضبط‌شده'}
                      </button>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                        <div
                          className="h-full bg-indigo-600 transition-all"
                          style={{ width: `${isPlaying ? playProgress : 0}%` }}
                        />
                      </div>
                      <span className="inline-flex items-center gap-1 font-mono text-[10px] text-slate-500" dir="ltr">
                        <Volume2 size={12} />
                        {recMeta.sampleUrlLabel} ({recMeta.codec})
                      </span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
