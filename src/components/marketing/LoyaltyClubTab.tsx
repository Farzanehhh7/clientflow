import { useMemo, useState } from 'react';
import {
  Award,
  Cake,
  Coins,
  Crown,
  Gift,
  Plus,
  Share2,
  Sliders,
  Sparkles,
  Tag,
  UserPlus,
} from 'lucide-react';
import { Modal } from '../Modal';
import { useClientFlow } from '../../store/useClientFlowStore';
import type { LoyaltyTier, LoyaltyTxType } from '../../types';
import { computeLoyaltyTier, daysUntilJalaliMonthDay } from '../../utils/crmHelpers';
import { formatJalaliDateTime, formatToman, toFa } from '../../utils/jalali';

const TIER_META: Record<LoyaltyTier, { label: string; cls: string }> = {
  bronze: {
    label: 'برنزی',
    cls: 'bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300',
  },
  silver: {
    label: 'نقره‌ای',
    cls: 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200',
  },
  gold: {
    label: 'طلایی',
    cls: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
  },
  vip: {
    label: 'VIP ویژه',
    cls: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300',
  },
};

const TX_TYPE_LABEL: Record<LoyaltyTxType, string> = {
  earn_purchase: 'امتیاز خرید',
  earn_visit: 'امتیاز مراجعه / خدمت',
  earn_referral: 'پاداش معرف',
  earn_manual: 'تنظیم دستی امتیاز',
  redeem_reward: 'تبدیل به جایزه',
  birthday_bonus: 'هدیه مناسبت / تولد',
};

