import { NextRequest } from 'next/server';
import { db } from '@/app/lib/db';
import { championships } from '@/app/lib/schema';
import { eq, and } from 'drizzle-orm';
import { apiHandler, apiSuccess, parseBodyWithSchema, parseQueryWithSchema, generateId } from '@/app/lib/api-helpers';
import { createChampionshipSchema, championshipQuerySchema } from '@/app/lib/validation-schemas';

/**
 * GET /api/championships
 * List all championships
 * Query params:
 * - brandId: filter by brand
 * - isActive: filter by active status (true/false)
 */
export const GET = apiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const query = parseQueryWithSchema(searchParams, championshipQuerySchema);

  const conditions = [];

  if (query.brandId) {
    conditions.push(eq(championships.brandId, query.brandId));
  }

  if (query.isActive !== undefined) {
    conditions.push(eq(championships.isActive, query.isActive));
  }

  const allChampionships = conditions.length > 0
    ? await db.select().from(championships).where(and(...conditions))
    : await db.select().from(championships);

  return apiSuccess(allChampionships);
});

/**
 * POST /api/championships
 * Create a new championship
 */
export const POST = apiHandler(async (req: NextRequest) => {
  const body = await parseBodyWithSchema(req, createChampionshipSchema);

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
