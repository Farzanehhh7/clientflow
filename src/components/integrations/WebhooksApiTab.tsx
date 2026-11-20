import { useMemo, useState } from 'react';
import {
  Check,
  Code2,
  Copy,
  Download,
  KeyRound,
  Play,
  Plus,
  Send,
  Trash2,
  Webhook,
} from 'lucide-react';
import {
  computeSyncHmacPreview,
  generateClientFlowOpenApiSpec,
} from '../../services/providers/webhookAndOpenApi';
import { useClientFlow } from '../../store/useClientFlowStore';
import { formatJalaliDateTime, toFa } from '../../utils/jalali';

const AVAILABLE_EVENTS = [
  'customer.created',
  'lead.created',
  'order.created',
  'order.shipped',
  'invoice.paid',
  'ticket.created',
  'call.ended',
];

export function WebhooksApiTab() {
  const {
    state,
    addWebhookEndpoint,
    toggleWebhookEndpoint,
    deleteWebhookEndpoint,
    testFireWebhookEndpoint,
    fireWebhookTrigger,
    pushToast,
  } = useClientFlow();

  const endpoints = state.webhookEndpoints ?? [];
  const webhookLogs = state.webhookLogs ?? [];

  // Outgoing endpoint form
  const [epName, setEpName] = useState('');
  const [epUrl, setEpUrl] = useState('https://api.example.ir/hooks/clientflow');
  const [epSecret, setEpSecret] = useState('whsec_live_81f90c22');
  const [epEvents, setEpEvents] = useState<string[]>(['order.created', 'invoice.paid']);

  // Incoming webhook simulator
  const [incTopic, setIncTopic] = useState('lead_captured');
  const [incCustId, setIncCustId] = useState(state.customers[0]?.id ?? '');
  const [incPayload, setIncPayload] = useState('{"source":"woocommerce","orderNo":"WC-9042","amount":1250000}');
  const [incSecret, setIncSecret] = useState('whsec_cf_incoming_test');

  // API Playground
  const [apiMethod, setApiMethod] = useState<'GET' | 'POST'>('GET');
  const [apiPath, setApiPath] = useState('/customers');
  const [apiBody, setApiBody] = useState('{\n  "name": "مشتری تست API",\n  "phone": "09128889900",\n  "source": "REST API"\n}');
  const [apiResponse, setApiResponse] = useState<string>('');
  const [copiedSpec, setCopiedSpec] = useState(false);

  const openApiSpec = useMemo(
    () => generateClientFlowOpenApiSpec('https://api.clientflow.ir/v1'),
    [],
  );

  const incomingHmacPreview = useMemo(
    () => computeSyncHmacPreview(incSecret, incPayload),
    [incSecret, incPayload],
  );

  const handleCreateEndpoint = (e: React.FormEvent) => {
    e.preventDefault();
    if (!epName.trim() || !epUrl.trim()) return;
    addWebhookEndpoint({
      name: epName.trim(),
      url: epUrl.trim(),
      secret: epSecret.trim(),
      events: epEvents,
    });
    setEpName('');
  };

  const toggleEpEvent = (ev: string) => {
    setEpEvents((prev) => (prev.includes(ev) ? prev.filter((x) => x !== ev) : [...prev, ev]));
  };

  const runApiPlayground = () => {
    let result: unknown;
    if (apiMethod === 'GET') {
      switch (apiPath) {
        case '/customers':
          result = { count: state.customers.length, data: state.customers.slice(0, 3) };
          break;
        case '/leads':
          result = { count: state.leads.length, data: state.leads.slice(0, 3) };
          break;
        case '/orders':
          result = { count: state.orders.length, data: state.orders.slice(0, 3) };
          break;
        case '/invoices':
          result = { count: state.invoices.length, data: state.invoices.slice(0, 3) };
          break;
        case '/tickets':
          result = { count: state.tickets.length, data: state.tickets.slice(0, 3) };
          break;
        case '/voip/calls':
          result = { count: (state.callLogs ?? []).length, data: (state.callLogs ?? []).slice(0, 3) };
          break;
        default:
          result = { ok: true };
      }
    } else {
      let parsed: unknown = {};
      try {
        parsed = JSON.parse(apiBody);
      } catch {
        parsed = { raw: apiBody };
      }
      result = {
        status: 201,
        requestId: `req_${Date.now().toString(36)}`,
        echoPayload: parsed,
        message: 'Simulated 201 Created response according to OpenAPI 3.0 contract.',
      };
    }
    setApiResponse(JSON.stringify(result, null, 2));
  };

  const downloadOpenApi = () => {
    const blob = new Blob([JSON.stringify(openApiSpec, null, 2)], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'clientflow-openapi-3.0.json';
    a.click();
    URL.revokeObjectURL(url);
    pushToast('فایل OpenAPI JSON دانلود شد.');
  };

  return (
    <div className="space-y-5">
      {/* Outgoing Webhooks + Incoming Simulator */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        {/* Outgoing Endpoints */}
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 xl:col-span-7 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Webhook size={16} className="text-indigo-500" />
              وب‌هوک‌های خروجی با امضای HMAC-SHA256
            </h3>
            <span className="text-[11px] text-slate-400">هدر: X-ClientFlow-Signature</span>
          </div>

          <form onSubmit={handleCreateEndpoint} className="space-y-2.5 rounded-lg border border-slate-200 p-3 text-xs dark:border-slate-800">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <input
                type="text"
                required
                value={epName}
                onChange={(e) => setEpName(e.target.value)}
                placeholder="عنوان اندپوینت..."
                className="rounded border border-slate-200 bg-white px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-800"
              />
              <input
                type="url"
                required
                dir="ltr"
                value={epUrl}
                onChange={(e) => setEpUrl(e.target.value)}
                className="rounded border border-slate-200 bg-white px-2.5 py-1.5 font-mono dark:border-slate-700 dark:bg-slate-800"
              />
              <input
                type="text"
                dir="ltr"
                value={epSecret}
                onChange={(e) => setEpSecret(e.target.value)}
                placeholder="Secret Key"
                className="rounded border border-slate-200 bg-white px-2.5 py-1.5 font-mono dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1.5">
                {AVAILABLE_EVENTS.map((ev) => (
                  <button
                    key={ev}
                    type="button"
                    onClick={() => toggleEpEvent(ev)}
                    className={`rounded border px-2 py-0.5 font-mono text-[10px] ${
                      epEvents.includes(ev)
                        ? 'border-indigo-600 bg-indigo-600 text-white'
                        : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {ev}
                  </button>
                ))}
              </div>
              <button
                type="submit"
                className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 font-medium text-white hover:bg-indigo-700"
              >
                <Plus size={13} />
                افزودن اندپوینت
              </button>
            </div>
          </form>

          <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
            {endpoints.map((ep) => (
              <div key={ep.id} className="space-y-1.5 p-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">{ep.name}</span>
                    <span className="mx-2 font-mono text-[11px] text-indigo-600 dark:text-indigo-400" dir="ltr">
                      {ep.url}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => testFireWebhookEndpoint(ep.id, ep.events[0] ?? 'order.created')}
                      className="inline-flex items-center gap-1 rounded border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-medium text-indigo-700 hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-300"
                    >
                      <Send size={11} />
                      ارسال تست + HMAC
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleWebhookEndpoint(ep.id)}
                      className={`rounded border px-2 py-1 text-[11px] ${
                        ep.active ? 'border-emerald-200 text-emerald-700 dark:border-emerald-900 dark:text-emerald-300' : 'border-slate-200 text-slate-400'
                      }`}
                    >
                      {ep.active ? 'فعال' : 'متوقف'}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteWebhookEndpoint(ep.id)}
                      className="p-1 text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                  <span className="inline-flex items-center gap-1 font-mono" dir="ltr">
                    <KeyRound size={11} />
                    {ep.secret}
                  </span>
                  <span>·</span>
                  <span>رویدادها: {ep.events.join(', ')}</span>
                </div>
                {ep.lastSignature && (
                  <div className="truncate rounded bg-slate-50 px-2 py-1 font-mono text-[10px] text-slate-600 dark:bg-slate-800/60 dark:text-slate-300" dir="ltr">
                    X-ClientFlow-Signature: {ep.lastSignature}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Incoming Simulator */}
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 xl:col-span-5 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-sm font-semibold">شبیه‌ساز وب‌هوک ورودی (Incoming Webhook)</h3>
          <div className="space-y-2.5 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-[11px] text-slate-500">موضوع (Topic)</label>
                <input
                  type="text"
                  dir="ltr"
                  value={incTopic}
                  onChange={(e) => setIncTopic(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-slate-500">مشتری مرتبط</label>
                <select
                  value={incCustId}
                  onChange={(e) => setIncCustId(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-800"
                >
                  {state.customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[11px] text-slate-500">Secret تأیید امضای ورودی</label>
              <input
                type="text"
                dir="ltr"
                value={incSecret}
                onChange={(e) => setIncSecret(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono dark:border-slate-700 dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] text-slate-500">بدنه JSON ورودی</label>
              <textarea
                rows={3}
                dir="ltr"
                value={incPayload}
                onChange={(e) => setIncPayload(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-[11px] dark:border-slate-700 dark:bg-slate-800"
              />
            </div>

            <div className="truncate rounded bg-slate-50 px-2.5 py-1.5 font-mono text-[10px] text-slate-600 dark:bg-slate-800/60 dark:text-slate-300" dir="ltr">
              Signature: {incomingHmacPreview}
            </div>

            <button
              type="button"
              onClick={() => {
                const count = fireWebhookTrigger(incTopic, incCustId, incPayload);
                pushToast(`وب‌هوک ورودی «${incTopic}» دریافت و ${toFa(count)} قانون اجرا شد.`);
              }}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 font-semibold text-white hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-700"
            >
              <Play size={13} />
              شبیه‌سازی دریافت درخواست POST Webhook
            </button>
          </div>

          <div className="border-t border-slate-200 pt-3 dark:border-slate-800">
            <div className="mb-2 text-xs font-semibold">آخرین لاگ‌های Webhook ({toFa(webhookLogs.length)})</div>
            <div className="max-h-40 space-y-1.5 overflow-y-auto text-[11px]">
              {webhookLogs.slice(0, 6).map((log) => (
                <div key={log.id} className="rounded border border-slate-200 p-2 dark:border-slate-800">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-semibold" dir="ltr">
                      [{log.direction}] {log.urlOrTopic}
                    </span>
                    <span className="tabular-nums text-emerald-600">{toFa(log.statusCode)}</span>
                  </div>
                  {log.hmacSignature && (
                    <div className="truncate font-mono text-[10px] text-slate-400" dir="ltr">
                      {log.hmacSignature}
                    </div>
                  )}
                  <div className="text-[10px] text-slate-400">{formatJalaliDateTime(log.at)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* REST API Playground & OpenAPI 3.0 Spec */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 xl:col-span-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Code2 size={16} className="text-indigo-500" />
              زمین آزمایش REST API Playground
            </h3>
            <span className="font-mono text-[11px] text-slate-400" dir="ltr">
              Bearer Token Auth
            </span>
          </div>

          <div className="flex flex-wrap gap-2 text-xs" dir="ltr">
            <select
              value={apiMethod}
              onChange={(e) => setApiMethod(e.target.value as 'GET' | 'POST')}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 font-mono font-bold dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
            </select>
            <select
              value={apiPath}
              onChange={(e) => setApiPath(e.target.value)}
              className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="/customers">/v1/customers</option>
              <option value="/leads">/v1/leads</option>
              <option value="/orders">/v1/orders</option>
              <option value="/invoices">/v1/invoices</option>
              <option value="/tickets">/v1/tickets</option>
              <option value="/voip/calls">/v1/voip/calls</option>
            </select>
            <button
              type="button"
              onClick={runApiPlayground}
              className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700"
            >
              <Play size={13} />
              Execute
            </button>
          </div>

          {apiMethod === 'POST' && (
            <textarea
              rows={4}
              dir="ltr"
              value={apiBody}
              onChange={(e) => setApiBody(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white p-2.5 font-mono text-[11px] dark:border-slate-700 dark:bg-slate-800"
            />
          )}

          <pre
            dir="ltr"
            className="max-h-64 overflow-auto rounded-lg border border-slate-200 bg-slate-950 p-3 font-mono text-[11px] text-emerald-300 dark:border-slate-800"
          >
            {apiResponse || '// Click Execute to run a live REST simulation against current CRM state'}
          </pre>
        </div>

        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 xl:col-span-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">قرارداد OpenAPI 3.0.3 (تولیدشده از TypeScript Models)</h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(JSON.stringify(openApiSpec, null, 2));
                  setCopiedSpec(true);
                  window.setTimeout(() => setCopiedSpec(false), 1800);
                }}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs hover:bg-slate-50 dark:border-slate-700"
              >
                {copiedSpec ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                {copiedSpec ? 'کپی شد' : 'کپی JSON'}
              </button>
              <button
                type="button"
                onClick={downloadOpenApi}
                className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white dark:bg-indigo-600"
              >
                <Download size={13} />
                openapi.json
              </button>
            </div>
          </div>

          <pre
            dir="ltr"
            className="max-h-72 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-[11px] text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300"
          >
            {JSON.stringify(openApiSpec, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}
