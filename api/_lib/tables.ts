import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomUUID } from 'node:crypto';
import type { ApiUser } from './auth.js';
import { canManage, requireUser } from './auth.js';
import { execute, query } from './db.js';
import { ApiError, readJsonBody, sendData } from './http.js';

const ALLOWED_TABLES = [
  'schools',
  'user_profiles',
  'user_roles',
  'classes',
  'students',
  'subjects',
  'teachers',
  'attendance',
  'exams',
  'exam_results',
  'timetable',
  'teacher_applications',
  'audit_logs',
  'system_settings',
  'notifications',
  'notification_settings',
  'feedback_submissions',
];

const SCHOOL_SCOPED = [
  'classes',
  'students',
  'subjects',
  'teachers',
  'attendance',
  'exams',
  'exam_results',
  'timetable',
  'teacher_applications',
  'audit_logs',
  'notifications',
  'notification_settings',
  'feedback_submissions',
];

function assertTable(table: string) {
  if (!ALLOWED_TABLES.includes(table)) {
    throw new ApiError(404, 'Table is not available through API');
  }

  return table;
}

function isIdentifier(value: string) {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value);
}

function scopeWhere(table: string, user: ApiUser, params: Record<string, unknown>) {
  if (user.role === 'super_admin') {
    return [];
  }

  if (table === 'schools') {
    params.scope_school_id = user.school_id;
    return ['id = :scope_school_id'];
  }

  if (table === 'user_profiles') {
    if (user.role === 'school_admin') {
      params.scope_school_id = user.school_id;
      return ['school_id = :scope_school_id'];
    }

    params.scope_user_id = user.id;
    return ['user_id = :scope_user_id'];
  }

  if (table === 'notifications') {
    params.scope_school_id = user.school_id;
    if (user.role === 'school_admin') {
      return ['school_id = :scope_school_id'];
    }

    params.scope_user_id = user.id;
    return ['school_id = :scope_school_id', '(user_id IS NULL OR user_id = :scope_user_id)'];
  }

  if (table === 'notification_settings') {
    params.scope_school_id = user.school_id;
    params.scope_user_id = user.id;
    return ['school_id = :scope_school_id', 'user_id = :scope_user_id'];
  }

  if (table === 'feedback_submissions') {
    params.scope_school_id = user.school_id;
    if (user.role === 'school_admin') {
      return ['school_id = :scope_school_id'];
    }

    params.scope_user_id = user.id;
    return ['school_id = :scope_school_id', 'user_id = :scope_user_id'];
  }

  if (SCHOOL_SCOPED.includes(table)) {
    params.scope_school_id = user.school_id;
    return ['school_id = :scope_school_id'];
  }

  throw new ApiError(403, 'Forbidden');
}

function firstQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function appendFilters(req: VercelRequest, where: string[], params: Record<string, unknown>) {
  for (const [rawKey, rawValue] of Object.entries(req.query)) {
    if (['path', 'limit', 'offset', 'sort', 'order'].includes(rawKey)) {
      continue;
    }

    const matches = /^([a-zA-Z_][a-zA-Z0-9_]*?)(__(gte|lte|gt|lt|ne))?$/.exec(rawKey);
    if (!matches) {
      continue;
    }

    const column = matches[1];
    const operator =
      matches[3] === 'gte'
        ? '>='
        : matches[3] === 'lte'
          ? '<='
          : matches[3] === 'gt'
            ? '>'
            : matches[3] === 'lt'
              ? '<'
              : matches[3] === 'ne'
                ? '!='
                : '=';
    const param = `filter_${rawKey.replace(/[^a-zA-Z0-9_]/g, '_')}`;
    where.push(`${column} ${operator} :${param}`);
    params[param] = firstQueryValue(rawValue);
  }
}

