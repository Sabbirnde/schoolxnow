// @vitest-environment node
import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:net';
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
import contract from '../backend/api-contract.json';

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
  guardianUserA: '30000000-0000-4000-8000-000000000007',
  studentA1: '40000000-0000-4000-8000-000000000001',
  studentA2: '40000000-0000-4000-8000-000000000002',
  studentA3: '40000000-0000-4000-8000-000000000003',
  studentB1: '40000000-0000-4000-8000-000000000004',
  classA: '50000000-0000-4000-8000-000000000001',
  classB: '50000000-0000-4000-8000-000000000002',
  yearA: '60000000-0000-4000-8000-000000000001',
  yearB: '60000000-0000-4000-8000-000000000002',
  yearA2: '60000000-0000-4000-8000-000000000003',
  enrollmentA: '70000000-0000-4000-8000-000000000001',
  enrollmentB: '70000000-0000-4000-8000-000000000002',
  guardianLinkA: '80000000-0000-4000-8000-000000000001',
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

async function availablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

async function waitForHttp(url: string) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const result = await fetch(url);
      if (result.ok) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw lastError ?? new Error(`Server did not become ready: ${url}`);
}

async function phpRequest(
  base: string,
  method: string,
  path: string,
  options: { body?: Record<string, unknown>; token?: string } = {},
) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const body = response.status === 204 ? undefined : await response.json();
  return { statusCode: response.status, headers: response.headers, body };
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
       (?, 'student-a@example.test', ?, UTC_TIMESTAMP(), 1),
       (?, 'guardian-a@example.test', ?, UTC_TIMESTAMP(), 1)`,
    [
      ids.superUser, passwordHash,
      ids.adminA, passwordHash,
      ids.adminB, passwordHash,
      ids.inactive, passwordHash,
      ids.teacherA, passwordHash,
      ids.studentUserA, passwordHash,
      ids.guardianUserA, passwordHash,
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
       (UUID(), ?, ?, 'student', 'Alpha Student', 1, 'approved'),
       (UUID(), ?, ?, 'guardian', 'Alpha Guardian', 1, 'approved')`,
    [
      ids.superUser,
      ids.adminA, ids.schoolA,
      ids.adminB, ids.schoolB,
      ids.inactive, ids.schoolA,
      ids.teacherA, ids.schoolA,
      ids.studentUserA, ids.schoolA,
      ids.guardianUserA, ids.schoolA,
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
       (UUID(), ?, 'student'),
       (UUID(), ?, 'guardian')`,
    [ids.superUser, ids.adminA, ids.adminB, ids.inactive, ids.teacherA, ids.studentUserA, ids.guardianUserA],
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
  await connection.query('UPDATE students SET user_id = ? WHERE id = ?', [ids.studentUserA, ids.studentA1]);
  await connection.query(
    `INSERT INTO classes (id, school_id, name, class_level, section)
     VALUES (?, ?, 'Class 6 A', 'class_6', 'A'), (?, ?, 'Class 6 B', 'class_6', 'A')`,
    [ids.classA, ids.schoolA, ids.classB, ids.schoolB],
  );
  await connection.query(
    `INSERT INTO academic_years (id, school_id, name, start_date, end_date, status)
     VALUES
       (?, ?, '2026', '2026-01-01', '2026-12-31', 'active'),
       (?, ?, '2026', '2026-01-01', '2026-12-31', 'active')`,
    [ids.yearA, ids.schoolA, ids.yearB, ids.schoolB],
  );
  await connection.query(
    `INSERT INTO student_enrollments
       (id, school_id, academic_year_id, student_id, class_id, roll_number, status)
     VALUES
       (?, ?, ?, ?, ?, '1', 'active'),
       (?, ?, ?, ?, ?, '1', 'active')`,
    [
      ids.enrollmentA, ids.schoolA, ids.yearA, ids.studentA1, ids.classA,
      ids.enrollmentB, ids.schoolB, ids.yearB, ids.studentB1, ids.classB,
    ],
  );
  await connection.query(
    `INSERT INTO guardian_relationships
       (id, school_id, guardian_user_id, student_id, relationship_type, is_primary, has_portal_access)
     VALUES (?, ?, ?, ?, 'mother', 1, 1)`,
    [ids.guardianLinkA, ids.schoolA, ids.guardianUserA, ids.studentA1],
  );
}

suite('Vercel API + MySQL integration', () => {
  let connection: Connection;
  let superToken: string;
  let adminAToken: string;
  let teacherAToken: string;
  let studentAToken: string;
  let guardianAToken: string;
  let phpServer: ChildProcess;
  let phpBase: string;
  let phpAdminToken: string;

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

    const phpPort = await availablePort();
    phpBase = `http://127.0.0.1:${phpPort}/api`;
    phpServer = spawn(
      'php',
      ['-S', `127.0.0.1:${phpPort}`, '-t', 'backend/public', 'backend/public/index.php'],
      { cwd: process.cwd(), env: { ...process.env, API_BASE_PATH: '/api' }, stdio: 'ignore' },
    );
    await waitForHttp(`${phpBase}/health`);

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
    const guardianLogin = await invoke(handler, 'POST', '/api/auth/login', {
      body: { email: 'guardian-a@example.test', password: loginPassword },
    });
    superToken = superLogin.body.data.session.access_token;
    adminAToken = adminLogin.body.data.session.access_token;
    teacherAToken = teacherLogin.body.data.session.access_token;
    studentAToken = studentLogin.body.data.session.access_token;
    guardianAToken = guardianLogin.body.data.session.access_token;

    const phpLogin = await phpRequest(phpBase, 'POST', '/auth/login', {
      body: { email: 'admin-a@example.test', password: loginPassword },
    });
    phpAdminToken = phpLogin.body.data.session.access_token;
  }, 240_000);

  afterAll(async () => {
    phpServer?.kill();
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
    expect(status.applied).toHaveLength(5);
    expect(status.pending).toHaveLength(0);
  });

  it('keeps health and login response contracts aligned across Node and PHP', async () => {
    const nodeHealth = await invoke(handler, 'GET', '/api/health');
    const phpHealth = await phpRequest(phpBase, 'GET', '/health');
    for (const result of [nodeHealth, phpHealth]) {
      expect(result.statusCode).toBe(200);
      for (const field of contract.envelopes.health.required) {
        expect(result.body).toHaveProperty(field);
      }
    }
    expect(nodeHealth.getHeader(contract.requestIdHeader)).toBeTruthy();
    expect(phpHealth.headers.get(contract.requestIdHeader)).toBeTruthy();

    const nodeLogin = await invoke(handler, 'POST', '/api/auth/login', {
      body: { email: 'admin-b@example.test', password: loginPassword },
    });
    const phpLogin = await phpRequest(phpBase, 'POST', '/auth/login', {
      body: { email: 'admin-b@example.test', password: loginPassword },
    });
    for (const result of [nodeLogin, phpLogin]) {
      expect(result.statusCode).toBe(200);
      expect(result.body.data.user.role).toBe('school_admin');
      expect(result.body.data.session.access_token).toEqual(expect.any(String));
    }
  });

  it('keeps authentication failures aligned across Node and PHP', async () => {
    const credentials = { email: 'admin-b@example.test', password: 'wrong-password' };
    const invalidNode = await invoke(handler, 'POST', '/api/auth/login', { body: credentials });
    const invalidPhp = await phpRequest(phpBase, 'POST', '/auth/login', { body: credentials });
    expect([invalidNode.statusCode, invalidPhp.statusCode]).toEqual([401, 401]);

    const inactiveNode = await invoke(handler, 'POST', '/api/auth/login', {
      body: { email: 'inactive@example.test', password: loginPassword },
    });
    const inactivePhp = await phpRequest(phpBase, 'POST', '/auth/login', {
      body: { email: 'inactive@example.test', password: loginPassword },
    });
    expect([inactiveNode.statusCode, inactivePhp.statusCode]).toEqual([403, 403]);

    process.env.JWT_TTL_SECONDS = '-1';
    const expiredToken = issueToken({ sub: ids.adminA });
    process.env.JWT_TTL_SECONDS = '3600';
    const expiredNode = await invoke(handler, 'GET', '/api/auth/me', { token: expiredToken });
    const expiredPhp = await phpRequest(phpBase, 'GET', '/auth/me', { token: expiredToken });
    expect([expiredNode.statusCode, expiredPhp.statusCode]).toEqual([401, 401]);
  });

  it('keeps table authorization and school isolation aligned across Node and PHP', async () => {
    const nodeStudents = await invoke(handler, 'GET', '/api/tables/students?limit=20', {
      token: adminAToken,
      query: { path: ['tables', 'students'], limit: '20' },
    });
    const phpStudents = await phpRequest(phpBase, 'GET', '/tables/students?limit=20', {
      token: phpAdminToken,
    });
    for (const result of [nodeStudents, phpStudents]) {
      expect(result.statusCode).toBe(200);
      expect(result.body.data).toHaveLength(3);
      expect(result.body.data.every((row: any) => row.school_id === ids.schoolA)).toBe(true);
    }

    const nodeForbidden = await invoke(handler, 'POST', '/api/tables/students', {
      token: teacherAToken,
      query: { path: ['tables', 'students'] },
      body: { student_id: 'NOT-ALLOWED' },
    });
    const phpTeacherLogin = await phpRequest(phpBase, 'POST', '/auth/login', {
      body: { email: 'teacher-a@example.test', password: loginPassword },
    });
    const phpForbidden = await phpRequest(phpBase, 'POST', '/tables/students', {
      token: phpTeacherLogin.body.data.session.access_token,
      body: { student_id: 'NOT-ALLOWED' },
    });
    expect([nodeForbidden.statusCode, phpForbidden.statusCode]).toEqual([403, 403]);
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
      await legacy.query(readFileSync('backend/database/migrations/0001_baseline_schema.mysql.sql', 'utf8'));
      const status = await applyMigrations(legacy, { appliedBy: 'legacy-adoption-test' });
      expect(status.pending).toHaveLength(0);
      expect(status.applied).toHaveLength(5);
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
    expect(studentList.statusCode).toBe(200);
    expect(studentList.body.data.map((row: any) => row.id)).toEqual([ids.studentA1]);
  });

  it('scopes academic enrollment and guardian access in both backends', async () => {
    const studentProfile = await invoke(tableRoute, 'GET', '/api/tables/students', {
      token: studentAToken,
      query: { table: 'students' },
    });
    expect(studentProfile.statusCode).toBe(200);
    expect(studentProfile.body.data.map((row: any) => row.id)).toEqual([ids.studentA1]);

    const guardianStudents = await invoke(tableRoute, 'GET', '/api/tables/students', {
      token: guardianAToken,
      query: { table: 'students' },
    });
    const guardianEnrollments = await invoke(tableRoute, 'GET', '/api/tables/student_enrollments', {
      token: guardianAToken,
      query: { table: 'student_enrollments' },
    });
    const guardianLinks = await invoke(tableRoute, 'GET', '/api/tables/guardian_relationships', {
      token: guardianAToken,
      query: { table: 'guardian_relationships' },
    });

    expect(guardianStudents.body.data.map((row: any) => row.id)).toEqual([ids.studentA1]);
    expect(guardianEnrollments.body.data.map((row: any) => row.id)).toEqual([ids.enrollmentA]);
    expect(guardianLinks.body.data.map((row: any) => row.id)).toEqual([ids.guardianLinkA]);

    const crossSchoolEnrollment = await invoke(idRoute, 'GET', `/api/tables/student_enrollments/${ids.enrollmentB}`, {
      token: guardianAToken,
      query: { table: 'student_enrollments', id: ids.enrollmentB },
    });
    expect(crossSchoolEnrollment.statusCode).toBe(404);

    const phpGuardianLogin = await phpRequest(phpBase, 'POST', '/auth/login', {
      body: { email: 'guardian-a@example.test', password: loginPassword },
    });
    const phpEnrollments = await phpRequest(phpBase, 'GET', '/tables/student_enrollments', {
      token: phpGuardianLogin.body.data.session.access_token,
    });
    expect(phpEnrollments.statusCode).toBe(200);
    expect(phpEnrollments.body.data.map((row: any) => row.id)).toEqual([ids.enrollmentA]);
  });

  it('exposes academic foundation tables only within the authenticated school', async () => {
    for (const table of [
      'academic_years', 'academic_terms', 'student_enrollments', 'guardian_relationships',
      'admission_applications', 'class_offerings', 'subject_offerings',
      'assessment_categories', 'grading_scales', 'grading_scale_bands',
      'assessments', 'assessment_scores', 'report_cards', 'report_card_items',
      'guardian_invitations',
    ]) {
      const result = await invoke(tableRoute, 'GET', `/api/tables/${table}`, {
        token: adminAToken,
        query: { table },
      });
      expect(result.statusCode).toBe(200);
      expect(result.body.data.every((row: any) => row.school_id === ids.schoolA)).toBe(true);
    }

    const crossTenantEnrollment = await invoke(tableRoute, 'POST', '/api/tables/student_enrollments', {
      token: adminAToken,
      query: { table: 'student_enrollments' },
      body: {
        academic_year_id: ids.yearB,
        student_id: ids.studentA2,
        class_id: ids.classA,
        status: 'active',
      },
    });
    expect(crossTenantEnrollment.statusCode).toBe(500);
    expect(crossTenantEnrollment.body.error.message).toBe('Internal server error');
  });

  it('runs admission, bulk enrollment, promotion, and guardian linking workflows across Node and PHP', async () => {
    await connection.query(
      `INSERT INTO academic_years (id, school_id, name, start_date, end_date, status)
       VALUES (?, ?, '2027', '2027-01-01', '2027-12-31', 'planned')`,
      [ids.yearA2, ids.schoolA],
    );

    const enrolled = await invoke(handler, 'POST', '/api/academic/bulk-enroll', {
      token: adminAToken,
      query: { path: ['academic', 'bulk-enroll'] },
      body: { academic_year_id: ids.yearA, class_id: ids.classA, student_ids: [ids.studentA2] },
    });
    expect(enrolled.statusCode).toBe(201);
    expect(enrolled.body.data.enrolled).toBe(1);

    const promoted = await phpRequest(phpBase, 'POST', '/academic/promote', {
      token: phpAdminToken,
      body: {
        source_academic_year_id: ids.yearA,
        target_academic_year_id: ids.yearA2,
        target_class_id: ids.classA,
        student_ids: [ids.studentA2],
      },
    });
    expect(promoted.statusCode).toBe(200);
    expect(promoted.body.data.promoted).toBe(1);

    const application = await invoke(tableRoute, 'POST', '/api/tables/admission_applications', {
      token: adminAToken,
      query: { table: 'admission_applications' },
      body: {
        academic_year_id: ids.yearA2,
        requested_class_id: ids.classA,
        application_number: 'APP-2027-001',
        applicant_name: 'Eva Applicant',
        date_of_birth: '2014-05-10',
        gender: 'female',
        guardian_name: 'Eva Guardian',
        guardian_email: 'eva.guardian@example.test',
        guardian_phone: '01710000000',
        status: 'submitted',
      },
    });
    expect(application.statusCode).toBe(201);
    const accepted = await phpRequest(phpBase, 'POST', `/academic/admissions/${application.body.data.id}/accept`, {
      token: phpAdminToken,
      body: { student_number: 'A-2027-001', class_id: ids.classA },
    });
    expect(accepted.statusCode).toBe(201);
    expect(accepted.body.data.student_id).toBeTruthy();
    expect(accepted.body.data.enrollment_id).toBeTruthy();

    const invitation = await invoke(handler, 'POST', '/api/academic/guardian-invitations', {
      token: adminAToken,
      query: { path: ['academic', 'guardian-invitations'] },
      body: {
        student_id: ids.studentA3,
        email: 'guardian-a@example.test',
        relationship_type: 'legal_guardian',
      },
    });
    expect(invitation.statusCode).toBe(201);
    const phpGuardianLogin = await phpRequest(phpBase, 'POST', '/auth/login', {
      body: { email: 'guardian-a@example.test', password: loginPassword },
    });
    const linked = await phpRequest(phpBase, 'POST', '/academic/accept-guardian-invitation', {
      token: phpGuardianLogin.body.data.session.access_token,
      body: { token: invitation.body.data.token },
    });
    expect(linked.statusCode).toBe(200);

    const guardianStudents = await invoke(tableRoute, 'GET', '/api/tables/students', {
      token: guardianAToken,
      query: { table: 'students', sort: 'student_id', order: 'asc' },
    });
    expect(guardianStudents.body.data.map((row: any) => row.id)).toEqual([ids.studentA1, ids.studentA3]);

    const teacherDenied = await invoke(handler, 'POST', '/api/academic/bulk-enroll', {
      token: teacherAToken,
      query: { path: ['academic', 'bulk-enroll'] },
      body: { academic_year_id: ids.yearA2, class_id: ids.classA, student_ids: [ids.studentA3] },
    });
    expect(teacherDenied.statusCode).toBe(403);
  });

  it('runs isolated invoice, adjustment, payment, receipt, and guardian billing workflows across Node and PHP', async () => {
    const category = await invoke(tableRoute, 'POST', '/api/tables/fee_categories', {
      token: adminAToken,
      query: { table: 'fee_categories' },
      body: { code: 'TUITION', name: 'Tuition', is_active: 1 },
    });
    expect(category.statusCode).toBe(201);
    const plan = await invoke(tableRoute, 'POST', '/api/tables/fee_plans', {
      token: adminAToken,
      query: { table: 'fee_plans' },
      body: {
        academic_year_id: ids.yearA, name: 'Annual tuition', currency: 'USD',
        billing_frequency: 'annual', status: 'active',
      },
    });
    expect(plan.statusCode).toBe(201);
    const planItem = await invoke(tableRoute, 'POST', '/api/tables/fee_plan_items', {
      token: adminAToken,
      query: { table: 'fee_plan_items' },
      body: {
        fee_plan_id: plan.body.data.id, fee_category_id: category.body.data.id,
        description: 'Annual tuition', amount: 1200, due_offset_days: 0, is_optional: 0,
      },
    });
    expect(planItem.statusCode).toBe(201);

    const generated = await invoke(handler, 'POST', '/api/billing/invoices/generate', {
      token: adminAToken,
      query: { path: ['billing', 'invoices', 'generate'] },
      body: {
        fee_plan_id: plan.body.data.id, student_enrollment_ids: [ids.enrollmentA],
        issue_date: '2026-01-01', due_date: '2026-02-01',
      },
    });
    expect(generated.statusCode).toBe(201);
    expect(generated.body.data.created).toBe(1);
    const invoiceId = generated.body.data.invoice_ids[0];

    const adjusted = await invoke(handler, 'POST', `/api/billing/invoices/${invoiceId}/adjustments`, {
      token: adminAToken,
      query: { path: ['billing', 'invoices', invoiceId, 'adjustments'] },
      body: { adjustment_type: 'discount', amount: 200, reason: 'Merit scholarship' },
    });
    expect(adjusted.statusCode).toBe(201);

    const paid = await phpRequest(phpBase, 'POST', '/billing/payments', {
      token: phpAdminToken,
      body: {
        student_invoice_id: invoiceId, amount: 400, currency: 'USD',
        payment_method: 'bank_transfer', external_reference: 'BANK-001',
      },
    });
    expect(paid.statusCode).toBe(201);
    expect(paid.body.data.receipt_number).toMatch(/^RCT-/);

    const invoice = await invoke(idRoute, 'GET', `/api/tables/student_invoices/${invoiceId}`, {
      token: adminAToken,
      query: { table: 'student_invoices', id: invoiceId },
    });
    expect(Number(invoice.body.data.total_amount)).toBe(1000);
    expect(Number(invoice.body.data.paid_amount)).toBe(400);
    expect(Number(invoice.body.data.balance_amount)).toBe(600);
    expect(invoice.body.data.status).toBe('partially_paid');

    await connection.query(
      'UPDATE guardian_relationships SET receives_financial_updates = 1 WHERE id = ?',
      [ids.guardianLinkA],
    );
    const guardianInvoices = await invoke(tableRoute, 'GET', '/api/tables/student_invoices', {
      token: guardianAToken,
      query: { table: 'student_invoices' },
    });
    expect(guardianInvoices.statusCode).toBe(200);
    expect(guardianInvoices.body.data.map((row: any) => row.id)).toContain(invoiceId);

    const adminBInvoices = await invoke(tableRoute, 'GET', '/api/tables/student_invoices', {
      token: issueToken({ sub: ids.adminB }),
      query: { table: 'student_invoices' },
    });
    expect(adminBInvoices.body.data).toHaveLength(0);

    const teacherDenied = await invoke(handler, 'POST', '/api/billing/payments', {
      token: teacherAToken,
      query: { path: ['billing', 'payments'] },
      body: { student_invoice_id: invoiceId, amount: 10, currency: 'USD', payment_method: 'cash' },
    });
    expect(teacherDenied.statusCode).toBe(403);
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
