import React, { useEffect, useState } from 'react';
import { Save, Globe, Building2, Bell, Shield, Check, AlertCircle } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { apiFetch } from '../lib/api';
import { TwoFactorCard } from '../components/settings/TwoFactorCard';

export function Settings() {
  const { t, language, setLanguage } = useLanguage();
  const { business, user, updateBusiness } = useAuth();

  // Business Profile form -- see audit finding P22. These used to be
  // uncontrolled inputs seeded from a `business` object that was never
  // actually populated, so every real user saw blank fields and the Save
  // button did nothing. Now backed by GET/PATCH /api/workspace.
  const [name, setName] = useState('');
  const [country, setCountry] = useState('');
  const [currency, setCurrency] = useState('');
  const [timezone, setTimezone] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!business) return;
    setName(business.name ?? '');
    setCountry(business.country ?? '');
    setCurrency(business.currency ?? '');
    setTimezone(business.timezone ?? '');
  }, [business]);

  const saveProfile = async () => {
    setSavingProfile(true);
    setProfileMessage(null);
    try {
      const { workspace } = await apiFetch<{ workspace: typeof business }>('/api/workspace', {
        method: 'PATCH',
        body: { name, country, currency, timezone },
      });
      if (workspace) updateBusiness(workspace);
      setProfileMessage({ type: 'success', text: t('save') });
    } catch (e) {
      setProfileMessage({ type: 'error', text: e instanceof Error ? e.message : 'Failed to save' });
    } finally {
      setSavingProfile(false);
    }
  };

  // Password change -- see audit finding P22. The button previously had no
  // handler at all. Now backed by PATCH /api/auth/password.
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const changePassword = async () => {
    setPasswordMessage(null);
    if (!currentPassword || !newPassword) {
      setPasswordMessage({ type: 'error', text: 'Enter your current and new password' });
      return;
    }
    if (newPassword.length < 8) {
      setPasswordMessage({ type: 'error', text: 'New password must be at least 8 characters' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'New password and confirmation do not match' });
      return;
    }
    setSavingPassword(true);
    try {
      await apiFetch('/api/auth/password', { method: 'PATCH', body: { currentPassword, newPassword } });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordMessage({ type: 'success', text: 'Password updated' });
    } catch (e) {
      setPasswordMessage({ type: 'error', text: e instanceof Error ? e.message : 'Failed to update password' });
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('settings')}</h1>
        <Button onClick={saveProfile} loading={savingProfile}><Save className="w-4 h-4 mr-2" />{t('save')}</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Business Profile" icon={<Building2 className="w-5 h-5" />}>
          <div className="space-y-4">
            <Input label={t('businessName')} value={name} onChange={e => setName(e.target.value)} />
            <Input label={t('country')} value={country} onChange={e => setCountry(e.target.value)} />
            <Input label={t('currency')} value={currency} onChange={e => setCurrency(e.target.value.toUpperCase())} maxLength={3} />
            <Input label="Timezone" value={timezone} onChange={e => setTimezone(e.target.value)} placeholder="Africa/Algiers" />
            {profileMessage && (
              <p className={`flex items-center gap-1.5 text-sm ${profileMessage.type === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
                {profileMessage.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                {profileMessage.text}
              </p>
            )}
          </div>
        </Card>

        <Card title="Language & Region" icon={<Globe className="w-5 h-5" />}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('language')}</label>
              <div className="flex gap-2">
                {(['ar', 'fr', 'en'] as const).map(lang => (
                  <button key={lang} onClick={() => setLanguage(lang)}
                    className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${language === lang ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                    {lang === 'ar' ? 'العربية' : lang === 'fr' ? 'Français' : 'English'}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-sm text-gray-500">Currency and timezone are set in the Business Profile card.</p>
          </div>
        </Card>

        <Card title="Notifications" icon={<Bell className="w-5 h-5" />}>
          <div className="space-y-3">
            {['New orders', 'Campaign alerts', 'AI recommendations', 'Delivery updates'].map((item, i) => (
              <label key={i} className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" defaultChecked className="w-4 h-4 rounded border-gray-300 text-blue-600" />
                <span className="text-sm text-gray-700">{item}</span>
              </label>
            ))}
          </div>
        </Card>

        <Card title="Security" icon={<Shield className="w-5 h-5" />}>
          <div className="space-y-4">
            <Input label="Email" type="email" defaultValue={user?.email} disabled />
            <Input label="Current Password" type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} />
            <Input label="New Password" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
            <Input label="Confirm New Password" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
            {passwordMessage && (
              <p className={`flex items-center gap-1.5 text-sm ${passwordMessage.type === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
                {passwordMessage.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                {passwordMessage.text}
              </p>
            )}
            <Button variant="secondary" size="sm" onClick={changePassword} loading={savingPassword}>Change Password</Button>
          </div>
        </Card>

        <TwoFactorCard />
      </div>
    </div>
  );
}
