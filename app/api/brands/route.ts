import { NextRequest } from 'next/server';
import {
  apiHandler,
  apiSuccess,
  parseBodyWithSchema,
  parseQueryWithSchema,
  createPaginatedResponse,
} from '@/app/lib/api-helpers';
import { createBrandSchema, paginationSchema } from '@/app/lib/validation-schemas';
import { brandService } from '@/app/lib/services/brand.service';

/**
 * GET /api/brands
 * List all brands with pagination
 */
export const GET = apiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const params = parseQueryWithSchema(searchParams, paginationSchema);

  const { data, total } = await brandService.list(params);

  return apiSuccess(createPaginatedResponse(data, total, params));
});

/**
 * POST /api/brands
 * Create a new brand
 */
export const POST = apiHandler(async (req: NextRequest) => {
  const body = await parseBodyWithSchema(req, createBrandSchema);

  const brand = await brandService.create(body);

  return apiSuccess(brand, 201);
}, { requireAdmin: true });
