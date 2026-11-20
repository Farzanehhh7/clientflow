import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  FileText,
  Film,
  FolderOpen,
  Image as ImageIcon,
  Plus,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { Modal } from '../Modal';
import { useClientFlow } from '../../store/useClientFlowStore';
import type { MediaAsset } from '../../types';
import { formatJalali, toFa } from '../../utils/jalali';
import { fuzzyMatchPersian } from '../../utils/persianSearch';

const ASSET_TYPE_LABEL: Record<MediaAsset['type'], string> = {
  image: 'تصویر',
  video: 'ویدیو',
  pdf: 'فایل PDF',
};

export function MediaLibraryTab() {
  const { state, addMediaAsset, toggleMediaConsent, deleteMediaAsset } = useClientFlow();

  const [search, setSearch] = useState('');
  const [folderFilter, setFolderFilter] = useState('all');
  const [consentFilter, setConsentFilter] = useState<'all' | 'consented' | 'pending'>('all');

  const [createOpen, setCreateOpen] = useState(false);
  const [medName, setMedName] = useState('');
  const [medType, setMedType] = useState<MediaAsset['type']>('image');
  const [medFolder, setMedFolder] = useState('نمونه کارها');
  const [medTags, setMedTags] = useState('قبل و بعد, کمپین');
  const [medSize, setMedSize] = useState('320 KB');
  const [medConsent, setMedConsent] = useState(false);

  const folders = useMemo(() => {
    const set = new Set(state.mediaAssets.map((a) => a.folder));
    return ['all', ...Array.from(set)];
  }, [state.mediaAssets]);

  const filteredAssets = useMemo(() => {
    return state.mediaAssets.filter((a) => {
      if (folderFilter !== 'all' && a.folder !== folderFilter) return false;
      if (consentFilter === 'consented' && !a.hasModelConsent) return false;
      if (consentFilter === 'pending' && a.hasModelConsent) return false;
      if (search.trim()) {
        return fuzzyMatchPersian([a.name, a.folder, ...a.tags], search);
      }
      return true;
    });
  }, [state.mediaAssets, folderFilter, consentFilter, search]);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!medName.trim()) return;
    addMediaAsset({
      name: medName.trim(),
      type: medType,
      folder: medFolder.trim() || 'عمومی',
      sizeLabel: medSize.trim() || '250 KB',
      tags: medTags
        .split(/[،,]/)
        .map((t) => t.trim())
        .filter(Boolean),
      urlOrDataUrl: '#asset-placeholder',
      hasModelConsent: medConsent,
    });
    setMedName('');
    setMedConsent(false);
    setCreateOpen(false);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            کتابخانه دارایی‌های دیجیتال و مدیریت رضایت‌نامه انتشار
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            دسته‌بندی فایل‌های تبلیغاتی، تگ‌گذاری موضوعی و کنترل مجوز قانونی انتشار تصاویر قبل و بعد
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-indigo-700"
        >
          <Plus size={15} />
          ثبت فایل جدید
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-1.5">
          {folders.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFolderFilter(f)}
              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                folderFilter === f
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              <FolderOpen size={13} />
              {f === 'all' ? 'همه پوشه‌ها' : f}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={consentFilter}
            onChange={(e) => setConsentFilter(e.target.value as typeof consentFilter)}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
          >
            <option value="all">همه وضعیت‌های رضایت‌نامه</option>
            <option value="consented">دارای رضایت‌نامه انتشار</option>
            <option value="pending">بدون رضایت‌نامه</option>
          </select>

          <div className="relative">
            <Search
              size={14}
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="جستجو در نام یا تگ..."
              className="rounded-lg border border-slate-200 bg-white py-1.5 pr-8 pl-3 text-xs dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
        </div>
      </div>

      {/* Assets Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredAssets.length === 0 ? (
          <div className="col-span-full rounded-xl border border-dashed border-slate-300 py-12 text-center text-xs text-slate-500 dark:border-slate-700">
            هیچ فایلی مطابق با فیلتر انتخابی یافت نشد.
          </div>
        ) : (
          filteredAssets.map((asset) => {
            const Icon =
              asset.type === 'video' ? Film : asset.type === 'pdf' ? FileText : ImageIcon;
            const hasDataImage =
              asset.urlOrDataUrl.startsWith('data:image/') ||
              asset.urlOrDataUrl.startsWith('http');

            return (
              <div
                key={asset.id}
                className="flex flex-col justify-between overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
              >
                <div>
                  {/* Clean graphic placeholder without needing real stock photos */}
                  <div className="relative flex h-36 items-center justify-center bg-gradient-to-br from-slate-100 via-indigo-50/60 to-slate-100 dark:from-slate-800 dark:via-indigo-950/40 dark:to-slate-900">
                    {hasDataImage && asset.urlOrDataUrl.startsWith('data:image/') ? (
                      <img
                        src={asset.urlOrDataUrl}
                        alt={asset.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-slate-400 dark:text-slate-500">
                        <div className="rounded-2xl bg-white/80 p-3 shadow-xs dark:bg-slate-800/80">
                          <Icon size={28} className="text-indigo-500" />
                        </div>
                        <span className="text-[11px] font-medium">
                          {ASSET_TYPE_LABEL[asset.type]} • {asset.sizeLabel}
                        </span>
                      </div>
                    )}

                    <span
                      className={`absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                        asset.hasModelConsent
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/90 dark:text-emerald-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950/90 dark:text-amber-300'
                      }`}
                    >
                      {asset.hasModelConsent ? (
                        <>
                          <CheckCircle2 size={11} />
                          مجوز انتشار دارد
                        </>
                      ) : (
                        <>
                          <ShieldAlert size={11} />
                          نیازمند رضایت‌نامه
                        </>
                      )}
                    </span>
                  </div>

                  <div className="p-4">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      {asset.name}
                    </h3>
                    <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                      <span>پوشه: {asset.folder}</span>
                      <span className="tabular-nums">{formatJalali(asset.uploadedAt)}</span>
                    </div>
                    <div className="mt-2.5 flex flex-wrap gap-1">
                      {asset.tags.slice(0, 4).map((tag) => (
                        <span
                          key={tag}
                          className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2.5 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => toggleMediaConsent(asset.id)}
                    className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 dark:bg-slate-800 dark:text-slate-300"
                  >
                    <ShieldCheck size={13} />
                    {asset.hasModelConsent ? 'لغو رضایت انتشار' : 'ثبت رضایت‌نامه'}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteMediaAsset(asset.id)}
                    title="حذف دارایی"
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Asset Modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="افزودن فایل به کتابخانه دارایی‌ها"
        maxWidth="md"
      >
        <form onSubmit={handleCreate} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium">نام فایل / عنوان دارایی *</label>
            <input
              required
              value={medName}
              onChange={(e) => setMedName(e.target.value)}
              placeholder="مثلاً کاتالوگ معرفی خدمات بهار"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium">نوع فایل</label>
              <select
                value={medType}
                onChange={(e) => setMedType(e.target.value as MediaAsset['type'])}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="image">تصویر</option>
                <option value="video">ویدیو</option>
                <option value="pdf">PDF</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">پوشه</label>
              <input
                value={medFolder}
                onChange={(e) => setMedFolder(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">حجم تقریبی</label>
              <input
                value={medSize}
                onChange={(e) => setMedSize(e.target.value)}
                dir="ltr"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">تگ‌ها (جدا شده با کاما)</label>
            <input
              value={medTags}
              onChange={(e) => setMedTags(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <label className="flex items-center gap-2 text-xs font-medium">
            <input
              type="checkbox"
              checked={medConsent}
              onChange={(e) => setMedConsent(e.target.checked)}
            />
            دارای رضایت‌نامه قانونی استفاده در تبلیغات و قبل/بعد
          </label>
          <div className="flex justify-end gap-2 pt-2">
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
              ثبت فایل
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
