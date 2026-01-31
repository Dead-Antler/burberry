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
import { eq, and, gte, lte, inArray, asc, desc, or, SQL } from 'drizzle-orm';
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
  active?: boolean;
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

// ============================================================================
// Scoring Helper Types
// ============================================================================

type MatchRecord = typeof matches.$inferSelect;
type MatchPredictionRecord = typeof matchPredictions.$inferSelect;
type EventCustomPredictionRecord = typeof eventCustomPredictions.$inferSelect;
type UserCustomPredictionRecord = typeof userCustomPredictions.$inferSelect;
type CustomPredictionTemplateRecord = typeof customPredictionTemplates.$inferSelect;
type ContrarianRecord = typeof userEventContrarian.$inferSelect;

// ============================================================================
// Scoring Helper Functions
// ============================================================================

/**
 * Evaluate if a custom prediction is correct based on type
 */
function evaluateCustomPrediction(
  predictionType: string,
  userPrediction: UserCustomPredictionRecord,
  answer: EventCustomPredictionRecord
): boolean {
  switch (predictionType) {
    case 'time':
      return userPrediction.predictionTime?.getTime() === answer.answerTime?.getTime();
    case 'count':
      return userPrediction.predictionCount === answer.answerCount;
    case 'wrestler':
      return userPrediction.predictionWrestlerId === answer.answerWrestlerId;
    case 'boolean':
      return userPrediction.predictionBoolean === answer.answerBoolean;
    case 'text':
      return userPrediction.predictionText?.toLowerCase() === answer.answerText?.toLowerCase();
    default:
      return false;
  }
}

/**
 * Score all match predictions for an event
 * Optimized: batch fetches all predictions in one query, updates in single transaction
 */
async function scoreMatchPredictions(
  eventMatches: MatchRecord[],
  matchIds: string[]
): Promise<number> {
  if (matchIds.length === 0) return 0;

  // Batch fetch ALL predictions for all matches in one query
  const allPredictions = await db
    .select()
    .from(matchPredictions)
    .where(inArray(matchPredictions.matchId, matchIds));

  if (allPredictions.length === 0) return 0;

  // Group predictions by matchId for efficient lookup
  const predictionsByMatch = new Map<string, MatchPredictionRecord[]>();
  for (const pred of allPredictions) {
    if (!predictionsByMatch.has(pred.matchId)) {
      predictionsByMatch.set(pred.matchId, []);
    }
    predictionsByMatch.get(pred.matchId)!.push(pred);
  }

  // Create lookup map for matches
  const matchMap = new Map(eventMatches.map((m) => [m.id, m]));

  // Calculate correctness for all predictions in memory
  const updates: { id: string; isCorrect: boolean }[] = [];

  for (const [matchId, predictions] of predictionsByMatch) {
    const match = matchMap.get(matchId);
    if (!match) continue;

    for (const prediction of predictions) {
      let isCorrect = false;

      if (match.outcome === 'winner') {
        if (match.winningSide !== null) {
          // Team-based match
          isCorrect = prediction.predictedSide === match.winningSide;
        } else if (match.winnerParticipantId !== null) {
          // Free-for-all match
          isCorrect = prediction.predictedParticipantId === match.winnerParticipantId;
        }
      }
      // Draw or no contest = incorrect

      updates.push({ id: prediction.id, isCorrect });
    }
  }

  // Batch update all predictions in a single transaction
  if (updates.length > 0) {
    await withTransaction(async (tx) => {
      for (const update of updates) {
        await tx
          .update(matchPredictions)
          .set({ isCorrect: update.isCorrect })
          .where(eq(matchPredictions.id, update.id));
      }
    });
  }

  return updates.length;
}

/**
 * Score all custom predictions for an event
 * Optimized: batch fetches and updates
 */
