import React, { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LogIn, UserPlus, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

// See audit finding P30 -- "recovery" mode used to offer email / phone / QR
// tabs and, on submit, always claimed success ("instructions were sent to
// your email/phone") without ever contacting any backend. There is no
// password-reset endpoint in the API today, so that was an outright false
// promise to a user who had actually lost access. This replaces it with a
// single honest notice instead of pretending a recovery flow exists.
export function Auth() {
  const navigate = useNavigate();
  const { login, register, error } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [showRecoveryNotice, setShowRecoveryNotice] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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

  const title = mode === 'login' ? 'تسجيل الدخول إلى حسابك' : 'إنشاء حساب حقيقي جديد';

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4" dir="rtl">
      <section className="w-full max-w-md bg-white rounded-2xl border border-gray-200 shadow-sm p-6 md:p-8">
        <div className="text-center mb-7">
          <div className="mx-auto mb-4 w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center">
            {mode === 'login' ? <LogIn className="w-6 h-6" /> : <UserPlus className="w-6 h-6" />}
          </div>
          <h1 className="text-2xl font-bold text-gray-900">AdsGenius</h1>
          <p className="mt-2 text-sm text-gray-500">{showRecoveryNotice ? 'استرجاع الحساب' : title}</p>
        </div>

        {(localError || error) && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm p-3">{localError || error}</div>}

        {showRecoveryNotice ? (
          <div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-center">
              <AlertCircle className="mx-auto mb-3 w-8 h-8 text-amber-500" />
              <p className="font-medium text-amber-900">استعادة كلمة المرور غير متوفرة حالياً داخل التطبيق</p>
              <p className="mt-2 text-sm text-amber-800">تواصل معنا مباشرة وسنساعدك على استعادة الدخول لحسابك.</p>
            </div>
            <button type="button" onClick={() => setShowRecoveryNotice(false)} className="w-full mt-4 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium py-3">
              رجوع لتسجيل الدخول
            </button>
          </div>
        ) : (
          <>
            <form onSubmit={submit} className="space-y-4">
              {mode === 'register' && <>
                <label className="block text-sm font-medium text-gray-700">الاسم<input required value={name} onChange={e => setName(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 p-3 outline-none focus:border-blue-500" /></label>
                <label className="block text-sm font-medium text-gray-700">اسم النشاط التجاري<input required value={businessName} onChange={e => setBusinessName(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 p-3 outline-none focus:border-blue-500" /></label>
              </>}

              <label className="block text-sm font-medium text-gray-700">البريد الإلكتروني<input required type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 p-3 outline-none focus:border-blue-500" /></label>

              <label className="block text-sm font-medium text-gray-700">كلمة المرور<div className="relative mt-1"><input required minLength={8} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} className="w-full rounded-lg border border-gray-300 p-3 pl-11 outline-none focus:border-blue-500" /><button type="button" aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'} onClick={() => setShowPassword(value => !value)} className="absolute left-2 top-1/2 -translate-y-1/2 p-2 text-gray-500 hover:text-gray-800">{showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}</button></div></label>

              <button disabled={busy} className="w-full rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3">{busy ? 'جارٍ التنفيذ...' : mode === 'login' ? 'تسجيل الدخول' : 'إنشاء الحساب'}</button>
            </form>

            {mode === 'login' && <button type="button" onClick={() => { setShowRecoveryNotice(true); setLocalError(''); }} className="w-full mt-3 text-sm text-gray-600 hover:text-blue-600 hover:underline">نسيت كلمة المرور؟</button>}
            <button type="button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setLocalError(''); }} className="w-full mt-4 text-sm text-blue-600 hover:underline">
              {mode === 'login' ? 'ليس لديك حساب؟ إنشاء حساب' : 'لديك حساب؟ تسجيل الدخول'}
            </button>
          </>
        )}
      </section>
    </main>
  );
}
