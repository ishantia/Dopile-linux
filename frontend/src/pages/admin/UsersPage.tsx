import React, { useState, useEffect, useCallback } from 'react';
import { UserPlus, Search, Shield, Key, CheckCircle2, XCircle, Trash2, Globe } from 'lucide-react';
import { User, UserRole } from '../../types';
import { apiFetch } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { ConfirmModal } from '../../components/ConfirmModal';

export const UsersPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // New User Form
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('USER');

  // Reset Password Modal
  const [resetUser, setResetUser] = useState<User | null>(null);
  const [resetPassword, setResetPassword] = useState('');

  // Status Toggle Confirmation
  const [toggleUser, setToggleUser] = useState<User | null>(null);

  // Delete User Confirmation
  const [deleteUser, setDeleteUser] = useState<User | null>(null);

  // Edit/Reset IP Modal
  const [ipEditUser, setIpEditUser] = useState<User | null>(null);
  const [targetIp, setTargetIp] = useState('');

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const query = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : '';
      const res = await apiFetch<{ items: User[] }>(`/api/admin/users${query}`);
      setUsers(res.items);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          username: newUsername.trim(),
          password: newPassword,
          email: newEmail.trim() || undefined,
          role: newRole,
        }),
      });
      setCreateModalOpen(false);
      setNewUsername('');
      setNewPassword('');
      setNewEmail('');
      setNewRole('USER');
      fetchUsers();
    } catch (err: any) {
      alert(err.message || 'Failed to create user');
    }
  };

  const handleToggleStatus = async () => {
    if (!toggleUser) return;
    try {
      await apiFetch(`/api/admin/users/${toggleUser.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: !toggleUser.is_active }),
      });
      fetchUsers();
    } catch (err: any) {
      alert(err.message || 'Failed to update user status');
    }
  };

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    try {
      await apiFetch(`/api/admin/users/${userId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role: newRole }),
      });
      fetchUsers();
    } catch (err: any) {
      alert(err.message || 'Role update failed');
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetUser || !resetPassword) return;
    try {
      await apiFetch(`/api/admin/users/${resetUser.id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ new_password: resetPassword }),
      });
      alert(`Password for '${resetUser.username}' updated successfully.`);
      setResetUser(null);
      setResetPassword('');
    } catch (err: any) {
      alert(err.message || 'Password reset failed');
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteUser) return;
    try {
      await apiFetch(`/api/admin/users/${deleteUser.id}`, { method: 'DELETE' });
      fetchUsers();
    } catch (err: any) {
      alert(err.message || 'Failed to delete user');
    }
  };

  const handleIpSave = async (ipValue: string | null) => {
    if (!ipEditUser) return;
    try {
      await apiFetch(`/api/admin/users/${ipEditUser.id}/ip`, {
        method: 'PATCH',
        body: JSON.stringify({ allowed_ip: ipValue }),
      });
      setIpEditUser(null);
      setTargetIp('');
      fetchUsers();
    } catch (err: any) {
      alert(err.message || 'Failed to update user IP binding');
    }
  };

  return (
    <div className="space-y-6">
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users by username or email..."
            className="w-full pl-10 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:border-sky-500"
          />
        </div>

        <button
          onClick={() => setCreateModalOpen(true)}
          className="flex items-center justify-center space-x-2 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold rounded-xl shadow-lg transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add User</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-950/60 border border-red-800 rounded-xl text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Users Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/80 text-xs uppercase font-semibold text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-6 py-3.5">User</th>
                <th className="px-6 py-3.5">Role</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5">Bound Wi-Fi IP</th>
                <th className="px-6 py-3.5">Created</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">Loading users...</td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">No users found.</td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-100">
                      <div className="flex items-center space-x-2">
                        <span>{u.username}</span>
                        {u.id === currentUser?.id && (
                          <span className="text-[10px] bg-sky-950 text-sky-400 border border-sky-800 px-1.5 py-0.5 rounded">You</span>
                        )}
                      </div>
                      {u.email && <p className="text-xs text-slate-500">{u.email}</p>}
                    </td>
                    <td className="px-6 py-4">
                      <select
                        disabled={u.id === currentUser?.id}
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                        className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-sky-500 disabled:opacity-50"
                      >
                        <option value="USER">USER</option>
                        <option value="ADMIN">ADMIN</option>
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      {u.is_active ? (
                        <span className="inline-flex items-center space-x-1 text-xs font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Active</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 text-xs font-semibold text-red-400 bg-red-950/60 border border-red-800 px-2 py-0.5 rounded-full">
                          <XCircle className="w-3 h-3" />
                          <span>Deactivated</span>
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs">
                      {u.allowed_ip ? (
                        <span className="inline-flex items-center space-x-1 text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-2 py-0.5 rounded text-[11px]">
                          {u.allowed_ip}
                        </span>
                      ) : (
                        <span className="text-slate-500 italic text-[11px]">Unbound</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-400">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => {
                          setIpEditUser(u);
                          setTargetIp(u.allowed_ip || '');
                        }}
                        title="Manage Bound IP Address"
                        className="p-1.5 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-sky-400 rounded-lg transition-colors border border-slate-700"
                      >
                        <Globe className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => setResetUser(u)}
                        title="Reset Password"
                        className="p-1.5 bg-slate-800 text-slate-300 hover:bg-slate-700 rounded-lg border border-slate-700"
                      >
                        <Key className="w-4 h-4" />
                      </button>

                      {u.id !== currentUser?.id && (
                        <>
                          <button
                            onClick={() => setToggleUser(u)}
                            title={u.is_active ? 'Deactivate Account' : 'Reactivate Account'}
                            className={`p-1.5 rounded-lg border ${
                              u.is_active
                                ? 'bg-amber-950/40 text-amber-400 border-amber-800 hover:bg-amber-900/60'
                                : 'bg-emerald-950/40 text-emerald-400 border-emerald-800 hover:bg-emerald-900/60'
                            }`}
                          >
                            <Shield className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => setDeleteUser(u)}
                            title="Delete User Account"
                            className="p-1.5 bg-slate-800 text-slate-400 hover:text-red-400 hover:bg-red-950/40 rounded-lg transition-colors border border-slate-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create User Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-100">Create New User Account</h3>
            <form onSubmit={handleCreateUser} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Username *</label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Initial Password *</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 8 chars, 1 digit or symbol"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Role</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 text-sm"
                >
                  <option value="USER">USER</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </div>

              <div className="pt-4 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 text-slate-400 hover:text-slate-200 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-sm font-semibold"
                >
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Reset Password Modal */}
      {resetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-100">Reset Password for '{resetUser.username}'</h3>
            <form onSubmit={handleResetPasswordSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">New Password *</label>
                <input
                  type="password"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  placeholder="Min 8 chars"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 text-sm"
                  required
                />
              </div>

              <div className="pt-4 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setResetUser(null)}
                  className="px-4 py-2 text-slate-400 hover:text-slate-200 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-sm font-semibold"
                >
                  Reset Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Status Toggle Confirm */}
      <ConfirmModal
        isOpen={!!toggleUser}
        title={toggleUser?.is_active ? 'Deactivate User Account' : 'Reactivate User Account'}
        message={`Are you sure you want to ${toggleUser?.is_active ? 'deactivate' : 'reactivate'} user '${toggleUser?.username}'?`}
        confirmLabel={toggleUser?.is_active ? 'Deactivate' : 'Reactivate'}
        isDangerous={toggleUser?.is_active}
        onClose={() => setToggleUser(null)}
        onConfirm={handleToggleStatus}
      />

      {/* Admin Delete User Confirm */}
      <ConfirmModal
        isOpen={!!deleteUser}
        title="Permanently Delete User Account"
        message={`Are you sure you want to permanently delete user '${deleteUser?.username}'? All their tasks will be deleted.`}
        confirmLabel="Delete User"
        isDangerous={true}
        onClose={() => setDeleteUser(null)}
        onConfirm={handleDeleteUser}
      />

      {/* Manage Bound IP Modal */}
      {ipEditUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-100">Manage Bound IP for '{ipEditUser.username}'</h3>
            <p className="text-xs text-slate-400">
              Restricts account access exclusively to a designated Wi-Fi / LAN IP address.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleIpSave(targetIp.trim() || null);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Allowed IP Address</label>
                <input
                  type="text"
                  value={targetIp}
                  onChange={(e) => setTargetIp(e.target.value)}
                  placeholder="e.g. 192.168.1.50 (Leave blank to unbind)"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 font-mono text-sm focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => handleIpSave(null)}
                  className="px-3 py-1.5 bg-red-950/40 border border-red-800 text-red-400 hover:bg-red-900/60 rounded-lg text-xs font-semibold"
                >
                  Reset (Unbind IP)
                </button>

                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => setIpEditUser(null)}
                    className="px-3 py-1.5 text-slate-400 hover:text-slate-200 text-xs font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold"
                  >
                    Save IP
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
