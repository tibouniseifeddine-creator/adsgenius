import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Sparkles } from 'lucide-react';

export function Login() {
  const { login, register, error } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', name: '', businessName: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    try { if (isRegister) await register(form); else await login(form.email, form.password); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8">
        <div className="text-center mb-6"><Sparkles className="w-10 h-10 text-blue-600 mx-auto mb-2" /><h1 className="text-2xl font-bold text-gray-900">AdsGenius</h1><p className="text-sm text-gray-500">AI Media Buyer</p></div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg">{error}</div>}
          {isRegister && <><Input placeholder="الاسم الكامل" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /><Input placeholder="اسم المتجر / الشركة" value={form.businessName} onChange={e => setForm({ ...form, businessName: e.target.value })} required /></>}
          <Input type="email" placeholder="البريد الإلكتروني" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
          <Input type="password" placeholder="كلمة المرور" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required minLength={8} />
          <Button type="submit" className="w-full" disabled={loading}>{loading ? 'جاري التحميل...' : isRegister ? 'إنشاء حساب' : 'تسجيل الدخول'}</Button>
        </form>
        <p className="text-center text-sm text-gray-600 mt-4">{isRegister ? 'لديك حساب؟' : 'ليس لديك حساب؟'}{' '}<button type="button" onClick={() => setIsRegister(!isRegister)} className="text-blue-600 hover:underline">{isRegister ? 'تسجيل الدخول' : 'إنشاء حساب'}</button></p>
      </div>
    </div>
  );
}
