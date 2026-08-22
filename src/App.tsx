import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { Dashboard } from './pages/Dashboard';
import { Products } from './pages/Products';
import { ProductAnalysis } from './pages/ProductAnalysis';
import { CreativeStudio } from './pages/CreativeStudio';
import { Copywriter } from './pages/Copywriter';
import { AudienceLab } from './pages/AudienceLab';
import { Campaigns } from './pages/Campaigns';
import { CampaignBuilder } from './pages/CampaignBuilder';
import { Orders } from './pages/Orders';
import { Analytics } from './pages/Analytics';
import { AIOptimizer } from './pages/AIOptimizer';
import { Integrations } from './pages/Integrations';
import { Settings } from './pages/Settings';
import { Auth } from './pages/Auth';
import { PublicOrderPage } from './pages/PublicOrderPage';
import { useAuth } from './contexts/AuthContext';

function ProtectedApp() {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500">جارٍ التحقق من الجلسة...</div>;
  if (!isAuthenticated) return <Navigate to="/auth" replace />;
  return <Layout><Routes>
    <Route path="/" element={<Dashboard />} />
    <Route path="/products" element={<Products />} />
    <Route path="/products/:id" element={<ProductAnalysis />} />
    <Route path="/creative-studio" element={<CreativeStudio />} />
    <Route path="/copywriter" element={<Copywriter />} />
    <Route path="/audiences" element={<AudienceLab />} />
    <Route path="/campaigns" element={<Campaigns />} />
    <Route path="/campaign-builder" element={<CampaignBuilder />} />
    <Route path="/orders" element={<Orders />} />
    <Route path="/analytics" element={<Analytics />} />
    <Route path="/ai-optimizer" element={<AIOptimizer />} />
    <Route path="/integrations" element={<Integrations />} />
    <Route path="/settings" element={<Settings />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes></Layout>;
}

function App() {
  return <BrowserRouter><Routes>
    <Route path="/auth" element={<Auth />} />
    <Route path="/order/:productId" element={<PublicOrderPage />} />
    <Route path="*" element={<ProtectedApp />} />
  </Routes></BrowserRouter>;
}

export default App;
