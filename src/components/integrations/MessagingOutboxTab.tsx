import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  MessageSquare,
  RefreshCw,
  Send,
  Smartphone,
  XCircle,
} from 'lucide-react';
import { getChatProvider, getSmsProvider } from '../../services/providers/messagingAdapters';
import { useClientFlow } from '../../store/useClientFlowStore';
import type { ChatProviderDriver, SmsProviderDriver } from '../../types';
import { formatJalaliDateTime, formatToman, toFa } from '../../utils/jalali';

export function MessagingOutboxTab() {
  const {
    state,
    updateIntegrationsConfig,
    sendViaSmsAdapter,
    sendViaChatAdapter,
    simulateOutboxDlr,
    retryNotification,
    processNotificationRetries,
  } = useClientFlow();

  const cfg = state.integrationsConfig;
  const smsDriver = cfg?.smsDriver ?? 'kavenegar';
  const chatDriver = cfg?.chatDriver ?? 'eitaa';
  const smsAdapter = getSmsProvider(smsDriver);
  const chatAdapter = getChatProvider(chatDriver);

  const [testMode, setTestMode] = useState<'sms' | 'chat'>('sms');
  const [custId, setCustId] = useState(state.customers[0]?.id ?? '');
  const [body, setBody] = useState('سلام، یادآوری و اطلاع‌رسانی وضعیت پرونده شما از پنل یکپارچه ClientFlow.');
  const [channelFilter, setChannelFilter] = useState<string>('all');

  const filteredOutbox = useMemo(() => {
    return state.outbox.filter((m) => {
      if (channelFilter === 'all') return true;
      if (channelFilter === 'eitaa' || channelFilter === 'bale') return m.providerCode === channelFilter;
      return m.channel === channelFilter;
    });
  }, [state.outbox, channelFilter]);

  const handleQuickSend = (e: React.FormEvent) => {
    e.preventDefault();
    const cust = state.customers.find((c) => c.id === custId);
    if (!cust || !body.trim()) return;
    if (testMode === 'sms') {
      sendViaSmsAdapter({
        driver: smsDriver,
        to: cust.phone,
        body: body.trim(),
        customerId: cust.id,
        customerName: cust.name,
      });
    } else {
      sendViaChatAdapter({
        driver: chatDriver,
        to: cust.phone,
        body: body.trim(),
        customerId: cust.id,
        customerName: cust.name,
      });
    }
  };

  return (
    <div className="space-y-5">
      {/* Adapters Config Grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* ISmsProvider Card */}
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Smartphone size={16} className="text-indigo-500" />
              آداپتور پیامک (ISmsProvider)
            </div>
            <span className="text-xs font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
              اعتبار شبیه‌سازی: {formatToman(cfg?.smsCreditToman ?? 0)}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2.5 text-xs sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] text-slate-500">اپراتور پیامک</label>
              <select
                value={smsDriver}
                onChange={(e) => updateIntegrationsConfig({ smsDriver: e.target.value as SmsProviderDriver })}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="kavenegar">کاوه‌نگار (Kavenegar)</option>
                <option value="melipayamak">ملی‌پیامک (MeliPayamak)</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-slate-500">سرشماره ارسال</label>
              <input
                type="text"
                dir="ltr"
                value={cfg?.smsSenderLine ?? '10008663'}
                onChange={(e) => updateIntegrationsConfig({ smsSenderLine: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>

          <div className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500 dark:bg-slate-800/40">
            <div>آداپتور فعال: {smsAdapter.displayName}</div>
            <div className="mt-0.5 truncate font-mono" dir="ltr">
              {smsAdapter.endpointHint}
            </div>
          </div>
        </div>

        {/* IChatProvider Card */}
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <MessageSquare size={16} className="text-emerald-500" />
              آداپتور پیام‌رسان‌ها (IChatProvider)
            </div>
            <span className="font-mono text-[11px] text-slate-500" dir="ltr">
              {cfg?.chatBotName ?? '@ClientFlowBot'}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2.5 text-xs sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] text-slate-500">پلتفرم پیام‌رسان</label>
              <select
                value={chatDriver}
                onChange={(e) => updateIntegrationsConfig({ chatDriver: e.target.value as ChatProviderDriver })}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="whatsapp">واتساپ (WhatsApp Cloud)</option>
                <option value="eitaa">ایتا (Eitaa Bot API)</option>
                <option value="bale">بله (Bale Bot API)</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-slate-500">شناسه ربات / شماره تجاری</label>
              <input
                type="text"
                dir="ltr"
                value={cfg?.chatBotName ?? '@ClientFlowClinicBot'}
                onChange={(e) => updateIntegrationsConfig({ chatBotName: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>

          <div className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500 dark:bg-slate-800/40">
            <div>آداپتور فعال: {chatAdapter.displayName}</div>
            <div className="mt-0.5 truncate font-mono" dir="ltr">
              {chatAdapter.endpointHint}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Test Send via Adapter */}
      <form
        onSubmit={handleQuickSend}
        className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 text-xs dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">تست ارسال مستقیم از طریق آداپتور</h3>
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setTestMode('sms')}
              className={`rounded-md px-2.5 py-1 font-medium ${
                testMode === 'sms' ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100' : 'text-slate-500'
              }`}
            >
              ISmsProvider ({smsDriver})
            </button>
            <button
              type="button"
              onClick={() => setTestMode('chat')}
              className={`rounded-md px-2.5 py-1 font-medium ${
                testMode === 'chat' ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100' : 'text-slate-500'
              }`}
            >
              IChatProvider ({chatDriver})
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <select
            value={custId}
            onChange={(e) => setCustId(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 dark:border-slate-700 dark:bg-slate-800"
          >
            {state.customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({toFa(c.phone)})
              </option>
            ))}
          </select>
          <input
            type="text"
            required
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="متن پیام..."
            className="sm:col-span-2 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700"
          >
            <Send size={14} />
            ارسال آزمایشی به Outbox
          </button>
        </div>
      </form>

      {/* Outbox & Delivery Report Simulation */}
      <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <h3 className="text-sm font-semibold">صف خروجی پیام‌ها (Outbox) و شبیه‌ساز گزارش تحویل (DLR)</h3>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="all">همه کانال‌ها ({toFa(state.outbox.length)})</option>
              <option value="sms">پیامک (Kavenegar / MeliPayamak)</option>
              <option value="whatsapp">واتساپ</option>
              <option value="eitaa">ایتا (Eitaa)</option>
              <option value="bale">بله (Bale)</option>
              <option value="email">ایمیل</option>
            </select>
            <button
              type="button"
              onClick={processNotificationRetries}
              className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-300"
            >
              <RefreshCw size={13} />
              اجرای چرخه Retry
            </button>
          </div>
        </div>

        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {filteredOutbox.slice(0, 25).map((m) => (
            <div key={m.id} className="space-y-2 p-4 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] uppercase dark:bg-slate-800">
                    {m.providerCode ?? m.channel}
                  </span>
                  <span className="font-semibold">{m.customerName ?? 'مشتری'}</span>
                  <span className="tabular-nums text-slate-500" dir="ltr">
                    {toFa(m.to)}
                  </span>
                  {m.providerMessageId && (
                    <span className="font-mono text-[11px] text-indigo-600 dark:text-indigo-400" dir="ltr">
                      #{m.providerMessageId}
                    </span>
                  )}
                  <span
                    className={`rounded px-2 py-0.5 text-[11px] font-medium ${
                      m.deliveryStatus === 'delivered'
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                        : m.deliveryStatus === 'failed' || m.deliveryStatus === 'dead_letter'
                          ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                          : 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300'
                    }`}
                  >
                    {m.deliveryStatus ?? 'sent'}
                  </span>
                </div>
                <span className="tabular-nums text-slate-400">{formatJalaliDateTime(m.at)}</span>
              </div>

              <p className="text-slate-700 dark:text-slate-300">{m.body}</p>
              {m.lastError && <p className="text-[11px] text-rose-600 dark:text-rose-400">{m.lastError}</p>}

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => simulateOutboxDlr(m.id, 'delivered')}
                  className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                >
                  <CheckCircle2 size={12} />
                  شبیه‌سازی DLR: تحویل شد
                </button>
                <button
                  type="button"
                  onClick={() => simulateOutboxDlr(m.id, 'failed')}
                  className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-medium text-rose-700 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
                >
                  <XCircle size={12} />
                  شبیه‌سازی DLR: ناموفق
                </button>
                {m.deliveryStatus !== 'delivered' && (
                  <button
                    type="button"
                    onClick={() => retryNotification(m.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                  >
                    <RefreshCw size={12} />
                    ارسال مجدد فوری
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
