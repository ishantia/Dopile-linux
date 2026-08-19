import React from 'react';
import { Calendar, User as UserIcon, CheckCircle2, Clock, Edit2, Trash2 } from 'lucide-react';
import { Task, TaskStatus } from '../types';
import { StatusBadge } from './StatusBadge';
import { PriorityBadge } from './PriorityBadge';

interface TaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, onEdit, onDelete, onStatusChange }) => {
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'COMPLETED';

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg hover:border-slate-700 transition-all flex flex-col justify-between space-y-4">
      <div className="space-y-3">
        {/* Badges Header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center space-x-2">
            <StatusBadge status={task.status} />
            <PriorityBadge priority={task.priority} />
          </div>
          {task.owner_username && (
            <div className="flex items-center space-x-1 text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
              <UserIcon className="w-3 h-3 text-slate-400" />
              <span>{task.owner_username}</span>
            </div>
          )}
        </div>

        {/* Title */}
        <h3 className={`text-base font-bold tracking-tight ${task.status === 'COMPLETED' ? 'line-through text-slate-400' : 'text-slate-100'}`}>
          {task.title}
        </h3>

        {/* Description */}
        {task.description && (
          <p className="text-sm text-slate-400 line-clamp-3 leading-relaxed">
            {task.description}
          </p>
        )}
      </div>

      {/* Footer Info & Actions */}
      <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between flex-wrap gap-2 text-xs">
        {/* Due Date */}
        {task.due_date ? (
          <div className={`flex items-center space-x-1.5 ${isOverdue ? 'text-red-400 font-semibold' : 'text-slate-400'}`}>
            <Calendar className="w-3.5 h-3.5" />
            <span>{new Date(task.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            {isOverdue && <span className="bg-red-950 text-red-400 text-[10px] px-1.5 py-0.5 rounded border border-red-800">Overdue</span>}
          </div>
        ) : (
          <div className="text-slate-600">No due date</div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center space-x-1.5">
          {task.status !== 'COMPLETED' && (
            <button
              onClick={() => onStatusChange(task.id, 'COMPLETED')}
              title="Mark Completed"
              className="p-1.5 rounded-lg bg-emerald-950/40 text-emerald-400 hover:bg-emerald-900/60 border border-emerald-800 transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
            </button>
          )}

          {task.status === 'TODO' && (
            <button
              onClick={() => onStatusChange(task.id, 'IN_PROGRESS')}
              title="Mark In Progress"
              className="p-1.5 rounded-lg bg-amber-950/40 text-amber-400 hover:bg-amber-900/60 border border-amber-800 transition-colors"
            >
              <Clock className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={() => onEdit(task)}
            title="Edit Task"
            className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
          >
            <Edit2 className="w-4 h-4" />
          </button>

          <button
            onClick={() => onDelete(task.id)}
            title="Delete Task"
            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-red-400 hover:bg-red-950/40 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
