import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { sql } from 'drizzle-orm';
import { createClient } from '@libsql/client';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';

let migrationRun = false;

const MIGRATIONS_FOLDER = './drizzle';

/**
 * Run database migrations programmatically
 * This ensures the database schema is up-to-date before the application starts
 * Safe to call multiple times - will only run once per process
 */
export async function runMigrations() {
  if (migrationRun) {
    console.log('Migrations already run in this process, skipping...');
    return;
  }

  console.log('Running database migrations...');

  // Ensure database directory exists (libsql creates the file, but not the directory)
  const filePath = process.env.DB_FILE_NAME!.replace(/^file:/, '');
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  try {
    const client = createClient({
      url: process.env.DB_FILE_NAME!
    });
    const db = drizzle(client);

    // Log available migrations for debugging
    const migrations = readMigrationFiles({ migrationsFolder: MIGRATIONS_FOLDER });
    console.log(`Found ${migrations.length} migrations in ${MIGRATIONS_FOLDER}`);

    // Check current migration state
    try {
      const rows = await db.all<{ id: number; hash: string; created_at: number }>(
        sql`SELECT id, hash, created_at FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 1`
      );
      if (rows.length > 0) {
        console.log(`Last applied migration: created_at=${rows[0].created_at}`);
      } else {
        console.log('Fresh database - no migrations applied yet');
      }
    } catch {
      console.log('Fresh database - migrations table does not exist yet');
    }

    // Run migrations from the drizzle folder
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });

    migrationRun = true;
    console.log('✓ Database migrations completed successfully');
  } catch (error) {
    console.error('✗ Database migration failed:', error);
    if (error instanceof Error && error.cause) {
      console.error('  Caused by:', error.cause);
    }
    throw error; // Re-throw to fail fast
  }
}
