import { NextRequest } from 'next/server';
import { db } from '@/app/lib/db';
import { userCustomPredictions, eventCustomPredictions, customPredictionTemplates, events } from '@/app/lib/schema';
import { eq, and } from 'drizzle-orm';
import { apiHandler, apiSuccess, parseBody, validateRequired, generateId, apiError } from '@/app/lib/api-helpers';

/**
 * GET /api/predictions/custom
 * Get custom predictions for the current user
 * Query params:
 * - eventId: filter by event
 * - eventCustomPredictionId: filter by specific custom prediction
 */
export const GET = apiHandler(async (req: NextRequest, { session }) => {
  const { searchParams } = new URL(req.url);
  const eventId = searchParams.get('eventId');
  const eventCustomPredictionId = searchParams.get('eventCustomPredictionId');

  const conditions = [eq(userCustomPredictions.userId, session.user.id)];

  if (eventCustomPredictionId) {
    conditions.push(eq(userCustomPredictions.eventCustomPredictionId, eventCustomPredictionId));
  } else if (eventId) {
    // Get all custom predictions for the event, then filter user predictions
    const eventPredictions = await db
      .select()
      .from(eventCustomPredictions)
      .where(eq(eventCustomPredictions.eventId, eventId));

    const predictionIds = eventPredictions.map((p) => p.id);

    if (predictionIds.length === 0) {
      return apiSuccess([]);
    }

    // Add OR conditions for each prediction ID using inArray
    const { inArray } = await import('drizzle-orm');
    conditions.push(inArray(userCustomPredictions.eventCustomPredictionId, predictionIds));
  }

  const predictions = await db
    .select()
    .from(userCustomPredictions)
    .where(and(...conditions));

  return apiSuccess(predictions);
});

/**
 * POST /api/predictions/custom
 * Create or update a custom prediction
 */
export const POST = apiHandler(async (req: NextRequest, { session }) => {
  const body = await parseBody<{
    eventCustomPredictionId: string;
    predictionTime?: string | Date | null;
    predictionCount?: number | null;
    predictionWrestlerId?: string | null;
    predictionBoolean?: boolean | null;
    predictionText?: string | null;
  }>(req);

  validateRequired(body, ['eventCustomPredictionId']);

  // Verify event custom prediction exists and get its type
  const [eventPrediction] = await db
    .select({
      eventCustomPrediction: eventCustomPredictions,
      template: customPredictionTemplates,
    })
    .from(eventCustomPredictions)
    .leftJoin(customPredictionTemplates, eq(eventCustomPredictions.templateId, customPredictionTemplates.id))
    .where(eq(eventCustomPredictions.id, body.eventCustomPredictionId));

  if (!eventPrediction || !eventPrediction.template) {
    throw apiError('Custom prediction not found', 404);
  }

  // Verify event is open
  const [event] = await db
    .select()
    .from(events)
    .where(eq(events.id, eventPrediction.eventCustomPrediction.eventId));

  if (!event) {
    throw apiError('Event not found', 404);
  }

  if (event.status !== 'open') {
    throw apiError('Cannot make predictions for a locked or completed event');
  }

  // Validate correct field is provided based on template type
  const predictionType = eventPrediction.template.predictionType;
  const validationMap: Record<string, string> = {
    time: 'predictionTime',
    count: 'predictionCount',
    wrestler: 'predictionWrestlerId',
    boolean: 'predictionBoolean',
    text: 'predictionText',
  };

  const requiredField = validationMap[predictionType];
  if (!requiredField || body[requiredField as keyof typeof body] === undefined) {
    throw apiError(`${requiredField} is required for ${predictionType} predictions`);
  }

  const userId = session.user.id;

  // Check if prediction already exists
  const [existingPrediction] = await db
    .select()
    .from(userCustomPredictions)
    .where(
      and(
        eq(userCustomPredictions.userId, userId),
        eq(userCustomPredictions.eventCustomPredictionId, body.eventCustomPredictionId)
      )
    );

  const now = new Date();

  if (existingPrediction) {
    // Update existing prediction
    const updateData: Record<string, unknown> = { updatedAt: now };

    if (body.predictionTime !== undefined) updateData.predictionTime = body.predictionTime ? new Date(body.predictionTime) : null;
    if (body.predictionCount !== undefined) updateData.predictionCount = body.predictionCount;
    if (body.predictionWrestlerId !== undefined) updateData.predictionWrestlerId = body.predictionWrestlerId;
    if (body.predictionBoolean !== undefined) updateData.predictionBoolean = body.predictionBoolean;
    if (body.predictionText !== undefined) updateData.predictionText = body.predictionText;

    const [updatedPrediction] = await db
      .update(userCustomPredictions)
      .set(updateData)
      .where(eq(userCustomPredictions.id, existingPrediction.id))
      .returning();

    return apiSuccess(updatedPrediction);
  } else {
    // Create new prediction
    const [newPrediction] = await db
      .insert(userCustomPredictions)
      .values({
        id: generateId('custompred'),
        userId,
        eventCustomPredictionId: body.eventCustomPredictionId,
        predictionTime: body.predictionTime ? new Date(body.predictionTime) : null,
        predictionCount: body.predictionCount ?? null,
        predictionWrestlerId: body.predictionWrestlerId ?? null,
        predictionBoolean: body.predictionBoolean ?? null,
        predictionText: body.predictionText ?? null,
        isCorrect: null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return apiSuccess(newPrediction, 201);
  }
});
