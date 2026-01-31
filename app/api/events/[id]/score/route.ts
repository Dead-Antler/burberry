import { NextRequest } from 'next/server';
import { db } from '@/app/lib/db';
import {
  events,
  matches,
  matchPredictions,
  eventCustomPredictions,
  userCustomPredictions,
  customPredictionTemplates,
  userEventContrarian,
} from '@/app/lib/schema';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { apiHandler, apiSuccess, apiError } from '@/app/lib/api-helpers';

/**
 * POST /api/events/:id/score
 * Calculate scores for all predictions for an event
 * This should be called after event is completed
 */
export const POST = apiHandler(async (_req, { params }) => {
  if (!params?.id) {
    throw apiError('Event ID is required');
  }

  // Verify event is completed
  const [event] = await db.select().from(events).where(eq(events.id, params.id));

  if (!event) {
    throw apiError('Event not found', 404);
  }

  if (event.status !== 'completed') {
    throw apiError('Can only score completed events');
  }

  // Score match predictions
  const eventMatches = await db.select().from(matches).where(eq(matches.eventId, params.id));

  let matchPredictionsScored = 0;

  for (const match of eventMatches) {
    if (match.outcome === 'winner') {
      // Score team-based matches
      if (match.winningSide !== null) {
        await db
          .update(matchPredictions)
          .set({
            isCorrect: sql`CASE WHEN ${matchPredictions.predictedSide} = ${match.winningSide} THEN 1 ELSE 0 END`,
          })
          .where(eq(matchPredictions.matchId, match.id));
      }
      // Score free-for-all matches
      else if (match.winnerParticipantId !== null) {
        await db
          .update(matchPredictions)
          .set({
            isCorrect: sql`CASE WHEN ${matchPredictions.predictedParticipantId} = ${match.winnerParticipantId} THEN 1 ELSE 0 END`,
          })
          .where(eq(matchPredictions.matchId, match.id));
      }
    } else {
      // Draw or no contest - all predictions are incorrect
      await db
        .update(matchPredictions)
        .set({ isCorrect: false })
        .where(eq(matchPredictions.matchId, match.id));
    }

    matchPredictionsScored++;
  }

  // Score custom predictions
  const customPredictions = await db
    .select({
      eventCustomPrediction: eventCustomPredictions,
      template: customPredictionTemplates,
    })
    .from(eventCustomPredictions)
    .leftJoin(customPredictionTemplates, eq(eventCustomPredictions.templateId, customPredictionTemplates.id))
    .where(eq(eventCustomPredictions.eventId, params.id));

  let customPredictionsScored = 0;

  // Collect all eventCustomPredictionIds that need scoring
  const predictionIds = customPredictions
    .filter(({ template, eventCustomPrediction }) => template && eventCustomPrediction.isScored)
    .map(({ eventCustomPrediction }) => eventCustomPrediction.id);

  if (predictionIds.length > 0) {
    // Fetch all user predictions in one query
    const allUserPredictions = await db
      .select()
      .from(userCustomPredictions)
      .where(inArray(userCustomPredictions.eventCustomPredictionId, predictionIds));

    // Group user predictions by eventCustomPredictionId for efficient processing
    const predictionsByEventId = new Map<string, typeof allUserPredictions>();
    for (const pred of allUserPredictions) {
      const key = pred.eventCustomPredictionId;
      if (!predictionsByEventId.has(key)) {
        predictionsByEventId.set(key, []);
      }
      predictionsByEventId.get(key)!.push(pred);
    }

    // Collect all updates to be performed
    const updates: { id: string; isCorrect: boolean }[] = [];

    // Process each custom prediction type
    for (const { eventCustomPrediction, template } of customPredictions) {
      if (!template || !eventCustomPrediction.isScored) continue;

      const userPreds = predictionsByEventId.get(eventCustomPrediction.id) || [];
      const predictionType = template.predictionType;

      for (const userPrediction of userPreds) {
        let isCorrect = false;

        switch (predictionType) {
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
            // Case-insensitive text comparison
            isCorrect =
              userPrediction.predictionText?.toLowerCase() === eventCustomPrediction.answerText?.toLowerCase();
            break;
        }

        updates.push({ id: userPrediction.id, isCorrect });
      }
    }

    // Perform batch update using SQL CASE statement
    if (updates.length > 0) {
      const updateIds = updates.map((u) => u.id);
      const caseStatements = updates.map((u) =>
        sql`WHEN ${userCustomPredictions.id} = ${u.id} THEN ${u.isCorrect ? 1 : 0}`
      );

      await db
        .update(userCustomPredictions)
        .set({
          isCorrect: sql`CASE ${sql.join(caseStatements, sql` `)} END`,
        })
        .where(inArray(userCustomPredictions.id, updateIds));

      customPredictionsScored = updates.length;
    }
  }

  // Score contrarian mode
  // A contrarian wins if ALL their match predictions are incorrect
  const contrarianUsers = await db
    .select()
    .from(userEventContrarian)
    .where(and(eq(userEventContrarian.eventId, params.id), eq(userEventContrarian.isContrarian, true)));

  let contrarianScored = 0;

  for (const contrarian of contrarianUsers) {
    // Get all match predictions for this user for this event
    const matchIds = eventMatches.map((m) => m.id);

    if (matchIds.length === 0) {
      continue;
    }

    // Fetch predictions with database-level filtering (no in-memory filter)
    const eventMatchPredictions = await db
      .select()
      .from(matchPredictions)
      .where(
        and(
          eq(matchPredictions.userId, contrarian.userId),
          inArray(matchPredictions.matchId, matchIds)
        )
      );

    // Check if all predictions are incorrect (isCorrect === false)
    const allIncorrect =
      eventMatchPredictions.length > 0 && eventMatchPredictions.every((p) => p.isCorrect === false);

    await db
      .update(userEventContrarian)
      .set({ didWinContrarian: allIncorrect })
      .where(eq(userEventContrarian.id, contrarian.id));

    contrarianScored++;
  }

  return apiSuccess({
    message: 'Event scored successfully',
    matchPredictionsScored,
    customPredictionsScored,
    contrarianScored,
  });
}, { requireAdmin: true });

