import React, { useState } from 'react';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { Navbar } from './components/Navbar';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { TaskList } from './pages/TaskList';
import { Profile } from './pages/Profile';
import { AdminLayout } from './pages/admin/AdminLayout';
import { UsersPage } from './pages/admin/UsersPage';
import { TasksPage } from './pages/admin/TasksPage';
import { AuditLogsPage } from './pages/admin/AuditLogsPage';
import { ServerPage } from './pages/admin/ServerPage';

const MainContent: React.FC = () => {
  const { user, loading, isAdmin } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 font-medium">
        Loading Dopile...
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  const renderAdminTab = () => {
    switch (currentPage) {
      case 'admin':
      case 'admin/users':
        return <UsersPage />;
      case 'admin/tasks':
        return <TasksPage />;
      case 'admin/audit-logs':
        return <AuditLogsPage />;
      case 'admin/server':
        return <ServerPage />;
      default:
        return <UsersPage />;
    }
  };

  const renderContent = () => {
    if (currentPage.startsWith('admin')) {
      if (!isAdmin) {
        return (
          <div className="p-8 text-center text-red-400 bg-red-950/40 border border-red-800 rounded-2xl">
            Access Restricted: Admin privileges required.
          </div>
        );
      }
      return (
        <AdminLayout currentTab={currentPage} onTabChange={setCurrentPage}>
          {renderAdminTab()}
        </AdminLayout>
      );
    }

    switch (currentPage) {
      case 'dashboard':
        return <Dashboard onNavigate={setCurrentPage} />;
      case 'tasks':
        return <TaskList />;
      case 'profile':
        return <Profile />;
      default:
        return <Dashboard onNavigate={setCurrentPage} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar currentPage={currentPage} onNavigate={setCurrentPage} />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {renderContent()}
      </main>
      <footer className="bg-slate-950 border-t border-slate-900 py-6 text-center text-xs text-slate-600">
        <p>Dopile &mdash; Secure Self-Hosted LAN Task Manager Server for Android/Termux</p>
      </footer>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <MainContent />
    </AuthProvider>
  );
};

export default App;
