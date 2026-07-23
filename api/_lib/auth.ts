import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { VercelRequest } from '@vercel/node';
import type { RowDataPacket } from 'mysql2/promise';
import { query } from './db.js';
import { ApiError, readBearerToken, requiredEnv } from './http.js';
import { setRequestUserRole } from './monitoring.js';
import { contractAllows } from './contract.js';

export type ApiUser = {
  id: string;
  email: string;
  school_id: string | null;
  role: 'super_admin' | 'school_admin' | 'teacher' | 'student' | 'guardian';
  full_name: string;
  full_name_bangla?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  address?: string | null;
  address_bangla?: string | null;
  approval_status?: string | null;
  is_active: number | boolean;
};

type Claims = {
  sub: string;
  email?: string;
  role?: string;
  school_id?: string | null;
  iat?: number;
  exp?: number;
};

function base64Url(value: Buffer | string) {
  return Buffer.from(value).toString('base64url');
}

function sign(value: string) {
  return crypto.createHmac('sha256', requiredEnv('JWT_SECRET')).update(value).digest('base64url');
}

export function issueToken(claims: Record<string, unknown>) {
  const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const ttl = Number(process.env.JWT_TTL_SECONDS || 86400);
  const payload = base64Url(JSON.stringify({ ...claims, iat: now, exp: now + ttl }));
  const signature = sign(`${header}.${payload}`);

  return `${header}.${payload}.${signature}`;
}

export function verifyToken(token: string | null): Claims | null {
  if (!token) {
    return null;
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }

  const [header, payload, signature] = parts;
  const expected = sign(`${header}.${payload}`);
  if (signature.length !== expected.length) {
    return null;
  }

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return null;
  }

  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Claims;
    if (!claims.sub || (claims.exp ?? 0) < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return claims;
  } catch {
    return null;
  }
}

export function normalizeStoredHash(hash: string) {
  return hash.startsWith('$2y$') ? `$2b$${hash.slice(4)}` : hash;
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, normalizeStoredHash(hash));
}

export async function requireUser(req: VercelRequest): Promise<ApiUser> {
  const claims = verifyToken(readBearerToken(req));
  if (!claims?.sub) {
    throw new ApiError(401, 'Unauthenticated');
  }

  const rows = await query<(ApiUser & RowDataPacket)[]>(
    `SELECT u.id,
            u.email,
            p.school_id,
            COALESCE(r.role, p.role) AS role,
            p.full_name,
            p.full_name_bangla,
            p.phone,
            p.avatar_url,
            p.address,
            p.address_bangla,
            p.approval_status,
            IF(u.is_active = 1 AND p.is_active = 1, 1, 0) AS is_active
     FROM users u
     JOIN user_profiles p ON p.user_id = u.id
     LEFT JOIN user_roles r ON r.user_id = u.id
     WHERE u.id = :id
     LIMIT 1`,
    { id: claims.sub },
  );
  const user = rows[0];

  if (!user || Number(user.is_active) !== 1) {
    throw new ApiError(403, 'Account is inactive or missing');
  }

  setRequestUserRole(user.role);
  return user;
}

export type TableOperation = 'read' | 'create' | 'update' | 'delete';

export function canAccessTable(user: ApiUser, table: string, operation: TableOperation) {
  return contractAllows(user.role, table, operation);
}
