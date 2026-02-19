-- Migration: Prediction UI Schema Updates
-- This migration adds support for:
-- 1. Event join system with normal/contrarian modes
-- 2. Match-level locking and prediction deadlines
-- 3. Hide predictors (sneaky mode)
-- 4. Wrestler prediction cooldowns
-- 5. Multi-value custom predictions

-- Step 1: Add new fields to events table
ALTER TABLE events ADD COLUMN hidePredictors INTEGER DEFAULT 0 NOT NULL;
--> statement-breakpoint

-- Step 2: Add new fields to matches table
ALTER TABLE matches ADD COLUMN isLocked INTEGER DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE matches ADD COLUMN predictionDeadline INTEGER;
--> statement-breakpoint

-- Step 3: Rename userEventContrarian table to userEventJoin and add mode field
-- SQLite doesn't support ALTER TABLE RENAME, so we need to:
-- a) Create new table with correct schema
CREATE TABLE userEventJoin (
  id TEXT PRIMARY KEY NOT NULL,
  userId TEXT NOT NULL REFERENCES users(id),
  eventId TEXT NOT NULL REFERENCES events(id),
  mode TEXT DEFAULT 'normal' NOT NULL,
  didWinContrarian INTEGER,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL,
  UNIQUE(userId, eventId)
);
--> statement-breakpoint

-- b) Copy data from old table, converting isContrarian to mode
INSERT INTO userEventJoin (id, userId, eventId, mode, didWinContrarian, createdAt, updatedAt)
SELECT
  id,
  userId,
  eventId,
  CASE WHEN isContrarian = 1 THEN 'contrarian' ELSE 'normal' END as mode,
  didWinContrarian,
  createdAt,
  updatedAt
FROM userEventContrarian;
--> statement-breakpoint

-- c) Drop old table
DROP TABLE userEventContrarian;
--> statement-breakpoint

-- d) Create indexes for new table
CREATE INDEX userEventJoin_userId_idx ON userEventJoin(userId);
--> statement-breakpoint
CREATE INDEX userEventJoin_eventId_idx ON userEventJoin(eventId);
--> statement-breakpoint

-- Step 4: Drop unique constraint from userCustomPredictions to allow multiple predictions
-- SQLite requires table recreation to drop constraints
CREATE TABLE userCustomPredictions_new (
  id TEXT PRIMARY KEY NOT NULL,
  userId TEXT NOT NULL REFERENCES users(id),
  eventCustomPredictionId TEXT NOT NULL REFERENCES eventCustomPredictions(id),
  predictionTime INTEGER,
  predictionCount INTEGER,
  predictionWrestlerId TEXT,
  predictionBoolean INTEGER,
  predictionText TEXT,
  isCorrect INTEGER,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);
--> statement-breakpoint

-- Copy data
INSERT INTO userCustomPredictions_new SELECT * FROM userCustomPredictions;
--> statement-breakpoint

-- Drop old table
DROP TABLE userCustomPredictions;
--> statement-breakpoint

-- Rename new table
ALTER TABLE userCustomPredictions_new RENAME TO userCustomPredictions;
--> statement-breakpoint

-- Recreate indexes (without unique constraint)
CREATE INDEX userCustomPredictions_userId_idx ON userCustomPredictions(userId);
--> statement-breakpoint
CREATE INDEX userCustomPredictions_eventCustomPredictionId_idx ON userCustomPredictions(eventCustomPredictionId);
--> statement-breakpoint

-- Step 5: Create wrestlerPredictionCooldowns table
CREATE TABLE wrestlerPredictionCooldowns (
  id TEXT PRIMARY KEY NOT NULL,
  userId TEXT NOT NULL REFERENCES users(id),
  wrestlerId TEXT NOT NULL REFERENCES wrestlers(id),
  brandId TEXT NOT NULL REFERENCES brands(id),
  eventCustomPredictionId TEXT NOT NULL REFERENCES eventCustomPredictions(id),
  lastPredictedAt INTEGER NOT NULL,
  createdAt INTEGER NOT NULL,
  UNIQUE(userId, wrestlerId, brandId)
);
--> statement-breakpoint

CREATE INDEX wrestlerPredictionCooldowns_userId_idx ON wrestlerPredictionCooldowns(userId);
--> statement-breakpoint
CREATE INDEX wrestlerPredictionCooldowns_wrestlerId_idx ON wrestlerPredictionCooldowns(wrestlerId);
--> statement-breakpoint
CREATE INDEX wrestlerPredictionCooldowns_brandId_idx ON wrestlerPredictionCooldowns(brandId);
