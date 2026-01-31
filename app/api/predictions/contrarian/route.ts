import { NextRequest } from 'next/server';
import { db } from '@/app/lib/db';
import { userEventContrarian, events, matchPredictions, matches } from '@/app/lib/schema';
import { eq, and } from 'drizzle-orm';
import { apiHandler, apiSuccess, parseBody, validateRequired, generateId, apiError } from '@/app/lib/api-helpers';

/**
 * GET /api/predictions/contrarian
 * Get contrarian mode status for the current user
 * Query params:
 * - eventId: filter by event
 */
export const GET = apiHandler(async (req: NextRequest, { session }) => {
  const { searchParams } = new URL(req.url);
  const eventId = searchParams.get('eventId');

  let query = db.select().from(userEventContrarian).where(eq(userEventContrarian.userId, session!.user!.id!));

  if (eventId) {
    query = query.where(eq(userEventContrarian.eventId, eventId)) as typeof query;
  }

  const contrarianRecords = await query;
  return apiSuccess(contrarianRecords);
});

/**
 * POST /api/predictions/contrarian
 * Enable or update contrarian mode for an event
 */
export const POST = apiHandler(async (req: NextRequest, { session }) => {
  const body = await parseBody<{
    eventId: string;
    isContrarian: boolean;
  }>(req);

  validateRequired(body, ['eventId', 'isContrarian']);

  // Verify event exists and is open
  const [event] = await db.select().from(events).where(eq(events.id, body.eventId));

  if (!event) {
    throw apiError('Event not found', 404);
  }

  if (event.status !== 'open') {
    throw apiError('Cannot change contrarian mode for a locked or completed event');
  }

  const userId = session!.user!.id!;

  // If enabling contrarian mode, verify user hasn't made any predictions yet
  if (body.isContrarian) {
    // Check for match predictions
    const eventMatches = await db.select().from(matches).where(eq(matches.eventId, body.eventId));

    const matchIds = eventMatches.map((m) => m.id);

    if (matchIds.length > 0) {
      const existingPredictions = await db
        .select()
        .from(matchPredictions)
        .where(
          and(
            eq(matchPredictions.userId, userId),
            // Check if any match predictions exist for this event
            ...matchIds.map((id) => eq(matchPredictions.matchId, id))
          )
        );

      if (existingPredictions.length > 0) {
        throw apiError('Cannot enable contrarian mode after making predictions');
      }
    }
  }

  // Check if contrarian record already exists
  const [existingRecord] = await db
    .select()
    .from(userEventContrarian)
    .where(and(eq(userEventContrarian.userId, userId), eq(userEventContrarian.eventId, body.eventId)));

  const now = new Date();

  if (existingRecord) {
    // Update existing record
    const [updatedRecord] = await db
      .update(userEventContrarian)
      .set({
        isContrarian: body.isContrarian,
        updatedAt: now,
      })
      .where(eq(userEventContrarian.id, existingRecord.id))
      .returning();

    return apiSuccess(updatedRecord);
  } else {
    // Create new record
    const [newRecord] = await db
      .insert(userEventContrarian)
      .values({
        id: generateId('contrarian'),
        userId,
        eventId: body.eventId,
        isContrarian: body.isContrarian,
        didWinContrarian: null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return apiSuccess(newRecord, 201);
  }
});
