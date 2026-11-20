import { useMemo, useState } from 'react';
import { BookOpen, Check, CheckCircle2, Code2, Copy, Globe, Send } from 'lucide-react';
import { useClientFlow } from '../../store/useClientFlowStore';
import { toFa } from '../../utils/jalali';

export function EmbedWordPressTab() {
  const { state, submitLandingForm } = useClientFlow();

  const [selectedFormId, setSelectedFormId] = useState(state.landingForms[0]?.id ?? '');
  const [visitorName, setVisitorName] = useState('');
  const [visitorPhone, setVisitorPhone] = useState('');
  const [visitorEmail, setVisitorEmail] = useState('');
  const [visitorNote, setVisitorNote] = useState('');
  const [submitMessage, setSubmitMessage] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const selectedForm = state.landingForms.find((f) => f.id === selectedFormId) ?? state.landingForms[0];

  const embedSnippet = useMemo(() => {
    const slug = selectedForm?.slug ?? 'contact-lead';
    const formId = selectedForm?.id ?? 'lf_default';
    return `<!-- ClientFlow Embedded Lead Widget -->
<div id="clientflow-form-${slug}"></div>
<script src="https://cdn.clientflow.ir/embed/v1/widget.js"
  data-form-id="${formId}"
  data-utm-source="${selectedForm?.utmSource ?? 'website'}"
  data-utm-campaign="${selectedForm?.utmCampaign ?? 'organic'}"
  data-theme="light" async></script>`;
  }, [selectedForm]);

  const wpShortcode = `[clientflow_form id="${selectedForm?.id ?? 'lf1'}" source="wordpress" utm_medium="blog_sidebar"]`;

  const wpWooSnippet = `// wp-content/themes/your-theme/functions.php
add_action('woocommerce_order_status_completed', function($order_id) {
  $order = wc_get_order($order_id);
  $payload = wp_json_encode([
    'event' => 'woocomm_order_completed',
    'customerName' => $order->get_formatted_billing_full_name(),
    'phone' => $order->get_billing_phone(),
    'amount' => (int) $order->get_total(),
    'orderId' => (string) $order_id,
  ]);
  $signature = 'sha256=' . hash_hmac('sha256', $payload, CLIENTFLOW_WEBHOOK_SECRET);
  wp_remote_post('https://api.clientflow.ir/v1/webhooks/incoming', [
    'headers' => [
      'Content-Type' => 'application/json',
      'X-ClientFlow-Signature' => $signature,
    ],
    'body' => $payload,
  ]);
});`;

  const copyText = (key: string, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey(null), 1600);
  };

  const handleSimulatedEmbedSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedForm || !visitorName.trim() || !visitorPhone.trim()) return;
    const res = submitLandingForm(selectedForm.id, {
      name: visitorName.trim(),
      phone: visitorPhone.trim(),
      email: visitorEmail.trim() || undefined,
      notes: visitorNote.trim() || 'ثبت مستقیم از ویجت شبیه‌سازی‌شده سایت',
    });
    if (res.ok) {
      setSubmitMessage(`اطلاعات با موفقیت به CRM ارسال شد و سرنخ جدید با UTM=${selectedForm.utmSource} ثبت گردید.`);
      setVisitorName('');
      setVisitorPhone('');
      setVisitorEmail('');
      setVisitorNote('');
    }
  };

  return (
    <div className="space-y-5">
      {/* Live Website Embed Simulator */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 xl:col-span-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Code2 size={16} className="text-indigo-500" />
            تولید کد Embed فرم وب‌سایت
          </div>
          <div className="text-xs">
            <label className="mb-1 block text-[11px] text-slate-500">انتخاب فرم لندینگ</label>
            <select
              value={selectedFormId}
              onChange={(e) => {
                setSelectedFormId(e.target.value);
                setSubmitMessage('');
              }}
              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 dark:border-slate-700 dark:bg-slate-800"
            >
              {state.landingForms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.title} ({toFa(f.submissionsCount)} ورودی)
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-600 dark:text-slate-300">کد HTML / JavaScript قابل نصب</span>
              <button
                type="button"
                onClick={() => copyText('embed', embedSnippet)}
                className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-0.5 text-[11px] hover:bg-slate-50 dark:border-slate-700"
              >
                {copiedKey === 'embed' ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                {copiedKey === 'embed' ? 'کپی شد' : 'کپی کد'}
              </button>
            </div>
            <pre
              dir="ltr"
              className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-950 p-3 font-mono text-[11px] text-sky-300 dark:border-slate-800"
            >
              {embedSnippet}
            </pre>
          </div>
        </div>

        {/* Simulated External Website Browser Frame */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white xl:col-span-7 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-100 px-4 py-2 text-xs dark:border-slate-800 dark:bg-slate-800">
            <div className="flex items-center gap-2 font-mono text-[11px] text-slate-600 dark:text-slate-300" dir="ltr">
              <Globe size={13} className="text-indigo-500" />
              https://your-website.ir/consultation (Simulated External Page)
            </div>
            <span className="text-[11px] text-slate-500">پیش‌نمایش زنده فرم Embed</span>
          </div>

          <div className="p-5">
            <div className="mx-auto max-w-md space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/40">
              <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {selectedForm?.title ?? 'فرم دریافت مشاوره و ثبت‌نام'}
              </div>
              <p className="text-[11px] text-slate-500">
                این فرم مستقیماً از طریق اسکریپت Embed روی سایت شما نمایش داده می‌شود و با ارسال آن، سرنخ جدید در بخش فروش ClientFlow ایجاد می‌گردد.
              </p>

              {submitMessage && (
                <div className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                  <CheckCircle2 size={14} />
                  {submitMessage}
                </div>
              )}

              <form onSubmit={handleSimulatedEmbedSubmit} className="space-y-2.5 text-xs">
                <input
                  type="text"
                  required
                  value={visitorName}
                  onChange={(e) => setVisitorName(e.target.value)}
                  placeholder="نام و نام خانوادگی *"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
                />
                <input
                  type="text"
                  required
                  dir="ltr"
                  value={visitorPhone}
                  onChange={(e) => setVisitorPhone(e.target.value)}
                  placeholder="09120000000"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono dark:border-slate-700 dark:bg-slate-900"
                />
                <input
                  type="email"
                  dir="ltr"
                  value={visitorEmail}
                  onChange={(e) => setVisitorEmail(e.target.value)}
                  placeholder="email@example.ir (اختیاری)"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono dark:border-slate-700 dark:bg-slate-900"
                />
                <textarea
                  rows={2}
                  value={visitorNote}
                  onChange={(e) => setVisitorNote(e.target.value)}
                  placeholder="توضیحات یا سوال شما..."
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
                />
                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700"
                >
                  <Send size={13} />
                  ارسال آزمایشی فرم از وب‌سایت به CRM
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* WordPress & WooCommerce Integration Guide */}
      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <BookOpen size={16} className="text-indigo-500" />
          راهنمای اتصال افزونه وردپرس (WordPress) و فروشگاه ووکامرس (WooCommerce)
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 text-xs">
          <div className="space-y-2 rounded-lg border border-slate-200 p-3.5 dark:border-slate-800">
            <div className="font-bold text-slate-900 dark:text-slate-100">گام ۱: نصب و تنظیم API Key در وردپرس</div>
            <p className="leading-5 text-slate-600 dark:text-slate-300">
              افزونه <span className="font-mono">clientflow-crm-bridge.zip</span> را در بخش «افزونه‌ها ← افزودن» نصب کرده و آدرس Endpoint و کلید Bearer را در تنظیمات وردپرس وارد نمایید.
            </p>
            <div className="rounded bg-slate-50 p-2 font-mono text-[11px] dark:bg-slate-800/60" dir="ltr">
              API Base: https://api.clientflow.ir/v1
            </div>
          </div>

          <div className="space-y-2 rounded-lg border border-slate-200 p-3.5 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div className="font-bold text-slate-900 dark:text-slate-100">گام ۲: درج شورت‌کد فرم در صفحات و المنتور</div>
              <button
                type="button"
                onClick={() => copyText('wp_short', wpShortcode)}
                className="text-[11px] text-indigo-600 hover:underline"
              >
                {copiedKey === 'wp_short' ? 'کپی شد' : 'کپی شورت‌کد'}
              </button>
            </div>
            <p className="leading-5 text-slate-600 dark:text-slate-300">
              شورت‌کد زیر را در ویرایشگر گوتنبرگ، برگه تماس یا ویجت Shortcode المنتور قرار دهید تا سرنخ‌ها با پارامترهای UTM ثبت شوند:
            </p>
            <div className="overflow-x-auto rounded bg-slate-950 p-2 font-mono text-[11px] text-amber-300" dir="ltr">
              {wpShortcode}
            </div>
          </div>

          <div className="space-y-2 rounded-lg border border-slate-200 p-3.5 dark:border-slate-800">
            <div className="font-bold text-slate-900 dark:text-slate-100">گام ۳: وب‌هوک همگام‌سازی سفارش ووکامرس</div>
            <p className="leading-5 text-slate-600 dark:text-slate-300">
              در تنظیمات ووکامرس ← پیشرفته ← وب‌هوک‌ها، یک Webhook روی رویداد <span className="font-mono">Order updated</span> تعریف کنید یا از قلاب PHP زیر با امضای HMAC استفاده نمایید.
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              نمونه کد PHP هوک ووکامرس با امضای HMAC-SHA256
            </span>
            <button
              type="button"
              onClick={() => copyText('wp_php', wpWooSnippet)}
              className="inline-flex items-center gap-1 rounded border border-slate-200 px-2.5 py-1 text-[11px] hover:bg-slate-50 dark:border-slate-700"
            >
              {copiedKey === 'wp_php' ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
              {copiedKey === 'wp_php' ? 'کپی شد' : 'کپی PHP'}
            </button>
          </div>
          <pre
            dir="ltr"
            className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-950 p-3.5 font-mono text-[11px] text-slate-200 dark:border-slate-800"
          >
            {wpWooSnippet}
          </pre>
        </div>
      </div>
    </div>
  );
}
