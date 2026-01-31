/**
 * Test Database Helper
 * Provides utilities for setting up and tearing down test databases
 */

import { drizzle, LibSQLDatabase } from 'drizzle-orm/libsql';
import { createClient, Client } from '@libsql/client';
import { sql } from 'drizzle-orm';
import * as schema from '../../app/lib/schema';

let client: Client | null = null;
let testDb: LibSQLDatabase | null = null;

/**
 * Get or create the test database connection
 */
export function getTestDb(): LibSQLDatabase {
  if (!testDb) {
    client = createClient({
      url: ':memory:',
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

  // Create tables in order (respecting foreign key constraints)
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      isAdmin INTEGER NOT NULL DEFAULT 0,
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
    CREATE TABLE IF NOT EXISTS tagTeams (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      brandId TEXT NOT NULL REFERENCES brands(id),
      isActive INTEGER NOT NULL DEFAULT 1,
      createdAt INTEGER,
      updatedAt INTEGER
    )
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS championships (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      brandId TEXT NOT NULL REFERENCES brands(id),
      isActive INTEGER NOT NULL DEFAULT 1,
      createdAt INTEGER,
      updatedAt INTEGER
    )
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      brandId TEXT NOT NULL REFERENCES brands(id),
      eventDate INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
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
      createdAt INTEGER,
      updatedAt INTEGER,
      UNIQUE(userId, eventCustomPredictionId)
    )
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS userEventContrarian (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL REFERENCES users(id),
      eventId TEXT NOT NULL REFERENCES events(id),
      isContrarian INTEGER NOT NULL DEFAULT 0,
      didWinContrarian INTEGER,
      createdAt INTEGER,
      updatedAt INTEGER,
      UNIQUE(userId, eventId)
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
  await db.run(sql`DELETE FROM userEventContrarian`);
  await db.run(sql`DELETE FROM userCustomPredictions`);
  await db.run(sql`DELETE FROM eventCustomPredictions`);
  await db.run(sql`DELETE FROM customPredictionTemplates`);
  await db.run(sql`DELETE FROM matchPredictions`);
  await db.run(sql`DELETE FROM matchParticipants`);
  await db.run(sql`DELETE FROM matches`);
  await db.run(sql`DELETE FROM events`);
  await db.run(sql`DELETE FROM championships`);
  await db.run(sql`DELETE FROM tagTeams`);
  await db.run(sql`DELETE FROM wrestlers`);
  await db.run(sql`DELETE FROM brands`);
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
}

// Re-export schema for convenience
export { schema };
