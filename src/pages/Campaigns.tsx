import React from 'react';
import { Plus, Play, Pause, Eye, BarChart3 } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useDemo } from '../contexts/DemoContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';

export function Campaigns() {
  const { t } = useLanguage();
  const { campaigns, products } = useDemo();
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('campaigns')}</h1>
        <Button onClick={() => navigate('/campaign-builder')}><Plus className="w-4 h-4 mr-2" />{t('campaignBuilder')}</Button>
      </div>
      <div className="space-y-4">
        {campaigns.map(campaign => {
          const product = products.find(p => p.id === campaign.productId);
          return (
            <Card key={campaign.id} className="hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-lg text-gray-900">{campaign.name}</h3>
                    <Badge variant={campaign.status === 'active' ? 'success' : campaign.status === 'paused' ? 'warning' : 'default'}>{campaign.status}</Badge>
                    <Badge variant="info">{campaign.budgetType === 'daily' ? `${campaign.budget} DZD/j` : `${campaign.budget} DZD total`}</Badge>
                  </div>
                  <p className="text-sm text-gray-500 mb-3">{t('product')}: {product?.name} | Objective: {campaign.objective} | Destination: {campaign.destination}</p>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span>{campaign.audienceIds.length} audiences</span>
                    <span>{campaign.creativeIds.length} creatives</span>
                    <span className="flex items-center gap-1">
                      <span className={`w-2 h-2 rounded-full ${campaign.trackingStatus === 'active' ? 'bg-green-500' : 'bg-amber-500'}`}></span>
                      {campaign.trackingStatus}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm"><Eye className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="sm"><BarChart3 className="w-4 h-4" /></Button>
                  {campaign.status === 'active' ? <Button variant="secondary" size="sm"><Pause className="w-4 h-4" /></Button> : <Button variant="success" size="sm"><Play className="w-4 h-4" /></Button>}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
