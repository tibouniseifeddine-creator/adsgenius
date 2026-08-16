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
const API_URL = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:4000';

function mapUser(apiUser: any): User {
  return { id: apiUser.id, email: apiUser.email, name: apiUser.name, role: 'owner', businessId: apiUser.id };
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
      .catch(() => localStorage.removeItem('adsgenius_token'))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    setError(null);
    try {
      const data = await authenticate('/api/auth/login', { email, password });
      localStorage.setItem('adsgenius_token', data.token);
      setUser(mapUser(data.user));
    } catch (e) { const message = e instanceof Error ? e.message : 'Login failed'; setError(message); throw e; }
  };

  const register = async (data: RegisterData) => {
    setError(null);
    try {
      const result = await authenticate('/api/auth/register', data);
      localStorage.setItem('adsgenius_token', result.token);
      setUser(mapUser(result.user));
    } catch (e) { const message = e instanceof Error ? e.message : 'Registration failed'; setError(message); throw e; }
  };

  const logout = () => { localStorage.removeItem('adsgenius_token'); setUser(null); setBusiness(null); };

  return <AuthContext.Provider value={{ user, business, login, register, logout, isAuthenticated: !!user, loading, error }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
