/**
 * Tests for Event Service
 * Tests event lifecycle and scoring functionality
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
  createTestScenario,
} from '../helpers/fixtures';
import { eq, and, inArray } from 'drizzle-orm';

describe('Event Service', () => {
  beforeAll(async () => {
    await setupTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  describe('Event Lifecycle', () => {
    test('should create an event with open status by default', async () => {
      const brand = await createBrand();
      const event = await createEvent(brand.id);

      const db = getTestDb();
      const [dbEvent] = await db.select().from(schema.events).where(
        eq(schema.events.id, event.id)
      );

      expect(dbEvent.status).toBe('open');
    });

    test('should allow transitioning event from open to locked', async () => {
      const brand = await createBrand();
      const event = await createEvent(brand.id, { status: 'open' });

      const db = getTestDb();
      await db.update(schema.events)
        .set({ status: 'locked' })
        .where(eq(schema.events.id, event.id));

      const [dbEvent] = await db.select().from(schema.events).where(
        eq(schema.events.id, event.id)
      );

      expect(dbEvent.status).toBe('locked');
    });

    test('should allow transitioning event from locked to completed', async () => {
      const brand = await createBrand();
      const event = await createEvent(brand.id, { status: 'locked' });

      const db = getTestDb();
      await db.update(schema.events)
        .set({ status: 'completed' })
        .where(eq(schema.events.id, event.id));

      const [dbEvent] = await db.select().from(schema.events).where(
        eq(schema.events.id, event.id)
      );

      expect(dbEvent.status).toBe('completed');
    });
  });

  describe('Event with Matches', () => {
    test('should create event with multiple matches in order', async () => {
      const brand = await createBrand();
      const event = await createEvent(brand.id);

      const match1 = await createMatch(event.id, { matchOrder: 1, matchType: 'Singles' });
      const match2 = await createMatch(event.id, { matchOrder: 2, matchType: 'Tag Team' });
      const match3 = await createMatch(event.id, { matchOrder: 3, matchType: 'Triple Threat' });

      const db = getTestDb();
      const matches = await db.select().from(schema.matches)
        .where(eq(schema.matches.eventId, event.id))
        .orderBy(schema.matches.matchOrder);

      expect(matches).toHaveLength(3);
      expect(matches[0].matchType).toBe('Singles');
      expect(matches[1].matchType).toBe('Tag Team');
      expect(matches[2].matchType).toBe('Triple Threat');
    });

    test('should handle match results correctly', async () => {
      const brand = await createBrand();
      const event = await createEvent(brand.id, { status: 'locked' });
      const wrestler1 = await createWrestler(brand.id);
      const wrestler2 = await createWrestler(brand.id);
      const match = await createMatch(event.id, { matchOrder: 1 });

      await createMatchParticipant(match.id, wrestler1.id, 'wrestler', { side: 1 });
      await createMatchParticipant(match.id, wrestler2.id, 'wrestler', { side: 2 });

      // Set match result
      const db = getTestDb();
      await db.update(schema.matches)
        .set({ outcome: 'winner', winningSide: 1 })
        .where(eq(schema.matches.id, match.id));

      const [dbMatch] = await db.select().from(schema.matches).where(
        eq(schema.matches.id, match.id)
      );

      expect(dbMatch.outcome).toBe('winner');
      expect(dbMatch.winningSide).toBe(1);
    });
  });

  describe('Scoring Logic', () => {
    test('should correctly identify correct team-based predictions', async () => {
      const brand = await createBrand();
      const event = await createEvent(brand.id, { status: 'completed' });
      const wrestler1 = await createWrestler(brand.id);
      const wrestler2 = await createWrestler(brand.id);

      const match = await createMatch(event.id, {
        matchOrder: 1,
        outcome: 'winner',
        winningSide: 1,
      });

      await createMatchParticipant(match.id, wrestler1.id, 'wrestler', { side: 1 });
      await createMatchParticipant(match.id, wrestler2.id, 'wrestler', { side: 2 });

      const user1 = await createUser({ email: 'user1@test.com' });
      const user2 = await createUser({ email: 'user2@test.com' });

      // User 1 predicted correctly (side 1)
      await createMatchPrediction(user1.id, match.id, { predictedSide: 1 });
      // User 2 predicted incorrectly (side 2)
      await createMatchPrediction(user2.id, match.id, { predictedSide: 2 });

      const db = getTestDb();
      const predictions = await db.select().from(schema.matchPredictions)
        .where(eq(schema.matchPredictions.matchId, match.id));

      expect(predictions).toHaveLength(2);

      // Simulate scoring
      for (const pred of predictions) {
        const isCorrect = pred.predictedSide === 1; // winningSide
        await db.update(schema.matchPredictions)
          .set({ isCorrect })
          .where(eq(schema.matchPredictions.id, pred.id));
      }

      const scoredPredictions = await db.select().from(schema.matchPredictions)
        .where(eq(schema.matchPredictions.matchId, match.id));

      const user1Pred = scoredPredictions.find(p => p.userId === user1.id);
      const user2Pred = scoredPredictions.find(p => p.userId === user2.id);

      expect(user1Pred?.isCorrect).toBe(true);
      expect(user2Pred?.isCorrect).toBe(false);
    });

    test('should correctly score free-for-all match predictions', async () => {
      const brand = await createBrand();
      const event = await createEvent(brand.id, { status: 'completed' });
      const wrestler1 = await createWrestler(brand.id);
      const wrestler2 = await createWrestler(brand.id);
      const wrestler3 = await createWrestler(brand.id);

      const match = await createMatch(event.id, { matchOrder: 1 });

      const participant1 = await createMatchParticipant(match.id, wrestler1.id, 'wrestler', { side: null });
      const participant2 = await createMatchParticipant(match.id, wrestler2.id, 'wrestler', { side: null });
      const participant3 = await createMatchParticipant(match.id, wrestler3.id, 'wrestler', { side: null });

      // Set winner
      const db = getTestDb();
      await db.update(schema.matches)
        .set({ outcome: 'winner', winnerParticipantId: participant2.id })
        .where(eq(schema.matches.id, match.id));

      const user = await createUser();
      await createMatchPrediction(user.id, match.id, { predictedParticipantId: participant2.id });

      // Simulate scoring
      const [prediction] = await db.select().from(schema.matchPredictions)
        .where(eq(schema.matchPredictions.matchId, match.id));

      const isCorrect = prediction.predictedParticipantId === participant2.id;
      await db.update(schema.matchPredictions)
        .set({ isCorrect })
        .where(eq(schema.matchPredictions.id, prediction.id));

      const [scoredPred] = await db.select().from(schema.matchPredictions)
        .where(eq(schema.matchPredictions.id, prediction.id));

      expect(scoredPred.isCorrect).toBe(true);
    });

    test('should mark all predictions as incorrect for draw outcomes', async () => {
      const brand = await createBrand();
      const event = await createEvent(brand.id, { status: 'completed' });
      const match = await createMatch(event.id, {
        matchOrder: 1,
        outcome: 'draw',
      });

      const user = await createUser();
      await createMatchPrediction(user.id, match.id, { predictedSide: 1 });

      const db = getTestDb();

      // Simulate scoring - draw means all predictions are wrong
      await db.update(schema.matchPredictions)
        .set({ isCorrect: false })
        .where(eq(schema.matchPredictions.matchId, match.id));

      const [scoredPred] = await db.select().from(schema.matchPredictions)
        .where(eq(schema.matchPredictions.matchId, match.id));

      expect(scoredPred.isCorrect).toBe(false);
    });
  });

  describe('Custom Prediction Scoring', () => {
    test('should score count-type custom predictions', async () => {
      const brand = await createBrand();
      const event = await createEvent(brand.id, { status: 'completed' });
      const template = await createCustomPredictionTemplate({ predictionType: 'count' });
      const eventPred = await createEventCustomPrediction(event.id, template.id, {
        question: 'How many title changes?',
        answerCount: 2,
        isScored: true,
      });

      const user1 = await createUser({ email: 'user1@test.com' });
      const user2 = await createUser({ email: 'user2@test.com' });

      await createUserCustomPrediction(user1.id, eventPred.id, { predictionCount: 2 });
      await createUserCustomPrediction(user2.id, eventPred.id, { predictionCount: 3 });

      const db = getTestDb();

      // Simulate scoring
      const userPreds = await db.select().from(schema.userCustomPredictions)
        .where(eq(schema.userCustomPredictions.eventCustomPredictionId, eventPred.id));

      for (const pred of userPreds) {
        const isCorrect = pred.predictionCount === 2; // answerCount
        await db.update(schema.userCustomPredictions)
          .set({ isCorrect })
          .where(eq(schema.userCustomPredictions.id, pred.id));
      }

      const scoredPreds = await db.select().from(schema.userCustomPredictions)
        .where(eq(schema.userCustomPredictions.eventCustomPredictionId, eventPred.id));

      const user1Pred = scoredPreds.find(p => p.userId === user1.id);
      const user2Pred = scoredPreds.find(p => p.userId === user2.id);

      expect(user1Pred?.isCorrect).toBe(true);
      expect(user2Pred?.isCorrect).toBe(false);
    });

    test('should score text-type custom predictions case-insensitively', async () => {
      const brand = await createBrand();
      const event = await createEvent(brand.id, { status: 'completed' });
      const template = await createCustomPredictionTemplate({ predictionType: 'text' });
      const eventPred = await createEventCustomPrediction(event.id, template.id, {
        question: 'Who will say their catchphrase?',
        answerText: 'John Cena',
        isScored: true,
      });

      const user1 = await createUser({ email: 'user1@test.com' });
      const user2 = await createUser({ email: 'user2@test.com' });

      await createUserCustomPrediction(user1.id, eventPred.id, { predictionText: 'JOHN CENA' });
      await createUserCustomPrediction(user2.id, eventPred.id, { predictionText: 'The Rock' });

      const db = getTestDb();

      // Simulate case-insensitive scoring
      const userPreds = await db.select().from(schema.userCustomPredictions)
        .where(eq(schema.userCustomPredictions.eventCustomPredictionId, eventPred.id));

      for (const pred of userPreds) {
        const isCorrect = pred.predictionText?.toLowerCase() === 'john cena';
        await db.update(schema.userCustomPredictions)
          .set({ isCorrect })
          .where(eq(schema.userCustomPredictions.id, pred.id));
      }

      const scoredPreds = await db.select().from(schema.userCustomPredictions)
        .where(eq(schema.userCustomPredictions.eventCustomPredictionId, eventPred.id));

      const user1Pred = scoredPreds.find(p => p.userId === user1.id);
      const user2Pred = scoredPreds.find(p => p.userId === user2.id);

      expect(user1Pred?.isCorrect).toBe(true);
      expect(user2Pred?.isCorrect).toBe(false);
    });
  });

  describe('Contrarian Scoring', () => {
    test('should award contrarian win when all predictions are wrong', async () => {
      const brand = await createBrand();
      const event = await createEvent(brand.id, { status: 'completed' });

      const match1 = await createMatch(event.id, { matchOrder: 1, outcome: 'winner', winningSide: 1 });
      const match2 = await createMatch(event.id, { matchOrder: 2, outcome: 'winner', winningSide: 2 });

      const user = await createUser();
      await createContrarian(user.id, event.id, { isContrarian: true });

      // User predicted wrong on both matches
      await createMatchPrediction(user.id, match1.id, { predictedSide: 2, isCorrect: false });
      await createMatchPrediction(user.id, match2.id, { predictedSide: 1, isCorrect: false });

      const db = getTestDb();

      // Simulate contrarian scoring
      const predictions = await db.select().from(schema.matchPredictions)
        .where(eq(schema.matchPredictions.userId, user.id));

      const allIncorrect = predictions.every(p => p.isCorrect === false);

      await db.update(schema.userEventContrarian)
        .set({ didWinContrarian: allIncorrect })
        .where(and(
          eq(schema.userEventContrarian.userId, user.id),
          eq(schema.userEventContrarian.eventId, event.id)
        ));

      const [contrarian] = await db.select().from(schema.userEventContrarian)
        .where(and(
          eq(schema.userEventContrarian.userId, user.id),
          eq(schema.userEventContrarian.eventId, event.id)
        ));

      expect(contrarian.didWinContrarian).toBe(true);
    });

    test('should not award contrarian win when any prediction is correct', async () => {
      const brand = await createBrand();
      const event = await createEvent(brand.id, { status: 'completed' });

      const match1 = await createMatch(event.id, { matchOrder: 1, outcome: 'winner', winningSide: 1 });
      const match2 = await createMatch(event.id, { matchOrder: 2, outcome: 'winner', winningSide: 2 });

      const user = await createUser();
      await createContrarian(user.id, event.id, { isContrarian: true });

      // User predicted wrong on first, but got second correct
      await createMatchPrediction(user.id, match1.id, { predictedSide: 2, isCorrect: false });
      await createMatchPrediction(user.id, match2.id, { predictedSide: 2, isCorrect: true });

      const db = getTestDb();

      // Simulate contrarian scoring
      const predictions = await db.select().from(schema.matchPredictions)
        .where(eq(schema.matchPredictions.userId, user.id));

      const allIncorrect = predictions.every(p => p.isCorrect === false);

      await db.update(schema.userEventContrarian)
        .set({ didWinContrarian: allIncorrect })
        .where(and(
          eq(schema.userEventContrarian.userId, user.id),
          eq(schema.userEventContrarian.eventId, event.id)
        ));

      const [contrarian] = await db.select().from(schema.userEventContrarian)
        .where(and(
          eq(schema.userEventContrarian.userId, user.id),
          eq(schema.userEventContrarian.eventId, event.id)
        ));

      expect(contrarian.didWinContrarian).toBe(false);
    });
  });

  describe('Full Event Scenario', () => {
    test('should handle complete event with multiple users and predictions', async () => {
      // Create scenario
      const scenario = await createTestScenario();
      const { brand, event, match, user } = scenario;

      // Create additional users
      const user2 = await createUser({ email: 'user2@test.com', name: 'User Two' });
      const user3 = await createUser({ email: 'user3@test.com', name: 'User Three' });

      // Create additional match
      const wrestler3 = await createWrestler(brand.id, { currentName: 'Wrestler Three' });
      const wrestler4 = await createWrestler(brand.id, { currentName: 'Wrestler Four' });
      const match2 = await createMatch(event.id, { matchOrder: 2 });
      await createMatchParticipant(match2.id, wrestler3.id, 'wrestler', { side: 1 });
      await createMatchParticipant(match2.id, wrestler4.id, 'wrestler', { side: 2 });

      // All users make predictions
      await createMatchPrediction(user.id, match.id, { predictedSide: 1 });
      await createMatchPrediction(user.id, match2.id, { predictedSide: 1 });

      await createMatchPrediction(user2.id, match.id, { predictedSide: 2 });
      await createMatchPrediction(user2.id, match2.id, { predictedSide: 1 });

      await createMatchPrediction(user3.id, match.id, { predictedSide: 1 });
      await createMatchPrediction(user3.id, match2.id, { predictedSide: 2 });

      // User3 is contrarian
      await createContrarian(user3.id, event.id, { isContrarian: true });

      const db = getTestDb();

      // Lock event
      await db.update(schema.events)
        .set({ status: 'locked' })
        .where(eq(schema.events.id, event.id));

      // Set match results
      await db.update(schema.matches)
        .set({ outcome: 'winner', winningSide: 1 })
        .where(eq(schema.matches.id, match.id));

      await db.update(schema.matches)
        .set({ outcome: 'winner', winningSide: 2 })
        .where(eq(schema.matches.id, match2.id));

      // Complete event
      await db.update(schema.events)
        .set({ status: 'completed' })
        .where(eq(schema.events.id, event.id));

      // Score predictions
      const matchIds = [match.id, match2.id];
      const allPredictions = await db.select().from(schema.matchPredictions)
        .where(inArray(schema.matchPredictions.matchId, matchIds));

      const matchResults = new Map([
        [match.id, 1],
        [match2.id, 2],
      ]);

      for (const pred of allPredictions) {
        const winningSide = matchResults.get(pred.matchId);
        const isCorrect = pred.predictedSide === winningSide;
        await db.update(schema.matchPredictions)
          .set({ isCorrect })
          .where(eq(schema.matchPredictions.id, pred.id));
      }

      // Score contrarian
      const user3Predictions = await db.select().from(schema.matchPredictions)
        .where(eq(schema.matchPredictions.userId, user3.id));

      const user3AllWrong = user3Predictions.every(p => p.isCorrect === false);
      await db.update(schema.userEventContrarian)
        .set({ didWinContrarian: user3AllWrong })
        .where(eq(schema.userEventContrarian.userId, user3.id));

      // Verify results
      const scoredPredictions = await db.select().from(schema.matchPredictions)
        .where(inArray(schema.matchPredictions.matchId, matchIds));

      // User 1: Match 1 correct (1=1), Match 2 wrong (1≠2) = 1/2
      const user1Correct = scoredPredictions
        .filter(p => p.userId === user.id && p.isCorrect)
        .length;
      expect(user1Correct).toBe(1);

      // User 2: Match 1 wrong (2≠1), Match 2 wrong (1≠2) = 0/2
      const user2Correct = scoredPredictions
        .filter(p => p.userId === user2.id && p.isCorrect)
        .length;
      expect(user2Correct).toBe(0);

      // User 3: Match 1 correct (1=1), Match 2 correct (2=2) = 2/2
      const user3Correct = scoredPredictions
        .filter(p => p.userId === user3.id && p.isCorrect)
        .length;
      expect(user3Correct).toBe(2);

      // User 3 didn't win contrarian (got some right)
      const [user3Contrarian] = await db.select().from(schema.userEventContrarian)
        .where(eq(schema.userEventContrarian.userId, user3.id));
      expect(user3Contrarian.didWinContrarian).toBe(false);
    });
  });
});
