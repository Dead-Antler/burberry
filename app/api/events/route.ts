import { NextRequest } from 'next/server';
import {
  apiHandler,
  apiSuccess,
  parseBodyWithSchema,
  parseQueryWithSchema,
  createPaginatedResponse,
} from '@/app/lib/api-helpers';
import { createEventSchema, eventQuerySchema, paginationSchema } from '@/app/lib/validation-schemas';
import { eventService } from '@/app/lib/services/event.service';

/**
 * GET /api/events
 * List all events with pagination
 * Query params:
 * - brandId: filter by brand
 * - status: filter by status (open/locked/completed)
 * - fromDate: filter events from this date
 * - toDate: filter events to this date
 * - includeMatches: include match list (true/false)
 * - page, limit, sortBy, sortOrder: pagination
 */
export const GET = apiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const query = parseQueryWithSchema(searchParams, eventQuerySchema);
  const pagination = parseQueryWithSchema(searchParams, paginationSchema);

  const { data, total } = await eventService.list({
    ...pagination,
    brandId: query.brandId,
    status: query.status,
    fromDate: query.fromDate,
    toDate: query.toDate,
    includeMatches: query.includeMatches,
  });

  return apiSuccess(createPaginatedResponse(data, total, pagination));
});

/**
 * POST /api/events
 * Create a new event
 */
export const POST = apiHandler(async (req: NextRequest) => {
  const body = await parseBodyWithSchema(req, createEventSchema);

  const event = await eventService.create(body);

  return apiSuccess(event, 201);
}, { requireAdmin: true });
