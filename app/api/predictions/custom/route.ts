import { NextRequest } from 'next/server';
import { apiHandler, apiSuccess, parseBody, validateRequired } from '@/app/lib/api-helpers';
import { customPredictionService } from '@/app/lib/services/prediction.service';

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
  },
  {
    rateLimit: { limit: 60, windowMs: 60 * 1000, prefix: 'predictions:custom:read' },
  }
);

/**
 * POST /api/predictions/custom
 * Create or update a custom prediction
 */
export const POST = apiHandler(
  async (req: NextRequest, { session }) => {
    const body = await parseBody<{
      eventCustomPredictionId: string;
      predictionTime?: string | Date | null;
      predictionCount?: number | null;
      predictionWrestlerId?: string | null;
      predictionBoolean?: boolean | null;
      predictionText?: string | null;
    }>(req);

    validateRequired(body, ['eventCustomPredictionId']);

    const { prediction, isNew } = await customPredictionService.createOrUpdate(session.user.id, body);

    return apiSuccess(prediction, isNew ? 201 : 200);
  },
  {
    rateLimit: { limit: 30, windowMs: 60 * 1000, prefix: 'predictions:custom:write' },
  }
);
