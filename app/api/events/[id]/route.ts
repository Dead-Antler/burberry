import { NextRequest } from 'next/server';
import { apiHandler, apiSuccess, apiError, parseBodyWithSchema, parseQueryWithSchema } from '@/app/lib/api-helpers';
import { updateEventSchema, eventDetailQuerySchema } from '@/app/lib/validation-schemas';
import { eventService } from '@/app/lib/services/event.service';

/**
 * GET /api/events/:id
 * Get a specific event by ID
 * Query params:
 * - includeMatches: include full match data with participants (true/false)
 * - includeCustomPredictions: include custom predictions for event (true/false)
 */
export const GET = apiHandler(async (req: NextRequest, { params }) => {
  if (!params?.id) {
    throw apiError('Event ID is required');
  }

  const { searchParams } = new URL(req.url);
  const query = parseQueryWithSchema(searchParams, eventDetailQuerySchema);

  const event = await eventService.getById(params.id, {
    includeMatches: query.includeMatches,
    includeCustomPredictions: query.includeCustomPredictions,
  });

  return apiSuccess(event);
});

/**
 * PATCH /api/events/:id
 * Update an event
 */
export const PATCH = apiHandler(async (req: NextRequest, { params }) => {
  if (!params?.id) {
    throw apiError('Event ID is required');
  }

  const body = await parseBodyWithSchema(req, updateEventSchema);

  if (!body.name && !body.brandId && !body.eventDate && !body.status) {
    throw apiError('No fields to update');
  }

  const event = await eventService.update(params.id, body);

  return apiSuccess(event);
}, { requireAdmin: true });

/**
 * DELETE /api/events/:id
 * Delete an event (hard delete - cascades to matches and predictions)
 */
export const DELETE = apiHandler(async (_req, { params }) => {
  if (!params?.id) {
    throw apiError('Event ID is required');
  }

  await eventService.delete(params.id);

  return apiSuccess({ message: 'Event deleted successfully', id: params.id });
}, { requireAdmin: true });
