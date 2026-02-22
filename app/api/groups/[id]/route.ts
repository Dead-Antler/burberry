import { NextRequest } from 'next/server';
import { apiHandler, apiSuccess, apiError, parseBodyWithSchema, parseQueryWithSchema } from '@/app/lib/api-helpers';
import { updateGroupSchema, deleteQuerySchema } from '@/app/lib/validation-schemas';
import { groupService } from '@/app/lib/services/group.service';

/**
 * GET /api/groups/:id
 * Get a specific group by ID
 * Query params:
 * - includeMembers: include member history (true/false)
 */
export const GET = apiHandler(async (req: NextRequest, { params }) => {
  if (!params?.id) {
    throw apiError('Group ID is required');
  }

  const { searchParams } = new URL(req.url);
  const includeMembers = searchParams.get('includeMembers') === 'true';

  const group = await groupService.getById(params.id, { includeMembers });

  return apiSuccess(group);
});

/**
 * PATCH /api/groups/:id
 * Update a group
 */
export const PATCH = apiHandler(async (req: NextRequest, { params }) => {
  if (!params?.id) {
    throw apiError('Group ID is required');
  }

  const body = await parseBodyWithSchema(req, updateGroupSchema);

  if (!body.name && !body.brandId && body.isActive === undefined) {
    throw apiError('No fields to update');
  }

  const group = await groupService.update(params.id, body);

  return apiSuccess(group);
}, { requireAdmin: true });

/**
 * DELETE /api/groups/:id
 * Make inactive (default) or permanently delete (?force=true) a group
 */
export const DELETE = apiHandler(async (req: NextRequest, { params }) => {
  if (!params?.id) {
    throw apiError('Group ID is required');
  }

  const { searchParams } = new URL(req.url);
  const query = parseQueryWithSchema(searchParams, deleteQuerySchema);

  if (query.force) {
    await groupService.forceDelete(params.id);
    return apiSuccess({ message: 'Group permanently deleted', id: params.id });
  }

  await groupService.delete(params.id);
  return apiSuccess({ message: 'Group deactivated successfully', id: params.id });
}, { requireAdmin: true });
