import { Plus, Trash2, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Modal } from '../Modal';
import { useClientFlow } from '../../store/useClientFlowStore';
import type {
  NotificationChannel,
  Rule,
  RuleAction,
  RuleActionType,
  RuleCondition,
  RuleConditionOp,
  RuleScheduleCron,
  RuleTargetEntity,
  RuleTriggerType,
} from '../../types';
import { getNormalizedRuleActions } from '../../utils/automationEngine';
import { toFa } from '../../utils/jalali';

const TRIGGER_LABELS: Record<RuleTriggerType, string> = {
  schedule: 'زمان‌بندی دوره‌ای (Cron-Lite)',
  on_create: 'در لحظه ایجاد رکورد (OnCreate)',
  on_update: 'در لحظه ویرایش رکورد (OnUpdate)',
  on_stage_change: 'در لحظه تغییر وضعیت/مرحله (OnStageChange)',
  on_webhook: 'دریافت وب‌هوک بیرونی (OnWebhook)',
  on_event: 'رویداد سفارشی سیستم (OnEvent)',
  on_ticket_create: 'در لحظه ثبت تیکت پشتیبانی',
};

const CRON_LABELS: Record<RuleScheduleCron, string> = {
  every_30s: 'هر ۳۰ ثانیه (زمان‌بند پیش‌فرض)',
  every_5m: 'هر ۵ دقیقه',
  hourly: 'ساعتی (Hourly)',
  daily_09: 'روزانه رأس ساعت ۰۹:۰۰',
};

const ENTITY_LABELS: Record<RuleTargetEntity, string> = {
  customer: 'مشتری',
  order: 'سفارش',
  appointment: 'نوبت',
  opportunity: 'فرصت فروش',
  ticket: 'تیکت',
};

const ENTITY_FIELDS: Record<RuleTargetEntity, { value: string; label: string; isDate?: boolean }[]> = {
  customer: [
    { value: 'lifecycle', label: 'چرخه عمر (lead / active / vip / churned)' },
    { value: 'source', label: 'منبع جذب' },
    { value: 'tags', label: 'برچسب‌ها' },
    { value: 'personType', label: 'نوع شخصیت (individual / organization)' },
    { value: 'consentSms', label: 'رضایت پیامک (true / false)' },
    { value: 'createdAt', label: 'تاریخ ثبت مشتری (زمانی)', isDate: true },
  ],
  order: [
    { value: 'status', label: 'وضعیت سفارش (new / confirmed / shipped / delivered)' },
    { value: 'channel', label: 'کانال ثبت سفارش (phone / website / instagram / whatsapp / store)' },
    { value: 'amount', label: 'مبلغ کل سفارش (تومان)' },
    { value: 'customer.lifecycle', label: 'چرخه عمر مشتری' },
    { value: 'createdAt', label: 'زمان ثبت سفارش (زمانی)', isDate: true },
  ],
  appointment: [
    { value: 'status', label: 'وضعیت نوبت (booked / confirmed / checked_in / done / cancelled)' },
    { value: 'start', label: 'زمان شروع نوبت (زمانی)', isDate: true },
    { value: 'end', label: 'زمان پایان نوبت (زمانی)', isDate: true },
    { value: 'customer.lifecycle', label: 'چرخه عمر مشتری' },
  ],
  opportunity: [
    { value: 'stage', label: 'مرحله قیف (lead / contacted / proposal / negotiation / won / lost)' },
    { value: 'amount', label: 'مبلغ معامله (تومان)' },
    { value: 'source', label: 'منبع سرنخ' },
    { value: 'expectedCloseDate', label: 'تاریخ پیش‌بینی بسته شدن (زمانی)', isDate: true },
    { value: 'createdAt', label: 'زمان ایجاد فرصت (زمانی)', isDate: true },
  ],
  ticket: [
    { value: 'priority', label: 'اولویت (low / normal / high)' },
    { value: 'severity', label: 'شدت (minor / major / critical)' },
    { value: 'status', label: 'وضعیت تیکت (open / in_progress / pending / resolved / closed)' },
    { value: 'category', label: 'دسته‌بندی تیکت' },
    { value: 'createdAt', label: 'زمان ثبت تیکت (زمانی)', isDate: true },
  ],
};

