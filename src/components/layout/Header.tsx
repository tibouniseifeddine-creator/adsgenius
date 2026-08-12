import React from 'react';
import { Globe, Bell, Sparkles, Menu } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useDemo } from '../../contexts/DemoContext';
import { Badge } from '../ui/Badge';
import { useSidebar } from './Layout';

export function Header() {
  const { language, setLanguage, isRTL } = useLanguage();
  const { isDemoMode } = useDemo();
  const { sidebarOpen, setSidebarOpen } = useSidebar();

  return (
    <header className={`h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 md:px-6 fixed top-0 ${isRTL ? 'right-0 md:right-64 left-0' : 'left-0 md:left-64 right-0'} z-30 transition-all duration-300`}>
      <div className="flex items-center gap-3">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="md:hidden p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
        >
          <Menu className="w-5 h-5" />
        </button>
        {isDemoMode && (
          <Badge variant="warning" className="flex items-center gap-1 text-xs">
            <Sparkles className="w-3 h-3" />DEMO MODE
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-3">
        <button className="relative p-2 text-gray-500 hover:text-gray-700">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
        </button>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {(['ar', 'fr', 'en'] as const).map(lang => (
            <button key={lang} onClick={() => setLanguage(lang)}
              className={`px-2 md:px-3 py-1 text-xs font-medium rounded-md transition-colors ${language === lang ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {lang === 'ar' ? 'العربية' : lang === 'fr' ? 'FR' : 'EN'}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
