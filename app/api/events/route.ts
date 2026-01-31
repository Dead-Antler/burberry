import { NextRequest } from 'next/server';
import { db } from '@/app/lib/db';
import { events, matches, matchParticipants, eventCustomPredictions } from '@/app/lib/schema';
import { eq, gte, lte, and } from 'drizzle-orm';
import { apiHandler, apiSuccess, parseBody, validateRequired, generateId, apiError } from '@/app/lib/api-helpers';

/**
 * GET /api/events
 * List all events
 * Query params:
 * - brandId: filter by brand
 * - status: filter by status (open/locked/completed)
 * - fromDate: filter events from this date
 * - toDate: filter events to this date
 * - includeMatches: include match list (true/false)
 */
export const GET = apiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const brandId = searchParams.get('brandId');
  const status = searchParams.get('status');
  const fromDate = searchParams.get('fromDate');
  const toDate = searchParams.get('toDate');
  const includeMatches = searchParams.get('includeMatches') === 'true';

  let query = db.select().from(events);
  const conditions = [];

  if (brandId) {
    conditions.push(eq(events.brandId, brandId));
  }

  if (status) {
    conditions.push(eq(events.status, status));
  }

  if (fromDate) {
    conditions.push(gte(events.eventDate, new Date(fromDate)));
  }

  if (toDate) {
    conditions.push(lte(events.eventDate, new Date(toDate)));
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }

  const allEvents = await query.orderBy(events.eventDate);

  if (includeMatches) {
    const eventsWithMatches = await Promise.all(
      allEvents.map(async (event) => {
        const eventMatches = await db
          .select()
          .from(matches)
          .where(eq(matches.eventId, event.id))
          .orderBy(matches.matchOrder);

        return { ...event, matches: eventMatches };
      })
    );

    return apiSuccess(eventsWithMatches);
  }

  return apiSuccess(allEvents);
});

/**
 * POST /api/events
 * Create a new event
 */
export const POST = apiHandler(async (req: NextRequest) => {
  const body = await parseBody<{
    name: string;
    brandId: string;
    eventDate: string | Date;
    status?: 'open' | 'locked' | 'completed';
  }>(req);

  validateRequired(body, ['name', 'brandId', 'eventDate']);

  const id = generateId('event');
  const now = new Date();

  const [newEvent] = await db
    .insert(events)
    .values({
      id,
      name: body.name,
      brandId: body.brandId,
      eventDate: new Date(body.eventDate),
      status: body.status ?? 'open',
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return apiSuccess(newEvent, 201);
}, { requireAdmin: true });