const CONDITION_OP_LABELS: Record<RuleConditionOp, string> = {
  eq: 'مساوی (=)',
  neq: 'نامساوی (≠)',
  contains: 'شامل باشد (فازی)',
  gte: 'بزرگتر مساوی (≥)',
  lte: 'کوچکتر مساوی (≤)',
  within_next_hours: 'در X ساعت آینده',
  older_than_hours: 'گذشت بیش از X ساعت',
  before_rel: 'قبل از زمان نسبی (now±...)',
  after_rel: 'بعد از زمان نسبی (now±...)',
};

const ACTION_TYPE_LABELS: Record<RuleActionType, string> = {
  send_sms: 'ارسال پیامک (شبیه‌سازی)',
  send_whatsapp: 'ارسال پیام واتساپ (شبیه‌سازی)',
  send_email: 'ارسال ایمیل (شبیه‌سازی)',
  create_task: 'ایجاد وظیفه پیگیری',
  update_field: 'به‌روزرسانی مقدار فیلد',
  change_stage: 'تغییر مرحله / وضعیت',
  assign_owner: 'تخصیص مسئول (یا چرخشی)',
  add_tag: 'افزودن برچسب به مشتری',
  create_ticket: 'ایجاد تیکت پشتیبانی',
  call_webhook: 'فراخوانی وب‌هوک بیرونی (شبیه‌سازی)',
};

const TEMPLATE_VARS = [
  '{{customer.name}}',
  '{{customer.phone}}',
  '{{appointment.date}}',
  '{{appointment.hour}}',
  '{{appointment.service}}',
  '{{order.id}}',
  '{{order.total}}',
  '{{ticket.trackingCode}}',
  '{{businessName}}',
];

const REL_PRESETS = ['now+24h', 'now+48h', 'now-24h', 'now+7d'];

type Props = {
  open: boolean;
  onClose: () => void;
  editingRule?: Rule | null;
};

