/**
 * Match Service - Business logic for match operations
 * Includes participant enrichment with batch loading (fixes N+1)
 */

import { db } from '../db';
import {
  matches,
  matchParticipants,
  matchPredictions,
  events,
  wrestlers,
  groups,
  groupMembers,
} from '../schema';
import { eq, inArray, and, isNull } from 'drizzle-orm';
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
  participantType: 'wrestler' | 'group';
  participantId: string;
  entryOrder?: number | null;
  isChampion?: boolean;
}

export interface CreateMatchInput {
  eventId: string;
  matchType: string;
  matchOrder: number;
  unknownParticipants?: boolean;
  participants?: ParticipantInput[];
}

export interface UpdateMatchInput {
  matchType?: string;
  matchOrder?: number;
  unknownParticipants?: boolean;
  outcome?: string | null;
  winningSide?: number | null;
  winnerParticipantId?: string | null;
}

/**
 * Validate a participant reference exists in the correct table
 */
async function validateParticipant(
  participantType: 'wrestler' | 'group',
  participantId: string
): Promise<void> {
  if (participantType === 'wrestler') {
    await ensureForeignKey(wrestlers, participantId, 'Wrestler');
  } else {
    await ensureForeignKey(groups, participantId, 'Group');
  }
}

/**
 * Batch load and enrich participants with wrestler/group data
 * This fixes the N+1 query problem by loading all data in a few queries
 * Also includes group memberships for wrestler participants
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
  const groupIds = new Set<string>();

  for (const p of participants) {
    if (p.participantType === 'wrestler') {
      wrestlerIds.add(p.participantId);
    } else {
      groupIds.add(p.participantId);
    }
  }

  // Batch load wrestlers and groups in parallel
  const [allWrestlers, allGroups] = await Promise.all([
    wrestlerIds.size > 0
      ? db.select().from(wrestlers).where(inArray(wrestlers.id, Array.from(wrestlerIds)))
      : Promise.resolve([]),
    groupIds.size > 0
      ? db.select().from(groups).where(inArray(groups.id, Array.from(groupIds)))
      : Promise.resolve([]),
  ]);

  // Batch load current group memberships for wrestlers
  let wrestlerGroupsMap = new Map<string, Array<{ id: string; name: string }>>();
  if (wrestlerIds.size > 0) {
    const memberships = await db
      .select({
        wrestlerId: groupMembers.wrestlerId,
        groupId: groups.id,
        groupName: groups.name,
      })
      .from(groupMembers)
      .innerJoin(groups, eq(groupMembers.groupId, groups.id))
      .where(
        and(inArray(groupMembers.wrestlerId, Array.from(wrestlerIds)), isNull(groupMembers.leftAt))
      );

    // Map memberships to wrestlers
    for (const m of memberships) {
      if (!wrestlerGroupsMap.has(m.wrestlerId)) {
        wrestlerGroupsMap.set(m.wrestlerId, []);
      }
      wrestlerGroupsMap.get(m.wrestlerId)!.push({
        id: m.groupId,
        name: m.groupName,
      });
    }
  }

  // Create lookup maps
  const wrestlerMap = new Map(allWrestlers.map((w) => [w.id, w]));
  const groupMap = new Map(allGroups.map((g) => [g.id, g]));

  // Enrich participants with wrestler/group data and group memberships
  return participants.map((p) => ({
    ...p,
    participant:
      p.participantType === 'wrestler'
        ? wrestlerMap.get(p.participantId)
        : groupMap.get(p.participantId),
    // Include groups array for wrestler participants
    groups:
      p.participantType === 'wrestler'
        ? wrestlerGroupsMap.get(p.participantId) || []
        : undefined,
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
    // Validate event exists and is editable (upcoming or open)
    const event = await ensureExists(events, input.eventId, 'Event');

    if (event.status !== 'upcoming' && event.status !== 'open') {
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
          unknownParticipants: input.unknownParticipants ?? false,
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
        ...(input.unknownParticipants !== undefined && { unknownParticipants: input.unknownParticipants }),
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
   * Delete a match (hard delete - cascades to participants and predictions)
   * @throws 404 if not found
   * @throws 400 if event is not open
   */
  async delete(id: string) {
    // Ensure match exists
    const match = await ensureExists(matches, id, 'Match');

    // Verify event is editable (upcoming or open)
    const event = await ensureExists(events, match.eventId, 'Event');

    if (event.status !== 'upcoming' && event.status !== 'open') {
      throw apiError('Cannot delete matches from a locked or completed event', 400);
    }

    // Delete in transaction: predictions -> participants -> match
    await withTransaction(async (tx) => {
      await tx.delete(matchPredictions).where(eq(matchPredictions.matchId, id));
      await tx.delete(matchParticipants).where(eq(matchParticipants.matchId, id));
      await tx.delete(matches).where(eq(matches.id, id));
    });
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
    // Ensure match exists and event is editable
    const match = await ensureExists(matches, matchId, 'Match');
    const event = await ensureExists(events, match.eventId, 'Event');

    if (event.status !== 'upcoming' && event.status !== 'open') {
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

  /**
   * Reorder matches for an event
   * Updates matchOrder based on the order of match IDs provided
   * @throws 400 if event is not editable
   */
  async reorder(eventId: string, matchIds: string[]) {
    // Get the event to verify it's editable
    const event = await ensureExists(events, eventId, 'Event');

    if (event.status !== 'upcoming' && event.status !== 'open') {
      throw apiError('Cannot reorder matches for a locked or completed event', 400);
    }

    // Verify all matches belong to this event
    const eventMatches = await db
      .select({ id: matches.id })
      .from(matches)
      .where(eq(matches.eventId, eventId));

    const eventMatchIds = new Set(eventMatches.map((m) => m.id));
    for (const matchId of matchIds) {
      if (!eventMatchIds.has(matchId)) {
        throw apiError(`Match ${matchId} does not belong to this event`, 400);
      }
    }

    // Update all match orders in a transaction
    await withTransaction(async (tx) => {
      for (let i = 0; i < matchIds.length; i++) {
        await tx
          .update(matches)
          .set({
            matchOrder: i + 1,
            ...updatedTimestamp(),
          })
          .where(eq(matches.id, matchIds[i]));
      }
    });

    return { success: true };
  },

  // Export the enrichParticipants function for use by other services
  enrichParticipants,
};
