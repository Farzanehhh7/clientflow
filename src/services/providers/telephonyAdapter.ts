import type {
  CallLogEntry,
  Customer,
  TelephonyProviderDriver,
} from '../../types';

export interface DialRequest {
  phone: string;
  customerId?: string;
  customerName: string;
  agentName: string;
  extension: string;
}

export interface IncomingCallEvent {
  callId: string;
  phone: string;
  customer?: Customer;
  customerName: string;
  extension: string;
  providerDriver: TelephonyProviderDriver;
  ringingSince: string;
}

export interface RecordingMetadata {
  available: boolean;
  codec: string;
  sampleUrlLabel: string;
  durationSec: number;
}

export interface ITelephonyProvider {
  readonly driver: TelephonyProviderDriver;
  readonly displayName: string;
  readonly protocolLabel: string;
  dial(req: DialRequest): CallLogEntry;
  buildIncomingCall(
    phone: string,
    extension: string,
    customer?: Customer,
  ): IncomingCallEvent;
  getRecordingMeta(entry: CallLogEntry): RecordingMetadata;
}

class MockVoipProvider implements ITelephonyProvider {
  constructor(
    public readonly driver: TelephonyProviderDriver,
    public readonly displayName: string,
    public readonly protocolLabel: string,
  ) {}

  dial(req: DialRequest): CallLogEntry {
    return {
      id: `call_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      direction: 'outbound',
      customerId: req.customerId,
      customerName: req.customerName,
      phone: req.phone,
      agentName: req.agentName,
      extension: req.extension,
      providerDriver: this.driver,
      status: 'answered',
      durationSec: 0,
      recordingAvailable: true,
      recordingDurationSec: 0,
      startedAt: new Date().toISOString(),
    };
  }

  buildIncomingCall(
    phone: string,
    extension: string,
    customer?: Customer,
  ): IncomingCallEvent {
    return {
      callId: `inc_${Date.now()}`,
      phone,
      customer,
      customerName: customer?.name ?? 'تماس‌گیرنده ناشناس',
      extension,
      providerDriver: this.driver,
      ringingSince: new Date().toISOString(),
    };
  }

  getRecordingMeta(entry: CallLogEntry): RecordingMetadata {
    return {
      available: entry.recordingAvailable,
      codec: 'WAV · 8kHz Mono (G.711)',
      sampleUrlLabel: `/voip/recordings/${entry.id}.wav`,
      durationSec: entry.recordingDurationSec ?? entry.durationSec,
    };
  }
}

const TELEPHONY_PROVIDERS: Record<TelephonyProviderDriver, ITelephonyProvider> = {
  simotel: new MockVoipProvider(
    'simotel',
    'سیموتل (Simotel AMI / Webhook)',
    'SIP Trunk + Simotel Event API v4',
  ),
  issabel: new MockVoipProvider(
    'issabel',
    'ایزابل / استریسک (Issabel PBX)',
    'Asterisk ARI / AMI Bridge',
  ),
};

export function getTelephonyProvider(driver: TelephonyProviderDriver): ITelephonyProvider {
  return TELEPHONY_PROVIDERS[driver] ?? TELEPHONY_PROVIDERS.simotel;
}
