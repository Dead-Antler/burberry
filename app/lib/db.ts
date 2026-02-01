import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';

if (!process.env.DB_FILE_NAME) {
  throw new Error('DB_FILE_NAME environment variable is required');
}

// Ensure database directory exists (libsql creates the file, but not the directory)
const filePath = process.env.DB_FILE_NAME.replace(/^file:/, '');
const dir = dirname(filePath);
if (!existsSync(dir)) {
  mkdirSync(dir, { recursive: true });
}

const client = createClient({
  url: process.env.DB_FILE_NAME,
  intMode: 'number', // Better performance for integers
});

export const db = drizzle(client, {
  logger: process.env.NODE_ENV === 'development',
});