import { NextRequest } from 'next/server';
import { db } from '@/app/lib/db';
import { userEventJoin, users } from '@/app/lib/schema';
import { apiHandler, apiSuccess, apiError } from '@/app/lib/api-helpers';
import { eq } from 'drizzle-orm';

/**
 * GET /api/events/:id/participants
 * Get all participants who have joined this event
 */
export const GET = apiHandler(async (req: NextRequest, { params }) => {
  if (!params?.id) {
    throw apiError('Event ID is required');
  }
  const eventId = params.id;

  // Fetch all joins for this event with user data
  const joins = await db
    .select({
      id: userEventJoin.id,
      userId: userEventJoin.userId,
      eventId: userEventJoin.eventId,
      mode: userEventJoin.mode,
      didWinContrarian: userEventJoin.didWinContrarian,
      createdAt: userEventJoin.createdAt,
      updatedAt: userEventJoin.updatedAt,
      user: {
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
      },
    })
    .from(userEventJoin)
    .innerJoin(users, eq(userEventJoin.userId, users.id))
    .where(eq(userEventJoin.eventId, eventId));

  // Transform to EventJoinWithUser
  const participants = joins.map((join) => ({
    id: join.id,
    userId: join.userId,
    eventId: join.eventId,
    mode: join.mode as 'normal' | 'contrarian',
    didWinContrarian: join.didWinContrarian,
    createdAt: join.createdAt,
    updatedAt: join.updatedAt,
    user: {
      id: join.user.id,
      name: join.user.name,
      email: join.user.email,
      isAdmin: join.user.role === 'admin',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  }));

  return apiSuccess(participants);
});
