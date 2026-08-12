import React from 'react';
import { Target, Wand2, MapPin, Heart } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useDemo } from '../contexts/DemoContext';
import { useLanguage } from '../contexts/LanguageContext';

export function AudienceLab() {
  const { t } = useLanguage();
  const { audiences } = useDemo();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('audienceLab')}</h1>
        <Button><Wand2 className="w-4 h-4 mr-2" />{t('generateAudiences')}</Button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {audiences.map((audience, i) => (
          <Card key={audience.id} className="relative">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-100 rounded-lg"><Target className="w-5 h-5 text-blue-600" /></div>
              <div>
                <h3 className="font-semibold text-gray-900">{audience.name}</h3>
                <p className="text-xs text-gray-500">Audience {String.fromCharCode(65 + i)}</p>
              </div>
            </div>
            <div className="space-y-3 mb-4">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-600">{audience.ageMin}-{audience.ageMax} ans</span>
                <span className="text-gray-300">|</span>
                <span className="text-gray-600 capitalize">{audience.gender}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="w-4 h-4 text-gray-400" />
                <span className="text-gray-600">{audience.location.join(', ')}</span>
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
            <div className="bg-blue-50 rounded-lg p-3 mb-4">
              <p className="text-xs text-blue-600 font-medium mb-1">Why test this?</p>
              <p className="text-sm text-blue-800">{audience.explanation}</p>
            </div>
            <Button variant="secondary" className="w-full">Use This Audience</Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
