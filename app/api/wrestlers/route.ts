import { NextRequest } from 'next/server';
import { db } from '@/app/lib/db';
import { wrestlers, wrestlerNames } from '@/app/lib/schema';
import { eq } from 'drizzle-orm';
import { apiHandler, apiSuccess, parseBody, validateRequired, generateId } from '@/app/lib/api-helpers';

/**
 * GET /api/wrestlers
 * List all wrestlers
 * Query params:
 * - brandId: filter by brand
 * - isActive: filter by active status (true/false)
 */
export const GET = apiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const brandId = searchParams.get('brandId');
  const isActive = searchParams.get('isActive');

  let query = db.select().from(wrestlers);

  if (brandId) {
    query = query.where(eq(wrestlers.brandId, brandId)) as typeof query;
  }

  if (isActive !== null) {
    const activeStatus = isActive === 'true';
    query = query.where(eq(wrestlers.isActive, activeStatus)) as typeof query;
  }

  const allWrestlers = await query;
  return apiSuccess(allWrestlers);
});

/**
 * POST /api/wrestlers
 * Create a new wrestler
 */
export const POST = apiHandler(async (req: NextRequest) => {
  const body = await parseBody<{
    currentName: string;
    brandId: string;
    isActive?: boolean;
  }>(req);

  validateRequired(body, ['currentName', 'brandId']);

  const id = generateId('wrestler');
  const now = new Date();

  // Create wrestler
  const [newWrestler] = await db
    .insert(wrestlers)
    .values({
      id,
      currentName: body.currentName,
      brandId: body.brandId,
      isActive: body.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  // Create initial name history entry
  await db.insert(wrestlerNames).values({
    id: generateId('wrestlername'),
    wrestlerId: id,
    name: body.currentName,
    validFrom: now,
    validTo: null, // Current name
    createdAt: now,
  });

  return apiSuccess(newWrestler, 201);
}, { requireAdmin: true });
