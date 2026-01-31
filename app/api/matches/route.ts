import { NextRequest } from 'next/server';
import { db } from '@/app/lib/db';
import { matches, matchParticipants, matchCombatantChampionships, events } from '@/app/lib/schema';
import { eq } from 'drizzle-orm';
import { apiHandler, apiSuccess, parseBodyWithSchema, generateId, apiError } from '@/app/lib/api-helpers';
import { createMatchSchema } from '@/app/lib/validation-schemas';

/**
 * POST /api/matches
 * Create a new match
 */
export const POST = apiHandler(async (req: NextRequest) => {
  const body = await parseBodyWithSchema(req, createMatchSchema);

  // Validate event exists and is in open status
  const [event] = await db.select().from(events).where(eq(events.id, body.eventId));

  if (!event) {
    throw apiError('Event not found', 404);
  }

  if (event.status !== 'open') {
    throw apiError('Cannot add matches to a locked or completed event');
  }

  const matchId = generateId('match');
  const now = new Date();

  // Create match
  const [newMatch] = await db
    .insert(matches)
    .values({
      id: matchId,
      eventId: body.eventId,
      matchType: body.matchType,
      matchOrder: body.matchOrder,
      outcome: null,
      winningSide: null,
      winnerParticipantId: null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  // Add participants
  if (body.participants && body.participants.length > 0) {
    await db.insert(matchParticipants).values(
      body.participants.map((participant) => ({
        id: generateId('participant'),
        matchId,
        side: participant.side,
        participantType: participant.participantType,
        participantId: participant.participantId,
        entryOrder: participant.entryOrder ?? null,
        createdAt: now,
      }))
    );
  }

  // Add championship information if provided
  if (body.championships && body.championships.length > 0) {
    await db.insert(matchCombatantChampionships).values(
      body.championships.map((championship) => ({
        id: generateId('matchchamp'),
        matchId,
        championshipId: championship.championshipId,
        participantType: championship.participantType,
        participantId: championship.participantId,
        createdAt: now,
      }))
    );
  }

  return apiSuccess(newMatch, 201);
}, { requireAdmin: true });
