import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  logMySqlError,
  sanitizedError,
  setRequestUserRole,
  withRequestContext,
} from './monitoring';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('API monitoring', () => {
  it('keeps only safe MySQL error metadata', () => {
    const error = Object.assign(new Error('SQL with private@example.com and password'), {
      code: 'ER_BAD_FIELD_ERROR',
      errno: 1054,
      sqlState: '42S22',
      sql: 'SELECT secret FROM users',
    });

    expect(sanitizedError(error)).toEqual({
      name: 'Error',
      code: 'ER_BAD_FIELD_ERROR',
      errno: 1054,
      sqlState: '42S22',
    });
  });

  it('logs request, endpoint, and role context without SQL text', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const error = Object.assign(new Error('sensitive database message'), {
      code: 'ER_PARSE_ERROR',
      sql: 'SELECT password_hash FROM users',
    });

    await withRequestContext(
      { requestId: 'request-123', endpoint: '/tables/users', method: 'GET' },
      async () => {
        setRequestUserRole('super_admin');
        logMySqlError(error, 'query');
      },
    );

    const logged = String(spy.mock.calls[0][0]);
    expect(logged).toContain('"request_id":"request-123"');
    expect(logged).toContain('"endpoint":"/tables/users"');
    expect(logged).toContain('"user_role":"super_admin"');
    expect(logged).not.toContain('password_hash');
    expect(logged).not.toContain('sensitive database message');
  });
});
