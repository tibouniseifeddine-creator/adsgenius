import React from 'react';
import { Save, Globe, Building2, Bell, Shield } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

export function Settings() {
  const { t, language, setLanguage } = useLanguage();
  const { business, user } = useAuth();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('settings')}</h1>
        <Button><Save className="w-4 h-4 mr-2" />{t('save')}</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Business Profile" icon={<Building2 className="w-5 h-5" />}>
          <div className="space-y-4">
            <Input label={t('businessName')} defaultValue={business?.name} />
            <Input label={t('businessType')} defaultValue={business?.type} />
            <Input label={t('country')} defaultValue={business?.country} />
            <Input label={t('currency')} defaultValue={business?.currency} />
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
            <Input label="Currency" defaultValue="DZD" disabled />
            <Input label="Timezone" defaultValue="Africa/Algiers" />
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
            <Input label="Email" type="email" defaultValue={user?.email} />
            <Input label="Current Password" type="password" />
            <Input label="New Password" type="password" />
            <Button variant="secondary" size="sm">Change Password</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
