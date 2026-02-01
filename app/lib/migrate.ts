import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { createClient } from '@libsql/client';
import { mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';

let migrationRun = false;

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

    // Run migrations from the drizzle folder
    await migrate(db, { migrationsFolder: './drizzle' });

    migrationRun = true;
    console.log('✓ Database migrations completed successfully');
  } catch (error) {
    console.error('✗ Database migration failed:', error);
    throw error; // Re-throw to fail fast
  }
}
