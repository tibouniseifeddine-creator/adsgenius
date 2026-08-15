import type {
  ApiError,
  AuthMeResponse,
  AuthResponse,
  HealthResponse,
  Product,
  ProductInput,
  ProductVariant,
  ProductVariantInput,
} from '@adsgenius/shared-types';

export interface ApiClientOptions {
  baseUrl: string;
  fetchImpl?: typeof fetch;
}

export class ApiClientError extends Error {
  readonly payload: ApiError;
  readonly status: number;

  constructor(status: number, payload: ApiError) {
    super(payload.error.message);
    this.name = 'ApiClientError';
    this.status = status;
    this.payload = payload;
  }
}

export class ApiClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      ...init,
      credentials: 'include',
      headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
    });
    const body = response.status === 204 ? undefined : await response.json();
    if (!response.ok) throw new ApiClientError(response.status, body as ApiError);
    return body as T;
  }

  async health(): Promise<HealthResponse> {
    return this.request<HealthResponse>('/api/v1/health');
  }

  async register(input: { email: string; password: string; name: string; workspaceName: string }): Promise<AuthResponse> {
    return this.request<AuthResponse>('/api/v1/auth/register', { method: 'POST', body: JSON.stringify(input) });
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    return this.request<AuthResponse>('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  }

  async refresh(): Promise<AuthResponse['tokens']> {
    return this.request<AuthResponse['tokens']>('/api/v1/auth/refresh', { method: 'POST' });
  }

  async logout(): Promise<void> {
    await this.request('/api/v1/auth/logout', { method: 'POST' });
  }

  async me(): Promise<AuthMeResponse> {
    return this.request<AuthMeResponse>('/api/v1/auth/me');
  }

  async listProducts(workspaceId: string, search?: string): Promise<Product[]> {
    const query = search?.trim() ? `?search=${encodeURIComponent(search.trim())}` : '';
    const result = await this.request<{ data: Product[] }>(`/api/v1/workspaces/${workspaceId}/products${query}`);
    return result.data;
  }

  async getProduct(workspaceId: string, productId: string): Promise<Product> {
    return this.request<Product>(`/api/v1/workspaces/${workspaceId}/products/${productId}`);
  }

  async createProduct(workspaceId: string, input: ProductInput): Promise<Product> {
    return this.request<Product>(`/api/v1/workspaces/${workspaceId}/products`, { method: 'POST', body: JSON.stringify(input) });
  }

  async updateProduct(workspaceId: string, productId: string, input: Partial<ProductInput>): Promise<Product> {
    return this.request<Product>(`/api/v1/workspaces/${workspaceId}/products/${productId}`, { method: 'PATCH', body: JSON.stringify(input) });
  }

  async deleteProduct(workspaceId: string, productId: string): Promise<void> {
    await this.request(`/api/v1/workspaces/${workspaceId}/products/${productId}`, { method: 'DELETE' });
  }

  async createVariant(workspaceId: string, productId: string, input: ProductVariantInput): Promise<ProductVariant> {
    return this.request<ProductVariant>(`/api/v1/workspaces/${workspaceId}/products/${productId}/variants`, { method: 'POST', body: JSON.stringify(input) });
  }
}
