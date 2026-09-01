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
// Production uses the same origin, so the deployed frontend and API can never drift apart.
// VITE_API_URL remains available for local/staged deployments that use a separate API host.
const configuredApiUrl = (import.meta as any).env?.VITE_API_URL?.trim();
const API_URL = configuredApiUrl || ((import.meta as any).env?.DEV ? 'http://localhost:4000' : '');
const TOKEN_KEY = 'adsgenius_token';

function mapUser(apiUser: any): User {
  return { id: apiUser.id, email: apiUser.email, name: apiUser.name, role: 'owner', businessId: apiUser.id };
}

function tokenExpiresAt(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch { return null; }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const clearSession = () => { localStorage.removeItem(TOKEN_KEY); setUser(null); setBusiness(null); };

  const authenticate = async (path: string, body?: unknown) => {
    const token = localStorage.getItem(TOKEN_KEY);
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
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) { setLoading(false); return; }
    const expiresAt = tokenExpiresAt(token);
    if (expiresAt !== null && expiresAt <= Date.now()) { clearSession(); setLoading(false); return; }
    authenticate('/api/auth/me').then(data => setUser(mapUser(data.user))).catch(() => clearSession()).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    const expiresAt = token ? tokenExpiresAt(token) : null;
    if (!expiresAt) return;
    const timer = window.setTimeout(clearSession, Math.max(0, expiresAt - Date.now()));
    return () => window.clearTimeout(timer);
  }, [user]);

  const saveToken = (token: string) => {
    localStorage.setItem(TOKEN_KEY, token);
    const expiresAt = tokenExpiresAt(token);
    if (expiresAt !== null && expiresAt <= Date.now()) throw new Error('Authentication session expired');
  };

  const login = async (email: string, password: string) => {
    setError(null);
    try { const data = await authenticate('/api/auth/login', { email, password }); saveToken(data.token); setUser(mapUser(data.user)); }
    catch (e) { const message = e instanceof Error ? e.message : 'Login failed'; setError(message); throw e; }
  };

  const register = async (data: RegisterData) => {
    setError(null);
    try { const result = await authenticate('/api/auth/register', data); saveToken(result.token); setUser(mapUser(result.user)); }
    catch (e) { const message = e instanceof Error ? e.message : 'Registration failed'; setError(message); throw e; }
  };

  // Clears the local session immediately (so the UI feels instant even
  // offline), then best-effort tells the server to revoke this exact token
  // too -- see audit finding P26. Previously logout only ever forgot the
  // token locally, so a copy of it elsewhere (a shared device, a leaked
  // token) stayed valid until its natural 7-day expiry regardless.
  const logout = () => {
    const token = localStorage.getItem(TOKEN_KEY);
    clearSession();
    if (token) {
      fetch(`${API_URL}/api/auth/logout`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
    }
  };
  return <AuthContext.Provider value={{ user, business, login, register, logout, isAuthenticated: !!user, loading, error }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
