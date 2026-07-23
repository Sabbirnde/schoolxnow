import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const MIGRATION_PATTERN = /^(\d{4})_([a-z0-9_]+)\.mysql\.sql$/;
const LEGACY_CHECKSUMS = new Map([
  // Recorded by the pre-canonical Windows runner when migration 0002 was
  // introduced. The SQL was verified before this one-time normalization.
  [2, ['189aa01167aa07411a030a3d679f248c15b271cdd9401ff0ae490abf1c2bbe17']],
]);

export function listMigrations(root = process.cwd()) {
  const directory = path.resolve(root, 'backend/database/migrations');
  if (!fs.existsSync(directory)) {
    throw new Error(`Migration directory does not exist: ${directory}`);
  }

  const migrations = fs.readdirSync(directory)
    .filter((name) => name.endsWith('.mysql.sql'))
    .map((filename) => {
      const match = MIGRATION_PATTERN.exec(filename);
      if (!match) {
        throw new Error(`Migration must use NNNN_description.mysql.sql: ${filename}`);
      }
      const sql = fs.readFileSync(path.join(directory, filename), 'utf8');
      if (sql.trim() === '') {
        throw new Error(`Migration is empty: ${filename}`);
      }
      const canonicalSql = sql.replace(/\r\n/g, '\n');
      const lfChecksum = crypto.createHash('sha256').update(canonicalSql).digest('hex');
      const crlfChecksum = crypto.createHash('sha256').update(canonicalSql.replace(/\n/g, '\r\n')).digest('hex');
      return {
        version: Number(match[1]),
        name: match[2],
        filename,
        sql,
        checksum: lfChecksum,
        compatibleChecksums: new Set([
          lfChecksum,
          crlfChecksum,
          ...(LEGACY_CHECKSUMS.get(Number(match[1])) || []),
        ]),
      };
    })
    .sort((a, b) => a.version - b.version);

  const seen = new Set();
  for (const migration of migrations) {
    if (seen.has(migration.version)) {
      throw new Error(`Duplicate migration version: ${migration.version}`);
    }
    seen.add(migration.version);
  }
  if (migrations.length === 0 || migrations[0].version !== 1) {
    throw new Error('Migrations must start at version 0001.');
  }
  for (let index = 0; index < migrations.length; index += 1) {
    if (migrations[index].version !== index + 1) {
      throw new Error(`Missing migration version ${String(index + 1).padStart(4, '0')}.`);
    }
  }

  return migrations;
}

export async function ensureMigrationTable(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INT UNSIGNED NOT NULL PRIMARY KEY,
      name VARCHAR(191) NOT NULL,
      checksum CHAR(64) NOT NULL,
      applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      execution_ms INT UNSIGNED NOT NULL DEFAULT 0,
      applied_by VARCHAR(191) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function tableExists(connection, table) {
  const [rows] = await connection.execute(
    `SELECT COUNT(*) AS count
     FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name = ?`,
    [table],
  );
  return Number(rows[0]?.count || 0) > 0;
}

const baselineTables = [
  'users', 'schools', 'user_profiles', 'user_roles', 'classes', 'students',
  'subjects', 'teachers', 'attendance', 'exams', 'exam_results', 'timetable',
  'teacher_applications', 'audit_logs', 'system_settings', 'notifications',
  'notification_settings', 'feedback_submissions',
];

async function assertCompleteLegacyBaseline(connection) {
  const missing = [];
  for (const table of baselineTables) {
    if (!await tableExists(connection, table)) {
      missing.push(table);
    }
  }
  if (missing.length) {
    throw new Error(`Cannot adopt incomplete legacy baseline; missing tables: ${missing.join(', ')}`);
  }
}

export async function migrationStatus(connection, root = process.cwd()) {
  const migrations = listMigrations(root);
  await ensureMigrationTable(connection);
  const [rows] = await connection.query(
    'SELECT version, name, checksum, applied_at, execution_ms, applied_by FROM schema_migrations ORDER BY version',
  );
  const applied = new Map(rows.map((row) => [Number(row.version), row]));

  for (const migration of migrations) {
    const record = applied.get(migration.version);
    if (record && record.checksum !== migration.checksum) {
      if (migration.compatibleChecksums.has(record.checksum)) {
        await connection.execute(
          'UPDATE schema_migrations SET checksum = ? WHERE version = ? AND checksum = ?',
          [migration.checksum, migration.version, record.checksum],
        );
        record.checksum = migration.checksum;
      } else {
        throw new Error(`Checksum mismatch for applied migration ${migration.filename}. Never edit an applied migration.`);
      }
    }
  }
  for (const record of rows) {
    if (!migrations.some((migration) => migration.version === Number(record.version))) {
      throw new Error(`Database contains unknown migration version ${record.version}.`);
    }
  }

  return {
    migrations,
    applied: rows,
    pending: migrations.filter((migration) => !applied.has(migration.version)),
  };
}

export async function applyMigrations(connection, {
  root = process.cwd(),
  appliedBy = 'schoolxnow-migrator',
  onProgress = () => {},
} = {}) {
  const [lockRows] = await connection.query("SELECT GET_LOCK('schoolxnow_schema_migrations', 30) AS acquired");
  if (Number(lockRows[0]?.acquired) !== 1) {
    throw new Error('Could not acquire the database migration lock.');
  }

  try {
    const status = await migrationStatus(connection, root);
    let baselineAdopted = false;
    for (const migration of status.pending) {
      const started = Date.now();

      // Existing installations predate schema_migrations. Adopt the immutable
      // baseline only when its core table is already present; fresh databases
      // execute the complete baseline SQL.
      if (
        migration.version === 1 &&
        status.applied.length === 0 &&
        await tableExists(connection, 'users')
      ) {
        await assertCompleteLegacyBaseline(connection);
        baselineAdopted = true;
        onProgress({ migration, action: 'baseline' });
      } else {
        onProgress({ migration, action: 'apply' });
        await connection.query(migration.sql);
      }

      await connection.execute(
        `INSERT INTO schema_migrations
           (version, name, checksum, execution_ms, applied_by)
         VALUES (?, ?, ?, ?, ?)`,
        [
          migration.version,
          migration.name,
          migration.checksum,
          Date.now() - started,
          baselineAdopted && migration.version === 1 ? `${appliedBy}:baseline` : appliedBy,
        ],
      );
    }

    return migrationStatus(connection, root);
  } finally {
    await connection.query("SELECT RELEASE_LOCK('schoolxnow_schema_migrations')");
  }
}
