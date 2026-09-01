import React from 'react';
import { CheckCircle, XCircle, AlertTriangle, TrendingUp, TrendingDown, Lightbulb, Info } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useDemo } from '../contexts/DemoContext';
import { useLanguage } from '../contexts/LanguageContext';

// See audit finding P09 -- this page presented a static "AI Status" panel
// (hardcoded "Active" / "Good" / "2 hours ago") and hardcoded rules as if a
// real recommendation engine were actively monitoring live ad performance.
// No such engine exists yet -- it needs real ad-performance data, which in
// turn needs a connected ad account (tracked separately). The approve/reject
// actions below are real (they update local state), but the sample
// recommendations and the "AI Status" panel are illustrative, and now say so.
export function AIOptimizer() {
  const { t } = useLanguage();
  const { recommendations, approveRecommendation, rejectRecommendation } = useDemo();

  const pending = recommendations.filter(r => r.status === 'pending');
  const approved = recommendations.filter(r => r.status === 'approved');
  const rejected = recommendations.filter(r => r.status === 'rejected');

  const renderRec = (rec: typeof recommendations[0]) => (
    <Card key={rec.id} className="mb-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant={rec.type === 'budget' ? 'success' : rec.type === 'pause' ? 'danger' : rec.type === 'creative' ? 'info' : 'warning'}>
              {rec.type}
            </Badge>
            <span className="text-xs text-gray-400">Confidence: {rec.confidence}%</span>
          </div>
          <h3 className="font-semibold text-gray-900">{rec.title}</h3>
          <p className="text-sm text-gray-600 mt-1">{rec.description}</p>
          <div className="mt-3 bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500"><strong>Reason:</strong> {rec.reason}</p>
            <p className="text-xs text-gray-500 mt-1"><strong>Required Data:</strong> {rec.requiredData}</p>
            <p className="text-xs text-gray-500 mt-1"><strong>Expected Impact:</strong> {rec.expectedImpact}</p>
          </div>
        </div>
        {rec.status === 'pending' && (
          <div className="flex gap-2 ml-4">
            <Button variant="success" size="sm" onClick={() => approveRecommendation(rec.id)}><CheckCircle className="w-4 h-4" /></Button>
            <Button variant="danger" size="sm" onClick={() => rejectRecommendation(rec.id)}><XCircle className="w-4 h-4" /></Button>
          </div>
        )}
        {rec.status === 'approved' && <Badge variant="success">Approved</Badge>}
        {rec.status === 'rejected' && <Badge variant="danger">Rejected</Badge>}
      </div>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('aiOptimizer')}</h1>
        <div className="flex gap-2">
          <Badge variant="warning" className="text-sm">{pending.length} Pending</Badge>
          <Badge variant="success" className="text-sm">{approved.length} Approved</Badge>
        </div>
      </div>

      <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 text-blue-800 text-sm rounded-lg p-3">
        <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <span>Sample recommendations -- real monitoring turns on once your ad account is connected and has real performance data to analyze.</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-amber-500" />
            Pending Recommendations
          </h2>
          {pending.length === 0 ? (
            <Card className="text-center py-12">
              <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
              <p className="text-gray-500">All caught up! No pending recommendations.</p>
            </Card>
          ) : pending.map(renderRec)}

          {approved.length > 0 && (
            <>
              <h2 className="font-semibold text-gray-900 mb-4 mt-8 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-500" />
                Approved
              </h2>
              {approved.map(renderRec)}
            </>
          )}

          {rejected.length > 0 && (
            <>
              <h2 className="font-semibold text-gray-900 mb-4 mt-8 flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-red-500" />
                Rejected
              </h2>
              {rejected.map(renderRec)}
            </>
          )}
        </div>

        <div>
          <Card title="AI Status" subtitle="Not yet connected">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Model</span>
                <Badge variant="warning">Sample data</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Ad account</span>
                <span className="text-sm font-medium">Not connected</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Last Analysis</span>
                <span className="text-sm text-gray-500">--</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Confidence Threshold</span>
                <span className="text-sm font-medium">75%</span>
              </div>
            </div>
          </Card>

          <Card title="Rules Engine" subtitle="Will run once connected" className="mt-4">
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5" />
                <p className="text-sm text-gray-600">If CPD &gt; 500 DZD and delivered &gt;= 5, recommend reducing budget</p>
              </div>
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5" />
                <p className="text-sm text-gray-600">If CTR &gt; avg and CPD &lt; avg, recommend more variations</p>
              </div>
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5" />
                <p className="text-sm text-gray-600">If no conversions after sufficient spend, recommend stopping</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
