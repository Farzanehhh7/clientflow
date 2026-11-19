import { X } from 'lucide-react';
import type { ToastMessage } from '../../store/useClientFlowStore';

interface ToastListProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export function ToastList({ toasts, onDismiss }: ToastListProps) {
  if (toasts.length === 0) return null;
  return (
    <div className="print-hidden fixed bottom-4 left-4 z-50 flex max-w-sm flex-col gap-2" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-2.5 text-xs font-medium shadow-md ${
            toast.type === 'error'
              ? 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200'
              : toast.type === 'info'
                ? 'border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'
                : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200'
          }`}
        >
          <span>{toast.text}</span>
          <button
            type="button"
            aria-label="بستن اعلان"
            onClick={() => onDismiss(toast.id)}
            className="text-current opacity-60 hover:opacity-100"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
