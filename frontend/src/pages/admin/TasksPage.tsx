import React, { useState, useEffect, useCallback } from 'react';
import { Search, UserCheck } from 'lucide-react';
import { Task, User, TaskListResponse } from '../../types';
import { apiFetch } from '../../api/client';
import { StatusBadge } from '../../components/StatusBadge';
import { PriorityBadge } from '../../components/PriorityBadge';

export const TasksPage: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<string>('');

  const [reassignTask, setReassignTask] = useState<Task | null>(null);
  const [newOwnerId, setNewOwnerId] = useState<string>('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [tasksRes, usersRes] = await Promise.all([
        apiFetch<TaskListResponse>(`/api/admin/tasks?page=1&page_size=100${search ? `&search=${encodeURIComponent(search)}` : ''}${selectedUser ? `&user_id=${selectedUser}` : ''}`),
        apiFetch<{ items: User[] }>('/api/admin/users?page_size=100'),
      ]);
      setTasks(tasksRes.items);
      setUsers(usersRes.items);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch admin tasks');
    } finally {
      setLoading(false);
    }
  }, [search, selectedUser]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleReassignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reassignTask || !newOwnerId) return;
    try {
      await apiFetch(`/api/admin/tasks/${reassignTask.id}/reassign`, {
        method: 'PATCH',
        body: JSON.stringify({ new_owner_id: newOwnerId }),
      });
      alert('Task reassigned successfully');
      setReassignTask(null);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Reassignment failed');
    }
  };

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search all tasks..."
            className="w-full pl-10 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-sky-500"
          />
        </div>

        <select
          value={selectedUser}
          onChange={(e) => setSelectedUser(e.target.value)}
          className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-sky-500"
        >
          <option value="">Filter by User (All)</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.username}</option>
          ))}
        </select>
      </div>

      {error && (
        <div className="p-4 bg-red-950/60 border border-red-800 rounded-xl text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Task Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/80 text-xs uppercase font-semibold text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-6 py-3.5">Title</th>
                <th className="px-6 py-3.5">Owner</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5">Priority</th>
                <th className="px-6 py-3.5">Created</th>
                <th className="px-6 py-3.5 text-right">Reassign</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">Loading tasks...</td>
                </tr>
              ) : tasks.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">No tasks found.</td>
                </tr>
              ) : (
                tasks.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-100 max-w-xs truncate">
                      {t.title}
                    </td>
                    <td className="px-6 py-4 font-semibold text-sky-400">
                      {t.owner_username || 'Unknown'}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="px-6 py-4">
                      <PriorityBadge priority={t.priority} />
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-400">
                      {new Date(t.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => {
                          setReassignTask(t);
                          setNewOwnerId(t.owner_id);
                        }}
                        title="Reassign Task"
                        className="p-1.5 bg-slate-800 text-slate-300 hover:bg-slate-700 rounded-lg text-xs font-semibold inline-flex items-center space-x-1"
                      >
                        <UserCheck className="w-4 h-4" />
                        <span className="hidden sm:inline">Reassign</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reassign Modal */}
      {reassignTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-100">Reassign Task: '{reassignTask.title}'</h3>
            <form onSubmit={handleReassignSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Select New Owner</label>
                <select
                  value={newOwnerId}
                  onChange={(e) => setNewOwnerId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 text-sm"
                  required
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.username} ({u.role})</option>
                  ))}
                </select>
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setReassignTask(null)}
                  className="px-4 py-2 text-slate-400 hover:text-slate-200 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-sm font-semibold"
                >
                  Save Reassignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
