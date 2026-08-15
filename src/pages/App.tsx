import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { Dashboard } from './Dashboard';
import { Products } from './Products';
import { ProductAnalysis } from './ProductAnalysis';
import { CreativeStudio } from './CreativeStudio';
import { Copywriter } from './Copywriter';
import { AudienceLab } from './AudienceLab';
import { Campaigns } from './Campaigns';
import { CampaignBuilder } from './CampaignBuilder';
import { Orders } from './Orders';
import { Analytics } from './Analytics';
import { AIOptimizer } from './AIOptimizer';
import { Integrations } from './Integrations';
import { Settings } from './Settings';
import { Login } from './Login';
import { useAuth } from '../contexts/AuthContext';
function PrivateRoute({ children }: { children: React.ReactNode }) { const { isAuthenticated, loading } = useAuth(); if (loading) return <div className="min-h-screen flex items-center justify-center">جاري التحميل...</div>; return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />; }
function App() { const { isAuthenticated } = useAuth(); return <BrowserRouter><Routes><Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <Login />} /><Route path="/*" element={<PrivateRoute><Layout><Routes><Route path="/" element={<Dashboard />} /><Route path="/products" element={<Products />} /><Route path="/products/:id" element={<ProductAnalysis />} /><Route path="/creative-studio" element={<CreativeStudio />} /><Route path="/copywriter" element={<Copywriter />} /><Route path="/audiences" element={<AudienceLab />} /><Route path="/campaigns" element={<Campaigns />} /><Route path="/campaign-builder" element={<CampaignBuilder />} /><Route path="/orders" element={<Orders />} /><Route path="/analytics" element={<Analytics />} /><Route path="/ai-optimizer" element={<AIOptimizer />} /><Route path="/integrations" element={<Integrations />} /><Route path="/settings" element={<Settings />} /></Routes></Layout></PrivateRoute>} /></Routes></BrowserRouter>; }
export default App;
