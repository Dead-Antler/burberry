import { apiHandler, apiSuccess, apiError } from '@/app/lib/api-helpers';
import { contrarianService } from '@/app/lib/services/prediction.service';

/**
 * GET /api/predictions/contrarian/:eventId
 * Get contrarian mode status for a specific event and current user
 */
export const GET = apiHandler(async (_req, { params, session }) => {
  if (!params?.eventId) {
    throw apiError('Event ID is required');
  }

  const record = await contrarianService.getForEvent(session.user.id, params.eventId);

  return apiSuccess(record);
});

/**
 * DELETE /api/predictions/contrarian/:eventId
 * Remove contrarian mode for an event
 */
export const DELETE = apiHandler(async (_req, { params, session }) => {
  if (!params?.eventId) {
    throw apiError('Event ID is required');
  }

  await contrarianService.delete(session.user.id, params.eventId);

  return apiSuccess({ message: 'Contrarian mode disabled successfully', eventId: params.eventId });
});
