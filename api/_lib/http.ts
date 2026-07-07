import type { VercelRequest, VercelResponse } from '@vercel/node';

export class ApiError extends Error {
  status: number;
  detail?: string | null;

  constructor(status: number, message: string, detail?: string | null) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

export function setCors(req: VercelRequest, res: VercelResponse) {
  const configuredOrigin = process.env.CORS_ORIGIN || process.env.FRONTEND_URL || '';
  const requestOrigin = String(req.headers.origin || '');
  const origin = configuredOrigin || requestOrigin || '*';

  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export function sendData<T>(res: VercelResponse, data: T, status = 200) {
  return res.status(status).json({ data });
}

export function sendError(res: VercelResponse, error: unknown) {
  if (error instanceof ApiError) {
    return res.status(error.status).json({
      error: {
        message: error.message,
        detail: error.detail ?? null,
      },
    });
  }

  const detail = error instanceof Error ? error.message : null;
  return res.status(500).json({
    error: {
      message: 'Internal server error',
      detail: process.env.APP_DEBUG === 'true' ? detail : null,
    },
  });
}

export function requiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new ApiError(500, `Missing environment variable: ${key}`);
  }

  return value;
}

export function readBearerToken(req: VercelRequest): string | null {
  const header = req.headers.authorization;
  if (!header) {
    return null;
  }

  const value = Array.isArray(header) ? header[0] : header;
  const match = /^Bearer\s+(.+)$/i.exec(value);
  return match?.[1] ?? null;
}

export function readJsonBody<T extends Record<string, unknown> = Record<string, unknown>>(req: VercelRequest): T {
  if (!req.body) {
    return {} as T;
  }

  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body) as T;
    } catch {
      throw new ApiError(400, 'Invalid JSON body');
    }
  }

  if (Buffer.isBuffer(req.body)) {
    try {
      return JSON.parse(req.body.toString('utf8')) as T;
    } catch {
      throw new ApiError(400, 'Invalid JSON body');
    }
  }

  return req.body as T;
}

export function nullableString(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return text === '' ? null : text;
}

export function appendQuery(url: string, params: Record<string, string>) {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}${new URLSearchParams(params).toString()}`;
}

