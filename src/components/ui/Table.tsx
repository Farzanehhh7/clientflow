import React from 'react';

interface TableProps {
  headers: { key: string; label: string; alignLeft?: boolean }[];
  children: React.ReactNode;
  emptyState?: React.ReactNode;
  isEmpty?: boolean;
}

export function Table({ headers, children, emptyState, isEmpty }: TableProps) {
  if (isEmpty && emptyState) {
    return (
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        {emptyState}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="overflow-x-auto">
        <table className="w-full text-right text-sm">
          <thead className="border-b border-slate-200 bg-slate-50/70 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
            <tr>
              {headers.map((h) => (
                <th
                  key={h.key}
                  className={`px-4 py-3 font-medium ${h.alignLeft ? 'text-left' : 'text-right'}`}
                >
                  {h.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">{children}</tbody>
        </table>
      </div>
    </div>
  );
}
