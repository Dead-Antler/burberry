import { NextRequest } from 'next/server';
import { db } from '@/app/lib/db';
import { brands } from '@/app/lib/schema';
import { eq } from 'drizzle-orm';
import { apiHandler, apiSuccess, apiError, parseBody } from '@/app/lib/api-helpers';

/**
 * GET /api/brands/:id
 * Get a specific brand by ID
 */
export const GET = apiHandler(async (_req, { params }) => {
  if (!params?.id) {
    throw apiError('Brand ID is required');
  }

  const [brand] = await db.select().from(brands).where(eq(brands.id, params.id));

  if (!brand) {
    throw apiError('Brand not found', 404);
  }

  return apiSuccess(brand);
});

/**
 * PATCH /api/brands/:id
 * Update a brand
 */
export const PATCH = apiHandler(async (req: NextRequest, { params }) => {
  if (!params?.id) {
    throw apiError('Brand ID is required');
  }

  const body = await parseBody<{ name?: string }>(req);

  if (!body.name) {
    throw apiError('No fields to update');
  }

  const [updatedBrand] = await db
    .update(brands)
    .set({
      name: body.name,
      updatedAt: new Date(),
    })
    .where(eq(brands.id, params.id))
    .returning();

  if (!updatedBrand) {
    throw apiError('Brand not found', 404);
  }

  return apiSuccess(updatedBrand);
}, { requireAdmin: true });

/**
 * DELETE /api/brands/:id
 * Delete a brand
 */
export const DELETE = apiHandler(async (_req, { params }) => {
  if (!params?.id) {
    throw apiError('Brand ID is required');
  }

  const [deletedBrand] = await db.delete(brands).where(eq(brands.id, params.id)).returning();

  if (!deletedBrand) {
    throw apiError('Brand not found', 404);
  }

  return apiSuccess({ message: 'Brand deleted successfully', id: params.id });
}, { requireAdmin: true });
