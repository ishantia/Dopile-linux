import React, { useState, useEffect, useCallback } from 'react';
import { ListTodo, Clock, CheckCircle2, AlertTriangle, Plus, RefreshCw } from 'lucide-react';
import { Task, TaskStatus, TaskListResponse } from '../types';
import { apiFetch } from '../api/client';
import { TaskCard } from '../components/TaskCard';
import { TaskModal } from '../components/TaskModal';
import { ConfirmModal } from '../components/ConfirmModal';

interface DashboardProps {
  onNavigate: (page: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<TaskListResponse>('/api/tasks?page=1&page_size=100&sort_by=created_at&sort_dir=desc');
      setTasks(res.items);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard tasks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();

    // WebSocket real-time subscription
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (['TASK_CREATED', 'TASK_UPDATED', 'TASK_DELETED', 'TASK_STATUS_CHANGED'].includes(data.event)) {
          fetchDashboardData();
        }
      } catch {
        // ignore parse error
      }
    };

    return () => {
      ws.close();
    };
  }, [fetchDashboardData]);

  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    try {
      await apiFetch(`/api/tasks/${taskId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      fetchDashboardData();
    } catch (err: any) {
      alert(err.message || 'Status update failed');
    }
  };

  const handleCreateTask = async (data: any) => {
    await apiFetch('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    fetchDashboardData();
  };

  const handleUpdateTask = async (data: any) => {
    if (!editingTask) return;
    await apiFetch(`/api/tasks/${editingTask.id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    fetchDashboardData();
  };

  const handleDeleteTask = async () => {
    if (!deletingTaskId) return;
    try {
      await apiFetch(`/api/tasks/${deletingTaskId}`, { method: 'DELETE' });
      fetchDashboardData();
    } catch (err: any) {
      alert(err.message || 'Delete failed');
    }
  };

  // Metrics
  const total = tasks.length;
  const todoCount = tasks.filter((t) => t.status === 'TODO').length;
  const inProgressCount = tasks.filter((t) => t.status === 'IN_PROGRESS').length;
  const completedCount = tasks.filter((t) => t.status === 'COMPLETED').length;
  const overdueCount = tasks.filter(
    (t) => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'COMPLETED'
  ).length;

  const recentTasks = tasks.slice(0, 6);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-100">Dashboard</h1>
          <p className="text-xs text-slate-400 mt-1">Overview of active tasks and server operations</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={fetchDashboardData}
            title="Refresh"
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setCreateModalOpen(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-semibold text-sm rounded-xl shadow-lg shadow-sky-950 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>New Task</span>
          </button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Total</span>
            <ListTodo className="w-4 h-4 text-sky-400" />
          </div>
          <p className="text-2xl font-black text-slate-100">{total}</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">To Do</span>
            <ListTodo className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-black text-slate-300">{todoCount}</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between text-amber-400/80">
            <span className="text-xs font-semibold uppercase tracking-wider">In Progress</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-black text-amber-300">{inProgressCount}</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between text-emerald-400/80">
            <span className="text-xs font-semibold uppercase tracking-wider">Completed</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-black text-emerald-300">{completedCount}</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2 col-span-2 md:col-span-1">
          <div className="flex items-center justify-between text-red-400/80">
            <span className="text-xs font-semibold uppercase tracking-wider">Overdue</span>
            <AlertTriangle className="w-4 h-4 text-red-400" />
          </div>
          <p className="text-2xl font-black text-red-400">{overdueCount}</p>
        </div>
      </div>

      {/* Recent Tasks */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-200">Recent Tasks</h2>
          <button
            onClick={() => onNavigate('tasks')}
            className="text-xs font-semibold text-sky-400 hover:text-sky-300 transition-colors"
          >
            View All Tasks &rarr;
          </button>
        </div>

        {error && (
          <div className="p-4 bg-red-950/60 border border-red-800 rounded-xl text-red-300 text-sm">
            {error}
          </div>
        )}

        {loading && recentTasks.length === 0 ? (
          <div className="text-center py-12 text-slate-500">Loading tasks...</div>
        ) : recentTasks.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
            <ListTodo className="w-12 h-12 text-slate-700 mx-auto" />
            <h3 className="text-base font-bold text-slate-300">No tasks created yet</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Get started by creating your first task using the button above.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentTasks.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                onEdit={(taskToEdit) => setEditingTask(taskToEdit)}
                onDelete={(taskId) => setDeletingTaskId(taskId)}
                onStatusChange={handleStatusChange}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <TaskModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSave={handleCreateTask}
      />

      <TaskModal
        isOpen={!!editingTask}
        initialTask={editingTask}
        onClose={() => setEditingTask(null)}
        onSave={handleUpdateTask}
      />

      <ConfirmModal
        isOpen={!!deletingTaskId}
        title="Delete Task"
        message="Are you sure you want to permanently delete this task?"
        confirmLabel="Delete"
        onClose={() => setDeletingTaskId(null)}
        onConfirm={handleDeleteTask}
      />
    </div>
  );
};
