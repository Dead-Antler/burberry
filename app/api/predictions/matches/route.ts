import { NextRequest } from 'next/server';
import { apiHandler, apiSuccess, parseBodyWithSchema } from '@/app/lib/api-helpers';
import { createMatchPredictionSchema } from '@/app/lib/validation-schemas';
import { matchPredictionService } from '@/app/lib/services/prediction.service';

/**
 * GET /api/predictions/matches
 * Get match predictions for the current user
 * Query params:
 * - eventId: filter by event
 * - matchId: filter by match
 */
export const GET = apiHandler(
  async (req: NextRequest, { session }) => {
    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get('eventId') || undefined;
    const matchId = searchParams.get('matchId') || undefined;

    const predictions = await matchPredictionService.list(session.user.id, { eventId, matchId });

    return apiSuccess(predictions);
  },
  {
    rateLimit: { limit: 60, windowMs: 60 * 1000, prefix: 'predictions:match:read' },
  }
);

/**
 * POST /api/predictions/matches
 * Create or update a match prediction
 */
export const POST = apiHandler(
  async (req: NextRequest, { session }) => {
    const body = await parseBodyWithSchema(req, createMatchPredictionSchema);

    const prediction = await matchPredictionService.createOrUpdate(session.user.id, body);

    return apiSuccess(prediction, 201);
  },
  {
    rateLimit: { limit: 30, windowMs: 60 * 1000, prefix: 'predictions:match:write' },
  }
);
