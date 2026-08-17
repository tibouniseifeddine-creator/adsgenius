import React, { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, KeyRound, LogIn, Mail, Phone, QrCode, UserPlus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export function Auth() {
  const navigate = useNavigate();
  const { login, register, error } = useAuth();
  const [mode, setMode] = useState<'login' | 'register' | 'recovery'>('login');
  const [recoveryMethod, setRecoveryMethod] = useState<'email' | 'phone' | 'qr'>('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [localError, setLocalError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setLocalError('');
    setMessage('');
    try {
      if (mode === 'recovery') {
        if (recoveryMethod === 'qr') {
          setMessage('سيتم فتح استعادة الحساب عبر QR من جهاز موثوق عند توفر خدمة الاستعادة الآمنة.');
          return;
        }
        setMessage(recoveryMethod === 'email'
          ? 'إذا كان البريد مسجلاً، ستصلك تعليمات الاستعادة عليه.'
          : 'إذا كان رقم الهاتف موثقاً، ستصلك تعليمات الاستعادة عبر رمز OTP.');
        return;
      }
      if (mode === 'login') await login(email, password);
      else await register({ email, password, name, businessName });
      navigate('/', { replace: true });
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : 'Authentication failed');
    } finally {
      setBusy(false);
    }
  }

  const title = mode === 'recovery' ? 'استرجاع الحساب' : mode === 'login' ? 'تسجيل الدخول إلى حسابك' : 'إنشاء حساب حقيقي جديد';

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4" dir="rtl">
      <section className="w-full max-w-md bg-white rounded-2xl border border-gray-200 shadow-sm p-6 md:p-8">
        <div className="text-center mb-7">
          <div className="mx-auto mb-4 w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center">
            {mode === 'login' ? <LogIn className="w-6 h-6" /> : mode === 'register' ? <UserPlus className="w-6 h-6" /> : <KeyRound className="w-6 h-6" />}
          </div>
          <h1 className="text-2xl font-bold text-gray-900">AdsGenius</h1>
          <p className="mt-2 text-sm text-gray-500">{title}</p>
        </div>

        {(localError || error) && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm p-3">{localError || error}</div>}
        {message && <div className="mb-4 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-sm p-3">{message}</div>}

        {mode === 'recovery' && (
          <div className="grid grid-cols-3 gap-2 mb-5">
            <button type="button" onClick={() => setRecoveryMethod('email')} className={`rounded-lg border p-3 text-xs font-medium ${recoveryMethod === 'email' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'}`}><Mail className="mx-auto mb-1 w-5 h-5" />البريد</button>
            <button type="button" onClick={() => setRecoveryMethod('phone')} className={`rounded-lg border p-3 text-xs font-medium ${recoveryMethod === 'phone' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'}`}><Phone className="mx-auto mb-1 w-5 h-5" />الهاتف</button>
            <button type="button" onClick={() => setRecoveryMethod('qr')} className={`rounded-lg border p-3 text-xs font-medium ${recoveryMethod === 'qr' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'}`}><QrCode className="mx-auto mb-1 w-5 h-5" />QR آمن</button>
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          {mode === 'register' && <>
            <label className="block text-sm font-medium text-gray-700">الاسم<input required value={name} onChange={e => setName(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 p-3 outline-none focus:border-blue-500" /></label>
            <label className="block text-sm font-medium text-gray-700">اسم النشاط التجاري<input required value={businessName} onChange={e => setBusinessName(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 p-3 outline-none focus:border-blue-500" /></label>
          </>}

          {mode === 'recovery' && recoveryMethod === 'phone' ? (
            <label className="block text-sm font-medium text-gray-700">رقم الهاتف<input required value={phone} onChange={e => setPhone(e.target.value)} type="tel" autoComplete="tel" placeholder="05xxxxxxxx" className="mt-1 w-full rounded-lg border border-gray-300 p-3 outline-none focus:border-blue-500" /></label>
          ) : mode === 'recovery' && recoveryMethod === 'qr' ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-5 text-center text-sm text-gray-600"><QrCode className="mx-auto mb-3 w-10 h-10 text-gray-400" /><p className="font-medium text-gray-800">استعادة عبر جهاز موثوق</p><p className="mt-1">QR لا يحتوي كلمة المرور أو سر الاستعادة، ويُستخدم فقط لبدء جلسة استعادة مؤقتة وآمنة.</p></div>
          ) : (
            <label className="block text-sm font-medium text-gray-700">البريد الإلكتروني<input required type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 p-3 outline-none focus:border-blue-500" /></label>
          )}

          {mode !== 'recovery' && <label className="block text-sm font-medium text-gray-700">كلمة المرور<div className="relative mt-1"><input required minLength={8} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} className="w-full rounded-lg border border-gray-300 p-3 pl-11 outline-none focus:border-blue-500" /><button type="button" aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'} onClick={() => setShowPassword(value => !value)} className="absolute left-2 top-1/2 -translate-y-1/2 p-2 text-gray-500 hover:text-gray-800">{showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}</button></div></label>}

          <button disabled={busy} className="w-full rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3">{busy ? 'جارٍ التنفيذ...' : mode === 'login' ? 'تسجيل الدخول' : mode === 'register' ? 'إنشاء الحساب' : 'متابعة الاستعادة'}</button>
        </form>

        {mode === 'login' && <button type="button" onClick={() => { setMode('recovery'); setMessage(''); setLocalError(''); }} className="w-full mt-3 text-sm text-gray-600 hover:text-blue-600 hover:underline">نسيت كلمة المرور؟</button>}
        <button type="button" onClick={() => { setMode(mode === 'login' || mode === 'recovery' ? 'register' : 'login'); setMessage(''); setLocalError(''); }} className="w-full mt-4 text-sm text-blue-600 hover:underline">
          {mode === 'login' || mode === 'recovery' ? 'ليس لديك حساب؟ إنشاء حساب' : 'لديك حساب؟ تسجيل الدخول'}
        </button>
      </section>
    </main>
  );
}
