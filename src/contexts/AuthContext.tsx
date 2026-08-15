import React, { createContext, useContext, useState } from 'react';
import { User, Business } from '../types';
interface RegisterData { email: string; password: string; name: string; businessName: string }
interface AuthContextType { user: User | null; business: Business | null; login: (email: string, password: string) => Promise<void>; register: (data: RegisterData) => Promise<void>; logout: () => void; isAuthenticated: boolean; error: string | null }
const AuthContext = createContext<AuthContextType | undefined>(undefined);
export function AuthProvider({ children }: { children: React.ReactNode }) {
 const [user,setUser]=useState<User|null>({id:'demo-user',email:'demo@adsgenius.dz',name:'Demo User',role:'owner',businessId:'demo-biz'});
 const [business]=useState<Business|null>({id:'demo-biz',name:'Ma Boutique DZ',type:'Fashion',country:'Algeria',currency:'DZD',language:'ar'});
 const [error,setError]=useState<string|null>(null);
 const login=async(_email:string,_password:string)=>setError(null);
 const register=async(data:RegisterData)=>{setError(null);setUser({id:'demo-user',email:data.email,name:data.name,role:'owner',businessId:'demo-biz'});};
 const logout=()=>setUser(null);
 return <AuthContext.Provider value={{user,business,login,register,logout,isAuthenticated:!!user,error}}>{children}</AuthContext.Provider>;
}
export function useAuth(){const context=useContext(AuthContext);if(!context)throw new Error('useAuth must be used within AuthProvider');return context;}
