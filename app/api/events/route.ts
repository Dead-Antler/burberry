import { NextRequest } from 'next/server';
import { db } from '@/app/lib/db';
import { events, matches, matchParticipants, eventCustomPredictions } from '@/app/lib/schema';
import { eq, gte, lte, and, inArray } from 'drizzle-orm';
import { apiHandler, apiSuccess, parseBodyWithSchema, parseQueryWithSchema, generateId, apiError } from '@/app/lib/api-helpers';
import { createEventSchema, eventQuerySchema } from '@/app/lib/validation-schemas';

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
  const query = parseQueryWithSchema(searchParams, eventQuerySchema);

  const conditions = [];

  if (query.brandId) {
    conditions.push(eq(events.brandId, query.brandId));
  }

  if (query.status) {
    conditions.push(eq(events.status, query.status));
  }

  if (query.fromDate) {
    conditions.push(gte(events.eventDate, new Date(query.fromDate)));
  }

  if (query.toDate) {
    conditions.push(lte(events.eventDate, new Date(query.toDate)));
  }

  const includeMatches = query.includeMatches ?? false;

  const allEvents = conditions.length > 0
    ? await db.select().from(events).where(and(...conditions)).orderBy(events.eventDate)
    : await db.select().from(events).orderBy(events.eventDate);

  if (includeMatches) {
    const eventIds = allEvents.map((e) => e.id);
    const allMatches =
      eventIds.length > 0
        ? await db.select().from(matches).where(inArray(matches.eventId, eventIds)).orderBy(matches.matchOrder)
        : [];

    // Group matches by eventId
    const matchesByEvent = new Map<string, typeof allMatches>();
    for (const match of allMatches) {
      if (!matchesByEvent.has(match.eventId)) {
        matchesByEvent.set(match.eventId, []);
      }
      matchesByEvent.get(match.eventId)!.push(match);
    }

    // Build result
    const eventsWithMatches = allEvents.map((event) => ({
      ...event,
      matches: matchesByEvent.get(event.id) || [],
    }));

    return apiSuccess(eventsWithMatches);
  }

  return apiSuccess(allEvents);
});

/**
 * POST /api/events
 * Create a new event
 */
export const POST = apiHandler(async (req: NextRequest) => {
  const body = await parseBodyWithSchema(req, createEventSchema);

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
