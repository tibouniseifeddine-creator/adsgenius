import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Package, Palette, Megaphone, Users,
  ShoppingCart, BarChart3, Brain, Plug, Settings, LogOut, X
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { useSidebar } from './Layout';

const navItems = [
  { path: '/', icon: LayoutDashboard, key: 'dashboard' },
  { path: '/products', icon: Package, key: 'products' },
  { path: '/creative-studio', icon: Palette, key: 'creativeStudio' },
  { path: '/campaigns', icon: Megaphone, key: 'campaigns' },
  { path: '/audiences', icon: Users, key: 'audiences' },
  { path: '/orders', icon: ShoppingCart, key: 'orders' },
  { path: '/analytics', icon: BarChart3, key: 'analytics' },
  { path: '/ai-optimizer', icon: Brain, key: 'aiOptimizer' },
  { path: '/integrations', icon: Plug, key: 'integrations' },
  { path: '/settings', icon: Settings, key: 'settings' },
];

export function Sidebar() {
  const { t, isRTL } = useLanguage();
  const { logout } = useAuth();
  const { sidebarOpen, setSidebarOpen } = useSidebar();
  const location = useLocation();

  return (
    <>
      {/* Mobile overlay backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside
        className={`w-64 bg-slate-900 text-white flex flex-col h-screen fixed top-0 z-50 transition-transform duration-300 md:translate-x-0
          ${isRTL ? 'right-0' : 'left-0'}
          ${sidebarOpen ? 'translate-x-0' : isRTL ? 'translate-x-full md:translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        <div className="p-4 md:p-6 border-b border-slate-700 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-blue-400">AdsGenius</h1>
            <p className="text-xs text-slate-400 mt-1">AI Media Buyer</p>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden p-2 text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto py-4">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center px-4 md:px-6 py-3 text-sm transition-colors ${
                  isActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className={`w-5 h-5 flex-shrink-0 ${isRTL ? 'ml-3' : 'mr-3'}`} />
                <span>{t(item.key as any)}</span>
              </NavLink>
            );
          })}
        </nav>
        <div className="p-4 border-t border-slate-700">
          <button onClick={logout}
            className="flex items-center w-full px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
            <LogOut className={`w-5 h-5 flex-shrink-0 ${isRTL ? 'ml-3' : 'mr-3'}`} />{t('logout')}
          </button>
        </div>
      </aside>
    </>
  );
}
