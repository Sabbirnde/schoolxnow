// @vitest-environment node
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import mysql, { type Connection } from 'mysql2/promise';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import handler from '../api/[...path]';
import tableRoute from '../api/tables/[table]';
import countRoute from '../api/tables/[table]/count';
import idRoute from '../api/tables/[table]/[id]';
import { issueToken } from '../api/_lib/auth';
import { applyMigrations, migrationStatus } from '../scripts/lib/migrations.mjs';

const runIntegration = process.env.RUN_API_INTEGRATION === 'true';
const suite = runIntegration ? describe : describe.skip;
const containerName = `schoolxnow-api-test-${process.pid}-${crypto.randomBytes(4).toString('hex')}`;
const database = 'schoolxnow_test';
const rootPassword = crypto.randomBytes(18).toString('base64url');
const loginPassword = 'IntegrationPass!123';
const ids = {
  schoolA: '10000000-0000-4000-8000-000000000001',
  schoolB: '20000000-0000-4000-8000-000000000001',
  superUser: '30000000-0000-4000-8000-000000000001',
  adminA: '30000000-0000-4000-8000-000000000002',
  adminB: '30000000-0000-4000-8000-000000000003',
  inactive: '30000000-0000-4000-8000-000000000004',
  teacherA: '30000000-0000-4000-8000-000000000005',
  studentUserA: '30000000-0000-4000-8000-000000000006',
  studentA1: '40000000-0000-4000-8000-000000000001',
  studentA2: '40000000-0000-4000-8000-000000000002',
  studentA3: '40000000-0000-4000-8000-000000000003',
  studentB1: '40000000-0000-4000-8000-000000000004',
};

type MockResult = {
  statusCode: number;
  headers: Map<string, string | number | readonly string[]>;
  body: any;
  ended: boolean;
  status: (code: number) => MockResult;
  json: (body: unknown) => MockResult;
  end: () => MockResult;
  setHeader: (name: string, value: string | number | readonly string[]) => void;
  getHeader: (name: string) => string | number | readonly string[] | undefined;
};

function response(): MockResult {
  return {
    statusCode: 200,
    headers: new Map(),
    body: undefined,
    ended: false,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
    end() {
      this.ended = true;
      return this;
    },
    setHeader(name, value) {
      this.headers.set(name.toLowerCase(), value);
    },
    getHeader(name) {
      return this.headers.get(name.toLowerCase());
    },
  };
}

async function invoke(
  route: typeof handler,
  method: string,
  url: string,
  options: {
    query?: Record<string, string | string[]>;
    body?: Record<string, unknown>;
    token?: string;
  } = {},
) {
  const res = response();
  const req = {
    method,
    url,
    query: options.query || {},
    body: options.body,
    headers: {
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
    },
  } as unknown as VercelRequest;
  await route(req, res as unknown as VercelResponse);
  return res;
}

async function waitForMySql(port: number) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      return await mysql.createConnection({
        host: '127.0.0.1',
        port,
        user: 'root',
        password: rootPassword,
        database,
        multipleStatements: true,
      });
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  throw lastError;
}

