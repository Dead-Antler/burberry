import { join } from 'path';

/**
 * Resolve the data directory from environment or DB_FILE_NAME.
 *
 * Priority:
 *   1. DATA_DIR env var (explicit override)
 *   2. Directory containing the database file (derived from DB_FILE_NAME)
 *   3. Fallback: <cwd>/data
 *
 * In Docker, mount a single volume at DATA_DIR to persist both
 * the database and uploaded files.
 */
function resolveDataDir(): string {
  if (process.env.DATA_DIR) {
    return process.env.DATA_DIR;
  }

  // Derive from DB_FILE_NAME (e.g. "file:data/database.db" → "data")
  const dbFile = process.env.DB_FILE_NAME;
  if (dbFile && dbFile !== ':memory:') {
    const filePath = dbFile.replace(/^file:/, '');
    // Go up one level from the db file to get the data dir
    const parts = filePath.split('/');
    if (parts.length > 1) {
      return parts.slice(0, -1).join('/');
    }
  }

  return join(process.cwd(), 'data');
}

export const DATA_DIR = resolveDataDir();

/** Directory for avatar uploads */
export const AVATAR_UPLOAD_DIR = join(DATA_DIR, 'uploads', 'avatars');
