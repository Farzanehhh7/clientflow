import type {
  ChatProviderDriver,
  NotificationDeliveryStatus,
  OutboxMessage,
  SmsProviderDriver,
} from '../../types';

export interface SmsSendRequest {
  to: string;
  body: string;
  senderLine: string;
  customerId?: string;
  customerName?: string;
}

export interface DeliveryReportResult {
  providerMessageId: string;
  status: NotificationDeliveryStatus;
  carrierStatusCode: number;
  carrierNote: string;
  checkedAt: string;
}

export interface ISmsProvider {
  readonly driver: SmsProviderDriver;
  readonly displayName: string;
  readonly endpointHint: string;
  send(req: SmsSendRequest): OutboxMessage;
  getDeliveryReport(
    providerMessageId: string,
    targetOutcome?: 'delivered' | 'failed',
  ): DeliveryReportResult;
}

class KavenegarMockProvider implements ISmsProvider {
  readonly driver: SmsProviderDriver = 'kavenegar';
  readonly displayName = 'کاوه‌نگار (Kavenegar Sandbox)';
  readonly endpointHint = 'https://api.kavenegar.com/v1/{API_KEY}/sms/send.json';

  send(req: SmsSendRequest): OutboxMessage {
    const msgId = `KVN-${Math.floor(10000000 + Math.random() * 89999999)}`;
    return {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      to: req.to,
      customerId: req.customerId,
      customerName: req.customerName,
      body: req.body,
      channel: 'sms',
      subChannel: 'sms',
      providerCode: 'kavenegar',
      providerMessageId: msgId,
      deliveryStatus: 'sent',
      retryCount: 0,
      maxRetries: 3,
      at: new Date().toISOString(),
    };
  }

  getDeliveryReport(
    providerMessageId: string,
    targetOutcome: 'delivered' | 'failed' = 'delivered',
  ): DeliveryReportResult {
    return {
      providerMessageId,
      status: targetOutcome,
      carrierStatusCode: targetOutcome === 'delivered' ? 10 : 14,
      carrierNote:
        targetOutcome === 'delivered'
          ? 'تحویل به گوشی مشترک (Kavenegar Status 10)'
          : 'شماره در لیست سیاه مخابرات یا خاموش (Kavenegar Status 14)',
      checkedAt: new Date().toISOString(),
    };
  }
}

class MeliPayamakMockProvider implements ISmsProvider {
  readonly driver: SmsProviderDriver = 'melipayamak';
  readonly displayName = 'ملی‌پیامک (MeliPayamak Sandbox)';
  readonly endpointHint = 'https://rest.payamak-panel.com/api/SendSMS/SendSMS';

  send(req: SmsSendRequest): OutboxMessage {
    const msgId = `MPY-${Math.floor(20000000 + Math.random() * 79999999)}`;
    return {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      to: req.to,
      customerId: req.customerId,
      customerName: req.customerName,
      body: req.body,
      channel: 'sms',
      subChannel: 'sms',
      providerCode: 'melipayamak',
      providerMessageId: msgId,
      deliveryStatus: 'sent',
      retryCount: 0,
      maxRetries: 3,
      at: new Date().toISOString(),
    };
  }

  getDeliveryReport(
    providerMessageId: string,
    targetOutcome: 'delivered' | 'failed' = 'delivered',
  ): DeliveryReportResult {
    return {
      providerMessageId,
      status: targetOutcome,
      carrierStatusCode: targetOutcome === 'delivered' ? 1 : 2,
      carrierNote:
        targetOutcome === 'delivered'
          ? 'رسیده به گوشی (MeliPayamak RetStatus=1)'
          : 'نرسیده به گوشی / خطای اپراتور (MeliPayamak RetStatus=2)',
      checkedAt: new Date().toISOString(),
    };
  }
}

export interface ChatSendRequest {
  to: string;
  body: string;
  botName: string;
  customerId?: string;
  customerName?: string;
}

export interface IChatProvider {
  readonly driver: ChatProviderDriver;
  readonly displayName: string;
  readonly endpointHint: string;
  send(req: ChatSendRequest): OutboxMessage;
  getDeliveryReport(
    providerMessageId: string,
    targetOutcome?: 'delivered' | 'failed',
  ): DeliveryReportResult;
}

class BaseChatMockProvider implements IChatProvider {
  constructor(
    public readonly driver: ChatProviderDriver,
    public readonly displayName: string,
    public readonly endpointHint: string,
    private readonly idPrefix: string,
  ) {}

  send(req: ChatSendRequest): OutboxMessage {
    const msgId = `${this.idPrefix}-${Math.floor(100000 + Math.random() * 899999)}`;
    return {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      to: req.to,
      customerId: req.customerId,
      customerName: req.customerName,
      body: req.body,
      channel: 'whatsapp',
      subChannel: this.driver,
      providerCode: this.driver,
      providerMessageId: msgId,
      deliveryStatus: 'sent',
      retryCount: 0,
      maxRetries: 3,
      at: new Date().toISOString(),
    };
  }

  getDeliveryReport(
    providerMessageId: string,
    targetOutcome: 'delivered' | 'failed' = 'delivered',
  ): DeliveryReportResult {
    return {
      providerMessageId,
      status: targetOutcome,
      carrierStatusCode: targetOutcome === 'delivered' ? 200 : 404,
      carrierNote:
        targetOutcome === 'delivered'
          ? `پیام در ${this.displayName} تحویل و مشاهده شد (Read Receipt)`
          : `حساب کاربری مقصد در ${this.displayName} یافت نشد`,
      checkedAt: new Date().toISOString(),
    };
  }
}

const SMS_PROVIDERS: Record<SmsProviderDriver, ISmsProvider> = {
  kavenegar: new KavenegarMockProvider(),
  melipayamak: new MeliPayamakMockProvider(),
};

const CHAT_PROVIDERS: Record<ChatProviderDriver, IChatProvider> = {
  whatsapp: new BaseChatMockProvider(
    'whatsapp',
    'واتساپ بیزینس (WhatsApp Cloud API)',
    'https://graph.facebook.com/v19.0/{PHONE_ID}/messages',
    'WAB',
  ),
  eitaa: new BaseChatMockProvider(
    'eitaa',
    'پیام‌رسان ایتا (Eitaa Yar Bot)',
    'https://eitaayar.ir/api/{BOT_TOKEN}/sendMessage',
    'EIT',
  ),
  bale: new BaseChatMockProvider(
    'bale',
    'پیام‌رسان بله (Bale Bot API)',
    'https://tapi.bale.ai/bot{TOKEN}/sendMessage',
    'BAL',
  ),
};

export function getSmsProvider(driver: SmsProviderDriver): ISmsProvider {
  return SMS_PROVIDERS[driver] ?? SMS_PROVIDERS.kavenegar;
}

export function getChatProvider(driver: ChatProviderDriver): IChatProvider {
  return CHAT_PROVIDERS[driver] ?? CHAT_PROVIDERS.whatsapp;
}