async function scoreCustomPredictions(eventId: string): Promise<number> {
  // Fetch event custom predictions with templates
  const customPreds = await db
    .select({
      eventCustomPrediction: eventCustomPredictions,
      template: customPredictionTemplates,
    })
    .from(eventCustomPredictions)
    .leftJoin(
      customPredictionTemplates,
      eq(eventCustomPredictions.templateId, customPredictionTemplates.id)
    )
    .where(eq(eventCustomPredictions.eventId, eventId));

  // Filter to only scored predictions with valid templates
  const scoredPredictions = customPreds.filter(
    ({ template, eventCustomPrediction }) => template && eventCustomPrediction.isScored
  );

  if (scoredPredictions.length === 0) return 0;

  const scoredPredictionIds = scoredPredictions.map(({ eventCustomPrediction }) => eventCustomPrediction.id);

  // Batch fetch all user predictions in one query
  const allUserPredictions = await db
    .select()
    .from(userCustomPredictions)
    .where(inArray(userCustomPredictions.eventCustomPredictionId, scoredPredictionIds));

  if (allUserPredictions.length === 0) return 0;

  // Group user predictions by eventCustomPredictionId
  const predictionsByEventPredId = new Map<string, UserCustomPredictionRecord[]>();
  for (const pred of allUserPredictions) {
    const key = pred.eventCustomPredictionId;
    if (!predictionsByEventPredId.has(key)) {
      predictionsByEventPredId.set(key, []);
    }
    predictionsByEventPredId.get(key)!.push(pred);
  }

  // Calculate correctness in memory
  const updates: { id: string; isCorrect: boolean }[] = [];

  for (const { eventCustomPrediction, template } of scoredPredictions) {
    const userPreds = predictionsByEventPredId.get(eventCustomPrediction.id) || [];

    for (const userPrediction of userPreds) {
      const isCorrect = evaluateCustomPrediction(
        template!.predictionType,
        userPrediction,
        eventCustomPrediction
      );
      updates.push({ id: userPrediction.id, isCorrect });
    }
  }

  // Batch update in single transaction
  if (updates.length > 0) {
    await withTransaction(async (tx) => {
      for (const update of updates) {
        await tx
          .update(userCustomPredictions)
          .set({ isCorrect: update.isCorrect })
          .where(eq(userCustomPredictions.id, update.id));
      }
    });
  }

  return updates.length;
}

/**
 * Score contrarian mode for all users in an event
 * Users win contrarian if ALL their predictions are incorrect
 */
async function scoreContrarian(eventId: string, matchIds: string[]): Promise<number> {
  // Get all contrarian users for this event
  const contrarianUsers = await db
    .select()
    .from(userEventContrarian)
    .where(and(eq(userEventContrarian.eventId, eventId), eq(userEventContrarian.isContrarian, true)));

  if (contrarianUsers.length === 0 || matchIds.length === 0) return 0;

  const userIds = contrarianUsers.map((u) => u.userId);

  // Batch fetch all predictions for contrarian users
  const allContrarianPredictions = await db
    .select()
    .from(matchPredictions)
    .where(and(inArray(matchPredictions.userId, userIds), inArray(matchPredictions.matchId, matchIds)));

  // Group by userId
  const predictionsByUser = new Map<string, MatchPredictionRecord[]>();
  for (const pred of allContrarianPredictions) {
    if (!predictionsByUser.has(pred.userId)) {
      predictionsByUser.set(pred.userId, []);
    }
    predictionsByUser.get(pred.userId)!.push(pred);
  }

  // Calculate contrarian wins and update in transaction
  await withTransaction(async (tx) => {
    for (const contrarian of contrarianUsers) {
      const userPredictions = predictionsByUser.get(contrarian.userId) || [];

      // Win contrarian if user made predictions AND all are incorrect
      const didWinContrarian =
        userPredictions.length > 0 && userPredictions.every((p) => p.isCorrect === false);

      await tx
        .update(userEventContrarian)
        .set({ didWinContrarian })
        .where(eq(userEventContrarian.id, contrarian.id));
    }
  });

  return contrarianUsers.length;
}

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
    } else if (params.active) {
      // Active events are those that are open or locked (not completed)
      conditions.push(or(eq(events.status, 'open'), eq(events.status, 'locked'))!);
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
   * Optimized to batch fetch and update predictions
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

    // Score using extracted helper functions
    const matchPredictionsScored = await scoreMatchPredictions(eventMatches, matchIds);
    const customPredictionsScored = await scoreCustomPredictions(eventId);
    const contrarianScored = await scoreContrarian(eventId, matchIds);

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
