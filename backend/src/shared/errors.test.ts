import { describe, expect, it } from 'vitest';
import { AppError, toApiError } from './errors.js';

describe('API error model', () => {
  it('creates the documented error envelope', () => {
    const result = toApiError(
      new AppError('VALIDATION_ERROR', 'Invalid input.', 400, { field: 'name' }),
      'req-123',
    );

    expect(result).toEqual({
      status: 400,
      body: {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input.',
          details: { field: 'name' },
          requestId: 'req-123',
        },
      },
    });
  });

  it('does not expose unknown internal errors', () => {
    const result = toApiError(new Error('secret database detail'), 'req-456');

    expect(result.status).toBe(500);
    expect(result.body.error.message).toBe('An unexpected error occurred.');
    expect(result.body.error.message).not.toContain('secret database detail');
  });
});
