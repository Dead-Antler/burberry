import { NextRequest } from 'next/server';
import { db } from '@/app/lib/db';
import { championships } from '@/app/lib/schema';
import { eq } from 'drizzle-orm';
import { apiHandler, apiSuccess, parseBody, validateRequired, generateId } from '@/app/lib/api-helpers';

/**
 * GET /api/championships
 * List all championships
 * Query params:
 * - brandId: filter by brand
 * - isActive: filter by active status (true/false)
 */
export const GET = apiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const brandId = searchParams.get('brandId');
  const isActive = searchParams.get('isActive');

  let query = db.select().from(championships);

  if (brandId) {
    query = query.where(eq(championships.brandId, brandId)) as typeof query;
  }

  if (isActive !== null) {
    const activeStatus = isActive === 'true';
    query = query.where(eq(championships.isActive, activeStatus)) as typeof query;
  }

  const allChampionships = await query;
  return apiSuccess(allChampionships);
});

/**
 * POST /api/championships
 * Create a new championship
 */
export const POST = apiHandler(async (req: NextRequest) => {
  const body = await parseBody<{
    name: string;
    brandId: string;
    isActive?: boolean;
  }>(req);

  validateRequired(body, ['name', 'brandId']);

  const id = generateId('championship');
  const now = new Date();

  const [newChampionship] = await db
    .insert(championships)
    .values({
      id,
      name: body.name,
      brandId: body.brandId,
      isActive: body.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return apiSuccess(newChampionship, 201);
}, { requireAdmin: true });
