import { NextRequest } from 'next/server';
import { apiHandler, apiSuccess, apiError } from '@/app/lib/api-helpers';
import { eventService } from '@/app/lib/services/event.service';

/**
 * POST /api/events/:id/score
 * Calculate scores for all predictions for an event
 * This should be called after event is completed
 */
export const POST = apiHandler(async (_req, { params }) => {
  if (!params?.id) {
    throw apiError('Event ID is required');
  }

  const result = await eventService.scoreEvent(params.id);

  return apiSuccess({
    message: 'Event scored successfully',
    ...result,
  });
}, { requireAdmin: true });

/**
 * GET /api/events/:id/score
 * Get scores/leaderboard for an event
 * Query params:
 * - userId: get score for specific user (optional)
 */
export const GET = apiHandler(async (req: NextRequest, { params }) => {
  if (!params?.id) {
    throw apiError('Event ID is required');
  }

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId') || undefined;

  const scores = await eventService.getScores(params.id, userId);

  return apiSuccess(scores);
});
