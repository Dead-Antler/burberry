import { NextRequest } from 'next/server';
import { apiHandler, apiSuccess, apiError, parseBodyWithSchema } from '@/app/lib/api-helpers';
import { addTagTeamMemberSchema } from '@/app/lib/validation-schemas';
import { tagTeamService } from '@/app/lib/services/tag-team.service';

/**
 * GET /api/tag-teams/:id/members
 * Get member history for a tag team
 * Query params:
 * - current: only show current members (true/false)
 */
export const GET = apiHandler(async (req: NextRequest, { params }) => {
  if (!params?.id) {
    throw apiError('Tag team ID is required');
  }

  const { searchParams } = new URL(req.url);
  const currentOnly = searchParams.get('current') === 'true';

  const members = await tagTeamService.getMembers(params.id, { currentOnly });

  return apiSuccess(members);
});

/**
 * POST /api/tag-teams/:id/members
 * Add a member to a tag team
 */
export const POST = apiHandler(async (req: NextRequest, { params }) => {
  if (!params?.id) {
    throw apiError('Tag team ID is required');
  }

  const body = await parseBodyWithSchema(req, addTagTeamMemberSchema);

  const member = await tagTeamService.addMember(params.id, body);

  return apiSuccess(member, 201);
}, { requireAdmin: true });
