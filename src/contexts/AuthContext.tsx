import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Business } from '../types';

interface RegisterData { email: string; password: string; name: string; businessName: string }
// See audit finding P12 -- when the account has 2FA enabled, POST
// /api/auth/login stops short of a real session and returns
// { twoFactorRequired: true } instead of a token. `login()` reports that back
// here so Auth.tsx can show a second-factor step instead of treating it as a
// failed login.
interface LoginResult { twoFactorRequired: boolean }
interface AuthContextType {
  user: User | null;
  business: Business | null;
  login: (email: string, password: string) => Promise<LoginResult>;
  // Completes a login that returned twoFactorRequired: true, using either a
  // current TOTP code from the user's authenticator app or one unused
  // recovery code. Throws (and sets `error`) on an invalid/expired code,
  // exactly like `login` does for a wrong password.
  verifyTwoFactorLogin: (input: { code?: string; recoveryCode?: string }) => Promise<void>;
  // Abandons an in-progress two-factor login (e.g. the user wants to go back
  // and try a different email/password) without waiting for the pending
  // token to expire on its own.
  cancelTwoFactorLogin: () => void;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  // Lets Settings.tsx push the freshly-saved workspace back into context right
  // after a successful PATCH /api/workspace, so the rest of the app sees the
  // change immediately without a second round trip. See audit finding P22.
  updateBusiness: (business: Business) => void;
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

// See audit finding P22 -- `business` used to be declared but never actually
// populated from anywhere, so every real user's Settings page silently showed
// blank fields. GET/PATCH /api/workspace now back it for real.
function mapWorkspace(apiWorkspace: any): Business {
  return {
    id: apiWorkspace.id,
    name: apiWorkspace.name,
    country: apiWorkspace.country,
    currency: apiWorkspace.currency,
    timezone: apiWorkspace.timezone,
  };
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
  // Set only between a login that returned twoFactorRequired and the matching
  // call to verifyTwoFactorLogin/cancelTwoFactorLogin. Never persisted --
  // losing it (e.g. a page refresh mid-flow) just means starting the login
  // over, which is the same failure mode as an expired pendingToken anyway.
  const [pendingTwoFactorToken, setPendingTwoFactorToken] = useState<string | null>(null);

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

  // Best-effort -- a failed workspace load shouldn't block the rest of the
  // app; Settings.tsx already handles `business` being briefly null.
  const loadBusiness = () => {
    authenticate('/api/workspace').then(data => setBusiness(mapWorkspace(data.workspace))).catch(() => {});
  };

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) { setLoading(false); return; }
    const expiresAt = tokenExpiresAt(token);
    if (expiresAt !== null && expiresAt <= Date.now()) { clearSession(); setLoading(false); return; }
    authenticate('/api/auth/me').then(data => setUser(mapUser(data.user))).catch(() => clearSession()).finally(() => setLoading(false));
    loadBusiness();
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

  const login = async (email: string, password: string): Promise<LoginResult> => {
    setError(null);
    try {
      const data = await authenticate('/api/auth/login', { email, password });
      if (data.twoFactorRequired) {
        setPendingTwoFactorToken(data.pendingToken);
        return { twoFactorRequired: true };
      }
      saveToken(data.token);
      setUser(mapUser(data.user));
      loadBusiness();
      return { twoFactorRequired: false };
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Login failed';
      setError(message);
      throw e;
    }
  };

  const verifyTwoFactorLogin = async (input: { code?: string; recoveryCode?: string }) => {
    setError(null);
    if (!pendingTwoFactorToken) {
      const message = 'No login in progress -- please enter your email and password again';
      setError(message);
      throw new Error(message);
    }
    try {
      const data = await authenticate('/api/auth/2fa/login-verify', { pendingToken: pendingTwoFactorToken, ...input });
      saveToken(data.token);
      setUser(mapUser(data.user));
      loadBusiness();
      setPendingTwoFactorToken(null);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Verification failed';
      setError(message);
      throw e;
    }
  };

  const cancelTwoFactorLogin = () => { setPendingTwoFactorToken(null); setError(null); };

  const register = async (data: RegisterData) => {
    setError(null);
    try { const result = await authenticate('/api/auth/register', data); saveToken(result.token); setUser(mapUser(result.user)); loadBusiness(); }
    catch (e) { const message = e instanceof Error ? e.message : 'Registration failed'; setError(message); throw e; }
  };

  const updateBusiness = (updated: Business) => setBusiness(updated);

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
  return <AuthContext.Provider value={{ user, business, login, verifyTwoFactorLogin, cancelTwoFactorLogin, register, logout, isAuthenticated: !!user, loading, error, updateBusiness }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
