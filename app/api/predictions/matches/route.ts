import { NextRequest } from 'next/server';
import { db } from '@/app/lib/db';
import { matchPredictions, matches, events } from '@/app/lib/schema';
import { eq, and } from 'drizzle-orm';
import { apiHandler, apiSuccess, parseBody, validateRequired, generateId, apiError } from '@/app/lib/api-helpers';

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

  let query = db.select().from(matchPredictions).where(eq(matchPredictions.userId, session!.user!.id!));

  if (matchId) {
    query = query.where(eq(matchPredictions.matchId, matchId)) as typeof query;
  } else if (eventId) {
    // Get all matches for the event, then filter predictions
    const eventMatches = await db.select().from(matches).where(eq(matches.eventId, eventId));

    const matchIds = eventMatches.map((m) => m.id);

    if (matchIds.length === 0) {
      return apiSuccess([]);
    }

    query = query.where(
      and(
        eq(matchPredictions.userId, session!.user!.id!),
        // Use OR condition for multiple match IDs
        ...matchIds.map((id) => eq(matchPredictions.matchId, id))
      )
    ) as typeof query;
  }

  const predictions = await query;
  return apiSuccess(predictions);
});

/**
 * POST /api/predictions/matches
 * Create or update a match prediction
 */
export const POST = apiHandler(async (req: NextRequest, { session }) => {
  const body = await parseBody<{
    matchId: string;
    predictedSide?: number | null;
    predictedParticipantId?: string | null;
  }>(req);

  validateRequired(body, ['matchId']);

  // Validate that either predictedSide or predictedParticipantId is provided (but not both)
  if (
    (body.predictedSide === null || body.predictedSide === undefined) &&
    (body.predictedParticipantId === null || body.predictedParticipantId === undefined)
  ) {
    throw apiError('Either predictedSide or predictedParticipantId must be provided');
  }

  if (body.predictedSide !== null && body.predictedSide !== undefined && body.predictedParticipantId) {
    throw apiError('Cannot provide both predictedSide and predictedParticipantId');
  }

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

  const userId = session!.user!.id!;

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
