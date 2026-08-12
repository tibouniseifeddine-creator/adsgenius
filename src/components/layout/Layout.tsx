import React, { useState, createContext, useContext } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useLanguage } from '../../contexts/LanguageContext';

const SidebarContext = createContext<{ sidebarOpen: boolean; setSidebarOpen: (v: boolean) => void }>({ sidebarOpen: false, setSidebarOpen: () => {} });
export const useSidebar = () => useContext(SidebarContext);

export function Layout({ children }: { children: React.ReactNode }) {
  const { isRTL } = useLanguage();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return (
    <SidebarContext.Provider value={{ sidebarOpen, setSidebarOpen }}>
      <div className={`min-h-screen bg-gray-50 ${isRTL ? 'font-arabic' : 'font-sans'}`}>
        <Sidebar />
        <div className={`transition-all duration-300 ${isRTL ? 'md:mr-64' : 'md:ml-64'}`}>
          <Header />
          <main className="pt-16 p-4 md:p-6 min-h-screen relative">
            {sidebarOpen && (
              <div
                className="fixed inset-0 bg-black/40 z-30 md:hidden"
                onClick={() => setSidebarOpen(false)}
              />
            )}
            {children}
          </main>
        </div>
      </div>
    </SidebarContext.Provider>
  );
}
