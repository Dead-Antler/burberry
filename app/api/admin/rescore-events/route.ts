import { apiHandler, apiSuccess, requireAdmin } from '@/app/lib/api-helpers';
import { db } from '@/app/lib/db';
import { events } from '@/app/lib/schema';
import { eq } from 'drizzle-orm';
import { eventService } from '@/app/lib/services/event.service';

/**
 * POST /api/admin/rescore-events
 * Rescore all completed events (recalculate leaderboards)
 */
export const POST = apiHandler(async (req) => {
  await requireAdmin(req);

  // Get all completed events
  const completedEvents = await db
    .select()
    .from(events)
    .where(eq(events.status, 'completed'));

  // Rescore each event
  const results = [];
  for (const event of completedEvents) {
    try {
      const leaderboard = await eventService.getScores(event.id);
      const count = leaderboard.length;
      results.push({
        eventId: event.id,
        eventName: event.name,
        success: true,
        participantCount: count,
      });
    } catch (error) {
      results.push({
        eventId: event.id,
        eventName: event.name,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  return apiSuccess({
    message: `Rescored ${successCount} events successfully${failCount > 0 ? `, ${failCount} failed` : ''}`,
    totalEvents: completedEvents.length,
    successCount,
    failCount,
    results,
  });
});
