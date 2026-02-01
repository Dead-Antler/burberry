import { NextRequest } from 'next/server';
import { apiHandler, apiSuccess, parseQueryWithSchema } from '@/app/lib/api-helpers';
import { groupQuerySchema } from '@/app/lib/validation-schemas';
import { groupService } from '@/app/lib/services/group.service';

/**
 * GET /api/groups/all
 * Fetch all groups without pagination (for combobox/selection)
 * Query params:
 * - brandId: filter by brand
 * - isActive: filter by active status (true/false)
 * - includeMembers: include current members (true/false)
 */
export const GET = apiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const query = parseQueryWithSchema(searchParams, groupQuerySchema);

  const { data } = await groupService.list({
    page: 1,
    limit: 1000, // Effectively unlimited for a small private system
    sortBy: 'name',
    sortOrder: 'asc',
    brandId: query.brandId,
    isActive: query.isActive,
    includeMembers: query.includeMembers,
  });

  return apiSuccess({ data });
});
