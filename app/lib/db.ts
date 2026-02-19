import { drizzle, LibSQLDatabase } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';

// Allow test database override
let testDbOverride: LibSQLDatabase | null = null;

export function setTestDb(testDb: LibSQLDatabase) {
  testDbOverride = testDb;
}

export function clearTestDb() {
  testDbOverride = null;
}

// Create production database (skip if DB_FILE_NAME is :memory: - used for tests)
function createProductionDb() {
  if (!process.env.DB_FILE_NAME) {
    throw new Error('DB_FILE_NAME environment variable is required');
  }

  // For in-memory databases used in tests, we'll use the override instead
  if (process.env.DB_FILE_NAME === ':memory:') {
    // Return a dummy database that will never be used (testDbOverride will be set)
    const client = createClient({ url: ':memory:', intMode: 'number' });
    return drizzle(client);
  }

  const filePath = process.env.DB_FILE_NAME.replace(/^file:/, '');
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const client = createClient({
    url: process.env.DB_FILE_NAME,
    intMode: 'number',
  });

  return drizzle(client, {
    logger: process.env.NODE_ENV === 'development',
  });
}

const productionDb = createProductionDb();

// Export db that checks for test override
export const db = new Proxy(productionDb, {
  get(target, prop) {
    const dbToUse = testDbOverride || target;
    // Proxy requires dynamic property access
    const value = (dbToUse as any)[prop]; // eslint-disable-line @typescript-eslint/no-explicit-any
    // Bind functions to the correct database instance so `this` works properly
    if (typeof value === 'function') {
      return value.bind(dbToUse);
    }
    return value;
  }
});