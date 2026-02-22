import { NextRequest } from 'next/server';
import { apiHandler, apiSuccess, parseQueryWithSchema } from '@/app/lib/api-helpers';
import { wrestlerQuerySchema } from '@/app/lib/validation-schemas';
import { wrestlerService } from '@/app/lib/services/wrestler.service';

/**
 * GET /api/wrestlers/all
 * Fetch all wrestlers without pagination (for combobox/selection)
 * Query params:
 * - brandId: filter by brand
 * - isActive: filter by active status (true/false)
 */
export const GET = apiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const query = parseQueryWithSchema(searchParams, wrestlerQuerySchema);

  const listParams = {
    page: 1,
    limit: 1000, // Effectively unlimited for a small private system
    sortBy: 'name',
    sortOrder: 'asc' as const,
    brandId: query.brandId,
    isActive: query.isActive,
  };

  // Use listWithGroups when includeGroups is true
  const { data } = query.includeGroups
    ? await wrestlerService.listWithGroups(listParams)
    : await wrestlerService.list(listParams);

  return apiSuccess({ data });
});
