/**
 * Match Service - Business logic for match operations
 * Includes participant enrichment with batch loading (fixes N+1)
 */

import { db } from '../db';
import {
  matches,
  matchParticipants,
  events,
  wrestlers,
  tagTeams,
} from '../schema';
import { eq, inArray } from 'drizzle-orm';
import { generateId, apiError } from '../api-helpers';
import {
  ensureExists,
  ensureForeignKey,
  withTransaction,
  timestamps,
  updatedTimestamp,
} from '../entities';

// Input types
export interface ParticipantInput {
  side?: number | null;
  participantType: 'wrestler' | 'tag_team';
  participantId: string;
  entryOrder?: number | null;
  isChampion?: boolean;
}

export interface CreateMatchInput {
  eventId: string;
  matchType: string;
  matchOrder: number;
  participants?: ParticipantInput[];
}

export interface UpdateMatchInput {
  matchType?: string;
  matchOrder?: number;
  outcome?: string | null;
  winningSide?: number | null;
  winnerParticipantId?: string | null;
}

/**
 * Validate a participant reference exists in the correct table
 */
async function validateParticipant(
  participantType: 'wrestler' | 'tag_team',
  participantId: string
): Promise<void> {
  if (participantType === 'wrestler') {
    await ensureForeignKey(wrestlers, participantId, 'Wrestler');
  } else {
    await ensureForeignKey(tagTeams, participantId, 'Tag team');
  }
}

/**
 * Batch load and enrich participants with wrestler/tag team data
 * This fixes the N+1 query problem by loading all data in 2 queries max
 */
async function enrichParticipants(
  participants: Array<{
    id: string;
    matchId: string;
    side: number | null;
    participantType: string;
    participantId: string;
    entryOrder: number | null;
    isChampion: boolean;
    createdAt: Date | null;
  }>
) {
  if (participants.length === 0) return [];

  // Collect unique IDs by type
  const wrestlerIds = new Set<string>();
  const tagTeamIds = new Set<string>();

  for (const p of participants) {
    if (p.participantType === 'wrestler') {
      wrestlerIds.add(p.participantId);
    } else {
      tagTeamIds.add(p.participantId);
    }
  }

  // Batch load in parallel (2 queries max)
  const [allWrestlers, allTagTeams] = await Promise.all([
    wrestlerIds.size > 0
      ? db.select().from(wrestlers).where(inArray(wrestlers.id, Array.from(wrestlerIds)))
      : Promise.resolve([]),
    tagTeamIds.size > 0
      ? db.select().from(tagTeams).where(inArray(tagTeams.id, Array.from(tagTeamIds)))
      : Promise.resolve([]),
  ]);

  // Create lookup maps
  const wrestlerMap = new Map(allWrestlers.map((w) => [w.id, w]));
  const tagTeamMap = new Map(allTagTeams.map((t) => [t.id, t]));

  // Enrich participants
  return participants.map((p) => ({
    ...p,
    participant:
      p.participantType === 'wrestler'
        ? wrestlerMap.get(p.participantId)
        : tagTeamMap.get(p.participantId),
  }));
}

/**
 * Match Service
 */
