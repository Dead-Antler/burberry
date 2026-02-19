import { NextRequest } from 'next/server';
import { apiHandler, apiSuccess, apiSuccessCached, apiError, parseBodyWithSchema } from '@/app/lib/api-helpers';
import { updateBrandSchema } from '@/app/lib/validation-schemas';
import { brandService } from '@/app/lib/services/brand.service';

/**
 * GET /api/brands/:id
 * Get a specific brand by ID
 */
export const GET = apiHandler(async (_req, { params }) => {
  if (!params?.id) {
    throw apiError('Brand ID is required');
  }

  const brand = await brandService.getById(params.id);

  return apiSuccessCached(brand);
});

/**
 * PATCH /api/brands/:id
 * Update a brand
 */
export const PATCH = apiHandler(async (req: NextRequest, { params }) => {
  if (!params?.id) {
    throw apiError('Brand ID is required');
  }

  const body = await parseBodyWithSchema(req, updateBrandSchema);

  if (!body.name) {
    throw apiError('No fields to update');
  }

  const brand = await brandService.update(params.id, body);

  return apiSuccess(brand);
}, { requireAdmin: true });

/**
 * DELETE /api/brands/:id
 * Delete a brand
 */
export const DELETE = apiHandler(async (_req, { params }) => {
  if (!params?.id) {
    throw apiError('Brand ID is required');
  }

  await brandService.delete(params.id);

  return apiSuccess({ message: 'Brand deleted successfully', id: params.id });
}, { requireAdmin: true });
