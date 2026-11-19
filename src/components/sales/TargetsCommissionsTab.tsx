import { useMemo, useState } from 'react';
import { CheckCircle2, RefreshCw, ShieldCheck, Target, Users, Wallet } from 'lucide-react';
import { useClientFlow } from '../../store/useClientFlowStore';
import type { CommissionLedgerStatus, PackSalesConfig } from '../../types';
import { computeCommissionAmount } from '../../utils/crmHelpers';
import { formatJalali, formatToman, toFa } from '../../utils/jalali';
import { Badge } from '../ui/Badge';

interface TargetsCommissionsTabProps {
  packSales: PackSalesConfig;
}

const LEDGER_STATUS_META: Record<
  CommissionLedgerStatus,
  { label: string; tone: 'amber' | 'sky' | 'emerald' }
> = {
  pending: { label: 'در انتظار تأیید مدیر', tone: 'amber' },
  approved: { label: 'تأییدشده (آماده تسویه)', tone: 'sky' },
  paid: { label: 'پرداخت‌شده', tone: 'emerald' },
};

export function TargetsCommissionsTab({ packSales }: TargetsCommissionsTabProps) {
  const {
    state,
    updateSalesTargets,
    updateCommissionRule,
    approveCommissionEntry,
    generateMissingCommissions,
  } = useClientFlow();

  const [ledgerFilter, setLedgerFilter] = useState<'all' | CommissionLedgerStatus>('all');
  const [newTeamTargetName, setNewTeamTargetName] = useState('');
  const [newTeamTargetAmt, setNewTeamTargetAmt] = useState('60000000');

  const repStats = useMemo(() => {
    return state.settings.salesTeam.map((rep) => {
      const targetObj = state.salesTargets.find(
        (t) => (t.targetType ?? 'user') === 'user' && t.ownerName === rep,
      );
      const targetAmount = targetObj?.targetAmount ?? 50_000_000;
      const repWonOpps = state.opportunities.filter(
        (o) => o.stage === 'won' && o.ownerName === rep,
      );
      const wonSum = repWonOpps.reduce((s, o) => s + o.amount, 0);
      const comm = computeCommissionAmount(wonSum, state.commissionTiers, state.commissionRule);
      const pct = targetAmount > 0 ? Math.min(100, Math.round((wonSum / targetAmount) * 100)) : 0;
      return {
        rep,
        targetAmount,
        wonSum,
        wonCount: repWonOpps.length,
        commission: comm.total,
        rateSummary: comm.summary,
        breakdown: comm.breakdown,
        pct,
      };
    });
  }, [state.settings.salesTeam, state.salesTargets, state.opportunities, state.commissionTiers, state.commissionRule]);

  const teamTargets = useMemo(() => {
    const totalTeamWon = state.opportunities
      .filter((o) => o.stage === 'won')
      .reduce((s, o) => s + o.amount, 0);

    return state.salesTargets
      .filter((t) => t.targetType === 'team')
      .map((t) => ({
        ...t,
        achieved: totalTeamWon,
        pct: t.targetAmount > 0 ? Math.min(100, Math.round((totalTeamWon / t.targetAmount) * 100)) : 0,
      }));
  }, [state.salesTargets, state.opportunities]);

  const filteredLedger = useMemo(
    () =>
      state.commissionLedger.filter((e) => (ledgerFilter === 'all' ? true : e.status === ledgerFilter)),
    [state.commissionLedger, ledgerFilter],
  );

  const ledgerTotals = useMemo(() => {
    return state.commissionLedger.reduce(
      (acc, e) => {
        acc[e.status] += e.commissionAmount;
        acc.total += e.commissionAmount;
        return acc;
      },
      { pending: 0, approved: 0, paid: 0, total: 0 },
    );
  }, [state.commissionLedger]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>قانون محاسبه پورسانت</span>
            <Wallet size={15} className="text-indigo-500" />
          </div>
          <div className="mt-3 flex gap-2 text-xs">
            <button
              type="button"
              onClick={() => updateCommissionRule({ ...state.commissionRule, mode: 'tiered' })}
              className={`flex-1 rounded-lg border py-2 font-medium ${
                state.commissionRule.mode === 'tiered'
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300'
                  : 'border-slate-200 dark:border-slate-700'
              }`}
            >
              پلکانی (Tiered)
            </button>
            <button
              type="button"
              onClick={() => updateCommissionRule({ ...state.commissionRule, mode: 'percentage' })}
              className={`flex-1 rounded-lg border py-2 font-medium ${
                state.commissionRule.mode === 'percentage'
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300'
                  : 'border-slate-200 dark:border-slate-700'
              }`}
            >
              درصد ثابت (Percentage)
            </button>
          </div>
          {state.commissionRule.mode === 'percentage' ? (
            <div className="mt-3 flex items-center gap-2 text-xs">
              <span className="text-slate-500">نرخ پورسانت ثابت (٪):</span>
              <input
                type="number"
                min={0}
                max={50}
                value={state.commissionRule.flatRatePct}
                onChange={(e) =>
                  updateCommissionRule({
                    ...state.commissionRule,
                    flatRatePct: Math.max(0, Math.min(50, Number(e.target.value) || 0)),
                  })
                }
                className="w-20 rounded-lg border border-slate-200 px-2.5 py-1 tabular-nums dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          ) : (
            <div className="mt-3 text-[11px] text-slate-500">
              {toFa(state.commissionTiers.length)} پله فعال · تنظیم دقیق پله‌ها در تب «تنظیمات قیف و پورسانت»
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs text-slate-500">خلاصه دفتر پورسانت (Ledger)</div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-xs tabular-nums">
            <div>
              <div className="text-[11px] text-amber-600">در انتظار تأیید</div>
              <div className="mt-0.5 font-bold">{formatToman(ledgerTotals.pending)}</div>
            </div>
            <div>
              <div className="text-[11px] text-sky-600">تأییدشده</div>
              <div className="mt-0.5 font-bold">{formatToman(ledgerTotals.approved)}</div>
            </div>
            <div>
              <div className="text-[11px] text-emerald-600">پرداخت‌شده</div>
              <div className="mt-0.5 font-bold">{formatToman(ledgerTotals.paid)}</div>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-2.5 text-[11px] dark:border-slate-800">
            <label className="flex cursor-pointer items-center gap-1.5">
              <input
                type="checkbox"
                checked={state.commissionRule.autoCreateLedgerOnWon}
                onChange={(e) =>
                  updateCommissionRule({ ...state.commissionRule, autoCreateLedgerOnWon: e.target.checked })
                }
                className="h-3.5 w-3.5 rounded accent-indigo-600"
              />
              ثبت خودکار پورسانت هنگام برد {packSales.dealSingular}
            </label>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="inline-flex items-center gap-1.5">
              <Users size={14} className="text-indigo-500" />
              تارگت‌های تیمی
            </span>
          </div>
          <div className="mt-2 space-y-2.5">
            {teamTargets.map((tt) => (
              <div key={tt.id} className="text-xs">
                <div className="flex justify-between font-medium tabular-nums">
                  <span>{tt.teamName || tt.ownerName}</span>
                  <span>
                    {toFa(tt.pct)}٪ ({formatToman(tt.achieved)} / {formatToman(tt.targetAmount)})
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${tt.pct}%` }} />
                </div>
              </div>
            ))}
            <div className="flex gap-1.5 pt-1 text-xs">
              <input
                type="text"
                value={newTeamTargetName}
                onChange={(e) => setNewTeamTargetName(e.target.value)}
                placeholder="نام تیم..."
                className="w-1/2 rounded border border-slate-200 px-2 py-1 dark:border-slate-700 dark:bg-slate-800"
              />
              <input
                type="number"
                value={newTeamTargetAmt}
                onChange={(e) => setNewTeamTargetAmt(e.target.value)}
                className="w-1/3 rounded border border-slate-200 px-2 py-1 tabular-nums dark:border-slate-700 dark:bg-slate-800"
              />
              <button
                type="button"
                onClick={() => {
                  if (!newTeamTargetName.trim()) return;
                  updateSalesTargets([
                    ...state.salesTargets,
                    {
                      id: `st_team_${Date.now()}`,
                      targetType: 'team',
                      teamName: newTeamTargetName.trim(),
                      ownerName: newTeamTargetName.trim(),
                      periodLabel: 'دوره جاری',
                      targetAmount: Math.max(0, Number(newTeamTargetAmt) || 0),
                    },
                  ]);
                  setNewTeamTargetName('');
                }}
                className="rounded bg-indigo-600 px-2.5 py-1 text-white hover:bg-indigo-700"
              >
                +
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {repStats.map((rs) => (
          <div
            key={rs.rep}
            className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target size={16} className="text-indigo-500" />
                <span className="text-sm font-semibold">{rs.rep}</span>
              </div>
              <span className="text-xs font-semibold tabular-nums text-indigo-600 dark:text-indigo-400">
                {toFa(rs.pct)}٪ تحقق
              </span>
            </div>

            <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-indigo-600 transition-all"
                style={{ width: `${rs.pct}%` }}
              />
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs tabular-nums">
              <div>
                <div className="text-slate-500">فروش برنده‌شده ({toFa(rs.wonCount)})</div>
                <div className="font-semibold">{formatToman(rs.wonSum)}</div>
              </div>
              <div>
                <div className="text-slate-500">پورسانت ({rs.rateSummary})</div>
                <div className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {formatToman(rs.commission)}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 border-t border-slate-200 pt-2.5 text-xs dark:border-slate-800">
              <span className="text-slate-500">تارگت ماهانه:</span>
              <input
                type="number"
                value={rs.targetAmount}
                onChange={(e) => {
                  const val = Math.max(0, Number(e.target.value) || 0);
                  const existing = state.salesTargets.some(
                    (t) => (t.targetType ?? 'user') === 'user' && t.ownerName === rs.rep,
                  );
                  const next = existing
                    ? state.salesTargets.map((t) =>
                        (t.targetType ?? 'user') === 'user' && t.ownerName === rs.rep
                          ? { ...t, targetAmount: val }
                          : t,
                      )
                    : [
                        ...state.salesTargets,
                        {
                          id: `st_${Date.now()}`,
                          targetType: 'user' as const,
                          ownerName: rs.rep,
                          periodLabel: 'دوره جاری',
                          targetAmount: val,
                        },
                      ];
                  updateSalesTargets(next);
                }}
                className="w-36 rounded border border-slate-200 px-2 py-1 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <div>
            <div className="text-sm font-semibold">دفتر پورسانت کارشناسان (Commission Ledger)</div>
            <div className="text-[11px] text-slate-500">
              تأیید مدیر و ثبت تسویه پورسانت معاملات برنده‌شده
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="فیلتر وضعیت دفتر پورسانت"
              value={ledgerFilter}
              onChange={(e) => setLedgerFilter(e.target.value as 'all' | CommissionLedgerStatus)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="all">همه ردیف‌ها ({toFa(state.commissionLedger.length)})</option>
              <option value="pending">در انتظار تأیید</option>
              <option value="approved">تأییدشده</option>
              <option value="paid">پرداخت‌شده</option>
            </select>
            <button
              type="button"
              onClick={generateMissingCommissions}
              className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              <RefreshCw size={13} />
              محاسبه معاملات برنده‌شده
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="border-b border-slate-200 bg-slate-50/70 text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">عنوان معامله</th>
                <th className="px-4 py-3 font-medium">کارشناس فروش</th>
                <th className="px-4 py-3 font-medium">مبلغ معامله</th>
                <th className="px-4 py-3 font-medium">مبلغ پورسانت · نرخ</th>
                <th className="px-4 py-3 font-medium">تاریخ ثبت</th>
                <th className="px-4 py-3 font-medium">وضعیت</th>
                <th className="px-4 py-3 font-medium">تأیید مدیر / تسویه</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filteredLedger.map((entry) => {
                const st = LEDGER_STATUS_META[entry.status];
                return (
                  <tr key={entry.id}>
                    <td className="px-4 py-3 font-semibold">{entry.opportunityTitle}</td>
                    <td className="px-4 py-3">{entry.ownerName}</td>
                    <td className="px-4 py-3 tabular-nums">{formatToman(entry.dealAmount)}</td>
                    <td className="px-4 py-3 tabular-nums">
                      <div className="font-bold text-emerald-600 dark:text-emerald-400">
                        {formatToman(entry.commissionAmount)}
                      </div>
                      <div className="text-[11px] text-slate-500">{entry.rateSummary}</div>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-500">{formatJalali(entry.createdAt)}</td>
                    <td className="px-4 py-3">
                      <Badge tone={st.tone}>{st.label}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {entry.status === 'pending' && (
                          <button
                            type="button"
                            onClick={() => approveCommissionEntry(entry.id, 'approved')}
                            className="inline-flex items-center gap-1 whitespace-nowrap rounded bg-indigo-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-indigo-700"
                          >
                            <ShieldCheck size={12} />
                            تأیید مدیر
                          </button>
                        )}
                        {entry.status === 'approved' && (
                          <button
                            type="button"
                            onClick={() => approveCommissionEntry(entry.id, 'paid')}
                            className="inline-flex items-center gap-1 whitespace-nowrap rounded bg-emerald-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-emerald-700"
                          >
                            <CheckCircle2 size={12} />
                            ثبت پرداخت
                          </button>
                        )}
                        {entry.status === 'paid' && (
                          <span className="text-[11px] text-slate-500">
                            تسویه {entry.paidAt ? formatJalali(entry.paidAt) : ''}
                          </span>
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
    </div>
  );
}
