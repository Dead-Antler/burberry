import { NextRequest } from 'next/server';
import { db } from '@/app/lib/db';
import { matchPredictions, matches, events } from '@/app/lib/schema';
import { eq, and } from 'drizzle-orm';
import { apiHandler, apiSuccess, parseBodyWithSchema, generateId, apiError } from '@/app/lib/api-helpers';
import { createMatchPredictionSchema } from '@/app/lib/validation-schemas';

/**
 * GET /api/predictions/matches
 * Get match predictions for the current user
 * Query params:
 * - eventId: filter by event
 * - matchId: filter by match
 */
export const GET = apiHandler(async (req: NextRequest, { session }) => {
  const { searchParams } = new URL(req.url);
  const eventId = searchParams.get('eventId');
  const matchId = searchParams.get('matchId');

  const conditions = [eq(matchPredictions.userId, session.user.id)];

  if (matchId) {
    conditions.push(eq(matchPredictions.matchId, matchId));
  } else if (eventId) {
    // Get all matches for the event, then filter predictions
    const eventMatches = await db.select().from(matches).where(eq(matches.eventId, eventId));

    const matchIds = eventMatches.map((m) => m.id);

    if (matchIds.length === 0) {
      return apiSuccess([]);
    }

    // Add OR conditions for each match ID using inArray
    const { inArray } = await import('drizzle-orm');
    conditions.push(inArray(matchPredictions.matchId, matchIds));
  }

  const predictions = await db
    .select()
    .from(matchPredictions)
    .where(and(...conditions));

  return apiSuccess(predictions);
});

/**
 * POST /api/predictions/matches
 * Create or update a match prediction
 */
export const POST = apiHandler(async (req: NextRequest, { session }) => {
  const body = await parseBodyWithSchema(req, createMatchPredictionSchema);

  // Verify match exists and event is open
  const [match] = await db.select().from(matches).where(eq(matches.id, body.matchId));

  if (!match) {
    throw apiError('Match not found', 404);
  }

  const [event] = await db.select().from(events).where(eq(events.id, match.eventId));

  if (!event) {
    throw apiError('Event not found', 404);
  }

  if (event.status !== 'open') {
    throw apiError('Cannot make predictions for a locked or completed event');
  }

  const userId = session.user.id;

  // Check if prediction already exists
  const [existingPrediction] = await db
    .select()
    .from(matchPredictions)
    .where(and(eq(matchPredictions.userId, userId), eq(matchPredictions.matchId, body.matchId)));

  const now = new Date();

  if (existingPrediction) {
    // Update existing prediction
    const [updatedPrediction] = await db
      .update(matchPredictions)
      .set({
        predictedSide: body.predictedSide ?? null,
        predictedParticipantId: body.predictedParticipantId ?? null,
        updatedAt: now,
      })
      .where(eq(matchPredictions.id, existingPrediction.id))
      .returning();

    return apiSuccess(updatedPrediction);
  } else {
    // Create new prediction
    const [newPrediction] = await db
      .insert(matchPredictions)
      .values({
        id: generateId('matchpred'),
        userId,
        matchId: body.matchId,
        predictedSide: body.predictedSide ?? null,
        predictedParticipantId: body.predictedParticipantId ?? null,
        isCorrect: null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return apiSuccess(newPrediction, 201);
  }
});
