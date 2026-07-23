import { describe, expect, it } from 'vitest';
import { resolveApiMode } from './provider';

describe('API mode configuration migration', () => {
  it('prefers VITE_API_MODE when both configuration names exist', () => {
    expect(resolveApiMode('mysql', 'php')).toBe('mysql');
    expect(resolveApiMode('future-mode', 'php')).toBe('future-mode');
  });

  it('maps the legacy PHP provider value to MySQL mode', () => {
    expect(resolveApiMode(undefined, 'php')).toBe('mysql');
  });

  it('defaults to the existing MySQL API behavior', () => {
    expect(resolveApiMode()).toBe('mysql');
  });
});
