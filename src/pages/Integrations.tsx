import React, { useEffect, useState } from 'react';
import { Plug, RefreshCw, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useDemo } from '../contexts/DemoContext';
import { useLanguage } from '../contexts/LanguageContext';
import { apiFetch } from '../lib/api';

interface MetaStatus {
  connected: boolean;
  configured: boolean;
  adAccountId?: string;
  adAccountName?: string;
  connectedAt?: string;
}

// See audit finding P04 -- Meta is now a real OAuth connection instead of a
// mock row (the other providers below still have no real connection at all
// yet -- see audit finding P21 for why their buttons are disabled).
export function Integrations() {
  const { t } = useLanguage();
  const { integrations } = useDemo();
  const otherIntegrations = integrations.filter(i => i.type !== 'meta');

  const [meta, setMeta] = useState<MetaStatus | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [spend, setSpend] = useState<{ amount: number; currency: string } | null>(null);
  const [loadingSpend, setLoadingSpend] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadStatus = () => {
    setLoadingMeta(true);
    apiFetch<MetaStatus>('/api/integrations/meta')
      .then(data => {
        setMeta(data);
        if (data.connected) loadSpend();
      })
      .catch(() => {})
      .finally(() => setLoadingMeta(false));
  };

  const loadSpend = () => {
    setLoadingSpend(true);
    apiFetch<{ spend: number; currency: string }>('/api/integrations/meta/insights')
      .then(data => setSpend({ amount: data.spend, currency: data.currency }))
      .catch(() => setSpend(null))
      .finally(() => setLoadingSpend(false));
  };

  useEffect(() => {
    // The OAuth callback (see api/index.ts /api/integrations/meta/callback)
    // redirects back here with ?meta=connected or ?meta=error&meta_error=...
    const params = new URLSearchParams(window.location.search);
    const result = params.get('meta');
    if (result === 'connected') setNotice({ type: 'success', text: 'Meta ad account connected.' });
    else if (result === 'error') setNotice({ type: 'error', text: `Couldn't connect your Meta ad account (${params.get('meta_error') || 'unknown error'}). Please try again.` });
    if (result) window.history.replaceState({}, '', window.location.pathname);
    loadStatus();
  }, []);

  const connect = async () => {
    setConnecting(true);
    setNotice(null);
    try {
      const { url } = await apiFetch<{ url: string }>('/api/integrations/meta/connect');
      window.location.href = url;
    } catch (e) {
      setNotice({ type: 'error', text: e instanceof Error ? e.message : 'Failed to start Meta connection' });
      setConnecting(false);
    }
  };

  const disconnect = async () => {
    setDisconnecting(true);
    try {
      await apiFetch('/api/integrations/meta', { method: 'DELETE' });
      setMeta(prev => (prev ? { ...prev, connected: false, adAccountId: undefined, adAccountName: undefined } : prev));
      setSpend(null);
    } catch (e) {
      setNotice({ type: 'error', text: e instanceof Error ? e.message : 'Failed to disconnect' });
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('integrations')}</h1>
      </div>

      {notice && (
        <div className={`flex items-center gap-2 text-sm rounded-lg p-3 border ${notice.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-red-50 border-red-100 text-red-700'}`}>
          {notice.type === 'success' ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
          {notice.text}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-lg ${meta?.connected ? 'bg-green-50' : 'bg-gray-50'}`}>
                <Plug className={`w-6 h-6 ${meta?.connected ? 'text-green-600' : 'text-gray-400'}`} />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Meta Business (Facebook &amp; Instagram Ads)</h3>
                <p className="text-sm text-gray-500">meta</p>
                {meta?.adAccountName && <p className="text-xs text-gray-400">{meta.adAccountName}</p>}
              </div>
            </div>
            {loadingMeta ? (
              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            ) : (
              <Badge variant={meta?.connected ? 'success' : 'default'}>{meta?.connected ? 'Connected' : 'Not connected'}</Badge>
            )}
          </div>
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              {meta?.connected ? <CheckCircle className="w-4 h-4 text-green-500" /> : <AlertCircle className="w-4 h-4 text-gray-400" />}
              <span>
                {meta?.connected
                  ? (loadingSpend ? 'Loading spend...' : spend ? `${spend.amount.toLocaleString()} ${spend.currency} spent this month` : 'Real account connected')
                  : meta?.configured === false
                    ? 'Not set up on this server yet'
                    : 'Connect your real Meta ad account'}
              </span>
            </div>
            <div className="flex gap-2">
              {meta?.connected ? (
                <>
                  <Button variant="ghost" size="sm" onClick={loadSpend} title="Refresh spend"><RefreshCw className="w-4 h-4" /></Button>
                  <Button variant="secondary" size="sm" onClick={disconnect} disabled={disconnecting}>{disconnecting ? 'Disconnecting...' : 'Disconnect'}</Button>
                </>
              ) : (
                <Button
                  variant="secondary" size="sm"
                  onClick={connect}
                  disabled={connecting || loadingMeta || meta?.configured === false}
                  title={meta?.configured === false ? 'Ask whoever manages this deployment to set META_APP_ID/META_APP_SECRET/META_REDIRECT_URI' : undefined}
                >
                  {connecting ? 'Redirecting...' : 'Connect'}
                </Button>
              )}
            </div>
          </div>
          {meta?.connected && meta.connectedAt && (
            <p className="text-xs text-gray-400 mt-2">Connected: {new Date(meta.connectedAt).toLocaleString()}</p>
          )}
        </Card>

        {otherIntegrations.map(integration => (
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
                <Button variant="ghost" size="sm" disabled title="No real connection to refresh yet"><RefreshCw className="w-4 h-4" /></Button>
                <Button variant="secondary" size="sm" disabled title="Real account connection is coming soon">{integration.status === 'mock' ? 'Connect' : 'Configure'}</Button>
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
            <Button variant="secondary" className="mt-4" disabled>Coming Soon</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