/**
 * GET /api/events/:id/score
 * Get scores/leaderboard for an event
 * Query params:
 * - userId: get score for specific user (optional)
 */
export const GET = apiHandler(async (req: NextRequest, { params }) => {
  if (!params?.id) {
    throw apiError('Event ID is required');
  }

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');

  // Get all match predictions for the event
  const eventMatches = await db.select().from(matches).where(eq(matches.eventId, params.id));

  const matchIds = eventMatches.map((m) => m.id);

  // Build query conditions for match predictions
  const conditions = [];

  if (matchIds.length > 0) {
    conditions.push(inArray(matchPredictions.matchId, matchIds));
  }

  if (userId) {
    conditions.push(eq(matchPredictions.userId, userId));
  }

  // Fetch predictions with database-level filtering (no in-memory filter)
  const matchPreds = conditions.length > 0
    ? await db.select().from(matchPredictions).where(and(...conditions))
    : [];

  // Get all custom predictions for the event
  const customPreds = await db
    .select()
    .from(userCustomPredictions)
    .leftJoin(eventCustomPredictions, eq(userCustomPredictions.eventCustomPredictionId, eventCustomPredictions.id))
    .where(eq(eventCustomPredictions.eventId, params.id));

  const userCustomPreds = userId
    ? customPreds.filter((p) => p.userCustomPredictions.userId === userId)
    : customPreds;

  // Get contrarian status
  const contrarianRecords = await db
    .select()
    .from(userEventContrarian)
    .where(eq(userEventContrarian.eventId, params.id));

  const userContrarian = userId
    ? contrarianRecords.find((c) => c.userId === userId)
    : null;

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
  for (const userId in scoresByUser) {
    const user = scoresByUser[userId];
    user.totalScore = user.matchPredictions.correct + user.customPredictions.correct;
  }

  // Sort by contrarian winners first, then by total score
  const sortedScores = Object.values(scoresByUser).sort((a, b) => {
    if (a.didWinContrarian && !b.didWinContrarian) return -1;
    if (!a.didWinContrarian && b.didWinContrarian) return 1;
    return b.totalScore - a.totalScore;
  });

  if (userId) {
    const userScore = sortedScores.find((s) => s.userId === userId);
    return apiSuccess(userScore || null);
  }

  return apiSuccess(sortedScores);
});