async function seed(connection: Connection) {
  const passwordHash = await bcrypt.hash(loginPassword, 4);
  await connection.query(
    `INSERT INTO schools (id, name, school_type, address, email, eiin_number)
     VALUES
       (?, 'Alpha School', 'bangla_medium', 'Dhaka', 'alpha@example.test', 'A-100'),
       (?, 'Beta School', 'english_medium', 'Chattogram', 'beta@example.test', 'B-200')`,
    [ids.schoolA, ids.schoolB],
  );
  await connection.query(
    `INSERT INTO users (id, email, password_hash, email_verified_at, is_active)
     VALUES
       (?, 'super@example.test', ?, UTC_TIMESTAMP(), 1),
       (?, 'admin-a@example.test', ?, UTC_TIMESTAMP(), 1),
       (?, 'admin-b@example.test', ?, UTC_TIMESTAMP(), 1),
       (?, 'inactive@example.test', ?, UTC_TIMESTAMP(), 0),
       (?, 'teacher-a@example.test', ?, UTC_TIMESTAMP(), 1),
       (?, 'student-a@example.test', ?, UTC_TIMESTAMP(), 1)`,
    [
      ids.superUser, passwordHash,
      ids.adminA, passwordHash,
      ids.adminB, passwordHash,
      ids.inactive, passwordHash,
      ids.teacherA, passwordHash,
      ids.studentUserA, passwordHash,
    ],
  );
  await connection.query(
    `INSERT INTO user_profiles (id, user_id, school_id, role, full_name, is_active, approval_status)
     VALUES
       (UUID(), ?, NULL, 'super_admin', 'Super Admin', 1, 'approved'),
       (UUID(), ?, ?, 'school_admin', 'Alpha Admin', 1, 'approved'),
       (UUID(), ?, ?, 'school_admin', 'Beta Admin', 1, 'approved'),
       (UUID(), ?, ?, 'school_admin', 'Inactive Admin', 1, 'approved'),
       (UUID(), ?, ?, 'teacher', 'Alpha Teacher', 1, 'approved'),
       (UUID(), ?, ?, 'student', 'Alpha Student', 1, 'approved')`,
    [
      ids.superUser,
      ids.adminA, ids.schoolA,
      ids.adminB, ids.schoolB,
      ids.inactive, ids.schoolA,
      ids.teacherA, ids.schoolA,
      ids.studentUserA, ids.schoolA,
    ],
  );
  await connection.query(
    `INSERT INTO user_roles (id, user_id, role)
     VALUES
       (UUID(), ?, 'super_admin'),
       (UUID(), ?, 'school_admin'),
       (UUID(), ?, 'school_admin'),
       (UUID(), ?, 'school_admin'),
       (UUID(), ?, 'teacher'),
       (UUID(), ?, 'student')`,
    [ids.superUser, ids.adminA, ids.adminB, ids.inactive, ids.teacherA, ids.studentUserA],
  );
  await connection.query(
    `INSERT INTO students
       (id, school_id, student_id, full_name, father_name, mother_name, date_of_birth, gender, address, guardian_phone, status)
     VALUES
       (?, ?, 'A-001', 'Ada Alpha', 'Father', 'Mother', '2012-01-01', 'female', 'Dhaka', '01700000001', 'active'),
       (?, ?, 'A-002', 'Ben Alpha', 'Father', 'Mother', '2012-02-01', 'male', 'Dhaka', '01700000002', 'inactive'),
       (?, ?, 'A-003', 'Cara Alpha', 'Father', 'Mother', '2012-03-01', 'female', 'Dhaka', '01700000003', 'active'),
       (?, ?, 'B-001', 'Dina Beta', 'Father', 'Mother', '2012-04-01', 'female', 'Chattogram', '01800000001', 'active')`,
    [
      ids.studentA1, ids.schoolA,
      ids.studentA2, ids.schoolA,
      ids.studentA3, ids.schoolA,
      ids.studentB1, ids.schoolB,
    ],
  );
}

