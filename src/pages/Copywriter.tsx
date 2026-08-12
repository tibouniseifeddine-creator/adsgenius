import React, { useState } from 'react';
import { Wand2, Copy, Check } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';
import { useLanguage } from '../contexts/LanguageContext';

const copyExamples = [
  { angle: 'Problem/Solution', hook: 'تعبان من البحث على tenue كاملة؟', primaryText: 'Jean + T-shirt ensemble coordonne a 6490 DA seulement. Livraison 58 wilayas, paiement a la livraison.', headline: 'Look Complet — 6490 DA', cta: 'Commander Maintenant' },
  { angle: 'Price/Offer', hook: '6490 DA فقط !', primaryText: 'Pour moins de 6500 DA, tu as un look complet et style. Offre limitee rentree universitaire.', headline: 'Ensemble Jean+Tshirt — 6490 DA', cta: "Profiter de l'offre" },
  { angle: 'Urgency', hook: 'Stock limite rentree!', primaryText: "Ne rate pas ton look pour la rentree. Jean + T-shirt disponible maintenant. Livraison rapide dans toute l'Algerie.", headline: 'Stock Limite — Rentree', cta: 'Commander Urgent' },
  { angle: 'Social Proof', hook: '+500 commandes cette semaine', primaryText: "Rejoins les centaines d'etudiants qui ont deja adopte ce look. Jean + T-shirt a 6490 DA.", headline: 'Best-Seller Rentree', cta: 'Acheter Maintenant' },
  { angle: 'Lifestyle', hook: 'Le style universitaire parfait', primaryText: 'Confortable, tendance et abordable. Cet ensemble est fait pour toi. Livraison gratuite a partir de 2 articles.', headline: 'Style Universitaire 2024', cta: 'Decouvrir' }
];

export function Copywriter() {
  const { t } = useLanguage();
  const [lang, setLang] = useState('ar');
  const [copied, setCopied] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('copywriter')}</h1>
        <div className="flex gap-3">
          <Select value={lang} onChange={e => setLang(e.target.value)}
            options={[{ value: 'ar', label: 'العربية / Darija' }, { value: 'fr', label: 'Français' }, { value: 'en', label: 'English' }]} />
          <Button><Wand2 className="w-4 h-4 mr-2" />{t('generateCopy')}</Button>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4">
        {copyExamples.map((copy, i) => (
          <Card key={i} title={`${copy.angle}`} subtitle={`Variant ${i + 1}`}>
            <div className="space-y-3">
              <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
                <p className="text-xs text-amber-600 font-medium uppercase mb-1">Hook</p>
                <p className="text-lg font-medium text-amber-900">{copy.hook}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase mb-1">{t('primaryText')}</p>
                <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{copy.primaryText}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-xs text-gray-400 uppercase mb-1">{t('headline')}</p><p className="text-sm font-medium text-gray-900 bg-gray-50 rounded-lg p-2">{copy.headline}</p></div>
                <div><p className="text-xs text-gray-400 uppercase mb-1">{t('cta')}</p><p className="text-sm font-medium text-blue-700 bg-blue-50 rounded-lg p-2">{copy.cta}</p></div>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => handleCopy(`${copy.hook}\n\n${copy.primaryText}\n\n${copy.headline}\n${copy.cta}`, `copy-${i}`)}>
                  {copied === `copy-${i}` ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                  {copied === `copy-${i}` ? 'Copied!' : 'Copy All'}
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
