import { NextRequest } from 'next/server';
import { db } from '@/app/lib/db';
import { userEventJoin, events } from '@/app/lib/schema';
import { joinEventSchema } from '@/app/lib/validation-schemas';
import { apiHandler, apiSuccess, apiError, parseBodyWithSchema, generateId } from '@/app/lib/api-helpers';
import { timestamps } from '@/app/lib/entities';
import { eq, and } from 'drizzle-orm';

/**
 * POST /api/events/:id/join
 * Join an event with normal or contrarian mode
 */
export const POST = apiHandler(async (req: NextRequest, { params, session }) => {
  if (!params?.id) {
    throw apiError('Event ID is required');
  }
  const eventId = params.id;
  const body = await parseBodyWithSchema(req, joinEventSchema);

  // Check if event exists and is open
  const [event] = await db
    .select()
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);

  if (!event) {
    throw apiError('Event not found', 404);
  }

  if (event.status !== 'open') {
    throw apiError('Event is not open for joining', 400);
  }

  // Check if user already joined
  const [existingJoin] = await db
    .select()
    .from(userEventJoin)
    .where(
      and(
        eq(userEventJoin.userId, session.user.id),
        eq(userEventJoin.eventId, eventId)
      )
    )
    .limit(1);

  if (existingJoin) {
    throw apiError('You have already joined this event', 400);
  }

  // Create join record
  const id = generateId('usereventjoin');
  const [join] = await db.insert(userEventJoin).values({
    id,
    userId: session.user.id,
    eventId,
    mode: body.mode,
    ...timestamps(),
  }).returning();

  return apiSuccess(join, 201);
});

/**
 * GET /api/events/:id/join
 * Get user's join status for this event
 */
export const GET = apiHandler(async (req: NextRequest, { params, session }) => {
  if (!params?.id) {
    throw apiError('Event ID is required');
  }
  const eventId = params.id;

  const [join] = await db
    .select()
    .from(userEventJoin)
    .where(
      and(
        eq(userEventJoin.userId, session.user.id),
        eq(userEventJoin.eventId, eventId)
      )
    )
    .limit(1);

  if (!join) {
    throw apiError('Not joined to this event', 404);
  }

  return apiSuccess(join);
});
