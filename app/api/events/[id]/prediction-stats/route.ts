import { NextRequest } from 'next/server';
import { db } from '@/app/lib/db';
import {
  events,
  matches,
  matchParticipants,
  matchPredictions,
  customPredictionTemplates,
  eventCustomPredictions,
  userCustomPredictions,
  users,
} from '@/app/lib/schema';
import { apiHandler, apiSuccess, apiError, sanitizeText } from '@/app/lib/api-helpers';
import { eq, inArray } from 'drizzle-orm';

/**
 * GET /api/events/:id/prediction-stats
 * Get aggregated prediction statistics for an event (for real-time display)
 */
export const GET = apiHandler(async (req: NextRequest, { params, session }) => {
  if (!params?.id) {
    throw apiError('Event ID is required');
  }
  const eventId = params.id;

  // Fetch event to check if it exists and get hidePredictors setting
  const [event] = await db
    .select()
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);

  if (!event) {
    throw apiError('Event not found', 404);
  }

  const hidePredictors = event.hidePredictors;

  // Fetch all matches for this event with participants
  const eventMatches = await db
    .select({
      match: matches,
      participant: matchParticipants,
    })
    .from(matches)
    .leftJoin(matchParticipants, eq(matches.id, matchParticipants.matchId))
    .where(eq(matches.eventId, eventId));

  // Group by match
  type MatchWithParticipants = {
    match: typeof matches.$inferSelect;
    participants: Array<typeof matchParticipants.$inferSelect>;
  };
  const matchMap = new Map<string, MatchWithParticipants>();
  for (const row of eventMatches) {
    if (!matchMap.has(row.match.id)) {
      matchMap.set(row.match.id, {
        match: row.match,
        participants: [],
      });
    }
    if (row.participant) {
      matchMap.get(row.match.id)!.participants.push(row.participant);
    }
  }

  // Batch fetch ALL match predictions in a single query
  const matchIds = Array.from(matchMap.keys());
  const allMatchPredictions = matchIds.length > 0
    ? await db
        .select({
          id: matchPredictions.id,
          userId: matchPredictions.userId,
          matchId: matchPredictions.matchId,
          predictedSide: matchPredictions.predictedSide,
          predictedParticipantId: matchPredictions.predictedParticipantId,
          userName: users.name,
        })
        .from(matchPredictions)
        .leftJoin(users, eq(matchPredictions.userId, users.id))
        .where(inArray(matchPredictions.matchId, matchIds))
    : [];

  // Group predictions by matchId
  const predictionsByMatch = new Map<string, typeof allMatchPredictions>();
  for (const p of allMatchPredictions) {
    if (!predictionsByMatch.has(p.matchId)) {
      predictionsByMatch.set(p.matchId, []);
    }
    predictionsByMatch.get(p.matchId)!.push(p);
  }

  // For each match, compute stats from the grouped data
  const matchStats = [];
  for (const { match, participants } of matchMap.values()) {
    const predictions = predictionsByMatch.get(match.id) || [];
    const totalPredictions = predictions.length;

    // Determine if team match or free-for-all
    const isTeamMatch = participants.some((p) => p.side !== null);

    let breakdown;
    if (isTeamMatch) {
      // Group by side
      const sideMap = new Map();
      for (const p of predictions) {
        const side = p.predictedSide;
        if (side !== null) {
          if (!sideMap.has(side)) {
            sideMap.set(side, { count: 0, predictors: [] });
          }
          sideMap.get(side).count++;
          if (!hidePredictors && p.userName) {
            sideMap.get(side).predictors.push(sanitizeText(p.userName, 100));
          }
        }
      }

      breakdown = Array.from(sideMap.entries()).map(([side, data]) => ({
        side,
        participantId: null,
        count: data.count,
        percentage: totalPredictions > 0 ? Math.round((data.count / totalPredictions) * 100) : 0,
        predictors: hidePredictors ? undefined : data.predictors,
      }));
    } else {
      // Group by participant
      const participantMap = new Map();
      for (const p of predictions) {
        const participantId = p.predictedParticipantId;
        if (participantId) {
          if (!participantMap.has(participantId)) {
            participantMap.set(participantId, { count: 0, predictors: [] });
          }
          participantMap.get(participantId).count++;
          if (!hidePredictors && p.userName) {
            participantMap.get(participantId).predictors.push(sanitizeText(p.userName, 100));
          }
        }
      }

      breakdown = Array.from(participantMap.entries()).map(([participantId, data]) => ({
        side: null,
        participantId,
        count: data.count,
        percentage: totalPredictions > 0 ? Math.round((data.count / totalPredictions) * 100) : 0,
        predictors: hidePredictors ? undefined : data.predictors,
      }));
    }

    matchStats.push({
      matchId: match.id,
      totalPredictions,
      distribution: breakdown,
    });
  }

  // Fetch custom predictions for this event
  const customTemplates = await db
    .select()
    .from(eventCustomPredictions)
    .innerJoin(
      customPredictionTemplates,
      eq(eventCustomPredictions.templateId, customPredictionTemplates.id)
    )
    .where(eq(eventCustomPredictions.eventId, eventId));

  // Batch fetch ALL user custom predictions in a single query
  const eventCustomPredIds = customTemplates.map(
    ({ eventCustomPredictions: ecp }) => ecp.id
  );
  const allUserCustomPredictions = eventCustomPredIds.length > 0
    ? await db
        .select({
          id: userCustomPredictions.id,
          userId: userCustomPredictions.userId,
          eventCustomPredictionId: userCustomPredictions.eventCustomPredictionId,
          predictionTime: userCustomPredictions.predictionTime,
          predictionCount: userCustomPredictions.predictionCount,
          predictionWrestlerId: userCustomPredictions.predictionWrestlerId,
          predictionBoolean: userCustomPredictions.predictionBoolean,
          predictionText: userCustomPredictions.predictionText,
          userName: users.name,
        })
        .from(userCustomPredictions)
        .leftJoin(users, eq(userCustomPredictions.userId, users.id))
        .where(inArray(userCustomPredictions.eventCustomPredictionId, eventCustomPredIds))
    : [];

  // Group by eventCustomPredictionId
  const customPredByTemplate = new Map<string, typeof allUserCustomPredictions>();
  for (const p of allUserCustomPredictions) {
    if (!customPredByTemplate.has(p.eventCustomPredictionId)) {
      customPredByTemplate.set(p.eventCustomPredictionId, []);
    }
    customPredByTemplate.get(p.eventCustomPredictionId)!.push(p);
  }

  const customStats = [];
  for (const { eventCustomPredictions: eventCustomPred } of customTemplates) {
    const predictions = customPredByTemplate.get(eventCustomPred.id) || [];
    const totalPredictions = predictions.length;

    // Group by value (extract the non-null prediction field)
    const valueMap = new Map();
    for (const p of predictions) {
      const value =
        p.predictionTime ??
        p.predictionCount ??
        p.predictionWrestlerId ??
        p.predictionBoolean ??
        p.predictionText;
      if (!valueMap.has(value)) {
        valueMap.set(value, { count: 0, predictors: [] });
      }
      valueMap.get(value).count++;
      if (!hidePredictors && p.userName) {
        valueMap.get(value).predictors.push(sanitizeText(p.userName, 100));
      }
    }

    const breakdown = Array.from(valueMap.entries()).map(([value, data]) => ({
      value,
      count: data.count,
      percentage: totalPredictions > 0 ? Math.round((data.count / totalPredictions) * 100) : 0,
      predictors: hidePredictors ? undefined : data.predictors,
    }));

    customStats.push({
      eventCustomPredictionId: eventCustomPred.id,
      totalPredictions,
      distribution: breakdown,
    });
  }

  const stats = {
    eventId,
    matches: matchStats,
    customPredictions: customStats,
  };

  return apiSuccess(stats);
});
