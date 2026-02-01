import { NextRequest } from 'next/server';
import { apiHandler, apiSuccess, apiError, parseBodyWithSchema } from '@/app/lib/api-helpers';
import { addGroupMemberSchema } from '@/app/lib/validation-schemas';
import { groupService } from '@/app/lib/services/group.service';

/**
 * GET /api/groups/:id/members
 * Get member history for a group
 * Query params:
 * - current: only show current members (true/false)
 */
export const GET = apiHandler(async (req: NextRequest, { params }) => {
  if (!params?.id) {
    throw apiError('Group ID is required');
  }

  const { searchParams } = new URL(req.url);
  const currentOnly = searchParams.get('current') === 'true';

  const members = await groupService.getMembers(params.id, { currentOnly });

  return apiSuccess(members);
});

/**
 * POST /api/groups/:id/members
 * Add a member to a group
 */
export const POST = apiHandler(async (req: NextRequest, { params }) => {
  if (!params?.id) {
    throw apiError('Group ID is required');
  }

  const body = await parseBodyWithSchema(req, addGroupMemberSchema);

  const member = await groupService.addMember(params.id, body);

  return apiSuccess(member, 201);
}, { requireAdmin: true });
