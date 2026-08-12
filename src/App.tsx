import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
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

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
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
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
