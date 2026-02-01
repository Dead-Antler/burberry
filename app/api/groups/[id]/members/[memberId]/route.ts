import { NextRequest } from 'next/server';
import { db } from '@/app/lib/db';
import { groupMembers } from '@/app/lib/schema';
import { eq } from 'drizzle-orm';
import { apiHandler, apiSuccess, apiError, parseBodyWithSchema } from '@/app/lib/api-helpers';
import { updateGroupMemberSchema } from '@/app/lib/validation-schemas';

/**
 * PATCH /api/groups/:id/members/:memberId
 * Update a group member (e.g., mark as left)
 */
export const PATCH = apiHandler(async (req: NextRequest, { params }) => {
  if (!params?.id || !params?.memberId) {
    throw apiError('Group ID and member ID are required');
  }

  const body = await parseBodyWithSchema(req, updateGroupMemberSchema);

  if (body.leftAt === undefined) {
    throw apiError('No fields to update');
  }

  const leftAt = body.leftAt ? new Date(body.leftAt) : null;

  const [updatedMember] = await db
    .update(groupMembers)
    .set({ leftAt })
    .where(eq(groupMembers.id, params.memberId))
    .returning();

  if (!updatedMember) {
    throw apiError('Member not found', 404);
  }

  return apiSuccess(updatedMember);
}, { requireAdmin: true });

/**
 * DELETE /api/groups/:id/members/:memberId
 * Remove a member from a group (soft delete - sets leftAt for history tracking)
 */
export const DELETE = apiHandler(async (_req, { params }) => {
  if (!params?.id || !params?.memberId) {
    throw apiError('Group ID and member ID are required');
  }

  const [updatedMember] = await db
    .update(groupMembers)
    .set({ leftAt: new Date() })
    .where(eq(groupMembers.id, params.memberId))
    .returning();

  if (!updatedMember) {
    throw apiError('Member not found', 404);
  }

  return apiSuccess(updatedMember);
}, { requireAdmin: true });
