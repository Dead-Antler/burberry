import { db } from '@/app/lib/db';
import { userEventContrarian } from '@/app/lib/schema';
import { eq, and } from 'drizzle-orm';
import { apiHandler, apiSuccess, apiError, type AuthSession } from '@/app/lib/api-helpers';

/**
 * GET /api/predictions/contrarian/:eventId
 * Get contrarian mode status for a specific event and current user
 */
export const GET = apiHandler(async (_req, context) => {
  const { params, session: rawSession } = context;
  const session = rawSession as AuthSession;

  if (!params?.eventId) {
    throw apiError('Event ID is required');
  }

  const userId = session.user.id;
  const [record] = await db
    .select()
    .from(userEventContrarian)
    .where(and(eq(userEventContrarian.userId, userId), eq(userEventContrarian.eventId, params.eventId)));

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
export const DELETE = apiHandler(async (_req, context) => {
  const { params, session: rawSession } = context;
  const session = rawSession as AuthSession;

  if (!params?.eventId) {
    throw apiError('Event ID is required');
  }

  const userId = session.user.id;
  const [deletedRecord] = await db
    .delete(userEventContrarian)
    .where(and(eq(userEventContrarian.userId, userId), eq(userEventContrarian.eventId, params.eventId)))
    .returning();

  if (!deletedRecord) {
    throw apiError('Contrarian record not found', 404);
  }

  return apiSuccess({ message: 'Contrarian mode disabled successfully', eventId: params.eventId });
});
