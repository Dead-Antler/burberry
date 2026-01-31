import { NextRequest } from 'next/server';
import { db } from '@/app/lib/db';
import {
  matches,
  matchParticipants,
  matchCombatantChampionships,
  wrestlers,
  tagTeams,
  championships,
  events,
} from '@/app/lib/schema';
import { eq } from 'drizzle-orm';
import { apiHandler, apiSuccess, apiError, parseBody } from '@/app/lib/api-helpers';

/**
 * GET /api/matches/:id
 * Get a specific match by ID
 * Query params:
 * - includeParticipants: include participant data (true/false)
 * - includeChampionships: include championship data (true/false)
 */
export const GET = apiHandler(async (req: NextRequest, { params }) => {
  if (!params?.id) {
    throw apiError('Match ID is required');
  }

  const { searchParams } = new URL(req.url);
  const includeParticipants = searchParams.get('includeParticipants') === 'true';
  const includeChampionships = searchParams.get('includeChampionships') === 'true';

  const [match] = await db.select().from(matches).where(eq(matches.id, params.id));

  if (!match) {
    throw apiError('Match not found', 404);
  }

  const result: Record<string, unknown> = { ...match };

  if (includeParticipants) {
    const participants = await db
      .select()
      .from(matchParticipants)
      .where(eq(matchParticipants.matchId, params.id));

    // Enrich participants with wrestler/tag team data
    const enrichedParticipants = await Promise.all(
      participants.map(async (participant) => {
        if (participant.participantType === 'wrestler') {
          const [wrestler] = await db.select().from(wrestlers).where(eq(wrestlers.id, participant.participantId));
          return { ...participant, participant: wrestler };
        } else {
          const [tagTeam] = await db.select().from(tagTeams).where(eq(tagTeams.id, participant.participantId));
          return { ...participant, participant: tagTeam };
        }
      })
    );

    result.participants = enrichedParticipants;
  }

  if (includeChampionships) {
    const matchChampionships = await db
      .select({
        id: matchCombatantChampionships.id,
        matchId: matchCombatantChampionships.matchId,
        championshipId: matchCombatantChampionships.championshipId,
        participantType: matchCombatantChampionships.participantType,
        participantId: matchCombatantChampionships.participantId,
        championship: championships,
      })
      .from(matchCombatantChampionships)
      .leftJoin(championships, eq(matchCombatantChampionships.championshipId, championships.id))
      .where(eq(matchCombatantChampionships.matchId, params.id));

    result.championships = matchChampionships;
  }

  return apiSuccess(result);
});

/**
 * PATCH /api/matches/:id
 * Update a match (including setting results)
 */
export const PATCH = apiHandler(async (req: NextRequest, { params }) => {
  if (!params?.id) {
    throw apiError('Match ID is required');
  }

  const body = await parseBody<{
    matchType?: string;
    matchOrder?: number;
    outcome?: 'winner' | 'draw' | 'no_contest' | null;
    winningSide?: number | null;
    winnerParticipantId?: string | null;
  }>(req);

  if (
    !body.matchType &&
    body.matchOrder === undefined &&
    !body.outcome &&
    body.winningSide === undefined &&
    body.winnerParticipantId === undefined
  ) {
    throw apiError('No fields to update');
  }

  // If setting a winner, verify the match is part of a locked or completed event
  if (body.outcome || body.winningSide !== undefined || body.winnerParticipantId !== undefined) {
    const [match] = await db.select().from(matches).where(eq(matches.id, params.id));

    if (!match) {
      throw apiError('Match not found', 404);
    }

    const [event] = await db.select().from(events).where(eq(events.id, match.eventId));

    if (event && event.status === 'open') {
      throw apiError('Cannot set match results for an open event. Lock the event first.');
    }
  }

  const updateData: Record<string, unknown> = { updatedAt: new Date() };

  if (body.matchType !== undefined) updateData.matchType = body.matchType;
  if (body.matchOrder !== undefined) updateData.matchOrder = body.matchOrder;
  if (body.outcome !== undefined) updateData.outcome = body.outcome;
  if (body.winningSide !== undefined) updateData.winningSide = body.winningSide;
  if (body.winnerParticipantId !== undefined) updateData.winnerParticipantId = body.winnerParticipantId;

  const [updatedMatch] = await db.update(matches).set(updateData).where(eq(matches.id, params.id)).returning();

  if (!updatedMatch) {
    throw apiError('Match not found', 404);
  }

  return apiSuccess(updatedMatch);
}, { requireAdmin: true });

/**
 * DELETE /api/matches/:id
 * Delete a match (hard delete - cascades to participants and predictions)
 */
export const DELETE = apiHandler(async (_req, { params }) => {
  if (!params?.id) {
    throw apiError('Match ID is required');
  }

  // Verify match is part of an open event
  const [match] = await db.select().from(matches).where(eq(matches.id, params.id));

  if (!match) {
    throw apiError('Match not found', 404);
  }

  const [event] = await db.select().from(events).where(eq(events.id, match.eventId));

  if (event && event.status !== 'open') {
    throw apiError('Cannot delete matches from a locked or completed event');
  }

  const [deletedMatch] = await db.delete(matches).where(eq(matches.id, params.id)).returning();

  return apiSuccess({ message: 'Match deleted successfully', id: params.id });
}, { requireAdmin: true });
