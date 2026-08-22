import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Wand2, Users, Lightbulb, AlertTriangle, Loader2 } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { apiFetch } from '../lib/api';
import { Product } from '../types';

// Loads the real product from the backend (same GET /api/products the Products
// list page uses) instead of DemoContext -- see Products.tsx / COWORK_ADSGENIUS_REALDATA_PLAN.md.
// AI analysis is not implemented in the backend yet, so `analysis` is always
// undefined for real data today; that correctly falls through to the existing
// "Analyze with AI" empty state below rather than showing fabricated numbers.
export function ProductAnalysis() {
  const { id } = useParams();
  const { t } = useLanguage();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiFetch<{ products: Product[] }>('/api/products')
      .then(data => {
        if (cancelled) return;
        setProduct(data.products.find(p => p.id === id) ?? null);
      })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load product'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return (
      <div className="text-center py-20 text-gray-500 flex flex-col items-center gap-2">
        <Loader2 className="w-6 h-6 animate-spin" />
        <p>Loading product...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="text-center py-20">
        <AlertTriangle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500">Product not found.</p>
      </div>
    );
  }

  const analysis = product.aiAnalysis;

  if (!analysis) {
    return (
      <div className="text-center py-20">
        <Wand2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500">{t('analyzeWithAI')}</p>
        <Button className="mt-4"><Wand2 className="w-4 h-4 mr-2" />{t('analyzeWithAI')}</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('productAnalysis')}: {product.name}</h1>
        <Button variant="secondary"><Wand2 className="w-4 h-4 mr-2" />{t('generateCreatives')}</Button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title={t('product')} subtitle={product.sku}>
          <div className="flex gap-4">
            {product.images[0] && <img src={product.images[0]} alt="" className="w-32 h-32 rounded-xl object-cover" />}
            <div>
              <p className="font-medium text-lg">{product.name}</p>
              <p className="text-gray-500 text-sm mt-1">{product.description}</p>
              <div className="flex gap-2 mt-3">
                <Badge>{product.category}</Badge>
                <Badge variant="success">{product.sellingPrice.toLocaleString()} DZD</Badge>
              </div>
            </div>
          </div>
        </Card>
        <Card title={t('target')} subtitle={t('targetCustomer')}>
          <div className="flex items-start gap-3">
            <Users className="w-5 h-5 text-blue-600 mt-1" />
            <div>
              <p className="font-medium">{analysis.targetDemographic.gender}, {analysis.targetDemographic.age}</p>
              <p className="text-sm text-gray-500">{analysis.style}</p>
            </div>
          </div>
        </Card>
        <Card title={t('positioning')} subtitle={t('productAnalysis')}>
          {analysis.positioning && (
            <div className="space-y-3">
              <div><p className="text-xs text-gray-400 uppercase">{t('mainBenefit')}</p><p className="text-sm font-medium">{analysis.positioning.mainBenefit}</p></div>
              <div><p className="text-xs text-gray-400 uppercase">{t('usp')}</p><p className="text-sm font-medium">{analysis.positioning.usp}</p></div>
              <div><p className="text-xs text-gray-400 uppercase">{t('painPoint')}</p><p className="text-sm">{analysis.positioning.painPoint}</p></div>
              <div><p className="text-xs text-gray-400 uppercase">{t('emotionalBenefit')}</p><p className="text-sm">{analysis.positioning.emotionalBenefit}</p></div>
              <div><p className="text-xs text-gray-400 uppercase">{t('rationalBenefit')}</p><p className="text-sm">{analysis.positioning.rationalBenefit}</p></div>
            </div>
          )}
        </Card>
        <Card title={t('targetCustomer')} subtitle="AI Generated">
          {analysis.targetCustomer && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-xs text-gray-400">{t('age')}</p><p className="font-medium">{analysis.targetCustomer.age}</p></div>
                <div><p className="text-xs text-gray-400">{t('gender')}</p><p className="font-medium">{analysis.targetCustomer.gender}</p></div>
              </div>
              <div>
                <p className="text-xs text-gray-400">{t('interests')}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {analysis.targetCustomer.interests.map(i => <Badge key={i} variant="info" className="text-xs">{i}</Badge>)}
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-400">{t('motivations')}</p>
                <ul className="text-sm list-disc list-inside mt-1">{analysis.targetCustomer.motivations.map((m, i) => <li key={i}>{m}</li>)}</ul>
              </div>
              <div>
                <p className="text-xs text-gray-400">{t('objections')}</p>
                <ul className="text-sm list-disc list-inside mt-1 text-amber-700">{analysis.targetCustomer.objections.map((o, i) => <li key={i}>{o}</li>)}</ul>
              </div>
            </div>
          )}
        </Card>
        <Card title={t('advertisingAngles')} subtitle="AI Recommended" className="lg:col-span-2">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {analysis.advertisingAngles.map((angle, i) => (
              <div key={i} className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                <div className="flex items-center gap-2 mb-2">
                  <Lightbulb className="w-4 h-4 text-blue-600" />
                  <span className="font-medium text-blue-900">Angle {i + 1}</span>
                </div>
                <p className="text-sm text-blue-800">{angle}</p>
              </div>
            ))}
          </div>
        </Card>
        <Card title={t('objections')} subtitle="Address these in your copy" className="lg:col-span-2">
          <div className="flex items-start gap-3 bg-amber-50 p-4 rounded-lg border border-amber-100">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
            <div>
              <p className="font-medium text-amber-900">Possible Customer Objections</p>
              <ul className="text-sm text-amber-800 mt-2 list-disc list-inside">{analysis.objections.map((o, i) => <li key={i}>{o}</li>)}</ul>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
