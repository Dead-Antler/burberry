import { NextRequest } from 'next/server';
import { apiHandler, apiSuccess, parseBody, validateRequired } from '@/app/lib/api-helpers';
import { contrarianService } from '@/app/lib/services/prediction.service';

/**
 * GET /api/predictions/contrarian
 * Get contrarian mode status for the current user
 * Query params:
 * - eventId: filter by event
 */
export const GET = apiHandler(async (req: NextRequest, { session }) => {
  const { searchParams } = new URL(req.url);
  const eventId = searchParams.get('eventId') || undefined;

  const records = await contrarianService.list(session.user.id, eventId);

  return apiSuccess(records);
});

/**
 * POST /api/predictions/contrarian
 * Enable or update contrarian mode for an event
 */
export const POST = apiHandler(async (req: NextRequest, { session }) => {
  const body = await parseBody<{
    eventId: string;
    isContrarian: boolean;
  }>(req);

  validateRequired(body, ['eventId', 'isContrarian']);

  const { record, isNew } = await contrarianService.setStatus(session.user.id, body);

  return apiSuccess(record, isNew ? 201 : 200);
});
