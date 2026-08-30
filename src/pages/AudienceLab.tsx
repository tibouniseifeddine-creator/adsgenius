import React, { useEffect, useState } from 'react';
import { Target, Wand2, MapPin, Heart, Loader2, AlertTriangle, Plus, Trash2, Copy, Check, X, Users } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { useLanguage } from '../contexts/LanguageContext';
import { Audience, Product } from '../types';
import { apiFetch } from '../lib/api';

const emptyManualForm = {
  name: '', ageMin: '18', ageMax: '45', gender: 'all' as 'male' | 'female' | 'all',
  location: '', interests: '', explanation: '', productId: ''
};

const emptyGenerateForm = {
  productId: '', productName: '', description: '', category: '', country: '', language: 'ar' as 'ar' | 'fr' | 'en'
};

// This page is connected to the real backend (GET/POST/DELETE /api/audiences,
// POST /api/audiences/generate) instead of DemoContext's fake data -- see
// COWORK_ADSGENIUS_REALDATA_PLAN.md. There is no real Campaign builder wired up
// yet (Campaign is still a future feature), so "using" an audience here means
// copying its targeting summary to paste into Meta Ads Manager, not attaching
// it to anything else in this app.
export function AudienceLab() {
  const { t } = useLanguage();
  const [audiences, setAudiences] = useState<Audience[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generateForm, setGenerateForm] = useState(emptyGenerateForm);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const [showManualModal, setShowManualModal] = useState(false);
  const [manualForm, setManualForm] = useState(emptyManualForm);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const loadAudiences = () => {
    setLoading(true);
    setLoadError(null);
    apiFetch<{ audiences: Audience[] }>('/api/audiences')
      .then(data => setAudiences(data.audiences))
      .catch(e => setLoadError(e instanceof Error ? e.message : 'Failed to load audiences'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAudiences();
    // Powers the product picker in the "Generate with AI" modal. A failure here
    // shouldn't block viewing existing audiences, so it's silent -- the modal
    // simply falls back to the freehand product fields.
    apiFetch<{ products: Product[] }>('/api/products').then(data => setProducts(data.products)).catch(() => {});
  }, []);

  const openGenerateModal = () => {
    setGenerateForm(emptyGenerateForm);
    setGenerateError(null);
    setShowGenerateModal(true);
  };

  const handleGenerateProductChange = (productId: string) => {
    const product = products.find(p => p.id === productId);
    setGenerateForm(prev => ({
      ...prev, productId,
      productName: product ? product.name : prev.productName,
      description: product ? product.description : prev.description,
      category: product ? product.category : prev.category
    }));
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!generateForm.productId && !generateForm.productName.trim()) {
      setGenerateError('Choose a product or type a product name first.');
      return;
    }
    setGenerating(true);
    setGenerateError(null);
    try {
      const { audiences: created } = await apiFetch<{ audiences: Audience[] }>('/api/audiences/generate', {
        body: {
          productId: generateForm.productId || undefined,
          productName: generateForm.productId ? undefined : generateForm.productName.trim(),
          description: generateForm.description.trim() || undefined,
          category: generateForm.category.trim() || undefined,
          country: generateForm.country.trim() || undefined,
          language: generateForm.language
        }
      });
      setAudiences(prev => [...created, ...prev]);
      setShowGenerateModal(false);
    } catch (e) {
      setGenerateError(e instanceof Error ? e.message : 'Failed to generate audiences');
    } finally {
      setGenerating(false);
    }
  };

  const openManualModal = () => {
    setManualForm(emptyManualForm);
    setSaveError(null);
    setShowManualModal(true);
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      const { audience } = await apiFetch<{ audience: Audience }>('/api/audiences', {
        body: {
          name: manualForm.name.trim(),
          ageMin: Number(manualForm.ageMin),
          ageMax: Number(manualForm.ageMax),
          gender: manualForm.gender,
          location: manualForm.location.split(',').map(v => v.trim()).filter(Boolean),
          interests: manualForm.interests.split(',').map(v => v.trim()).filter(Boolean),
          explanation: manualForm.explanation.trim() || undefined,
          productId: manualForm.productId || undefined
        }
      });
      setAudiences(prev => [audience, ...prev]);
      setShowManualModal(false);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save audience');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await apiFetch(`/api/audiences/${id}`, { method: 'DELETE' });
      setAudiences(prev => prev.filter(a => a.id !== id));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to delete audience');
    } finally {
      setDeletingId(null);
    }
  };

  // There's no real Campaign builder wired to real data yet, so "using" an
  // audience means copying a ready-to-paste targeting summary for Meta Ads
  // Manager rather than attaching it to anything else in this app.
  const copyForMetaAdsManager = (audience: Audience) => {
    const lines = [
      `Audience: ${audience.name}`,
      `Age: ${audience.ageMin}-${audience.ageMax}`,
      `Gender: ${audience.gender}`,
      `Location: ${audience.location.join(', ') || '-'}`,
      `Interests: ${audience.interests.join(', ') || 'Broad (no interest targeting)'}`
    ];
    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopiedId(audience.id);
      setTimeout(() => setCopiedId(current => (current === audience.id ? null : current)), 2000);
    }).catch(() => setLoadError('Could not copy to clipboard'));
  };
    return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900">{t('audienceLab')}</h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={openManualModal}><Plus className="w-4 h-4 mr-2" />Add Manually</Button>
          <Button onClick={openGenerateModal}><Wand2 className="w-4 h-4 mr-2" />{t('generateAudiences')}</Button>
        </div>
      </div>

      {loading && (
        <div className="text-center py-16 text-gray-500 flex flex-col items-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin" />
          <p>Loading your audiences...</p>
        </div>
      )}

      {!loading && loadError && (
        <div className="text-center py-16">
          <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <p className="text-red-600 mb-3">{loadError}</p>
          <Button variant="secondary" size="sm" onClick={loadAudiences}>Retry</Button>
        </div>
      )}

      {!loading && !loadError && audiences.length === 0 && (
        <Card>
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 mb-4">No audiences yet -- generate some with AI or add one manually.</p>
            <div className="flex justify-center gap-2">
              <Button variant="secondary" size="sm" onClick={openManualModal}>Add Manually</Button>
              <Button size="sm" onClick={openGenerateModal}><Wand2 className="w-4 h-4 mr-2" />{t('generateAudiences')}</Button>
            </div>
          </div>
        </Card>
      )}

      {!loading && !loadError && audiences.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {audiences.map(audience => (
            <Card key={audience.id} className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg"><Target className="w-5 h-5 text-blue-600" /></div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{audience.name}</h3>
                    <Badge variant={audience.source === 'ai' ? 'info' : 'default'} className="text-xs mt-0.5">
                      {audience.source === 'ai' ? 'AI suggested' : 'Manual'}
                    </Badge>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(audience.id)}
                  disabled={deletingId === audience.id}
                  className="text-gray-300 hover:text-red-500 disabled:opacity-50"
                  title="Delete audience"
                >
                  {deletingId === audience.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </button>
              </div>
              <div className="space-y-3 mb-4">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-600">{audience.ageMin}-{audience.ageMax}</span>
                  <span className="text-gray-300">|</span>
                  <span className="text-gray-600 capitalize">{audience.gender}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">{audience.location.join(', ') || 'Not specified'}</span>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Heart className="w-4 h-4 text-gray-400" />
                    <span className="text-xs text-gray-500">Interests</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {audience.interests.length > 0 ? audience.interests.map(i => <Badge key={i} variant="info" className="text-xs">{i}</Badge>) : <Badge variant="warning" className="text-xs">Broad (no interests)</Badge>}
                  </div>
                </div>
              </div>
              {audience.explanation && (
                <div className="bg-blue-50 rounded-lg p-3 mb-4">
                  <p className="text-xs text-blue-600 font-medium mb-1">Why test this?</p>
                  <p className="text-sm text-blue-800">{audience.explanation}</p>
                </div>
              )}
              <Button variant="secondary" className="w-full" onClick={() => copyForMetaAdsManager(audience)}>
                {copiedId === audience.id ? <Check className="w-4 h-4 mr-2 text-emerald-600" /> : <Copy className="w-4 h-4 mr-2" />}
                {copiedId === audience.id ? 'Copied!' : 'Copy for Meta Ads Manager'}
              </Button>
            </Card>
          ))}
        </div>
      )}

      {showGenerateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-semibold text-gray-900">Generate Audiences with AI</h2>
              <button onClick={() => setShowGenerateModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleGenerate} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product</label>
                <select
                  value={generateForm.productId}
                  onChange={e => handleGenerateProductChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">{products.length ? 'Select a product...' : 'No products yet -- type one below'}</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              {!generateForm.productId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Product name *</label>
                  <Input value={generateForm.productName} onChange={e => setGenerateForm({ ...generateForm, productName: e.target.value })} placeholder="e.g. Robe Homme Premium" />
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <Input value={generateForm.category} onChange={e => setGenerateForm({ ...generateForm, category: e.target.value })} placeholder="e.g. Menswear" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Country / market</label>
                  <Input value={generateForm.country} onChange={e => setGenerateForm({ ...generateForm, country: e.target.value })} placeholder="e.g. Algeria" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <Input value={generateForm.description} onChange={e => setGenerateForm({ ...generateForm, description: e.target.value })} placeholder="Optional -- helps the AI suggest better audiences" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Language</label>
                <select
                  value={generateForm.language}
                  onChange={e => setGenerateForm({ ...generateForm, language: e.target.value as 'ar' | 'fr' | 'en' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ar">العربية</option>
                  <option value="fr">Français</option>
                  <option value="en">English</option>
                </select>
              </div>
              {generateError && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  {generateError}
                </div>
              )}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="secondary" onClick={() => setShowGenerateModal(false)} disabled={generating}>{t('cancel')}</Button>
                <Button type="submit" disabled={generating}>
                  {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}
                  {generating ? 'Generating...' : 'Generate'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showManualModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-semibold text-gray-900">Add Audience</h2>
              <button onClick={() => setShowManualModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleManualSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <Input value={manualForm.name} onChange={e => setManualForm({ ...manualForm, name: e.target.value })} required placeholder="e.g. Young urban professionals" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Min age *</label>
                  <Input type="number" min="13" value={manualForm.ageMin} onChange={e => setManualForm({ ...manualForm, ageMin: e.target.value })} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max age *</label>
                  <Input type="number" min="13" value={manualForm.ageMax} onChange={e => setManualForm({ ...manualForm, ageMax: e.target.value })} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                  <select
                    value={manualForm.gender}
                    onChange={e => setManualForm({ ...manualForm, gender: e.target.value as 'male' | 'female' | 'all' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Locations (comma-separated)</label>
                <Input value={manualForm.location} onChange={e => setManualForm({ ...manualForm, location: e.target.value })} placeholder="e.g. Algiers, Oran" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Interests (comma-separated)</label>
                <Input value={manualForm.interests} onChange={e => setManualForm({ ...manualForm, interests: e.target.value })} placeholder="e.g. Online shopping, Fashion" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Related product (optional)</label>
                <select
                  value={manualForm.productId}
                  onChange={e => setManualForm({ ...manualForm, productId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">None</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <Input value={manualForm.explanation} onChange={e => setManualForm({ ...manualForm, explanation: e.target.value })} placeholder="Why is this audience worth testing?" />
              </div>
              {saveError && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  {saveError}
                </div>
              )}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="secondary" onClick={() => setShowManualModal(false)} disabled={saving}>{t('cancel')}</Button>
                <Button type="submit" disabled={saving}>{saving ? 'Saving...' : t('save')}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