suite('Vercel API + MySQL integration', () => {
  let connection: Connection;
  let superToken: string;
  let adminAToken: string;
  let teacherAToken: string;
  let studentAToken: string;

  beforeAll(async () => {
    execFileSync('docker', [
      'run', '--detach', '--name', containerName,
      '--env', `MYSQL_ROOT_PASSWORD=${rootPassword}`,
      '--env', `MYSQL_DATABASE=${database}`,
      '--publish', '127.0.0.1::3306',
      'mysql:8.4',
      '--character-set-server=utf8mb4',
      '--collation-server=utf8mb4_unicode_ci',
    ], { stdio: 'ignore', timeout: 180_000 });

    const portOutput = execFileSync('docker', ['port', containerName, '3306/tcp'], { encoding: 'utf8' }).trim();
    const port = Number(portOutput.split(':').pop());
    connection = await waitForMySql(port);
    await applyMigrations(connection, { appliedBy: 'api-integration-test' });
    await connection.query("SET SESSION sql_mode = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION'");
    await seed(connection);

    Object.assign(process.env, {
      DB_HOST: '127.0.0.1',
      DB_PORT: String(port),
      DB_DATABASE: database,
      DB_USERNAME: 'root',
      DB_PASSWORD: rootPassword,
      DB_SSL: 'false',
      JWT_SECRET: 'integration-test-jwt-secret-at-least-32-characters',
      JWT_TTL_SECONDS: '3600',
      APP_DEBUG: 'false',
      VERCEL_ENV: 'preview',
    });

    const superLogin = await invoke(handler, 'POST', '/api/auth/login', {
      body: { email: 'super@example.test', password: loginPassword },
    });
    const adminLogin = await invoke(handler, 'POST', '/api/auth/login', {
      body: { email: 'admin-a@example.test', password: loginPassword },
    });
    const teacherLogin = await invoke(handler, 'POST', '/api/auth/login', {
      body: { email: 'teacher-a@example.test', password: loginPassword },
    });
    const studentLogin = await invoke(handler, 'POST', '/api/auth/login', {
      body: { email: 'student-a@example.test', password: loginPassword },
    });
    superToken = superLogin.body.data.session.access_token;
    adminAToken = adminLogin.body.data.session.access_token;
    teacherAToken = teacherLogin.body.data.session.access_token;
    studentAToken = studentLogin.body.data.session.access_token;
  }, 240_000);

  afterAll(async () => {
    await connection?.end();
    if (runIntegration && /^schoolxnow-api-test-\d+-[a-f0-9]{8}$/.test(containerName)) {
      execFileSync('docker', ['rm', '--force', containerName], { stdio: 'ignore', timeout: 30_000 });
    }
  });

  it('runs against strict MySQL 8 with named-placeholder queries', async () => {
    const [rows] = await connection.query<any[]>('SELECT VERSION() AS version, @@SESSION.sql_mode AS sql_mode');
    expect(rows[0].version).toMatch(/^8\./);
    expect(rows[0].sql_mode).toContain('STRICT_TRANS_TABLES');
    const status = await migrationStatus(connection);
    expect(status.applied).toHaveLength(2);
    expect(status.pending).toHaveLength(0);
  });

  it('adopts the baseline for a legacy installation and applies later migrations', async () => {
    await connection.query('CREATE DATABASE schoolxnow_legacy_test');
    const legacy = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      user: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: 'schoolxnow_legacy_test',
      multipleStatements: true,
    });
    try {
      await legacy.query('CREATE TABLE users (id CHAR(36) PRIMARY KEY) ENGINE=InnoDB');
      const status = await applyMigrations(legacy, { appliedBy: 'legacy-adoption-test' });
      expect(status.pending).toHaveLength(0);
      expect(status.applied).toHaveLength(2);
      expect(status.applied[0].applied_by).toBe('legacy-adoption-test:baseline');
      const [rateTables] = await legacy.query<any[]>(
        "SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'api_rate_limits'",
      );
      expect(Number(rateTables[0].count)).toBe(1);
    } finally {
      await legacy.end();
    }
  });

  it('supports list filters, sorting, and pagination through the table adapter', async () => {
    const result = await invoke(tableRoute, 'GET', '/api/tables/students?status=active&sort=full_name&order=asc&limit=1&offset=1', {
      token: adminAToken,
      query: {
        table: 'students',
        status: 'active',
        sort: 'full_name',
        order: 'asc',
        limit: '1',
        offset: '1',
      },
    });

    expect(result.statusCode).toBe(200);
    expect(result.body.data).toHaveLength(1);
    expect(result.body.data[0].full_name).toBe('Cara Alpha');
  });

  it('supports filtered counts and ignores Vercel-injected route parameters', async () => {
    const result = await invoke(countRoute, 'GET', '/api/tables/students/count?status=active', {
      token: adminAToken,
      query: { table: 'students', id: 'count', path: [], status: 'active' },
    });

    expect(result.statusCode).toBe(200);
    expect(result.body.data.count).toBe(2);
  });

  it('supports catch-all path parameters without treating them as SQL filters', async () => {
    const result = await invoke(handler, 'GET', '/api/tables/students?limit=2', {
      token: adminAToken,
      query: { path: ['tables', 'students'], table: 'injected-value', limit: '2' },
    });

    expect(result.statusCode).toBe(200);
    expect(result.body.data).toHaveLength(2);
  });

  it('covers create, show, update, and delete route adapters', async () => {
    const created = await invoke(tableRoute, 'POST', '/api/tables/students', {
      token: adminAToken,
      query: { table: 'students' },
      body: {
        school_id: ids.schoolB,
        student_id: 'A-NEW',
        full_name: 'New Alpha',
        father_name: 'Father',
        mother_name: 'Mother',
        date_of_birth: '2013-01-01',
        gender: 'female',
        address: 'Dhaka',
        guardian_phone: '01700000999',
        status: 'active',
      },
    });
    expect(created.statusCode).toBe(201);
    expect(created.body.data.school_id).toBe(ids.schoolA);
    const createdId = created.body.data.id;

    const shown = await invoke(idRoute, 'GET', `/api/tables/students/${createdId}`, {
      token: adminAToken,
      query: { table: 'students', id: createdId },
    });
    expect(shown.statusCode).toBe(200);
    expect(shown.body.data.full_name).toBe('New Alpha');

    const updated = await invoke(idRoute, 'PATCH', `/api/tables/students/${createdId}`, {
      token: adminAToken,
      query: { table: 'students', id: createdId },
      body: { full_name: 'Updated Alpha', school_id: ids.schoolB },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.body.data.full_name).toBe('Updated Alpha');
    expect(updated.body.data.school_id).toBe(ids.schoolA);

    const deleted = await invoke(idRoute, 'DELETE', `/api/tables/students/${createdId}`, {
      token: adminAToken,
      query: { table: 'students', id: createdId },
    });
    expect(deleted.statusCode).toBe(204);
    expect(deleted.ended).toBe(true);

    const missing = await invoke(idRoute, 'GET', `/api/tables/students/${createdId}`, {
      token: adminAToken,
      query: { table: 'students', id: createdId },
    });
    expect(missing.statusCode).toBe(404);
  });

  it('enforces role and school isolation on reads and record lookup', async () => {
    const schoolAdminList = await invoke(tableRoute, 'GET', '/api/tables/students', {
      token: adminAToken,
      query: { table: 'students', limit: '20' },
    });
    expect(schoolAdminList.body.data).toHaveLength(3);
    expect(schoolAdminList.body.data.every((row: any) => row.school_id === ids.schoolA)).toBe(true);

    const crossSchool = await invoke(idRoute, 'GET', `/api/tables/students/${ids.studentB1}`, {
      token: adminAToken,
      query: { table: 'students', id: ids.studentB1 },
    });
    expect(crossSchool.statusCode).toBe(404);

    const superList = await invoke(tableRoute, 'GET', '/api/tables/students', {
      token: superToken,
      query: { table: 'students', limit: '20' },
    });
    expect(superList.body.data).toHaveLength(4);

    const teacherList = await invoke(tableRoute, 'GET', '/api/tables/students', {
      token: teacherAToken,
      query: { table: 'students', limit: '20' },
    });
    expect(teacherList.statusCode).toBe(200);
    expect(teacherList.body.data).toHaveLength(3);

    const teacherCreate = await invoke(tableRoute, 'POST', '/api/tables/students', {
      token: teacherAToken,
      query: { table: 'students' },
      body: { student_id: 'NOT-ALLOWED' },
    });
    expect(teacherCreate.statusCode).toBe(403);

    const studentList = await invoke(tableRoute, 'GET', '/api/tables/students', {
      token: studentAToken,
      query: { table: 'students' },
    });
    expect(studentList.statusCode).toBe(403);
  });

  it('logs in valid accounts and rejects invalid credentials', async () => {
    const valid = await invoke(handler, 'POST', '/api/auth/login', {
      body: { email: 'admin-b@example.test', password: loginPassword },
    });
    expect(valid.statusCode).toBe(200);
    expect(valid.body.data.user.role).toBe('school_admin');

    const invalid = await invoke(handler, 'POST', '/api/auth/login', {
      body: { email: 'admin-b@example.test', password: 'wrong-password' },
    });
    expect(invalid.statusCode).toBe(401);
  });

  it('rejects expired tokens', async () => {
    process.env.JWT_TTL_SECONDS = '-1';
    const expired = issueToken({ sub: ids.adminA });
    process.env.JWT_TTL_SECONDS = '3600';

    const result = await invoke(handler, 'GET', '/api/auth/me', { token: expired });
    expect(result.statusCode).toBe(401);
  });

  it('rejects users disabled at the account layer even when their profile remains active', async () => {
    const result = await invoke(handler, 'POST', '/api/auth/login', {
      body: { email: 'inactive@example.test', password: loginPassword },
    });
    expect(result.statusCode).toBe(403);
  });

  it('returns generic errors for MySQL constraint failures', async () => {
    const duplicate = await invoke(tableRoute, 'POST', '/api/tables/students', {
      token: adminAToken,
      query: { table: 'students' },
      body: {
        student_id: 'A-001',
        full_name: 'Duplicate',
        father_name: 'Father',
        mother_name: 'Mother',
        date_of_birth: '2013-01-01',
        gender: 'male',
        address: 'Dhaka',
        guardian_phone: '01700000888',
        status: 'active',
      },
    });

    expect(duplicate.statusCode).toBe(500);
    expect(duplicate.body.error.message).toBe('Internal server error');
    expect(duplicate.body.error.detail).toBeNull();
    expect(duplicate.getHeader('X-Request-ID')).toBeTruthy();
  });
});
