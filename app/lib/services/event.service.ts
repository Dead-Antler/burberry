/**
 * Event Service - Business logic for event operations including scoring
 */

import { db } from '../db';
import {
  events,
  matches,
  matchParticipants,
  matchPredictions,
  eventCustomPredictions,
  userCustomPredictions,
  customPredictionTemplates,
  userEventContrarian,
  wrestlers,
  tagTeams,
  brands,
} from '../schema';
import { eq, and, gte, lte, inArray, asc, desc, SQL } from 'drizzle-orm';
import { generateId, apiError } from '../api-helpers';
import type { PaginationParams } from '../api-helpers';
import {
  ensureExists,
  ensureForeignKey,
  buildPaginatedList,
  withTransaction,
  timestamps,
  updatedTimestamp,
} from '../entities';

// Input types
export interface CreateEventInput {
  name: string;
  brandId: string;
  eventDate: string | Date;
  status?: 'open' | 'locked' | 'completed';
}

export interface UpdateEventInput {
  name?: string;
  brandId?: string;
  eventDate?: string | Date;
  status?: 'open' | 'locked' | 'completed';
}

export interface ListEventsParams extends PaginationParams {
  brandId?: string;
  status?: string;
  fromDate?: string;
  toDate?: string;
  includeMatches?: boolean;
}

// Valid status transitions
const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  open: ['locked'],
  locked: ['completed'],
  completed: [],
};

/**
 * Event Service
 */