export const matchService = {
  /**
   * Get a single match by ID with optional related data
   * @throws 404 if not found
   */
  async getById(id: string, options?: { includeParticipants?: boolean }) {
    const match = await ensureExists(matches, id, 'Match');

    const result: Record<string, unknown> = { ...match };

    if (options?.includeParticipants) {
      const participants = await db
        .select()
        .from(matchParticipants)
        .where(eq(matchParticipants.matchId, id));

      // Batch enrich participants (fixes N+1)
      result.participants = await enrichParticipants(participants);
    }

    return result;
  },

  /**
   * Create a new match with participants
   * @throws 404 if event not found
   * @throws 400 if event is not open or participant references are invalid
   */
  async create(input: CreateMatchInput) {
    // Validate event exists and is open
    const event = await ensureExists(events, input.eventId, 'Event');

    if (event.status !== 'open') {
      throw apiError('Cannot add matches to a locked or completed event', 400);
    }

    // Validate all participant references
    if (input.participants && input.participants.length > 0) {
      for (const participant of input.participants) {
        await validateParticipant(participant.participantType, participant.participantId);
      }
    }

    const matchId = generateId('match');
    const { createdAt, updatedAt } = timestamps();

    // Create match with participants in a transaction
    return withTransaction(async (tx) => {
      // Create match
      const [match] = await tx
        .insert(matches)
        .values({
          id: matchId,
          eventId: input.eventId,
          matchType: input.matchType,
          matchOrder: input.matchOrder,
          outcome: null,
          winningSide: null,
          winnerParticipantId: null,
          createdAt,
          updatedAt,
        })
        .returning();

      // Add participants
      if (input.participants && input.participants.length > 0) {
        await tx.insert(matchParticipants).values(
          input.participants.map((participant) => ({
            id: generateId('participant'),
            matchId,
            side: participant.side ?? null,
            participantType: participant.participantType,
            participantId: participant.participantId,
            entryOrder: participant.entryOrder ?? null,
            isChampion: participant.isChampion ?? false,
            createdAt,
          }))
        );
      }

      return match;
    });
  },

  /**
   * Update a match (including setting results)
   * @throws 404 if not found
   * @throws 400 if trying to set results on an open event
   */
  async update(id: string, input: UpdateMatchInput) {
    // Ensure match exists
    const match = await ensureExists(matches, id, 'Match');

    // If setting results, verify event is locked or completed
    if (
      input.outcome !== undefined ||
      input.winningSide !== undefined ||
      input.winnerParticipantId !== undefined
    ) {
      const event = await ensureExists(events, match.eventId, 'Event');

      if (event.status === 'open') {
        throw apiError('Cannot set match results for an open event. Lock the event first.', 400);
      }
    }

    const [updated] = await db
      .update(matches)
      .set({
        ...(input.matchType !== undefined && { matchType: input.matchType }),
        ...(input.matchOrder !== undefined && { matchOrder: input.matchOrder }),
        ...(input.outcome !== undefined && { outcome: input.outcome }),
        ...(input.winningSide !== undefined && { winningSide: input.winningSide }),
        ...(input.winnerParticipantId !== undefined && {
          winnerParticipantId: input.winnerParticipantId,
        }),
        ...updatedTimestamp(),
      })
      .where(eq(matches.id, id))
      .returning();

    return updated;
  },

  /**
   * Delete a match (hard delete)
   * @throws 404 if not found
   * @throws 400 if event is not open
   */
  async delete(id: string) {
    // Ensure match exists
    const match = await ensureExists(matches, id, 'Match');

    // Verify event is open
    const event = await ensureExists(events, match.eventId, 'Event');

    if (event.status !== 'open') {
      throw apiError('Cannot delete matches from a locked or completed event', 400);
    }

    await db.delete(matches).where(eq(matches.id, id));
  },

  /**
   * Get participants for a match (batch enriched)
   */
  async getParticipants(matchId: string) {
    await ensureExists(matches, matchId, 'Match');

    const participants = await db
      .select()
      .from(matchParticipants)
      .where(eq(matchParticipants.matchId, matchId));

    return enrichParticipants(participants);
  },

  /**
   * Add a participant to a match
   */
  async addParticipant(matchId: string, input: ParticipantInput) {
    // Ensure match exists and event is open
    const match = await ensureExists(matches, matchId, 'Match');
    const event = await ensureExists(events, match.eventId, 'Event');

    if (event.status !== 'open') {
      throw apiError('Cannot modify participants for a locked or completed event', 400);
    }

    // Validate participant reference
    await validateParticipant(input.participantType, input.participantId);

    const [newParticipant] = await db
      .insert(matchParticipants)
      .values({
        id: generateId('participant'),
        matchId,
        side: input.side ?? null,
        participantType: input.participantType,
        participantId: input.participantId,
        entryOrder: input.entryOrder ?? null,
        isChampion: input.isChampion ?? false,
        createdAt: new Date(),
      })
      .returning();

    return newParticipant;
  },

  // Export the enrichParticipants function for use by other services
  enrichParticipants,
};
