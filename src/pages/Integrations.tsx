import React from 'react';
import { Plug, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useDemo } from '../contexts/DemoContext';
import { useLanguage } from '../contexts/LanguageContext';

export function Integrations() {
  const { t } = useLanguage();
  const { integrations } = useDemo();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('integrations')}</h1>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {integrations.map(integration => (
          <Card key={integration.id}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-lg ${integration.status === 'mock' ? 'bg-amber-50' : integration.status === 'connected' ? 'bg-green-50' : 'bg-gray-50'}`}>
                  <Plug className={`w-6 h-6 ${integration.status === 'mock' ? 'text-amber-600' : integration.status === 'connected' ? 'text-green-600' : 'text-gray-400'}`} />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{integration.provider}</h3>
                  <p className="text-sm text-gray-500">{integration.type}</p>
                  {integration.accountName && <p className="text-xs text-gray-400">{integration.accountName}</p>}
                </div>
              </div>
              <Badge variant={integration.status === 'mock' ? 'warning' : integration.status === 'connected' ? 'success' : 'default'}>
                {integration.status === 'mock' ? 'MOCK' : integration.status}
              </Badge>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                {integration.status === 'mock' ? <AlertCircle className="w-4 h-4 text-amber-500" /> : <CheckCircle className="w-4 h-4 text-green-500" />}
                <span>{integration.status === 'mock' ? 'Simulation mode active' : 'Connected'}</span>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm"><RefreshCw className="w-4 h-4" /></Button>
                <Button variant="secondary" size="sm">{integration.status === 'mock' ? 'Connect' : 'Configure'}</Button>
              </div>
            </div>
            {integration.lastSync && (
              <p className="text-xs text-gray-400 mt-2">Last sync: {new Date(integration.lastSync).toLocaleString()}</p>
            )}
          </Card>
        ))}

        <Card className="border-dashed border-2 border-gray-300">
          <div className="text-center py-8">
            <Plug className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="font-medium text-gray-500">Add New Integration</p>
            <p className="text-sm text-gray-400 mt-1">Shopify, TikTok, WhatsApp Business</p>
            <Button variant="secondary" className="mt-4">Coming Soon</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
