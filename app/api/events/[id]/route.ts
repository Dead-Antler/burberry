import { NextRequest } from 'next/server';
import { db } from '@/app/lib/db';
import { events, matches, matchParticipants, wrestlers, tagTeams, eventCustomPredictions } from '@/app/lib/schema';
import { eq, inArray } from 'drizzle-orm';
import { apiHandler, apiSuccess, apiError, parseBodyWithSchema, parseQueryWithSchema } from '@/app/lib/api-helpers';
import { updateEventSchema, eventDetailQuerySchema } from '@/app/lib/validation-schemas';

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
  const query = parseQueryWithSchema(searchParams, eventDetailQuerySchema);

  const [event] = await db.select().from(events).where(eq(events.id, params.id));

  if (!event) {
    throw apiError('Event not found', 404);
  }

  const result: Record<string, unknown> = { ...event };

  if (query.includeMatches) {
    const eventMatches = await db
      .select()
      .from(matches)
      .where(eq(matches.eventId, params.id))
      .orderBy(matches.matchOrder);

    // Fetch all participants for all matches in one query
    const matchIds = eventMatches.map((m) => m.id);
    const allParticipants =
      matchIds.length > 0
        ? await db.select().from(matchParticipants).where(inArray(matchParticipants.matchId, matchIds))
        : [];

    // Collect unique wrestler and tag team IDs
    const wrestlerIds = new Set<string>();
    const tagTeamIds = new Set<string>();

    for (const p of allParticipants) {
      if (p.participantType === 'wrestler') {
        wrestlerIds.add(p.participantId);
      } else {
        tagTeamIds.add(p.participantId);
      }
    }

    // Fetch all wrestlers and tag teams in 2 queries (parallel)
    const [allWrestlers, allTagTeams] = await Promise.all([
      wrestlerIds.size > 0
        ? db.select().from(wrestlers).where(inArray(wrestlers.id, Array.from(wrestlerIds)))
        : Promise.resolve([]),
      tagTeamIds.size > 0
        ? db.select().from(tagTeams).where(inArray(tagTeams.id, Array.from(tagTeamIds)))
        : Promise.resolve([]),
    ]);

    // Create lookup maps for O(1) access
    const wrestlerMap = new Map(allWrestlers.map((w) => [w.id, w]));
    const tagTeamMap = new Map(allTagTeams.map((t) => [t.id, t]));

    // Group participants by matchId
    const participantsByMatch = new Map<string, typeof allParticipants>();
    for (const p of allParticipants) {
      if (!participantsByMatch.has(p.matchId)) {
        participantsByMatch.set(p.matchId, []);
      }
      participantsByMatch.get(p.matchId)!.push(p);
    }

    // Build result in memory (no additional queries)
    const matchesWithParticipants = eventMatches.map((match) => {
      const participants = participantsByMatch.get(match.id) || [];
      const enrichedParticipants = participants.map((p) => ({
        ...p,
        participant: p.participantType === 'wrestler' ? wrestlerMap.get(p.participantId) : tagTeamMap.get(p.participantId),
      }));

      return { ...match, participants: enrichedParticipants };
    });

    result.matches = matchesWithParticipants;
  }

  if (query.includeCustomPredictions) {
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

  const body = await parseBodyWithSchema(req, updateEventSchema);

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
