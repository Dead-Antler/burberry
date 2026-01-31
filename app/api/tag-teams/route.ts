import { NextRequest } from 'next/server';
import {
  apiHandler,
  apiSuccess,
  parseBodyWithSchema,
  parseQueryWithSchema,
  createPaginatedResponse,
} from '@/app/lib/api-helpers';
import { createTagTeamSchema, tagTeamQuerySchema, paginationSchema } from '@/app/lib/validation-schemas';
import { tagTeamService } from '@/app/lib/services/tag-team.service';

/**
 * GET /api/tag-teams
 * List all tag teams with pagination
 * Query params:
 * - brandId: filter by brand
 * - isActive: filter by active status (true/false)
 * - includeMembers: include current members (true/false)
 * - page, limit, sortBy, sortOrder: pagination
 */
export const GET = apiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const query = parseQueryWithSchema(searchParams, tagTeamQuerySchema);
  const pagination = parseQueryWithSchema(searchParams, paginationSchema);

  const { data, total } = await tagTeamService.list({
    ...pagination,
    brandId: query.brandId,
    isActive: query.isActive,
    includeMembers: query.includeMembers,
  });

  return apiSuccess(createPaginatedResponse(data, total, pagination));
});

/**
 * POST /api/tag-teams
 * Create a new tag team
 */
export const POST = apiHandler(async (req: NextRequest) => {
  const body = await parseBodyWithSchema(req, createTagTeamSchema);

  const tagTeam = await tagTeamService.create(body);

  return apiSuccess(tagTeam, 201);
}, { requireAdmin: true });
