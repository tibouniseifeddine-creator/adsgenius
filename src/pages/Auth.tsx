import React, { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, UserPlus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export function Auth() {
  const navigate = useNavigate();
  const { login, register, error } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setLocalError('');
    try {
      if (mode === 'login') await login(email, password);
      else await register({ email, password, name, businessName });
      navigate('/', { replace: true });
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : 'Authentication failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4" dir="rtl">
      <section className="w-full max-w-md bg-white rounded-2xl border border-gray-200 shadow-sm p-6 md:p-8">
        <div className="text-center mb-7">
          <div className="mx-auto mb-4 w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center">
            {mode === 'login' ? <LogIn className="w-6 h-6" /> : <UserPlus className="w-6 h-6" />}
          </div>
          <h1 className="text-2xl font-bold text-gray-900">AdsGenius</h1>
          <p className="mt-2 text-sm text-gray-500">{mode === 'login' ? 'تسجيل الدخول إلى حسابك' : 'إنشاء حساب حقيقي جديد'}</p>
        </div>

        {(localError || error) && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm p-3">{localError || error}</div>}

        <form onSubmit={submit} className="space-y-4">
          {mode === 'register' && <>
            <label className="block text-sm font-medium text-gray-700">الاسم<input required value={name} onChange={e => setName(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 p-3 outline-none focus:border-blue-500" /></label>
            <label className="block text-sm font-medium text-gray-700">اسم النشاط التجاري<input required value={businessName} onChange={e => setBusinessName(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 p-3 outline-none focus:border-blue-500" /></label>
          </>}
          <label className="block text-sm font-medium text-gray-700">البريد الإلكتروني<input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 p-3 outline-none focus:border-blue-500" /></label>
          <label className="block text-sm font-medium text-gray-700">كلمة المرور<input required minLength={8} type="password" value={password} onChange={e => setPassword(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 p-3 outline-none focus:border-blue-500" /></label>
          <button disabled={busy} className="w-full rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3">{busy ? 'جارٍ التنفيذ...' : mode === 'login' ? 'تسجيل الدخول' : 'إنشاء الحساب'}</button>
        </form>

        <button onClick={() => setMode(mode === 'login' ? 'register' : 'login')} className="w-full mt-4 text-sm text-blue-600 hover:underline">
          {mode === 'login' ? 'ليس لديك حساب؟ إنشاء حساب' : 'لديك حساب؟ تسجيل الدخول'}
        </button>
      </section>
    </main>
  );
}
