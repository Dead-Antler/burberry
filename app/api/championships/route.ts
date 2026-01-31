import { NextRequest } from 'next/server';
import {
  apiHandler,
  apiSuccess,
  parseBodyWithSchema,
  parseQueryWithSchema,
  createPaginatedResponse,
} from '@/app/lib/api-helpers';
import { createChampionshipSchema, championshipQuerySchema, paginationSchema } from '@/app/lib/validation-schemas';
import { championshipService } from '@/app/lib/services/championship.service';

/**
 * GET /api/championships
 * List all championships with pagination
 * Query params:
 * - brandId: filter by brand
 * - isActive: filter by active status (true/false)
 * - page, limit, sortBy, sortOrder: pagination
 */
export const GET = apiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const query = parseQueryWithSchema(searchParams, championshipQuerySchema);
  const pagination = parseQueryWithSchema(searchParams, paginationSchema);

  const { data, total } = await championshipService.list({
    ...pagination,
    brandId: query.brandId,
    isActive: query.isActive,
  });

  return apiSuccess(createPaginatedResponse(data, total, pagination));
});

/**
 * POST /api/championships
 * Create a new championship
 */
export const POST = apiHandler(async (req: NextRequest) => {
  const body = await parseBodyWithSchema(req, createChampionshipSchema);

  const championship = await championshipService.create(body);

  return apiSuccess(championship, 201);
}, { requireAdmin: true });
