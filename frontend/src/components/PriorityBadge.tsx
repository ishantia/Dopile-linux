import React from 'react';
import { TaskPriority } from '../types';

const priorityConfig: Record<TaskPriority, { label: string; bg: string; text: string }> = {
  LOW: { label: 'Low', bg: 'bg-slate-800 border-slate-700', text: 'text-slate-400' },
  MEDIUM: { label: 'Medium', bg: 'bg-blue-950/60 border-blue-800', text: 'text-blue-300' },
  HIGH: { label: 'High', bg: 'bg-orange-950/60 border-orange-800', text: 'text-orange-300' },
  URGENT: { label: 'Urgent', bg: 'bg-red-950/60 border-red-800', text: 'text-red-300 animate-pulse' },
};

export const PriorityBadge: React.FC<{ priority: TaskPriority }> = ({ priority }) => {
  const cfg = priorityConfig[priority] || priorityConfig.MEDIUM;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  );
};
