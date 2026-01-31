import { NextRequest } from 'next/server';
import { db } from '@/app/lib/db';
import { tagTeams, tagTeamMembers, wrestlers } from '@/app/lib/schema';
import { eq } from 'drizzle-orm';
import { apiHandler, apiSuccess, apiError, parseBody } from '@/app/lib/api-helpers';

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

  const [tagTeam] = await db.select().from(tagTeams).where(eq(tagTeams.id, params.id));

  if (!tagTeam) {
    throw apiError('Tag team not found', 404);
  }

  if (includeMembers) {
    const members = await db
      .select({
        id: tagTeamMembers.id,
        wrestlerId: tagTeamMembers.wrestlerId,
        wrestlerName: wrestlers.currentName,
        joinedAt: tagTeamMembers.joinedAt,
        leftAt: tagTeamMembers.leftAt,
      })
      .from(tagTeamMembers)
      .leftJoin(wrestlers, eq(tagTeamMembers.wrestlerId, wrestlers.id))
      .where(eq(tagTeamMembers.tagTeamId, params.id))
      .orderBy(tagTeamMembers.joinedAt);

    return apiSuccess({ ...tagTeam, members });
  }

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

  const body = await parseBody<{
    name?: string;
    brandId?: string;
    isActive?: boolean;
  }>(req);

  if (!body.name && !body.brandId && body.isActive === undefined) {
    throw apiError('No fields to update');
  }

  const updateData: Record<string, unknown> = { updatedAt: new Date() };

  if (body.name !== undefined) updateData.name = body.name;
  if (body.brandId !== undefined) updateData.brandId = body.brandId;
  if (body.isActive !== undefined) updateData.isActive = body.isActive;

  const [updatedTagTeam] = await db
    .update(tagTeams)
    .set(updateData)
    .where(eq(tagTeams.id, params.id))
    .returning();

  if (!updatedTagTeam) {
    throw apiError('Tag team not found', 404);
  }

  return apiSuccess(updatedTagTeam);
}, { requireAdmin: true });

/**
 * DELETE /api/tag-teams/:id
 * Delete a tag team (soft delete - sets isActive to false)
 */
export const DELETE = apiHandler(async (_req, { params }) => {
  if (!params?.id) {
    throw apiError('Tag team ID is required');
  }

  const [updatedTagTeam] = await db
    .update(tagTeams)
    .set({
      isActive: false,
      updatedAt: new Date(),
    })
    .where(eq(tagTeams.id, params.id))
    .returning();

  if (!updatedTagTeam) {
    throw apiError('Tag team not found', 404);
  }

  return apiSuccess({ message: 'Tag team deactivated successfully', id: params.id });
}, { requireAdmin: true });
