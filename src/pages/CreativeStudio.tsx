import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { CreativePackItem } from '../types';
import { CreativePackGenerator } from '../components/creative-studio/CreativePackGenerator';
import { CreativePackResults } from '../components/creative-studio/CreativePackResults';
import { ManualCreatives } from '../components/creative-studio/ManualCreatives';

// Redesigned Creative Studio: "Give AdsGenius your product. Let AI build your
// creative testing campaign." The AI Creative Pack tab (default) is the new
// upload-photo-and-name -> full creative pack flow. The original hand-entry
// flow is preserved as-is under "Manual Creative" so nothing existing breaks
// -- see ManualCreatives.tsx (moved out of this file unchanged) and
// CreativePackGenerator.tsx / CreativePackResults.tsx for the new flow.
export function CreativeStudio() {
  const { t } = useLanguage();
  const [mainTab, setMainTab] = useState<'ai' | 'manual'>('ai');
  const [activePack, setActivePack] = useState<CreativePackItem | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('creativeStudio')}</h1>
        <p className="text-sm text-gray-500 mt-1">Give AdsGenius your product. Let AI build your creative testing campaign.</p>
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setMainTab('ai')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${mainTab === 'ai' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          AI Creative Pack
        </button>
        <button
          onClick={() => setMainTab('manual')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${mainTab === 'manual' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Manual Creative
        </button>
      </div>

      {mainTab === 'ai' && (
        activePack ? (
          <CreativePackResults pack={activePack} onUpdate={setActivePack} onBack={() => setActivePack(null)} />
        ) : (
          <CreativePackGenerator onGenerated={setActivePack} />
        )
      )}

      {mainTab === 'manual' && <ManualCreatives />}
    </div>
  );
}
