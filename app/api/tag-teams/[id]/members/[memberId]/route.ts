import { NextRequest } from 'next/server';
import { db } from '@/app/lib/db';
import { tagTeamMembers } from '@/app/lib/schema';
import { eq } from 'drizzle-orm';
import { apiHandler, apiSuccess, apiError, parseBodyWithSchema } from '@/app/lib/api-helpers';
import { updateTagTeamMemberSchema } from '@/app/lib/validation-schemas';

/**
 * PATCH /api/tag-teams/:id/members/:memberId
 * Update a team member (e.g., mark as left)
 */
export const PATCH = apiHandler(async (req: NextRequest, { params }) => {
  if (!params?.id || !params?.memberId) {
    throw apiError('Tag team ID and member ID are required');
  }

  const body = await parseBodyWithSchema(req, updateTagTeamMemberSchema);

  if (body.leftAt === undefined) {
    throw apiError('No fields to update');
  }

  const leftAt = body.leftAt ? new Date(body.leftAt) : null;

  const [updatedMember] = await db
    .update(tagTeamMembers)
    .set({ leftAt })
    .where(eq(tagTeamMembers.id, params.memberId))
    .returning();

  if (!updatedMember) {
    throw apiError('Member not found', 404);
  }

  return apiSuccess(updatedMember);
}, { requireAdmin: true });

/**
 * DELETE /api/tag-teams/:id/members/:memberId
 * Remove a member from a tag team (hard delete)
 */
export const DELETE = apiHandler(async (_req, { params }) => {
  if (!params?.id || !params?.memberId) {
    throw apiError('Tag team ID and member ID are required');
  }

  const [deletedMember] = await db.delete(tagTeamMembers).where(eq(tagTeamMembers.id, params.memberId)).returning();

  if (!deletedMember) {
    throw apiError('Member not found', 404);
  }

  return apiSuccess({ message: 'Member removed successfully', id: params.memberId });
}, { requireAdmin: true });
