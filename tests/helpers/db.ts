/**
 * Test Database Helper
 * Provides utilities for setting up and tearing down test databases
 */

import { drizzle, LibSQLDatabase } from 'drizzle-orm/libsql';
import { createClient, Client } from '@libsql/client';
import { sql } from 'drizzle-orm';
import { unlinkSync } from 'fs';
import * as schema from '../../app/lib/schema';
import { setTestDb } from '../../app/lib/db';

let client: Client | null = null;
let testDb: LibSQLDatabase | null = null;

// Use a temp file for the test DB so transactions work correctly.
// @libsql/client's :memory: opens new connections per transaction,
// each getting a separate empty in-memory database.
const TEST_DB_PATH = `/tmp/burberry-test-${process.pid}.db`;

/**
 * Get or create the test database connection
 */
export function getTestDb(): LibSQLDatabase {
  if (!testDb) {
    client = createClient({
      url: `file:${TEST_DB_PATH}`,
      intMode: 'number',
    });
    testDb = drizzle(client);
  }
  return testDb;
}

/**
 * Create all tables in the test database
 */
export async function setupTestDb(): Promise<LibSQLDatabase> {
  const db = getTestDb();

  // Make app code use test database
  setTestDb(db);

  // Create tables in order (respecting foreign key constraints)
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT,
      email TEXT NOT NULL UNIQUE,
      emailVerified INTEGER NOT NULL DEFAULT 0,
      image TEXT,
      role TEXT DEFAULT 'user',
      theme TEXT DEFAULT 'neutral',
      banned INTEGER DEFAULT 0,
      banReason TEXT,
      banExpires INTEGER,
      createdAt INTEGER,
      updatedAt INTEGER
    )
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      expiresAt INTEGER NOT NULL,
      ipAddress TEXT,
      userAgent TEXT,
      impersonatedBy TEXT,
      createdAt INTEGER,
      updatedAt INTEGER
    )
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      accountId TEXT NOT NULL,
      providerId TEXT NOT NULL,
      accessToken TEXT,
      refreshToken TEXT,
      accessTokenExpiresAt INTEGER,
      refreshTokenExpiresAt INTEGER,
      scope TEXT,
      idToken TEXT,
      password TEXT,
      createdAt INTEGER,
      updatedAt INTEGER,
      UNIQUE(providerId, accountId)
    )
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS verifications (
      id TEXT PRIMARY KEY,
      identifier TEXT NOT NULL,
      value TEXT NOT NULL,
      expiresAt INTEGER NOT NULL,
      createdAt INTEGER,
      updatedAt INTEGER
    )
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      scope TEXT NOT NULL DEFAULT 'global',
      type TEXT NOT NULL,
      value TEXT NOT NULL,
      createdAt INTEGER,
      updatedAt INTEGER
    )
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS brands (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      createdAt INTEGER,
      updatedAt INTEGER
    )
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS wrestlers (
      id TEXT PRIMARY KEY,
      currentName TEXT NOT NULL,
      brandId TEXT NOT NULL REFERENCES brands(id),
      isActive INTEGER NOT NULL DEFAULT 1,
      createdAt INTEGER,
      updatedAt INTEGER
    )
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS wrestlerNames (
      id TEXT PRIMARY KEY,
      wrestlerId TEXT NOT NULL REFERENCES wrestlers(id),
      name TEXT NOT NULL,
      validFrom INTEGER NOT NULL,
      validTo INTEGER,
      createdAt INTEGER
    )
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      brandId TEXT NOT NULL REFERENCES brands(id),
      isActive INTEGER NOT NULL DEFAULT 1,
      createdAt INTEGER,
      updatedAt INTEGER
    )
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS groupMembers (
      id TEXT PRIMARY KEY,
      groupId TEXT NOT NULL REFERENCES groups(id),
      wrestlerId TEXT NOT NULL REFERENCES wrestlers(id),
      joinedAt INTEGER NOT NULL,
      leftAt INTEGER,
      createdAt INTEGER
    )
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      brandId TEXT NOT NULL REFERENCES brands(id),
      eventDate INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      hidePredictors INTEGER NOT NULL DEFAULT 0,
      createdAt INTEGER,
      updatedAt INTEGER
    )
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS matches (
      id TEXT PRIMARY KEY,
      eventId TEXT NOT NULL REFERENCES events(id),
      matchType TEXT NOT NULL,
      matchOrder INTEGER NOT NULL,
      unknownParticipants INTEGER NOT NULL DEFAULT 0,
      isLocked INTEGER NOT NULL DEFAULT 0,
      predictionDeadline INTEGER,
      outcome TEXT,
      winningSide INTEGER,
      winnerParticipantId TEXT,
      createdAt INTEGER,
      updatedAt INTEGER
    )
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS matchParticipants (
      id TEXT PRIMARY KEY,
      matchId TEXT NOT NULL REFERENCES matches(id),
      side INTEGER,
      participantType TEXT NOT NULL,
      participantId TEXT NOT NULL,
      entryOrder INTEGER,
      isChampion INTEGER NOT NULL DEFAULT 0,
      createdAt INTEGER
    )
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS matchPredictions (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL REFERENCES users(id),
      matchId TEXT NOT NULL REFERENCES matches(id),
      predictedSide INTEGER,
      predictedParticipantId TEXT,
      isCorrect INTEGER,
      createdAt INTEGER,
      updatedAt INTEGER,
      UNIQUE(userId, matchId)
    )
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS customPredictionTemplates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      predictionType TEXT NOT NULL,
      scoringMode TEXT NOT NULL DEFAULT 'exact',
      cooldownDays INTEGER,
      createdAt INTEGER,
      updatedAt INTEGER
    )
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS eventCustomPredictions (
      id TEXT PRIMARY KEY,
      eventId TEXT NOT NULL REFERENCES events(id),
      templateId TEXT NOT NULL REFERENCES customPredictionTemplates(id),
      question TEXT NOT NULL,
      answerTime INTEGER,
      answerCount INTEGER,
      answerWrestlerId TEXT,
      answerBoolean INTEGER,
      answerText TEXT,
      isScored INTEGER NOT NULL DEFAULT 0,
      createdAt INTEGER,
      updatedAt INTEGER
    )
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS userCustomPredictions (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL REFERENCES users(id),
      eventCustomPredictionId TEXT NOT NULL REFERENCES eventCustomPredictions(id),
      predictionTime INTEGER,
      predictionCount INTEGER,
      predictionWrestlerId TEXT,
      predictionBoolean INTEGER,
      predictionText TEXT,
      isCorrect INTEGER,
      pointsEarned INTEGER,
      createdAt INTEGER,
      updatedAt INTEGER,
      UNIQUE(userId, eventCustomPredictionId)
    )
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS userEventJoin (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL REFERENCES users(id),
      eventId TEXT NOT NULL REFERENCES events(id),
      mode TEXT NOT NULL DEFAULT 'normal',
      didWinContrarian INTEGER,
      createdAt INTEGER,
      updatedAt INTEGER,
      UNIQUE(userId, eventId)
    )
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS wrestlerPredictionCooldowns (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL REFERENCES users(id),
      wrestlerId TEXT NOT NULL REFERENCES wrestlers(id),
      brandId TEXT NOT NULL REFERENCES brands(id),
      eventCustomPredictionId TEXT NOT NULL REFERENCES eventCustomPredictions(id),
      lastPredictedAt INTEGER NOT NULL,
      createdAt INTEGER,
      UNIQUE(userId, wrestlerId, brandId)
    )
  `);

  return db;
}

/**
 * Clear all data from the test database (but keep tables)
 */
export async function clearTestDb(): Promise<void> {
  const db = getTestDb();

  // Delete in reverse order of dependencies
  await db.run(sql`DELETE FROM wrestlerPredictionCooldowns`);
  await db.run(sql`DELETE FROM userEventJoin`);
  await db.run(sql`DELETE FROM userCustomPredictions`);
  await db.run(sql`DELETE FROM eventCustomPredictions`);
  await db.run(sql`DELETE FROM customPredictionTemplates`);
  await db.run(sql`DELETE FROM matchPredictions`);
  await db.run(sql`DELETE FROM matchParticipants`);
  await db.run(sql`DELETE FROM matches`);
  await db.run(sql`DELETE FROM events`);
  await db.run(sql`DELETE FROM groupMembers`);
  await db.run(sql`DELETE FROM groups`);
  await db.run(sql`DELETE FROM wrestlerNames`);
  await db.run(sql`DELETE FROM wrestlers`);
  await db.run(sql`DELETE FROM brands`);
  await db.run(sql`DELETE FROM sessions`);
  await db.run(sql`DELETE FROM accounts`);
  await db.run(sql`DELETE FROM verifications`);
  await db.run(sql`DELETE FROM settings`);
  await db.run(sql`DELETE FROM users`);
}

/**
 * Close the test database connection
 */
export async function closeTestDb(): Promise<void> {
  if (client) {
    client.close();
    client = null;
    testDb = null;
  }
  // Clean up temp file
  try {
    unlinkSync(TEST_DB_PATH);
  } catch {
    // File may not exist
  }
}

// Re-export schema for convenience
export { schema };
