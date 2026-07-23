import process from 'node:process';
import { listMigrations } from './lib/migrations.mjs';

try {
  const migrations = listMigrations(process.cwd());
  for (const migration of migrations) {
    console.log(`OK ${migration.filename} ${migration.checksum.slice(0, 12)}`);
  }
  console.log(`OK ${migrations.length} ordered migration(s) validated.`);
} catch (error) {
  console.error(`MISS ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
