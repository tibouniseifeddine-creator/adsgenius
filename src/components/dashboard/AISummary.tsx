import React, { useState } from 'react';
import { Sparkles, Wand2, Eye, CheckCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { useDemo } from '../../contexts/DemoContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';

export function AISummary() {
  const { recommendations, approveRecommendation } = useDemo();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [appliedIds, setAppliedIds] = useState<string[]>([]);
  const pendingRecs = recommendations.filter(r => r.status === 'pending');

  const handleApply = (recId: string) => {
    approveRecommendation(recId);
    setAppliedIds(prev => [...prev, recId]);
  };

  return (
    <div className="bg-gradient-to-r from-blue-900 to-slate-900 rounded-xl p-6 text-white">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-5 h-5 text-amber-400" />
        <h3 className="text-lg font-semibold">{t('aiSummary')}</h3>
        <Badge variant="warning" className="text-xs">Sample</Badge>
      </div>
      <div className="space-y-3">
        {pendingRecs.slice(0, 3).map(rec => (
          <div key={rec.id} className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="font-medium text-sm">{rec.title}</p>
                <p className="text-sm text-gray-300 mt-1">{rec.description}</p>
                <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                  <span>Confidence: {rec.confidence}%</span>
                  <span>Impact: {rec.expectedImpact}</span>
                </div>
              </div>
              <div className="flex gap-2 ml-4">
                {appliedIds.includes(rec.id) ? (
                  <Badge variant="success" className="text-xs flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> Applied
                  </Badge>
                ) : (
                  <>
                    <Button variant="success" size="sm" onClick={() => handleApply(rec.id)}>{t('apply')}</Button>
                    <Button variant="ghost" size="sm" className="text-white hover:bg-white/20" onClick={() => navigate('/campaigns')}>{t('view')}</Button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
        {pendingRecs.length === 0 && (
          <div className="bg-white/10 rounded-lg p-6 backdrop-blur-sm text-center">
            <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
            <p className="text-sm text-gray-300">{t('applied')}</p>
          </div>
        )}
      </div>
      <div className="flex gap-3 mt-4">
        <Button
          variant="secondary"
          size="sm"
          className="bg-white/20 text-white border-0 hover:bg-white/30"
          onClick={() => navigate('/creative-studio')}
        >
          <Wand2 className="w-4 h-4 mr-2" />{t('generateCreative')}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-white hover:bg-white/20"
          onClick={() => navigate('/campaigns')}
        >
          <Eye className="w-4 h-4 mr-2" />{t('viewCampaign')}
        </Button>
      </div>
    </div>
  );
}
