import React, { useEffect, useState } from 'react';
import { Check, Rocket } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { ApiClient, ApiClientError } from '@adsgenius/api-client';
import type { Audience, Product } from '@adsgenius/shared-types';
import { useNavigate } from 'react-router-dom';

const api = new ApiClient({ baseUrl: import.meta.env.VITE_API_BASE_URL ?? '' });

export function CampaignBuilder() {
  const { t } = useLanguage(); const { workspaceId } = useAuth(); const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]); const [audiences, setAudiences] = useState<Audience[]>([]); const [creatives, setCreatives] = useState<Array<{ id: string; name: string; angle: string | null; versions: Array<{ id: string; version: number }>; copies: Array<{ id: string; primaryText: string | null; headline: string | null; cta: string | null }> }>>([]);
  const [form, setForm] = useState({ name: '', productId: '', objective: 'SALES' as const, budgetType: 'DAILY' as const, budgetAmount: 1000, currency: 'DZD', audienceId: '', creativeId: '', destinationUrl: '' });
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [done, setDone] = useState(false); const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (!workspaceId) { setLoading(false); return; } void Promise.all([api.listProducts(workspaceId), api.listAudiences(workspaceId), api.listCreatives(workspaceId)]).then(([p, a, c]) => { setProducts(p); setAudiences(a); setCreatives(c); if (p[0]) setForm(prev => ({ ...prev, productId: p[0].id })); if (a[0]) setForm(prev => ({ ...prev, audienceId: a[0].id })); if (c[0]) setForm(prev => ({ ...prev, creativeId: c[0].id })); }).catch(cause => setError(cause instanceof ApiClientError ? cause.message : 'Unable to load campaign inputs.')).finally(() => setLoading(false)); }, [workspaceId]);
  const selectedCreative = creatives.find(item => item.id === form.creativeId);
  const save = async () => {
    if (!workspaceId || !form.name.trim()) { setError('Campaign name is required.'); return; }
    if (!form.productId || !form.audienceId || !form.creativeId) { setError('Product, audience and creative are required.'); return; }
    setSaving(true); setError(null);
    try {
      const campaign = await api.createCampaign(workspaceId, { name: form.name.trim(), productId: form.productId, objective: form.objective, budgetType: form.budgetType, budgetAmount: form.budgetAmount, currency: form.currency });
      const adSet = await api.createAdSet(workspaceId, campaign.id, { name: `${form.name.trim()} Ad Set`, audienceId: form.audienceId });
      const versionId = selectedCreative?.versions[0]?.id; const copyId = selectedCreative?.copies[0]?.id;
      if (!versionId && !copyId) throw new Error('Selected creative has no attachable version or copy.');
      await api.createAd(workspaceId, campaign.id, adSet.id, { name: `${form.name.trim()} Ad`, creativeVersionId: versionId, copyAssetId: copyId, destinationUrl: form.destinationUrl || undefined });
      await api.updateCampaign(workspaceId, campaign.id, { status: 'READY' });
      setDone(true);
    } catch (cause) { setError(cause instanceof ApiClientError ? cause.message : cause instanceof Error ? cause.message : 'Unable to save campaign.'); }
    finally { setSaving(false); }
  };
  if (loading) return <Card><p className="text-sm text-gray-500">Loading campaign inputs…</p></Card>;
  return <div className="max-w-3xl mx-auto space-y-6">
    <div><h1 className="text-2xl font-bold text-gray-900">{t('campaignBuilder')}</h1><p className="text-sm text-gray-500 mt-1">Create a persisted draft hierarchy: Campaign → Ad Set → Ad.</p></div>
    <div className="flex items-center gap-2 text-sm"><div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center">1</div><span>Campaign setup</span><div className="flex-1 h-px bg-gray-200" /><div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center">2</div><span>Audience + creative</span><div className="flex-1 h-px bg-gray-200" /><div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center">3</div><span>QA</span></div>
    {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    {done ? <Card><div className="text-center py-10"><div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"><Check className="w-7 h-7 text-green-600" /></div><h2 className="text-xl font-semibold">Campaign saved as READY</h2><p className="text-sm text-gray-500 mt-2">The campaign hierarchy is persisted. No external ad platform was changed.</p><Button className="mt-6" onClick={() => navigate('/campaigns')}>View campaigns</Button></div></Card> : <Card title="Campaign configuration"><div className="space-y-5"><Input label="Campaign name" value={form.name} onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))} placeholder="Summer offer - broad test" /><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><label className="block"><span className="text-sm font-medium text-gray-700">Product</span><select className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" value={form.productId} onChange={e => setForm(prev => ({ ...prev, productId: e.target.value }))}>{products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label className="block"><span className="text-sm font-medium text-gray-700">Objective</span><select className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" value={form.objective} onChange={e => setForm(prev => ({ ...prev, objective: e.target.value as typeof form.objective }))}>{['SALES','LEADS','MESSAGES','TRAFFIC','WEBSITE_CONVERSIONS'].map(item => <option key={item}>{item}</option>)}</select></label></div><div className="grid grid-cols-1 md:grid-cols-3 gap-4"><label className="block"><span className="text-sm font-medium text-gray-700">Budget type</span><select className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" value={form.budgetType} onChange={e => setForm(prev => ({ ...prev, budgetType: e.target.value as typeof form.budgetType }))}><option value="DAILY">Daily</option><option value="LIFETIME">Lifetime</option></select></label><Input type="number" label="Budget" value={form.budgetAmount} onChange={e => setForm(prev => ({ ...prev, budgetAmount: Number(e.target.value) }))} /><Input label="Currency" value={form.currency} onChange={e => setForm(prev => ({ ...prev, currency: e.target.value.toUpperCase() }))} /></div><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><label className="block"><span className="text-sm font-medium text-gray-700">Audience</span><select className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" value={form.audienceId} onChange={e => setForm(prev => ({ ...prev, audienceId: e.target.value }))}>{audiences.map(a => <option key={a.id} value={a.id}>{a.name} · {a.type}</option>)}</select></label><label className="block"><span className="text-sm font-medium text-gray-700">Creative</span><select className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" value={form.creativeId} onChange={e => setForm(prev => ({ ...prev, creativeId: e.target.value }))}>{creatives.map(c => <option key={c.id} value={c.id}>{c.name}{c.angle ? ` · ${c.angle}` : ''}</option>)}</select></label></div><Input label="Destination URL (optional)" value={form.destinationUrl} onChange={e => setForm(prev => ({ ...prev, destinationUrl: e.target.value }))} placeholder="https://example.com/product" /><div className="rounded-lg bg-blue-50 border border-blue-100 p-4 text-sm text-blue-800"><strong>QA gate:</strong> the campaign is created as DRAFT, then promoted to READY only after an ad set and an ad with valid workspace-owned creative/copy attachments exist.</div><div className="flex justify-end"><Button onClick={() => void save()} disabled={saving || !products.length || !audiences.length || !creatives.length}><Rocket className="w-4 h-4 mr-2" />{saving ? 'Saving…' : 'Save campaign'}</Button></div></div></Card>}
  </div>;
}
