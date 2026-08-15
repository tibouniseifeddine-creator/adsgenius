export type ApiErrorCode =
  | 'BAD_REQUEST' | 'VALIDATION_ERROR' | 'NOT_FOUND' | 'INTERNAL_ERROR' | 'SERVICE_UNAVAILABLE' | 'UNAUTHORIZED' | 'FORBIDDEN' | 'CONFLICT';
export interface ApiError { error: { code: ApiErrorCode; message: string; details?: Record<string, unknown>; requestId: string; }; }
export interface HealthResponse { status: 'ok' | 'degraded'; service: 'adsgenius-api'; version: string; database: 'up' | 'down'; requestId: string; }
export interface Pagination { page: number; pageSize: number; hasNext: boolean; }
export interface ApiCollection<T> { data: T[]; pagination: Pagination; }
export interface WorkspaceSummary { id: string; name: string; slug: string; defaultCountryCode: string; defaultCurrency: string; timezone: string; role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER'; }
export interface AuthUser { id: string; email: string; name: string; }
export interface AuthResponse { user: AuthUser; tokens: { accessToken: string; refreshToken: string; accessExpiresAt: string; refreshExpiresAt: string; }; }
export interface AuthMeResponse { user: AuthUser; workspaces: WorkspaceSummary[]; }
export interface ProductVariant { id: string; productId: string; sku: string | null; name: string; attributes: Record<string, unknown>; baseCost: string | null; salePrice: string | null; stock: number; status: 'ACTIVE' | 'INACTIVE'; createdAt: string; updatedAt: string; }
export interface Product { id: string; workspaceId: string; name: string; description: string; sku: string | null; category: string | null; baseCost: string; salePrice: string; currency: string; stock: number; shippingCost: string; packagingCost: string; expectedCancellationRate: string; expectedReturnRate: string; active: boolean; breakEvenPrice: string | null; expectedNetMargin: string; variants?: ProductVariant[]; createdAt: string; updatedAt: string; }
export interface ProductInput { name: string; description?: string; sku?: string; category?: string; baseCost: number | string; salePrice: number | string; currency?: string; stock?: number; shippingCost?: number | string; packagingCost?: number | string; expectedCancellationRate?: number | string; expectedReturnRate?: number | string; active?: boolean; }
export interface ProductVariantInput { name: string; sku?: string; attributes?: Record<string, unknown>; baseCost?: number | string; salePrice?: number | string; stock?: number; status?: 'ACTIVE' | 'INACTIVE'; }

export type AudienceType = 'BROAD' | 'INTERESTS' | 'CUSTOM' | 'LOOKALIKE' | 'RETARGETING';
export interface Audience { id: string; workspaceId: string; name: string; type: AudienceType; definition: Record<string, unknown>; status: 'ACTIVE' | 'ARCHIVED'; createdAt: string; updatedAt: string; }
export interface AudienceInput { name: string; type: AudienceType; definition?: Record<string, unknown>; status?: 'ACTIVE' | 'ARCHIVED'; }
export type CampaignObjective = 'SALES' | 'LEADS' | 'MESSAGES' | 'TRAFFIC' | 'WEBSITE_CONVERSIONS';
export type CampaignStatus = 'DRAFT' | 'READY' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
export type CampaignBudgetType = 'DAILY' | 'LIFETIME';
export interface Campaign { id: string; workspaceId: string; productId: string | null; name: string; objective: CampaignObjective; status: CampaignStatus; budgetType: CampaignBudgetType; budgetAmount: string; currency: string; startAt: string | null; endAt: string | null; product?: Product | null; adSets: AdSet[]; createdAt: string; updatedAt: string; }
export interface CampaignInput { name: string; productId?: string; objective: CampaignObjective; status?: CampaignStatus; budgetType: CampaignBudgetType; budgetAmount: number | string; currency?: string; startAt?: string; endAt?: string; }
export interface AdSet { id: string; campaignId: string; audienceId: string | null; name: string; status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED'; budgetAmount: string | null; targeting: Record<string, unknown>; placements: Record<string, unknown>; audience?: Audience | null; ads: Ad[]; createdAt: string; updatedAt: string; }
export interface AdSetInput { name: string; audienceId?: string; status?: AdSet['status']; budgetAmount?: number | string; targeting?: Record<string, unknown>; placements?: Record<string, unknown>; }
export interface Ad { id: string; adSetId: string; creativeVersionId: string | null; copyAssetId: string | null; name: string; status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED'; destinationUrl: string | null; trackingConfig: Record<string, unknown>; creativeVersion?: { id: string; version: number; creative: { id: string; name: string; }; } | null; copyAsset?: { id: string; primaryText: string | null; headline: string | null; cta: string | null; } | null; createdAt: string; updatedAt: string; }
export interface AdInput { name: string; creativeVersionId?: string; copyAssetId?: string; status?: Ad['status']; destinationUrl?: string; trackingConfig?: Record<string, unknown>; }
