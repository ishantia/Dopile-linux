import React, { useState, useEffect, useCallback } from 'react';
import { Server, Database, Download, RotateCcw, Activity, Users } from 'lucide-react';
import { ServerStatus, BackupInfo } from '../../types';
import { apiFetch } from '../../api/client';
import { ConfirmModal } from '../../components/ConfirmModal';

export const ServerPage: React.FC = () => {
  const [telemetry, setTelemetry] = useState<ServerStatus | null>(null);
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [restoringFilename, setRestoringFilename] = useState<string | null>(null);

  const fetchServerInfo = useCallback(async () => {
    setLoading(true);
    try {
      const [telemetryRes, backupsRes] = await Promise.all([
        apiFetch<ServerStatus>('/api/admin/server'),
        apiFetch<{ backups: BackupInfo[] }>('/api/admin/backups'),
      ]);
      setTelemetry(telemetryRes);
      setBackups(backupsRes.backups);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch server information');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServerInfo();
  }, [fetchServerInfo]);

  const handleCreateBackup = async () => {
    try {
      await apiFetch('/api/admin/backups', { method: 'POST' });
      alert('Backup created successfully!');
      fetchServerInfo();
    } catch (err: any) {
      alert(err.message || 'Backup creation failed');
    }
  };

  const handleRestoreBackup = async () => {
    if (!restoringFilename) return;
    try {
      await apiFetch(`/api/admin/backups/restore?filename=${encodeURIComponent(restoringFilename)}`, { method: 'POST' });
      alert(`Database successfully restored from '${restoringFilename}'!`);
      setRestoringFilename(null);
      fetchServerInfo();
    } catch (err: any) {
      alert(err.message || 'Restore failed');
    }
  };

  return (
    <div className="space-y-6">
      {/* Telemetry Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Status</span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-xl font-black text-emerald-400 capitalize">{telemetry?.database_status || 'OK'}</p>
          <span className="text-[10px] text-slate-500 font-mono">FastAPI + Uvicorn</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Uptime</span>
            <Server className="w-4 h-4 text-sky-400" />
          </div>
          <p className="text-xl font-black text-slate-100">
            {telemetry ? `${Math.floor(telemetry.uptime_seconds / 60)}m` : '0m'}
          </p>
          <span className="text-[10px] text-slate-500 font-mono">Dopile v{telemetry?.version || '1.0.0'}</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">WebSockets</span>
            <Users className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-xl font-black text-amber-300">{telemetry?.active_websocket_connections || 0}</p>
          <span className="text-[10px] text-slate-500 font-mono">Connected clients</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Database</span>
            <Database className="w-4 h-4 text-sky-400" />
          </div>
          <p className="text-xl font-black text-slate-100">{telemetry?.total_tasks || 0} Tasks</p>
          <span className="text-[10px] text-slate-500 font-mono">SQLite (WAL Mode)</span>
        </div>
      </div>

      {/* Backup & Restore Management */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-100">SQLite Database Backups</h3>
            <p className="text-xs text-slate-400 mt-0.5">Generate consistent online database snapshots</p>
          </div>
          <button
            onClick={handleCreateBackup}
            className="flex items-center justify-center space-x-2 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-semibold text-sm rounded-xl shadow-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Create Backup Now</span>
          </button>
        </div>

        {error && (
          <div className="p-4 bg-red-950/60 border border-red-800 rounded-xl text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Backups List */}
        <div className="border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/80 text-xs uppercase font-semibold text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-6 py-3.5">Filename</th>
                <th className="px-6 py-3.5">Size</th>
                <th className="px-6 py-3.5">Created Date</th>
                <th className="px-6 py-3.5 text-right">Restore</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 font-mono text-xs">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-500 font-sans">Loading backups...</td>
                </tr>
              ) : backups.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-500 font-sans">No backups generated yet.</td>
                </tr>
              ) : (
                backups.map((b) => (
                  <tr key={b.filename} className="hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-3.5 text-slate-100 font-semibold">{b.filename}</td>
                    <td className="px-6 py-3.5 text-slate-400">{(b.size_bytes / 1024).toFixed(1)} KB</td>
                    <td className="px-6 py-3.5 text-slate-400">{new Date(b.created_at).toLocaleString()}</td>
                    <td className="px-6 py-3.5 text-right">
                      <button
                        onClick={() => setRestoringFilename(b.filename)}
                        title="Restore Backup"
                        className="px-2.5 py-1 bg-amber-950/40 text-amber-400 border border-amber-800 hover:bg-amber-900/60 rounded-lg font-sans text-xs font-semibold inline-flex items-center space-x-1"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Restore</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Restore Confirm Modal */}
      <ConfirmModal
        isOpen={!!restoringFilename}
        title="Restore Database"
        message={`WARNING: Restoring '${restoringFilename}' will replace the current database state. A safety snapshot will be created before restoring.`}
        confirmLabel="Restore Database"
        isDangerous={true}
        onClose={() => setRestoringFilename(null)}
        onConfirm={handleRestoreBackup}
      />
    </div>
  );
};
