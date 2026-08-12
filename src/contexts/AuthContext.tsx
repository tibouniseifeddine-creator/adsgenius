import React, { createContext, useContext, useState } from 'react';
import { User, Business } from '../types';

interface AuthContextType {
  user: User | null;
  business: Business | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>({
    id: 'demo-user', email: 'demo@adsgenius.dz', name: 'Demo User', role: 'owner', businessId: 'demo-biz'
  });
  const [business] = useState<Business | null>({
    id: 'demo-biz', name: 'Ma Boutique DZ', type: 'Fashion', country: 'Algeria', currency: 'DZD', language: 'ar'
  });

  const login = async () => {};
  const logout = () => setUser(null);

  return (
    <AuthContext.Provider value={{ user, business, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
