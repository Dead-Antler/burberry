import { apiHandler, apiSuccess } from '@/app/lib/api-helpers';
import { db } from '@/app/lib/db';
import { events } from '@/app/lib/schema';
import { eq } from 'drizzle-orm';
import { eventService } from '@/app/lib/services/event.service';

/**
 * GET /api/leaderboard/overall
 * Get cumulative leaderboard across all completed events
 */
export const GET = apiHandler(async () => {
  // Fetch all completed events
  const completedEvents = await db
    .select()
    .from(events)
    .where(eq(events.status, 'completed'));

  if (completedEvents.length === 0) {
    return apiSuccess([]);
  }

  // Fetch leaderboard for each completed event
  const allLeaderboards = await Promise.all(
    completedEvents.map((event) => eventService.getScores(event.id))
  );

  // Aggregate scores by user
  const userScores: Record<
    string,
    {
      userId: string;
      user?: { name: string | null; email: string; image?: string | null };
      totalPoints: number;
      eventsParticipated: number;
      matchPredictions: { total: number; correct: number };
      customPredictions: { total: number; correct: number; points: number };
      contrarianWins: number;
      firstPlaceFinishes: number;
    }
  > = {};

  for (const leaderboard of allLeaderboards) {
    // Find the highest score in this event
    const scores = leaderboard;
    const maxScore = Math.max(...scores.map((s) => s.totalScore));

    for (const score of scores) {
      if (!userScores[score.userId]) {
        userScores[score.userId] = {
          userId: score.userId,
          user: score.user,
          totalPoints: 0,
          eventsParticipated: 0,
          matchPredictions: { total: 0, correct: 0 },
          customPredictions: { total: 0, correct: 0, points: 0 },
          contrarianWins: 0,
          firstPlaceFinishes: 0,
        };
      }

      const userScore = userScores[score.userId];
      userScore.totalPoints += score.totalScore;
      userScore.eventsParticipated += 1;
      userScore.matchPredictions.total += score.matchPredictions.total;
      userScore.matchPredictions.correct += score.matchPredictions.correct;
      userScore.customPredictions.total += score.customPredictions.total;
      userScore.customPredictions.correct += score.customPredictions.correct;
      userScore.customPredictions.points += score.customPredictions.points;

      if (score.didWinContrarian) {
        userScore.contrarianWins += 1;
      }

      // Count first place finishes (including ties)
      if (score.totalScore === maxScore) {
        userScore.firstPlaceFinishes += 1;
      }
    }
  }

  // Sort by total points (descending)
  const sortedLeaderboard = Object.values(userScores).sort(
    (a, b) => b.totalPoints - a.totalPoints
  );

  return apiSuccess(sortedLeaderboard);
});
