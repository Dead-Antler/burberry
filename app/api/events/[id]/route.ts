import { NextRequest } from 'next/server';
import { db } from '@/app/lib/db';
import { events, matches, matchParticipants, wrestlers, tagTeams, eventCustomPredictions } from '@/app/lib/schema';
import { eq } from 'drizzle-orm';
import { apiHandler, apiSuccess, apiError, parseBody } from '@/app/lib/api-helpers';

/**
 * GET /api/events/:id
 * Get a specific event by ID
 * Query params:
 * - includeMatches: include full match data with participants (true/false)
 * - includeCustomPredictions: include custom predictions for event (true/false)
 */
export const GET = apiHandler(async (req: NextRequest, { params }) => {
  if (!params?.id) {
    throw apiError('Event ID is required');
  }

  const { searchParams } = new URL(req.url);
  const includeMatches = searchParams.get('includeMatches') === 'true';
  const includeCustomPredictions = searchParams.get('includeCustomPredictions') === 'true';

  const [event] = await db.select().from(events).where(eq(events.id, params.id));

  if (!event) {
    throw apiError('Event not found', 404);
  }

  const result: Record<string, unknown> = { ...event };

  if (includeMatches) {
    const eventMatches = await db
      .select()
      .from(matches)
      .where(eq(matches.eventId, params.id))
      .orderBy(matches.matchOrder);

    // Get participants for each match
    const matchesWithParticipants = await Promise.all(
      eventMatches.map(async (match) => {
        const participants = await db
          .select()
          .from(matchParticipants)
          .where(eq(matchParticipants.matchId, match.id));

        // Enrich participants with wrestler/tag team data
        const enrichedParticipants = await Promise.all(
          participants.map(async (participant) => {
            if (participant.participantType === 'wrestler') {
              const [wrestler] = await db
                .select()
                .from(wrestlers)
                .where(eq(wrestlers.id, participant.participantId));
              return { ...participant, participant: wrestler };
            } else {
              const [tagTeam] = await db.select().from(tagTeams).where(eq(tagTeams.id, participant.participantId));
              return { ...participant, participant: tagTeam };
            }
          })
        );

        return { ...match, participants: enrichedParticipants };
      })
    );

    result.matches = matchesWithParticipants;
  }

  if (includeCustomPredictions) {
    const customPredictions = await db
      .select()
      .from(eventCustomPredictions)
      .where(eq(eventCustomPredictions.eventId, params.id));

    result.customPredictions = customPredictions;
  }

  return apiSuccess(result);
});

/**
 * PATCH /api/events/:id
 * Update an event
 */
export const PATCH = apiHandler(async (req: NextRequest, { params }) => {
  if (!params?.id) {
    throw apiError('Event ID is required');
  }

  const body = await parseBody<{
    name?: string;
    brandId?: string;
    eventDate?: string | Date;
    status?: 'open' | 'locked' | 'completed';
  }>(req);

  if (!body.name && !body.brandId && !body.eventDate && !body.status) {
    throw apiError('No fields to update');
  }

  // Validate status transitions (open -> locked -> completed)
  if (body.status) {
    const [currentEvent] = await db.select().from(events).where(eq(events.id, params.id));

    if (!currentEvent) {
      throw apiError('Event not found', 404);
    }

    const validTransitions: Record<string, string[]> = {
      open: ['locked'],
      locked: ['completed'],
      completed: [],
    };

    if (!validTransitions[currentEvent.status].includes(body.status)) {
      throw apiError(`Cannot transition from ${currentEvent.status} to ${body.status}`);
    }
  }

  const updateData: Record<string, unknown> = { updatedAt: new Date() };

  if (body.name !== undefined) updateData.name = body.name;
  if (body.brandId !== undefined) updateData.brandId = body.brandId;
  if (body.eventDate !== undefined) updateData.eventDate = new Date(body.eventDate);
  if (body.status !== undefined) updateData.status = body.status;

  const [updatedEvent] = await db.update(events).set(updateData).where(eq(events.id, params.id)).returning();

  if (!updatedEvent) {
    throw apiError('Event not found', 404);
  }

  return apiSuccess(updatedEvent);
}, { requireAdmin: true });

/**
 * DELETE /api/events/:id
 * Delete an event (hard delete - cascades to matches and predictions)
 */
export const DELETE = apiHandler(async (_req, { params }) => {
  if (!params?.id) {
    throw apiError('Event ID is required');
  }

  const [deletedEvent] = await db.delete(events).where(eq(events.id, params.id)).returning();

  if (!deletedEvent) {
    throw apiError('Event not found', 404);
  }

  return apiSuccess({ message: 'Event deleted successfully', id: params.id });
}, { requireAdmin: true });
