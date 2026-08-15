import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { ApiClient, ApiClientError } from '@adsgenius/api-client';
import { User, Business } from '../types';

interface RegisterInput { email: string; password: string; name: string; businessName: string; }
interface AuthContextType {
  user: User | null;
  business: Business | null;
  workspaceId: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const api = new ApiClient({ baseUrl: import.meta.env.VITE_API_BASE_URL ?? '' });

function mapRole(role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER'): User['role'] {
  if (role === 'OWNER') return 'owner';
  if (role === 'ADMIN') return 'admin';
  if (role === 'MEMBER') return 'media_buyer';
  return 'viewer';
}

function workspaceToBusiness(workspace: { id: string; name: string; defaultCountryCode: string; defaultCurrency: string }): Business {
  return { id: workspace.id, name: workspace.name, type: 'Business', country: workspace.defaultCountryCode, currency: workspace.defaultCurrency, language: workspace.defaultCountryCode === 'DZ' ? 'ar' : 'en' };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(() => localStorage.getItem('adsgenius.workspaceId'));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const applySession = (session: Awaited<ReturnType<typeof api.me>>) => {
    const selected = session.workspaces.find((workspace) => workspace.id === workspaceId) ?? session.workspaces[0];
    if (!selected) throw new Error('No workspace is available for this account.');
    setWorkspaceId(selected.id);
    localStorage.setItem('adsgenius.workspaceId', selected.id);
    setUser({ id: session.user.id, email: session.user.email, name: session.user.name, role: mapRole(selected.role), businessId: selected.id });
    setBusiness(workspaceToBusiness(selected));
  };

  useEffect(() => { void api.me().then(applySession).catch(() => undefined).finally(() => setLoading(false)); }, []);

  const login = async (email: string, password: string) => {
    setError(null); setLoading(true);
    try { await api.login(email, password); applySession(await api.me()); }
    catch (cause) { setError(cause instanceof ApiClientError ? cause.message : 'Unable to sign in.'); throw cause; }
    finally { setLoading(false); }
  };

  const register = async (input: RegisterInput) => {
    setError(null); setLoading(true);
    try { await api.register({ email: input.email, password: input.password, name: input.name, workspaceName: input.businessName }); applySession(await api.me()); }
    catch (cause) { setError(cause instanceof ApiClientError ? cause.message : 'Unable to create the account.'); throw cause; }
    finally { setLoading(false); }
  };

  const logout = async () => {
    try { await api.logout(); } finally { setUser(null); setBusiness(null); setWorkspaceId(null); localStorage.removeItem('adsgenius.workspaceId'); }
  };

  const value = useMemo(() => ({ user, business, workspaceId, login, register, logout, isAuthenticated: !!user, loading, error }), [user, business, workspaceId, loading, error]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
