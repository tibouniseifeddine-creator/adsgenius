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

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [isDemoMode, setIsDemoMode] = useState(true);
  const [products, setProducts] = useState<Product[]>([demoData.demoProduct]);
  const [campaigns] = useState<Campaign[]>([demoData.demoCampaign]);
  const [orders, setOrders] = useState<Order[]>(demoData.demoOrders);
  const [creatives] = useState<Creative[]>(demoData.demoCreatives);
  const [audiences] = useState<Audience[]>(demoData.demoAudiences);
  const [recommendations, setRecommendations] = useState<AIRecommendation[]>(demoData.demoRecommendations);
  const [metrics] = useState<CampaignMetrics[]>(demoData.demoCampaignMetrics);
  const [integrations] = useState<Integration[]>(demoData.demoIntegrations);

  const toggleDemoMode = () => setIsDemoMode(!isDemoMode);

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
