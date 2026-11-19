import React from 'react';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-10 text-center">
      {icon && <div className="mb-2 text-slate-400 dark:text-slate-500">{icon}</div>}
      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{title}</p>
      {description && <p className="mt-1 max-w-md text-xs text-slate-500 dark:text-slate-400">{description}</p>}
      {actionLabel && onAction && (
        <Button onClick={onAction} className="mt-3">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