export function LoyaltyClubTab() {
  const {
    state,
    updateLoyaltyConfig,
    addLoyaltyReward,
    toggleLoyaltyReward,
    adjustCustomerPoints,
    redeemLoyaltyReward,
    sendOccasionReward,
    registerReferral,
  } = useClientFlow();

  const cfg = state.loyaltyConfig ?? {
    enabled: true,
    pointsPer100kToman: 10,
    pointsPerVisit: 30,
    pointsPerReferral: 150,
    referredWelcomePoints: 50,
    birthdayBonusPoints: 100,
    birthdayDiscountPct: 20,
    silverMinPoints: 500,
    goldMinPoints: 1500,
    vipMinPoints: 4000,
  };

  const [subTab, setSubTab] = useState<'members' | 'rewards' | 'occasions' | 'referrals' | 'rules'>(
    'members',
  );

  // Add reward modal
  const [rewardOpen, setRewardOpen] = useState(false);
  const [rwTitle, setRwTitle] = useState('');
  const [rwPoints, setRwPoints] = useState(300);
  const [rwDiscountPct, setRwDiscountPct] = useState(15);
  const [rwMinOrder, setRwMinOrder] = useState(1_000_000);
  const [rwValidDays, setRwValidDays] = useState(30);

  const rewards = state.loyaltyRewards ?? [];
  const transactions = state.loyaltyTransactions ?? [];

  // Redeem modal
  const [redeemOpen, setRedeemOpen] = useState(false);
  const [redeemCustId, setRedeemCustId] = useState(state.customers[0]?.id ?? '');
  const [redeemRewardId, setRedeemRewardId] = useState(rewards[0]?.id ?? '');
  const [redeemResult, setRedeemResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  // Adjust points modal
  const [adjCustId, setAdjCustId] = useState('');
  const [adjDelta, setAdjDelta] = useState(100);
  const [adjDesc, setAdjDesc] = useState('هدیه وفاداری');

  // Referral registration form
  const [refCodeInput, setRefCodeInput] = useState('');
  const [refNameInput, setRefNameInput] = useState('');
  const [refPhoneInput, setRefPhoneInput] = useState('');
  const [refError, setRefError] = useState('');

  const activeCustomers = useMemo(
    () => state.customers.filter((c) => !c.isDeleted && !c.isAnonymized),
    [state.customers],
  );

  const loyaltyStats = useMemo(() => {
    let totalPoints = 0;
    const tierCounts: Record<LoyaltyTier, number> = {
      bronze: 0,
      silver: 0,
      gold: 0,
      vip: 0,
    };
    for (const c of activeCustomers) {
      const pts = c.loyaltyPoints ?? 0;
      totalPoints += pts;
      const tier = computeLoyaltyTier(c.lifetimePoints ?? pts, cfg);
      tierCounts[tier] += 1;
    }
    const redeemedTotal = rewards.reduce((s, r) => s + r.redeemedCount, 0);
    return { totalPoints, tierCounts, redeemedTotal };
  }, [activeCustomers, cfg, rewards]);

  const sortedLeaderboard = useMemo(
    () =>
      [...activeCustomers].sort(
        (a, b) => (b.loyaltyPoints ?? 0) - (a.loyaltyPoints ?? 0),
      ),
    [activeCustomers],
  );

  const upcomingOccasions = useMemo(() => {
    const items: {
      customerId: string;
      name: string;
      phone: string;
      type: 'birthday' | 'anniversary';
      jalaliDate: string;
      daysLeft: number;
    }[] = [];

    for (const c of activeCustomers) {
      if (c.birthDateJalali) {
        const d = daysUntilJalaliMonthDay(c.birthDateJalali);
        if (d !== null) {
          items.push({
            customerId: c.id,
            name: c.name,
            phone: c.phone,
            type: 'birthday',
            jalaliDate: c.birthDateJalali,
            daysLeft: d,
          });
        }
      }
      if (c.anniversaryDateJalali) {
        const d = daysUntilJalaliMonthDay(c.anniversaryDateJalali);
        if (d !== null) {
          items.push({
            customerId: c.id,
            name: c.name,
            phone: c.phone,
            type: 'anniversary',
            jalaliDate: c.anniversaryDateJalali,
            daysLeft: d,
          });
        }
      }
    }
    return items.sort((a, b) => a.daysLeft - b.daysLeft);
  }, [activeCustomers]);

  const referralCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of activeCustomers) {
      if (c.referredByCustomerId) {
        map.set(c.referredByCustomerId, (map.get(c.referredByCustomerId) ?? 0) + 1);
      }
    }
    return map;
  }, [activeCustomers]);

  const handleAddReward = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rwTitle.trim()) return;
    addLoyaltyReward({
      title: rwTitle.trim(),
      pointsCost: Math.max(10, rwPoints),
      discountPct: Math.min(100, Math.max(1, rwDiscountPct)),
      minOrderAmount: Math.max(0, rwMinOrder),
      validDays: Math.max(1, rwValidDays),
      active: true,
    });
    setRwTitle('');
    setRewardOpen(false);
  };

  const handleRedeemSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const res = redeemLoyaltyReward(redeemCustId, redeemRewardId);
    if (res.ok) {
      setRedeemResult({
        ok: true,
        message: `کد تخفیف ${res.couponCode} با موفقیت صادر و پیامک شد.`,
      });
    } else {
      setRedeemResult({
        ok: false,
        message: res.error ?? 'خطا در تبدیل امتیاز.',
      });
    }
  };

  const handleRegisterReferral = (e: React.FormEvent) => {
    e.preventDefault();
    setRefError('');
    const res = registerReferral(refCodeInput, refNameInput, refPhoneInput);
    if (!res.ok) {
      setRefError(res.error ?? 'خطا در ثبت معرفی.');
      return;
    }
    setRefCodeInput('');
    setRefNameInput('');
    setRefPhoneInput('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            باشگاه مشتریان، امتیازات، جوایز و برنامه معرف
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            امتیازدهی خودکار بر اساس خرید و نوبت، ارتقای سطح (برنزی/نقره‌ای/طلایی/VIP)، هدیه تولد و کد معرفی
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setRedeemResult(null);
              setRedeemOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-medium text-indigo-700 hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-300"
          >
            <Gift size={15} />
            تبدیل امتیاز به کد تخفیف
          </button>
          <button
            type="button"
            onClick={() => setRewardOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-indigo-700"
          >
            <Plus size={15} />
            پاداش جدید
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs text-slate-500 dark:text-slate-400">مجموع امتیاز در گردش</div>
          <div className="mt-1 flex items-center gap-1.5 text-lg font-bold tabular-nums text-amber-600 dark:text-amber-400">
            <Coins size={18} />
            {toFa(loyaltyStats.totalPoints)}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs text-slate-500 dark:text-slate-400">اعضای طلایی و VIP</div>
          <div className="mt-1 flex items-center gap-1.5 text-lg font-bold tabular-nums text-indigo-600 dark:text-indigo-400">
            <Crown size={18} />
            {toFa(loyaltyStats.tierCounts.gold + loyaltyStats.tierCounts.vip)} نفر
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs text-slate-500 dark:text-slate-400">اعضای نقره‌ای / برنزی</div>
          <div className="mt-1 text-lg font-bold tabular-nums text-slate-900 dark:text-white">
            {toFa(loyaltyStats.tierCounts.silver)} / {toFa(loyaltyStats.tierCounts.bronze)}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs text-slate-500 dark:text-slate-400">تعداد جوایز دریافتی</div>
          <div className="mt-1 text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
            {toFa(loyaltyStats.redeemedTotal)} مورد
          </div>
        </div>
      </div>

      {/* Sub-Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
        {[
          { key: 'members', label: 'اعضا و تراکنش‌های امتیاز', icon: Award },
          { key: 'rewards', label: 'کاتالوگ پاداش‌ها', icon: Gift },
          { key: 'occasions', label: 'تولد و مناسبت‌های پیش‌رو', icon: Cake },
          { key: 'referrals', label: 'کد معرف و جذب مشتری', icon: Share2 },
          { key: 'rules', label: 'قوانین امتیازدهی و سطوح', icon: Sliders },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setSubTab(item.key as typeof subTab)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                subTab === item.key
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              <Icon size={14} />
              {item.label}
            </button>
          );
        })}
      </div>

      {/* Sub-Tab 1: Members & Ledger */}
      {subTab === 'members' && (
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold dark:border-slate-800">
              رتبه‌بندی اعضای باشگاه مشتریان
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-600 dark:bg-slate-800/70 dark:text-slate-300">
                  <tr>
                    <th className="px-4 py-2.5">مشتری</th>
                    <th className="px-3 py-2.5">سطح</th>
                    <th className="px-3 py-2.5">امتیاز فعلی</th>
                    <th className="px-3 py-2.5">امتیاز کل</th>
                    <th className="px-3 py-2.5">کد معرف</th>
                    <th className="px-3 py-2.5">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {sortedLeaderboard.map((c) => {
                    const pts = c.loyaltyPoints ?? 0;
                    const life = c.lifetimePoints ?? pts;
                    const tier = computeLoyaltyTier(life, cfg);
                    const meta = TIER_META[tier];
                    return (
                      <tr key={c.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="px-4 py-2.5">
                          <div className="font-medium text-slate-900 dark:text-white">{c.name}</div>
                          <div className="text-[11px] text-slate-500 tabular-nums" dir="ltr">
                            {toFa(c.phone)}
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-medium ${meta.cls}`}
                          >
                            {meta.label}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 font-bold tabular-nums text-amber-600 dark:text-amber-400">
                          {toFa(pts)}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums text-slate-500">
                          {toFa(life)}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-[11px]">{c.referralCode ?? '—'}</td>
                        <td className="px-3 py-2.5">
                          <button
                            type="button"
                            onClick={() => {
                              setAdjCustId(c.id);
                              setAdjDelta(100);
                              setAdjDesc('پاداش ویژه وفاداری');
                            }}
                            className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                          >
                            تعدیل امتیاز
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Transactions */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              دفترکل تراکنش‌های امتیاز
            </h3>
            <div className="mt-3 space-y-2.5 max-h-[420px] overflow-y-auto">
              {transactions.slice(0, 20).map((tx) => (
                <div
                  key={tx.id}
                  className="rounded-lg border border-slate-100 p-2.5 text-xs dark:border-slate-800"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {tx.customerName}
                    </span>
                    <span
                      className={`font-bold tabular-nums ${
                        tx.points >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                      dir="ltr"
                    >
                      {tx.points >= 0 ? `+${toFa(tx.points)}` : toFa(tx.points)}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    {TX_TYPE_LABEL[tx.type]} — {tx.description}
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
                    <span>{formatJalaliDateTime(tx.at)}</span>
                    {tx.couponCode && <span className="font-mono text-indigo-500">{tx.couponCode}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Sub-Tab 2: Rewards Catalog */}
      {subTab === 'rewards' && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rewards.map((rw) => (
            <div
              key={rw.id}
              className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="rounded-lg bg-amber-50 p-2 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
                      <Tag size={16} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        {rw.title}
                      </h3>
                      <div className="text-xs text-slate-500">
                        تخفیف {toFa(rw.discountPct)}٪ • اعتبار {toFa(rw.validDays)} روز
                      </div>
                    </div>
                  </div>
                  <span
                    className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      rw.active
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    {rw.active ? 'فعال' : 'غیرفعال'}
                  </span>
                </div>

                <div className="mt-4 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs dark:bg-slate-800/50">
                  <span className="text-slate-500">هزینه دریافت:</span>
                  <span className="font-bold tabular-nums text-indigo-600 dark:text-indigo-400">
                    {toFa(rw.pointsCost)} امتیاز
                  </span>
                </div>
                {rw.minOrderAmount ? (
                  <p className="mt-2 text-[11px] text-slate-500">
                    حداقل مبلغ سفارش: {formatToman(rw.minOrderAmount)}
                  </p>
                ) : null}
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
                <span className="text-slate-500 tabular-nums">
                  {toFa(rw.redeemedCount)} بار دریافت شده
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleLoyaltyReward(rw.id)}
                    className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                  >
                    {rw.active ? 'غیرفعال' : 'فعال‌سازی'}
                  </button>
                  {rw.active && (
                    <button
                      type="button"
                      onClick={() => {
                        setRedeemRewardId(rw.id);
                        setRedeemResult(null);
                        setRedeemOpen(true);
                      }}
                      className="rounded-lg bg-indigo-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-indigo-700"
                    >
                      صدور برای مشتری
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sub-Tab 3: Birthdays & Occasions Automation */}
      {subTab === 'occasions' && (
        <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                اتوماسیون تبریک تولد و سالگرد آشنایی
              </h3>
              <p className="text-xs text-slate-500">
                با یک کلیک کد تخفیف اختصاصی ({toFa(cfg.birthdayDiscountPct)}٪) + {toFa(cfg.birthdayBonusPoints)} امتیاز هدیه به مشتری ارسال می‌شود.
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-600 dark:bg-slate-800/70 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-2.5">مشتری</th>
                  <th className="px-3 py-2.5">مناسبت</th>
                  <th className="px-3 py-2.5">تاریخ ثبت‌شده (جلالی)</th>
                  <th className="px-3 py-2.5">فاصله تا مناسبت</th>
                  <th className="px-3 py-2.5">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {upcomingOccasions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                      مناسبت یا تاریخ تولدی در پرونده مشتریان ثبت نشده است.
                    </td>
                  </tr>
                ) : (
                  upcomingOccasions.map((occ) => (
                    <tr key={`${occ.customerId}-${occ.type}`}>
                      <td className="px-4 py-2.5 font-medium">{occ.name}</td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                            occ.type === 'birthday'
                              ? 'bg-pink-100 text-pink-800 dark:bg-pink-950/60 dark:text-pink-300'
                              : 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300'
                          }`}
                        >
                          {occ.type === 'birthday' ? 'تولد' : 'سالگرد همکاری'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 tabular-nums">{toFa(occ.jalaliDate)}</td>
                      <td className="px-3 py-2.5 tabular-nums">
                        {occ.daysLeft === 0 ? (
                          <span className="font-bold text-emerald-600">امروز!</span>
                        ) : (
                          `${toFa(occ.daysLeft)} روز دیگر`
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <button
                          type="button"
                          onClick={() => sendOccasionReward(occ.customerId, occ.type)}
                          className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-indigo-700"
                        >
                          <Sparkles size={12} />
                          ارسال هدیه و کد تخفیف
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sub-Tab 4: Referral Codes */}
      {subTab === 'referrals' && (
        <div className="grid gap-5 lg:grid-cols-3">
          <form
            onSubmit={handleRegisterReferral}
            className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
              <UserPlus size={16} className="text-indigo-500" />
              ثبت معرفی مشتری جدید با کد معرف
            </div>
            <p className="text-xs text-slate-500">
              معرف {toFa(cfg.pointsPerReferral)} امتیاز و مشتری جدید {toFa(cfg.referredWelcomePoints)} امتیاز خوش‌آمدگویی می‌گیرد.
            </p>
            {refError && (
              <div className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                {refError}
              </div>
            )}
            <div>
              <label className="mb-1 block text-xs font-medium">کد معرف *</label>
              <input
                required
                value={refCodeInput}
                onChange={(e) => setRefCodeInput(e.target.value)}
                placeholder="مثلاً REF-SARA21"
                dir="ltr"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-mono dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">نام مشتری معرفی‌شده *</label>
              <input
                required
                value={refNameInput}
                onChange={(e) => setRefNameInput(e.target.value)}
                placeholder="نام کامل"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">موبایل مشتری جدید *</label>
              <input
                required
                value={refPhoneInput}
                onChange={(e) => setRefPhoneInput(e.target.value)}
                placeholder="09120000000"
                dir="ltr"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700"
            >
              ثبت معرفی و واریز امتیاز
            </button>
          </form>

          <div className="lg:col-span-2 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold dark:border-slate-800">
              کدهای معرفی مشتریان و آمار دعوت
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-600 dark:bg-slate-800/70 dark:text-slate-300">
                  <tr>
                    <th className="px-4 py-2.5">نام مشتری</th>
                    <th className="px-3 py-2.5">کد اختصاصی معرف</th>
                    <th className="px-3 py-2.5">تعداد معرفی موفق</th>
                    <th className="px-3 py-2.5">تست سریع</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {activeCustomers.map((c) => (
                    <tr key={c.id}>
                      <td className="px-4 py-2.5 font-medium">{c.name}</td>
                      <td className="px-3 py-2.5 font-mono text-indigo-600 dark:text-indigo-400">
                        {c.referralCode ?? '—'}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums">
                        {toFa(referralCounts.get(c.id) ?? 0)} نفر
                      </td>
                      <td className="px-3 py-2.5">
                        {c.referralCode && (
                          <button
                            type="button"
                            onClick={() => setRefCodeInput(c.referralCode!)}
                            className="rounded bg-slate-100 px-2 py-1 text-[11px] hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700"
                          >
                            انتخاب کد
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Sub-Tab 5: Loyalty Rules & Tier Thresholds */}
      {subTab === 'rules' && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              تنظیمات قوانین امتیازدهی و حد نصاب سطوح
            </h3>
            <label className="inline-flex items-center gap-2 text-xs font-medium">
              <input
                type="checkbox"
                checked={cfg.enabled}
                onChange={(e) => updateLoyaltyConfig({ enabled: e.target.checked })}
              />
              باشگاه مشتریان فعال باشد
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium">
                امتیاز به ازای هر ۱۰۰ هزار تومان خرید
              </label>
              <input
                type="number"
                min={0}
                value={cfg.pointsPer100kToman}
                onChange={(e) =>
                  updateLoyaltyConfig({ pointsPer100kToman: Number(e.target.value) || 0 })
                }
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">
                امتیاز هر نوبت / مراجعه تکمیل‌شده
              </label>
              <input
                type="number"
                min={0}
                value={cfg.pointsPerVisit}
                onChange={(e) =>
                  updateLoyaltyConfig({ pointsPerVisit: Number(e.target.value) || 0 })
                }
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">پاداش معرفی مشتری (معرف)</label>
              <input
                type="number"
                min={0}
                value={cfg.pointsPerReferral}
                onChange={(e) =>
                  updateLoyaltyConfig({ pointsPerReferral: Number(e.target.value) || 0 })
                }
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">حداقل امتیاز سطح نقره‌ای</label>
              <input
                type="number"
                min={0}
                value={cfg.silverMinPoints}
                onChange={(e) =>
                  updateLoyaltyConfig({ silverMinPoints: Number(e.target.value) || 0 })
                }
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">حداقل امتیاز سطح طلایی</label>
              <input
                type="number"
                min={0}
                value={cfg.goldMinPoints}
                onChange={(e) =>
                  updateLoyaltyConfig({ goldMinPoints: Number(e.target.value) || 0 })
                }
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">حداقل امتیاز سطح VIP</label>
              <input
                type="number"
                min={0}
                value={cfg.vipMinPoints}
                onChange={(e) =>
                  updateLoyaltyConfig({ vipMinPoints: Number(e.target.value) || 0 })
                }
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">امتیاز هدیه تولد / مناسبت</label>
              <input
                type="number"
                min={0}
                value={cfg.birthdayBonusPoints}
                onChange={(e) =>
                  updateLoyaltyConfig({ birthdayBonusPoints: Number(e.target.value) || 0 })
                }
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">درصد تخفیف کد تولد</label>
              <input
                type="number"
                min={1}
                max={100}
                value={cfg.birthdayDiscountPct}
                onChange={(e) =>
                  updateLoyaltyConfig({ birthdayDiscountPct: Number(e.target.value) || 10 })
                }
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">امتیاز خوش‌آمدگویی معرفی‌شده</label>
              <input
                type="number"
                min={0}
                value={cfg.referredWelcomePoints}
                onChange={(e) =>
                  updateLoyaltyConfig({ referredWelcomePoints: Number(e.target.value) || 0 })
                }
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>
        </div>
      )}

      {/* Add Reward Modal */}
      <Modal
        open={rewardOpen}
        onClose={() => setRewardOpen(false)}
        title="افزودن پاداش جدید باشگاه مشتریان"
        maxWidth="md"
      >
        <form onSubmit={handleAddReward} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium">عنوان پاداش *</label>
            <input
              required
              value={rwTitle}
              onChange={(e) => setRwTitle(e.target.value)}
              placeholder="مثلاً کد تخفیف ۱۵٪ خرید بعدی"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium">امتیاز لازم</label>
              <input
                type="number"
                min={10}
                value={rwPoints}
                onChange={(e) => setRwPoints(Number(e.target.value) || 100)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">درصد تخفیف</label>
              <input
                type="number"
                min={1}
                max={100}
                value={rwDiscountPct}
                onChange={(e) => setRwDiscountPct(Number(e.target.value) || 10)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium">حداقل سفارش (تومان)</label>
              <input
                type="number"
                min={0}
                step={100000}
                value={rwMinOrder}
                onChange={(e) => setRwMinOrder(Number(e.target.value) || 0)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">مدت اعتبار (روز)</label>
              <input
                type="number"
                min={1}
                value={rwValidDays}
                onChange={(e) => setRwValidDays(Number(e.target.value) || 30)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setRewardOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs dark:border-slate-700"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700"
            >
              ثبت پاداش
            </button>
          </div>
        </form>
      </Modal>

      {/* Redeem Reward Modal */}
      <Modal
        open={redeemOpen}
        onClose={() => setRedeemOpen(false)}
        title="تبدیل امتیاز مشتری به کد تخفیف"
        maxWidth="md"
      >
        <form onSubmit={handleRedeemSubmit} className="space-y-3">
          {redeemResult && (
            <div
              className={`rounded-lg px-3 py-2 text-xs font-medium ${
                redeemResult.ok
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                  : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
              }`}
            >
              {redeemResult.message}
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs font-medium">انتخاب مشتری</label>
            <select
              value={redeemCustId}
              onChange={(e) => setRedeemCustId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
            >
              {activeCustomers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} (موجودی: {toFa(c.loyaltyPoints ?? 0)} امتیاز)
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">انتخاب پاداش</label>
            <select
              value={redeemRewardId}
              onChange={(e) => setRedeemRewardId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
            >
              {rewards
                .filter((r) => r.active)
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title} ({toFa(r.pointsCost)} امتیاز)
                  </option>
                ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setRedeemOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs dark:border-slate-700"
            >
              بستن
            </button>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700"
            >
              تایید و صدور کد تخفیف
            </button>
          </div>
        </form>
      </Modal>

      {/* Adjust Customer Points Modal */}
      <Modal
        open={Boolean(adjCustId)}
        onClose={() => setAdjCustId('')}
        title="تعدیل دستی امتیاز مشتری"
        maxWidth="sm"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!adjCustId) return;
            adjustCustomerPoints(adjCustId, adjDelta, adjDesc);
            setAdjCustId('');
          }}
          className="space-y-3"
        >
          <div>
            <label className="mb-1 block text-xs font-medium">تغییر امتیاز (مثبت یا منفی)</label>
            <input
              type="number"
              value={adjDelta}
              onChange={(e) => setAdjDelta(Number(e.target.value) || 0)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">شرح تراکنش</label>
            <input
              required
              value={adjDesc}
              onChange={(e) => setAdjDesc(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setAdjCustId('')}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs dark:border-slate-700"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700"
            >
              ثبت تغییر
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
