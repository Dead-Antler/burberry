import { NextRequest } from 'next/server';
import {
  apiHandler,
  apiSuccess,
  apiSuccessCached,
  parseBodyWithSchema,
  parseQueryWithSchema,
  createPaginatedResponse,
} from '@/app/lib/api-helpers';
import { createWrestlerSchema, wrestlerQuerySchema, paginationSchema } from '@/app/lib/validation-schemas';
import { wrestlerService } from '@/app/lib/services/wrestler.service';

/**
 * GET /api/wrestlers
 * List all wrestlers with pagination
 * Query params:
 * - brandId: filter by brand
 * - isActive: filter by active status (true/false)
 * - page, limit, sortBy, sortOrder: pagination
 */
export const GET = apiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const query = parseQueryWithSchema(searchParams, wrestlerQuerySchema);
  const pagination = parseQueryWithSchema(searchParams, paginationSchema);

  const { data, total } = await wrestlerService.list({
    ...pagination,
    brandId: query.brandId,
    isActive: query.isActive,
    search: query.search,
  });

  return apiSuccessCached(createPaginatedResponse(data, total, pagination));
});

/**
 * POST /api/wrestlers
 * Create a new wrestler
 */
export const POST = apiHandler(async (req: NextRequest) => {
  const body = await parseBodyWithSchema(req, createWrestlerSchema);

  const wrestler = await wrestlerService.create(body);

  return apiSuccess(wrestler, 201);
}, { requireAdmin: true });
