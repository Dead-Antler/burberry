/**
 * Prediction Lifecycle Integration Test
 * Exercises the full flow: create event → add matches → join → predict → lock → results → score → leaderboard
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
  joinEvent,
} from '../helpers/fixtures';
import { eventService } from '@/app/lib/services/event.service';
import { matchPredictionService } from '@/app/lib/services/prediction.service';
import { eq } from 'drizzle-orm';

describe('Prediction Lifecycle Integration', () => {
  beforeAll(async () => {
    await setupTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
  });

  test('full lifecycle: create → predict → lock → results → score → leaderboard', async () => {
    const db = getTestDb();

    // 1. Create brand, wrestlers, event, match, participants
    const brand = await createBrand({ name: 'WWE' });
    const wrestler1 = await createWrestler(brand.id, { currentName: 'John Cena' });
    const wrestler2 = await createWrestler(brand.id, { currentName: 'The Rock' });
    const event = await createEvent(brand.id, { name: 'WrestleMania', status: 'open' });
    const match = await createMatch(event.id, { matchType: 'Singles', matchOrder: 1 });
    await createMatchParticipant(match.id, wrestler1.id, 'wrestler', { side: 1 });
    await createMatchParticipant(match.id, wrestler2.id, 'wrestler', { side: 2 });

    // 2. Create users and join event
    const user1 = await createUser({ name: 'Alice' });
    const user2 = await createUser({ name: 'Bob' });
    await joinEvent(user1.id, event.id);
    await joinEvent(user2.id, event.id);

    // 3. Users make predictions (user1 picks side 1, user2 picks side 2)
    const pred1 = await matchPredictionService.createOrUpdate(user1.id, {
      matchId: match.id,
      predictedSide: 1,
    });
    expect(pred1.userId).toBe(user1.id);
    expect(pred1.predictedSide).toBe(1);

    const pred2 = await matchPredictionService.createOrUpdate(user2.id, {
      matchId: match.id,
      predictedSide: 2,
    });
    expect(pred2.userId).toBe(user2.id);
    expect(pred2.predictedSide).toBe(2);

    // 4. Transition event to 'locked'
    await eventService.update(event.id, { status: 'locked' });

    const [lockedEvent] = await db
      .select()
      .from(schema.events)
      .where(eq(schema.events.id, event.id));
    expect(lockedEvent.status).toBe('locked');

    // 5. Lock the match and verify predictions are rejected
    await db
      .update(schema.matches)
      .set({ isLocked: true })
      .where(eq(schema.matches.id, match.id));

    await expect(
      matchPredictionService.createOrUpdate(user1.id, {
        matchId: match.id,
        predictedSide: 2,
      })
    ).rejects.toThrow();

    // 6. Enter results: wrestler1 (side 1) wins, transition to completed
    await db
      .update(schema.matches)
      .set({ winningSide: 1, outcome: 'winner' })
      .where(eq(schema.matches.id, match.id));

    await eventService.update(event.id, { status: 'completed' });

    const [completedEvent] = await db
      .select()
      .from(schema.events)
      .where(eq(schema.events.id, event.id));
    expect(completedEvent.status).toBe('completed');

    // 7. Score the event
    const scoreResult = await eventService.scoreEvent(event.id);
    expect(scoreResult.matchPredictionsScored).toBeGreaterThan(0);

    // 8. Verify predictions were scored correctly
    const [scoredPred1] = await db
      .select()
      .from(schema.matchPredictions)
      .where(eq(schema.matchPredictions.id, pred1.id));
    expect(scoredPred1.isCorrect).toBe(true); // user1 predicted side 1 (correct)

    const [scoredPred2] = await db
      .select()
      .from(schema.matchPredictions)
      .where(eq(schema.matchPredictions.id, pred2.id));
    expect(scoredPred2.isCorrect).toBe(false); // user2 predicted side 2 (wrong)

    // 9. Get leaderboard and verify scores
    const scores = await eventService.getScores(event.id);
    expect(scores.length).toBeGreaterThanOrEqual(2);

    const user1Score = scores.find(s => s.userId === user1.id);
    const user2Score = scores.find(s => s.userId === user2.id);

    expect(user1Score).toBeDefined();
    expect(user2Score).toBeDefined();
    expect(user1Score!.matchPredictions.correct).toBe(1);
    expect(user2Score!.matchPredictions.correct).toBe(0);
    expect(user1Score!.totalScore).toBeGreaterThan(user2Score!.totalScore);
  });

  test('invalid status transitions are rejected', async () => {
    const brand = await createBrand();
    const event = await createEvent(brand.id, { status: 'open' });

    // Cannot skip from open to completed
    await expect(
      eventService.update(event.id, { status: 'completed' })
    ).rejects.toThrow();

    // Must go open → locked first
    await eventService.update(event.id, { status: 'locked' });

    // Cannot go back to open
    await expect(
      eventService.update(event.id, { status: 'open' })
    ).rejects.toThrow();
  });

  test('prediction upsert updates existing prediction', async () => {
    const brand = await createBrand();
    const event = await createEvent(brand.id, { status: 'open' });
    const match = await createMatch(event.id);
    const w1 = await createWrestler(brand.id);
    const w2 = await createWrestler(brand.id);
    await createMatchParticipant(match.id, w1.id, 'wrestler', { side: 1 });
    await createMatchParticipant(match.id, w2.id, 'wrestler', { side: 2 });
    const user = await createUser();

    // First prediction
    const pred = await matchPredictionService.createOrUpdate(user.id, {
      matchId: match.id,
      predictedSide: 1,
    });

    // Change mind
    const updated = await matchPredictionService.createOrUpdate(user.id, {
      matchId: match.id,
      predictedSide: 2,
    });

    // Same prediction ID (upsert), different side
    expect(updated.id).toBe(pred.id);
    expect(updated.predictedSide).toBe(2);
  });
});
