import { NextRequest } from 'next/server';
import { apiHandler, apiSuccess, parseBodyWithSchema } from '@/app/lib/api-helpers';
import { customPredictionService } from '@/app/lib/services/prediction.service';
import { createUserCustomPredictionSchema } from '@/app/lib/validation-schemas';

/**
 * GET /api/predictions/custom
 * Get custom predictions for the current user
 * Query params:
 * - eventId: filter by event
 * - eventCustomPredictionId: filter by specific custom prediction
 */
export const GET = apiHandler(
  async (req: NextRequest, { session }) => {
    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get('eventId') || undefined;
    const eventCustomPredictionId = searchParams.get('eventCustomPredictionId') || undefined;

    const predictions = await customPredictionService.list(session.user.id, {
      eventId,
      eventCustomPredictionId,
    });

    return apiSuccess(predictions);
  }
);

/**
 * POST /api/predictions/custom
 * Create or update a custom prediction
 */
export const POST = apiHandler(
  async (req: NextRequest, { session }) => {
    const body = await parseBodyWithSchema(req, createUserCustomPredictionSchema);

    const { prediction, isNew } = await customPredictionService.createOrUpdate(session.user.id, body);

    return apiSuccess(prediction, isNew ? 201 : 200);
  }
);
