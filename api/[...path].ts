import crypto, { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { put } from '@vercel/blob';
import bcrypt from 'bcryptjs';
import formidable, { type File } from 'formidable';
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { issueToken, requireUser, verifyPassword, hashPassword, type ApiUser } from './_lib/auth.js';
import { execute, query, transaction } from './_lib/db.js';
import {
  ApiError,
  appendQuery,
  nullableString,
  readJsonBody,
  requiredEnv,
  sendData,
  sendError,
  setCors,
} from './_lib/http.js';
import { handleTable } from './_lib/tables.js';

type LoginUser = ApiUser & RowDataPacket & { password_hash: string };

const ALLOWED_BUCKETS = ['avatars', 'student-photos', 'documents'];
const ALLOWED_MIME_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function isoToMysql(date: Date) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

function frontendUrl(path: string) {
  return `${String(process.env.FRONTEND_URL || process.env.CORS_ORIGIN || '').replace(/\/$/, '')}${path}`;
}

async function logAuditEvent(
  connection: PoolConnection,
  event: {
    user_id: string | null;
    school_id: string | null;
    action: string;
    entity_type: string;
    entity_id: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  await execute(
    `INSERT INTO audit_logs
     (id, user_id, school_id, action, entity_type, entity_id, metadata, success)
     VALUES
     (:id, :user_id, :school_id, :action, :entity_type, :entity_id, :metadata, 1)`,
    {
      id: randomUUID(),
      user_id: event.user_id,
      school_id: event.school_id,
      action: event.action,
      entity_type: event.entity_type,
      entity_id: event.entity_id,
      metadata: JSON.stringify(event.metadata || {}),
    },
    connection,
  );
}

async function login(req: VercelRequest, res: VercelResponse) {
  const body = readJsonBody(req);
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');

  if (!email || !password) {
    throw new ApiError(422, 'Email and password are required');
  }

  const rows = await query<LoginUser[]>(
    `SELECT u.id,
            u.email,
            u.password_hash,
            p.school_id,
            COALESCE(r.role, p.role) AS role,
            p.full_name,
            p.full_name_bangla,
            p.phone,
            p.avatar_url,
            p.address,
            p.address_bangla,
            p.approval_status,
            p.is_active
     FROM users u
     JOIN user_profiles p ON p.user_id = u.id
     LEFT JOIN user_roles r ON r.user_id = u.id
     WHERE u.email = :email
     LIMIT 1`,
    { email },
  );
  const user = rows[0];

  if (!user || !(await verifyPassword(password, user.password_hash))) {
    throw new ApiError(401, 'Invalid email or password');
  }

  if (Number(user.is_active) !== 1) {
    throw new ApiError(403, 'Account is inactive');
  }

  const { password_hash: _passwordHash, ...safeUser } = user;
  const token = issueToken({
    sub: safeUser.id,
    email: safeUser.email,
    role: safeUser.role,
    school_id: safeUser.school_id,
  });

  return sendData(res, {
    user: safeUser,
    session: {
      access_token: token,
      token_type: 'bearer',
    },
  });
}

async function register(req: VercelRequest, res: VercelResponse) {
  const body = readJsonBody(req);
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const fullName = String(body.full_name || '').trim();
  const role = String(body.role || 'teacher');
  const schoolId = body.school_id || null;

  if (!email || !password || !fullName) {
    throw new ApiError(422, 'Email, password, and full_name are required');
  }

  if (role === 'super_admin') {
    throw new ApiError(403, 'Super admin registration must use bootstrap');
  }

  if (!['school_admin', 'teacher'].includes(role)) {
    throw new ApiError(422, 'Invalid role');
  }

  const id = randomUUID();
  await transaction(async (connection) => {
    await execute(
      'INSERT INTO users (id, email, password_hash) VALUES (:id, :email, :password_hash)',
      { id, email, password_hash: await hashPassword(password) },
      connection,
    );
    await execute(
      `INSERT INTO user_profiles (id, user_id, school_id, role, full_name, approval_status)
       VALUES (:id, :user_id, :school_id, :role, :full_name, :approval_status)`,
      {
        id: randomUUID(),
        user_id: id,
        school_id: schoolId,
        role,
        full_name: fullName,
        approval_status: role === 'super_admin' ? 'approved' : 'pending',
      },
      connection,
    );
    await execute(
      'INSERT INTO user_roles (id, user_id, role) VALUES (:id, :user_id, :role)',
      { id: randomUUID(), user_id: id, role },
      connection,
    );
  });

  return sendData(res, { id, email }, 201);
}

async function registerSchool(req: VercelRequest, res: VercelResponse) {
  const body = readJsonBody(req);
  const school = (body.school || {}) as Record<string, unknown>;
  const admin = (body.admin || {}) as Record<string, unknown>;
  const schoolName = String(school.name || '').trim();
  const schoolType = String(school.school_type || '');
  const schoolAddress = String(school.address || '').trim();
  const schoolPhone = String(school.phone || '').trim();
  const schoolEmail = String(school.email || '').trim().toLowerCase();
  const adminName = String(admin.full_name || '').trim();
  const adminEmail = String(admin.email || '').trim().toLowerCase();
  const adminPhone = String(admin.phone || '').trim();
  const adminPassword = String(admin.password || '');

  if (!schoolName || !schoolAddress || !schoolPhone || !schoolEmail) {
    throw new ApiError(422, 'School name, address, phone, and email are required');
  }

  if (!['bangla_medium', 'english_medium', 'madrasha'].includes(schoolType)) {
    throw new ApiError(422, 'Invalid school type');
  }

  if (!adminName || !adminPhone || adminPassword.length < 6) {
    throw new ApiError(422, 'Admin name, phone, and a password of at least 6 characters are required');
  }

  const schoolId = randomUUID();
  const adminUserId = randomUUID();

  try {
    await transaction(async (connection) => {
      await execute(
        `INSERT INTO schools
         (id, name, name_bangla, school_type, address, address_bangla, phone, email, eiin_number, established_year, is_active)
         VALUES
         (:id, :name, :name_bangla, :school_type, :address, :address_bangla, :phone, :email, :eiin_number, :established_year, 1)`,
        {
          id: schoolId,
          name: schoolName,
          name_bangla: nullableString(school.name_bangla),
          school_type: schoolType,
          address: schoolAddress,
          address_bangla: nullableString(school.address_bangla),
          phone: schoolPhone,
          email: schoolEmail,
          eiin_number: nullableString(school.eiin_number),
          established_year: school.established_year ? Number(school.established_year) : null,
        },
        connection,
      );
      await execute(
        'INSERT INTO users (id, email, password_hash) VALUES (:id, :email, :password_hash)',
        { id: adminUserId, email: adminEmail, password_hash: await hashPassword(adminPassword) },
        connection,
      );
      await execute(
        `INSERT INTO user_profiles
         (id, user_id, school_id, role, full_name, phone, approval_status, is_active)
         VALUES
         (:id, :user_id, :school_id, 'school_admin', :full_name, :phone, 'pending', 1)`,
        { id: randomUUID(), user_id: adminUserId, school_id: schoolId, full_name: adminName, phone: adminPhone },
        connection,
      );
      await execute(
        "INSERT INTO user_roles (id, user_id, role) VALUES (:id, :user_id, 'school_admin')",
        { id: randomUUID(), user_id: adminUserId },
        connection,
      );
      await logAuditEvent(connection, {
        user_id: adminUserId,
        school_id: schoolId,
        action: 'SCHOOL_REGISTRATION_CREATED',
        entity_type: 'schools',
        entity_id: schoolId,
        metadata: { school_name: schoolName, admin_email: adminEmail },
      });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('Duplicate')) {
      throw new ApiError(409, 'This email or EIIN number is already registered');
    }
    throw error;
  }

  return sendData(res, { school: { id: schoolId, name: schoolName }, admin: { id: adminUserId, email: adminEmail } }, 201);
}

async function superAdminExists() {
  const rows = await query(
    `SELECT 1
     FROM user_roles r
     JOIN user_profiles p ON p.user_id = r.user_id
     WHERE r.role = 'super_admin' AND p.is_active = 1
     LIMIT 1`,
  );
  return Boolean(rows[0]);
}

async function createSuperAdmin(req: VercelRequest, res: VercelResponse) {
  const body = readJsonBody(req);
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const fullName = String(body.full_name || body.fullName || '').trim();
  const secretKey = String(body.secret_key || body.secretKey || '');

  if (!secretKey || secretKey !== requiredEnv('SUPER_ADMIN_SECRET')) {
    throw new ApiError(401, 'Invalid bootstrap secret key');
  }

  if (await superAdminExists()) {
    throw new ApiError(409, 'Bootstrap already completed. A super administrator already exists.');
  }

  if (!email || !fullName || password.length < 8) {
    throw new ApiError(422, 'Valid email, full name, and password of at least 8 characters are required');
  }

  const userId = randomUUID();
  await transaction(async (connection) => {
    await execute(
      'INSERT INTO users (id, email, password_hash, email_verified_at, is_active) VALUES (:id, :email, :password_hash, CURRENT_TIMESTAMP, 1)',
      { id: userId, email, password_hash: await hashPassword(password) },
      connection,
    );
    await execute(
      `INSERT INTO user_profiles
       (id, user_id, school_id, role, full_name, approval_status, is_active)
       VALUES (:id, :user_id, NULL, 'super_admin', :full_name, 'approved', 1)`,
      { id: randomUUID(), user_id: userId, full_name: fullName },
      connection,
    );
    await execute(
      "INSERT INTO user_roles (id, user_id, role) VALUES (:id, :user_id, 'super_admin')",
      { id: randomUUID(), user_id: userId },
      connection,
    );
    await logAuditEvent(connection, {
      user_id: userId,
      school_id: null,
      action: 'BOOTSTRAP_COMPLETED',
      entity_type: 'bootstrap',
      entity_id: userId,
      metadata: { email, full_name: fullName },
    });
  });

  return sendData(res, { success: true, message: 'Super admin created successfully', user_id: userId }, 201);
}

async function profileForUser(userId: string) {
  const rows = await query(
    `SELECT p.id,
            p.user_id,
            p.school_id,
            COALESCE(r.role, p.role) AS role,
            p.full_name,
            p.full_name_bangla,
            p.phone,
            p.avatar_url,
            p.address,
            p.address_bangla,
            p.is_active
     FROM user_profiles p
     LEFT JOIN user_roles r ON r.user_id = p.user_id
     WHERE p.user_id = :user_id
     LIMIT 1`,
    { user_id: userId },
  );

  if (!rows[0]) {
    throw new ApiError(404, 'Profile not found');
  }

  return rows[0];
}

async function updateProfile(req: VercelRequest, res: VercelResponse) {
  const user = await requireUser(req);
  const body = readJsonBody(req);
  const fullName = String(body.full_name || '').trim();
  if (!fullName) {
    throw new ApiError(422, 'Full name is required');
  }

  await execute(
    `UPDATE user_profiles
     SET full_name = :full_name,
         full_name_bangla = :full_name_bangla,
         phone = :phone,
         avatar_url = :avatar_url,
         address = :address,
         address_bangla = :address_bangla
     WHERE user_id = :user_id`,
    {
      full_name: fullName,
      full_name_bangla: nullableString(body.full_name_bangla),
      phone: nullableString(body.phone),
      avatar_url: nullableString(body.avatar_url),
      address: nullableString(body.address),
      address_bangla: nullableString(body.address_bangla),
      user_id: user.id,
    },
  );

  return sendData(res, await profileForUser(user.id));
}

async function changePassword(req: VercelRequest, res: VercelResponse) {
  const user = await requireUser(req);
  const body = readJsonBody(req);
  const currentPassword = String(body.current_password || '');
  const newPassword = String(body.new_password || '');

  if (!currentPassword || !newPassword) {
    throw new ApiError(422, 'Current password and new password are required');
  }

  if (newPassword.length < 6) {
    throw new ApiError(422, 'Password must be at least 6 characters long');
  }

  const rows = await query<(RowDataPacket & { password_hash: string })[]>(
    'SELECT password_hash FROM users WHERE id = :id LIMIT 1',
    { id: user.id },
  );
  if (!rows[0] || !(await verifyPassword(currentPassword, rows[0].password_hash))) {
    throw new ApiError(422, 'Current password is incorrect');
  }

  await execute('UPDATE users SET password_hash = :password_hash WHERE id = :id', {
    id: user.id,
    password_hash: await hashPassword(newPassword),
  });

  return sendData(res, { ok: true });
}

async function requestPasswordReset(req: VercelRequest, res: VercelResponse) {
  const body = readJsonBody(req);
  const email = String(body.email || '').trim().toLowerCase();
  const redirectTo = String(body.redirect_to || '').trim();
  if (!email) {
    throw new ApiError(422, 'Email is required');
  }

  const rows = await query<(RowDataPacket & { id: string; email: string })[]>(
    'SELECT id, email FROM users WHERE email = :email AND is_active = 1 LIMIT 1',
    { email },
  );
  const user = rows[0];
  const data: Record<string, unknown> = { ok: true };

  if (user) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = isoToMysql(new Date(Date.now() + 3600 * 1000));

    await transaction(async (connection) => {
      await execute(
        'UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE user_id = :user_id AND used_at IS NULL',
        { user_id: user.id },
        connection,
      );
      await execute(
        'INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at) VALUES (:id, :user_id, :token_hash, :expires_at)',
        { id: randomUUID(), user_id: user.id, token_hash: hashToken(token), expires_at: expiresAt },
        connection,
      );
    });

    data.reset_token = token;
    if (redirectTo) {
      data.reset_url = appendQuery(redirectTo, { token });
    }
  }

  return sendData(res, data);
}

async function resetPassword(req: VercelRequest, res: VercelResponse) {
  const body = readJsonBody(req);
  const token = String(body.token || '').trim();
  const password = String(body.password || '');
  if (!token || !password) {
    throw new ApiError(422, 'Reset token and password are required');
  }
  if (password.length < 6) {
    throw new ApiError(422, 'Password must be at least 6 characters long');
  }

  await transaction(async (connection) => {
    const rows = await query<(RowDataPacket & { id: string; user_id: string })[]>(
      `SELECT id, user_id
       FROM password_reset_tokens
       WHERE token_hash = :token_hash
         AND used_at IS NULL
         AND expires_at > UTC_TIMESTAMP()
       LIMIT 1`,
      { token_hash: hashToken(token) },
      connection,
    );
    const reset = rows[0];
    if (!reset) {
      throw new ApiError(422, 'Password reset link is invalid or expired');
    }

    await execute(
      'UPDATE users SET password_hash = :password_hash WHERE id = :id',
      { id: reset.user_id, password_hash: await hashPassword(password) },
      connection,
    );
    await execute('UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = :id', { id: reset.id }, connection);
  });

  return sendData(res, { ok: true });
}

async function submitTeacherApplication(req: VercelRequest, res: VercelResponse) {
  const user = await requireUser(req);
  if (user.role !== 'teacher') {
    throw new ApiError(403, 'Only teacher accounts can submit teacher applications');
  }

  const body = readJsonBody(req);
  const schoolId = String(body.school_id || '').trim();
  const fullName = String(body.full_name || '').trim();
  const phone = String(body.phone || '').trim();

  if (!schoolId || !fullName || !phone) {
    throw new ApiError(422, 'School, full name, and phone are required');
  }

  const schools = await query('SELECT id FROM schools WHERE id = :id AND is_active = 1 LIMIT 1', { id: schoolId });
  if (!schools[0]) {
    throw new ApiError(404, 'Selected school was not found');
  }

  const applicationId = randomUUID();
  await execute(
    `INSERT INTO teacher_applications
     (id, user_id, school_id, full_name, full_name_bangla, phone, address, address_bangla, qualification, subject_specialization, experience_years, status)
     VALUES
     (:id, :user_id, :school_id, :full_name, :full_name_bangla, :phone, :address, :address_bangla, :qualification, :subject_specialization, :experience_years, 'pending')`,
    {
      id: applicationId,
      user_id: user.id,
      school_id: schoolId,
      full_name: fullName,
      full_name_bangla: nullableString(body.full_name_bangla),
      phone,
      address: nullableString(body.address),
      address_bangla: nullableString(body.address_bangla),
      qualification: nullableString(body.qualification),
      subject_specialization: nullableString(body.subject_specialization),
      experience_years: Number(body.experience_years || 0),
    },
  );

  return sendData(res, { id: applicationId }, 201);
}

async function createTeacherPortalLink(req: VercelRequest, res: VercelResponse) {
  const actor = await requireUser(req);
  if (!['super_admin', 'school_admin'].includes(actor.role)) {
    throw new ApiError(403, 'Forbidden');
  }

  const body = readJsonBody(req);
  const email = String(body.email || '').trim().toLowerCase();
  const redirectTo = String(body.redirect_to || '').trim();
  const expiresIn = Math.min(Math.max(Number(body.expires_in || 86400), 300), 604800);
  if (!email) {
    throw new ApiError(422, 'A valid teacher email is required');
  }

  const rows = await query<(RowDataPacket & { id: string; email: string; school_id: string | null; role: string })[]>(
    `SELECT u.id, u.email, p.school_id, COALESCE(r.role, p.role) AS role
     FROM users u
     JOIN user_profiles p ON p.user_id = u.id
     LEFT JOIN user_roles r ON r.user_id = u.id
     WHERE u.email = :email AND p.is_active = 1
     LIMIT 1`,
    { email },
  );
  const teacher = rows[0];
  if (!teacher || teacher.role !== 'teacher') {
    throw new ApiError(404, 'Teacher account not found');
  }
  if (actor.role === 'school_admin' && actor.school_id !== teacher.school_id) {
    throw new ApiError(403, 'Forbidden');
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + expiresIn * 1000);
  await transaction(async (connection) => {
    await execute(
      'UPDATE teacher_portal_tokens SET used_at = CURRENT_TIMESTAMP WHERE user_id = :user_id AND used_at IS NULL',
      { user_id: teacher.id },
      connection,
    );
    await execute(
      'INSERT INTO teacher_portal_tokens (id, user_id, token_hash, expires_at) VALUES (:id, :user_id, :token_hash, :expires_at)',
      { id: randomUUID(), user_id: teacher.id, token_hash: hashToken(token), expires_at: isoToMysql(expiresAt) },
      connection,
    );
  });

  const base = redirectTo || frontendUrl('/teacher-portal');
  return sendData(res, {
    portal_url: appendQuery(base, { token }),
    plain_url: base,
    expires_at: expiresAt.toISOString(),
  });
}

async function loginWithTeacherPortalToken(req: VercelRequest, res: VercelResponse) {
  const body = readJsonBody(req);
  const token = String(body.token || '').trim();
  if (!token) {
    throw new ApiError(422, 'Teacher portal token is required');
  }

  let user: ApiUser | null = null;
  await transaction(async (connection) => {
    const rows = await query<(ApiUser & RowDataPacket & { token_id: string })[]>(
      `SELECT t.id AS token_id,
              u.id,
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
              p.is_active
       FROM teacher_portal_tokens t
       JOIN users u ON u.id = t.user_id
       JOIN user_profiles p ON p.user_id = u.id
       LEFT JOIN user_roles r ON r.user_id = u.id
       WHERE t.token_hash = :token_hash
         AND t.used_at IS NULL
         AND t.expires_at > UTC_TIMESTAMP()
       LIMIT 1`,
      { token_hash: hashToken(token) },
      connection,
    );
    const row = rows[0];
    if (!row || row.role !== 'teacher' || Number(row.is_active) !== 1) {
      throw new ApiError(422, 'Teacher portal link is invalid or expired');
    }

    await execute('UPDATE teacher_portal_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = :id', { id: row.token_id }, connection);
    const { token_id: _tokenId, ...safeUser } = row;
    user = safeUser;
  });

  const jwt = issueToken({
    sub: user!.id,
    email: user!.email,
    role: user!.role,
    school_id: user!.school_id,
  });

  return sendData(res, {
    user,
    session: {
      access_token: jwt,
      token_type: 'bearer',
    },
  });
}

async function parseUpload(req: VercelRequest) {
  const maxBytes = Number(process.env.UPLOAD_MAX_BYTES || 5242880);
  const form = formidable({ maxFileSize: maxBytes, multiples: false });

  const [, files] = await form.parse(req);
  const raw = files.file;
  const file = Array.isArray(raw) ? raw[0] : raw;
  if (!file) {
    throw new ApiError(422, 'File is required');
  }

  return file as File;
}

function safeName(name: string) {
  const clean = name.toLowerCase().replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return (clean || 'file').slice(0, 60);
}

async function upload(req: VercelRequest, res: VercelResponse, bucket: string) {
  await requireUser(req);
  if (!ALLOWED_BUCKETS.includes(bucket)) {
    throw new ApiError(404, 'Upload bucket is not allowed');
  }

  requiredEnv('BLOB_READ_WRITE_TOKEN');
  const file = await parseUpload(req);
  const mimeType = file.mimetype || '';
  const extension = ALLOWED_MIME_TYPES[mimeType];
  if (!extension) {
    throw new ApiError(422, 'File type is not allowed');
  }
  if (bucket !== 'documents' && !mimeType.startsWith('image/')) {
    throw new ApiError(422, 'Only images are allowed in this bucket');
  }

  const originalName = file.originalFilename || 'file';
  const storedName = `${new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)}-${crypto.randomBytes(8).toString('hex')}-${safeName(originalName.replace(/\.[^.]+$/, ''))}.${extension}`;
  const buffer = await readFile(file.filepath);
  const blob = await put(`${bucket}/${storedName}`, buffer, {
    access: 'public',
    contentType: mimeType,
    addRandomSuffix: false,
  });

  return sendData(
    res,
    {
      bucket,
      filename: storedName,
      url: blob.url,
      mime_type: mimeType,
      size: file.size,
    },
    201,
  );
}

function pathSegments(req: VercelRequest) {
  const raw = req.query.path;
  const querySegments = (Array.isArray(raw) ? raw : raw ? [raw] : [])
    .flatMap((segment) => String(segment).split('/'))
    .filter(Boolean);

  if (querySegments.length > 0) {
    return querySegments;
  }

  const pathname = new URL(req.url || '/', 'https://schoolxnow.local').pathname;
  return pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res);
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const segments = pathSegments(req);
  const path = `/${segments.join('/')}`;

  try {
    if (req.method === 'GET' && path === '/health') {
      return res.status(200).json({ ok: true, service: 'schoolxnow-vercel-api', time: new Date().toISOString() });
    }

    if (req.method === 'POST' && path === '/auth/login') return await login(req, res);
    if (req.method === 'POST' && path === '/auth/register') return await register(req, res);
    if (req.method === 'POST' && path === '/auth/register-school') return await registerSchool(req, res);
    if (req.method === 'GET' && path === '/public/schools') {
      const rows = await query(
        `SELECT id, name, name_bangla, school_type
         FROM schools
         WHERE is_active = 1
         ORDER BY name ASC
         LIMIT 500`,
      );
      return sendData(res, rows);
    }
    if (req.method === 'GET' && path === '/auth/me') return sendData(res, await requireUser(req));
    if (req.method === 'POST' && path === '/auth/teacher-application') return await submitTeacherApplication(req, res);
    if (req.method === 'PATCH' && path === '/auth/profile') return await updateProfile(req, res);
    if (req.method === 'POST' && path === '/auth/change-password') return await changePassword(req, res);
    if (req.method === 'POST' && path === '/auth/request-password-reset') return await requestPasswordReset(req, res);
    if (req.method === 'POST' && path === '/auth/reset-password') return await resetPassword(req, res);
    if (req.method === 'POST' && path === '/auth/teacher-portal-link') return await createTeacherPortalLink(req, res);
    if (req.method === 'POST' && path === '/auth/teacher-portal-login') return await loginWithTeacherPortalToken(req, res);
    if (req.method === 'POST' && path === '/auth/logout') return sendData(res, { ok: true });
    if (req.method === 'GET' && path === '/bootstrap/status') return sendData(res, { super_admin_exists: await superAdminExists() });
    if (req.method === 'POST' && path === '/bootstrap/create-super-admin') return await createSuperAdmin(req, res);
    if (segments[0] === 'tables') return await handleTable(req, res, segments);
    if (req.method === 'POST' && segments[0] === 'uploads' && segments[1]) return await upload(req, res, segments[1]);

    throw new ApiError(404, 'Route not found');
  } catch (error) {
    return sendError(res, error);
  }
}
