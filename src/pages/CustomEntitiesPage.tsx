import { useMemo, useState } from 'react';
import { Database, Plus, Search, Trash2 } from 'lucide-react';
import { DynamicFieldsRenderer } from '../components/DynamicFieldsRenderer';
import { Modal } from '../components/Modal';
import { useClientFlow } from '../store/useClientFlowStore';
import { formatJalaliDateTime, toFa } from '../utils/jalali';
import { fuzzyMatchPersian } from '../utils/persianSearch';

export function CustomEntitiesPage() {
  const { state, addCustomEntityRecord, deleteCustomEntityRecord } = useClientFlow();
  const [selectedEntityKey, setSelectedEntityKey] = useState(
    state.customEntityDefs[0]?.key ?? '',
  );
  const [query, setQuery] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [relatedCustomerId, setRelatedCustomerId] = useState('');

  const activeEntity =
    state.customEntityDefs.find((e) => e.key === selectedEntityKey) ??
    state.customEntityDefs[0];

  const records = useMemo(() => {
    if (!activeEntity) return [];
    return state.customEntityRecords
      .filter((r) => r.entityKey === activeEntity.key)
      .filter((r) => {
        if (!query.trim()) return true;
        const cust = state.customers.find((c) => c.id === r.relatedCustomerId);
        return fuzzyMatchPersian([...Object.values(r.values), cust?.name], query);
      });
  }, [activeEntity, state.customEntityRecords, state.customers, query]);

  const handleCreateRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEntity) return;
    addCustomEntityRecord({
      entityKey: activeEntity.key,
      values,
      relatedCustomerId: relatedCustomerId || undefined,
    });
    setValues({});
    setRelatedCustomerId('');
    setCreateOpen(false);
  };

  if (state.customEntityDefs.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-10 text-center dark:border-slate-800 dark:bg-slate-900">
        <Database size={28} className="mx-auto mb-2 text-slate-400" />
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
          هنوز موجودیت سفارشی تعریف نشده است
        </p>
        <p className="mt-1 text-xs text-slate-500">
          از بخش «تنظیمات ← موجودیت‌های سفارشی» می‌توانید موجودیت‌های دلخواه خود را بدون کدنویسی بسازید.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-900">
          {state.customEntityDefs.map((ent) => {
            const count = state.customEntityRecords.filter((r) => r.entityKey === ent.key).length;
            const active = activeEntity?.key === ent.key;
            return (
              <button
                key={ent.id}
                type="button"
                onClick={() => setSelectedEntityKey(ent.key)}
                className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {ent.pluralName} ({toFa(count)})
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => {
            setValues({});
            setRelatedCustomerId('');
            setCreateOpen(true);
          }}
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700"
        >
          <Plus size={15} />
          ثبت {activeEntity?.name} جدید
        </button>
      </div>

      {activeEntity && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative min-w-[240px] flex-1 max-w-md">
              <Search size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`جستجو در ${activeEntity.pluralName}...`}
                className="w-full rounded-lg border border-slate-200 bg-white py-2 pr-9 pl-3 text-xs dark:border-slate-800 dark:bg-slate-900"
              />
            </div>
            {activeEntity.description && (
              <span className="text-xs text-slate-500">{activeEntity.description}</span>
            )}
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            {records.length === 0 ? (
              <p className="p-8 text-center text-xs text-slate-500">
                رکوردی در موجودیت «{activeEntity.pluralName}» ثبت نشده است.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50/70 text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
                    <tr>
                      {activeEntity.fields.map((f) => (
                        <th key={f.id} className="px-4 py-3 font-medium">
                          {f.label}
                        </th>
                      ))}
                      <th className="px-4 py-3 font-medium">مشتری مرتبط</th>
                      <th className="px-4 py-3 font-medium">زمان ثبت</th>
                      <th className="px-4 py-3 font-medium text-left">حذف</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {records.map((rec) => {
                      const cust = state.customers.find((c) => c.id === rec.relatedCustomerId);
                      return (
                        <tr key={rec.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                          {activeEntity.fields.map((f) => (
                            <td key={f.id} className="px-4 py-2.5 text-slate-700 dark:text-slate-200">
                              {rec.values[f.key] || '—'}
                            </td>
                          ))}
                          <td className="px-4 py-2.5 text-indigo-600 dark:text-indigo-400">
                            {cust?.name ?? '—'}
                          </td>
                          <td className="px-4 py-2.5 tabular-nums text-slate-400">
                            {formatJalaliDateTime(rec.createdAt)}
                          </td>
                          <td className="px-4 py-2.5 text-left">
                            <button
                              type="button"
                              onClick={() => deleteCustomEntityRecord(rec.id)}
                              className="p-1 text-slate-400 hover:text-rose-600"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={`ثبت ${activeEntity?.name ?? 'رکورد'} جدید`}
        maxWidth="lg"
      >
        <form onSubmit={handleCreateRecord} className="space-y-4">
          {activeEntity && (
            <DynamicFieldsRenderer
              defs={activeEntity.fields}
              values={values}
              onChange={setValues}
            />
          )}

          <div>
            <label className="mb-1 block text-xs text-slate-500">مشتری مرتبط (اختیاری)</label>
            <select
              value={relatedCustomerId}
              onChange={(e) => setRelatedCustomerId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="">-- بدون اتصال --</option>
              {state.customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({toFa(c.phone)})
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs dark:border-slate-700"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700"
            >
              ثبت رکورد
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
