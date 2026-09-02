import React, { useEffect, useState } from 'react';
import { ChevronRight, ChevronLeft, Check, Save, AlertCircle } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useLanguage } from '../contexts/LanguageContext';
import { apiFetch } from '../lib/api';
import { Product, Audience, Creative } from '../types';
import { useNavigate } from 'react-router-dom';

const steps = ['selectProduct', 'selectObjective', 'selectDestination', 'selectBudget', 'selectAudience', 'selectCreatives', 'review', 'launch'];

// See audit finding P03 -- the final step used to be an explicit "MOCK MODE"
// simulation: nothing was saved anywhere, and every prior step picked from
// DemoContext's fake products/audiences/creatives even for a real signed-in
// account. Every step below now reads real data (GET /api/products,
// /api/audiences, /api/creatives), and "Save" creates a real Campaign row
// (POST /api/campaigns, source "draft"). It intentionally does NOT publish
// to Meta or spend any money -- see the schema comment on the Campaign
// model for why that's separate, deliberately-deferred work.
export function CampaignBuilder() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [audiences, setAudiences] = useState<Audience[]>([]);
  const [creatives, setCreatives] = useState<Creative[]>([]);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ productId: '', objective: 'sales', destination: 'website', budgetType: 'daily', budget: 1000, audienceIds: [] as string[], creativeIds: [] as string[] });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ products: Product[] }>('/api/products').then(d => setProducts(d.products)).catch(() => {});
    apiFetch<{ audiences: Audience[] }>('/api/audiences').then(d => setAudiences(d.audiences)).catch(() => {});
    apiFetch<{ creatives: Creative[] }>('/api/creatives').then(d => setCreatives(d.creatives)).catch(() => {});
  }, []);

  const updateForm = (key: string, value: any) => setForm(prev => ({ ...prev, [key]: value }));

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const selectedProduct = products.find(p => p.id === form.productId);
      await apiFetch<{ campaign: { id: string } }>('/api/campaigns', {
        method: 'POST',
        body: {
          name: selectedProduct ? `${selectedProduct.name} -- ${form.objective}` : `Campaign -- ${form.objective}`,
          productId: form.productId || undefined,
          objective: form.objective,
          destination: form.destination,
          budgetType: form.budgetType,
          budget: form.budget,
          audienceIds: form.audienceIds,
          creativeIds: form.creativeIds
        }
      });
      setStep(steps.length - 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save campaign');
    } finally {
      setSaving(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 0: return (
        <div className="space-y-4">
          <h3 className="font-medium">{t('selectProduct')}</h3>
          {products.length === 0 && <p className="text-sm text-gray-400">No products yet -- add one in Products first.</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {products.map(p => (
              <div key={p.id} onClick={() => updateForm('productId', p.id)}
                className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${form.productId === p.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <div className="flex items-center gap-3">
                  {p.images[0] && <img src={p.images[0]} alt="" className="w-16 h-16 rounded-lg object-cover" />}
                  <div><p className="font-medium">{p.name}</p><p className="text-sm text-gray-500">{p.sellingPrice.toLocaleString()} DZD</p></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
      case 1: return (
        <div className="space-y-4">
          <h3 className="font-medium">{t('selectObjective')}</h3>
          {['sales', 'leads', 'messages', 'website_conversions'].map(obj => (
            <div key={obj} onClick={() => updateForm('objective', obj)}
              className={`p-4 rounded-lg border-2 cursor-pointer ${form.objective === obj ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
              <p className="font-medium capitalize">{obj.replace('_', ' ')}</p>
            </div>
          ))}
        </div>
      );
      case 2: return (
        <div className="space-y-4">
          <h3 className="font-medium">{t('selectDestination')}</h3>
          {['website', 'whatsapp', 'instagram_direct', 'facebook_messenger'].map(dest => (
            <div key={dest} onClick={() => updateForm('destination', dest)}
              className={`p-4 rounded-lg border-2 cursor-pointer ${form.destination === dest ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
              <p className="font-medium capitalize">{dest.replace('_', ' ')}</p>
            </div>
          ))}
        </div>
      );
      case 3: return (
        <div className="space-y-4">
          <h3 className="font-medium">{t('selectBudget')}</h3>
          <div className="flex gap-4 mb-4">
            {['daily', 'lifetime'].map(bt => (
              <button key={bt} onClick={() => updateForm('budgetType', bt)}
                className={`px-4 py-2 rounded-lg border-2 ${form.budgetType === bt ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
                {bt === 'daily' ? t('dailyBudget') : t('lifetimeBudget')}
              </button>
            ))}
          </div>
          <Input type="number" label="Budget (DZD)" value={form.budget} onChange={e => updateForm('budget', Number(e.target.value))} />
        </div>
      );
      case 4: return (
        <div className="space-y-4">
          <h3 className="font-medium">{t('selectAudience')}</h3>
          {audiences.length === 0 && <p className="text-sm text-gray-400">No audiences yet -- add one in Audiences first (optional).</p>}
          {audiences.map(aud => (
            <div key={aud.id} onClick={() => updateForm('audienceIds', form.audienceIds.includes(aud.id) ? form.audienceIds.filter(id => id !== aud.id) : [...form.audienceIds, aud.id])}
              className={`p-4 rounded-lg border-2 cursor-pointer ${form.audienceIds.includes(aud.id) ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
              <p className="font-medium">{aud.name}</p>
              <p className="text-sm text-gray-500">{aud.ageMin}-{aud.ageMax} ans | {aud.gender}</p>
            </div>
          ))}
        </div>
      );
      case 5: return (
        <div className="space-y-4">
          <h3 className="font-medium">{t('selectCreatives')}</h3>
          {creatives.length === 0 && <p className="text-sm text-gray-400">No creatives yet -- add one in Copywriter/Creative Studio first (optional).</p>}
          {creatives.map(c => (
            <div key={c.id} onClick={() => updateForm('creativeIds', form.creativeIds.includes(c.id) ? form.creativeIds.filter(id => id !== c.id) : [...form.creativeIds, c.id])}
              className={`p-4 rounded-lg border-2 cursor-pointer ${form.creativeIds.includes(c.id) ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
              <p className="font-medium">{c.name}</p>
              <p className="text-sm text-gray-500">{c.angle}</p>
            </div>
          ))}
        </div>
      );
      case 6: return (
        <div className="space-y-4">
          <h3 className="font-medium">{t('review')}</h3>
          <Card title="Campaign Summary">
            <div className="space-y-2 text-sm">
              <p><strong>Product:</strong> {products.find(p => p.id === form.productId)?.name || '--'}</p>
              <p><strong>Objective:</strong> {form.objective}</p>
              <p><strong>Destination:</strong> {form.destination}</p>
              <p><strong>Budget:</strong> {form.budget} DZD ({form.budgetType})</p>
              <p><strong>Audiences:</strong> {form.audienceIds.length} selected</p>
              <p><strong>Creatives:</strong> {form.creativeIds.length} selected</p>
            </div>
          </Card>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-600" />
            <p className="text-sm text-blue-800">Saving creates a real campaign plan in your account. It does not publish anything to Meta or spend any money -- publishing to Meta isn't available yet.</p>
          </div>
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>
          )}
        </div>
      );
      case 7: return (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900">Campaign plan saved</h3>
          <p className="text-gray-500 mt-2">Saved to your account as a draft. It's not running on Meta -- you can review it in Campaigns.</p>
          <Button className="mt-4" onClick={() => navigate('/campaigns')}>Go to Campaigns</Button>
        </div>
      );
      default: return null;
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{t('campaignBuilder')}</h1>
      <div className="flex items-center gap-2 mb-6">
        {steps.map((s, i) => (
          <React.Fragment key={s}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${i <= step ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
              {i < step ? <Check className="w-4 h-4" /> : i + 1}
            </div>
            {i < steps.length - 1 && <div className={`flex-1 h-0.5 ${i < step ? 'bg-blue-600' : 'bg-gray-200'}`} />}
          </React.Fragment>
        ))}
      </div>
      <Card>{renderStep()}</Card>
      {step < steps.length - 1 && (
        <div className="flex justify-between mt-6">
          <Button variant="secondary" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>
            <ChevronLeft className="w-4 h-4 mr-2" />{t('back')}
          </Button>
          {step < steps.length - 2 ? (
            <Button onClick={() => setStep(step + 1)}><ChevronRight className="w-4 h-4 mr-2" />{t('next')}</Button>
          ) : (
            <Button variant="success" onClick={save} disabled={saving || !form.productId}>
              <Save className="w-4 h-4 mr-2" />{saving ? 'Saving...' : 'Save campaign plan'}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
