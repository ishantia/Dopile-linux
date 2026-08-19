import React, { useState, useEffect, useCallback } from 'react';
import { Search, Plus, Filter, ArrowUpDown, ChevronLeft, ChevronRight, ListTodo } from 'lucide-react';
import { Task, TaskStatus, TaskListResponse } from '../types';
import { apiFetch } from '../api/client';
import { TaskCard } from '../components/TaskCard';
import { TaskModal } from '../components/TaskModal';
import { ConfirmModal } from '../components/ConfirmModal';

export const TaskList: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedPriority, setSelectedPriority] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortDir, setSortDir] = useState('desc');

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        page_size: '12',
        sort_by: sortBy,
        sort_dir: sortDir,
      });

      if (search.trim()) params.append('search', search.trim());
      if (selectedStatus !== 'ALL') params.append('status', selectedStatus);
      if (selectedPriority !== 'ALL') params.append('priority', selectedPriority);

      const res = await apiFetch<TaskListResponse>(`/api/tasks?${params.toString()}`);
      setTasks(res.items);
      setTotal(res.total);
      setTotalPages(res.total_pages);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch tasks');
    } finally {
      setLoading(false);
    }
  }, [page, search, selectedStatus, selectedPriority, sortBy, sortDir]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    try {
      await apiFetch(`/api/tasks/${taskId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      fetchTasks();
    } catch (err: any) {
      alert(err.message || 'Status update failed');
    }
  };

  const handleCreateTask = async (data: any) => {
    await apiFetch('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    fetchTasks();
  };

  const handleUpdateTask = async (data: any) => {
    if (!editingTask) return;
    await apiFetch(`/api/tasks/${editingTask.id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    fetchTasks();
  };

  const handleDeleteTask = async () => {
    if (!deletingTaskId) return;
    try {
      await apiFetch(`/api/tasks/${deletingTaskId}`, { method: 'DELETE' });
      fetchTasks();
    } catch (err: any) {
      alert(err.message || 'Delete failed');
    }
  };

  const statusTabs = [
    { id: 'ALL', label: 'All' },
    { id: 'TODO', label: 'To Do' },
    { id: 'IN_PROGRESS', label: 'In Progress' },
    { id: 'COMPLETED', label: 'Completed' },
    { id: 'ARCHIVED', label: 'Archived' },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-100">Tasks</h1>
          <p className="text-xs text-slate-400 mt-1">Manage and track your tasks</p>
        </div>
        <button
          onClick={() => setCreateModalOpen(true)}
          className="flex items-center justify-center space-x-2 px-4 py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-semibold text-sm rounded-xl shadow-lg shadow-sky-950 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>New Task</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search tasks..."
              className="w-full pl-10 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:border-sky-500"
            />
          </div>

          {/* Priority Filter */}
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <select
              value={selectedPriority}
              onChange={(e) => {
                setSelectedPriority(e.target.value);
                setPage(1);
              }}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-sky-500"
            >
              <option value="ALL">All Priorities</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </div>

          {/* Sort Selection */}
          <div className="flex items-center space-x-2">
            <ArrowUpDown className="w-4 h-4 text-slate-500" />
            <select
              value={`${sortBy}:${sortDir}`}
              onChange={(e) => {
                const [sb, sd] = e.target.value.split(':');
                setSortBy(sb);
                setSortDir(sd);
              }}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-sky-500"
            >
              <option value="created_at:desc">Newest First</option>
              <option value="created_at:asc">Oldest First</option>
              <option value="due_date:asc">Due Date (Asc)</option>
              <option value="priority:desc">Priority (High first)</option>
              <option value="title:asc">Title (A-Z)</option>
            </select>
          </div>
        </div>

        {/* Status Tabs */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 border-t border-slate-800/80 pt-3">
          {statusTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setSelectedStatus(tab.id);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedStatus === tab.id
                  ? 'bg-sky-600/20 text-sky-400 border border-sky-800'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Task List Content */}
      {error && (
        <div className="p-4 bg-red-950/60 border border-red-800 rounded-xl text-red-300 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-slate-500">Loading tasks...</div>
      ) : tasks.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
          <ListTodo className="w-12 h-12 text-slate-700 mx-auto" />
          <h3 className="text-base font-bold text-slate-300">No matching tasks found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Try adjusting your search criteria or create a new task.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tasks.map((t) => (
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

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-2xl px-5 py-3">
          <span className="text-xs text-slate-400">
            Showing Page <span className="font-bold text-slate-200">{page}</span> of{' '}
            <span className="font-bold text-slate-200">{totalPages}</span> ({total} total tasks)
          </span>

          <div className="flex items-center space-x-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200 disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

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
