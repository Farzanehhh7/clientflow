import type { AppState } from '../types';
import { DEFAULT_SECURITY_POLICY } from './security';

export const CURRENT_SCHEMA_VERSION = 4;

export type BackupEnvelope = {
  schemaVersion: number | string;
  exportedAt: string;
  tenantId?: string;
  tenantName?: string;
  data: Partial<AppState>;
};

export type MigrationResult =
  | {
      ok: true;
      fromVersion: number;
      toVersion: number;
      steps: string[];
      data: Partial<AppState>;
    }
  | {
      ok: false;
      error: string;
    };

function parseVersionNumber(rawVersion: unknown, payload: Record<string, unknown>): number {
  if (typeof rawVersion === 'number' && Number.isFinite(rawVersion)) return rawVersion;
  if (typeof rawVersion === 'string') {
    const parsed = parseFloat(rawVersion);
    if (Number.isFinite(parsed)) return Math.floor(parsed);
  }
  if (typeof payload.schemaVersion === 'number') return payload.schemaVersion;
  if (!payload.branches && !payload.customFieldDefs) return 1;
  if (!payload.roles && !payload.integrationsConfig) return 3;
  return 3;
}

export function migrateTenantBackup(rawJson: string): MigrationResult {
  try {
    const raw = JSON.parse(rawJson) as Record<string, unknown>;
    const envelope = raw as Partial<BackupEnvelope>;
    const payload = ((envelope.data && typeof envelope.data === 'object' ? envelope.data : raw) ??
      {}) as Record<string, unknown>;

    if (!payload || !Array.isArray(payload.customers)) {
      return {
        ok: false,
        error: 'فایل پشتیبان ساختار معتبر ClientFlow (آرایه مشتریان) را ندارد.',
      };
    }

    let version = parseVersionNumber(envelope.schemaVersion, payload);
    const fromVersion = version;
    const steps: string[] = [];

    // Deep-clone safely
    const working = JSON.parse(JSON.stringify(payload)) as Partial<AppState>;

    // Migration v1 -> v2: Normalize custom fields, branches & Jalali numbering
    if (version < 2) {
      working.customFieldDefs = Array.isArray(working.customFieldDefs) ? working.customFieldDefs : [];
      working.customEntityDefs = Array.isArray(working.customEntityDefs) ? working.customEntityDefs : [];
      working.branches =
        Array.isArray(working.branches) && working.branches.length > 0
          ? working.branches
          : [{ id: 'br1', name: 'شعبه مرکزی', code: 'HQ-01', city: 'تهران', active: true }];
      working.customers = (working.customers ?? []).map((c) => ({
        ...c,
        customFields: c.customFields ?? {},
        tags: Array.isArray(c.tags) ? c.tags : [],
        isDeleted: Boolean(c.isDeleted),
      }));
      steps.push('v1 → v2: نرمال‌سازی ساختار فیلدهای سفارشی، شعب و وضعیت حذف نرم مشتریان');
      version = 2;
    }

    // Migration v2 -> v3: Normalize automation, marketing, workflows, integrations & reports
    if (version < 3) {
      working.workflowDefinitions = Array.isArray(working.workflowDefinitions) ? working.workflowDefinitions : [];
      working.workflows = Array.isArray(working.workflows) ? working.workflows : [];
      working.campaigns = Array.isArray(working.campaigns) ? working.campaigns : [];
      working.savedReports = Array.isArray(working.savedReports) ? working.savedReports : [];
      working.callLogs = Array.isArray(working.callLogs) ? working.callLogs : [];
      working.webhookEndpoints = Array.isArray(working.webhookEndpoints) ? working.webhookEndpoints : [];
      steps.push('v2 → v3: افزودن جداول گردش‌کار، بازاریابی، گزارش‌ساز و یکپارچه‌سازی‌ها');
      version = 3;
    }

    // Migration v3 -> v4: Administration (RBAC roles/teams/users, security policy, notifications, dataAccessLogs, trash flags)
    if (version < 4) {
      working.roles = Array.isArray(working.roles) ? working.roles : undefined;
      working.teams = Array.isArray(working.teams) ? working.teams : undefined;
      working.users = Array.isArray(working.users) ? working.users : undefined;
      working.dataAccessLogs = Array.isArray(working.dataAccessLogs) ? working.dataAccessLogs : [];
      working.aiUsageLogs = Array.isArray(working.aiUsageLogs) ? working.aiUsageLogs : [];
      if (working.settings) {
        working.settings = {
          ...working.settings,
          taxRatePct: working.settings.taxRatePct ?? 9,
          currency: working.settings.currency ?? 'toman',
          defaultUnit: working.settings.defaultUnit ?? 'عدد',
          security: {
            ...DEFAULT_SECURITY_POLICY,
            ...(working.settings.security ?? {}),
          },
          ai: {
            enabled: true,
            brandTone: 'friendly',
            maskPiiBeforeSend: true,
            logUsage: true,
            model: 'gemini-4-hydrogen',
            ...(working.settings.ai ?? {}),
          },
          notifications: {
            smsReminders: true,
            emailDigest: true,
            inAppToasts: true,
            slaBreachAlerts: true,
            dailySummaryHour: 9,
            quietHoursStart: 22,
            quietHoursEnd: 8,
            ...(working.settings.notifications ?? {}),
          },
        };
      }
      steps.push('v3 → v4: ارتقای تنظیمات مالیات، نقش‌های RBAC، تیم‌ها، سیاست امنیتی و سطل زباله');
      version = 4;
    }

    working.schemaVersion = CURRENT_SCHEMA_VERSION;
    if (steps.length === 0) {
      steps.push(`نسخه فایل (v${CURRENT_SCHEMA_VERSION}) مطابق با آخرین اسکیمای سیستم است.`);
    }

    return {
      ok: true,
      fromVersion,
      toVersion: CURRENT_SCHEMA_VERSION,
      steps,
      data: working,
    };
  } catch {
    return {
      ok: false,
      error: 'فایل JSON قابل تجزیه نیست یا فرمت نامعتبر دارد.',
    };
  }
}
