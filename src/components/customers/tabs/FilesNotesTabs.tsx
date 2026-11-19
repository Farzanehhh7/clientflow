import { useState } from 'react';
import { Download, FileText, Paperclip, StickyNote, Trash2, Upload } from 'lucide-react';
import { useClientFlow } from '../../../store/useClientFlowStore';
import type { Customer, CustomerAttachment } from '../../../types';
import { formatJalaliDateTime, toFa } from '../../../utils/jalali';
import { Badge, Button, EmptyState, Input, Select } from '../../ui';

const ATT_CAT_LABELS: Record<CustomerAttachment['category'], string> = {
  photo_before: 'تصویر قبل از خدمت',
  photo_after: 'تصویر بعد از خدمت',
  lab_pdf: 'مدرک / آزمایش PDF',
  consent: 'فرم رضایت‌نامه',
  other: 'سایر مدارک',
};

export function CustomerFilesTab({ customer }: { customer: Customer }) {
  const { addCustomerAttachment, removeCustomerAttachment } = useClientFlow();
  const [attCat, setAttCat] = useState<CustomerAttachment['category']>('other');
  const [attNote, setAttNote] = useState('');

  const attachments = customer.attachments ?? [];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const sizeKb = Math.max(1, Math.round(file.size / 1024));
    const sizeLabel = sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`;
    const reader = new FileReader();
    reader.onload = () => {
      addCustomerAttachment(customer.id, {
        name: file.name,
        category: attCat,
        sizeLabel,
        mimeType: file.type || 'application/octet-stream',
        dataUrl: typeof reader.result === 'string' && file.size <= 350_000 ? reader.result : undefined,
        note: attNote.trim() || undefined,
      });
      setAttNote('');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="w-52">
          <Select
            label="دسته‌بندی فایل"
            value={attCat}
            onChange={(e) => setAttCat(e.target.value as CustomerAttachment['category'])}
            options={Object.entries(ATT_CAT_LABELS).map(([k, v]) => ({ value: k, label: v }))}
          />
        </div>
        <div className="min-w-[200px] flex-1">
          <Input
            label="توضیح مدرک (اختیاری)"
            value={attNote}
            onChange={(e) => setAttNote(e.target.value)}
            placeholder="مثلاً: قرارداد امضاشده یا تصویر مستندات"
          />
        </div>
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700">
          <Upload size={14} />
          آپلود فایل / مدرک
          <input type="file" accept="image/*,.pdf,.doc,.docx" onChange={handleFileUpload} className="hidden" />
        </label>
      </div>

      {attachments.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <EmptyState icon={<Paperclip size={26} />} title="مدرک یا فایلی در این پرونده پیوست نشده است" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-3.5 text-xs dark:border-slate-800 dark:bg-slate-900"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-100">
                    <FileText size={14} className="shrink-0 text-indigo-500" />
                    <span className="truncate">{att.name}</span>
                  </div>
                  <button
                    type="button"
                    aria-label={`حذف فایل ${att.name}`}
                    onClick={() => removeCustomerAttachment(customer.id, att.id)}
                    className="text-slate-400 hover:text-rose-600"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <Badge tone="indigo">{ATT_CAT_LABELS[att.category]}</Badge>
                  <span className="tabular-nums text-slate-400">{att.sizeLabel}</span>
                </div>
                {att.note && <p className="mt-1.5 text-slate-500">{att.note}</p>}
                {att.dataUrl && att.mimeType.startsWith('image/') && (
                  <img
                    src={att.dataUrl}
                    alt={att.name}
                    className="mt-2 h-28 w-full rounded-lg object-cover"
                  />
                )}
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] text-slate-400 dark:border-slate-800">
                <span className="tabular-nums">{formatJalaliDateTime(att.uploadedAt)}</span>
                {att.dataUrl && (
                  <a
                    href={att.dataUrl}
                    download={att.name}
                    className="inline-flex items-center gap-1 font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                  >
                    <Download size={12} />
                    دانلود
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function CustomerNotesTab({ customer }: { customer: Customer }) {
  const { state, updateCustomer, addInteraction } = useClientFlow();
  const [summaryNote, setSummaryNote] = useState(customer.notes ?? '');
  const [newNote, setNewNote] = useState('');

  const noteItems = state.interactions
    .filter((i) => i.customerId === customer.id && i.channel === 'note')
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  const handleSaveSummary = (e: React.FormEvent) => {
    e.preventDefault();
    updateCustomer(customer.id, { notes: summaryNote.trim() || undefined });
  };

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    addInteraction(customer.id, 'note', newNote.trim());
    setNewNote('');
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <form
        onSubmit={handleSaveSummary}
        className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
          <StickyNote size={15} className="text-amber-500" />
          خلاصه پرونده و یادداشت ثابت مشتری
        </div>
        <textarea
          rows={5}
          value={summaryNote}
          onChange={(e) => setSummaryNote(e.target.value)}
          placeholder="نکات کلیدی، ترجیحات یا شرایط ویژه مشتری..."
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
        />
        <div className="flex justify-end">
          <Button type="submit">ذخیره یادداشت ثابت</Button>
        </div>
      </form>

      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
          یادداشت‌های زمان‌دار ({toFa(noteItems.length)})
        </div>
        <form onSubmit={handleAddNote} className="flex gap-2">
          <Input
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="افزودن یادداشت جدید با مهر زمانی..."
          />
          <Button type="submit">ثبت</Button>
        </form>
        <div className="max-h-56 space-y-2 overflow-y-auto">
          {noteItems.length === 0 ? (
            <EmptyState title="یادداشتی ثبت نشده است" />
          ) : (
            noteItems.map((n) => (
              <div
                key={n.id}
                className="rounded-lg border border-slate-200 bg-slate-50/70 p-2.5 text-xs dark:border-slate-800 dark:bg-slate-800/40"
              >
                <p className="text-slate-800 dark:text-slate-100">{n.text}</p>
                <div className="mt-1 text-[11px] tabular-nums text-slate-400">
                  {formatJalaliDateTime(n.at)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
