import type {
  AppState,
  CrmUser,
  DataScope,
  PermissionAction,
  PermissionResource,
  RoleDefinition,
  SecurityPolicyConfig,
} from '../types';
import { toFa } from './jalali';

export const PERMISSION_RESOURCE_LABELS: Record<PermissionResource, string> = {
  customers: 'مشتریان و پرونده ۳۶۰',
  sales: 'فروش، سرنخ و پایپ‌لاین',
  orders: 'سفارش‌ها و ارسال',
  appointments: 'نوبت‌دهی و تقویم',
  invoices: 'فاکتور، پرداخت و چک',
  tickets: 'تیکت و پشتیبانی',
  marketing: 'بازاریابی و باشگاه وفاداری',
  reports: 'گزارش‌ساز و داشبورد',
  automation: 'اتوماسیون و گردش‌کار',
  integrations: 'یکپارچه‌سازی و تلفن ابری',
  settings: 'تنظیمات و مدیریت کاربران',
  trash: 'سطل زباله و بازیابی',
};

export const PERMISSION_ACTION_LABELS: Record<PermissionAction, string> = {
  view: 'مشاهده',
  create: 'ایجاد',
  edit: 'ویرایش',
  delete: 'حذف',
  export: 'خروجی',
  view_pii: 'مشاهده PII',
};

export const ALL_PERMISSION_RESOURCES: PermissionResource[] = [
  'customers',
  'sales',
  'orders',
  'appointments',
  'invoices',
  'tickets',
  'marketing',
  'reports',
  'automation',
  'integrations',
  'settings',
  'trash',
];

export const ALL_PERMISSION_ACTIONS: PermissionAction[] = [
  'view',
  'create',
  'edit',
  'delete',
  'export',
  'view_pii',
];

export const DATA_SCOPE_LABELS: Record<DataScope, string> = {
  own: 'فقط رکوردهای خودم (Own)',
  team: 'هم‌تیمی‌ها (Team)',
  branch: 'فقط شعبه من (Branch)',
  all: 'کل سازمان و شعبه‌ها (All)',
};

export const DEFAULT_SECURITY_POLICY: SecurityPolicyConfig = {
  sessionTimeoutMin: 30,
  requireMfaSimulated: false,
  minPasswordLength: 8,
  requireUppercase: true,
  requireNumber: true,
  requireSymbol: false,
  passwordExpiryDays: 90,
  maxFailedAttempts: 5,
  logCustomerAccess: true,
};

export function getEffectiveUserAndRole(state: AppState): {
  activeUser?: CrmUser;
  activeRole?: RoleDefinition;
  effectiveScope: DataScope;
  maskPii: boolean;
} {
  const users = state.users ?? [];
  const roles = state.roles ?? [];
  const activeUser =
    users.find((u) => u.id === state.settings.activeUserId) ??
    users.find((u) => {
      const role = roles.find((r) => r.id === u.roleId);
      return role?.baseRole === state.settings.role;
    }) ??
    users[0];

  const activeRole =
    (activeUser ? roles.find((r) => r.id === activeUser.roleId) : undefined) ??
    roles.find((r) => r.baseRole === state.settings.role) ??
    roles[0];

  const effectiveScope: DataScope =
    activeUser?.dataScope ?? activeRole?.dataScope ?? (state.settings.role === 'admin' ? 'all' : 'branch');

  const hasViewPii = activeRole ? activeRole.permissions.customers?.includes('view_pii') : state.settings.role === 'admin';
  const maskPii = Boolean(activeRole?.maskPii || !hasViewPii);

  return { activeUser, activeRole, effectiveScope, maskPii };
}

export function hasPermission(
  state: AppState,
  resource: PermissionResource,
  action: PermissionAction,
): boolean {
  const { activeRole } = getEffectiveUserAndRole(state);
  if (!activeRole) {
    if (state.settings.role === 'admin') return true;
    return action === 'view' || action === 'create' || action === 'edit';
  }
  return activeRole.permissions[resource]?.includes(action) ?? false;
}

