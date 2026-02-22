/**
 * Validates drizzle migration files for common issues:
 * 1. Out-of-order timestamps in _journal.json
 * 2. Missing --> statement-breakpoint separators between SQL statements
 *
 * Run: bun run db:validate
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const DRIZZLE_DIR = join(import.meta.dir, '..', 'drizzle');

interface JournalEntry {
  idx: number;
  version: string;
  when: number;
  tag: string;
  breakpoints: boolean;
}

interface Journal {
  version: string;
  dialect: string;
  entries: JournalEntry[];
}

let hasErrors = false;

function error(msg: string) {
  console.error(`  ✗ ${msg}`);
  hasErrors = true;
}

function ok(msg: string) {
  console.log(`  ✓ ${msg}`);
}

// --- Check 1: Journal timestamps are monotonically increasing ---

console.log('\nChecking journal timestamps...');

const journal: Journal = JSON.parse(
  readFileSync(join(DRIZZLE_DIR, 'meta', '_journal.json'), 'utf-8')
);

let prevWhen = 0;
let prevTag = '';
for (const entry of journal.entries) {
  if (entry.when <= prevWhen) {
    error(
      `${entry.tag} has timestamp ${entry.when} which is <= previous migration ${prevTag} (${prevWhen}). ` +
      `Timestamps must be strictly increasing.`
    );
  }
  prevWhen = entry.when;
  prevTag = entry.tag;
}

if (!hasErrors) {
  ok(`All ${journal.entries.length} journal timestamps are in order`);
}

// --- Check 2: SQL files have statement-breakpoints between statements ---

console.log('\nChecking SQL files for missing statement-breakpoints...');

// SQL statements that start a new executable statement
const SQL_STATEMENT_STARTS = /^\s*(CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|PRAGMA|BEGIN|COMMIT|ROLLBACK)\b/i;

let filesChecked = 0;
let filesWithIssues = 0;

for (const entry of journal.entries) {
  const filePath = join(DRIZZLE_DIR, `${entry.tag}.sql`);
  let content: string;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch {
    error(`Missing SQL file: ${entry.tag}.sql`);
    continue;
  }

  filesChecked++;

  // Split on breakpoints to get chunks
  const chunks = content.split('--> statement-breakpoint');

  let fileHasIssue = false;
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i].trim();
    if (!chunk) continue;

    // Split chunk into lines, find executable SQL statements
    const lines = chunk.split('\n');
    const stmtLines: { lineNum: number; line: string }[] = [];

    for (let j = 0; j < lines.length; j++) {
      const line = lines[j].trim();
      if (SQL_STATEMENT_STARTS.test(line)) {
        stmtLines.push({ lineNum: j + 1, line });
      }
    }

    if (stmtLines.length > 1) {
      if (!fileHasIssue) {
        filesWithIssues++;
        fileHasIssue = true;
      }
      error(
        `${entry.tag}.sql: chunk ${i + 1} has ${stmtLines.length} SQL statements without breakpoints between them:\n` +
        stmtLines.map(s => `      - ${s.line.substring(0, 80)}`).join('\n')
      );
    }
  }
}

if (filesWithIssues === 0) {
  ok(`All ${filesChecked} SQL files have proper statement-breakpoints`);
}

// --- Summary ---

console.log('');
if (hasErrors) {
  console.error('Migration validation FAILED - see errors above');
  process.exit(1);
} else {
  console.log('Migration validation passed ✓\n');
}
