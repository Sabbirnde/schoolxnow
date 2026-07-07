/**
 * Secure Configuration Manager
 *
 * Provides safe access to client-side backend configuration without printing
 * sensitive or deployment-specific values in logs.
 */

const credentials = {
  apiUrl: import.meta.env.VITE_API_URL || '',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringifySafely(value: unknown): string {
  try {
    return typeof value === 'string' ? value : JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function redactString(value: string, visibleChars: number = 4): string {
  if (!value || value.length <= visibleChars * 2) {
    return '[REDACTED]';
  }

  const start = value.substring(0, visibleChars);
  const end = value.substring(value.length - visibleChars);
  const middle = '*'.repeat(Math.min(8, value.length - visibleChars * 2));

  return `${start}${middle}${end}`;
}

export function maskUrl(url: string): string {
  try {
    const urlObj = new URL(url, window.location.origin);
    if (url.startsWith('/')) return url;

    const hostParts = urlObj.hostname.split('.');
    if (hostParts.length > 2) {
      hostParts[0] = `${hostParts[0].substring(0, 4)}***`;
    }

    return `${urlObj.protocol}//${hostParts.join('.')}${urlObj.pathname === '/' ? '' : urlObj.pathname}`;
  } catch {
    return '[INVALID_URL]';
  }
}

export class SecureConfig {
  static getApiUrl(): string {
    return credentials.apiUrl;
  }

  static getSafeApiUrl(): string {
    return credentials.apiUrl.startsWith('http') ? maskUrl(credentials.apiUrl) : credentials.apiUrl;
  }

  static isConfigured(): boolean {
    return !!credentials.apiUrl;
  }

  static validate(): {
    isValid: boolean;
    errors: string[];
    safeInfo: Record<string, string>;
  } {
    const errors: string[] = [];
    const safeInfo: Record<string, string> = {
      Backend: 'php',
      Environment: import.meta.env.MODE,
      'Dev Mode': import.meta.env.DEV ? 'Yes' : 'No',
    };

    if (!credentials.apiUrl) {
      errors.push('Missing VITE_API_URL');
    } else {
      safeInfo['API URL'] = this.getSafeApiUrl();

      try {
        if (!credentials.apiUrl.startsWith('/')) {
          const urlObj = new URL(credentials.apiUrl);
          if (!urlObj.protocol.startsWith('http')) {
            errors.push('VITE_API_URL must use HTTP/HTTPS protocol or a relative /api path');
          }
        }
      } catch {
        errors.push('VITE_API_URL format is invalid');
      }

      if (credentials.apiUrl.includes('your-') || credentials.apiUrl.includes('example')) {
        errors.push('VITE_API_URL contains placeholder values');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      safeInfo,
    };
  }

  static sanitizeError(error: unknown): unknown {
    if (!error) return error;

    const sanitized: Record<string, unknown> = isRecord(error)
      ? { ...error }
      : error instanceof Error
        ? { name: error.name, message: error.message }
        : { message: String(error) };

    const errorStr = stringifySafely(error);

    if (credentials.apiUrl && errorStr.includes(credentials.apiUrl)) {
      sanitized._containsApiUrl = true;
      sanitized.safeApiUrl = this.getSafeApiUrl();
    }

    if (typeof sanitized.message === 'string' && credentials.apiUrl) {
      sanitized.message = sanitized.message.replace(
        new RegExp(escapeRegExp(credentials.apiUrl), 'g'),
        this.getSafeApiUrl()
      );
    }

    return sanitized;
  }

  static getConfigReport(): {
    configured: boolean;
    apiUrl: string;
    environment: string;
    warnings: string[];
  } {
    const validation = this.validate();
    const warnings: string[] = [];

    if (import.meta.env.DEV && !validation.isValid) {
      warnings.push('Configuration is incomplete - see errors for details');
    }

    if (import.meta.env.PROD && !validation.isValid) {
      warnings.push('PRODUCTION: Invalid configuration detected');
    }

    return {
      configured: validation.isValid,
      apiUrl: this.getSafeApiUrl(),
      environment: import.meta.env.MODE,
      warnings: validation.errors.length > 0 ? validation.errors : warnings,
    };
  }
}

export function printSafeConfigReport(): void {
  const report = SecureConfig.getConfigReport();

  console.group('Secure Configuration Report');
  console.log(`Status: ${report.configured ? 'Configured' : 'Not Configured'}`);
  console.log(`Environment: ${report.environment}`);
  console.log(`API URL: ${report.apiUrl}`);

  if (report.warnings.length > 0) {
    console.group('Warnings/Errors');
    report.warnings.forEach((warning) => console.warn(`  - ${warning}`));
    console.groupEnd();
  }

  console.groupEnd();
}

export function isSafeToLog(value: unknown): boolean {
  if (!value || !credentials.apiUrl) return true;
  return !stringifySafely(value).includes(credentials.apiUrl);
}

export function sanitizeForLog(value: unknown): unknown {
  if (!value || !credentials.apiUrl) return value;

  if (typeof value === 'string') {
    return value.replace(new RegExp(escapeRegExp(credentials.apiUrl), 'g'), SecureConfig.getSafeApiUrl());
  }

  if (typeof value === 'object') {
    return SecureConfig.sanitizeError(value);
  }

  return value;
}

export default SecureConfig;
