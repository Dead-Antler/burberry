import { NextRequest } from 'next/server';
import { db } from '@/app/lib/db';
import { wrestlers, wrestlerNames } from '@/app/lib/schema';
import { eq, and } from 'drizzle-orm';
import { apiHandler, apiSuccess, parseBodyWithSchema, parseQueryWithSchema, generateId } from '@/app/lib/api-helpers';
import { createWrestlerSchema, wrestlerQuerySchema } from '@/app/lib/validation-schemas';

/**
 * GET /api/wrestlers
 * List all wrestlers
 * Query params:
 * - brandId: filter by brand
 * - isActive: filter by active status (true/false)
 */
export const GET = apiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const query = parseQueryWithSchema(searchParams, wrestlerQuerySchema);

  const conditions = [];

  if (query.brandId) {
    conditions.push(eq(wrestlers.brandId, query.brandId));
  }

  if (query.isActive !== undefined) {
    conditions.push(eq(wrestlers.isActive, query.isActive));
  }

  const allWrestlers = conditions.length > 0
    ? await db.select().from(wrestlers).where(and(...conditions))
    : await db.select().from(wrestlers);

  return apiSuccess(allWrestlers);
});

/**
 * POST /api/wrestlers
 * Create a new wrestler
 */
export const POST = apiHandler(async (req: NextRequest) => {
  const body = await parseBodyWithSchema(req, createWrestlerSchema);

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
