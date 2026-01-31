import { NextRequest } from 'next/server';
import { db } from '@/app/lib/db';
import { tagTeamMembers, wrestlers } from '@/app/lib/schema';
import { eq, isNull, and } from 'drizzle-orm';
import { apiHandler, apiSuccess, apiError, parseBody, validateRequired, generateId } from '@/app/lib/api-helpers';

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

  let query = db
    .select({
      id: tagTeamMembers.id,
      wrestlerId: tagTeamMembers.wrestlerId,
      wrestlerName: wrestlers.currentName,
      joinedAt: tagTeamMembers.joinedAt,
      leftAt: tagTeamMembers.leftAt,
    })
    .from(tagTeamMembers)
    .leftJoin(wrestlers, eq(tagTeamMembers.wrestlerId, wrestlers.id))
    .where(eq(tagTeamMembers.tagTeamId, params.id));

  if (currentOnly) {
    query = query.where(isNull(tagTeamMembers.leftAt)) as typeof query;
  }

  const members = await query.orderBy(tagTeamMembers.joinedAt);

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

  const body = await parseBody<{
    wrestlerId: string;
    joinedAt?: string | Date;
  }>(req);

  validateRequired(body, ['wrestlerId']);

  const joinedAt = body.joinedAt ? new Date(body.joinedAt) : new Date();

  const [newMember] = await db
    .insert(tagTeamMembers)
    .values({
      id: generateId('tagteammember'),
      tagTeamId: params.id,
      wrestlerId: body.wrestlerId,
      joinedAt,
      leftAt: null,
      createdAt: new Date(),
    })
    .returning();

  return apiSuccess(newMember, 201);
}, { requireAdmin: true });
