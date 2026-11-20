import { useState } from 'react';
import {
  CreditCard,
  FileSpreadsheet,
  Globe,
  MessageSquare,
  PhoneCall,
  Webhook,
} from 'lucide-react';
import { AccountingExportTab } from '../components/integrations/AccountingExportTab';
import { EmbedWordPressTab } from '../components/integrations/EmbedWordPressTab';
import { MessagingOutboxTab } from '../components/integrations/MessagingOutboxTab';
import { PaymentGatewayTab } from '../components/integrations/PaymentGatewayTab';
import { TelephonyTab } from '../components/integrations/TelephonyTab';
import { WebhooksApiTab } from '../components/integrations/WebhooksApiTab';
import { useClientFlow } from '../store/useClientFlowStore';
import { toFa } from '../utils/jalali';

type IntegrationTabKey =
  | 'telephony'
  | 'messaging'
  | 'payment'
  | 'accounting'
  | 'webhooks_api'
  | 'embed_wp';

export function IntegrationsPage() {
  const { state } = useClientFlow();
  const [tab, setTab] = useState<IntegrationTabKey>('telephony');

  const tabs: { key: IntegrationTabKey; label: string; icon: typeof PhoneCall; count?: number }[] = [
    { key: 'telephony', label: 'تلفن ابری و VoIP', icon: PhoneCall, count: (state.callLogs ?? []).length },
    { key: 'messaging', label: 'پیامک و پیام‌رسان‌ها', icon: MessageSquare, count: state.outbox.length },
    { key: 'payment', label: 'درگاه پرداخت (Sandbox)', icon: CreditCard, count: state.paymentTransactions.length },
    { key: 'accounting', label: 'خروجی نرم‌افزار حسابداری', icon: FileSpreadsheet },
    { key: 'webhooks_api', label: 'وب‌هوک و REST API', icon: Webhook, count: (state.webhookEndpoints ?? []).length },
    { key: 'embed_wp', label: 'فرم سایت و راهنمای وردپرس', icon: Globe },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            مرکز یکپارچه‌سازی و آداپتورهای ارتباطی
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            اتصال شبیه‌سازی‌شده پشت اینترفیس‌های استاندارد (VoIP، پیامک کاوه‌نگار/ملی‌پیامک، ایتا/بله/واتساپ، شاپرک، سپیدار و API)
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-900">
        {tabs.map(({ key, label, icon: Icon, count }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
              tab === key
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
            }`}
          >
            <Icon size={14} />
            <span>{label}</span>
            {count !== undefined && (
              <span className="tabular-nums text-[11px] text-slate-400">({toFa(count)})</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'telephony' && <TelephonyTab />}
      {tab === 'messaging' && <MessagingOutboxTab />}
      {tab === 'payment' && <PaymentGatewayTab />}
      {tab === 'accounting' && <AccountingExportTab />}
      {tab === 'webhooks_api' && <WebhooksApiTab />}
      {tab === 'embed_wp' && <EmbedWordPressTab />}
    </div>
  );
}
