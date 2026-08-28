import React, { useState } from 'react';
import {
  ArrowLeft, Sparkles, RefreshCw, ImagePlus, Loader2, AlertTriangle, Check,
  BookmarkCheck, PlusCircle, Target, Layers
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { apiFetch } from '../../lib/api';
import { CreativePackItem, CreativePackConceptItem } from '../../types';

interface Props {
  pack: CreativePackItem;
  onUpdate: (pack: CreativePackItem) => void;
  onBack: () => void;
}

const ANGLE_LABELS: Record<string, string> = {
  problem_solution: 'Problem / Solution', benefits: 'Product Benefits', emotional: 'Emotional',
  social_proof: 'Social Proof', premium: 'Premium / Luxury', price_value: 'Price / Value',
  before_after: 'Before / After', lifestyle: 'Lifestyle', convenience: 'Convenience', urgency: 'Urgency'
};

function angleLabel(angle: string) {
  return ANGLE_LABELS[angle] ?? angle;
}

// Results / campaign dashboard: overview + AI strategy, then the Creative
// Pack itself as one card per concept, each independently regenerable
// (never the whole pack) and each able to get its own AI image. See
// CreativePackGenerator.tsx for the upload step that produces `pack`.
export function CreativePackResults({ pack, onUpdate, onBack }: Props) {
  const [savingStatus, setSavingStatus] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [busyConceptId, setBusyConceptId] = useState<string | null>(null);
  const [conceptError, setConceptError] = useState<Record<string, string>>({});
  const [addedToCreatives, setAddedToCreatives] = useState<Record<string, boolean>>({});
  const [regeneratingAll, setRegeneratingAll] = useState(false);

  const updateConcept = (updated: CreativePackConceptItem) => {
    onUpdate({ ...pack, concepts: pack.concepts.map(c => (c.id === updated.id ? updated : c)) });
  };

  const handleSave = async () => {
    setSavingStatus(true);
    setSaveError(null);
    try {
      const nextStatus = pack.status === 'saved' ? 'draft' : 'saved';
      const { creativePack } = await apiFetch<{ creativePack: CreativePackItem }>(`/api/creative-packs/${pack.id}`, {
        method: 'PATCH',
        body: { status: nextStatus }
      });
      onUpdate({ ...pack, status: creativePack.status });
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save campaign');
    } finally {
      setSavingStatus(false);
    }
  };

  const handleRegenerateAll = async () => {
    setRegeneratingAll(true);
    setSaveError(null);
    try {
      const { creativePack } = await apiFetch<{ creativePack: CreativePackItem }>(`/api/creative-packs/${pack.id}/concepts`, {
        body: { count: pack.concepts.length || undefined }
      });
      onUpdate(creativePack);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to regenerate concepts');
    } finally {
      setRegeneratingAll(false);
    }
  };

  const handleRegenerateField = async (concept: CreativePackConceptItem, field: 'hook' | 'copy') => {
    setBusyConceptId(concept.id);
    setConceptError(prev => ({ ...prev, [concept.id]: '' }));
    try {
      const { concept: updated } = await apiFetch<{ concept: CreativePackConceptItem }>(
        `/api/creative-packs/${pack.id}/concepts/${concept.id}/regenerate`,
        { body: { field } }
      );
      updateConcept({ ...concept, ...updated });
    } catch (e) {
      setConceptError(prev => ({ ...prev, [concept.id]: e instanceof Error ? e.message : 'Failed to regenerate' }));
    } finally {
      setBusyConceptId(null);
    }
  };

  const handleGenerateImage = async (concept: CreativePackConceptItem) => {
    setBusyConceptId(concept.id);
    setConceptError(prev => ({ ...prev, [concept.id]: '' }));
    updateConcept({ ...concept, imageStatus: 'generating' });
    try {
      const { concept: updated } = await apiFetch<{ concept: CreativePackConceptItem }>(
        `/api/creative-packs/${pack.id}/concepts/${concept.id}/generate-image`,
        { body: {} }
      );
      updateConcept(updated);
    } catch (e) {
      setConceptError(prev => ({ ...prev, [concept.id]: e instanceof Error ? e.message : 'Failed to generate image' }));
      updateConcept({ ...concept, imageStatus: 'failed' });
    } finally {
      setBusyConceptId(null);
    }
  };

  const handleAddToCreatives = async (concept: CreativePackConceptItem) => {
    setBusyConceptId(concept.id);
    setConceptError(prev => ({ ...prev, [concept.id]: '' }));
    try {
      await apiFetch(`/api/creative-packs/${pack.id}/concepts/${concept.id}/add-to-creative`, { body: {} });
      setAddedToCreatives(prev => ({ ...prev, [concept.id]: true }));
    } catch (e) {
      setConceptError(prev => ({ ...prev, [concept.id]: e instanceof Error ? e.message : 'Failed to add to Creatives' }));
    } finally {
      setBusyConceptId(null);
    }
  };

  const strategy = pack.strategy;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Back to upload
        </button>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={handleRegenerateAll} disabled={regeneratingAll}>
            {regeneratingAll ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Regenerate all concepts
          </Button>
          <Button size="sm" onClick={handleSave} disabled={savingStatus} variant={pack.status === 'saved' ? 'success' : 'primary'}>
            {savingStatus ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <BookmarkCheck className="w-4 h-4 mr-2" />}
            {pack.status === 'saved' ? 'Saved' : 'Save Campaign'}
          </Button>
        </div>
      </div>

      {saveError && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {saveError}
        </div>
      )}

      {/* Campaign Overview */}
      <Card title="Campaign Overview" icon={<Layers className="w-5 h-5 text-blue-600" />}>
        <div className="flex flex-col sm:flex-row gap-4">
          {pack.productImageUrl && (
            <img src={pack.productImageUrl} alt={pack.productName} className="w-full sm:w-32 h-32 object-cover rounded-lg flex-shrink-0" />
          )}
          <div className="flex-1 space-y-2">
            <p className="text-lg font-semibold text-gray-900">{pack.productName}</p>
            <div className="flex flex-wrap gap-2 text-xs">
              {pack.category && <Badge variant="default">{pack.category}</Badge>}
              {pack.sellingPrice != null && <Badge variant="info">{pack.sellingPrice} {pack.currency}</Badge>}
              <Badge variant={pack.status === 'saved' ? 'success' : 'default'}>{pack.status}</Badge>
            </div>
            {strategy && (
              <div className="text-sm text-gray-600 space-y-1 pt-1">
                {strategy.targetAudience && <p><span className="font-medium text-gray-700">Target audience:</span> {strategy.targetAudience}</p>}
                {strategy.recommendedPlatform && <p><span className="font-medium text-gray-700">Recommended platform:</span> {strategy.recommendedPlatform}</p>}
                {strategy.recommendedObjective && <p><span className="font-medium text-gray-700">Recommended objective:</span> {strategy.recommendedObjective}</p>}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* AI Recommendations */}
      {strategy && (strategy.rationale || strategy.recommendedAngles?.length > 0) && (
        <Card title="AI Recommendations" icon={<Target className="w-5 h-5 text-blue-600" />}>
          {strategy.recommendedAngles?.length > 0 && (
            <ol className="space-y-1 text-sm text-gray-700 mb-3">
              {pack.concepts.map((c, i) => (
                <li key={c.id}>{i + 1}. <span className="font-medium">Creative {String.fromCharCode(65 + i)}</span> -- {angleLabel(c.angle)}</li>
              ))}
            </ol>
          )}
          {strategy.rationale && <p className="text-sm text-gray-500">{strategy.rationale}</p>}
        </Card>
      )}

      {/* Creative Pack */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-blue-600" /> Creative Pack ({pack.concepts.length})
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {pack.concepts.map((concept, i) => {
            const busy = busyConceptId === concept.id;
            const err = conceptError[concept.id];
            return (
              <Card key={concept.id} className="flex flex-col">
                <div className="aspect-video bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg mb-3 flex items-center justify-center overflow-hidden">
                  {concept.imageStatus === 'ready' && concept.imageUrl ? (
                    <img src={concept.imageUrl} alt={concept.headline || concept.angle} className="w-full h-full object-cover" />
                  ) : concept.imageStatus === 'generating' ? (
                    <div className="flex flex-col items-center gap-2 text-gray-400 text-xs">
                      <Loader2 className="w-6 h-6 animate-spin" /> Generating image...
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleGenerateImage(concept)}
                      disabled={busy || !pack.productImageUrl}
                      className="flex flex-col items-center gap-2 text-gray-400 hover:text-blue-600 text-xs disabled:opacity-50"
                    >
                      <ImagePlus className="w-8 h-8" />
                      {concept.imageStatus === 'failed' ? 'Retry image generation' : 'Generate AI image'}
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-blue-700">Creative {String.fromCharCode(65 + i)}</span>
                  <Badge variant="info" className="text-xs">{angleLabel(concept.angle)}</Badge>
                </div>
                {concept.targetAudience && <p className="text-xs text-gray-400 mb-1">{concept.targetAudience}</p>}
                <p className="text-sm text-gray-800 font-medium mb-1">"{concept.hook}"</p>
                {concept.headline && <p className="text-sm font-semibold text-gray-900">{concept.headline}</p>}
                {concept.primaryText && <p className="text-sm text-gray-600 whitespace-pre-wrap mt-1 line-clamp-4">{concept.primaryText}</p>}
                {concept.cta && (
                  <span className="inline-block mt-2 px-3 py-1 bg-blue-600 text-white text-xs rounded-lg w-fit">{concept.cta}</span>
                )}

                {err && (
                  <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-2 py-1.5 mt-2">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" /> {err}
                  </div>
                )}

                <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-gray-100">
                  <Button variant="ghost" size="sm" disabled={busy} onClick={() => handleRegenerateField(concept, 'hook')}>
                    <RefreshCw className="w-3.5 h-3.5 mr-1" /> Regenerate hook
                  </Button>
                  <Button variant="ghost" size="sm" disabled={busy} onClick={() => handleRegenerateField(concept, 'copy')}>
                    <RefreshCw className="w-3.5 h-3.5 mr-1" /> Regenerate copy
                  </Button>
                  <Button
                    variant="secondary" size="sm" disabled={busy || addedToCreatives[concept.id]}
                    onClick={() => handleAddToCreatives(concept)}
                  >
                    {addedToCreatives[concept.id] ? <Check className="w-3.5 h-3.5 mr-1 text-emerald-600" /> : <PlusCircle className="w-3.5 h-3.5 mr-1" />}
                    {addedToCreatives[concept.id] ? 'Added' : 'Add to Creatives'}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
