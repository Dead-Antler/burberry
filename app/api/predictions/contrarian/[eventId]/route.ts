import { db } from '@/app/lib/db';
import { userEventContrarian } from '@/app/lib/schema';
import { eq, and } from 'drizzle-orm';
import { apiHandler, apiSuccess, apiError } from '@/app/lib/api-helpers';

/**
 * GET /api/predictions/contrarian/:eventId
 * Get contrarian mode status for a specific event and current user
 */
export const GET = apiHandler(async (_req, { params, session }) => {
  if (!params?.eventId) {
    throw apiError('Event ID is required');
  }

  const [record] = await db
    .select()
    .from(userEventContrarian)
    .where(and(eq(userEventContrarian.userId, session!.user!.id!), eq(userEventContrarian.eventId, params.eventId)));

  if (!record) {
    // No contrarian record means user is not in contrarian mode
    return apiSuccess({ isContrarian: false, didWinContrarian: null });
  }

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

  const [deletedRecord] = await db
    .delete(userEventContrarian)
    .where(and(eq(userEventContrarian.userId, session!.user!.id!), eq(userEventContrarian.eventId, params.eventId)))
    .returning();

  if (!deletedRecord) {
    throw apiError('Contrarian record not found', 404);
  }

  return apiSuccess({ message: 'Contrarian mode disabled successfully', eventId: params.eventId });
});
