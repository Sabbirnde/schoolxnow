import process from 'node:process';
import mysql from 'mysql2/promise';
import { envValue, isPlaceholder, readEnvFile } from './lib/env-file.mjs';

const args = process.argv.slice(2);
const valueAfter = (flag) => {
  const index = args.indexOf(flag);
  return index === -1 ? null : args[index + 1];
};
const env = args.includes('--process-env')
  ? process.env
  : readEnvFile(valueAfter('--env') || '.env.vercel.local');
const schoolId = valueAfter('--school-id');

if (!env || !schoolId) {
  console.error('Usage: npm run db:explain -- --school-id <uuid> [--class-id <uuid>] [--process-env|--env <file>]');
  process.exit(1);
}

const config = {
  host: envValue(env, 'DB_HOST', 'MYSQL_HOST'),
  port: Number(envValue(env, 'DB_PORT', 'MYSQL_PORT') || 3306),
  database: envValue(env, 'DB_DATABASE', 'MYSQL_DATABASE', 'MYSQL_DATABASE_NAME'),
  user: envValue(env, 'DB_USERNAME', 'MYSQL_USER', 'MYSQL_USERNAME'),
  password: envValue(env, 'DB_PASSWORD', 'MYSQL_PASSWORD'),
};
if (Object.entries(config).some(([key, value]) => key !== 'port' && isPlaceholder(value))) {
  console.error('Database configuration is missing or contains placeholders.');
  process.exit(1);
}

const plans = [
  {
    name: 'active students',
    sql: "SELECT id, full_name, class_id FROM students WHERE school_id = ? AND status = 'active' ORDER BY admission_date DESC LIMIT 50",
    params: [schoolId],
  },
  {
    name: 'class attendance by date',
    sql: 'SELECT id, student_id, is_present FROM attendance WHERE school_id = ? AND date = UTC_DATE() AND class_id = ? LIMIT 200',
    params: [schoolId, valueAfter('--class-id') || '00000000-0000-0000-0000-000000000000'],
  },
  {
    name: 'overdue invoices',
    sql: "SELECT id, student_enrollment_id, balance_amount FROM student_invoices WHERE school_id = ? AND status = 'overdue' AND due_date <= UTC_DATE() ORDER BY due_date LIMIT 100",
    params: [schoolId],
  },
];

const connection = await mysql.createConnection({
  ...config,
  ssl: env.DB_SSL === 'true'
    ? { rejectUnauthorized: env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' }
    : undefined,
});

try {
  for (const plan of plans) {
    const [rows] = await connection.query(`EXPLAIN ANALYZE ${plan.sql}`, plan.params);
    console.log(`\n${plan.name}\n${rows.map((row) => row.EXPLAIN).join('\n')}`);
  }
} finally {
  await connection.end();
}
