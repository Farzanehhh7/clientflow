import { useState } from 'react';
import {
  Building2,
  Check,
  EyeOff,
  Plus,
  ShieldCheck,
  Trash2,
  UserCheck,
  Users,
} from 'lucide-react';
import { useClientFlow } from '../../store/useClientFlowStore';
import type { DataScope, PermissionAction, PermissionResource, UserRole } from '../../types';
import { toFa } from '../../utils/jalali';
import {
  ALL_PERMISSION_ACTIONS,
  ALL_PERMISSION_RESOURCES,
  DATA_SCOPE_LABELS,
  getEffectiveUserAndRole,
  PERMISSION_ACTION_LABELS,
  PERMISSION_RESOURCE_LABELS,
} from '../../utils/security';

export function UsersRolesTab() {
  const {
    state,
    switchActiveUser,
    addCrmUser,
    updateCrmUser,
    deleteCrmUser,
    addRoleDefinition,
    updateRolePermission,
    updateRoleMeta,
    deleteRoleDefinition,
    addTeamDefinition,
    deleteTeamDefinition,
    addBranch,
    deleteBranch,
    updateSettings,
  } = useClientFlow();

  const roles = state.roles ?? [];
  const teams = state.teams ?? [];
  const users = state.users ?? [];
  const { activeUser, activeRole, effectiveScope, maskPii } = getEffectiveUserAndRole(state);

  const [selectedRoleId, setSelectedRoleId] = useState<string>(roles[0]?.id ?? '');

  // New User Form
  const [uName, setUName] = useState('');
  const [uEmail, setUEmail] = useState('');
  const [uPhone, setUPhone] = useState('');
  const [uRoleId, setURoleId] = useState(roles[2]?.id ?? roles[0]?.id ?? '');
  const [uTeamId, setUTeamId] = useState(teams[0]?.id ?? '');
  const [uBranchId, setUBranchId] = useState(state.branches[0]?.id ?? '');
  const [uScope, setUScope] = useState<DataScope>('branch');

  // New Team Form
  const [tName, setTName] = useState('');
  const [tBranchId, setTBranchId] = useState(state.branches[0]?.id ?? '');

  // New Role Form
  const [rName, setRName] = useState('');
  const [rBaseRole, setRBaseRole] = useState<UserRole>('staff');
  const [rScope, setRScope] = useState<DataScope>('branch');
  const [rMaskPii, setRMaskPii] = useState(true);

  // Branch Hierarchy Form
  const [brName, setBrName] = useState('');
  const [brCode, setBrCode] = useState('');
  const [brCity, setBrCity] = useState('');
  const [brManager, setBrManager] = useState('');
  const [brParentId, setBrParentId] = useState(state.branches[0]?.id ?? '');

  const selectedRole = roles.find((r) => r.id === selectedRoleId) ?? roles[0];

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!uName.trim()) return;
    addCrmUser({
      name: uName.trim(),
      email: uEmail.trim() || `user${users.length + 1}@clientflow.ir`,
      phone: uPhone.trim() || '09120000000',
      roleId: uRoleId || roles[0]?.id || 'role_sales_rep',
      teamId: uTeamId || undefined,
      branchId: uBranchId || undefined,
      dataScope: uScope,
      active: true,
    });
    setUName('');
    setUEmail('');
    setUPhone('');
  };

  const handleCreateTeam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tName.trim()) return;
    addTeamDefinition({
      name: tName.trim(),
      branchId: tBranchId || undefined,
      memberIds: [],
    });
    setTName('');
  };

  const handleCreateRole = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rName.trim()) return;
    const emptyPerms = ALL_PERMISSION_RESOURCES.reduce(
      (acc, res) => {
        acc[res] = res === 'customers' || res === 'tickets' ? ['view'] : [];
        return acc;
      },
      {} as Record<PermissionResource, PermissionAction[]>,
    );
    addRoleDefinition({
      key: `custom_${Date.now().toString(36)}`,
      name: rName.trim(),
      description: 'نقش سفارشی تعریف‌شده توسط مدیر',
      baseRole: rBaseRole,
      dataScope: rScope,
      maskPii: rMaskPii,
      permissions: emptyPerms,
    });
    setRName('');
  };

  return (
    <div className="space-y-6">
      {/* Active User / RBAC Simulation Banner */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <UserCheck size={16} className="text-indigo-500" />
              شبیه‌ساز کاربر فعال و محدوده دسترسی (Active Session & Scope)
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              با تعویض کاربر فعال، ماتریس دسترسی، محدوده داده ({DATA_SCOPE_LABELS[effectiveScope]}) و ماسک PII در کل CRM اعمال می‌شود.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="انتخاب کاربر فعال"
              value={activeUser?.id ?? ''}
              onChange={(e) => switchActiveUser(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium dark:border-slate-700 dark:bg-slate-800"
            >
              {users.map((u) => {
                const r = roles.find((rl) => rl.id === u.roleId);
                return (
                  <option key={u.id} value={u.id}>
                    {u.name} — {r?.name ?? u.roleId}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-300">
          <span>
            نقش مؤثر: <strong className="text-slate-900 dark:text-slate-100">{activeRole?.name ?? state.settings.role}</strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            دامنه داده: <strong className="text-indigo-600 dark:text-indigo-400">{DATA_SCOPE_LABELS[effectiveScope]}</strong>
          </span>
          <span aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-1">
            <EyeOff size={13} className={maskPii ? 'text-amber-600' : 'text-emerald-600'} />
            وضعیت PII: <strong>{maskPii ? 'موبایل و کد ملی ماسک می‌شود' : 'نمایش کامل داده‌ها'}</strong>
          </span>
        </div>
      </div>

      {/* Users Management */}
      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Users size={16} className="text-indigo-500" />
            مدیریت کاربران، انتساب نقش، تیم و شعبه ({toFa(users.length)})
          </h3>
        </div>

        <form onSubmit={handleCreateUser} className="grid grid-cols-1 gap-2.5 sm:grid-cols-6">
          <input
            type="text"
            required
            placeholder="نام و نام خانوادگی..."
            value={uName}
            onChange={(e) => setUName(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
          />
          <input
            type="email"
            dir="ltr"
            placeholder="email@domain.ir"
            value={uEmail}
            onChange={(e) => setUEmail(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-left font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
          />
          <input
            type="text"
            dir="ltr"
            placeholder="0912..."
            value={uPhone}
            onChange={(e) => setUPhone(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-left font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
          />
          <select
            value={uRoleId}
            onChange={(e) => setURoleId(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
          >
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <select
            value={uScope}
            onChange={(e) => setUScope(e.target.value as DataScope)}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
          >
            {(['own', 'team', 'branch', 'all'] as DataScope[]).map((sc) => (
              <option key={sc} value={sc}>
                {DATA_SCOPE_LABELS[sc]}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
          >
            <Plus size={14} />
            افزودن کاربر
          </button>
        </form>

        <div className="flex flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">شعبه پیش‌فرض کاربر جدید:</span>
            <select
              value={uBranchId}
              onChange={(e) => setUBranchId(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
            >
              {state.branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">تیم:</span>
            <select
              value={uTeamId}
              onChange={(e) => setUTeamId(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="">بدون تیم</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="w-full text-right text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">
              <tr>
                <th className="px-3 py-2.5 font-semibold">نام کاربر</th>
                <th className="px-3 py-2.5 font-semibold">نقش</th>
                <th className="px-3 py-2.5 font-semibold">شعبه</th>
                <th className="px-3 py-2.5 font-semibold">تیم</th>
                <th className="px-3 py-2.5 font-semibold">محدوده داده (Scope)</th>
                <th className="px-3 py-2.5 font-semibold">وضعیت</th>
                <th className="px-3 py-2.5 font-semibold">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {users.map((u) => {
                const isCurrent = u.id === activeUser?.id;
                return (
                  <tr key={u.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                    <td className="px-3 py-2.5">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">{u.name}</div>
                      <div className="font-mono text-[11px] tabular-nums text-slate-500" dir="ltr">
                        {u.email} · {toFa(u.phone)}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <select
                        value={u.roleId}
                        onChange={(e) => updateCrmUser(u.id, { roleId: e.target.value })}
                        className="rounded border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
                      >
                        {roles.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2.5">
                      <select
                        value={u.branchId ?? ''}
                        onChange={(e) => updateCrmUser(u.id, { branchId: e.target.value || undefined })}
                        className="rounded border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
                      >
                        <option value="">همه شعب</option>
                        {state.branches.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2.5">
                      <select
                        value={u.teamId ?? ''}
                        onChange={(e) => updateCrmUser(u.id, { teamId: e.target.value || undefined })}
                        className="rounded border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
                      >
                        <option value="">—</option>
                        {teams.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2.5">
                      <select
                        value={u.dataScope ?? 'branch'}
                        onChange={(e) => updateCrmUser(u.id, { dataScope: e.target.value as DataScope })}
                        className="rounded border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
                      >
                        {(['own', 'team', 'branch', 'all'] as DataScope[]).map((sc) => (
                          <option key={sc} value={sc}>
                            {DATA_SCOPE_LABELS[sc]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => updateCrmUser(u.id, { active: !u.active })}
                        className={`rounded px-2 py-1 text-[11px] font-medium ${
                          u.active
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                            : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        {u.active ? 'فعال' : 'غیرفعال'}
                      </button>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => switchActiveUser(u.id)}
                          className={`rounded px-2 py-1 text-[11px] font-medium ${
                            isCurrent
                              ? 'bg-indigo-600 text-white'
                              : 'border border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200'
                          }`}
                        >
                          {isCurrent ? 'کاربر فعلی' : 'ورود با این حساب'}
                        </button>
                        {users.length > 1 && !isCurrent && (
                          <button
                            type="button"
                            onClick={() => deleteCrmUser(u.id)}
                            className="p-1 text-slate-400 hover:text-rose-600"
                            title="حذف کاربر"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Role & Permission Matrix */}
      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck size={16} className="text-emerald-500" />
              ماتریس دسترسی نقش‌ها (Role Permission Matrix)
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              سطح دسترسی هر نقش به ماژول‌ها، مجوز مشاهده اطلاعات هویتی (PII) و دامنه پیش‌فرض شعبه/تیم را تنظیم کنید.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {roles.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelectedRoleId(r.id)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                  selectedRole?.id === r.id
                    ? 'border-indigo-600 bg-indigo-600 text-white'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                {r.name}
              </button>
            ))}
          </div>
        </div>

        {/* Create new role */}
        <form onSubmit={handleCreateRole} className="grid grid-cols-1 gap-2 rounded-lg bg-slate-50 p-3 text-xs sm:grid-cols-5 dark:bg-slate-800/50">
          <input
            type="text"
            required
            placeholder="نام نقش جدید (مثلاً: حسابدار شعبه)..."
            value={rName}
            onChange={(e) => setRName(e.target.value)}
            className="sm:col-span-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
          />
          <select
            value={rBaseRole}
            onChange={(e) => setRBaseRole(e.target.value as UserRole)}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
          >
            <option value="staff">پایه کارشناس (Staff)</option>
            <option value="admin">پایه مدیر (Admin)</option>
          </select>
          <select
            value={rScope}
            onChange={(e) => setRScope(e.target.value as DataScope)}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
          >
            {(['own', 'team', 'branch', 'all'] as DataScope[]).map((sc) => (
              <option key={sc} value={sc}>
                {DATA_SCOPE_LABELS[sc]}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <label className="flex cursor-pointer items-center gap-1 whitespace-nowrap text-[11px]">
              <input
                type="checkbox"
                checked={rMaskPii}
                onChange={(e) => setRMaskPii(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600"
              />
              ماسک PII
            </label>
            <button
              type="submit"
              className="mr-auto rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
            >
              افزودن نقش
            </button>
          </div>
        </form>

        {selectedRole && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 px-3.5 py-2.5 text-xs dark:border-slate-800">
              <div>
                <span className="font-bold text-slate-900 dark:text-slate-100">{selectedRole.name}</span>
                <span className="mx-2 text-slate-400">·</span>
                <span className="text-slate-500">{selectedRole.description}</span>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={selectedRole.dataScope}
                  onChange={(e) => updateRoleMeta(selectedRole.id, { dataScope: e.target.value as DataScope })}
                  className="rounded border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
                >
                  {(['own', 'team', 'branch', 'all'] as DataScope[]).map((sc) => (
                    <option key={sc} value={sc}>
                      {DATA_SCOPE_LABELS[sc]}
                    </option>
                  ))}
                </select>
                <label className="flex cursor-pointer items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={selectedRole.maskPii}
                    onChange={(e) => updateRoleMeta(selectedRole.id, { maskPii: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-amber-600"
                  />
                  <span>ماسک موبایل و کد ملی (PII)</span>
                </label>
                {!selectedRole.isSystem && (
                  <button
                    type="button"
                    onClick={() => deleteRoleDefinition(selectedRole.id)}
                    className="inline-flex items-center gap-1 text-rose-600 hover:underline"
                  >
                    <Trash2 size={13} />
                    حذف نقش
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
              <table className="w-full text-right text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">
                  <tr>
                    <th className="px-3 py-2 font-semibold">بخش / موجودیت</th>
                    {ALL_PERMISSION_ACTIONS.map((act) => (
                      <th key={act} className="px-3 py-2 text-center font-semibold">
                        {PERMISSION_ACTION_LABELS[act]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {ALL_PERMISSION_RESOURCES.map((res) => {
                    const granted = selectedRole.permissions[res] ?? [];
                    return (
                      <tr key={res} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                        <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-200">
                          {PERMISSION_RESOURCE_LABELS[res]}
                        </td>
                        {ALL_PERMISSION_ACTIONS.map((act) => {
                          const checked = granted.includes(act);
                          return (
                            <td key={act} className="px-3 py-2 text-center">
                              <button
                                type="button"
                                onClick={() => updateRolePermission(selectedRole.id, res, act, !checked)}
                                aria-label={`${PERMISSION_RESOURCE_LABELS[res]} - ${PERMISSION_ACTION_LABELS[act]}`}
                                className={`inline-flex h-5 w-5 items-center justify-center rounded border transition-colors ${
                                  checked
                                    ? 'border-indigo-600 bg-indigo-600 text-white'
                                    : 'border-slate-300 bg-white text-transparent hover:border-indigo-400 dark:border-slate-600 dark:bg-slate-800'
                                }`}
                              >
                                <Check size={12} />
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Teams & Multi-Branch Hierarchy */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Teams */}
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-sm font-semibold">تیم‌های کاری (Teams)</h3>
          <form onSubmit={handleCreateTeam} className="flex flex-wrap gap-2">
            <input
              type="text"
              required
              placeholder="نام تیم جدید..."
              value={tName}
              onChange={(e) => setTName(e.target.value)}
              className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
            />
            <select
              value={tBranchId}
              onChange={(e) => setTBranchId(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
            >
              {state.branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
            >
              ایجاد تیم
            </button>
          </form>

          <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
            {teams.map((t) => {
              const br = state.branches.find((b) => b.id === t.branchId);
              const members = users.filter((u) => u.teamId === t.id || t.memberIds.includes(u.id));
              return (
                <div key={t.id} className="flex items-center justify-between gap-2 px-3 py-2.5 text-xs">
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-slate-100">{t.name}</div>
                    <div className="mt-0.5 text-[11px] text-slate-500">
                      شعبه: {br?.name ?? 'سراسری'} · {toFa(members.length)} عضو
                      {members.length > 0 ? ` (${members.map((m) => m.name).join('، ')})` : ''}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteTeamDefinition(t.id)}
                    className="p-1 text-slate-400 hover:text-rose-600"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Branch Hierarchy */}
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Building2 size={16} className="text-indigo-500" />
              سلسله‌مراتب شعبه‌ها (Branch Hierarchy)
            </h3>
            <select
              value={state.settings.activeBranchId}
              onChange={(e) => updateSettings({ activeBranchId: e.target.value })}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="all">نمایش تجمیعی همه شعب</option>
              {state.branches.map((b) => (
                <option key={b.id} value={b.id}>
                  فیلتر: {b.name}
                </option>
              ))}
            </select>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!brName.trim()) return;
              addBranch({
                name: brName.trim(),
                code: brCode.trim().toUpperCase() || `BR-${state.branches.length + 1}`,
                city: brCity.trim() || 'تهران',
                managerName: brManager.trim() || undefined,
                parentBranchId: brParentId || undefined,
                active: true,
              });
              setBrName('');
              setBrCode('');
              setBrCity('');
              setBrManager('');
            }}
            className="grid grid-cols-2 gap-2 sm:grid-cols-3"
          >
            <input
              type="text"
              required
              placeholder="نام شعبه..."
              value={brName}
              onChange={(e) => setBrName(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
            />
            <input
              type="text"
              dir="ltr"
              placeholder="کد (ESF-01)"
              value={brCode}
              onChange={(e) => setBrCode(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-left font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
            />
            <input
              type="text"
              placeholder="شهر"
              value={brCity}
              onChange={(e) => setBrCity(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
            />
            <input
              type="text"
              placeholder="مدیر شعبه"
              value={brManager}
              onChange={(e) => setBrManager(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
            />
            <select
              value={brParentId}
              onChange={(e) => setBrParentId(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="">شعبه مادر (ستاد)</option>
              {state.branches.map((b) => (
                <option key={b.id} value={b.id}>
                  زیرشعبه: {b.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
            >
              افزودن شعبه
            </button>
          </form>

          <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
            {state.branches.map((b) => {
              const parent = state.branches.find((p) => p.id === b.parentBranchId);
              return (
                <div key={b.id} className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
                  <div className={parent ? 'pr-4' : ''}>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {parent ? '↳ ' : ''}
                      {b.name}
                    </span>
                    <span className="mx-1.5 font-mono text-[11px] text-indigo-600 dark:text-indigo-400">
                      ({b.code})
                    </span>
                    <div className="text-[11px] text-slate-500">
                      {b.city}
                      {b.managerName ? ` · مدیر: ${b.managerName}` : ''}
                      {parent ? ` · زیرمجموعه «${parent.name}»` : ' · ستاد اصلی'}
                    </div>
                  </div>
                  {state.branches.length > 1 && (
                    <button
                      type="button"
                      onClick={() => deleteBranch(b.id)}
                      className="p-1 text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
