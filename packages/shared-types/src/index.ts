export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE';

export interface ApiError {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: Record<string, unknown>;
    requestId: string;
  };
}

export interface HealthResponse {
  status: 'ok' | 'degraded';
  service: 'adsgenius-api';
  version: string;
  database: 'up' | 'down';
  requestId: string;
}

export interface Pagination {
  page: number;
  pageSize: number;
  hasNext: boolean;
}

export interface ApiCollection<T> {
  data: T[];
  pagination: Pagination;
}