function orderBy(req: VercelRequest) {
  const requestedSort = String(firstQueryValue(req.query.sort) || 'created_at');
  const sort = isIdentifier(requestedSort) ? requestedSort : 'created_at';
  const order = String(firstQueryValue(req.query.order) || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  return `${sort} ${order}`;
}

function normalizeValue(value: unknown) {
  if (value !== null && typeof value === 'object') {
    return JSON.stringify(value);
  }

  return value;
}

async function showRecord(res: VercelResponse, table: string, id: string, user: ApiUser) {
  const params: Record<string, unknown> = { id };
  const where = ['id = :id', ...scopeWhere(table, user, params)];
  const rows = await query(`SELECT * FROM ${table} WHERE ${where.join(' AND ')} LIMIT 1`, params);
  const row = rows[0];

  if (!row) {
    throw new ApiError(404, 'Record not found');
  }

  return sendData(res, row);
}

export async function handleTable(req: VercelRequest, res: VercelResponse, segments: string[]) {
  const table = assertTable(segments[1] || '');
  const idOrCount = segments[2];
  const user = await requireUser(req);

  if (req.method === 'GET' && idOrCount === 'count') {
    const params: Record<string, unknown> = {};
    const where = scopeWhere(table, user, params);
    appendFilters(req, where, params);
    const rows = await query(`SELECT COUNT(*) AS total FROM ${table}${where.length ? ` WHERE ${where.join(' AND ')}` : ''}`, params);
    return sendData(res, { count: Number(rows[0]?.total || 0) });
  }

  if (req.method === 'GET' && idOrCount) {
    return showRecord(res, table, idOrCount, user);
  }

  if (req.method === 'GET') {
    const params: Record<string, unknown> = {};
    const where = scopeWhere(table, user, params);
    appendFilters(req, where, params);
    const limit = Math.min(Math.max(Number(firstQueryValue(req.query.limit) || 50), 1), 200);
    const offset = Math.max(Number(firstQueryValue(req.query.offset) || 0), 0);
    const rows = await query(
      `SELECT * FROM ${table}${where.length ? ` WHERE ${where.join(' AND ')}` : ''} ORDER BY ${orderBy(req)} LIMIT ${limit} OFFSET ${offset}`,
      params,
    );
    return sendData(res, rows);
  }

  if (req.method === 'POST' && !idOrCount) {
    if (table === 'audit_logs' && user.role !== 'super_admin') {
      throw new ApiError(403, 'Audit logs are append-only');
    }

    if (!canManage(user, table)) {
      throw new ApiError(403, 'Forbidden');
    }

    const body = readJsonBody(req);
    const row: Record<string, unknown> = { ...body, id: body.id || randomUUID() };
    if (SCHOOL_SCOPED.includes(table) && user.role !== 'super_admin') {
      row.school_id = user.school_id;
    }
    if (['notification_settings', 'feedback_submissions'].includes(table) && user.role !== 'super_admin') {
      row.user_id = user.id;
    }

    const columns = Object.keys(row).filter(isIdentifier);
    const placeholders = columns.map((column) => `:${column}`);
    const params = Object.fromEntries(columns.map((column) => [column, normalizeValue(row[column])]));
    await execute(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`, params);
    return sendData(res, row, 201);
  }

  if (req.method === 'PATCH' && idOrCount) {
    if (table === 'audit_logs' && user.role !== 'super_admin') {
      throw new ApiError(403, 'Audit logs are append-only');
    }

    if (!canManage(user, table)) {
      throw new ApiError(403, 'Forbidden');
    }

    const body = readJsonBody(req);
    delete body.id;
    delete body.created_at;
    const columns = Object.keys(body).filter(isIdentifier);
    if (columns.length === 0) {
      throw new ApiError(422, 'No fields to update');
    }

    const params: Record<string, unknown> = { id: idOrCount };
    const sets = columns.map((column) => {
      params[column] = normalizeValue(body[column]);
      return `${column} = :${column}`;
    });
    const where = ['id = :id', ...scopeWhere(table, user, params)];
    await execute(`UPDATE ${table} SET ${sets.join(', ')} WHERE ${where.join(' AND ')}`, params);
    return showRecord(res, table, idOrCount, user);
  }

  if (req.method === 'DELETE' && idOrCount) {
    if (!canManage(user, table)) {
      throw new ApiError(403, 'Forbidden');
    }

    const params: Record<string, unknown> = { id: idOrCount };
    const where = ['id = :id', ...scopeWhere(table, user, params)];
    await execute(`DELETE FROM ${table} WHERE ${where.join(' AND ')}`, params);
    return res.status(204).end();
  }

  throw new ApiError(405, 'Method not allowed');
}
