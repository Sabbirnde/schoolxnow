import mysql, { type Pool, type PoolConnection, type RowDataPacket } from 'mysql2/promise';
import { ApiError } from './http.js';
import { logMySqlError, monitorDatabaseError } from './monitoring.js';

let pool: Pool | null = null;
const queryTimeoutMs = Math.max(Number(process.env.DB_QUERY_TIMEOUT_MS || 8_000), 1_000);

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
    connectionLimit: Math.min(Math.max(Number(process.env.DB_CONNECTION_LIMIT || 3), 1), 10),
    maxIdle: Math.min(Math.max(Number(process.env.DB_MAX_IDLE_CONNECTIONS || 1), 0), 5),
    idleTimeout: Math.max(Number(process.env.DB_IDLE_TIMEOUT_MS || 60_000), 10_000),
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    namedPlaceholders: true,
    timezone: 'Z',
    connectTimeout: 5000,
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
  try {
    const [rows] = await executor.execute<T>({ sql, timeout: queryTimeoutMs }, params as any);
    return rows;
  } catch (error) {
    logMySqlError(error, 'query');
    monitorDatabaseError(error);
    throw error;
  }
}

export async function execute(
  sql: string,
  params: Record<string, unknown> = {},
  connection?: PoolConnection,
) {
  const executor = connection ?? db();
  try {
    const [result] = await executor.execute({ sql, timeout: queryTimeoutMs }, params as any);
    return result;
  } catch (error) {
    logMySqlError(error, 'execute');
    monitorDatabaseError(error);
    throw error;
  }
}

export async function transaction<T>(fn: (connection: PoolConnection) => Promise<T>): Promise<T> {
  let connection: PoolConnection;
  try {
    connection = await db().getConnection();
  } catch (error) {
    logMySqlError(error, 'get_connection');
    monitorDatabaseError(error);
    throw error;
  }
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