export function shouldMaskPii(state: AppState): boolean {
  return getEffectiveUserAndRole(state).maskPii;
}

export function maskPhone(phone: string | undefined, shouldMask: boolean): string {
  if (!phone) return '—';
  if (!shouldMask) return toFa(phone);
  const clean = phone.trim();
  if (clean.length < 7) return '••••';
  return toFa(`${clean.slice(0, 4)}***${clean.slice(-3)}`);
}

export function maskNationalId(nid: string | undefined, shouldMask: boolean): string {
  if (!nid) return '—';
  if (!shouldMask) return toFa(nid);
  const clean = nid.trim();
  if (clean.length < 5) return '••••';
  return toFa(`${clean.slice(0, 3)}****${clean.slice(-3)}`);
}

export function maskEmail(email: string | undefined, shouldMask: boolean): string {
  if (!email) return '—';
  if (!shouldMask) return email;
  const parts = email.split('@');
  if (parts.length !== 2) return '***';
  const local = parts[0];
  return `${local.slice(0, 1)}***@${parts[1]}`;
}

export function filterByUserScope<T>(
  items: T[],
  state: AppState,
  getOwnerName: (item: T) => string | undefined,
  getBranchId: (item: T) => string | undefined,
): T[] {
  const { activeUser, effectiveScope } = getEffectiveUserAndRole(state);
  const activeBranch = state.settings.activeBranchId;

  // Step 1: Respect header branch switcher if explicitly selected
  let scoped =
    activeBranch && activeBranch !== 'all'
      ? items.filter((item) => {
          const b = getBranchId(item);
          return !b || b === activeBranch;
        })
      : items;

  if (!activeUser || effectiveScope === 'all') return scoped;

  if (effectiveScope === 'branch' && activeUser.branchId) {
    scoped = scoped.filter((item) => {
      const b = getBranchId(item);
      return !b || b === activeUser.branchId;
    });
    return scoped;
  }

  if (effectiveScope === 'team' && activeUser.teamId) {
    const team = (state.teams ?? []).find((t) => t.id === activeUser.teamId);
    const memberNames = new Set(
      (state.users ?? [])
        .filter((u) => (team ? team.memberIds.includes(u.id) || u.teamId === team.id : u.teamId === activeUser.teamId))
        .map((u) => u.name),
    );
    memberNames.add(activeUser.name);
    return scoped.filter((item) => {
      const owner = getOwnerName(item);
      return !owner || memberNames.has(owner);
    });
  }

  if (effectiveScope === 'own') {
    return scoped.filter((item) => {
      const owner = getOwnerName(item);
      return !owner || owner === activeUser.name;
    });
  }

  return scoped;
}

export function validatePasswordAgainstPolicy(
  password: string,
  policy: SecurityPolicyConfig = DEFAULT_SECURITY_POLICY,
): {
  valid: boolean;
  checks: { key: string; label: string; passed: boolean }[];
} {
  const checks = [
    {
      key: 'length',
      label: `حداقل ${toFa(policy.minPasswordLength)} کاراکتر`,
      passed: password.length >= policy.minPasswordLength,
    },
    ...(policy.requireUppercase
      ? [
          {
            key: 'upper',
            label: 'حداقل یک حرف بزرگ انگلیسی (A-Z)',
            passed: /[A-Z]/.test(password),
          },
        ]
      : []),
    ...(policy.requireNumber
      ? [
          {
            key: 'number',
            label: 'حداقل یک رقم (0-9)',
            passed: /[0-9]/.test(password),
          },
        ]
      : []),
    ...(policy.requireSymbol
      ? [
          {
            key: 'symbol',
            label: 'حداقل یک کاراکتر خاص (!@#$%)',
            passed: /[^A-Za-z0-9]/.test(password),
          },
        ]
      : []),
  ];

  return {
    valid: checks.every((c) => c.passed),
    checks,
  };
}
