import { NextRequest } from 'next/server';
import { db } from '@/app/lib/db';
import { brands } from '@/app/lib/schema';
import { eq } from 'drizzle-orm';
import { apiHandler, apiSuccess, parseBodyWithSchema, generateId } from '@/app/lib/api-helpers';
import { createBrandSchema } from '@/app/lib/validation-schemas';

/**
 * GET /api/brands
 * List all brands
 */
export const GET = apiHandler(async () => {
  const allBrands = await db.select().from(brands);
  return apiSuccess(allBrands);
});

/**
 * POST /api/brands
 * Create a new brand
 */
export const POST = apiHandler(async (req: NextRequest) => {
  const body = await parseBodyWithSchema(req, createBrandSchema);

  const id = generateId('brand');
  const now = new Date();

  const [newBrand] = await db
    .insert(brands)
    .values({
      id,
      name: body.name,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return apiSuccess(newBrand, 201);
}, { requireAdmin: true });
