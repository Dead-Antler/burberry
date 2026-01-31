import { NextRequest } from 'next/server';
import { apiHandler, apiSuccess, apiError, parseBodyWithSchema } from '@/app/lib/api-helpers';
import { updateChampionshipSchema } from '@/app/lib/validation-schemas';
import { championshipService } from '@/app/lib/services/championship.service';

/**
 * GET /api/championships/:id
 * Get a specific championship by ID
 */
export const GET = apiHandler(async (_req, { params }) => {
  if (!params?.id) {
    throw apiError('Championship ID is required');
  }

  const championship = await championshipService.getById(params.id);

  return apiSuccess(championship);
});

/**
 * PATCH /api/championships/:id
 * Update a championship
 */
export const PATCH = apiHandler(async (req: NextRequest, { params }) => {
  if (!params?.id) {
    throw apiError('Championship ID is required');
  }

  const body = await parseBodyWithSchema(req, updateChampionshipSchema);

  if (!body.name && !body.brandId && body.isActive === undefined) {
    throw apiError('No fields to update');
  }

  const championship = await championshipService.update(params.id, body);

  return apiSuccess(championship);
}, { requireAdmin: true });

/**
 * DELETE /api/championships/:id
 * Delete a championship (soft delete - sets isActive to false)
 */
export const DELETE = apiHandler(async (_req, { params }) => {
  if (!params?.id) {
    throw apiError('Championship ID is required');
  }

  await championshipService.delete(params.id);

  return apiSuccess({ message: 'Championship deactivated successfully', id: params.id });
}, { requireAdmin: true });
