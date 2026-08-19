import React from 'react';
import { Users, ListTodo, FileText, Server } from 'lucide-react';

interface AdminLayoutProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  children: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ currentTab, onTabChange, children }) => {
  const tabs = [
    { id: 'admin/users', label: 'User Management', icon: Users },
    { id: 'admin/tasks', label: 'Task Oversight', icon: ListTodo },
    { id: 'admin/audit-logs', label: 'Audit Logs', icon: FileText },
    { id: 'admin/server', label: 'Server & Backups', icon: Server },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-100">Administration</h1>
        <p className="text-xs text-slate-400 mt-1">System controls, user management, and security telemetry</p>
      </div>

      {/* Admin Sub-nav */}
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-3 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
                active
                  ? 'bg-sky-600/20 text-sky-400 border border-sky-800'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div>{children}</div>
    </div>
  );
};
