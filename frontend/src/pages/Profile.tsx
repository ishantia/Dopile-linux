import React, { useState } from 'react';
import { User, Key, Shield, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { apiFetch } from '../api/client';

export const Profile: React.FC = () => {
  const { user, logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Self Account Delete state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) {
      setError('Please fill in all required password fields.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await apiFetch('/api/users/me/password', {
        method: 'PUT',
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });
      setSuccess('Password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.message || 'Failed to update password');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deletePassword) {
      setDeleteError('Password is required to delete your account.');
      return;
    }
    setDeleting(true);
    setDeleteError(null);
    try {
      await apiFetch('/api/users/me', {
        method: 'DELETE',
        body: JSON.stringify({ password: deletePassword }),
      });
      await logout();
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete account');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-100">User Profile</h1>
        <p className="text-xs text-slate-400 mt-1">Manage your account and security settings</p>
      </div>

      {/* Account Info Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-2xl bg-sky-950 border border-sky-800 flex items-center justify-center text-sky-400">
            <User className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100">{user?.username}</h2>
            <div className="flex items-center space-x-2 text-xs text-slate-400 mt-0.5">
              <Shield className="w-3.5 h-3.5 text-sky-400" />
              <span>Role: <strong className="text-slate-200">{user?.role}</strong></span>
              <span>&bull;</span>
              <span>Account Status: <strong className="text-emerald-400">Active</strong></span>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <span className="text-slate-500 font-semibold uppercase">Account ID</span>
            <p className="text-slate-300 font-mono mt-0.5">{user?.id}</p>
          </div>
          <div>
            <span className="text-slate-500 font-semibold uppercase">Bound Wi-Fi IP</span>
            <p className="text-slate-300 font-mono mt-0.5">
              {user?.allowed_ip ? (
                <span className="inline-flex items-center space-x-1 text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-2 py-0.5 rounded font-mono text-[11px]">
                  {user.allowed_ip}
                </span>
              ) : (
                <span className="text-slate-500 italic">Unbound / Dynamic</span>
              )}
            </p>
          </div>
          <div>
            <span className="text-slate-500 font-semibold uppercase">Joined Date</span>
            <p className="text-slate-300 mt-0.5">
              {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
            </p>
          </div>
        </div>
      </div>

      {/* Password Change Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center space-x-3">
          <Key className="w-5 h-5 text-sky-400" />
          <h2 className="text-base font-bold text-slate-100">Change Password</h2>
        </div>

        {error && (
          <div className="flex items-center space-x-2 p-3 bg-red-950/60 border border-red-800 rounded-xl text-red-300 text-xs">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="flex items-center space-x-2 p-3 bg-emerald-950/60 border border-emerald-800 rounded-xl text-emerald-300 text-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Current Password *
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-sky-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              New Password *
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-sky-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Confirm New Password *
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-sky-500"
              required
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {saving ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>

      {/* Danger Zone: Delete Account */}
      <div className="bg-red-950/20 border border-red-900/60 rounded-2xl p-6 space-y-4">
        <h2 className="text-base font-bold text-red-400">Danger Zone</h2>
        <p className="text-xs text-slate-400">
          Permanently delete your account and all associated tasks. This action cannot be undone.
        </p>
        <button
          onClick={() => {
            setDeleteModalOpen(true);
            setDeletePassword('');
            setDeleteError(null);
          }}
          className="px-4 py-2 bg-red-600/80 hover:bg-red-600 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          Delete My Account
        </button>
      </div>

      {/* Account Deletion Confirmation Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-red-400">Permanently Delete Account</h3>
            <p className="text-xs text-slate-300">
              Are you sure you want to delete your account <strong>{user?.username}</strong>? All your tasks will be permanently removed.
            </p>

            {deleteError && (
              <div className="p-3 bg-red-950/60 border border-red-800 rounded-xl text-red-300 text-xs">
                {deleteError}
              </div>
            )}

            <form onSubmit={handleDeleteAccountSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Enter Password to Confirm *
                </label>
                <input
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="Your account password"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-red-500"
                  required
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setDeleteModalOpen(false)}
                  className="px-4 py-2 text-slate-400 hover:text-slate-200 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={deleting}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-semibold disabled:opacity-50"
                >
                  {deleting ? 'Deleting...' : 'Delete My Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
