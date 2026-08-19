import React from 'react';
import { TaskStatus } from '../types';

const statusConfig: Record<TaskStatus, { label: string; bg: string; text: string }> = {
  TODO: { label: 'To Do', bg: 'bg-slate-800 border-slate-700', text: 'text-slate-300' },
  IN_PROGRESS: { label: 'In Progress', bg: 'bg-amber-950/60 border-amber-800', text: 'text-amber-300' },
  COMPLETED: { label: 'Completed', bg: 'bg-emerald-950/60 border-emerald-800', text: 'text-emerald-300' },
  ARCHIVED: { label: 'Archived', bg: 'bg-zinc-800 border-zinc-700', text: 'text-zinc-400' },
};

export const StatusBadge: React.FC<{ status: TaskStatus }> = ({ status }) => {
  const cfg = statusConfig[status] || statusConfig.TODO;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  );
};
