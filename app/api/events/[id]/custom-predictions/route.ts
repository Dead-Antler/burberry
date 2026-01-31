import { NextRequest } from 'next/server';
import { db } from '@/app/lib/db';
import { eventCustomPredictions, customPredictionTemplates } from '@/app/lib/schema';
import { eq } from 'drizzle-orm';
import { apiHandler, apiSuccess, apiError, parseBody, validateRequired, generateId } from '@/app/lib/api-helpers';

/**
 * GET /api/events/:id/custom-predictions
 * Get all custom predictions for an event
 * Query params:
 * - includeTemplate: include template data (true/false)
 */
export const GET = apiHandler(async (req: NextRequest, { params }) => {
  if (!params?.id) {
    throw apiError('Event ID is required');
  }

  const { searchParams } = new URL(req.url);
  const includeTemplate = searchParams.get('includeTemplate') === 'true';

  if (includeTemplate) {
    const predictions = await db
      .select({
        eventCustomPrediction: eventCustomPredictions,
        template: customPredictionTemplates,
      })
      .from(eventCustomPredictions)
      .leftJoin(customPredictionTemplates, eq(eventCustomPredictions.templateId, customPredictionTemplates.id))
      .where(eq(eventCustomPredictions.eventId, params.id));

    return apiSuccess(predictions);
  }

  const predictions = await db.select().from(eventCustomPredictions).where(eq(eventCustomPredictions.eventId, params.id));

  return apiSuccess(predictions);
});

/**
 * POST /api/events/:id/custom-predictions
 * Add a custom prediction to an event
 */
export const POST = apiHandler(async (req: NextRequest, { params }) => {
  if (!params?.id) {
    throw apiError('Event ID is required');
  }

  const body = await parseBody<{
    templateId: string;
    question: string;
  }>(req);

  validateRequired(body, ['templateId', 'question']);

  const now = new Date();

  const [newPrediction] = await db
    .insert(eventCustomPredictions)
    .values({
      id: generateId('eventcustompred'),
      eventId: params.id,
      templateId: body.templateId,
      question: body.question,
      answerTime: null,
      answerCount: null,
      answerWrestlerId: null,
      answerBoolean: null,
      answerText: null,
      isScored: false,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return apiSuccess(newPrediction, 201);
}, { requireAdmin: true });
