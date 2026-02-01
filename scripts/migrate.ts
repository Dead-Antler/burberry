import { mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';
import { spawnSync } from 'child_process';

// Ensure data directory exists before running migrations
const dbPath = process.env.DB_FILE_NAME;

if (!dbPath) {
  console.error('DB_FILE_NAME environment variable is required');
  process.exit(1);
}

// Extract file path from the connection string (e.g., "file:data/database.db" -> "data/database.db")
const filePath = dbPath.replace(/^file:/, '');
const dir = dirname(filePath);

if (!existsSync(dir)) {
  console.log(`Creating directory: ${dir}`);
  mkdirSync(dir, { recursive: true });
}

// Run drizzle-kit migrate
const result = spawnSync('bunx', ['drizzle-kit', 'migrate'], {
  stdio: 'inherit',
  shell: true,
});

process.exit(result.status ?? 1);
