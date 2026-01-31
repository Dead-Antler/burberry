import { NextRequest } from 'next/server';
import { apiHandler, apiSuccess, apiError, parseBodyWithSchema } from '@/app/lib/api-helpers';
import { updateTagTeamSchema } from '@/app/lib/validation-schemas';
import { tagTeamService } from '@/app/lib/services/tag-team.service';

/**
 * GET /api/tag-teams/:id
 * Get a specific tag team by ID
 * Query params:
 * - includeMembers: include member history (true/false)
 */
export const GET = apiHandler(async (req: NextRequest, { params }) => {
  if (!params?.id) {
    throw apiError('Tag team ID is required');
  }

  const { searchParams } = new URL(req.url);
  const includeMembers = searchParams.get('includeMembers') === 'true';

  const tagTeam = await tagTeamService.getById(params.id, { includeMembers });

  return apiSuccess(tagTeam);
});

/**
 * PATCH /api/tag-teams/:id
 * Update a tag team
 */
export const PATCH = apiHandler(async (req: NextRequest, { params }) => {
  if (!params?.id) {
    throw apiError('Tag team ID is required');
  }

  const body = await parseBodyWithSchema(req, updateTagTeamSchema);

  if (!body.name && !body.brandId && body.isActive === undefined) {
    throw apiError('No fields to update');
  }

  const tagTeam = await tagTeamService.update(params.id, body);

  return apiSuccess(tagTeam);
}, { requireAdmin: true });

/**
 * DELETE /api/tag-teams/:id
 * Delete a tag team (soft delete - sets isActive to false)
 */
export const DELETE = apiHandler(async (_req, { params }) => {
  if (!params?.id) {
    throw apiError('Tag team ID is required');
  }

  await tagTeamService.delete(params.id);

  return apiSuccess({ message: 'Tag team deactivated successfully', id: params.id });
}, { requireAdmin: true });
