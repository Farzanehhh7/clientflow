import { useMemo, useState } from 'react';
import {
  BarChart2,
  CalendarClock,
  CheckCircle2,
  Eye,
  Mail,
  MessageSquare,
  Play,
  Plus,
  Send,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';
import { Modal } from '../Modal';
import { JalaliDatePicker } from '../ui/JalaliDatePicker';
import { draftCampaignCopyInBrandTone } from '../../services/aiService';
import { useClientFlow } from '../../store/useClientFlowStore';
import type {
  CampaignRecipientStatus,
  MarketingCampaign,
  NotificationChannel,
} from '../../types';
import { getSegmentMatchingCustomers } from '../../utils/crmHelpers';
import {
  formatJalaliDateTime,
  formatToman,
  getTodayJalaliAscii,
  jalaliToIsoUtc,
  toFa,
} from '../../utils/jalali';

const CHANNEL_LABEL: Record<NotificationChannel, string> = {
  sms: 'پیامک',
  whatsapp: 'واتساپ',
  email: 'ایمیل',
  push: 'نوتیفیکیشن',
  in_app: 'داخل برنامه',
};

const STATUS_BADGE: Record<
  MarketingCampaign['status'],
  { label: string; cls: string }
> = {
  draft: {
    label: 'پیش‌نویس',
    cls: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  },
  scheduled: {
    label: 'زمان‌بندی‌شده',
    cls: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
  },
  running: {
    label: 'در حال اجرا',
    cls: 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300',
  },
  completed: {
    label: 'تکمیل‌شده',
    cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
  },
};

const RECIPIENT_STATUS_META: Record<
  CampaignRecipientStatus,
  { label: string; cls: string }
> = {
  sent: {
    label: 'ارسال‌شده',
    cls: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  },
  delivered: {
    label: 'تحویل‌شده',
    cls: 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300',
  },
  clicked: {
    label: 'کلیک‌شده',
    cls: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
  },
  converted: {
    label: 'تبدیل‌شده',
    cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
  },
};

export function CampaignsTab() {
  const {
    state,
    addCampaign,
    launchCampaign,
    simulateCampaignStats,
    updateCampaignRecipientStatus,
    logAiUsage,
  } = useClientFlow();

  const [createOpen, setCreateOpen] = useState(false);
  const [cmpName, setCmpName] = useState('');
  const [cmpSegmentId, setCmpSegmentId] = useState(state.customerSegments[0]?.id ?? '');
  const [cmpChannel, setCmpChannel] = useState<NotificationChannel>('sms');
  const [cmpUtm, setCmpUtm] = useState('spring_promo');
  const [cmpScheduleMode, setCmpScheduleMode] = useState<'draft' | 'scheduled'>('draft');
  const [cmpScheduleJalali, setCmpScheduleJalali] = useState(() => getTodayJalaliAscii());
  const [cmpScheduleTime, setCmpScheduleTime] = useState('10:00');
  const [cmpCost, setCmpCost] = useState(1_500_000);
  const [cmpAbEnabled, setCmpAbEnabled] = useState(true);
  const [cmpSubjA, setCmpSubjA] = useState('پیشنهاد ویژه مشتریان وفادار');
  const [cmpBodyA, setCmpBodyA] = useState(
    'سلام {{customer.name}}، تا پایان هفته ۱۵٪ تخفیف ویژه شما فعال است.',
  );
  const [cmpSubjB, setCmpSubjB] = useState('مشاوره رایگان + هدیه اختصاصی');
  const [cmpBodyB, setCmpBodyB] = useState(
    '{{customer.name}} عزیز، یک هدیه اختصاصی برای شما ثبت شد.',
  );

  // Recipient tracking modal
  const [inspectCampaignId, setInspectCampaignId] = useState<string | null>(null);
  const [recFilter, setRecFilter] = useState<'all' | CampaignRecipientStatus>('all');
  const [showRoiTable, setShowRoiTable] = useState(true);

  const [aiOfferText, setAiOfferText] = useState('۱۵٪ تخفیف ویژه');
  const [aiDraftLoading, setAiDraftLoading] = useState(false);
  const [aiDraftMeta, setAiDraftMeta] = useState<string>('');

  const segmentTargetCount = useMemo(
    () => getSegmentMatchingCustomers(state, cmpSegmentId || undefined).length,
    [state, cmpSegmentId],
  );

  const roiSummary = useMemo(() => {
    let totalCost = 0;
    let totalRevenue = 0;
    let totalSent = 0;
    let totalDelivered = 0;
    let totalClicks = 0;
    let totalConversions = 0;

    const rows = state.campaigns.map((c) => {
      const sent = c.variantA.sent + (c.variantB?.sent ?? 0);
      const delivered =
        (c.variantA.delivered ?? c.variantA.sent) +
        (c.variantB ? c.variantB.delivered ?? c.variantB.sent : 0);
      const clicks = c.variantA.clicks + (c.variantB?.clicks ?? 0);
      const conversions = c.variantA.conversions + (c.variantB?.conversions ?? 0);
      const cost = c.cost ?? 0;
      const revenue = c.revenueGenerated ?? 0;
      const net = revenue - cost;
      const roiPct = cost > 0 ? Math.round((net / cost) * 100) : revenue > 0 ? 100 : 0;
      const ctr = delivered > 0 ? Math.round((clicks / delivered) * 1000) / 10 : 0;
      const cvr = sent > 0 ? Math.round((conversions / sent) * 1000) / 10 : 0;

      totalCost += cost;
      totalRevenue += revenue;
      totalSent += sent;
      totalDelivered += delivered;
      totalClicks += clicks;
      totalConversions += conversions;

      return {
        campaign: c,
        sent,
        delivered,
        clicks,
        conversions,
        cost,
        revenue,
        net,
        roiPct,
        ctr,
        cvr,
      };
    });

    const netTotal = totalRevenue - totalCost;
    const totalRoiPct =
      totalCost > 0 ? Math.round((netTotal / totalCost) * 100) : totalRevenue > 0 ? 100 : 0;

    return {
      rows,
      totalCost,
      totalRevenue,
      netTotal,
      totalRoiPct,
      totalSent,
      totalDelivered,
      totalClicks,
      totalConversions,
    };
  }, [state.campaigns]);

  const inspectedCampaign = useMemo(
    () => state.campaigns.find((c) => c.id === inspectCampaignId) ?? null,
    [state.campaigns, inspectCampaignId],
  );

  const filteredRecipients = useMemo(() => {
    if (!inspectedCampaign?.recipients) return [];
    if (recFilter === 'all') return inspectedCampaign.recipients;
    return inspectedCampaign.recipients.filter((r) => r.status === recFilter);
  }, [inspectedCampaign, recFilter]);

  const handleCreateCampaign = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cmpName.trim()) return;

    let scheduledAtIso: string | undefined;
    if (cmpScheduleMode === 'scheduled') {
      const baseIso = jalaliToIsoUtc(cmpScheduleJalali) ?? new Date().toISOString();
      const [hh, mm] = cmpScheduleTime.split(':').map((v) => Number(v) || 0);
      const d = new Date(baseIso);
      d.setHours(hh, mm, 0, 0);
      scheduledAtIso = d.toISOString();
    }

    addCampaign({
      name: cmpName.trim(),
      segmentId: cmpSegmentId || undefined,
      channel: cmpChannel,
      status: cmpScheduleMode === 'scheduled' ? 'scheduled' : 'draft',
      scheduledAt: scheduledAtIso,
      cost: Math.max(0, cmpCost),
      revenueGenerated: 0,
      abTestEnabled: cmpAbEnabled,
      utmCampaign: cmpUtm.trim() || 'campaign',
      variantA: {
        subject: cmpSubjA.trim(),
        body: cmpBodyA.trim(),
        sent: 0,
        delivered: 0,
        clicks: 0,
        conversions: 0,
      },
      variantB: cmpAbEnabled
        ? {
            subject: cmpSubjB.trim(),
            body: cmpBodyB.trim(),
            sent: 0,
            delivered: 0,
            clicks: 0,
            conversions: 0,
          }
        : undefined,
    });
    setCmpName('');
    setCreateOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header + Action */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            کمپین‌های چندکاناله، تست A/B و تحلیل ROI
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            ارسال زمان‌بندی‌شده یا فوری به سگمنت‌های پویا، پیگیری وضعیت گیرندگان و محاسبه بازگشت سرمایه
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowRoiTable((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <BarChart2 size={15} />
            {showRoiTable ? 'بستن گزارش ROI' : 'گزارش ROI کمپین‌ها'}
          </button>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-medium text-white shadow-sm hover:bg-indigo-700"
          >
            <Plus size={15} />
            کمپین جدید
          </button>
        </div>
      </div>

      {/* ROI Summary Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs text-slate-500 dark:text-slate-400">کل بودجه کمپین‌ها</div>
          <div className="mt-1 text-lg font-bold tabular-nums text-slate-900 dark:text-white">
            {formatToman(roiSummary.totalCost)}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs text-slate-500 dark:text-slate-400">درآمد انتسابی</div>
          <div className="mt-1 text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
            {formatToman(roiSummary.totalRevenue)}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs text-slate-500 dark:text-slate-400">نرخ بازگشت سرمایه (ROI)</div>
          <div
            className={`mt-1 text-lg font-bold tabular-nums ${
              roiSummary.totalRoiPct >= 0
                ? 'text-indigo-600 dark:text-indigo-400'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {toFa(roiSummary.totalRoiPct)}٪
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs text-slate-500 dark:text-slate-400">کلیک / تبدیل کل</div>
          <div className="mt-1 text-lg font-bold tabular-nums text-slate-900 dark:text-white">
            {toFa(roiSummary.totalClicks)} / {toFa(roiSummary.totalConversions)}
          </div>
        </div>
      </div>

      {/* ROI Comparison Table */}
      {showRoiTable && roiSummary.rows.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
              <TrendingUp size={16} className="text-indigo-500" />
              گزارش عملکرد و ROI کمپین‌ها
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              تعداد کل: {toFa(roiSummary.rows.length)}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-600 dark:bg-slate-800/70 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-2.5 font-medium">نام کمپین</th>
                  <th className="px-3 py-2.5 font-medium">کانال</th>
                  <th className="px-3 py-2.5 font-medium">ارسال / تحویل</th>
                  <th className="px-3 py-2.5 font-medium">نرخ کلیک (CTR)</th>
                  <th className="px-3 py-2.5 font-medium">نرخ تبدیل (CVR)</th>
                  <th className="px-3 py-2.5 font-medium">هزینه</th>
                  <th className="px-3 py-2.5 font-medium">درآمد</th>
                  <th className="px-3 py-2.5 font-medium">ROI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {roiSummary.rows.map((r) => (
                  <tr key={r.campaign.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-white">
                      {r.campaign.name}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {CHANNEL_LABEL[r.campaign.channel]}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums whitespace-nowrap">
                      {toFa(r.sent)} / {toFa(r.delivered)}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums whitespace-nowrap">
                      {toFa(r.ctr)}٪
                    </td>
                    <td className="px-3 py-2.5 tabular-nums whitespace-nowrap">
                      {toFa(r.cvr)}٪
                    </td>
                    <td className="px-3 py-2.5 tabular-nums whitespace-nowrap">
                      {formatToman(r.cost)}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums whitespace-nowrap text-emerald-600 dark:text-emerald-400">
                      {formatToman(r.revenue)}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums whitespace-nowrap font-semibold">
                      <span
                        className={
                          r.roiPct >= 0
                            ? 'text-indigo-600 dark:text-indigo-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }
                      >
                        {toFa(r.roiPct)}٪
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Campaign Cards */}
      <div className="grid gap-4 lg:grid-cols-2">
        {state.campaigns.map((cmp) => {
          const seg = state.customerSegments.find((s) => s.id === cmp.segmentId);
          const segCount = getSegmentMatchingCustomers(state, cmp.segmentId).length;
          const badge = STATUS_BADGE[cmp.status];
          const sentTotal = cmp.variantA.sent + (cmp.variantB?.sent ?? 0);
          const deliveredTotal =
            (cmp.variantA.delivered ?? cmp.variantA.sent) +
            (cmp.variantB ? cmp.variantB.delivered ?? cmp.variantB.sent : 0);
          const clicksTotal = cmp.variantA.clicks + (cmp.variantB?.clicks ?? 0);
          const convTotal = cmp.variantA.conversions + (cmp.variantB?.conversions ?? 0);
          const cost = cmp.cost ?? 0;
          const rev = cmp.revenueGenerated ?? 0;
          const roiPct = cost > 0 ? Math.round(((rev - cost) / cost) * 100) : rev > 0 ? 100 : 0;

          return (
            <div
              key={cmp.id}
              className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <div>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      {cmp.channel === 'email' ? (
                        <Mail size={16} className="text-indigo-500" />
                      ) : (
                        <MessageSquare size={16} className="text-emerald-500" />
                      )}
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        {cmp.name}
                      </h3>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span>سگمنت: {seg?.name ?? 'کل مشتریان'} ({toFa(segCount)} نفر)</span>
                      <span>•</span>
                      <span className="font-mono">utm: {cmp.utmCampaign}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-medium ${badge.cls}`}
                    >
                      {badge.label}
                    </span>
                    <span className="whitespace-nowrap rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-medium text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                      {CHANNEL_LABEL[cmp.channel]}
                    </span>
                  </div>
                </div>

                {cmp.scheduledAt && cmp.status === 'scheduled' && (
                  <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                    <CalendarClock size={14} />
                    <span>زمان ارسال خودکار: {formatJalaliDateTime(cmp.scheduledAt)}</span>
                  </div>
                )}

                {/* Variants */}
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div
                    className={`rounded-lg border p-3 ${
                      cmp.winner === 'A'
                        ? 'border-emerald-400 bg-emerald-50/50 dark:border-emerald-700 dark:bg-emerald-950/20'
                        : 'border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span>نسخه A</span>
                      {cmp.winner === 'A' && (
                        <span className="text-[11px] text-emerald-600 dark:text-emerald-400">
                          برنده تست
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-xs font-medium text-slate-800 dark:text-slate-200">
                      {cmp.variantA.subject}
                    </div>
                    <p className="mt-1 line-clamp-2 text-[11px] text-slate-500 dark:text-slate-400">
                      {cmp.variantA.body}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] tabular-nums text-slate-600 dark:text-slate-300">
                      <span>ارسال: {toFa(cmp.variantA.sent)}</span>
                      <span>کلیک: {toFa(cmp.variantA.clicks)}</span>
                      <span>تبدیل: {toFa(cmp.variantA.conversions)}</span>
                    </div>
                  </div>

                  {cmp.abTestEnabled && cmp.variantB && (
                    <div
                      className={`rounded-lg border p-3 ${
                        cmp.winner === 'B'
                          ? 'border-emerald-400 bg-emerald-50/50 dark:border-emerald-700 dark:bg-emerald-950/20'
                          : 'border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-800/40'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span>نسخه B</span>
                        {cmp.winner === 'B' && (
                          <span className="text-[11px] text-emerald-600 dark:text-emerald-400">
                            برنده تست
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-xs font-medium text-slate-800 dark:text-slate-200">
                        {cmp.variantB.subject}
                      </div>
                      <p className="mt-1 line-clamp-2 text-[11px] text-slate-500 dark:text-slate-400">
                        {cmp.variantB.body}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2 text-[11px] tabular-nums text-slate-600 dark:text-slate-300">
                        <span>ارسال: {toFa(cmp.variantB.sent)}</span>
                        <span>کلیک: {toFa(cmp.variantB.clicks)}</span>
                        <span>تبدیل: {toFa(cmp.variantB.conversions)}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Funnel & ROI Strip */}
                <div className="mt-3 grid grid-cols-4 gap-2 rounded-lg bg-slate-50 p-2.5 text-center text-[11px] dark:bg-slate-800/50">
                  <div>
                    <div className="text-slate-500 dark:text-slate-400">ارسال / تحویل</div>
                    <div className="mt-0.5 font-semibold tabular-nums">
                      {toFa(sentTotal)} / {toFa(deliveredTotal)}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500 dark:text-slate-400">کلیک</div>
                    <div className="mt-0.5 font-semibold tabular-nums">{toFa(clicksTotal)}</div>
                  </div>
                  <div>
                    <div className="text-slate-500 dark:text-slate-400">تبدیل</div>
                    <div className="mt-0.5 font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                      {toFa(convTotal)}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500 dark:text-slate-400">ROI</div>
                    <div className="mt-0.5 font-semibold tabular-nums text-indigo-600 dark:text-indigo-400">
                      {toFa(roiPct)}٪
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {cmp.launchedAt
                    ? `اجرا: ${formatJalaliDateTime(cmp.launchedAt)}`
                    : `بودجه: ${formatToman(cost)}`}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {(cmp.recipients?.length ?? 0) > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setInspectCampaignId(cmp.id);
                        setRecFilter('all');
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <Users size={13} />
                      گیرندگان ({toFa(cmp.recipients?.length ?? 0)})
                    </button>
                  )}
                  {(cmp.status === 'draft' || cmp.status === 'scheduled') && (
                    <button
                      type="button"
                      onClick={() => launchCampaign(cmp.id)}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                    >
                      <Play size={13} />
                      اجرای فوری
                    </button>
                  )}
                  {(cmp.status === 'running' || cmp.status === 'completed') && (
                    <button
                      type="button"
                      onClick={() => simulateCampaignStats(cmp.id)}
                      className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2.5 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:text-indigo-300 dark:hover:bg-indigo-900/60"
                    >
                      <Sparkles size={13} />
                      به‌روزرسانی آمار تعامل
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Campaign Modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="ایجاد کمپین بازاریابی جدید"
        maxWidth="xl"
      >
        <form onSubmit={handleCreateCampaign} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium">نام کمپین *</label>
              <input
                required
                value={cmpName}
                onChange={(e) => setCmpName(e.target.value)}
                placeholder="مثلاً کمپین ویژه مشتریان VIP"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">سگمنت هدف</label>
              <select
                value={cmpSegmentId}
                onChange={(e) => setCmpSegmentId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="">همه مشتریان فعال</option>
                {state.customerSegments.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-indigo-600 dark:text-indigo-400">
                تعداد مخاطب واجد شرایط فعلی: {toFa(segmentTargetCount)} نفر
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium">کانال ارسال</label>
              <select
                value={cmpChannel}
                onChange={(e) => setCmpChannel(e.target.value as NotificationChannel)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="sms">پیامک (SMS)</option>
                <option value="whatsapp">واتساپ</option>
                <option value="email">ایمیل</option>
                <option value="push">نوتیفیکیشن</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">هزینه کمپین (تومان)</label>
              <input
                type="number"
                min={0}
                step={50000}
                value={cmpCost}
                onChange={(e) => setCmpCost(Number(e.target.value) || 0)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">تگ UTM Campaign</label>
              <input
                value={cmpUtm}
                onChange={(e) => setCmpUtm(e.target.value)}
                dir="ltr"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-mono dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>

          {/* Scheduling */}
          <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <label className="inline-flex items-center gap-1.5 font-medium">
                <input
                  type="radio"
                  checked={cmpScheduleMode === 'draft'}
                  onChange={() => setCmpScheduleMode('draft')}
                />
                ذخیره به عنوان پیش‌نویس (ارسال دستی)
              </label>
              <label className="inline-flex items-center gap-1.5 font-medium">
                <input
                  type="radio"
                  checked={cmpScheduleMode === 'scheduled'}
                  onChange={() => setCmpScheduleMode('scheduled')}
                />
                زمان‌بندی ارسال خودکار (جلالی)
              </label>
            </div>
            {cmpScheduleMode === 'scheduled' && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <JalaliDatePicker
                  label="تاریخ ارسال"
                  value={cmpScheduleJalali}
                  onChange={setCmpScheduleJalali}
                />
                <div>
                  <label className="mb-1 block text-xs font-medium">ساعت ارسال</label>
                  <input
                    type="time"
                    value={cmpScheduleTime}
                    onChange={(e) => setCmpScheduleTime(e.target.value)}
                    dir="ltr"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
              </div>
            )}
          </div>

          {/* AI Brand-Tone Draft Copy Helper */}
          {state.settings.ai?.enabled !== false && (
            <div className="space-y-2 rounded-lg border border-indigo-200/80 bg-indigo-50/40 p-3 text-xs dark:border-indigo-900/50 dark:bg-indigo-950/20">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 font-semibold text-indigo-800 dark:text-indigo-200">
                  <Sparkles size={13} className="text-indigo-600 dark:text-indigo-400" />
                  تولید متن پیامک / کمپین مطابق لحن برند سازمان (A/B)
                </span>
                {aiDraftMeta && (
                  <span className="rounded bg-white px-2 py-0.5 text-[10px] font-semibold text-indigo-700 dark:bg-slate-900 dark:text-indigo-300">
                    {aiDraftMeta}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={aiOfferText}
                  onChange={(e) => setAiOfferText(e.target.value)}
                  placeholder="پیشنهاد/تخفیف کمپین (مثلاً ۱۵٪ تخفیف وفاداری)"
                  className="min-w-[200px] flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
                />
                <button
                  type="button"
                  disabled={aiDraftLoading}
                  onClick={async () => {
                    setAiDraftLoading(true);
                    setAiDraftMeta('');
                    const segName =
                      state.customerSegments.find((s) => s.id === cmpSegmentId)?.name ?? 'کل مشتریان';
                    const res = await draftCampaignCopyInBrandTone(
                      state,
                      {
                        goal: cmpName.trim() || 'جشنواره ویژه مشتریان',
                        channel: cmpChannel,
                        audienceLabel: segName,
                        discountText: aiOfferText,
                      },
                      logAiUsage,
                    );
                    setAiDraftLoading(false);
                    if (res.ok) {
                      setCmpSubjA(res.data.subjectA);
                      setCmpBodyA(res.data.bodyA);
                      setCmpSubjB(res.data.subjectB);
                      setCmpBodyB(res.data.bodyB);
                      setCmpAbEnabled(true);
                      setAiDraftMeta(
                        `تولیدشده با هوش مصنوعی (AI-generated) · لحن: ${res.data.toneLabel}`,
                      );
                    } else {
                      setAiDraftMeta(res.error);
                    }
                  }}
                  className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
                >
                  <Sparkles size={12} />
                  {aiDraftLoading ? 'در حال نگارش...' : 'نگارش دو نسخه A/B با AI'}
                </button>
              </div>
            </div>
          )}

          {/* A/B Toggle + Variant Content */}
          <label className="flex items-center gap-2 text-xs font-medium">
            <input
              type="checkbox"
              checked={cmpAbEnabled}
              onChange={(e) => setCmpAbEnabled(e.target.checked)}
            />
            فعال‌سازی تست A/B (ارسال ۵۰/۵۰ بین دو متن مختلف)
          </label>

          <div className={`grid gap-3 ${cmpAbEnabled ? 'sm:grid-cols-2' : ''}`}>
            <div className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
              <div className="flex items-center justify-between text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                <span>نسخه A</span>
                <span className="text-[10px] font-normal tabular-nums text-slate-400">
                  {toFa(cmpBodyA.length)} کاراکتر
                </span>
              </div>
              <input
                value={cmpSubjA}
                onChange={(e) => setCmpSubjA(e.target.value)}
                placeholder="عنوان پیام A"
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
              <textarea
                rows={3}
                value={cmpBodyA}
                onChange={(e) => setCmpBodyA(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
            </div>

            {cmpAbEnabled && (
              <div className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  نسخه B
                </div>
                <input
                  value={cmpSubjB}
                  onChange={(e) => setCmpSubjB(e.target.value)}
                  placeholder="عنوان پیام B"
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
                <textarea
                  rows={3}
                  value={cmpBodyB}
                  onChange={(e) => setCmpBodyB(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium dark:border-slate-700"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700"
            >
              <Send size={14} />
              ثبت کمپین
            </button>
          </div>
        </form>
      </Modal>

      {/* Recipient Status Modal */}
      <Modal
        open={Boolean(inspectedCampaign)}
        onClose={() => setInspectCampaignId(null)}
        title={
          inspectedCampaign
            ? `پیگیری وضعیت گیرندگان: ${inspectedCampaign.name}`
            : 'گیرندگان کمپین'
        }
        maxWidth="2xl"
      >
        {inspectedCampaign && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1.5">
                {(['all', 'sent', 'delivered', 'clicked', 'converted'] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setRecFilter(k)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                      recFilter === k
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {k === 'all' ? 'همه' : RECIPIENT_STATUS_META[k].label}
                  </button>
                ))}
              </div>
              <span className="text-xs text-slate-500">
                نمایش {toFa(filteredRecipients.length)} گیرنده
              </span>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-600 dark:bg-slate-800/70 dark:text-slate-300">
                  <tr>
                    <th className="px-3 py-2">نام مشتری</th>
                    <th className="px-3 py-2">موبایل</th>
                    <th className="px-3 py-2">نسخه</th>
                    <th className="px-3 py-2">وضعیت فعلی</th>
                    <th className="px-3 py-2">تغییر وضعیت</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredRecipients.map((r) => {
                    const meta = RECIPIENT_STATUS_META[r.status];
                    return (
                      <tr key={r.id}>
                        <td className="px-3 py-2 font-medium">{r.customerName}</td>
                        <td className="px-3 py-2 tabular-nums" dir="ltr">
                          {toFa(r.phone)}
                        </td>
                        <td className="px-3 py-2">نسخه {r.variant}</td>
                        <td className="px-3 py-2">
                          <span
                            className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.cls}`}
                          >
                            {meta.label}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-1">
                            {r.status !== 'delivered' && (
                              <button
                                type="button"
                                onClick={() =>
                                  updateCampaignRecipientStatus(
                                    inspectedCampaign.id,
                                    r.id,
                                    'delivered',
                                  )
                                }
                                className="inline-flex items-center gap-1 rounded bg-sky-50 px-2 py-1 text-[11px] text-sky-700 hover:bg-sky-100 dark:bg-sky-950/60 dark:text-sky-300"
                              >
                                <CheckCircle2 size={11} />
                                تحویل
                              </button>
                            )}
                            {r.status !== 'clicked' && (
                              <button
                                type="button"
                                onClick={() =>
                                  updateCampaignRecipientStatus(
                                    inspectedCampaign.id,
                                    r.id,
                                    'clicked',
                                  )
                                }
                                className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-1 text-[11px] text-amber-700 hover:bg-amber-100 dark:bg-amber-950/60 dark:text-amber-300"
                              >
                                <Eye size={11} />
                                کلیک
                              </button>
                            )}
                            {r.status !== 'converted' && (
                              <button
                                type="button"
                                onClick={() =>
                                  updateCampaignRecipientStatus(
                                    inspectedCampaign.id,
                                    r.id,
                                    'converted',
                                  )
                                }
                                className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-1 text-[11px] text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300"
                              >
                                تبدیل (خرید)
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
        )}
      </Modal>
    </div>
  );
}