export function RuleBuilderModal({ open, onClose, editingRule }: Props) {
  const { state, addRule, updateRule } = useClientFlow();

  const [ruleName, setRuleName] = useState('');
  const [pack, setPack] = useState<NonNullable<Rule['pack']>>('all');
  const [triggerType, setTriggerType] = useState<RuleTriggerType>('schedule');
  const [scheduleCron, setScheduleCron] = useState<RuleScheduleCron>('every_30s');
  const [webhookTopic, setWebhookTopic] = useState('lead_captured');
  const [eventName, setEventName] = useState('vip_upgraded');
  const [targetEntity, setTargetEntity] = useState<RuleTargetEntity>('customer');
  const [conditionLogic, setConditionLogic] = useState<'AND' | 'OR' | 'NOT'>('AND');
  const [conditions, setConditions] = useState<RuleCondition[]>([
    { id: 'c1', field: 'lifecycle', op: 'eq', value: 'vip' },
  ]);
  const [actions, setActions] = useState<RuleAction[]>([
    {
      id: 'a1',
      type: 'send_sms',
      channel: 'sms',
      messageTemplate: 'سلام {{customer.name}} عزیز، پیام اطلاع‌رسانی ویژه از {{businessName}}.',
    },
  ]);
  const [cooldownMinutes, setCooldownMinutes] = useState(60);
  const [dailyCapPerCustomer, setDailyCapPerCustomer] = useState(3);
  const [allowRepeat, setAllowRepeat] = useState(false);
  const [respectQuietHours, setRespectQuietHours] = useState(true);

  useEffect(() => {
    if (!open) return;
    if (editingRule) {
      setRuleName(editingRule.name);
      setPack(editingRule.pack ?? 'all');
      setTriggerType(editingRule.triggerType ?? 'schedule');
      setScheduleCron(editingRule.scheduleCron ?? 'every_30s');
      setWebhookTopic(editingRule.webhookTopic ?? 'lead_captured');
      setEventName(editingRule.eventName ?? 'custom_event');
      setTargetEntity(editingRule.targetEntity ?? 'customer');
      setConditionLogic(editingRule.conditionLogic ?? 'AND');
      setConditions(
        editingRule.conditions && editingRule.conditions.length > 0
          ? editingRule.conditions
          : [{ id: 'c1', field: ENTITY_FIELDS[editingRule.targetEntity ?? 'customer'][0].value, op: 'eq', value: '' }],
      );
      setActions(getNormalizedRuleActions(editingRule));
      setCooldownMinutes(editingRule.cooldownMinutes ?? 0);
      setDailyCapPerCustomer(editingRule.dailyCapPerCustomer ?? 3);
      setAllowRepeat(Boolean(editingRule.allowRepeat));
      setRespectQuietHours(editingRule.respectQuietHours ?? true);
    } else {
      setRuleName('');
      setPack('all');
      setTriggerType('schedule');
      setScheduleCron('every_30s');
      setWebhookTopic('lead_captured');
      setEventName('vip_upgraded');
      setTargetEntity('customer');
      setConditionLogic('AND');
      setConditions([{ id: 'c1', field: 'lifecycle', op: 'eq', value: 'vip' }]);
      setActions([
        {
          id: `a_${Date.now()}`,
          type: 'send_sms',
          channel: 'sms',
          messageTemplate: 'سلام {{customer.name}} عزیز، پیام اطلاع‌رسانی ویژه از {{businessName}}.',
        },
      ]);
      setCooldownMinutes(60);
      setDailyCapPerCustomer(3);
      setAllowRepeat(false);
      setRespectQuietHours(true);
    }
  }, [open, editingRule]);

  const handleAddAction = (type: RuleActionType) => {
    const channel: NotificationChannel | undefined =
      type === 'send_whatsapp'
        ? 'whatsapp'
        : type === 'send_email'
          ? 'email'
          : type === 'send_sms'
            ? 'sms'
            : undefined;
    setActions((prev) => [
      ...prev,
      {
        id: `act_${Date.now()}_${prev.length}`,
        type,
        channel,
        messageTemplate: channel ? 'سلام {{customer.name}} عزیز، یادآوری از {{businessName}}.' : undefined,
        taskTitleTemplate: type === 'create_task' ? 'پیگیری {{customer.name}}' : undefined,
        field: type === 'update_field' ? 'lifecycle' : undefined,
        value: type === 'update_field' ? 'vip' : undefined,
        stage: type === 'change_stage' ? (targetEntity === 'opportunity' ? 'contacted' : 'confirmed') : undefined,
        ownerName: type === 'assign_owner' ? '' : undefined,
        webhookUrl: type === 'call_webhook' ? 'https://hooks.clientflow.ir/crm-event' : undefined,
        tag: type === 'add_tag' ? 'پیگیری_خودکار' : undefined,
        ticketSubjectTemplate: type === 'create_ticket' ? 'پیگیری خودکار برای {{customer.name}}' : undefined,
        ticketPriority: type === 'create_ticket' ? 'normal' : undefined,
      },
    ]);
  };

  const updateAction = (idx: number, patch: Partial<RuleAction>) => {
    setActions((prev) => prev.map((a, i) => (i === idx ? { ...a, ...patch } : a)));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleName.trim() || actions.length === 0) return;

    const triggerSummary =
      triggerType === 'on_webhook'
        ? `Webhook (${webhookTopic})`
        : triggerType === 'on_event'
          ? `رویداد (${eventName})`
          : triggerType === 'schedule'
            ? CRON_LABELS[scheduleCron]
            : TRIGGER_LABELS[triggerType];

    const condSummary =
      conditions.length === 0
        ? 'بدون شرط'
        : conditions.map((c) => `${c.field} ${c.op} ${c.value}`).join(` ${conditionLogic} `);
    const fullCondSummary = `${conditionLogic === 'NOT' ? 'NOT (' : ''}${condSummary}${conditionLogic === 'NOT' ? ')' : ''}`;

    const actionSummary = actions.map((a) => ACTION_TYPE_LABELS[a.type]).join(' + ');

    const firstNotify = actions.find(
      (a) => a.type === 'send_sms' || a.type === 'send_whatsapp' || a.type === 'send_email',
    );
    const firstTask = actions.find((a) => a.type === 'create_task');
    const legacyActionType: Rule['actionType'] =
      firstNotify && firstTask ? 'both' : firstTask ? 'create_task' : 'send_notification';

    const payload: Omit<Rule, 'id'> = {
      name: ruleName.trim(),
      trigger: triggerSummary,
      condition: fullCondSummary,
      action: actionSummary,
      active: editingRule ? editingRule.active : true,
      pack,
      triggerType,
      scheduleCron: triggerType === 'schedule' ? scheduleCron : undefined,
      webhookTopic: triggerType === 'on_webhook' ? webhookTopic.trim() : undefined,
      eventName: triggerType === 'on_event' ? eventName.trim() : undefined,
      targetEntity,
      conditionLogic,
      conditions,
      actions,
      actionType: legacyActionType,
      actionChannel: firstNotify?.channel ?? 'sms',
      messageTemplate: firstNotify?.messageTemplate,
      taskTitleTemplate: firstTask?.taskTitleTemplate,
      cooldownMinutes,
      allowRepeat,
      dailyCapPerCustomer,
      respectQuietHours,
    };

    if (editingRule) {
      updateRule(editingRule.id, payload);
    } else {
      addRule(payload);
    }
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editingRule ? `ویرایش قانون: ${editingRule.name}` : 'سازنده بصری قانون اتوماسیون'}
      maxWidth="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {/* Step 1: Metadata */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="mb-1 block font-medium text-slate-600 dark:text-slate-400">نام قانون *</label>
            <input
              type="text"
              required
              value={ruleName}
              onChange={(e) => setRuleName(e.target.value)}
              placeholder="مثلاً: یادآوری نوبت ۲۴ ساعت قبل + ثبت وظیفه پیگیری"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="mb-1 block font-medium text-slate-600 dark:text-slate-400">بسته صنعتی هدف</label>
            <select
              value={pack}
              onChange={(e) => setPack(e.target.value as NonNullable<Rule['pack']>)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="all">همه بسته‌ها</option>
              <option value="clinic">کلینیک</option>
              <option value="shop">فروشگاه</option>
              <option value="software">نرم‌افزاری / IT</option>
              <option value="b2b">B2B و پیمانکاری</option>
              <option value="education">آموزشگاه</option>
              <option value="realestate">املاک و خودرو</option>
              <option value="salon">آرایشگاه و باشگاه</option>
              <option value="restaurant">رستوران و کافه</option>
              <option value="freelancer">فریلنسر</option>
              <option value="general">عمومی</option>
            </select>
          </div>
        </div>

        {/* Step 2: Trigger */}
        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-950/40">
          <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200">
            <Zap size={14} className="text-indigo-500" />
            ۱. چه رویدادی قانون را آغاز کند؟ (Trigger)
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-slate-500">نوع محرک</label>
              <select
                value={triggerType}
                onChange={(e) => setTriggerType(e.target.value as RuleTriggerType)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 dark:border-slate-700 dark:bg-slate-800"
              >
                {(Object.keys(TRIGGER_LABELS) as RuleTriggerType[]).map((k) => (
                  <option key={k} value={k}>
                    {TRIGGER_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-slate-500">موجودیت هدف</label>
              <select
                value={targetEntity}
                onChange={(e) => {
                  const nextEnt = e.target.value as RuleTargetEntity;
                  setTargetEntity(nextEnt);
                  const firstField = ENTITY_FIELDS[nextEnt][0]?.value ?? 'status';
                  setConditions([{ id: `c_${Date.now()}`, field: firstField, op: 'eq', value: '' }]);
                }}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 dark:border-slate-700 dark:bg-slate-800"
              >
                {(Object.keys(ENTITY_LABELS) as RuleTargetEntity[]).map((k) => (
                  <option key={k} value={k}>
                    {ENTITY_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>

            {triggerType === 'schedule' && (
              <div>
                <label className="mb-1 block text-slate-500">بازه زمان‌بندی (Cron-Lite)</label>
                <select
                  value={scheduleCron}
                  onChange={(e) => setScheduleCron(e.target.value as RuleScheduleCron)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 dark:border-slate-700 dark:bg-slate-800"
                >
                  {(Object.keys(CRON_LABELS) as RuleScheduleCron[]).map((k) => (
                    <option key={k} value={k}>
                      {CRON_LABELS[k]}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {triggerType === 'on_webhook' && (
              <div>
                <label className="mb-1 block text-slate-500">موضوع وب‌هوک (Webhook Topic)</label>
                <input
                  type="text"
                  dir="ltr"
                  value={webhookTopic}
                  onChange={(e) => setWebhookTopic(e.target.value)}
                  placeholder="lead_captured"
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
            )}

            {triggerType === 'on_event' && (
              <div>
                <label className="mb-1 block text-slate-500">نام رویداد (Event Name)</label>
                <input
                  type="text"
                  dir="ltr"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  placeholder="vip_upgraded"
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
            )}
          </div>
        </div>

        {/* Step 3: Conditions (AND / OR / NOT + Relative Time) */}
        <div className="space-y-2.5 rounded-xl border border-slate-200 p-3.5 dark:border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-800 dark:text-slate-200">۲. شروط فیلتر (Conditions):</span>
              <select
                value={conditionLogic}
                onChange={(e) => setConditionLogic(e.target.value as 'AND' | 'OR' | 'NOT')}
                className="rounded border border-slate-200 bg-white px-2 py-1 font-semibold dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="AND">همه شروط برقرار باشند (AND)</option>
                <option value="OR">حداقل یکی برقرار باشد (OR)</option>
                <option value="NOT">هیچ‌کدام برقرار نباشند (NOT)</option>
              </select>
            </div>
            <button
              type="button"
              onClick={() =>
                setConditions((prev) => [
                  ...prev,
                  {
                    id: `c_${Date.now()}`,
                    field: ENTITY_FIELDS[targetEntity][0]?.value ?? 'status',
                    op: 'eq',
                    value: '',
                  },
                ])
              }
              className="inline-flex items-center gap-1 rounded border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300"
            >
              <Plus size={12} />
              افزودن شرط
            </button>
          </div>

          {conditions.length === 0 ? (
            <p className="text-slate-400">بدون شرط — روی همه رکوردهای مطابق رویداد اجرا می‌شود.</p>
          ) : (
            conditions.map((cond, idx) => {
              const showRelPresets =
                cond.op === 'before_rel' ||
                cond.op === 'after_rel' ||
                cond.op === 'within_next_hours' ||
                cond.op === 'older_than_hours';
              return (
                <div key={cond.id} className="space-y-1.5 rounded-lg bg-slate-50/70 p-2 dark:bg-slate-800/40">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-12">
                    <select
                      value={cond.field}
                      onChange={(e) =>
                        setConditions((prev) =>
                          prev.map((c, i) => (i === idx ? { ...c, field: e.target.value } : c)),
                        )
                      }
                      className="rounded border border-slate-200 bg-white px-2 py-1.5 sm:col-span-5 dark:border-slate-700 dark:bg-slate-800"
                    >
                      {ENTITY_FIELDS[targetEntity].map((f) => (
                        <option key={f.value} value={f.value}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={cond.op}
                      onChange={(e) =>
                        setConditions((prev) =>
                          prev.map((c, i) =>
                            i === idx ? { ...c, op: e.target.value as RuleConditionOp } : c,
                          ),
                        )
                      }
                      className="rounded border border-slate-200 bg-white px-2 py-1.5 sm:col-span-3 dark:border-slate-700 dark:bg-slate-800"
                    >
                      {(Object.keys(CONDITION_OP_LABELS) as RuleConditionOp[]).map((opKey) => (
                        <option key={opKey} value={opKey}>
                          {CONDITION_OP_LABELS[opKey]}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={cond.value}
                      onChange={(e) =>
                        setConditions((prev) =>
                          prev.map((c, i) => (i === idx ? { ...c, value: e.target.value } : c)),
                        )
                      }
                      placeholder={
                        cond.op === 'within_next_hours' || cond.op === 'older_than_hours'
                          ? 'مثلاً 24 (ساعت)'
                          : 'مقدار یا now+24h'
                      }
                      className="rounded border border-slate-200 bg-white px-2 py-1.5 sm:col-span-3 dark:border-slate-700 dark:bg-slate-800"
                    />
                    <button
                      type="button"
                      onClick={() => setConditions((prev) => prev.filter((_, i) => i !== idx))}
                      className="flex items-center justify-center rounded border border-rose-200 text-rose-600 sm:col-span-1 dark:border-rose-900"
                      title="حذف شرط"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  {showRelPresets && (
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                      <span>پیشنهاد سریع زمان نسبی:</span>
                      {(cond.op === 'within_next_hours' || cond.op === 'older_than_hours'
                        ? ['2', '12', '24', '48', '72']
                        : REL_PRESETS
                      ).map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() =>
                            setConditions((prev) =>
                              prev.map((c, i) => (i === idx ? { ...c, value: preset } : c)),
                            )
                          }
                          className="rounded bg-white px-2 py-0.5 text-indigo-700 ring-1 ring-slate-200 hover:bg-indigo-50 dark:bg-slate-900 dark:text-indigo-300 dark:ring-slate-700"
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Step 4: Multi-Action Chain */}
        <div className="space-y-3 rounded-xl border border-slate-200 p-3.5 dark:border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              ۳. زنجیره اقدامات خودکار ({toFa(actions.length)} اقدام)
            </span>
            <div className="flex flex-wrap gap-1">
              {(Object.keys(ACTION_TYPE_LABELS) as RuleActionType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => handleAddAction(t)}
                  className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] hover:border-indigo-300 hover:bg-indigo-50 dark:border-slate-700 dark:bg-slate-800"
                >
                  + {ACTION_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2.5">
            {actions.map((act, idx) => {
              const isNotify =
                act.type === 'send_sms' || act.type === 'send_whatsapp' || act.type === 'send_email';
              return (
                <div
                  key={act.id}
                  className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/50 p-3 dark:border-slate-700 dark:bg-slate-800/30"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                        اقدام {toFa(idx + 1)}
                      </span>
                      <select
                        value={act.type}
                        onChange={(e) => {
                          const nextT = e.target.value as RuleActionType;
                          const ch: NotificationChannel | undefined =
                            nextT === 'send_whatsapp'
                              ? 'whatsapp'
                              : nextT === 'send_email'
                                ? 'email'
                                : nextT === 'send_sms'
                                  ? 'sms'
                                  : undefined;
                          updateAction(idx, { type: nextT, channel: ch });
                        }}
                        className="rounded border border-slate-200 bg-white px-2 py-1 font-medium dark:border-slate-700 dark:bg-slate-800"
                      >
                        {(Object.keys(ACTION_TYPE_LABELS) as RuleActionType[]).map((t) => (
                          <option key={t} value={t}>
                            {ACTION_TYPE_LABELS[t]}
                          </option>
                        ))}
                      </select>
                    </div>
                    {actions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setActions((prev) => prev.filter((_, i) => i !== idx))}
                        className="text-rose-600 hover:underline"
                      >
                        حذف اقدام
                      </button>
                    )}
                  </div>

                  {isNotify && (
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1">
                          {TEMPLATE_VARS.map((v) => (
                            <button
                              key={v}
                              type="button"
                              onClick={() =>
                                updateAction(idx, {
                                  messageTemplate: `${act.messageTemplate ?? ''} ${v}`.trim(),
                                })
                              }
                              className="rounded bg-white px-1.5 py-0.5 text-[10px] text-indigo-700 ring-1 ring-slate-200 hover:bg-indigo-50 dark:bg-slate-900 dark:text-indigo-300 dark:ring-slate-700"
                            >
                              {v}
                            </button>
                          ))}
                        </div>
                        {(state.messageTemplates ?? []).length > 0 && (
                          <select
                            defaultValue=""
                            onChange={(e) => {
                              const tpl = (state.messageTemplates ?? []).find((t) => t.id === e.target.value);
                              if (tpl) {
                                updateAction(idx, { messageTemplate: tpl.body });
                              }
                            }}
                            className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] dark:border-slate-700 dark:bg-slate-900"
                          >
                            <option value="">بارگذاری از قالب پیام...</option>
                            {(state.messageTemplates ?? []).map((tpl) => (
                              <option key={tpl.id} value={tpl.id}>
                                {tpl.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                      <textarea
                        rows={2}
                        value={act.messageTemplate ?? ''}
                        onChange={(e) => updateAction(idx, { messageTemplate: e.target.value })}
                        placeholder="متن پیام..."
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-900"
                      />
                    </div>
                  )}

                  {act.type === 'create_task' && (
                    <input
                      type="text"
                      value={act.taskTitleTemplate ?? ''}
                      onChange={(e) => updateAction(idx, { taskTitleTemplate: e.target.value })}
                      placeholder="عنوان وظیفه با متغیرها مثلاً: پیگیری {{customer.name}}"
                      className="w-full rounded border border-slate-200 bg-white px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-900"
                    />
                  )}

                  {act.type === 'update_field' && (
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={act.field ?? ''}
                        onChange={(e) => updateAction(idx, { field: e.target.value })}
                        placeholder="نام فیلد (مثلاً lifecycle یا customFields.x)"
                        className="rounded border border-slate-200 bg-white px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-900"
                      />
                      <input
                        type="text"
                        value={act.value ?? ''}
                        onChange={(e) => updateAction(idx, { value: e.target.value })}
                        placeholder="مقدار جدید"
                        className="rounded border border-slate-200 bg-white px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-900"
                      />
                    </div>
                  )}

                  {act.type === 'change_stage' && (
                    <input
                      type="text"
                      value={act.stage ?? ''}
                      onChange={(e) => updateAction(idx, { stage: e.target.value })}
                      placeholder="مرحله یا وضعیت جدید (مثلاً confirmed / proposal / resolved)"
                      className="w-full rounded border border-slate-200 bg-white px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-900"
                    />
                  )}

                  {act.type === 'assign_owner' && (
                    <select
                      value={act.ownerName ?? ''}
                      onChange={(e) => updateAction(idx, { ownerName: e.target.value })}
                      className="w-full rounded border border-slate-200 bg-white px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-900"
                    >
                      <option value="">تخصیص خودکار چرخشی (Round-Robin)</option>
                      {state.settings.salesTeam.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  )}

                  {act.type === 'add_tag' && (
                    <input
                      type="text"
                      value={act.tag ?? ''}
                      onChange={(e) => updateAction(idx, { tag: e.target.value })}
                      placeholder="نام برچسب مشتری (مثلاً مشتری_ویژه)"
                      className="w-full rounded border border-slate-200 bg-white px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-900"
                    />
                  )}

                  {act.type === 'create_ticket' && (
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <input
                        type="text"
                        value={act.ticketSubjectTemplate ?? ''}
                        onChange={(e) => updateAction(idx, { ticketSubjectTemplate: e.target.value })}
                        placeholder="موضوع تیکت..."
                        className="rounded border border-slate-200 bg-white px-2.5 py-1.5 sm:col-span-2 dark:border-slate-700 dark:bg-slate-900"
                      />
                      <select
                        value={act.ticketPriority ?? 'normal'}
                        onChange={(e) =>
                          updateAction(idx, { ticketPriority: e.target.value as 'low' | 'normal' | 'high' })
                        }
                        className="rounded border border-slate-200 bg-white px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-900"
                      >
                        <option value="low">اولویت کم</option>
                        <option value="normal">اولویت عادی</option>
                        <option value="high">اولویت بالا</option>
                      </select>
                    </div>
                  )}

                  {act.type === 'call_webhook' && (
                    <input
                      type="url"
                      dir="ltr"
                      value={act.webhookUrl ?? ''}
                      onChange={(e) => updateAction(idx, { webhookUrl: e.target.value })}
                      placeholder="https://hooks.example.com/crm"
                      className="w-full rounded border border-slate-200 bg-white px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-900"
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Step 5: Guards, Cooldown, Anti-loop */}
        <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 p-3.5 sm:grid-cols-4 dark:border-slate-800">
          <div>
            <label className="mb-1 block text-slate-500">دوره انتظار (Cooldown دقیقه)</label>
            <select
              value={cooldownMinutes}
              onChange={(e) => setCooldownMinutes(Number(e.target.value))}
              className="w-full rounded border border-slate-200 bg-white px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-800"
            >
              <option value={0}>بدون Cooldown</option>
              <option value={60}>۶۰ دقیقه (۱ ساعت)</option>
              <option value={360}>۳۶۰ دقیقه (۶ ساعت)</option>
              <option value={720}>۷۲۰ دقیقه (۱۲ ساعت)</option>
              <option value={1440}>۱۴۴۰ دقیقه (۲۴ ساعت)</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-slate-500">سقف روزانه پیام برای مشتری</label>
            <input
              type="number"
              min={1}
              max={20}
              value={dailyCapPerCustomer}
              onChange={(e) => setDailyCapPerCustomer(Number(e.target.value) || 1)}
              className="w-full rounded border border-slate-200 bg-white px-2.5 py-1.5 tabular-nums dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 pt-4">
            <input
              type="checkbox"
              checked={respectQuietHours}
              onChange={(e) => setRespectQuietHours(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600"
            />
            رعایت ساعات سکوت شبانه
          </label>
          <label className="flex cursor-pointer items-center gap-2 pt-4">
            <input
              type="checkbox"
              checked={allowRepeat}
              onChange={(e) => setAllowRepeat(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600"
            />
            اجازه تکرار پس از Cooldown
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm dark:border-slate-700"
          >
            انصراف
          </button>
          <button
            type="submit"
            className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            {editingRule ? 'ذخیره تغییرات قانون' : 'ثبت و فعال‌سازی قانون'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
