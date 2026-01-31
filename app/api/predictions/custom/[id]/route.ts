import { NextRequest } from 'next/server';
import { db } from '@/app/lib/db';
import { userCustomPredictions, eventCustomPredictions, events } from '@/app/lib/schema';
import { eq, and } from 'drizzle-orm';
import { apiHandler, apiSuccess, apiError, parseBody } from '@/app/lib/api-helpers';

/**
 * GET /api/predictions/custom/:id
 * Get a specific custom prediction by ID
 */
export const GET = apiHandler(async (_req, { params, session }) => {
  if (!params?.id) {
    throw apiError('Prediction ID is required');
  }

  const [prediction] = await db
    .select()
    .from(userCustomPredictions)
    .where(and(eq(userCustomPredictions.id, params.id), eq(userCustomPredictions.userId, session!.user!.id!)));

  if (!prediction) {
    throw apiError('Prediction not found', 404);
  }

  return apiSuccess(prediction);
});

/**
 * PATCH /api/predictions/custom/:id
 * Update a custom prediction
 */
export const PATCH = apiHandler(async (req: NextRequest, { params, session }) => {
  if (!params?.id) {
    throw apiError('Prediction ID is required');
  }

  const body = await parseBody<{
    predictionTime?: string | Date | null;
    predictionCount?: number | null;
    predictionWrestlerId?: string | null;
    predictionBoolean?: boolean | null;
    predictionText?: string | null;
  }>(req);

  if (
    body.predictionTime === undefined &&
    body.predictionCount === undefined &&
    body.predictionWrestlerId === undefined &&
    body.predictionBoolean === undefined &&
    body.predictionText === undefined
  ) {
    throw apiError('No fields to update');
  }

  // Get prediction and verify ownership
  const [prediction] = await db
    .select()
    .from(userCustomPredictions)
    .where(and(eq(userCustomPredictions.id, params.id), eq(userCustomPredictions.userId, session!.user!.id!)));

  if (!prediction) {
    throw apiError('Prediction not found', 404);
  }

  // Verify event is still open
  const [eventPrediction] = await db
    .select()
    .from(eventCustomPredictions)
    .where(eq(eventCustomPredictions.id, prediction.eventCustomPredictionId));

  if (!eventPrediction) {
    throw apiError('Event custom prediction not found', 404);
  }

  const [event] = await db.select().from(events).where(eq(events.id, eventPrediction.eventId));

  if (!event) {
    throw apiError('Event not found', 404);
  }

  if (event.status !== 'open') {
    throw apiError('Cannot update predictions for a locked or completed event');
  }

  const updateData: Record<string, unknown> = { updatedAt: new Date() };

  if (body.predictionTime !== undefined) updateData.predictionTime = body.predictionTime ? new Date(body.predictionTime) : null;
  if (body.predictionCount !== undefined) updateData.predictionCount = body.predictionCount;
  if (body.predictionWrestlerId !== undefined) updateData.predictionWrestlerId = body.predictionWrestlerId;
  if (body.predictionBoolean !== undefined) updateData.predictionBoolean = body.predictionBoolean;
  if (body.predictionText !== undefined) updateData.predictionText = body.predictionText;

  const [updatedPrediction] = await db
    .update(userCustomPredictions)
    .set(updateData)
    .where(eq(userCustomPredictions.id, params.id))
    .returning();

  return apiSuccess(updatedPrediction);
});

/**
 * DELETE /api/predictions/custom/:id
 * Delete a custom prediction
 */
export const DELETE = apiHandler(async (_req, { params, session }) => {
  if (!params?.id) {
    throw apiError('Prediction ID is required');
  }

  // Get prediction and verify ownership
  const [prediction] = await db
    .select()
    .from(userCustomPredictions)
    .where(and(eq(userCustomPredictions.id, params.id), eq(userCustomPredictions.userId, session!.user!.id!)));

  if (!prediction) {
    throw apiError('Prediction not found', 404);
  }

  // Verify event is still open
  const [eventPrediction] = await db
    .select()
    .from(eventCustomPredictions)
    .where(eq(eventCustomPredictions.id, prediction.eventCustomPredictionId));

  if (!eventPrediction) {
    throw apiError('Event custom prediction not found', 404);
  }

  const [event] = await db.select().from(events).where(eq(events.id, eventPrediction.eventId));

  if (!event) {
    throw apiError('Event not found', 404);
  }

  if (event.status !== 'open') {
    throw apiError('Cannot delete predictions for a locked or completed event');
  }

  await db.delete(userCustomPredictions).where(eq(userCustomPredictions.id, params.id));

  return apiSuccess({ message: 'Prediction deleted successfully', id: params.id });
});
