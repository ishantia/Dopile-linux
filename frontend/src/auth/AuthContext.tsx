import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { apiFetch, setCsrfToken } from '../api/client';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, email?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCurrentUser = async () => {
    try {
      const data = await apiFetch<{ authenticated: boolean; user: User | null }>('/api/auth/me');
      if (data.authenticated && data.user) {
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const login = async (username: string, password: string) => {
    const data = await apiFetch<{ csrf_token: string; user?: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    if (data.csrf_token) {
      setCsrfToken(data.csrf_token);
    }
    if (data.user) {
      setUser(data.user);
    } else {
      await fetchCurrentUser();
    }
  };

  const register = async (username: string, password: string, email?: string) => {
    const data = await apiFetch<{ csrf_token: string; user?: User }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password, email }),
    });
    if (data.csrf_token) {
      setCsrfToken(data.csrf_token);
    }
    if (data.user) {
      setUser(data.user);
    } else {
      await fetchCurrentUser();
    }
  };

  const logout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore logout errors
    } finally {
      setUser(null);
      setCsrfToken(null);
    }
  };

  const isAdmin = user?.role === 'ADMIN';

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser: fetchCurrentUser, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
