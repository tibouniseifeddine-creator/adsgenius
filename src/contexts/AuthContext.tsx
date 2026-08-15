import React, { createContext, useContext, useState } from 'react';
import { User, Business } from '../types';

interface RegisterInput {
  email: string;
  password: string;
  name: string;
  businessName: string;
}

interface AuthContextType {
  user: User | null;
  business: Business | null;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>({
    id: 'demo-user', email: 'demo@adsgenius.dz', name: 'Demo User', role: 'owner', businessId: 'demo-biz',
  });
  const [business] = useState<Business | null>({
    id: 'demo-biz', name: 'Ma Boutique DZ', type: 'Fashion', country: 'Algeria', currency: 'DZD', language: 'ar',
  });
  const [error] = useState<string | null>(null);

  const login = async () => {};
  const register = async (input: RegisterInput) => {
    setUser({
      id: 'demo-user',
      email: input.email,
      name: input.name,
      role: 'owner',
      businessId: 'demo-biz',
    });
  };
  const logout = () => setUser(null);

  return (
    <AuthContext.Provider value={{ user, business, login, register, logout, isAuthenticated: !!user, error }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
