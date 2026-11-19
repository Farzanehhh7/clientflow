import type { NotificationChannel, OutboxMessage } from '../../types';

export interface NotificationSendPayload {
  to: string;
  channel: NotificationChannel;
  body: string;
  customerId?: string;
  customerName?: string;
  ruleId?: string;
  ruleName?: string;
  appointmentId?: string;
}

export interface NotificationProvider {
  readonly code: string;
  send(payload: NotificationSendPayload): OutboxMessage;
}

/** Simulated Outbox notification adapter (SMS / WhatsApp / Email / Push) */
export class MockOutboxNotificationProvider implements NotificationProvider {
  readonly code = 'mock_outbox_v1';

  send(payload: NotificationSendPayload): OutboxMessage {
    const nowIso = new Date().toISOString();
    return {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      to: payload.to,
      customerId: payload.customerId,
      customerName: payload.customerName,
      body: payload.body,
      channel: payload.channel,
      ruleId: payload.ruleId,
      ruleName: payload.ruleName,
      appointmentId: payload.appointmentId,
      deliveryStatus: 'sent',
      retryCount: 0,
      maxRetries: 3,
      at: nowIso,
    };
  }
}

export const notificationProvider: NotificationProvider = new MockOutboxNotificationProvider();
