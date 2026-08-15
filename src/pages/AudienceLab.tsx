import React, { useEffect, useState } from 'react';
import { Target, Plus, Trash2 } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { ApiClient, ApiClientError } from '@adsgenius/api-client';
import type { Audience, AudienceType } from '@adsgenius/shared-types';

const api = new ApiClient({ baseUrl: import.meta.env.VITE_API_BASE_URL ?? '' });
const types: AudienceType[] = ['BROAD', 'INTERESTS', 'CUSTOM', 'LOOKALIKE', 'RETARGETING'];

export function AudienceLab() {
  const { t } = useLanguage();
  const { workspaceId } = useAuth();
  const [audiences, setAudiences] = useState<Audience[]>([]);
  const [name, setName] = useState('');
  const [type, setType] = useState<AudienceType>('BROAD');
  const [definition, setDefinition] = useState('{}');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!workspaceId) { setLoading(false); return; }
    setLoading(true); setError(null);
    try { setAudiences(await api.listAudiences(workspaceId)); }
    catch (cause) { setError(cause instanceof ApiClientError ? cause.message : 'Unable to load audiences.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [workspaceId]);

  const create = async () => {
    if (!workspaceId || !name.trim()) return;
    setSaving(true); setError(null);
    try {
      const parsed = JSON.parse(definition) as Record<string, unknown>;
      await api.createAudience(workspaceId, { name: name.trim(), type, definition: parsed });
      setName(''); setDefinition('{}'); await load();
    } catch (cause) { setError(cause instanceof SyntaxError ? 'Definition must be valid JSON.' : cause instanceof ApiClientError ? cause.message : 'Unable to create audience.'); }
    finally { setSaving(false); }
  };

  const remove = async (id: string) => { if (!workspaceId) return; try { await api.deleteAudience(workspaceId, id); await load(); } catch (cause) { setError(cause instanceof ApiClientError ? cause.message : 'Unable to delete audience.'); } };

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-gray-900">{t('audienceLab')}</h1><p className="text-sm text-gray-500 mt-1">Provider-neutral audiences stored in your workspace.</p></div>
      <Card title="Create audience">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input label="Name" value={name} onChange={e => setName(e.target.value)} placeholder="Algeria broad buyers" />
          <label className="block"><span className="text-sm font-medium text-gray-700">Type</span><select className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" value={type} onChange={e => setType(e.target.value as AudienceType)}>{types.map(item => <option key={item}>{item}</option>)}</select></label>
          <Input label="Definition JSON" value={definition} onChange={e => setDefinition(e.target.value)} />
        </div>
        <div className="mt-4"><Button onClick={() => void create()} disabled={saving || !name.trim()}><Plus className="w-4 h-4 mr-2" />Create audience</Button></div>
      </Card>
      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {loading ? <Card><p className="text-sm text-gray-500">Loading audiences…</p></Card> : audiences.length === 0 ? <Card><p className="text-sm text-gray-500">No audiences yet.</p></Card> : <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">{audiences.map(audience => <Card key={audience.id} className="relative"><div className="flex items-center gap-3 mb-4"><div className="p-2 bg-blue-100 rounded-lg"><Target className="w-5 h-5 text-blue-600" /></div><div className="flex-1"><h3 className="font-semibold text-gray-900">{audience.name}</h3><Badge variant="info" className="text-xs">{audience.type}</Badge></div><Button variant="ghost" size="sm" onClick={() => void remove(audience.id)}><Trash2 className="w-4 h-4" /></Button></div><pre className="text-xs bg-gray-50 rounded-lg p-3 overflow-auto">{JSON.stringify(audience.definition, null, 2)}</pre></Card>)}</div>}
    </div>
  );
}
