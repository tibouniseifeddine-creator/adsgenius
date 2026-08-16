import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Business } from '../types';

interface RegisterData { email: string; password: string; name: string; businessName: string }
interface AuthContextType {
  user: User | null;
  business: Business | null;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const API_URL = ((import.meta as any).env?.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';

function mapUser(apiUser: any): User {
  return { id: apiUser.id, email: apiUser.email, name: apiUser.name, role: 'owner', businessId: apiUser.businessId ?? apiUser.id };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const authenticate = async (path: string, body?: unknown) => {
    const token = localStorage.getItem('adsgenius_token');
    const response = await fetch(`${API_URL}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error ?? 'Authentication request failed');
    return data;
  };

  useEffect(() => {
    const token = localStorage.getItem('adsgenius_token');
    if (!token) { setLoading(false); return; }
    authenticate('/api/auth/me')
      .then(data => setUser(mapUser(data.user)))
      .catch(() => { localStorage.removeItem('adsgenius_token'); setUser(null); })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    setError(null);
    const data = await authenticate('/api/auth/login', { email, password });
    localStorage.setItem('adsgenius_token', data.token);
    setUser(mapUser(data.user));
  };

  const register = async (data: RegisterData) => {
    setError(null);
    const result = await authenticate('/api/auth/register', data);
    localStorage.setItem('adsgenius_token', result.token);
    setUser(mapUser(result.user));
  };

  const logout = () => { localStorage.removeItem('adsgenius_token'); setUser(null); setBusiness(null); setError(null); };

  return <AuthContext.Provider value={{ user, business, login, register, logout, isAuthenticated: !!user, loading, error }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
