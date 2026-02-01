import { NextRequest } from 'next/server';
import { apiHandler, apiSuccess, apiError, parseBodyWithSchema } from '@/app/lib/api-helpers';
import { reorderMatchesSchema } from '@/app/lib/validation-schemas';
import { matchService } from '@/app/lib/services/match.service';

/**
 * POST /api/events/:id/matches/reorder
 * Reorder matches for an event
 * Body: { matchIds: string[] }
 */
export const POST = apiHandler(async (req: NextRequest, { params }) => {
  if (!params?.id) {
    throw apiError('Event ID is required');
  }

  const body = await parseBodyWithSchema(req, reorderMatchesSchema);
  await matchService.reorder(params.id, body.matchIds);

  return apiSuccess({ success: true });
}, { requireAdmin: true });
