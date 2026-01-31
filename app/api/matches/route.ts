import { NextRequest } from 'next/server';
import { apiHandler, apiSuccess, parseBodyWithSchema } from '@/app/lib/api-helpers';
import { createMatchSchema } from '@/app/lib/validation-schemas';
import { matchService } from '@/app/lib/services/match.service';

/**
 * POST /api/matches
 * Create a new match
 */
export const POST = apiHandler(async (req: NextRequest) => {
  const body = await parseBodyWithSchema(req, createMatchSchema);

  const match = await matchService.create(body);

  return apiSuccess(match, 201);
}, { requireAdmin: true });
