import { NextRequest } from 'next/server';
import { apiHandler, apiSuccess, apiSuccessCached, apiError, parseBodyWithSchema } from '@/app/lib/api-helpers';
import { updateWrestlerSchema } from '@/app/lib/validation-schemas';
import { wrestlerService } from '@/app/lib/services/wrestler.service';

/**
 * GET /api/wrestlers/:id
 * Get a specific wrestler by ID
 * Query params:
 * - includeHistory: include name history (true/false)
 */
export const GET = apiHandler(async (req: NextRequest, { params }) => {
  if (!params?.id) {
    throw apiError('Wrestler ID is required');
  }

  const { searchParams } = new URL(req.url);
  const includeHistory = searchParams.get('includeHistory') === 'true';

  const wrestler = await wrestlerService.getById(params.id, { includeHistory });

  return apiSuccessCached(wrestler);
});

/**
 * PATCH /api/wrestlers/:id
 * Update a wrestler
 */
export const PATCH = apiHandler(async (req: NextRequest, { params }) => {
  if (!params?.id) {
    throw apiError('Wrestler ID is required');
  }

  const body = await parseBodyWithSchema(req, updateWrestlerSchema);

  if (!body.currentName && !body.brandId && body.isActive === undefined) {
    throw apiError('No fields to update');
  }

  const wrestler = await wrestlerService.update(params.id, body);

  return apiSuccess(wrestler);
}, { requireAdmin: true });

/**
 * DELETE /api/wrestlers/:id
 * Delete a wrestler (soft delete - sets isActive to false)
 */
export const DELETE = apiHandler(async (_req, { params }) => {
  if (!params?.id) {
    throw apiError('Wrestler ID is required');
  }

  await wrestlerService.delete(params.id);

  return apiSuccess({ message: 'Wrestler deactivated successfully', id: params.id });
}, { requireAdmin: true });
