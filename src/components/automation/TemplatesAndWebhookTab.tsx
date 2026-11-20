import { FileText, Plus, Send, Trash2, Webhook, Zap } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useClientFlow } from '../../store/useClientFlowStore';
import type { MessageTemplate, NotificationChannel, RuleTargetEntity } from '../../types';
import { countTodayChannelNotifications, renderRuleTemplate } from '../../utils/automationEngine';
import { formatJalaliDateTime, toFa } from '../../utils/jalali';

const CHANNEL_LABEL: Record<NotificationChannel, string> = {
  sms: 'پیامک (SMS)',
  whatsapp: 'واتساپ',
  email: 'ایمیل',
  push: 'اعلان Push',
  in_app: 'درون‌برنامه‌ای',
};

const CATEGORY_LABEL: Record<MessageTemplate['category'], string> = {
  appointment: 'نوبت و یادآوری',
  order: 'سفارش و ارسال',
  sales: 'فروش و پیش‌فاکتور',
  support: 'پشتیبانی و SLA',
  retention: 'بازگشت و وفاداری',
};

const TPL_VARS = [
  '{{customer.name}}',
  '{{customer.phone}}',
  '{{appointment.date}}',
  '{{appointment.hour}}',
  '{{appointment.time}}',
  '{{appointment.service}}',
  '{{order.id}}',
  '{{order.total}}',
  '{{ticket.trackingCode}}',
  '{{businessName}}',
];

