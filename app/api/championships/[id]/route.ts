import { NextRequest } from 'next/server';
import { db } from '@/app/lib/db';
import { championships } from '@/app/lib/schema';
import { eq } from 'drizzle-orm';
import { apiHandler, apiSuccess, apiError, parseBodyWithSchema } from '@/app/lib/api-helpers';
import { updateChampionshipSchema } from '@/app/lib/validation-schemas';

/**
 * GET /api/championships/:id
 * Get a specific championship by ID
 */
export const GET = apiHandler(async (_req, { params }) => {
  if (!params?.id) {
    throw apiError('Championship ID is required');
  }

  const [championship] = await db.select().from(championships).where(eq(championships.id, params.id));

  if (!championship) {
    throw apiError('Championship not found', 404);
  }

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

  const updateData: Record<string, unknown> = { updatedAt: new Date() };

  if (body.name !== undefined) updateData.name = body.name;
  if (body.brandId !== undefined) updateData.brandId = body.brandId;
  if (body.isActive !== undefined) updateData.isActive = body.isActive;

  const [updatedChampionship] = await db
    .update(championships)
    .set(updateData)
    .where(eq(championships.id, params.id))
    .returning();

  if (!updatedChampionship) {
    throw apiError('Championship not found', 404);
  }

  return apiSuccess(updatedChampionship);
}, { requireAdmin: true });

/**
 * DELETE /api/championships/:id
 * Delete a championship (soft delete - sets isActive to false)
 */
export const DELETE = apiHandler(async (_req, { params }) => {
  if (!params?.id) {
    throw apiError('Championship ID is required');
  }

  const [updatedChampionship] = await db
    .update(championships)
    .set({
      isActive: false,
      updatedAt: new Date(),
    })
    .where(eq(championships.id, params.id))
    .returning();

  if (!updatedChampionship) {
    throw apiError('Championship not found', 404);
  }

  return apiSuccess({ message: 'Championship deactivated successfully', id: params.id });
}, { requireAdmin: true });
