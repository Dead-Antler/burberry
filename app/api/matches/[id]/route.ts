import { NextRequest } from 'next/server';
import { apiHandler, apiSuccess, apiError, parseBodyWithSchema } from '@/app/lib/api-helpers';
import { updateMatchSchema } from '@/app/lib/validation-schemas';
import { matchService } from '@/app/lib/services/match.service';

/**
 * GET /api/matches/:id
 * Get a specific match by ID
 * Query params:
 * - includeParticipants: include participant data (true/false)
 */
export const GET = apiHandler(async (req: NextRequest, { params }) => {
  if (!params?.id) {
    throw apiError('Match ID is required');
  }

  const { searchParams } = new URL(req.url);
  const includeParticipants = searchParams.get('includeParticipants') === 'true';

  const match = await matchService.getById(params.id, {
    includeParticipants,
  });

  return apiSuccess(match);
});

/**
 * PATCH /api/matches/:id
 * Update a match (including setting results)
 */
export const PATCH = apiHandler(async (req: NextRequest, { params }) => {
  if (!params?.id) {
    throw apiError('Match ID is required');
  }

  const body = await parseBodyWithSchema(req, updateMatchSchema);

  if (
    !body.matchType &&
    body.matchOrder === undefined &&
    !body.outcome &&
    body.winningSide === undefined &&
    body.winnerParticipantId === undefined
  ) {
    throw apiError('No fields to update');
  }

  const match = await matchService.update(params.id, body);

  return apiSuccess(match);
}, { requireAdmin: true });

/**
 * DELETE /api/matches/:id
 * Delete a match (hard delete - cascades to participants and predictions)
 */
export const DELETE = apiHandler(async (_req, { params }) => {
  if (!params?.id) {
    throw apiError('Match ID is required');
  }

  await matchService.delete(params.id);

  return apiSuccess({ message: 'Match deleted successfully', id: params.id });
}, { requireAdmin: true });
