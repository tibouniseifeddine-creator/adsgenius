import React, { useEffect, useState } from 'react';
import { Plus, Eye, BarChart3, Trash2 } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { ApiClient, ApiClientError } from '@adsgenius/api-client';
import type { Campaign } from '@adsgenius/shared-types';
import { useNavigate } from 'react-router-dom';

const api = new ApiClient({ baseUrl: import.meta.env.VITE_API_BASE_URL ?? '' });

export function Campaigns() {
  const { t } = useLanguage(); const { workspaceId } = useAuth(); const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null);
  const load = async () => { if (!workspaceId) { setLoading(false); return; } setLoading(true); setError(null); try { setCampaigns(await api.listCampaigns(workspaceId)); } catch (cause) { setError(cause instanceof ApiClientError ? cause.message : 'Unable to load campaigns.'); } finally { setLoading(false); } };
  useEffect(() => { void load(); }, [workspaceId]);
  const remove = async (id: string) => { if (!workspaceId) return; try { await api.deleteCampaign(workspaceId, id); await load(); } catch (cause) { setError(cause instanceof ApiClientError ? cause.message : 'Unable to delete campaign.'); } };
  return <div className="space-y-6">
    <div className="flex items-center justify-between"><div><h1 className="text-2xl font-bold text-gray-900">{t('campaigns')}</h1><p className="text-sm text-gray-500 mt-1">Persisted provider-neutral campaigns.</p></div><Button onClick={() => navigate('/campaign-builder')}><Plus className="w-4 h-4 mr-2" />{t('campaignBuilder')}</Button></div>
    {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    {loading ? <Card><p className="text-sm text-gray-500">Loading campaigns…</p></Card> : campaigns.length === 0 ? <Card><p className="text-sm text-gray-500">No campaigns yet. Create the first draft.</p></Card> : <div className="space-y-4">{campaigns.map(campaign => <Card key={campaign.id} className="hover:shadow-md transition-shadow"><div className="flex items-start justify-between"><div className="flex-1"><div className="flex items-center gap-3 mb-2"><h3 className="font-semibold text-lg text-gray-900">{campaign.name}</h3><Badge variant={campaign.status === 'ACTIVE' ? 'success' : campaign.status === 'PAUSED' ? 'warning' : 'default'}>{campaign.status}</Badge><Badge variant="info">{campaign.budgetType === 'DAILY' ? `${campaign.budgetAmount} ${campaign.currency}/day` : `${campaign.budgetAmount} ${campaign.currency}`}</Badge></div><p className="text-sm text-gray-500 mb-3">Objective: {campaign.objective} {campaign.product?.name ? `| Product: ${campaign.product.name}` : ''}</p><div className="flex items-center gap-4 text-sm text-gray-600"><span>{campaign.adSets.length} ad sets</span><span>{campaign.adSets.reduce((count, set) => count + set.ads.length, 0)} ads</span></div></div><div className="flex gap-2"><Button variant="ghost" size="sm" onClick={() => navigate(`/campaign-builder?campaign=${campaign.id}`)}><Eye className="w-4 h-4" /></Button><Button variant="ghost" size="sm"><BarChart3 className="w-4 h-4" /></Button><Button variant="ghost" size="sm" onClick={() => void remove(campaign.id)}><Trash2 className="w-4 h-4" /></Button></div></div></Card>)}</div>}
  </div>;
}
