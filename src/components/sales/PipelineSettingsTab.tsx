import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useClientFlow } from '../../store/useClientFlowStore';
import type { CommissionTier, PackSalesConfig, PipelineStageConfig } from '../../types';
import { toFa } from '../../utils/jalali';

interface PipelineSettingsTabProps {
  packSales: PackSalesConfig;
}

export function PipelineSettingsTab({ packSales }: PipelineSettingsTabProps) {
  const {
    state,
    addPipeline,
    updatePipeline,
    deletePipeline,
    updateCommissionTiers,
    updateSettings,
  } = useClientFlow();

  const [editingPipelineId, setEditingPipelineId] = useState(
    state.pipelines.find((p) => p.isDefault)?.id ?? state.pipelines[0]?.id ?? '',
  );

  const selectedPipeline =
    state.pipelines.find((p) => p.id === editingPipelineId) ?? state.pipelines[0];

  const [pipelineNameDraft, setPipelineNameDraft] = useState(selectedPipeline?.name ?? '');
  const [stageDrafts, setStageDrafts] = useState<PipelineStageConfig[]>(
    selectedPipeline?.stages ?? state.pipelineStages,
  );
  const [tierDrafts, setTierDrafts] = useState<CommissionTier[]>(state.commissionTiers);
  const [newPipelineName, setNewPipelineName] = useState('');
  const [newRepName, setNewRepName] = useState('');

  const handleSelectPipeline = (id: string) => {
    setEditingPipelineId(id);
    const pl = state.pipelines.find((p) => p.id === id);
    if (pl) {
      setPipelineNameDraft(pl.name);
      setStageDrafts(pl.stages);
    }
  };

  const handleCreatePipeline = () => {
    if (!newPipelineName.trim()) return;
    addPipeline({
      name: newPipelineName.trim(),
      description: 'قیف سفارشی ساخته‌شده در تنظیمات فروش',
      isDefault: false,
      stages: packSales.defaultStages.map((s) => ({ ...s })),
    });
    setNewPipelineName('');
  };

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">مدیریت قیف‌های فروش متعدد (Pipelines)</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              انتخاب، ایجاد یا ویرایش مراحل، درصد احتمال و SLA هر قیف فروش
            </p>
          </div>
          {selectedPipeline && !selectedPipeline.isDefault && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => updatePipeline(selectedPipeline.id, { isDefault: true })}
                className="rounded border border-indigo-200 px-2.5 py-1 text-[11px] font-medium text-indigo-600 hover:bg-indigo-50 dark:border-indigo-900/60 dark:text-indigo-300"
              >
                انتخاب به‌عنوان پیش‌فرض
              </button>
              <button
                type="button"
                onClick={() => deletePipeline(selectedPipeline.id)}
                className="rounded border border-rose-200 p-1 text-rose-600 hover:bg-rose-50 dark:border-rose-900/60"
                aria-label="حذف قیف فروش"
              >
                <Trash2 size={13} />
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select
            aria-label="انتخاب قیف برای ویرایش"
            value={selectedPipeline?.id ?? ''}
            onChange={(e) => handleSelectPipeline(e.target.value)}
            className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-medium dark:border-slate-700 dark:bg-slate-800"
          >
            {state.pipelines.map((pl) => (
              <option key={pl.id} value={pl.id}>
                {pl.name} {pl.isDefault ? '(پیش‌فرض)' : ''}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={newPipelineName}
              onChange={(e) => setNewPipelineName(e.target.value)}
              placeholder="نام قیف جدید..."
              className="w-40 rounded-lg border border-slate-200 px-2.5 py-2 dark:border-slate-700 dark:bg-slate-800"
            />
            <button
              type="button"
              onClick={handleCreatePipeline}
              className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-slate-200 px-3 py-2 font-medium hover:bg-slate-50 dark:border-slate-700"
            >
              <Plus size={13} />
              افزودن قیف
            </button>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium">نام نمایشی قیف</label>
          <input
            type="text"
            value={pipelineNameDraft}
            onChange={(e) => setPipelineNameDraft(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
          />
        </div>

        <div className="space-y-2.5">
          {stageDrafts.map((st, idx) => (
            <div key={st.key} className="grid grid-cols-12 items-center gap-2 text-xs">
              <input
                type="text"
                value={st.label}
                onChange={(e) =>
                  setStageDrafts((prev) =>
                    prev.map((p, i) => (i === idx ? { ...p, label: e.target.value } : p)),
                  )
                }
                className="col-span-6 rounded-lg border border-slate-200 px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-800"
              />
              <div className="col-span-3 flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={st.probability}
                  onChange={(e) =>
                    setStageDrafts((prev) =>
                      prev.map((p, i) =>
                        i === idx ? { ...p, probability: Math.min(100, Math.max(0, Number(e.target.value) || 0)) } : p,
                      ),
                    )
                  }
                  className="w-full rounded-lg border border-slate-200 px-2 py-1.5 tabular-nums dark:border-slate-700 dark:bg-slate-800"
                />
                <span className="text-slate-400">٪</span>
              </div>
              <div className="col-span-3 flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  value={st.slaHours}
                  onChange={(e) =>
                    setStageDrafts((prev) =>
                      prev.map((p, i) =>
                        i === idx ? { ...p, slaHours: Math.max(0, Number(e.target.value) || 0) } : p,
                      ),
                    )
                  }
                  className="w-full rounded-lg border border-slate-200 px-2 py-1.5 tabular-nums dark:border-slate-700 dark:bg-slate-800"
                />
                <span className="text-slate-400">س</span>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => {
            if (!selectedPipeline) return;
            updatePipeline(selectedPipeline.id, {
              name: pipelineNameDraft.trim() || selectedPipeline.name,
              stages: stageDrafts,
            });
          }}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700"
        >
          ذخیره مراحل و SLA قیف انتخاب‌شده
        </button>
      </div>

      <div className="space-y-5">
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">تیم فروش و تخصیص چرخشی (Round-robin)</h3>
            <label className="flex cursor-pointer items-center gap-1.5 text-xs">
              <input
                type="checkbox"
                checked={state.settings.autoAssignLeads}
                onChange={(e) => updateSettings({ autoAssignLeads: e.target.checked })}
                className="h-4 w-4 rounded accent-indigo-600"
              />
              فعال‌سازی خودکار
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            {state.settings.salesTeam.map((rep) => (
              <span
                key={rep}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
              >
                {rep}
                {state.settings.salesTeam.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      updateSettings({ salesTeam: state.settings.salesTeam.filter((r) => r !== rep) })
                    }
                    className="text-slate-400 hover:text-rose-500"
                  >
                    ×
                  </button>
                )}
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newRepName}
              onChange={(e) => setNewRepName(e.target.value)}
              placeholder="نام کارشناس جدید..."
              className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
            />
            <button
              type="button"
              onClick={() => {
                if (!newRepName.trim()) return;
                updateSettings({ salesTeam: [...state.settings.salesTeam, newRepName.trim()] });
                setNewRepName('');
              }}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 dark:border-slate-700"
            >
              افزودن به تیم
            </button>
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-sm font-semibold">تنظیم پلکان پورسانت (Stepped Commission)</h3>
          <div className="space-y-2">
            {tierDrafts.map((t, idx) => (
              <div key={t.id} className="grid grid-cols-12 items-center gap-2 text-xs">
                <span className="col-span-3 text-slate-500">پله {toFa(idx + 1)}</span>
                <div className="col-span-5">
                  {t.upToAmount === null ? (
                    <span className="text-slate-500">مازاد بر پله قبل</span>
                  ) : (
                    <input
                      type="number"
                      value={t.upToAmount}
                      onChange={(e) =>
                        setTierDrafts((prev) =>
                          prev.map((p, i) =>
                            i === idx ? { ...p, upToAmount: Math.max(1000000, Number(e.target.value) || 0) } : p,
                          ),
                        )
                      }
                      className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 tabular-nums dark:border-slate-700 dark:bg-slate-800"
                    />
                  )}
                </div>
                <div className="col-span-4 flex items-center gap-1">
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={t.ratePct}
                    onChange={(e) =>
                      setTierDrafts((prev) =>
                        prev.map((p, i) =>
                          i === idx ? { ...p, ratePct: Math.max(0, Number(e.target.value) || 0) } : p,
                        ),
                      )
                    }
                    className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 tabular-nums dark:border-slate-700 dark:bg-slate-800"
                  />
                  <span>٪</span>
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => updateCommissionTiers(tierDrafts)}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700"
          >
            ذخیره پلکان پورسانت
          </button>
        </div>
      </div>
    </div>
  );
}
