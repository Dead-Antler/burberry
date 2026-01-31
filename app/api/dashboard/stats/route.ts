import { apiHandler, apiSuccess, getUserId } from '@/app/lib/api-helpers'
import { db } from '@/app/lib/db'
import { events, matchPredictions, matches, users } from '@/app/lib/schema'
import { eq, and, sql, count, desc } from 'drizzle-orm'

export interface DashboardStats {
  openEvents: number
  userPredictions: number
  accuracy: number | null
  rank: number | null
  totalUsers: number
}

/**
 * GET /api/dashboard/stats
 * Get dashboard statistics for the current user
 */
export const GET = apiHandler(async (_req, { session }) => {
  const userId = getUserId(session)

  // Count open events
  const openEventsResult = await db
    .select({ count: count() })
    .from(events)
    .where(eq(events.status, 'open'))

  const openEvents = openEventsResult[0]?.count ?? 0

  // Count user's predictions
  const userPredictionsResult = await db
    .select({ count: count() })
    .from(matchPredictions)
    .where(eq(matchPredictions.userId, userId))

  const userPredictions = userPredictionsResult[0]?.count ?? 0

  // Calculate accuracy (correct predictions / total scored predictions)
  const accuracyResult = await db
    .select({
      total: count(),
      correct: sql<number>`sum(case when ${matchPredictions.isCorrect} = 1 then 1 else 0 end)`,
    })
    .from(matchPredictions)
    .where(
      and(
        eq(matchPredictions.userId, userId),
        sql`${matchPredictions.isCorrect} is not null`
      )
    )

  const totalScored = accuracyResult[0]?.total ?? 0
  const correctPredictions = accuracyResult[0]?.correct ?? 0
  const accuracy = totalScored > 0 ? Math.round((correctPredictions / totalScored) * 100) : null

  // Calculate rank based on total correct predictions
  const leaderboard = await db
    .select({
      odId: matchPredictions.userId,
      correct: sql<number>`sum(case when ${matchPredictions.isCorrect} = 1 then 1 else 0 end)`.as('correct'),
    })
    .from(matchPredictions)
    .where(sql`${matchPredictions.isCorrect} is not null`)
    .groupBy(matchPredictions.userId)
    .orderBy(desc(sql`correct`))

  let rank: number | null = null
  for (let i = 0; i < leaderboard.length; i++) {
    if (leaderboard[i].odId === userId) {
      rank = i + 1
      break
    }
  }

  // Total users for context
  const totalUsersResult = await db.select({ count: count() }).from(users)
  const totalUsers = totalUsersResult[0]?.count ?? 0

  const stats: DashboardStats = {
    openEvents,
    userPredictions,
    accuracy,
    rank,
    totalUsers,
  }

  return apiSuccess(stats)
})
