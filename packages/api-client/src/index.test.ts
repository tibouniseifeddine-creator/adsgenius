import { describe, expect, it } from 'vitest';
import { ApiClient, ApiClientError } from './index.js';

describe('ApiClient', () => {
  it('calls the versioned health endpoint', async () => {
    const client = new ApiClient({
      baseUrl: 'http://localhost:3000',
      fetchImpl: async (input) => {
        expect(input).toBe('http://localhost:3000/api/v1/health');
        return new Response(
          JSON.stringify({
            status: 'ok',
            service: 'adsgenius-api',
            version: '0.1.0',
            database: 'up',
            requestId: 'test-request',
          }),
          { status: 200 },
        );
      },
    });

    await expect(client.health()).resolves.toMatchObject({ status: 'ok', database: 'up' });
  });

  it('normalizes API failures as ApiClientError', async () => {
    const client = new ApiClient({
      baseUrl: 'http://localhost:3000',
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            error: {
              code: 'SERVICE_UNAVAILABLE',
              message: 'Database unavailable.',
              requestId: 'test-request',
            },
          }),
          { status: 503 },
        ),
    });

    await expect(client.health()).rejects.toBeInstanceOf(ApiClientError);
  });
});
