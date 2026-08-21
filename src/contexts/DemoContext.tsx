import React, { createContext, useContext, useState } from 'react';
import { Product, Campaign, Order, Creative, Audience, AIRecommendation, CampaignMetrics, Integration } from '../types';
import * as demoData from '../data/demoData';

interface DemoContextType {
  isDemoMode: boolean;
  toggleDemoMode: () => void;
  products: Product[];
  campaigns: Campaign[];
  orders: Order[];
  creatives: Creative[];
  audiences: Audience[];
  recommendations: AIRecommendation[];
  metrics: CampaignMetrics[];
  integrations: Integration[];
  addProduct: (product: Product) => void;
  updateOrderStatus: (orderId: string, status: string) => void;
  approveRecommendation: (recId: string) => void;
  rejectRecommendation: (recId: string) => void;
}

const DemoContext = createContext<DemoContextType | undefined>(undefined);

// Demo mode is OFF by default. A real, authenticated account must never be shown
// seeded/fake business data as if it were their own -- that was the previous
// behavior (isDemoMode defaulted to true and every list below was pre-seeded from
// demoData regardless of who was logged in). Sample data is now only loaded when
// the user explicitly opts in via toggleDemoMode (see Header's "Try Demo Data").
export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [creatives, setCreatives] = useState<Creative[]>([]);
  const [audiences, setAudiences] = useState<Audience[]>([]);
  const [recommendations, setRecommendations] = useState<AIRecommendation[]>([]);
  const [metrics, setMetrics] = useState<CampaignMetrics[]>([]);
  const [integrations, setIntegrations] = useState<Integration[]>([]);

  const toggleDemoMode = () => {
    const next = !isDemoMode;
    setIsDemoMode(next);
    if (next) {
      // Load the bundled sample dataset for a preview -- this is not the user's real data.
      setProducts([demoData.demoProduct]);
      setCampaigns([demoData.demoCampaign]);
      setOrders(demoData.demoOrders);
      setCreatives(demoData.demoCreatives);
      setAudiences(demoData.demoAudiences);
      setRecommendations(demoData.demoRecommendations);
      setMetrics(demoData.demoCampaignMetrics);
      setIntegrations(demoData.demoIntegrations);
    } else {
      // Back to the account's real (currently empty, pending backend integration) data.
      setProducts([]);
      setCampaigns([]);
      setOrders([]);
      setCreatives([]);
      setAudiences([]);
      setRecommendations([]);
      setMetrics([]);
      setIntegrations([]);
    }
  };

  const addProduct = (product: Product) => {
    setProducts(prev => [...prev, product]);
  };

  const updateOrderStatus = (orderId: string, status: string) => {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: status as any } : o));
  };

  const approveRecommendation = (recId: string) => {
    setRecommendations(prev => prev.map(r => r.id === recId ? { ...r, status: 'approved' as any } : r));
  };

  const rejectRecommendation = (recId: string) => {
    setRecommendations(prev => prev.map(r => r.id === recId ? { ...r, status: 'rejected' as any } : r));
  };

  return (
    <DemoContext.Provider value={{
      isDemoMode, toggleDemoMode, products, campaigns, orders, creatives, audiences,
      recommendations, metrics, integrations, addProduct, updateOrderStatus, approveRecommendation, rejectRecommendation
    }}>
      {children}
    </DemoContext.Provider>
  );
}

export function useDemo() {
  const context = useContext(DemoContext);
  if (!context) throw new Error('useDemo must be used within DemoProvider');
  return context;
}
