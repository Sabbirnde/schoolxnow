const legacyBackendProvider = import.meta.env.VITE_BACKEND_PROVIDER;

export function resolveApiMode(configuredMode?: string, legacyProvider?: string) {
  return configuredMode || (legacyProvider === 'php' ? 'mysql' : legacyProvider) || 'mysql';
}

export const apiMode = resolveApiMode(import.meta.env.VITE_API_MODE, legacyBackendProvider);

export const isMysqlApi = apiMode === 'mysql';

/** @deprecated Use apiMode/isMysqlApi. Kept temporarily for source compatibility. */
export const backendProvider = apiMode;
/** @deprecated Use isMysqlApi. Kept temporarily for source compatibility. */
export const isPhpBackend = isMysqlApi;
