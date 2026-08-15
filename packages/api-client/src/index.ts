import type { ApiError, HealthResponse } from '@adsgenius/shared-types';

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

  async health(): Promise<HealthResponse> {
    const response = await this.fetchImpl(`${this.baseUrl}/api/v1/health`);
    const body = (await response.json()) as HealthResponse | ApiError;

    if (!response.ok) {
      throw new ApiClientError(response.status, body as ApiError);
    }

    return body as HealthResponse;
  }
}
