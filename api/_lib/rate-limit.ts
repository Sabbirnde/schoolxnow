import crypto from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { RowDataPacket } from 'mysql2/promise';
import { execute, query } from './db.js';
import { ApiError } from './http.js';

export type RateLimitPolicy = {
  action: string;
  limit: number;
  windowSeconds: number;
};

function requestIp(req: VercelRequest) {
  const forwarded = req.headers['x-forwarded-for'];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return String(raw || req.headers['x-real-ip'] || 'unknown').split(',')[0].trim();
}

function positiveInteger(value: number, fallback: number) {
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

export async function enforceRateLimit(
  req: VercelRequest,
  res: VercelResponse,
  policy: RateLimitPolicy,
  identity = '',
) {
  const limit = positiveInteger(policy.limit, 5);
  const windowSeconds = positiveInteger(policy.windowSeconds, 900);
  const normalizedIdentity = identity.trim().toLowerCase().slice(0, 320);
  const keyHash = crypto
    .createHash('sha256')
    .update(`${policy.action}|${requestIp(req)}|${normalizedIdentity}`)
    .digest('hex');

  await execute(
    `INSERT INTO api_rate_limits
       (key_hash, action, attempts, window_started_at, expires_at)
     VALUES
       (:key_hash, :action, 1, UTC_TIMESTAMP(), DATE_ADD(UTC_TIMESTAMP(), INTERVAL ${windowSeconds} SECOND))
     ON DUPLICATE KEY UPDATE
       action = VALUES(action),
       attempts = IF(expires_at <= UTC_TIMESTAMP(), 1, attempts + 1),
       window_started_at = IF(expires_at <= UTC_TIMESTAMP(), UTC_TIMESTAMP(), window_started_at),
       expires_at = IF(
         expires_at <= UTC_TIMESTAMP(),
         DATE_ADD(UTC_TIMESTAMP(), INTERVAL ${windowSeconds} SECOND),
         expires_at
       )`,
    { key_hash: keyHash, action: policy.action },
  );

  const rows = await query<(RowDataPacket & { attempts: number; retry_after: number })[]>(
    `SELECT attempts,
            GREATEST(TIMESTAMPDIFF(SECOND, UTC_TIMESTAMP(), expires_at), 1) AS retry_after
     FROM api_rate_limits
     WHERE key_hash = :key_hash
     LIMIT 1`,
    { key_hash: keyHash },
  );
  const state = rows[0];

  res.setHeader('X-RateLimit-Limit', String(limit));
  res.setHeader('X-RateLimit-Remaining', String(Math.max(0, limit - Number(state?.attempts || 0))));

  if (Number(state?.attempts || 0) > limit) {
    const retryAfter = Math.max(1, Number(state?.retry_after || windowSeconds));
    res.setHeader('Retry-After', String(retryAfter));
    throw new ApiError(429, 'Too many requests. Please wait and try again.');
  }
}
