import { NextRequest } from 'next/server';
import { db } from '@/app/lib/db';
import { wrestlerNames } from '@/app/lib/schema';
import { eq } from 'drizzle-orm';
import { apiHandler, apiSuccess, apiError } from '@/app/lib/api-helpers';

/**
 * GET /api/wrestlers/:id/names
 * Get name history for a wrestler
 */
export const GET = apiHandler(async (_req, { params }) => {
  if (!params?.id) {
    throw apiError('Wrestler ID is required');
  }

  const nameHistory = await db
    .select()
    .from(wrestlerNames)
    .where(eq(wrestlerNames.wrestlerId, params.id))
    .orderBy(wrestlerNames.validFrom);

  return apiSuccess(nameHistory);
});
