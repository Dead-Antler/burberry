/**
 * Tests for Event Scoring System
 * Coverage: Match predictions, custom predictions, contrarian mode, leaderboard calculation
 */

import { describe, test, expect, beforeAll, beforeEach } from 'bun:test';
import { setupTestDb, clearTestDb, getTestDb, schema } from '../helpers/db';
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
  joinEvent,
} from '../helpers/fixtures';
import { eventService } from '@/app/lib/services/event.service';
import { eq } from 'drizzle-orm';

describe('Event Scoring System', () => {
  beforeAll(async () => {
    await setupTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
  });

  describe('Match Prediction Scoring', () => {
    test('correctly scores team match predictions', async () => {
      const brand = await createBrand();
      const wrestler1 = await createWrestler(brand.id);
      const wrestler2 = await createWrestler(brand.id);
      const event = await createEvent(brand.id, { status: 'completed' });
      const match = await createMatch(event.id);
      const p1 = await createMatchParticipant(match.id, wrestler1.id, 'wrestler', { side: 1 });
      const p2 = await createMatchParticipant(match.id, wrestler2.id, 'wrestler', { side: 2 });

      const user1 = await createUser();
      const user2 = await createUser();
      await joinEvent(user1.id, event.id);
      await joinEvent(user2.id, event.id);

      // User 1 predicts correctly
      await createMatchPrediction(user1.id, match.id, { predictedSide: 1 });
      // User 2 predicts incorrectly
      await createMatchPrediction(user2.id, match.id, { predictedSide: 2 });

      // Set match result
      const db = getTestDb();
      await db.update(schema.matches).set({ winningSide: 1, outcome: 'winner' }).where(eq(schema.matches.id, match.id));

      // Score event (calculate isCorrect for predictions)
      await eventService.scoreEvent(event.id);

      // Get scores
      const leaderboard = await eventService.getScores(event.id);

      const user1Score = leaderboard.find((s) => s.userId === user1.id)!;
      const user2Score = leaderboard.find((s) => s.userId === user2.id)!;

      expect(user1Score.matchPredictions.correct).toBe(1);
      expect(user1Score.totalScore).toBe(1);
      expect(user2Score.matchPredictions.correct).toBe(0);
      expect(user2Score.totalScore).toBe(0);
    });

    test('correctly scores free-for-all predictions', async () => {
      const brand = await createBrand();
      const wrestler1 = await createWrestler(brand.id);
      const wrestler2 = await createWrestler(brand.id);
      const wrestler3 = await createWrestler(brand.id);
      const event = await createEvent(brand.id, { status: 'completed' });
      const match = await createMatch(event.id, { matchType: 'Battle Royal' });

      // Free-for-all: no sides
      const p1 = await createMatchParticipant(match.id, wrestler1.id, 'wrestler', { side: null });
      const p2 = await createMatchParticipant(match.id, wrestler2.id, 'wrestler', { side: null });
      const p3 = await createMatchParticipant(match.id, wrestler3.id, 'wrestler', { side: null });

      const user = await createUser();
      await joinEvent(user.id, event.id);

      // User predicts wrestler2 wins
      await createMatchPrediction(user.id, match.id, { predictedParticipantId: p2.id });

      // Set match result: wrestler2 wins
      const db = getTestDb();
      await db.update(schema.matches).set({ winnerParticipantId: p2.id, outcome: 'winner' }).where(eq(schema.matches.id, match.id));

      // Score event (calculate isCorrect for predictions)
      await eventService.scoreEvent(event.id);

      // Get scores
      const leaderboard = await eventService.getScores(event.id);

      const userScore = leaderboard.find((s) => s.userId === user.id)!;
      expect(userScore.matchPredictions.correct).toBe(1);
      expect(userScore.totalScore).toBe(1);
    });

    test('handles partial results (some matches unscored)', async () => {
      const brand = await createBrand();
      const wrestler1 = await createWrestler(brand.id);
      const wrestler2 = await createWrestler(brand.id);
      const event = await createEvent(brand.id, { status: 'completed' });

      // Match 1: has result
      const match1 = await createMatch(event.id, { matchOrder: 1 });
      await createMatchParticipant(match1.id, wrestler1.id, 'wrestler', { side: 1 });
      await createMatchParticipant(match1.id, wrestler2.id, 'wrestler', { side: 2 });

      // Match 2: no result yet
      const match2 = await createMatch(event.id, { matchOrder: 2 });
      await createMatchParticipant(match2.id, wrestler1.id, 'wrestler', { side: 1 });
      await createMatchParticipant(match2.id, wrestler2.id, 'wrestler', { side: 2 });

      const user = await createUser();
      await joinEvent(user.id, event.id);

      // User makes predictions for both
      await createMatchPrediction(user.id, match1.id, { predictedSide: 1 });
      await createMatchPrediction(user.id, match2.id, { predictedSide: 1 });

      // Only match1 has result
      const db = getTestDb();
      await db.update(schema.matches).set({ winningSide: 1, outcome: 'winner' }).where(eq(schema.matches.id, match1.id));

      // Score event (calculate isCorrect for predictions)
      await eventService.scoreEvent(event.id);

      // Get scores
      const leaderboard = await eventService.getScores(event.id);

      const userScore = leaderboard.find((s) => s.userId === user.id)!;
      expect(userScore.matchPredictions.total).toBe(2);
      expect(userScore.matchPredictions.correct).toBe(1); // Only match1 scored
    });

    test('scores draws as no points awarded', async () => {
      const brand = await createBrand();
      const wrestler1 = await createWrestler(brand.id);
      const wrestler2 = await createWrestler(brand.id);
      const event = await createEvent(brand.id, { status: 'completed' });
      const match = await createMatch(event.id);
      await createMatchParticipant(match.id, wrestler1.id, 'wrestler', { side: 1 });
      await createMatchParticipant(match.id, wrestler2.id, 'wrestler', { side: 2 });

      const user = await createUser();
      await joinEvent(user.id, event.id);

      await createMatchPrediction(user.id, match.id, { predictedSide: 1 });

      // Set match result to draw
      const db = getTestDb();
      await db.update(schema.matches).set({ outcome: 'draw' }).where(eq(schema.matches.id, match.id));

      // Score event (calculate isCorrect for predictions)
      await eventService.scoreEvent(event.id);

      // Get scores
      const leaderboard = await eventService.getScores(event.id);

      const userScore = leaderboard.find((s) => s.userId === user.id)!;
      expect(userScore.matchPredictions.correct).toBe(0);
      expect(userScore.totalScore).toBe(0);
    });
  });

  describe('Contrarian Mode', () => {
    test('user wins if ALL match predictions wrong', async () => {
      const brand = await createBrand();
      const wrestler1 = await createWrestler(brand.id);
      const wrestler2 = await createWrestler(brand.id);
      const event = await createEvent(brand.id, { status: 'completed' });

      const match1 = await createMatch(event.id, { matchOrder: 1 });
      await createMatchParticipant(match1.id, wrestler1.id, 'wrestler', { side: 1 });
      await createMatchParticipant(match1.id, wrestler2.id, 'wrestler', { side: 2 });

      const match2 = await createMatch(event.id, { matchOrder: 2 });
      await createMatchParticipant(match2.id, wrestler1.id, 'wrestler', { side: 1 });
      await createMatchParticipant(match2.id, wrestler2.id, 'wrestler', { side: 2 });

      const contrarian = await createUser();
      await joinEvent(contrarian.id, event.id, 'contrarian');

      // Contrarian predicts wrong for all matches
      await createMatchPrediction(contrarian.id, match1.id, { predictedSide: 2 });
      await createMatchPrediction(contrarian.id, match2.id, { predictedSide: 2 });

      // Set results: side 1 wins both
      const db = getTestDb();
      await db.update(schema.matches).set({ winningSide: 1, outcome: 'winner' }).where(eq(schema.matches.id, match1.id));
      await db.update(schema.matches).set({ winningSide: 1, outcome: 'winner' }).where(eq(schema.matches.id, match2.id));

      // Score event (calculate isCorrect for predictions)
      await eventService.scoreEvent(event.id);

      // Get scores
      const leaderboard = await eventService.getScores(event.id);

      const contrarianScore = leaderboard.find((s) => s.userId === contrarian.id)!;
      expect(contrarianScore.isContrarian).toBe(true);
      expect(contrarianScore.didWinContrarian).toBe(true);
      expect(contrarianScore.matchPredictions.correct).toBe(0); // All wrong
    });

    test('user loses if ANY match prediction correct', async () => {
      const brand = await createBrand();
      const wrestler1 = await createWrestler(brand.id);
      const wrestler2 = await createWrestler(brand.id);
      const event = await createEvent(brand.id, { status: 'completed' });

      const match1 = await createMatch(event.id, { matchOrder: 1 });
      await createMatchParticipant(match1.id, wrestler1.id, 'wrestler', { side: 1 });
      await createMatchParticipant(match1.id, wrestler2.id, 'wrestler', { side: 2 });

      const match2 = await createMatch(event.id, { matchOrder: 2 });
      await createMatchParticipant(match2.id, wrestler1.id, 'wrestler', { side: 1 });
      await createMatchParticipant(match2.id, wrestler2.id, 'wrestler', { side: 2 });

      const contrarian = await createUser();
      await joinEvent(contrarian.id, event.id, 'contrarian');

      // Contrarian predicts: one wrong, one right
      await createMatchPrediction(contrarian.id, match1.id, { predictedSide: 2 }); // Wrong
      await createMatchPrediction(contrarian.id, match2.id, { predictedSide: 1 }); // Right

      // Set results
      const db = getTestDb();
      await db.update(schema.matches).set({ winningSide: 1, outcome: 'winner' }).where(eq(schema.matches.id, match1.id));
      await db.update(schema.matches).set({ winningSide: 1, outcome: 'winner' }).where(eq(schema.matches.id, match2.id));

      // Score event (calculate isCorrect for predictions)
      await eventService.scoreEvent(event.id);

      // Get scores
      const leaderboard = await eventService.getScores(event.id);

      const contrarianScore = leaderboard.find((s) => s.userId === contrarian.id)!;
      expect(contrarianScore.isContrarian).toBe(true);
      expect(contrarianScore.didWinContrarian).toBe(false); // Failed because got one right
      expect(contrarianScore.matchPredictions.correct).toBe(1);
    });

    test('contrarian winner beats highest normal score', async () => {
      const brand = await createBrand();
      const wrestler1 = await createWrestler(brand.id);
      const wrestler2 = await createWrestler(brand.id);
      const event = await createEvent(brand.id, { status: 'completed' });

      const match = await createMatch(event.id);
      await createMatchParticipant(match.id, wrestler1.id, 'wrestler', { side: 1 });
      await createMatchParticipant(match.id, wrestler2.id, 'wrestler', { side: 2 });

      const normalUser = await createUser();
      const contrarian = await createUser();
      await joinEvent(normalUser.id, event.id, 'normal');
      await joinEvent(contrarian.id, event.id, 'contrarian');

      // Normal user predicts correctly (gets 1 point)
      await createMatchPrediction(normalUser.id, match.id, { predictedSide: 1 });

      // Contrarian predicts wrong (wins contrarian mode)
      await createMatchPrediction(contrarian.id, match.id, { predictedSide: 2 });

      // Set result
      const db = getTestDb();
      await db.update(schema.matches).set({ winningSide: 1, outcome: 'winner' }).where(eq(schema.matches.id, match.id));

      // Score event (calculate isCorrect for predictions)
      await eventService.scoreEvent(event.id);

      // Get scores
      const leaderboard = await eventService.getScores(event.id);

      // Leaderboard should be sorted with contrarian winner first
      expect(leaderboard[0]!.userId).toBe(contrarian.id);
      expect(leaderboard[0]!.didWinContrarian).toBe(true);
      expect(leaderboard[1]!.userId).toBe(normalUser.id);
      expect(leaderboard[1]!.totalScore).toBe(1);
    });
  });

  describe('Edge Cases', () => {
    test('handles event with no predictions', async () => {
      const brand = await createBrand();
      const wrestler1 = await createWrestler(brand.id);
      const wrestler2 = await createWrestler(brand.id);
      const event = await createEvent(brand.id, { status: 'completed' });
      const match = await createMatch(event.id);
      await createMatchParticipant(match.id, wrestler1.id, 'wrestler', { side: 1 });
      await createMatchParticipant(match.id, wrestler2.id, 'wrestler', { side: 2 });

      const user = await createUser();
      await joinEvent(user.id, event.id);

      // User joins but makes no predictions

      // Set result
      const db = getTestDb();
      await db.update(schema.matches).set({ winningSide: 1, outcome: 'winner' }).where(eq(schema.matches.id, match.id));

      // Score event (calculate isCorrect for predictions)
      await eventService.scoreEvent(event.id);

      // Get scores
      const leaderboard = await eventService.getScores(event.id);

      const userScore = leaderboard.find((s) => s.userId === user.id)!;
      expect(userScore.matchPredictions.total).toBe(0);
      expect(userScore.matchPredictions.correct).toBe(0);
      expect(userScore.totalScore).toBe(0);
    });

    test('handles event with no participants', async () => {
      const brand = await createBrand();
      const event = await createEvent(brand.id, { status: 'completed' });
      const match = await createMatch(event.id);

      // No one joined the event
      const leaderboard = await eventService.getScores(event.id);

      expect(leaderboard).toEqual([]);
    });
  });
});
