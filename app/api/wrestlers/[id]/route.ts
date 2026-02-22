import { NextRequest } from 'next/server';
import { apiHandler, apiSuccess, apiError, parseBodyWithSchema, parseQueryWithSchema } from '@/app/lib/api-helpers';
import { updateWrestlerSchema, deleteQuerySchema } from '@/app/lib/validation-schemas';
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

  return apiSuccess(wrestler);
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
 * Make inactive (default) or permanently delete (?force=true) a wrestler
 */
export const DELETE = apiHandler(async (req: NextRequest, { params }) => {
  if (!params?.id) {
    throw apiError('Wrestler ID is required');
  }

  const { searchParams } = new URL(req.url);
  const query = parseQueryWithSchema(searchParams, deleteQuerySchema);

  if (query.force) {
    await wrestlerService.forceDelete(params.id);
    return apiSuccess({ message: 'Wrestler permanently deleted', id: params.id });
  }

  await wrestlerService.delete(params.id);
  return apiSuccess({ message: 'Wrestler deactivated successfully', id: params.id });
}, { requireAdmin: true });
