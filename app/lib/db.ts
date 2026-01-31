import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';

if (!process.env.DB_FILE_NAME) {
  throw new Error('DB_FILE_NAME environment variable is required');
}

const client = createClient({
  url: process.env.DB_FILE_NAME,
  intMode: 'number', // Better performance for integers
});

export const db = drizzle(client, {
  logger: process.env.NODE_ENV === 'development',
});