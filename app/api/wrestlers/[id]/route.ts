import { NextRequest } from 'next/server';
import { db } from '@/app/lib/db';
import { wrestlers, wrestlerNames } from '@/app/lib/schema';
import { eq, isNull, and } from 'drizzle-orm';
import { apiHandler, apiSuccess, apiError, parseBody, generateId } from '@/app/lib/api-helpers';

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

  const [wrestler] = await db.select().from(wrestlers).where(eq(wrestlers.id, params.id));

  if (!wrestler) {
    throw apiError('Wrestler not found', 404);
  }

  if (includeHistory) {
    const nameHistory = await db
      .select()
      .from(wrestlerNames)
      .where(eq(wrestlerNames.wrestlerId, params.id))
      .orderBy(wrestlerNames.validFrom);

    return apiSuccess({ ...wrestler, nameHistory });
  }

  return apiSuccess(wrestler);
});

/**
 * PATCH /api/wrestlers/:id
 * Update a wrestler
 * Note: To update name, use the name history endpoint
 */
export const PATCH = apiHandler(async (req: NextRequest, { params }) => {
  if (!params?.id) {
    throw apiError('Wrestler ID is required');
  }

  const body = await parseBody<{
    currentName?: string;
    brandId?: string;
    isActive?: boolean;
  }>(req);

  if (!body.currentName && !body.brandId && body.isActive === undefined) {
    throw apiError('No fields to update');
  }

  const now = new Date();
  const updateData: Record<string, unknown> = { updatedAt: now };

  if (body.brandId !== undefined) updateData.brandId = body.brandId;
  if (body.isActive !== undefined) updateData.isActive = body.isActive;

  // If updating name, we need to update both the wrestler record and create a new name history entry
  if (body.currentName) {
    updateData.currentName = body.currentName;

    // Close out the current name
    await db
      .update(wrestlerNames)
      .set({ validTo: now })
      .where(and(eq(wrestlerNames.wrestlerId, params.id), isNull(wrestlerNames.validTo)));

    // Create new name history entry
    await db.insert(wrestlerNames).values({
      id: generateId('wrestlername'),
      wrestlerId: params.id,
      name: body.currentName,
      validFrom: now,
      validTo: null,
      createdAt: now,
    });
  }

  const [updatedWrestler] = await db
    .update(wrestlers)
    .set(updateData)
    .where(eq(wrestlers.id, params.id))
    .returning();

  if (!updatedWrestler) {
    throw apiError('Wrestler not found', 404);
  }

  return apiSuccess(updatedWrestler);
}, { requireAdmin: true });

/**
 * DELETE /api/wrestlers/:id
 * Delete a wrestler (soft delete - sets isActive to false)
 */
export const DELETE = apiHandler(async (_req, { params }) => {
  if (!params?.id) {
    throw apiError('Wrestler ID is required');
  }

  const [updatedWrestler] = await db
    .update(wrestlers)
    .set({
      isActive: false,
      updatedAt: new Date(),
    })
    .where(eq(wrestlers.id, params.id))
    .returning();

  if (!updatedWrestler) {
    throw apiError('Wrestler not found', 404);
  }

  return apiSuccess({ message: 'Wrestler deactivated successfully', id: params.id });
}, { requireAdmin: true });
