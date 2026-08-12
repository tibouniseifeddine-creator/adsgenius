import React, { useState } from 'react';
import { Wand2, Image, Video, Copy, Star, Eye } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useDemo } from '../contexts/DemoContext';
import { useLanguage } from '../contexts/LanguageContext';

export function CreativeStudio() {
  const { t } = useLanguage();
  const { creatives } = useDemo();
  const [activeTab, setActiveTab] = useState<'all' | 'image' | 'video'>('all');

  const filtered = creatives.filter(c => {
    if (activeTab === 'image') return c.type === 'image_ad';
    if (activeTab === 'video') return ['reel', 'instagram_reel', 'story', 'instagram_story'].includes(c.type);
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('creativeStudio')}</h1>
        <Button><Wand2 className="w-4 h-4 mr-2" />{t('generateCreatives')}</Button>
      </div>
      <div className="flex gap-2">
        {(['all', 'image', 'video'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === tab ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {tab === 'all' ? t('all') : tab === 'image' ? t('imageAd') : t('reel')}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map(creative => (
          <Card key={creative.id} className="relative">
            <div className="aspect-video bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg mb-4 flex items-center justify-center">
              {creative.type.includes('reel') || creative.type.includes('video') ? <Video className="w-12 h-12 text-gray-400" /> : <Image className="w-12 h-12 text-gray-400" />}
            </div>
            <div className="flex items-start justify-between mb-2">
              <div>
                <h3 className="font-medium text-gray-900">{creative.name}</h3>
                <p className="text-xs text-gray-500">{creative.angle}</p>
              </div>
              {creative.aiScore && (
                <div className="flex items-center gap-1 bg-amber-50 px-2 py-1 rounded-md">
                  <Star className="w-3 h-3 text-amber-500" />
                  <span className="text-xs font-bold text-amber-700">{creative.aiScore}</span>
                </div>
              )}
            </div>
            {creative.hook && <p className="text-sm text-gray-600 mb-2 line-clamp-2">"{creative.hook}"</p>}
            <div className="flex flex-wrap gap-1 mb-3">
              <Badge variant="info" className="text-xs">{creative.type}</Badge>
              <Badge variant={creative.status === 'approved' ? 'success' : creative.status === 'ready' ? 'warning' : 'default'} className="text-xs">{creative.status}</Badge>
            </div>
            {creative.metrics && (
              <div className="grid grid-cols-3 gap-2 text-xs bg-gray-50 rounded-lg p-3 mb-3">
                <div><p className="text-gray-400">Spend</p><p className="font-medium">{creative.metrics.spend.toLocaleString()} DZD</p></div>
                <div><p className="text-gray-400">CTR</p><p className="font-medium">{creative.metrics.ctr}%</p></div>
                <div><p className="text-gray-400">CPD</p><p className="font-medium">{creative.metrics.costPerDeliveredOrder.toFixed(0)} DZD</p></div>
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" className="flex-1"><Eye className="w-4 h-4 mr-1" /> Preview</Button>
              <Button variant="ghost" size="sm"><Copy className="w-4 h-4" /></Button>
            </div>
            {creative.aiExplanation && (
              <div className="mt-3 p-3 bg-blue-50 rounded-lg text-xs text-blue-800"><strong>AI:</strong> {creative.aiExplanation}</div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
