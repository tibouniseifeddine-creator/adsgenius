import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Download, RefreshCw, Search } from 'lucide-react';
import { ApiClient, ApiClientError } from '@adsgenius/api-client';
import type { Campaign, CampaignAnalytics, PerformanceDiagnosis } from '@adsgenius/shared-types';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

const api = new ApiClient({ baseUrl: import.meta.env.VITE_API_BASE_URL ?? '' });

export function Analytics() {
  const { t } = useLanguage();
  const { workspaceId } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignId, setCampaignId] = useState('');
  const [analytics, setAnalytics] = useState<CampaignAnalytics | null>(null);
  const [diagnosis, setDiagnosis] = useState<PerformanceDiagnosis | null>(null);
  const [period, setPeriod] = useState('30d');
  const [loading, setLoading] = useState(true);
  const [diagnosing, setDiagnosing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (selectedCampaignId?: string) => {
    if (!workspaceId) return;
    setLoading(true); setError(null);
    try {
      const available = await api.listCampaigns(workspaceId);
      setCampaigns(available);
      const selected = selectedCampaignId ?? campaignId ?? available[0]?.id ?? '';
      setCampaignId(selected);
      if (!selected) { setAnalytics(null); setDiagnosis(null); return; }
      const days = period === '7d' ? 7 : period === 'today' ? 1 : 30;
      const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      const result = await api.getCampaignAnalytics(workspaceId, selected, start);
      setAnalytics(result);
      const diagnostics = await api.listDiagnostics(workspaceId, selected);
      setDiagnosis(diagnostics[0] ?? null);
    } catch (cause) {
      setError(cause instanceof ApiClientError ? cause.message : 'Unable to load analytics.');
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [workspaceId, period]);

  const chartData = useMemo(() => analytics?.snapshots.map((snapshot) => ({ date: snapshot.periodEnd.slice(5, 10), spend: Number(snapshot.spend ?? 0), revenue: Number(snapshot.revenue ?? 0), roas: snapshot.kpis.roas ?? 0, ctr: snapshot.kpis.ctr ?? 0 })) ?? [], [analytics]);

  const runDiagnosis = async () => {
    if (!workspaceId || !campaignId) return;
    setDiagnosing(true); setError(null);
    try { setDiagnosis(await api.diagnoseCampaign(workspaceId, campaignId)); }
    catch (cause) { setError(cause instanceof ApiClientError ? cause.message : 'Unable to diagnose the campaign.'); }
    finally { setDiagnosing(false); }
  };

  const totals = analytics?.totals ?? { spend: 0, revenue: 0, impressions: 0, clicks: 0, conversions: 0 };
  const kpis = analytics?.kpis;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">{t('analytics')}</h1><p className="text-sm text-gray-500">Normalized performance and Campaign Detective diagnosis.</p></div>
        <div className="flex flex-wrap gap-2">
          <select value={campaignId} onChange={(event) => void load(event.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm min-w-52" disabled={!campaigns.length}>
            {!campaigns.length && <option value="">No campaigns</option>}
            {campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
          </select>
          <select value={period} onChange={(event) => setPeriod(event.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="7d">{t('last7Days')}</option><option value="30d">{t('last30Days')}</option><option value="today">{t('today')}</option>
          </select>
          <Button variant="secondary" onClick={() => void load()}><RefreshCw className="w-4 h-4 mr-2" />Refresh</Button>
          <Button variant="secondary"><Download className="w-4 h-4 mr-2" />{t('export')}</Button>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {loading ? <Card><div className="p-8 text-center text-gray-500">Loading analytics…</div></Card> : !analytics ? <Card><div className="p-8 text-center text-gray-500">Create or select a campaign with performance data to view analytics.</div></Card> : <>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card title={t('spend')} subtitle="Reported"><p className="text-2xl font-bold">{totals.spend.toLocaleString()} {analytics.campaign.currency}</p></Card>
          <Card title={t('revenue')} subtitle="Reported"><p className="text-2xl font-bold">{totals.revenue.toLocaleString()} {analytics.campaign.currency}</p></Card>
          <Card title="ROAS" subtitle="Calculated"><p className="text-2xl font-bold">{kpis?.roas?.toFixed(2) ?? '—'}</p></Card>
          <Card title="CPA" subtitle="Calculated"><p className="text-2xl font-bold">{kpis?.cpa?.toFixed(2) ?? '—'} {analytics.campaign.currency}</p></Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card title="ROAS Trend" subtitle="Calculated from normalized snapshots">
            <div className="h-64"><ResponsiveContainer width="100%" height="100%"><LineChart data={chartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" /><YAxis /><Tooltip /><Line type="monotone" dataKey="roas" stroke="#3b82f6" strokeWidth={2} name="ROAS" /></LineChart></ResponsiveContainer></div>
          </Card>
          <Card title="Spend vs Revenue" subtitle="Provider-reported inputs">
            <div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" /><YAxis /><Tooltip /><Bar dataKey="spend" fill="#64748b" name="Spend" /><Bar dataKey="revenue" fill="#10b981" name="Revenue" /></BarChart></ResponsiveContainer></div>
          </Card>
        </div>

        <Card title="Campaign Detective" subtitle="Evidence first; uncertain causes remain hypotheses.">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3"><div className="text-sm text-gray-600">Data window: {new Date(analytics.dataWindow.start).toLocaleDateString()} – {new Date(analytics.dataWindow.end).toLocaleDateString()}</div><Button onClick={() => void runDiagnosis()} disabled={diagnosing}><Search className="w-4 h-4 mr-2" />{diagnosing ? 'Analyzing…' : 'Run diagnosis'}</Button></div>
            {diagnosis ? <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm"><AlertTriangle className="w-4 h-4" /><span>Status: {diagnosis.status}</span><span>Confidence: {typeof diagnosis.confidence === 'number' ? diagnosis.confidence.toFixed(2) : diagnosis.confidence}</span></div>
              {diagnosis.aiSummary && <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700">{diagnosis.aiSummary}</div>}
              <div><h3 className="font-semibold mb-2">Observed facts</h3><div className="space-y-1 text-sm">{diagnosis.observedFacts.map((fact, index) => <div key={index} className="rounded border p-2">{String(fact.metric)}: {String(fact.previous)} → {String(fact.current)} ({(Number(fact.changeRatio) * 100).toFixed(1)}%)</div>)}</div></div>
              <div><h3 className="font-semibold mb-2">Candidate causes</h3><div className="space-y-2">{diagnosis.candidateCauses.map((cause) => <div key={cause.cause} className="rounded border p-3"><div className="font-medium">{cause.cause}</div><div className="text-xs text-gray-500">Confidence {cause.confidence.toFixed(2)} · {cause.evidence.join(' ')}</div></div>)}</div></div>
              <div><h3 className="font-semibold mb-2">Recommendations</h3><div className="space-y-2">{diagnosis.recommendations.map((recommendation) => <div key={recommendation.type} className="rounded border p-3"><div className="font-medium">{recommendation.title}</div><div className="text-sm text-gray-600">{recommendation.action}</div><div className="text-xs text-gray-500 mt-1">Approval required: {recommendation.requiresApproval !== false ? 'Yes' : 'No'}</div></div>)}</div></div>
            </div> : <div className="text-sm text-gray-500">No diagnosis has been generated for this campaign yet.</div>}
          </div>
        </Card>
      </>}
    </div>
  );
}