export function TemplatesAndWebhookTab() {
  const {
    state,
    addMessageTemplate,
    updateMessageTemplate,
    deleteMessageTemplate,
    fireWebhookTrigger,
    fireCustomEventTrigger,
  } = useClientFlow();

  const templates = state.messageTemplates ?? [];
  const webhookLogs = state.webhookLogs ?? [];

  const [editingId, setEditingId] = useState<string | null>(null);
  const [tplName, setTplName] = useState('');
  const [tplChannel, setTplChannel] = useState<NotificationChannel>('sms');
  const [tplCategory, setTplCategory] = useState<MessageTemplate['category']>('appointment');
  const [tplBody, setTplBody] = useState(
    'سلام {{customer.name}} عزیز، یادآوری نوبت {{appointment.service}} در تاریخ {{appointment.date}} ساعت {{appointment.hour}} از {{businessName}}.',
  );

  // Live Preview Context
  const [previewCustId, setPreviewCustId] = useState(state.customers[0]?.id ?? '');
  const [previewAptId, setPreviewAptId] = useState(state.appointments[0]?.id ?? '');
  const [previewOrdId, setPreviewOrdId] = useState(state.orders[0]?.id ?? '');

  // Webhook / Event Simulator
  const [whTopic, setWhTopic] = useState(
    state.rules.find((r) => r.triggerType === 'on_webhook')?.webhookTopic ?? 'lead_captured',
  );
  const [whCustId, setWhCustId] = useState(state.customers[0]?.id ?? '');
  const [whPayload, setWhPayload] = useState('رویداد وب‌هوک تستی از فرم وب‌سایت');
  const [evName, setEvName] = useState('vip_upgraded');
  const [evEntity, setEvEntity] = useState<RuleTargetEntity>('customer');
  const [evEntityId, setEvEntityId] = useState(state.customers[0]?.id ?? '');
  const [simFeedback, setSimFeedback] = useState('');

  const previewRendered = useMemo(() => {
    const cust = state.customers.find((c) => c.id === previewCustId);
    const apt = state.appointments.find((a) => a.id === previewAptId);
    const ord = state.orders.find((o) => o.id === previewOrdId);
    const svc = apt ? state.services.find((s) => s.id === apt.serviceId) : undefined;
    const orderTotal = ord ? ord.items.reduce((s, it) => s + it.qty * it.price, 0) - (ord.discountAmount ?? 0) : 0;

    const mergedEntity: Record<string, unknown> = {
      ...(ord ?? {}),
      ...(apt ?? {}),
      serviceName: svc?.name ?? 'خدمت / جلسه مشاوره',
      amount: orderTotal || 1850000,
      trackingCode: state.tickets[0]?.trackingCode ?? 'TK-4041',
      subject: state.tickets[0]?.subject ?? 'پیگیری پشتیبانی',
    };
    return renderRuleTemplate(tplBody, {
      customer: cust,
      entity: mergedEntity,
      businessName: state.settings.businessName,
    });
  }, [tplBody, previewCustId, previewAptId, previewOrdId, state]);

  const smsPages = Math.max(1, Math.ceil(previewRendered.length / 70));
  const todaySentOnCh = countTodayChannelNotifications(state.outbox, tplChannel);
  const channelCap = state.automationPolicy.channelDailyCaps?.[tplChannel];

  const handleSaveTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tplName.trim() || !tplBody.trim()) return;
    if (editingId) {
      updateMessageTemplate(editingId, {
        name: tplName.trim(),
        channel: tplChannel,
        category: tplCategory,
        body: tplBody.trim(),
      });
      setEditingId(null);
    } else {
      addMessageTemplate({
        name: tplName.trim(),
        channel: tplChannel,
        category: tplCategory,
        body: tplBody.trim(),
        pack: 'all',
      });
    }
    setTplName('');
  };

  const handleEditTemplate = (tpl: MessageTemplate) => {
    setEditingId(tpl.id);
    setTplName(tpl.name);
    setTplChannel(tpl.channel);
    setTplCategory(tpl.category);
    setTplBody(tpl.body);
  };

  return (
    <div className="space-y-5">
      {/* Templates Studio + Jalali Preview */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 xl:col-span-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <FileText size={16} className="text-indigo-500" />
              کتابخانه قالب پیام‌ها ({toFa(templates.length)})
            </div>
            {editingId && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setTplName('');
                }}
                className="text-xs text-slate-500 hover:underline"
              >
                لغو ویرایش
              </button>
            )}
          </div>

          <div className="max-h-96 divide-y divide-slate-200 overflow-y-auto rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
            {templates.length === 0 ? (
              <p className="p-6 text-center text-xs text-slate-400">قالبی ثبت نشده است.</p>
            ) : (
              templates.map((tpl) => (
                <div key={tpl.id} className="space-y-1.5 p-3 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleEditTemplate(tpl)}
                      className="font-semibold text-slate-900 hover:text-indigo-600 dark:text-slate-100 dark:hover:text-indigo-400"
                    >
                      {tpl.name}
                    </button>
                    <div className="flex items-center gap-1.5">
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] dark:bg-slate-800">
                        {CHANNEL_LABEL[tpl.channel]}
                      </span>
                      <button
                        type="button"
                        onClick={() => deleteMessageTemplate(tpl.id)}
                        className="text-rose-500 hover:text-rose-700"
                        title="حذف قالب"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                  <p className="line-clamp-2 text-[11px] text-slate-500 dark:text-slate-400">{tpl.body}</p>
                  <div className="text-[10px] text-slate-400">
                    دسته: {CATEGORY_LABEL[tpl.category]} · {formatJalaliDateTime(tpl.updatedAt)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <form
          onSubmit={handleSaveTemplate}
          className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 xl:col-span-7 dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {editingId ? 'ویرایش قالب انتخاب‌شده' : 'ساخت قالب پیام جدید با متغیرهای جلالی'}
            </h3>
            <span className="text-[11px] tabular-nums text-slate-500">
              مصرف امروز کانال: {toFa(todaySentOnCh)}
              {channelCap ? ` / سقف ${toFa(channelCap)}` : ' (بدون سقف کانالی)'}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-slate-500">نام قالب *</label>
              <input
                type="text"
                required
                value={tplName}
                onChange={(e) => setTplName(e.target.value)}
                placeholder="مثلاً: یادآوری نوبت فردا"
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block text-slate-500">کانال ارسال</label>
              <select
                value={tplChannel}
                onChange={(e) => setTplChannel(e.target.value as NotificationChannel)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-800"
              >
                {(Object.keys(CHANNEL_LABEL) as NotificationChannel[]).map((ch) => (
                  <option key={ch} value={ch}>
                    {CHANNEL_LABEL[ch]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-slate-500">دسته‌بندی</label>
              <select
                value={tplCategory}
                onChange={(e) => setTplCategory(e.target.value as MessageTemplate['category'])}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-800"
              >
                {(Object.keys(CATEGORY_LABEL) as MessageTemplate['category'][]).map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABEL[c]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex flex-wrap gap-1">
              {TPL_VARS.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setTplBody((prev) => `${prev} ${v}`.trim())}
                  className="rounded bg-slate-100 px-2 py-0.5 text-[11px] text-indigo-700 hover:bg-indigo-50 dark:bg-slate-800 dark:text-indigo-300"
                >
                  {v}
                </button>
              ))}
            </div>
            <textarea
              rows={3}
              required
              value={tplBody}
              onChange={(e) => setTplBody(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
            />
          </div>

          {/* Live Jalali Sample Preview */}
          <div className="space-y-2 rounded-lg border border-indigo-200 bg-indigo-50/40 p-3 text-xs dark:border-indigo-900/60 dark:bg-indigo-950/20">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-indigo-800 dark:text-indigo-300">
                پیش‌نمایش زنده با تاریخ جلالی و داده واقعی:
              </span>
              <span className="text-[11px] tabular-nums text-slate-500">
                {toFa(previewRendered.length)} کاراکتر ({toFa(smsPages)} صفحه پیامک)
              </span>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <select
                aria-label="مشتری نمونه"
                value={previewCustId}
                onChange={(e) => setPreviewCustId(e.target.value)}
                className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] dark:border-slate-700 dark:bg-slate-900"
              >
                {state.customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    مشتری: {c.name}
                  </option>
                ))}
              </select>
              <select
                aria-label="نوبت نمونه"
                value={previewAptId}
                onChange={(e) => setPreviewAptId(e.target.value)}
                className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] dark:border-slate-700 dark:bg-slate-900"
              >
                <option value="">نوبت پیش‌فرض</option>
                {state.appointments.map((a) => (
                  <option key={a.id} value={a.id}>
                    نوبت {a.id} ({formatJalaliDateTime(a.start)})
                  </option>
                ))}
              </select>
              <select
                aria-label="سفارش نمونه"
                value={previewOrdId}
                onChange={(e) => setPreviewOrdId(e.target.value)}
                className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] dark:border-slate-700 dark:bg-slate-900"
              >
                <option value="">سفارش پیش‌فرض</option>
                {state.orders.map((o) => (
                  <option key={o.id} value={o.id}>
                    سفارش {o.id}
                  </option>
                ))}
              </select>
            </div>
            <p className="rounded bg-white p-2.5 text-slate-800 dark:bg-slate-900 dark:text-slate-200">
              {previewRendered}
            </p>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700"
            >
              <Plus size={14} />
              {editingId ? 'ذخیره ویرایش قالب' : 'افزودن به کتابخانه قالب‌ها'}
            </button>
          </div>
        </form>
      </div>

      {/* Webhook & Custom Event Simulator + Logs */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 xl:col-span-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            <Webhook size={16} className="text-indigo-500" />
            شبیه‌ساز Webhook ورودی و رویداد سفارشی
          </div>
          {simFeedback && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
              {simFeedback}
            </div>
          )}

          <div className="space-y-2 rounded-lg border border-slate-200 p-3 text-xs dark:border-slate-800">
            <div className="font-semibold text-slate-700 dark:text-slate-200">تست محرک OnWebhook</div>
            <input
              type="text"
              dir="ltr"
              value={whTopic}
              onChange={(e) => setWhTopic(e.target.value)}
              placeholder="lead_captured"
              className="w-full rounded border border-slate-200 bg-white px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-800"
            />
            <select
              value={whCustId}
              onChange={(e) => setWhCustId(e.target.value)}
              className="w-full rounded border border-slate-200 bg-white px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-800"
            >
              {state.customers.map((c) => (
                <option key={c.id} value={c.id}>
                  مشتری: {c.name}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={whPayload}
              onChange={(e) => setWhPayload(e.target.value)}
              placeholder="خلاصه Payload..."
              className="w-full rounded border border-slate-200 bg-white px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-800"
            />
            <button
              type="button"
              onClick={() => {
                const count = fireWebhookTrigger(whTopic, whCustId, whPayload);
                setSimFeedback(
                  `وب‌هوک «${whTopic}» دریافت شد و روی ${toFa(count)} رکورد مطابق قوانین فعال اجرا گردید.`,
                );
              }}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 font-medium text-white hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-700"
            >
              <Send size={13} />
              شبیه‌سازی دریافت Webhook
            </button>
          </div>

          <div className="space-y-2 rounded-lg border border-slate-200 p-3 text-xs dark:border-slate-800">
            <div className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-200">
              <Zap size={13} className="text-amber-500" />
              تست محرک OnEvent
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                dir="ltr"
                value={evName}
                onChange={(e) => setEvName(e.target.value)}
                placeholder="vip_upgraded"
                className="rounded border border-slate-200 bg-white px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-800"
              />
              <select
                value={evEntity}
                onChange={(e) => setEvEntity(e.target.value as RuleTargetEntity)}
                className="rounded border border-slate-200 bg-white px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="customer">مشتری</option>
                <option value="order">سفارش</option>
                <option value="appointment">نوبت</option>
                <option value="opportunity">فرصت</option>
                <option value="ticket">تیکت</option>
              </select>
            </div>
            <input
              type="text"
              dir="ltr"
              value={evEntityId}
              onChange={(e) => setEvEntityId(e.target.value)}
              placeholder="شناسه رکورد (اختیاری)"
              className="w-full rounded border border-slate-200 bg-white px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-800"
            />
            <button
              type="button"
              onClick={() => {
                const count = fireCustomEventTrigger(evName, evEntity, evEntityId.trim() || undefined);
                setSimFeedback(`رویداد سفارشی «${evName}» منتشر شد (${toFa(count)} اقدام اجرا گردید).`);
              }}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 font-medium text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300"
            >
              انتشار رویداد سفارشی (OnEvent)
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 xl:col-span-7 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
            گزارش فراخوانی Webhookهای ورودی و خروجی ({toFa(webhookLogs.length)})
          </h3>
          {webhookLogs.length === 0 ? (
            <p className="py-12 text-center text-xs text-slate-400">هنوز ترافیک وب‌هوکی ثبت نشده است.</p>
          ) : (
            <div className="max-h-96 overflow-y-auto overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800">
                  <tr>
                    <th className="py-2">جهت</th>
                    <th className="py-2">موضوع / URL</th>
                    <th className="py-2">قانون مرتبط</th>
                    <th className="py-2">کد / تاخیر</th>
                    <th className="py-2">زمان</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {webhookLogs.map((w) => (
                    <tr key={w.id}>
                      <td className="py-2">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                            w.direction === 'incoming'
                              ? 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300'
                              : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300'
                          }`}
                        >
                          {w.direction === 'incoming' ? 'ورودی' : 'خروجی'}
                        </span>
                      </td>
                      <td className="py-2">
                        <div className="max-w-[200px] truncate font-medium text-slate-800 dark:text-slate-200" dir="ltr">
                          {w.urlOrTopic}
                        </div>
                        <div className="max-w-[220px] truncate text-[11px] text-slate-400">{w.payloadSummary}</div>
                      </td>
                      <td className="py-2 text-slate-600 dark:text-slate-300">{w.ruleName ?? '-'}</td>
                      <td className="py-2 tabular-nums">
                        <span className="text-emerald-600 dark:text-emerald-400">{toFa(w.statusCode)}</span> ·{' '}
                        {toFa(w.latencyMs)}ms
                      </td>
                      <td className="py-2 whitespace-nowrap tabular-nums text-slate-500">
                        {formatJalaliDateTime(w.at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
