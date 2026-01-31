import { NextRequest } from 'next/server';
import { db } from '@/app/lib/db';
import { matchPredictions, matches, events } from '@/app/lib/schema';
import { eq, and } from 'drizzle-orm';
import { apiHandler, apiSuccess, apiError, parseBody } from '@/app/lib/api-helpers';

/**
 * GET /api/predictions/matches/:id
 * Get a specific match prediction by ID
 */
export const GET = apiHandler(async (_req, { params, session }) => {
  if (!params?.id) {
    throw apiError('Prediction ID is required');
  }

  const [prediction] = await db
    .select()
    .from(matchPredictions)
    .where(and(eq(matchPredictions.id, params.id), eq(matchPredictions.userId, session!.user!.id!)));

  if (!prediction) {
    throw apiError('Prediction not found', 404);
  }

  return apiSuccess(prediction);
});

/**
 * PATCH /api/predictions/matches/:id
 * Update a match prediction
 */
export const PATCH = apiHandler(async (req: NextRequest, { params, session }) => {
  if (!params?.id) {
    throw apiError('Prediction ID is required');
  }

  const body = await parseBody<{
    predictedSide?: number | null;
    predictedParticipantId?: string | null;
  }>(req);

  if (body.predictedSide === undefined && body.predictedParticipantId === undefined) {
    throw apiError('No fields to update');
  }

  // Get prediction and verify ownership
  const [prediction] = await db
    .select()
    .from(matchPredictions)
    .where(and(eq(matchPredictions.id, params.id), eq(matchPredictions.userId, session!.user!.id!)));

  if (!prediction) {
    throw apiError('Prediction not found', 404);
  }

  // Verify event is still open
  const [match] = await db.select().from(matches).where(eq(matches.id, prediction.matchId));

  if (!match) {
    throw apiError('Match not found', 404);
  }

  const [event] = await db.select().from(events).where(eq(events.id, match.eventId));

  if (!event) {
    throw apiError('Event not found', 404);
  }

  if (event.status !== 'open') {
    throw apiError('Cannot update predictions for a locked or completed event');
  }

  const updateData: Record<string, unknown> = { updatedAt: new Date() };

  if (body.predictedSide !== undefined) updateData.predictedSide = body.predictedSide;
  if (body.predictedParticipantId !== undefined) updateData.predictedParticipantId = body.predictedParticipantId;

  const [updatedPrediction] = await db
    .update(matchPredictions)
    .set(updateData)
    .where(eq(matchPredictions.id, params.id))
    .returning();

  return apiSuccess(updatedPrediction);
});

/**
 * DELETE /api/predictions/matches/:id
 * Delete a match prediction
 */
export const DELETE = apiHandler(async (_req, { params, session }) => {
  if (!params?.id) {
    throw apiError('Prediction ID is required');
  }

  // Get prediction and verify ownership
  const [prediction] = await db
    .select()
    .from(matchPredictions)
    .where(and(eq(matchPredictions.id, params.id), eq(matchPredictions.userId, session!.user!.id!)));

  if (!prediction) {
    throw apiError('Prediction not found', 404);
  }

  // Verify event is still open
  const [match] = await db.select().from(matches).where(eq(matches.id, prediction.matchId));

  if (!match) {
    throw apiError('Match not found', 404);
  }

  const [event] = await db.select().from(events).where(eq(events.id, match.eventId));

  if (!event) {
    throw apiError('Event not found', 404);
  }

  if (event.status !== 'open') {
    throw apiError('Cannot delete predictions for a locked or completed event');
  }

  await db.delete(matchPredictions).where(eq(matchPredictions.id, params.id));

  return apiSuccess({ message: 'Prediction deleted successfully', id: params.id });
});
