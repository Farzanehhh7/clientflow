import React from 'react';

export type BadgeTone = 'neutral' | 'indigo' | 'emerald' | 'amber' | 'rose' | 'violet' | 'sky';

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  indigo: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300',
  emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
  amber: 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
  rose: 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300',
  violet: 'bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300',
  sky: 'bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300',
};

interface BadgeProps {
  tone?: BadgeTone;
  className?: string;
  children: React.ReactNode;
}

export function Badge({ tone = 'neutral', className = '', children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium ${TONE_CLASSES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
