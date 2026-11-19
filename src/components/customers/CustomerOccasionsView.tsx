import { useMemo, useState } from 'react';
import { Cake, Send, Sparkles } from 'lucide-react';
import { useClientFlow } from '../../store/useClientFlowStore';
import type { Customer } from '../../types';
import { toFa } from '../../utils/jalali';
import { Badge, Button, EmptyState, Select } from '../ui';

interface OccasionEntry {
  customer: Customer;
  kind: 'birthday' | 'anniversary';
  jalaliDate: string;
  daysLeft: number;
}

interface CustomerOccasionsViewProps {
  occasions: OccasionEntry[];
  onOpenCustomer: (customerId: string) => void;
}

export function CustomerOccasionsView({ occasions, onOpenCustomer }: CustomerOccasionsViewProps) {
  const { sendBirthdayGreeting } = useClientFlow();
  const [range, setRange] = useState<'all' | 'today' | '7' | '30'>('all');

  const filtered = useMemo(() => {
    if (range === 'today') return occasions.filter((o) => o.daysLeft === 0);
    if (range === '7') return occasions.filter((o) => o.daysLeft <= 7);
    if (range === '30') return occasions.filter((o) => o.daysLeft <= 30);
    return occasions;
  }, [occasions, range]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            <Cake size={17} className="text-rose-500" />
            تقویم تولد و سالگرد همراهی مشتریان (شمسی)
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            مشتریان دارای رضایت پیامک می‌توانند پیامک تبریک خودکار یا دستی دریافت کنند.
          </p>
        </div>

        <div className="w-44">
          <Select
            aria-label="بازه زمانی مناسبت‌ها"
            value={range}
            onChange={(e) => setRange(e.target.value as 'all' | 'today' | '7' | '30')}
            options={[
              { value: 'all', label: 'همه مناسبت‌ها' },
              { value: 'today', label: 'فقط امروز' },
              { value: '7', label: '۷ روز آینده' },
              { value: '30', label: '۳۰ روز آینده' },
            ]}
          />
        </div>
      </div>

      <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
        {filtered.length === 0 ? (
          <EmptyState
            icon={<Cake size={28} />}
            title="مناسبتی در این بازه یافت نشد"
            description="برای نمایش در تقویم، تاریخ تولد یا سالگرد شمسی را در فرم مشتری ثبت کنید."
          />
        ) : (
          filtered.map((item, idx) => (
            <div
              key={`${item.customer.id}_${item.kind}_${idx}`}
              className="flex flex-wrap items-center justify-between gap-3 p-4"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                  <button
                    type="button"
                    onClick={() => onOpenCustomer(item.customer.id)}
                    className="text-slate-900 hover:text-indigo-600 dark:text-slate-100 dark:hover:text-indigo-400"
                  >
                    {item.customer.name}
                  </button>
                  <Badge tone={item.kind === 'birthday' ? 'rose' : 'indigo'}>
                    {item.kind === 'birthday' ? 'تولد' : 'سالگرد همکاری'}
                  </Badge>
                  {item.daysLeft === 0 && (
                    <Badge tone="emerald">
                      <Sparkles size={11} />
                      امروز!
                    </Badge>
                  )}
                  {item.customer.consentSms === false && (
                    <Badge tone="amber">بدون رضایت پیامک</Badge>
                  )}
                </div>
                <div className="mt-1 text-xs tabular-nums text-slate-500 dark:text-slate-400">
                  تاریخ شمسی: {toFa(item.jalaliDate)} ·{' '}
                  {item.daysLeft === 0 ? 'مناسبت امروز است' : `${toFa(item.daysLeft)} روز مانده`}
                </div>
              </div>

              <Button
                variant="secondary"
                size="sm"
                disabled={item.customer.consentSms === false}
                onClick={() => sendBirthdayGreeting(item.customer.id, item.kind)}
              >
                <Send size={13} />
                ارسال پیامک تبریک
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
