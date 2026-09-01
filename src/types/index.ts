export type Language = 'ar' | 'fr' | 'en';
export type UserRole = 'owner' | 'admin' | 'media_buyer' | 'viewer';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  businessId: string;
}

// Mirrors the real fields GET/PATCH /api/workspace return -- see audit
// finding P22. Previously had a "type"/"language" pair that never matched
// any real backend data (dropped here; language is already handled by
// useLanguage(), not by this object).
export interface Business {
  id: string;
  name: string;
  country: string;
  currency: string;
  timezone: string;
}

export interface Product {
  id: string;
  businessId: string;
  name: string;
  sku: string;
  category: string;
  description: string;
  purchaseCost: number;
  sellingPrice: number;
  discountPrice?: number;
  stock: number;
  images: string[];
  videos: string[];
  url?: string;
  deliveryCost: number;
  packagingCost: number;
  expectedCancellationRate: number;
  expectedReturnRate: number;
  aiAnalysis?: ProductAIAnalysis;
}

export interface ProductAIAnalysis {
  productType: string;
  visualCharacteristics: string[];
  colors: string[];
  style: string;
  targetDemographic: { age: string; gender: string };
  sellingPoints: string[];
  advertisingAngles: string[];
  objections: string[];
  positioning?: ProductPositioning;
  targetCustomer?: TargetCustomer;
}

export interface ProductPositioning {
  mainBenefit: string;
  secondaryBenefits: string[];
  usp: string;
  painPoint: string;
  emotionalBenefit: string;
  rationalBenefit: string;
}

export interface TargetCustomer {
  age: string;
  gender: string;
  location: string;
  interests: string[];
  motivations: string[];
  objections: string[];
}

export interface Creative {
  id: string;
  productId: string;
  name: string;
  type: 'image_ad' | 'story' | 'reel' | 'carousel' | 'facebook_feed' | 'instagram_feed' | 'instagram_story' | 'instagram_reel';
  angle: string;
  url?: string;
  hook?: string;
  primaryText?: string;
  headline?: string;
  cta?: string;
  status: 'draft' | 'ready' | 'approved';
  aiScore?: number;
  aiExplanation?: string;
  metrics?: CreativeMetrics;
}

export interface CreativeMetrics {
  spend: number;
  impressions: number;
  ctr: number;
  cpc: number;
  cpm: number;
  orders: number;
  confirmedOrders: number;
  deliveredOrders: number;
  revenue: number;
  profit: number;
  costPerDeliveredOrder: number;
}

export interface CopyVariant {
  id: string;
  type: 'primary_text' | 'headline' | 'description' | 'cta' | 'short_caption' | 'long_caption' | 'story_text' | 'reel_text';
  language: Language;
  content: string;
  angle: string;
}

export interface Audience {
  id: string;
  name: string;
  ageMin: number;
  ageMax: number;
  gender: 'male' | 'female' | 'all';
  location: string[];
  interests: string[];
  explanation: string;
  source?: 'manual' | 'ai';
}

export interface Campaign {
  id: string;
  businessId: string;
  productId: string;
  name: string;
  objective: 'sales' | 'leads' | 'messages' | 'website_conversions';
  destination: 'website' | 'whatsapp' | 'instagram_direct' | 'facebook_messenger';
  budgetType: 'daily' | 'lifetime';
  budget: number;
  audienceIds: string[];
  creativeIds: string[];
  status: 'draft' | 'active' | 'paused' | 'completed';
  startDate?: string;
  endDate?: string;
  metaCampaignId?: string;
  trackingStatus: 'pending' | 'active' | 'error';
}

export interface Order {
  id: string;
  businessId: string;
  customerName: string;
  phone: string;
  wilaya: string;
  commune: string;
  address: string;
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  deliveryFee: number;
  total: number;
  campaignId?: string;
  adId?: string;
  creativeId?: string;
  orderDate: string;
  status: OrderStatus;
  deliveryCompany?: string;
  trackingNumber?: string;
}

export type OrderStatus = 
  | 'new' 
  | 'pending_confirmation' 
  | 'confirmed' 
  | 'preparing' 
  | 'shipped' 
  | 'out_for_delivery' 
  | 'delivered' 
  | 'cancelled' 
  | 'refused' 
  | 'returned';

export interface CampaignMetrics {
  campaignId: string;
  date: string;
  spend: number;
  impressions: number;
  reach: number;
  frequency: number;
  cpm: number;
  ctr: number;
  cpc: number;
  linkClicks: number;
  landingPageViews: number;
  leads: number;
  messages: number;
  orders: number;
  confirmedOrders: number;
  shippedOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  returnedOrders: number;
  revenue: number;
  profit: number;
  roas: number;
  deliveredRoas: number;
  costPerOrder: number;
  costPerConfirmedOrder: number;
  costPerDeliveredOrder: number;
}

export interface AIRecommendation {
  id: string;
  type: 'budget' | 'creative' | 'audience' | 'pause' | 'scale' | 'landing_page';
  title: string;
  description: string;
  reason: string;
  confidence: number;
  requiredData: string;
  expectedImpact: string;
  campaignId?: string;
  status: 'pending' | 'approved' | 'rejected' | 'applied';
}

export interface Integration {
  id: string;
  type: 'meta' | 'shopify' | 'website' | 'delivery';
  provider: string;
  status: 'connected' | 'disconnected' | 'error' | 'mock';
  accountName?: string;
  lastSync?: string;
}

export interface DeliveryProvider {
  id: string;
  name: string;
  apiUrl?: string;
  status: 'active' | 'inactive' | 'mock';
}

export interface Rule {
  id: string;
  name: string;
  conditions: RuleCondition[];
  action: string;
  threshold: number;
  status: 'active' | 'paused';
}

export interface RuleCondition {
  metric: string;
  operator: '>' | '<' | '=' | '>=' | '<=';
  value: number;
}

// ---- AI Creative Pack Engine (Creative Studio "Generate Campaign" flow) ----
// Deliberately named "CreativePack", not "Campaign" -- Campaign above already
// means a real Meta ad campaign (objective/destination/budget). A creative
// pack is the AI-generated bundle of hook/copy/visual concepts for one
// product; a user later hand-picks concepts into an actual Campaign.
export interface CreativePackAnalysis {
  productType: string;
  keyFeatures: string[];
  colors: string[];
  design: string;
  likelyUse: string;
  likelyAudience: string;
  valueProposition: string;
  benefits: string[];
  painPoints: string[];
  objections: string[];
  assumptions: string[];
}

export interface CreativePackStrategy {
  recommendedAngles: string[];
  targetAudience: string;
  recommendedPlatform: string;
  recommendedObjective: string;
  rationale: string;
}

export interface CreativePackConceptItem {
  id: string;
  index: number;
  angle: string;
  hook: string;
  primaryText: string;
  headline: string;
  cta: string;
  visualConcept: string;
  targetAudience: string;
  imageUrl?: string;
  imageStatus: 'pending' | 'generating' | 'ready' | 'failed';
  imageError?: string;
}

export interface CreativePackItem {
  id: string;
  productName: string;
  productImageUrl?: string;
  category?: string;
  targetAudience?: string;
  country?: string;
  language: 'ar' | 'fr' | 'en';
  sellingPrice?: number;
  currency?: string;
  mainBenefit?: string;
  websiteUrl?: string;
  analysis?: CreativePackAnalysis;
  strategy?: CreativePackStrategy;
  status: 'draft' | 'saved';
  createdAt: string;
  updatedAt: string;
  concepts: CreativePackConceptItem[];
}
