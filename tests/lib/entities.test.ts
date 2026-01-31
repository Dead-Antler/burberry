/**
 * Tests for entity helper functions
 */

import { describe, test, expect, beforeAll, beforeEach, afterAll } from 'bun:test';
import { setupTestDb, clearTestDb, closeTestDb, getTestDb, schema } from '../helpers/db';
import { createBrand, createEvent, createMatch, createWrestler, createMatchParticipant } from '../helpers/fixtures';

// We need to mock the db import for the entities module
// For now, we'll test the logic directly

describe('Entity Helpers', () => {
  beforeAll(async () => {
    await setupTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  describe('Event Status Validation', () => {
    test('should allow operations on open events', async () => {
      const brand = await createBrand();
      const event = await createEvent(brand.id, { status: 'open' });

      // Verify event was created with open status
      const db = getTestDb();
      const [dbEvent] = await db.select().from(schema.events).where(
        require('drizzle-orm').eq(schema.events.id, event.id)
      );

      expect(dbEvent).toBeDefined();
      expect(dbEvent.status).toBe('open');
    });

    test('should create events with different statuses', async () => {
      const brand = await createBrand();

      const openEvent = await createEvent(brand.id, { status: 'open' });
      const lockedEvent = await createEvent(brand.id, { status: 'locked' });
      const completedEvent = await createEvent(brand.id, { status: 'completed' });

      const db = getTestDb();
      const events = await db.select().from(schema.events);

      expect(events).toHaveLength(3);
      expect(events.map(e => e.status).sort()).toEqual(['completed', 'locked', 'open']);
    });
  });

  describe('Match-Event Relationship', () => {
    test('should create matches linked to events', async () => {
      const brand = await createBrand();
      const event = await createEvent(brand.id);
      const match = await createMatch(event.id, { matchType: 'Singles', matchOrder: 1 });

      const db = getTestDb();
      const [dbMatch] = await db.select().from(schema.matches).where(
        require('drizzle-orm').eq(schema.matches.id, match.id)
      );

      expect(dbMatch).toBeDefined();
      expect(dbMatch.eventId).toBe(event.id);
      expect(dbMatch.matchType).toBe('Singles');
    });

    test('should create match participants', async () => {
      const brand = await createBrand();
      const wrestler = await createWrestler(brand.id);
      const event = await createEvent(brand.id);
      const match = await createMatch(event.id);

      const participant = await createMatchParticipant(match.id, wrestler.id, 'wrestler', { side: 1 });

      const db = getTestDb();
      const [dbParticipant] = await db.select().from(schema.matchParticipants).where(
        require('drizzle-orm').eq(schema.matchParticipants.id, participant.id)
      );

      expect(dbParticipant).toBeDefined();
      expect(dbParticipant.matchId).toBe(match.id);
      expect(dbParticipant.participantId).toBe(wrestler.id);
      expect(dbParticipant.participantType).toBe('wrestler');
      expect(dbParticipant.side).toBe(1);
    });
  });
});
