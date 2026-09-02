import React, { useEffect, useState } from 'react';
import { Plus, RefreshCw, Info, Trash2, AlertCircle } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useLanguage } from '../contexts/LanguageContext';
import { apiFetch } from '../lib/api';
import { Product } from '../types';
import { useNavigate } from 'react-router-dom';

interface ApiAdSet {
  id: string;
  name: string;
  status: string;
  spend?: number;
  impressions?: number;
  clicks?: number;
}

interface ApiCampaign {
  id: string;
  source: 'draft' | 'meta_synced';
  metaCampaignId?: string;
  name: string;
  productId?: string;
  objective?: string;
  destination?: string;
  budgetType?: string;
  budget?: number;
  audienceIds: string[];
  creativeIds: string[];
  status: string;
  currency?: string;
  spend?: number;
  impressions?: number;
  clicks?: number;
  lastSyncedAt?: string;
  createdAt: string;
  adSets?: ApiAdSet[];
}

// See audit findings P03/P08 -- Campaigns used to be entirely sample data
// with dead action buttons (P21), and the Campaign Builder's "Launch" step
// was an explicit MOCK MODE with nothing saved anywhere. Both are now real:
// a campaign here is either a plan you saved in the Builder (source
// "draft", never sent to Meta) or a real campaign pulled in from your
// connected Meta ad account via "Sync from Meta" (source "meta_synced",
// read-only). There's still no way to publish a draft to Meta or to
// pause/resume a synced one from here -- that needs a real write-scope
// decision first (see the schema comment on the Campaign model) and isn't
// part of this.
export function Campaigns() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<ApiCampaign[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [metaConnected, setMetaConnected] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = () => {
    setLoading(true);
    apiFetch<{ campaigns: ApiCampaign[] }>('/api/campaigns')
      .then(data => setCampaigns(data.campaigns))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    apiFetch<{ products: Product[] }>('/api/products').then(data => setProducts(data.products)).catch(() => {});
    apiFetch<{ connected: boolean }>('/api/integrations/meta').then(s => setMetaConnected(s.connected)).catch(() => {});
  }, []);

  const sync = async () => {
    setSyncing(true);
    setNotice(null);
    try {
      const result = await apiFetch<{ synced: { campaigns: number; adSets: number; ads: number } }>('/api/campaigns/sync', { method: 'POST' });
      setNotice({ type: 'success', text: `Synced ${result.synced.campaigns} campaign(s) from Meta.` });
      load();
    } catch (e) {
      setNotice({ type: 'error', text: e instanceof Error ? e.message : 'Sync failed' });
    } finally {
      setSyncing(false);
    }
  };

  const removeDraft = async (id: string) => {
    try {
      await apiFetch(`/api/campaigns/${id}`, { method: 'DELETE' });
      setCampaigns(prev => prev.filter(c => c.id !== id));
    } catch (e) {
      setNotice({ type: 'error', text: e instanceof Error ? e.message : 'Failed to delete' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('campaigns')}</h1>
        <div className="flex gap-2">
          {metaConnected && (
            <Button variant="secondary" onClick={sync} disabled={syncing}>
              <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync from Meta'}
            </Button>
          )}
          <Button onClick={() => navigate('/campaign-builder')}><Plus className="w-4 h-4 mr-2" />{t('campaignBuilder')}</Button>
        </div>
      </div>

      {notice && (
        <div className={`flex items-center gap-2 text-sm rounded-lg p-3 border ${notice.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-red-50 border-red-100 text-red-700'}`}>
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {notice.text}
        </div>
      )}

      {!metaConnected && (
        <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 text-blue-800 text-sm rounded-lg p-3">
          <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>Connect a Meta ad account in Integrations to sync your real running campaigns here. You can still build and save campaign plans below.</span>
        </div>
      )}

      {!loading && campaigns.length === 0 && (
        <Card>
          <div className="text-center py-8">
            <p className="text-gray-500">No campaigns yet.</p>
            <p className="text-sm text-gray-400 mt-1">Build a plan with {t('campaignBuilder')}, or sync real campaigns once a Meta ad account is connected.</p>
          </div>
        </Card>
      )}

      <div className="space-y-4">
        {campaigns.map(campaign => {
          const product = products.find(p => p.id === campaign.productId);
          const isDraft = campaign.source === 'draft';
          return (
            <Card key={campaign.id} className="hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <h3 className="font-semibold text-lg text-gray-900">{campaign.name}</h3>
                    <Badge variant={isDraft ? 'default' : campaign.status === 'active' ? 'success' : campaign.status === 'paused' ? 'warning' : 'default'}>
                      {isDraft ? 'Draft (not published)' : campaign.status}
                    </Badge>
                    {campaign.budget != null && (
                      <Badge variant="info">{campaign.budgetType === 'daily' ? `${campaign.budget.toLocaleString()} ${campaign.currency || 'DZD'}/j` : `${campaign.budget.toLocaleString()} ${campaign.currency || 'DZD'} total`}</Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mb-3">
                    {product ? `${t('product')}: ${product.name}` : null}
                    {campaign.objective ? ` | Objective: ${campaign.objective}` : ''}
                    {campaign.destination ? ` | Destination: ${campaign.destination}` : ''}
                  </p>
                  <div className="flex items-center gap-4 text-sm text-gray-600 flex-wrap">
                    {isDraft ? (
                      <>
                        <span>{campaign.audienceIds.length} audiences</span>
                        <span>{campaign.creativeIds.length} creatives</span>
                      </>
                    ) : (
                      <>
                        <span>{(campaign.spend ?? 0).toLocaleString()} {campaign.currency} spent this month</span>
                        <span>{(campaign.impressions ?? 0).toLocaleString()} impressions</span>
                        <span>{(campaign.clicks ?? 0).toLocaleString()} clicks</span>
                        <span>{campaign.adSets?.length ?? 0} ad sets</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  {isDraft ? (
                    <Button variant="ghost" size="sm" onClick={() => removeDraft(campaign.id)} title="Delete this draft">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  ) : (
                    <Badge variant="default">Read-only</Badge>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
