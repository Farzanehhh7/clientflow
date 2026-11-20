import type { PaymentTransaction } from '../../types';

export interface PaymentRequestInput {
  invoiceId: string;
  invoiceNo: string;
  amount: number;
  callbackUrl: string;
  description: string;
}

export interface PaymentRequestOutput {
  authority: string;
  redirectUrl: string;
  requestedAt: string;
}

export interface PaymentCallbackPayload {
  authority: string;
  status: 'OK' | 'NOK';
  gatewayRefPreview: string;
  receivedAt: string;
}

export interface PaymentVerifyOutput {
  verified: boolean;
  refId?: string;
  cardMasked?: string;
  errorCode?: string;
  errorMessage?: string;
  verifiedAt: string;
}

export interface IPaymentGatewayProvider {
  readonly gateway: PaymentTransaction['gateway'];
  readonly displayName: string;
  readonly merchantLabel: string;
  requestPayment(input: PaymentRequestInput): PaymentRequestOutput;
  handleCallback(authority: string, outcome: 'succeeded' | 'failed' | 'cancelled'): PaymentCallbackPayload;
  verifyPayment(
    callback: PaymentCallbackPayload,
    amount: number,
    cardMasked: string,
  ): PaymentVerifyOutput;
}

class SandboxPaymentAdapter implements IPaymentGatewayProvider {
  constructor(
    public readonly gateway: PaymentTransaction['gateway'],
    public readonly displayName: string,
    public readonly merchantLabel: string,
    private readonly baseRedirectUrl: string,
    private readonly authPrefix: string,
  ) {}

  requestPayment(input: PaymentRequestInput): PaymentRequestOutput {
    const authority = `${this.authPrefix}${String(Date.now()).slice(-8)}${Math.floor(100 + Math.random() * 899)}`;
    return {
      authority,
      redirectUrl: `${this.baseRedirectUrl}${authority}?amount=${input.amount}`,
      requestedAt: new Date().toISOString(),
    };
  }

  handleCallback(
    authority: string,
    outcome: 'succeeded' | 'failed' | 'cancelled',
  ): PaymentCallbackPayload {
    return {
      authority,
      status: outcome === 'succeeded' ? 'OK' : 'NOK',
      gatewayRefPreview: outcome === 'succeeded' ? `CB-${Math.floor(100000 + Math.random() * 899999)}` : 'CB-ERR',
      receivedAt: new Date().toISOString(),
    };
  }

  verifyPayment(
    callback: PaymentCallbackPayload,
    _amount: number,
    cardMasked: string,
  ): PaymentVerifyOutput {
    const now = new Date().toISOString();
    if (callback.status !== 'OK') {
      return {
        verified: false,
        errorCode: 'ERR_GATEWAY_VERIFY_FAILED',
        errorMessage: 'تراکنش در مرحله Callback یا تایید بانکی (Verify) رد شد.',
        verifiedAt: now,
      };
    }
    return {
      verified: true,
      refId: `${this.authPrefix}-REF-${Math.floor(10000000 + Math.random() * 89999999)}`,
      cardMasked,
      verifiedAt: now,
    };
  }
}

const GATEWAY_PROVIDERS: Record<PaymentTransaction['gateway'], IPaymentGatewayProvider> = {
  shaparak: new SandboxPaymentAdapter(
    'shaparak',
    'درگاه شاپرک (Sandbox)',
    'پذیرنده: 98412045',
    'https://sandbox.shaparak.ir/pg/StartPay/',
    'SHP',
  ),
  zarinpal: new SandboxPaymentAdapter(
    'zarinpal',
    'زرین‌پال (ZarinPal Sandbox)',
    'Merchant: cf-sandbox-zp',
    'https://sandbox.zarinpal.com/pg/StartPay/',
    'ZP',
  ),
  saman: new SandboxPaymentAdapter(
    'saman',
    'بانک سامان (SEP Sandbox)',
    'Terminal: 1148209',
    'https://sep.shaparak.ir/OnlinePG/SendToken?token=',
    'SEP',
  ),
};

export function getPaymentGatewayProvider(
  gateway: PaymentTransaction['gateway'],
): IPaymentGatewayProvider {
  return GATEWAY_PROVIDERS[gateway] ?? GATEWAY_PROVIDERS.shaparak;
}
