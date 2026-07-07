import { describe, expect, it } from 'vitest';
import {
  categorizeError,
  getFriendlyErrorMessage,
  handleSupabaseError,
  SupabaseErrorType,
} from './api-error-handler';

describe('api-error-handler', () => {
  it('categorizes duplicate key errors as database errors with a useful message', () => {
    const error = {
      code: '23505',
      message: 'duplicate key value violates unique constraint',
      details: 'Key (student_id)=(S-001) already exists.',
    };

    expect(categorizeError(error)).toBe(SupabaseErrorType.DATABASE);
    expect(getFriendlyErrorMessage(error, 'Create student')).toBe(
      'This record already exists. Please use a different value.'
    );
  });

  it('categorizes PGRST116 as not found instead of permission denied', () => {
    const error = {
      code: 'PGRST116',
      message: 'JSON object requested, multiple (or no) rows returned',
    };

    const notice = handleSupabaseError('Load profile', error, { log: false });

    expect(notice.type).toBe(SupabaseErrorType.NOT_FOUND);
    expect(notice.title).toBe('Record not found');
  });

  it('returns permission guidance for row-level security failures', () => {
    const error = {
      code: '42501',
      message: 'new row violates row-level security policy',
    };

    const notice = handleSupabaseError('Create class', error, { log: false });

    expect(notice.type).toBe(SupabaseErrorType.AUTHORIZATION);
    expect(notice.description).toContain('do not have permission');
  });
});
