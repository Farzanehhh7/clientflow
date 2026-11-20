import { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  Crown,
  Image as ImageIcon,
  Link2,
  Megaphone,
} from 'lucide-react';
import { CampaignsTab } from '../components/marketing/CampaignsTab';
import { ContentCalendarTab } from '../components/marketing/ContentCalendarTab';
import { LandingAttributionTab } from '../components/marketing/LandingAttributionTab';
import { LoyaltyClubTab } from '../components/marketing/LoyaltyClubTab';
import { MediaLibraryTab } from '../components/marketing/MediaLibraryTab';
import { getPackMarketingConfig } from '../data/packs';
import { useClientFlow } from '../store/useClientFlowStore';
import { toFa } from '../utils/jalali';

type MarketingTabKey = 'campaigns' | 'loyalty' | 'landing' | 'content' | 'media';

export function MarketingPage() {
  const { state } = useClientFlow();

  const marketingConfig = useMemo(
    () => getPackMarketingConfig(state.settings.industryPack, state.customPacks),
    [state.settings.industryPack, state.customPacks],
  );

  const [tab, setTab] = useState<MarketingTabKey>(
    marketingConfig.showContentCalendar ? 'content' : 'campaigns',
  );

  useEffect(() => {
    if (!marketingConfig.showContentCalendar && tab === 'content') {
      setTab('campaigns');
    }
  }, [marketingConfig.showContentCalendar, tab]);

  const tabs = useMemo(() => {
    const base: {
      key: MarketingTabKey;
      label: string;
      icon: typeof Megaphone;
      badge?: number;
    }[] = [
      {
        key: 'campaigns',
        label: 'کمپین‌ها و ROI',
        icon: Megaphone,
        badge: state.campaigns.length,
      },
      {
        key: 'loyalty',
        label: 'باشگاه مشتریان و امتیازات',
        icon: Crown,
        badge: (state.loyaltyRewards ?? []).filter((r) => r.active).length,
      },
      {
        key: 'landing',
        label: 'فرم‌های لندینگ و UTM',
        icon: Link2,
        badge: state.landingForms.length,
      },
      ...(marketingConfig.showContentCalendar
        ? [
            {
              key: 'content' as const,
              label: 'تقویم محتوا',
              icon: Calendar,
              badge: state.contentItems.length,
            },
          ]
        : []),
      {
        key: 'media',
        label: 'کتابخانه دارایی‌ها',
        icon: ImageIcon,
        badge: state.mediaAssets.length,
      },
    ];
    return base;
  }, [
    marketingConfig.showContentCalendar,
    state.campaigns.length,
    state.loyaltyRewards,
    state.landingForms.length,
    state.contentItems.length,
    state.mediaAssets.length,
  ]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            بازاریابی، باشگاه مشتریان و محتوا
          </h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            مدیریت کمپین‌های چندکاناله و تست A/B، باشگاه وفاداری، فرم‌های جذب سرنخ UTM و کتابخانه دارایی‌ها
          </p>
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-medium transition-colors ${
                active
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
              }`}
            >
              <Icon size={15} />
              <span>{t.label}</span>
              {t.badge !== undefined && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums ${
                    active
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {toFa(t.badge)}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Active Tab Content */}
      {tab === 'campaigns' && <CampaignsTab />}
      {tab === 'loyalty' && <LoyaltyClubTab />}
      {tab === 'landing' && <LandingAttributionTab />}
      {tab === 'content' && marketingConfig.showContentCalendar && <ContentCalendarTab />}
      {tab === 'media' && <MediaLibraryTab />}
    </div>
  );
}
