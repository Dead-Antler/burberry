import { NextRequest } from 'next/server';
import { db } from '@/app/lib/db';
import { eventCustomPredictions, events } from '@/app/lib/schema';
import { eq } from 'drizzle-orm';
import { apiHandler, apiSuccess, apiError, parseBodyWithSchema } from '@/app/lib/api-helpers';
import { updateEventCustomPredictionSchema } from '@/app/lib/validation-schemas';

/**
 * GET /api/events/:id/custom-predictions/:predictionId
 * Get a specific custom prediction for an event
 */
export const GET = apiHandler(async (_req, { params }) => {
  if (!params?.id || !params?.predictionId) {
    throw apiError('Event ID and prediction ID are required');
  }

  const [prediction] = await db
    .select()
    .from(eventCustomPredictions)
    .where(eq(eventCustomPredictions.id, params.predictionId));

  if (!prediction || prediction.eventId !== params.id) {
    throw apiError('Prediction not found', 404);
  }

  return apiSuccess(prediction);
});

/**
 * PATCH /api/events/:id/custom-predictions/:predictionId
 * Update a custom prediction (including setting the answer)
 */
export const PATCH = apiHandler(async (req: NextRequest, { params }) => {
  if (!params?.id || !params?.predictionId) {
    throw apiError('Event ID and prediction ID are required');
  }

  const body = await parseBodyWithSchema(req, updateEventCustomPredictionSchema);

  if (
    !body.question &&
    body.answerTime === undefined &&
    body.answerCount === undefined &&
    body.answerWrestlerId === undefined &&
    body.answerBoolean === undefined &&
    body.answerText === undefined &&
    body.isScored === undefined
  ) {
    throw apiError('No fields to update');
  }

  // Verify event is locked or completed when setting answers
  if (
    body.answerTime !== undefined ||
    body.answerCount !== undefined ||
    body.answerWrestlerId !== undefined ||
    body.answerBoolean !== undefined ||
    body.answerText !== undefined ||
    body.isScored !== undefined
  ) {
    const [event] = await db.select().from(events).where(eq(events.id, params.id));

    if (!event) {
      throw apiError('Event not found', 404);
    }

    if (event.status === 'open') {
      throw apiError('Cannot set answers for an open event. Lock the event first.');
    }
  }

  const updateData: Record<string, unknown> = { updatedAt: new Date() };

  if (body.question !== undefined) updateData.question = body.question;
  if (body.answerTime !== undefined) updateData.answerTime = body.answerTime ? new Date(body.answerTime) : null;
  if (body.answerCount !== undefined) updateData.answerCount = body.answerCount;
  if (body.answerWrestlerId !== undefined) updateData.answerWrestlerId = body.answerWrestlerId;
  if (body.answerBoolean !== undefined) updateData.answerBoolean = body.answerBoolean;
  if (body.answerText !== undefined) updateData.answerText = body.answerText;
  if (body.isScored !== undefined) updateData.isScored = body.isScored;

  const [updatedPrediction] = await db
    .update(eventCustomPredictions)
    .set(updateData)
    .where(eq(eventCustomPredictions.id, params.predictionId))
    .returning();

  if (!updatedPrediction) {
    throw apiError('Prediction not found', 404);
  }

  return apiSuccess(updatedPrediction);
}, { requireAdmin: true });

/**
 * DELETE /api/events/:id/custom-predictions/:predictionId
 * Delete a custom prediction from an event
 */
export const DELETE = apiHandler(async (_req, { params }) => {
  if (!params?.id || !params?.predictionId) {
    throw apiError('Event ID and prediction ID are required');
  }

  const [deletedPrediction] = await db
    .delete(eventCustomPredictions)
    .where(eq(eventCustomPredictions.id, params.predictionId))
    .returning();

  if (!deletedPrediction || deletedPrediction.eventId !== params.id) {
    throw apiError('Prediction not found', 404);
  }

  return apiSuccess({ message: 'Custom prediction deleted successfully', id: params.predictionId });
}, { requireAdmin: true });
