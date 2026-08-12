import React, { useState } from 'react';
import { ChevronRight, ChevronLeft, Check, Rocket } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useDemo } from '../contexts/DemoContext';
import { useLanguage } from '../contexts/LanguageContext';

const steps = ['selectProduct', 'selectObjective', 'selectDestination', 'selectBudget', 'selectAudience', 'selectCreatives', 'review', 'launch'];

export function CampaignBuilder() {
  const { t } = useLanguage();
  const { products, audiences, creatives } = useDemo();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ productId: '', objective: 'sales', destination: 'website', budgetType: 'daily', budget: 1000, audienceIds: [] as string[], creativeIds: [] as string[] });

  const updateForm = (key: string, value: any) => setForm(prev => ({ ...prev, [key]: value }));

  const renderStep = () => {
    switch (step) {
      case 0: return (
        <div className="space-y-4">
          <h3 className="font-medium">{t('selectProduct')}</h3>
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
              <p><strong>Product:</strong> {products.find(p => p.id === form.productId)?.name}</p>
              <p><strong>Objective:</strong> {form.objective}</p>
              <p><strong>Destination:</strong> {form.destination}</p>
              <p><strong>Budget:</strong> {form.budget} DZD ({form.budgetType})</p>
              <p><strong>Audiences:</strong> {form.audienceIds.length} selected</p>
              <p><strong>Creatives:</strong> {form.creativeIds.length} selected</p>
            </div>
          </Card>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-sm text-amber-800"><strong>MOCK MODE:</strong> This will simulate a campaign launch. No real ads will be created.</p>
          </div>
        </div>
      );
      case 7: return (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Rocket className="w-8 h-8 text-green-600" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900">Campaign Launched!</h3>
          <p className="text-gray-500 mt-2">Your campaign is now active in MOCK mode.</p>
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
      <div className="flex justify-between mt-6">
        <Button variant="secondary" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>
          <ChevronLeft className="w-4 h-4 mr-2" />{t('back')}
        </Button>
        {step < steps.length - 1 ? (
          <Button onClick={() => setStep(step + 1)}><ChevronRight className="w-4 h-4 mr-2" />{t('next')}</Button>
        ) : (
          <Button variant="success" onClick={() => setStep(0)}><Rocket className="w-4 h-4 mr-2" />{t('launch')}</Button>
        )}
      </div>
    </div>
  );
}
