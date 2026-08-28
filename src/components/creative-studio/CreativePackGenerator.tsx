import React, { useCallback, useRef, useState } from 'react';
import { Upload, X, Sparkles, Loader2, AlertTriangle, Check, Circle } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card } from '../ui/Card';
import { apiFetch } from '../../lib/api';
import { CreativePackItem } from '../../types';

// Resizes/compresses the photo entirely in the browser before it ever leaves
// the device: phone camera photos are routinely 5-10MB, which would blow
// past both Express's JSON body limit and Vercel's own request-size limit
// once base64-encoded. 1600px + JPEG @ 0.85 keeps almost all product photos
// comfortably under ~1MB while staying sharp enough for both the AI vision
// analysis and any AI image editing done later.
async function resizeImageFile(file: File, maxDim = 1600, quality = 0.85): Promise<string> {
  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Could not read the file'));
    reader.readAsDataURL(file);
  });

  const img = document.createElement('img');
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Could not read this image'));
    img.src = rawDataUrl;
  });

  let { width, height } = img;
  if (width > maxDim || height > maxDim) {
    if (width > height) {
      height = Math.round(height * (maxDim / width));
      width = maxDim;
    } else {
      width = Math.round(width * (maxDim / height));
      height = maxDim;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return rawDataUrl; // Canvas unsupported -- fall back to the original.
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', quality);
}

type Stage = 'idle' | 'analyzing' | 'analyzed' | 'concepts' | 'done' | 'error';

interface Props {
  onGenerated: (pack: CreativePackItem) => void;
}

// Step 1 of the AI Creative Pack flow: "Upload -> Name -> Generate" (see the
// redesign spec). Everything else (category/audience/price/...) is optional
// and collapsed by default so a first-time user can get a result from just a
// photo and a name, exactly as requested.
export function CreativePackGenerator({ onGenerated }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const [productName, setProductName] = useState('');
  const [category, setCategory] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [country, setCountry] = useState('');
  const [language, setLanguage] = useState<'ar' | 'fr' | 'en'>('ar');
  const [sellingPrice, setSellingPrice] = useState('');
  const [currency, setCurrency] = useState('DZD');
  const [mainBenefit, setMainBenefit] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [showOptional, setShowOptional] = useState(false);

  const [stage, setStage] = useState<Stage>('idle');
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File | null | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setImageError('Please choose an image file');
      return;
    }
    setImageError(null);
    try {
      setImagePreview(await resizeImageFile(file));
    } catch {
      setImageError('Could not read this image -- try another file');
    }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files?.[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const generating = stage === 'analyzing' || stage === 'concepts';

  const handleGenerate = async () => {
    if (!imagePreview) {
      setError('Upload a product photo first.');
      return;
    }
    if (!productName.trim()) {
      setError('Give your product a name first.');
      return;
    }
    setError(null);
    setStage('analyzing');
    try {
      const { creativePack } = await apiFetch<{ creativePack: CreativePackItem }>('/api/creative-packs/analyze', {
        body: {
          productImage: imagePreview,
          productName: productName.trim(),
          category: category.trim() || undefined,
          targetAudience: targetAudience.trim() || undefined,
          country: country.trim() || undefined,
          language,
          sellingPrice: sellingPrice ? Number(sellingPrice) : undefined,
          currency: sellingPrice ? currency.trim() || 'DZD' : undefined,
          mainBenefit: mainBenefit.trim() || undefined,
          websiteUrl: websiteUrl.trim() || undefined
        }
      });
      setStage('concepts');
      const { creativePack: withConcepts } = await apiFetch<{ creativePack: CreativePackItem }>(
        `/api/creative-packs/${creativePack.id}/concepts`,
        { body: {} }
      );
      setStage('done');
      onGenerated(withConcepts);
    } catch (e) {
      setStage('error');
      setError(e instanceof Error ? e.message : 'Failed to generate campaign');
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card>
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Upload Product photo *</label>
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => handleFile(e.target.files?.[0])}
              />
              {imagePreview ? (
                <div className="relative inline-block">
                  <img src={imagePreview} alt="Product preview" className="max-h-56 mx-auto rounded-lg object-contain" />
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); setImagePreview(null); }}
                    className="absolute -top-2 -right-2 bg-white border border-gray-300 rounded-full p-1 shadow hover:bg-gray-50"
                    title="Remove photo"
                  >
                    <X className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-gray-500">
                  <Upload className="w-8 h-8" />
                  <p className="text-sm">Drag &amp; drop a product photo, or tap to choose one</p>
                  <p className="text-xs text-gray-400">JPEG, PNG or WEBP</p>
                </div>
              )}
            </div>
            {imageError && <p className="text-sm text-red-600 mt-2">{imageError}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">What is your product called? *</label>
            <Input value={productName} onChange={e => setProductName(e.target.value)} placeholder="e.g. Robe Homme Premium" />
          </div>

          <button
            type="button"
            onClick={() => setShowOptional(v => !v)}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            {showOptional ? 'Hide optional details' : '+ Add optional details (category, audience, price...)'}
          </button>

          {showOptional && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 rounded-lg p-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Product category</label>
                <Input value={category} onChange={e => setCategory(e.target.value)} placeholder="e.g. Menswear" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Target audience</label>
                <Input value={targetAudience} onChange={e => setTargetAudience(e.target.value)} placeholder="e.g. Men 20-35" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Country / market</label>
                <Input value={country} onChange={e => setCountry(e.target.value)} placeholder="e.g. Algeria" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Language for the ad copy</label>
                <select
                  value={language}
                  onChange={e => setLanguage(e.target.value as 'ar' | 'fr' | 'en')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ar">العربية</option>
                  <option value="fr">Français</option>
                  <option value="en">English</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Selling price</label>
                <div className="flex gap-2">
                  <Input value={sellingPrice} onChange={e => setSellingPrice(e.target.value)} placeholder="e.g. 6490" type="number" />
                  <Input value={currency} onChange={e => setCurrency(e.target.value)} placeholder="DZD" className="w-20" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Main benefit</label>
                <Input value={mainBenefit} onChange={e => setMainBenefit(e.target.value)} placeholder="e.g. Keeps you warm all winter" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs text-gray-500 mb-1">Website / landing page (optional)</label>
                <Input value={websiteUrl} onChange={e => setWebsiteUrl(e.target.value)} placeholder="https://..." />
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <Button onClick={handleGenerate} disabled={generating} className="w-full" size="lg">
            {generating ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Sparkles className="w-5 h-5 mr-2" />}
            {generating ? 'Generating your creative pack...' : 'Generate Campaign'}
          </Button>
        </div>
      </Card>

      {stage !== 'idle' && (
        <Card>
          <div className="space-y-2.5 text-sm">
            <ProgressRow
              label="Product analyzed from the photo"
              state={stage === 'analyzing' ? 'active' : stage === 'error' ? 'pending' : 'done'}
            />
            <ProgressRow
              label="Marketing strategy & angles created"
              state={stage === 'analyzing' ? 'active' : stage === 'error' ? 'pending' : 'done'}
            />
            <ProgressRow
              label="Hooks & ad copy concepts generated"
              state={stage === 'concepts' ? 'active' : stage === 'done' ? 'done' : stage === 'error' ? 'pending' : 'pending'}
            />
            <ProgressRow label="AI image creatives -- generate per concept on the results page next" state="pending" muted />
            <ProgressRow label="AI video concepts -- not available yet" state="pending" muted />
          </div>
        </Card>
      )}
    </div>
  );
}

function ProgressRow({ label, state, muted }: { label: string; state: 'pending' | 'active' | 'done'; muted?: boolean }) {
  return (
    <div className={`flex items-center gap-2 ${muted ? 'text-gray-400' : 'text-gray-700'}`}>
      {state === 'done' && <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />}
      {state === 'active' && <Loader2 className="w-4 h-4 text-blue-600 animate-spin flex-shrink-0" />}
      {state === 'pending' && <Circle className="w-3 h-3 text-gray-300 flex-shrink-0 mx-0.5" />}
      <span className={state === 'done' ? 'text-gray-900' : ''}>{label}</span>
    </div>
  );
}
