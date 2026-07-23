import mysql, { type Pool, type PoolConnection, type RowDataPacket } from 'mysql2/promise';
import { ApiError } from './http.js';

let pool: Pool | null = null;

function env(...keys: string[]) {
  for (const key of keys) {
    const value = process.env[key];
    if (value) {
      return value;
    }
  }

  return undefined;
}

export function db(): Pool {
  if (pool) {
    return pool;
  }

  const database = env('DB_DATABASE', 'MYSQL_DATABASE', 'MYSQL_DATABASE_NAME');
  const user = env('DB_USERNAME', 'MYSQL_USER', 'MYSQL_USERNAME');
  const password = env('DB_PASSWORD', 'MYSQL_PASSWORD');
  const host = env('DB_HOST', 'MYSQL_HOST');
  const isProduction = process.env.VERCEL_ENV === 'production';

  if (isProduction && process.env.DB_SSL !== 'true') {
    throw new ApiError(500, 'Secure database transport is required in production');
  }
  if (!host || !database || !user || !password) {
    throw new ApiError(500, 'Database environment variables are missing');
  }

  pool = mysql.createPool({
    host,
    port: Number(env('DB_PORT', 'MYSQL_PORT') || 3306),
    database,
    user,
    password,
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 5),
    namedPlaceholders: true,
    timezone: 'Z',
    ssl:
      process.env.DB_SSL === 'true'
        ? {
            rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
          }
        : undefined,
  });

  return pool;
}

export async function query<T extends RowDataPacket[] = RowDataPacket[]>(
  sql: string,
  params: Record<string, unknown> = {},
  connection?: PoolConnection,
): Promise<T> {
  const executor = connection ?? db();
  const [rows] = await executor.execute<T>(sql, params as any);
  return rows;
}

export async function execute(
  sql: string,
  params: Record<string, unknown> = {},
  connection?: PoolConnection,
) {
  const executor = connection ?? db();
  const [result] = await executor.execute(sql, params as any);
  return result;
}

export async function transaction<T>(fn: (connection: PoolConnection) => Promise<T>): Promise<T> {
  const connection = await db().getConnection();
  await connection.beginTransaction();

  try {
    const result = await fn(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