export const eventService = {
  /**
   * List all events with pagination and filters
   */
  async list(params: ListEventsParams) {
    // Build where conditions
    const conditions: SQL[] = [];

    if (params.brandId) {
      conditions.push(eq(events.brandId, params.brandId));
    }

    if (params.status) {
      conditions.push(eq(events.status, params.status));
    }

    if (params.fromDate) {
      conditions.push(gte(events.eventDate, new Date(params.fromDate)));
    }

    if (params.toDate) {
      conditions.push(lte(events.eventDate, new Date(params.toDate)));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    // Build order by clause
    const orderBy: SQL =
      params.sortBy === 'name'
        ? params.sortOrder === 'desc'
          ? desc(events.name)
          : asc(events.name)
        : params.sortBy === 'eventDate'
          ? params.sortOrder === 'desc'
            ? desc(events.eventDate)
            : asc(events.eventDate)
          : asc(events.eventDate); // Default: oldest first (chronological)

    const { data, total } = await buildPaginatedList(events, {
      where,
      orderBy,
      pagination: params,
    });

    // Optionally include matches (batch loaded to avoid N+1)
    if (params.includeMatches && data.length > 0) {
      const eventIds = data.map((e) => e.id);
      const allMatches = await db
        .select()
        .from(matches)
        .where(inArray(matches.eventId, eventIds))
        .orderBy(matches.matchOrder);

      // Group matches by eventId
      const matchesByEvent = new Map<string, typeof allMatches>();
      for (const match of allMatches) {
        if (!matchesByEvent.has(match.eventId)) {
          matchesByEvent.set(match.eventId, []);
        }
        matchesByEvent.get(match.eventId)!.push(match);
      }

      const eventsWithMatches = data.map((event) => ({
        ...event,
        matches: matchesByEvent.get(event.id) || [],
      }));

      return { data: eventsWithMatches, total };
    }

    return { data, total };
  },

  /**
   * Get a single event by ID with optional related data
   * @throws 404 if not found
   */
  async getById(
    id: string,
    options?: { includeMatches?: boolean; includeCustomPredictions?: boolean }
  ) {
    const event = await ensureExists(events, id, 'Event');

    const result: Record<string, unknown> = { ...event };

    if (options?.includeMatches) {
      const eventMatches = await db
        .select()
        .from(matches)
        .where(eq(matches.eventId, id))
        .orderBy(matches.matchOrder);

      // Batch load all participants
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

      // Create lookup maps
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

      // Build enriched matches
      const matchesWithParticipants = eventMatches.map((match) => {
        const participants = participantsByMatch.get(match.id) || [];
        const enrichedParticipants = participants.map((p) => ({
          ...p,
          participant:
            p.participantType === 'wrestler'
              ? wrestlerMap.get(p.participantId)
              : tagTeamMap.get(p.participantId),
        }));

        return { ...match, participants: enrichedParticipants };
      });

      result.matches = matchesWithParticipants;
    }

    if (options?.includeCustomPredictions) {
      const customPreds = await db
        .select()
        .from(eventCustomPredictions)
        .where(eq(eventCustomPredictions.eventId, id));

      result.customPredictions = customPreds;
    }

    return result;
  },

  /**
   * Create a new event
   * @throws 400 if brandId is invalid
   */
  async create(input: CreateEventInput) {
    // Validate foreign key
    await ensureForeignKey(brands, input.brandId, 'Brand');

    const id = generateId('event');

    const [newEvent] = await db
      .insert(events)
      .values({
        id,
        name: input.name,
        brandId: input.brandId,
        eventDate: new Date(input.eventDate),
        status: input.status ?? 'open',
        ...timestamps(),
      })
      .returning();

    return newEvent;
  },

  /**
   * Update an existing event
   * @throws 404 if not found
   * @throws 400 if brandId is invalid or status transition is invalid
   */
  async update(id: string, input: UpdateEventInput) {
    // Ensure event exists
    const currentEvent = await ensureExists(events, id, 'Event');

    // Validate brand FK if provided
    if (input.brandId) {
      await ensureForeignKey(brands, input.brandId, 'Brand');
    }

    // Validate status transition
    if (input.status && input.status !== currentEvent.status) {
      const validTransitions = VALID_STATUS_TRANSITIONS[currentEvent.status] || [];
      if (!validTransitions.includes(input.status)) {
        throw apiError(`Cannot transition from ${currentEvent.status} to ${input.status}`, 400);
      }
    }

    const [updated] = await db
      .update(events)
      .set({
        ...(input.name && { name: input.name }),
        ...(input.brandId && { brandId: input.brandId }),
        ...(input.eventDate && { eventDate: new Date(input.eventDate) }),
        ...(input.status && { status: input.status }),
        ...updatedTimestamp(),
      })
      .where(eq(events.id, id))
      .returning();

    return updated;
  },

  /**
   * Delete an event (hard delete)
   * @throws 404 if not found
   */
  async delete(id: string) {
    // Ensure event exists
    await ensureExists(events, id, 'Event');

    await db.delete(events).where(eq(events.id, id));
  },

  /**
   * Score all predictions for an event
   * @throws 404 if event not found
   * @throws 400 if event is not completed
   */
  async scoreEvent(eventId: string) {
    // Verify event is completed
    const event = await ensureExists(events, eventId, 'Event');

    if (event.status !== 'completed') {
      throw apiError('Can only score completed events', 400);
    }

    // Get all matches for the event
    const eventMatches = await db.select().from(matches).where(eq(matches.eventId, eventId));
    const matchIds = eventMatches.map((m) => m.id);

    let matchPredictionsScored = 0;

    // Score match predictions using batch updates within a transaction
    if (matchIds.length > 0) {
      await withTransaction(async (tx) => {
        for (const match of eventMatches) {
          if (match.outcome === 'winner') {
            // Fetch all predictions for this match
            const predictions = await tx
              .select()
              .from(matchPredictions)
              .where(eq(matchPredictions.matchId, match.id));

            // Score team-based matches
            if (match.winningSide !== null) {
              for (const prediction of predictions) {
                const isCorrect = prediction.predictedSide === match.winningSide;
                await tx
                  .update(matchPredictions)
                  .set({ isCorrect })
                  .where(eq(matchPredictions.id, prediction.id));
                matchPredictionsScored++;
              }
            }
            // Score free-for-all matches
            else if (match.winnerParticipantId !== null) {
              for (const prediction of predictions) {
                const isCorrect = prediction.predictedParticipantId === match.winnerParticipantId;
                await tx
                  .update(matchPredictions)
                  .set({ isCorrect })
                  .where(eq(matchPredictions.id, prediction.id));
                matchPredictionsScored++;
              }
            }
          } else {
            // Draw or no contest - all predictions are incorrect
            const result = await tx
              .update(matchPredictions)
              .set({ isCorrect: false })
              .where(eq(matchPredictions.matchId, match.id));
            // Count updated rows (approximation)
            matchPredictionsScored++;
          }
        }
      });
    }

    // Score custom predictions
    const customPreds = await db
      .select({
        eventCustomPrediction: eventCustomPredictions,
        template: customPredictionTemplates,
      })
      .from(eventCustomPredictions)
      .leftJoin(customPredictionTemplates, eq(eventCustomPredictions.templateId, customPredictionTemplates.id))
      .where(eq(eventCustomPredictions.eventId, eventId));

    let customPredictionsScored = 0;

    // Get IDs of scored custom predictions
    const scoredPredictionIds = customPreds
      .filter(({ template, eventCustomPrediction }) => template && eventCustomPrediction.isScored)
      .map(({ eventCustomPrediction }) => eventCustomPrediction.id);

    if (scoredPredictionIds.length > 0) {
      // Batch fetch all user predictions
      const allUserPredictions = await db
        .select()
        .from(userCustomPredictions)
        .where(inArray(userCustomPredictions.eventCustomPredictionId, scoredPredictionIds));

      // Group by eventCustomPredictionId
      const predictionsByEventId = new Map<string, typeof allUserPredictions>();
      for (const pred of allUserPredictions) {
        const key = pred.eventCustomPredictionId;
        if (!predictionsByEventId.has(key)) {
          predictionsByEventId.set(key, []);
        }
        predictionsByEventId.get(key)!.push(pred);
      }

      // Collect updates
      const updates: { id: string; isCorrect: boolean }[] = [];

      for (const { eventCustomPrediction, template } of customPreds) {
        if (!template || !eventCustomPrediction.isScored) continue;

        const userPreds = predictionsByEventId.get(eventCustomPrediction.id) || [];

        for (const userPrediction of userPreds) {
          let isCorrect = false;

          switch (template.predictionType) {
            case 'time':
              isCorrect =
                userPrediction.predictionTime?.getTime() === eventCustomPrediction.answerTime?.getTime();
              break;
            case 'count':
              isCorrect = userPrediction.predictionCount === eventCustomPrediction.answerCount;
              break;
            case 'wrestler':
              isCorrect = userPrediction.predictionWrestlerId === eventCustomPrediction.answerWrestlerId;
              break;
            case 'boolean':
              isCorrect = userPrediction.predictionBoolean === eventCustomPrediction.answerBoolean;
              break;
            case 'text':
              isCorrect =
                userPrediction.predictionText?.toLowerCase() ===
                eventCustomPrediction.answerText?.toLowerCase();
              break;
          }

          updates.push({ id: userPrediction.id, isCorrect });
        }
      }

      // Batch update within transaction
      if (updates.length > 0) {
        await withTransaction(async (tx) => {
          for (const update of updates) {
            await tx
              .update(userCustomPredictions)
              .set({ isCorrect: update.isCorrect })
              .where(eq(userCustomPredictions.id, update.id));
          }
        });
        customPredictionsScored = updates.length;
      }
    }

    // Score contrarian mode
    const contrarianUsers = await db
      .select()
      .from(userEventContrarian)
      .where(and(eq(userEventContrarian.eventId, eventId), eq(userEventContrarian.isContrarian, true)));

    let contrarianScored = 0;

    if (contrarianUsers.length > 0 && matchIds.length > 0) {
      const userIds = contrarianUsers.map((u) => u.userId);

      // Batch fetch all predictions for contrarian users
      const allContrarianPredictions = await db
        .select()
        .from(matchPredictions)
        .where(and(inArray(matchPredictions.userId, userIds), inArray(matchPredictions.matchId, matchIds)));

      // Group by userId
      const predictionsByUser = new Map<string, typeof allContrarianPredictions>();
      for (const pred of allContrarianPredictions) {
        if (!predictionsByUser.has(pred.userId)) {
          predictionsByUser.set(pred.userId, []);
        }
        predictionsByUser.get(pred.userId)!.push(pred);
      }

      // Update in transaction
      await withTransaction(async (tx) => {
        for (const contrarian of contrarianUsers) {
          const userPredictions = predictionsByUser.get(contrarian.userId) || [];

          // Check if all predictions are incorrect
          const allIncorrect =
            userPredictions.length > 0 && userPredictions.every((p) => p.isCorrect === false);

          await tx
            .update(userEventContrarian)
            .set({ didWinContrarian: allIncorrect })
            .where(eq(userEventContrarian.id, contrarian.id));

          contrarianScored++;
        }
      });
    }

    return {
      matchPredictionsScored,
      customPredictionsScored,
      contrarianScored,
    };
  },

  /**
   * Get leaderboard/scores for an event
   */
  async getScores(eventId: string, userId?: string) {
    // Ensure event exists
    await ensureExists(events, eventId, 'Event');

    // Get all matches for the event
    const eventMatches = await db.select().from(matches).where(eq(matches.eventId, eventId));
    const matchIds = eventMatches.map((m) => m.id);

    // Build query conditions
    const matchPredConditions: SQL[] = [];
    if (matchIds.length > 0) {
      matchPredConditions.push(inArray(matchPredictions.matchId, matchIds));
    }
    if (userId) {
      matchPredConditions.push(eq(matchPredictions.userId, userId));
    }

    // Fetch match predictions
    const matchPreds =
      matchPredConditions.length > 0
        ? await db.select().from(matchPredictions).where(and(...matchPredConditions))
        : [];

    // Get custom predictions for the event
    const customPreds = await db
      .select()
      .from(userCustomPredictions)
      .leftJoin(
        eventCustomPredictions,
        eq(userCustomPredictions.eventCustomPredictionId, eventCustomPredictions.id)
      )
      .where(eq(eventCustomPredictions.eventId, eventId));

    const userCustomPreds = userId
      ? customPreds.filter((p) => p.userCustomPredictions.userId === userId)
      : customPreds;

    // Get contrarian status
    const contrarianRecords = await db
      .select()
      .from(userEventContrarian)
      .where(eq(userEventContrarian.eventId, eventId));

    // Calculate scores by user
    const scoresByUser: Record<
      string,
      {
        userId: string;
        matchPredictions: { total: number; correct: number };
        customPredictions: { total: number; correct: number };
        totalScore: number;
        isContrarian: boolean;
        didWinContrarian: boolean | null;
      }
    > = {};

    // Process match predictions
    for (const pred of matchPreds) {
      if (!scoresByUser[pred.userId]) {
        scoresByUser[pred.userId] = {
          userId: pred.userId,
          matchPredictions: { total: 0, correct: 0 },
          customPredictions: { total: 0, correct: 0 },
          totalScore: 0,
          isContrarian: false,
          didWinContrarian: null,
        };
      }

      scoresByUser[pred.userId].matchPredictions.total++;
      if (pred.isCorrect) {
        scoresByUser[pred.userId].matchPredictions.correct++;
      }
    }

    // Process custom predictions
    for (const { userCustomPredictions: pred } of userCustomPreds) {
      if (!scoresByUser[pred.userId]) {
        scoresByUser[pred.userId] = {
          userId: pred.userId,
          matchPredictions: { total: 0, correct: 0 },
          customPredictions: { total: 0, correct: 0 },
          totalScore: 0,
          isContrarian: false,
          didWinContrarian: null,
        };
      }

      scoresByUser[pred.userId].customPredictions.total++;
      if (pred.isCorrect) {
        scoresByUser[pred.userId].customPredictions.correct++;
      }
    }

    // Add contrarian status
    for (const contrarian of contrarianRecords) {
      if (scoresByUser[contrarian.userId]) {
        scoresByUser[contrarian.userId].isContrarian = contrarian.isContrarian;
        scoresByUser[contrarian.userId].didWinContrarian = contrarian.didWinContrarian;
      }
    }

    // Calculate total scores
    for (const id in scoresByUser) {
      const user = scoresByUser[id];
      user.totalScore = user.matchPredictions.correct + user.customPredictions.correct;
    }

    // Sort by contrarian winners first, then by total score
    const sortedScores = Object.values(scoresByUser).sort((a, b) => {
      if (a.didWinContrarian && !b.didWinContrarian) return -1;
      if (!a.didWinContrarian && b.didWinContrarian) return 1;
      return b.totalScore - a.totalScore;
    });

    if (userId) {
      return sortedScores.find((s) => s.userId === userId) || null;
    }

    return sortedScores;
  },
};
