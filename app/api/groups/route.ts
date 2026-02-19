import { NextRequest } from 'next/server';
import {
  apiHandler,
  apiSuccess,
  apiSuccessCached,
  parseBodyWithSchema,
  parseQueryWithSchema,
  createPaginatedResponse,
} from '@/app/lib/api-helpers';
import { createGroupSchema, groupQuerySchema, paginationSchema } from '@/app/lib/validation-schemas';
import { groupService } from '@/app/lib/services/group.service';

/**
 * GET /api/groups
 * List all groups with pagination
 * Query params:
 * - brandId: filter by brand
 * - isActive: filter by active status (true/false)
 * - includeMembers: include current members (true/false)
 * - page, limit, sortBy, sortOrder: pagination
 */
export const GET = apiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const query = parseQueryWithSchema(searchParams, groupQuerySchema);
  const pagination = parseQueryWithSchema(searchParams, paginationSchema);

  const { data, total } = await groupService.list({
    ...pagination,
    brandId: query.brandId,
    isActive: query.isActive,
    includeMembers: query.includeMembers,
    search: query.search,
  });

  return apiSuccessCached(createPaginatedResponse(data, total, pagination));
});

/**
 * POST /api/groups
 * Create a new group
 */
export const POST = apiHandler(async (req: NextRequest) => {
  const body = await parseBodyWithSchema(req, createGroupSchema);

  const group = await groupService.create(body);

  return apiSuccess(group, 201);
}, { requireAdmin: true });
