import React, { useEffect, useState } from 'react';
import { Wand2, Image, Video, Copy, Check, Eye, X, Loader2, AlertTriangle, Layers, Sparkles } from 'lucide-react';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { useLanguage } from '../../contexts/LanguageContext';
import { Creative, Product } from '../../types';
import { apiFetch } from '../../lib/api';

const CREATIVE_TYPES: Creative['type'][] = [
  'image_ad', 'story', 'reel', 'carousel', 'facebook_feed', 'instagram_feed', 'instagram_story', 'instagram_reel'
];

const STATUS_VARIANT: Record<Creative['status'], any> = {
  draft: 'default', ready: 'warning', approved: 'success'
};

const emptyForm = {
  name: '', productId: '', type: 'image_ad' as Creative['type'], angle: '', hook: '',
  primaryText: '', headline: '', cta: '', url: '', status: 'draft' as Creative['status'],
  language: 'ar' as 'ar' | 'fr' | 'en',
};

// The original hand-entry Creative Studio, kept exactly as it worked before
// the "AI Creative Pack" tab was added (see src/pages/CreativeStudio.tsx) --
// nothing here changed, it was only moved out of the page file so the two
// experiences (AI-generated pack vs. one-off manual creative) can live side
// by side without either one growing an unreadable file. This page is
// connected to the real backend (GET/POST /api/creatives). Ad copy can either
// be typed in by hand or generated with AI via POST /api/creatives/generate-copy
// (needs ANTHROPIC_API_KEY configured on the server). Either way, nothing is
// saved until the user reviews it and presses Save, same as Orders/Products.
export function ManualCreatives() {
  const { t } = useLanguage();
  const [creatives, setCreatives] = useState<Creative[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'image' | 'video'>('all');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [previewCreative, setPreviewCreative] = useState<Creative | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadCreatives = () => {
    setLoading(true);
    setLoadError(null);
    apiFetch<{ creatives: Creative[] }>('/api/creatives')
      .then(data => setCreatives(data.creatives))
      .catch(e => setLoadError(e instanceof Error ? e.message : 'Failed to load creatives'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadCreatives();
    // Products power the optional "linked product" dropdown. A failure here
    // shouldn't block viewing existing creatives, so it's silent.
    apiFetch<{ products: Product[] }>('/api/products').then(data => setProducts(data.products)).catch(() => {});
  }, []);

  const filtered = creatives.filter(c => {
    if (activeTab === 'image') return c.type === 'image_ad' || c.type === 'carousel';
    if (activeTab === 'video') return ['reel', 'instagram_reel', 'story', 'instagram_story'].includes(c.type);
    return true;
  });

  const openAddModal = () => {
    setForm(emptyForm);
    setSaveError(null);
    setGenerateError(null);
    setShowModal(true);
  };

  // Calls the AI copywriting endpoint (needs ANTHROPIC_API_KEY configured on
  // the server) and fills the hook/headline/primaryText/cta fields with its
  // suggestion. The user still reviews and can edit everything before Save --
  // this never saves anything by itself.
  const handleGenerate = async () => {
    const productId = form.productId || undefined;
    const productName = form.name.trim();
    if (!productId && !productName) {
      setGenerateError('Enter a product name or pick a product first.');
      return;
    }
    setGenerating(true);
    setGenerateError(null);
    try {
      const { suggestion } = await apiFetch<{ suggestion: { hook: string; headline: string; primaryText: string; cta: string } }>(
        '/api/creatives/generate-copy',
        { body: { productId, productName: productId ? undefined : productName, angle: form.angle || undefined, language: form.language } }
      );
      setForm(prev => ({
        ...prev,
        hook: suggestion.hook || prev.hook,
        headline: suggestion.headline || prev.headline,
        primaryText: suggestion.primaryText || prev.primaryText,
        cta: suggestion.cta || prev.cta,
      }));
    } catch (e) {
      setGenerateError(e instanceof Error ? e.message : 'Failed to generate ad copy');
    } finally {
      setGenerating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      const { creative } = await apiFetch<{ creative: Creative }>('/api/creatives', {
        body: {
          name: form.name,
          productId: form.productId || undefined,
          type: form.type,
          angle: form.angle,
          hook: form.hook || undefined,
          primaryText: form.primaryText || undefined,
          headline: form.headline || undefined,
          cta: form.cta || undefined,
          url: form.url || undefined,
          status: form.status,
        }
      });
      setCreatives(prev => [creative, ...prev]);
      setShowModal(false);
      setForm(emptyForm);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save creative');
    } finally {
      setSaving(false);
    }
  };

  const copyCreative = async (creative: Creative) => {
    const parts = [creative.headline, creative.primaryText, creative.cta].filter(Boolean);
    const text = parts.length ? parts.join('\n\n') : creative.hook || creative.name;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      window.prompt('Copy this text:', text);
      return;
    }
    setCopiedId(creative.id);
    setTimeout(() => setCopiedId(prev => (prev === creative.id ? null : prev)), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {(['all', 'image', 'video'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === tab ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {tab === 'all' ? t('all') : tab === 'image' ? t('imageAd') : t('reel')}
            </button>
          ))}
        </div>
        <Button onClick={openAddModal}><Wand2 className="w-4 h-4 mr-2" />{t('generateCreatives')}</Button>
      </div>

      {loading && (
        <div className="text-center py-12 text-gray-500 flex flex-col items-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin" />
          <p>Loading your creatives...</p>
        </div>
      )}
      {!loading && loadError && (
        <div className="text-center py-12">
          <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <p className="text-red-600 mb-3">{loadError}</p>
          <Button variant="secondary" size="sm" onClick={loadCreatives}>Retry</Button>
        </div>
      )}
      {!loading && !loadError && filtered.length === 0 && (
        <div className="text-center py-12">
          <Layers className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-2">{t('noData')}</p>
          <Button variant="secondary" size="sm" onClick={openAddModal}>{t('generateCreatives')}</Button>
        </div>
      )}
      {!loading && !loadError && filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(creative => (
            <Card key={creative.id} className="relative">
              <div className="aspect-video bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg mb-4 flex items-center justify-center overflow-hidden">
                {creative.url ? (
                  creative.type.includes('reel') || creative.type.includes('story') ? (
                    <video src={creative.url} className="w-full h-full object-cover" muted />
                  ) : (
                    <img src={creative.url} alt={creative.name} className="w-full h-full object-cover" />
                  )
                ) : creative.type.includes('reel') || creative.type.includes('story') ? (
                  <Video className="w-12 h-12 text-gray-400" />
                ) : (
                  <Image className="w-12 h-12 text-gray-400" />
                )}
              </div>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-medium text-gray-900">{creative.name}</h3>
                  {creative.angle && <p className="text-xs text-gray-500">{creative.angle}</p>}
                </div>
              </div>
              {creative.hook && <p className="text-sm text-gray-600 mb-2 line-clamp-2">"{creative.hook}"</p>}
              <div className="flex flex-wrap gap-1 mb-3">
                <Badge variant="info" className="text-xs">{creative.type}</Badge>
                <Badge variant={STATUS_VARIANT[creative.status]} className="text-xs">{creative.status}</Badge>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" className="flex-1" onClick={() => setPreviewCreative(creative)}>
                  <Eye className="w-4 h-4 mr-1" /> Preview
                </Button>
                <Button variant="ghost" size="sm" title="Copy ad copy" onClick={() => copyCreative(creative)}>
                  {copiedId === creative.id ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-semibold text-gray-900">{t('generateCreatives')}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('productName')} *</label>
                  <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('product')}</label>
                  <select
                    value={form.productId}
                    onChange={e => setForm({ ...form, productId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- None --</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Format</label>
                  <select
                    value={form.type}
                    onChange={e => setForm({ ...form, type: e.target.value as Creative['type'] })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {CREATIVE_TYPES.map(ty => <option key={ty} value={ty}>{ty}</option>)}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Angle</label>
                  <Input value={form.angle} onChange={e => setForm({ ...form, angle: e.target.value })} placeholder="e.g. Price / Urgency / Social proof" />
                </div>
                <div className="md:col-span-2 bg-blue-50/60 border border-blue-100 rounded-lg p-3 space-y-2">
                  <p className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                    Generate the Hook, Headline, Primary text &amp; CTA below with AI
                  </p>
                  <div className="flex flex-col sm:flex-row sm:items-end gap-2">
                    <div className="flex-1">
                      <label className="block text-xs text-gray-500 mb-1">Language for the AI text</label>
                      <select
                        value={form.language}
                        onChange={e => setForm({ ...form, language: e.target.value as 'ar' | 'fr' | 'en' })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        <option value="ar">العربية</option>
                        <option value="fr">Français</option>
                        <option value="en">English</option>
                      </select>
                    </div>
                    <Button type="button" variant="secondary" disabled={generating} onClick={handleGenerate} className="w-full sm:w-auto">
                      {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                      {generating ? 'Generating...' : 'Generate with AI'}
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500">Uses the product name/selection and angle above. You can still edit everything it fills in.</p>
                </div>
                {generateError && (
                  <div className="md:col-span-2 flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    {generateError}
                  </div>
                )}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hook</label>
                  <Input value={form.hook} onChange={e => setForm({ ...form, hook: e.target.value })} />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Primary text</label>
                  <textarea
                    value={form.primaryText}
                    onChange={e => setForm({ ...form, primaryText: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Headline</label>
                  <Input value={form.headline} onChange={e => setForm({ ...form, headline: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CTA</label>
                  <Input value={form.cta} onChange={e => setForm({ ...form, cta: e.target.value })} placeholder="e.g. Shop Now" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Image / video link (optional)</label>
                  <Input value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} placeholder="https://..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('status')}</label>
                  <select
                    value={form.status}
                    onChange={e => setForm({ ...form, status: e.target.value as Creative['status'] })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="draft">draft</option>
                    <option value="ready">ready</option>
                    <option value="approved">approved</option>
                  </select>
                </div>
              </div>
              {saveError && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  {saveError}
                </div>
              )}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="secondary" onClick={() => setShowModal(false)} disabled={saving}>{t('cancel')}</Button>
                <Button type="submit" disabled={saving}>{saving ? 'Saving...' : t('save')}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {previewCreative && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setPreviewCreative(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-semibold text-gray-900">{previewCreative.name}</h2>
              <button onClick={() => setPreviewCreative(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div className="aspect-video bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg flex items-center justify-center overflow-hidden">
                {previewCreative.url ? (
                  previewCreative.type.includes('reel') || previewCreative.type.includes('story') ? (
                    <video src={previewCreative.url} controls className="w-full h-full object-cover" />
                  ) : (
                    <img src={previewCreative.url} alt={previewCreative.name} className="w-full h-full object-cover" />
                  )
                ) : (
                  previewCreative.type.includes('reel') || previewCreative.type.includes('story')
                    ? <Video className="w-12 h-12 text-gray-400" />
                    : <Image className="w-12 h-12 text-gray-400" />
                )}
              </div>
              {previewCreative.headline && <p className="font-semibold text-gray-900">{previewCreative.headline}</p>}
              {previewCreative.primaryText && <p className="text-sm text-gray-700 whitespace-pre-wrap">{previewCreative.primaryText}</p>}
              {previewCreative.hook && !previewCreative.primaryText && <p className="text-sm text-gray-700">"{previewCreative.hook}"</p>}
              {previewCreative.cta && <span className="inline-block px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg">{previewCreative.cta}</span>}
              <div className="flex flex-wrap gap-1 pt-2">
                <Badge variant="info" className="text-xs">{previewCreative.type}</Badge>
                <Badge variant={STATUS_VARIANT[previewCreative.status]} className="text-xs">{previewCreative.status}</Badge>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
