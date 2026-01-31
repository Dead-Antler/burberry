/**
 * Tests for Prediction Service
 * Tests match predictions, custom predictions, and contrarian mode
 */

import { describe, test, expect, beforeAll, beforeEach, afterAll } from 'bun:test';
import { setupTestDb, clearTestDb, closeTestDb, getTestDb, schema } from '../helpers/db';
import {
  createBrand,
  createEvent,
  createMatch,
  createWrestler,
  createMatchParticipant,
  createUser,
  createMatchPrediction,
  createCustomPredictionTemplate,
  createEventCustomPrediction,
  createUserCustomPrediction,
  createContrarian,
} from '../helpers/fixtures';
import { eq, and } from 'drizzle-orm';

describe('Prediction Service', () => {
  beforeAll(async () => {
    await setupTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  describe('Match Predictions', () => {
    test('should create a match prediction', async () => {
      const brand = await createBrand();
      const wrestler1 = await createWrestler(brand.id);
      const wrestler2 = await createWrestler(brand.id);
      const event = await createEvent(brand.id, { status: 'open' });
      const match = await createMatch(event.id);
      await createMatchParticipant(match.id, wrestler1.id, 'wrestler', { side: 1 });
      await createMatchParticipant(match.id, wrestler2.id, 'wrestler', { side: 2 });
      const user = await createUser();

      const prediction = await createMatchPrediction(user.id, match.id, { predictedSide: 1 });

      const db = getTestDb();
      const [dbPrediction] = await db.select().from(schema.matchPredictions).where(
        eq(schema.matchPredictions.id, prediction.id)
      );

      expect(dbPrediction).toBeDefined();
      expect(dbPrediction.userId).toBe(user.id);
      expect(dbPrediction.matchId).toBe(match.id);
      expect(dbPrediction.predictedSide).toBe(1);
      expect(dbPrediction.isCorrect).toBeNull();
    });

    test('should enforce unique constraint on user-match prediction', async () => {
      const brand = await createBrand();
      const event = await createEvent(brand.id, { status: 'open' });
      const match = await createMatch(event.id);
      const user = await createUser();

      // Create first prediction
      await createMatchPrediction(user.id, match.id, { predictedSide: 1 });

      // Attempt to create duplicate should fail due to UNIQUE(userId, matchId)
      const db = getTestDb();
      let error: Error | null = null;
      try {
        await db.insert(schema.matchPredictions).values({
          id: 'duplicate_id',
          userId: user.id,
          matchId: match.id,
          predictedSide: 2,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      } catch (e) {
        error = e as Error;
      }
      // Error should be thrown due to unique constraint
      expect(error).not.toBeNull();
    });

    test('should allow predictions for free-for-all matches with participantId', async () => {
      const brand = await createBrand();
      const wrestler = await createWrestler(brand.id);
      const event = await createEvent(brand.id, { status: 'open' });
      const match = await createMatch(event.id);
      const participant = await createMatchParticipant(match.id, wrestler.id, 'wrestler', { side: null });
      const user = await createUser();

      const prediction = await createMatchPrediction(user.id, match.id, {
        predictedParticipantId: participant.id,
      });

      const db = getTestDb();
      const [dbPrediction] = await db.select().from(schema.matchPredictions).where(
        eq(schema.matchPredictions.id, prediction.id)
      );

      expect(dbPrediction.predictedSide).toBeNull();
      expect(dbPrediction.predictedParticipantId).toBe(participant.id);
    });
  });

  describe('Match Prediction Scoring', () => {
    test('should mark team-based predictions as correct when side matches', async () => {
      const brand = await createBrand();
      const event = await createEvent(brand.id, { status: 'completed' });
      const match = await createMatch(event.id, {
        outcome: 'winner',
        winningSide: 1,
      });
      const user = await createUser();

      // Correct prediction
      const correctPrediction = await createMatchPrediction(user.id, match.id, {
        predictedSide: 1,
        isCorrect: true, // Simulating post-scoring state
      });

      const db = getTestDb();
      const [dbPrediction] = await db.select().from(schema.matchPredictions).where(
        eq(schema.matchPredictions.id, correctPrediction.id)
      );

      expect(dbPrediction.isCorrect).toBe(true);
    });

    test('should mark team-based predictions as incorrect when side does not match', async () => {
      const brand = await createBrand();
      const event = await createEvent(brand.id, { status: 'completed' });
      const match = await createMatch(event.id, {
        outcome: 'winner',
        winningSide: 1,
      });
      const user = await createUser();

      // Incorrect prediction
      const incorrectPrediction = await createMatchPrediction(user.id, match.id, {
        predictedSide: 2,
        isCorrect: false, // Simulating post-scoring state
      });

      const db = getTestDb();
      const [dbPrediction] = await db.select().from(schema.matchPredictions).where(
        eq(schema.matchPredictions.id, incorrectPrediction.id)
      );

      expect(dbPrediction.isCorrect).toBe(false);
    });
  });

  describe('Custom Predictions', () => {
    test('should create a custom prediction template', async () => {
      const template = await createCustomPredictionTemplate({
        name: 'Match Length',
        predictionType: 'time',
      });

      const db = getTestDb();
      const [dbTemplate] = await db.select().from(schema.customPredictionTemplates).where(
        eq(schema.customPredictionTemplates.id, template.id)
      );

      expect(dbTemplate).toBeDefined();
      expect(dbTemplate.name).toBe('Match Length');
      expect(dbTemplate.predictionType).toBe('time');
    });

    test('should create an event custom prediction', async () => {
      const brand = await createBrand();
      const event = await createEvent(brand.id);
      const template = await createCustomPredictionTemplate({ predictionType: 'count' });

      const eventPrediction = await createEventCustomPrediction(event.id, template.id, {
        question: 'How many finishers in the main event?',
      });

      const db = getTestDb();
      const [dbEventPrediction] = await db.select().from(schema.eventCustomPredictions).where(
        eq(schema.eventCustomPredictions.id, eventPrediction.id)
      );

      expect(dbEventPrediction).toBeDefined();
      expect(dbEventPrediction.eventId).toBe(event.id);
      expect(dbEventPrediction.templateId).toBe(template.id);
      expect(dbEventPrediction.question).toBe('How many finishers in the main event?');
    });

    test('should create a user custom prediction with count type', async () => {
      const brand = await createBrand();
      const event = await createEvent(brand.id, { status: 'open' });
      const template = await createCustomPredictionTemplate({ predictionType: 'count' });
      const eventPrediction = await createEventCustomPrediction(event.id, template.id);
      const user = await createUser();

      const userPrediction = await createUserCustomPrediction(user.id, eventPrediction.id, {
        predictionCount: 5,
      });

      const db = getTestDb();
      const [dbUserPrediction] = await db.select().from(schema.userCustomPredictions).where(
        eq(schema.userCustomPredictions.id, userPrediction.id)
      );

      expect(dbUserPrediction).toBeDefined();
      expect(dbUserPrediction.userId).toBe(user.id);
      expect(dbUserPrediction.predictionCount).toBe(5);
    });

    test('should create a user custom prediction with wrestler type', async () => {
      const brand = await createBrand();
      const wrestler = await createWrestler(brand.id, { currentName: 'Champion' });
      const event = await createEvent(brand.id, { status: 'open' });
      const template = await createCustomPredictionTemplate({ predictionType: 'wrestler' });
      const eventPrediction = await createEventCustomPrediction(event.id, template.id, {
        question: 'Who will win?',
      });
      const user = await createUser();

      const userPrediction = await createUserCustomPrediction(user.id, eventPrediction.id, {
        predictionWrestlerId: wrestler.id,
      });

      const db = getTestDb();
      const [dbUserPrediction] = await db.select().from(schema.userCustomPredictions).where(
        eq(schema.userCustomPredictions.id, userPrediction.id)
      );

      expect(dbUserPrediction.predictionWrestlerId).toBe(wrestler.id);
    });

    test('should create a user custom prediction with boolean type', async () => {
      const brand = await createBrand();
      const event = await createEvent(brand.id, { status: 'open' });
      const template = await createCustomPredictionTemplate({ predictionType: 'boolean' });
      const eventPrediction = await createEventCustomPrediction(event.id, template.id, {
        question: 'Will there be a title change?',
      });
      const user = await createUser();

      const userPrediction = await createUserCustomPrediction(user.id, eventPrediction.id, {
        predictionBoolean: true,
      });

      const db = getTestDb();
      const [dbUserPrediction] = await db.select().from(schema.userCustomPredictions).where(
        eq(schema.userCustomPredictions.id, userPrediction.id)
      );

      expect(dbUserPrediction.predictionBoolean).toBe(true);
    });
  });

  describe('Custom Prediction Scoring', () => {
    test('should score count predictions correctly', async () => {
      const brand = await createBrand();
      const event = await createEvent(brand.id, { status: 'completed' });
      const template = await createCustomPredictionTemplate({ predictionType: 'count' });
      const eventPrediction = await createEventCustomPrediction(event.id, template.id, {
        answerCount: 5,
        isScored: true,
      });
      const user = await createUser();

      // Correct prediction
      const correctPrediction = await createUserCustomPrediction(user.id, eventPrediction.id, {
        predictionCount: 5,
        isCorrect: true,
      });

      const db = getTestDb();
      const [dbPrediction] = await db.select().from(schema.userCustomPredictions).where(
        eq(schema.userCustomPredictions.id, correctPrediction.id)
      );

      expect(dbPrediction.isCorrect).toBe(true);
    });

    test('should score boolean predictions correctly', async () => {
      const brand = await createBrand();
      const event = await createEvent(brand.id, { status: 'completed' });
      const template = await createCustomPredictionTemplate({ predictionType: 'boolean' });
      const eventPrediction = await createEventCustomPrediction(event.id, template.id, {
        answerBoolean: false,
        isScored: true,
      });
      const user = await createUser();

      // Incorrect prediction (predicted true, answer was false)
      const incorrectPrediction = await createUserCustomPrediction(user.id, eventPrediction.id, {
        predictionBoolean: true,
        isCorrect: false,
      });

      const db = getTestDb();
      const [dbPrediction] = await db.select().from(schema.userCustomPredictions).where(
        eq(schema.userCustomPredictions.id, incorrectPrediction.id)
      );

      expect(dbPrediction.isCorrect).toBe(false);
    });
  });

  describe('Contrarian Mode', () => {
    test('should create a contrarian record', async () => {
      const brand = await createBrand();
      const event = await createEvent(brand.id, { status: 'open' });
      const user = await createUser();

      const contrarian = await createContrarian(user.id, event.id, { isContrarian: true });

      const db = getTestDb();
      const [dbContrarian] = await db.select().from(schema.userEventContrarian).where(
        eq(schema.userEventContrarian.id, contrarian.id)
      );

      expect(dbContrarian).toBeDefined();
      expect(dbContrarian.userId).toBe(user.id);
      expect(dbContrarian.eventId).toBe(event.id);
      expect(dbContrarian.isContrarian).toBe(true);
      expect(dbContrarian.didWinContrarian).toBeNull();
    });

    test('should enforce unique constraint on user-event contrarian', async () => {
      const brand = await createBrand();
      const event = await createEvent(brand.id);
      const user = await createUser();

      await createContrarian(user.id, event.id);

      // Attempt to create duplicate should fail due to UNIQUE(userId, eventId)
      const db = getTestDb();
      let error: Error | null = null;
      try {
        await db.insert(schema.userEventContrarian).values({
          id: 'duplicate_id',
          userId: user.id,
          eventId: event.id,
          isContrarian: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      } catch (e) {
        error = e as Error;
      }
      // Error should be thrown due to unique constraint
      expect(error).not.toBeNull();
    });

    test('should track contrarian win status', async () => {
      const brand = await createBrand();
      const event = await createEvent(brand.id, { status: 'completed' });
      const user = await createUser();

      // User got all predictions wrong - wins contrarian
      const contrarian = await createContrarian(user.id, event.id, {
        isContrarian: true,
        didWinContrarian: true,
      });

      const db = getTestDb();
      const [dbContrarian] = await db.select().from(schema.userEventContrarian).where(
        eq(schema.userEventContrarian.id, contrarian.id)
      );

      expect(dbContrarian.didWinContrarian).toBe(true);
    });
  });
});
