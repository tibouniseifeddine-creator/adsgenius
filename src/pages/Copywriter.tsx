import React, { useEffect, useState } from 'react';
import { Wand2, Copy, Check, AlertTriangle, Loader2 } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';
import { Input } from '../components/ui/Input';
import { useLanguage } from '../contexts/LanguageContext';
import { apiFetch } from '../lib/api';
import { Product } from '../types';

// See audit finding P21 -- "Generate Copy" used to sit above five hardcoded
// example variants (a T-shirt/jean bundle in French) that never changed no
// matter what was clicked. The real AI copywriting endpoint
// (POST /api/creatives/generate-copy) already existed and was fully working,
// it just wasn't wired to this page. Now it generates real copy for one of
// your actual products.
interface GeneratedCopy {
  id: string;
  angle: string;
  hook: string;
  headline: string;
  primaryText: string;
  cta: string;
}

export function Copywriter() {
  const { t } = useLanguage();
  const [lang, setLang] = useState<'ar' | 'fr' | 'en'>('ar');
  const [copied, setCopied] = useState<string | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [productId, setProductId] = useState('');
  const [angle, setAngle] = useState('');

  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [results, setResults] = useState<GeneratedCopy[]>([]);

  useEffect(() => {
    apiFetch<{ products: Product[] }>('/api/products')
      .then(data => {
        setProducts(data.products);
        if (data.products.length > 0) setProductId(data.products[0].id);
      })
      .catch(() => {})
      .finally(() => setLoadingProducts(false));
  }, []);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const generate = async () => {
    if (!productId) return;
    setGenerating(true);
    setGenerateError(null);
    try {
      const { suggestion } = await apiFetch<{ suggestion: { hook: string; headline: string; primaryText: string; cta: string } }>(
        '/api/creatives/generate-copy',
        { method: 'POST', body: { productId, angle: angle.trim() || undefined, language: lang } }
      );
      setResults(prev => [{ id: `copy-${Date.now()}`, angle: angle.trim() || 'General', ...suggestion }, ...prev]);
    } catch (e) {
      setGenerateError(e instanceof Error ? e.message : 'Failed to generate copy');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900">{t('copywriter')}</h1>
        <div className="flex gap-3 flex-wrap">
          <Select value={lang} onChange={e => setLang(e.target.value as 'ar' | 'fr' | 'en')}
            options={[{ value: 'ar', label: 'العربية / Darija' }, { value: 'fr', label: 'Français' }, { value: 'en', label: 'English' }]} />
          <Select value={productId} onChange={e => setProductId(e.target.value)}
            options={products.map(p => ({ value: p.id, label: p.name }))} />
          <Input placeholder="Angle (optional, e.g. Urgency)" value={angle} onChange={e => setAngle(e.target.value)} className="w-48" />
          <Button onClick={generate} disabled={generating || !productId} loading={generating}><Wand2 className="w-4 h-4 mr-2" />{t('generateCopy')}</Button>
        </div>
      </div>

      {!loadingProducts && products.length === 0 && (
        <Card className="text-center py-10">
          <p className="text-gray-500">Add a product first, then come back here to generate ad copy for it.</p>
        </Card>
      )}

      {generateError && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {generateError}
        </div>
      )}

      {generating && results.length === 0 && (
        <div className="text-center py-12 text-gray-500 flex flex-col items-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin" />
          <p>Writing your ad copy...</p>
        </div>
      )}

      {!loadingProducts && products.length > 0 && results.length === 0 && !generating && (
        <Card className="text-center py-10">
          <Wand2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Pick a product and click "{t('generateCopy')}" to get real AI-written ad copy.</p>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4">
        {results.map((copy, i) => (
          <Card key={copy.id} title={copy.angle} subtitle={`Variant ${results.length - i}`}>
            <div className="space-y-3">
              <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
                <p className="text-xs text-amber-600 font-medium uppercase mb-1">Hook</p>
                <p className="text-lg font-medium text-amber-900">{copy.hook}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase mb-1">{t('primaryText')}</p>
                <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 whitespace-pre-line">{copy.primaryText}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-xs text-gray-400 uppercase mb-1">{t('headline')}</p><p className="text-sm font-medium text-gray-900 bg-gray-50 rounded-lg p-2">{copy.headline}</p></div>
                <div><p className="text-xs text-gray-400 uppercase mb-1">{t('cta')}</p><p className="text-sm font-medium text-blue-700 bg-blue-50 rounded-lg p-2">{copy.cta}</p></div>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => handleCopy(`${copy.hook}\n\n${copy.primaryText}\n\n${copy.headline}\n${copy.cta}`, copy.id)}>
                  {copied === copy.id ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                  {copied === copy.id ? 'Copied!' : 'Copy All'}
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
