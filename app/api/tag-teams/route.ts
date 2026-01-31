import { NextRequest } from 'next/server';
import { db } from '@/app/lib/db';
import { tagTeams, tagTeamMembers, wrestlers } from '@/app/lib/schema';
import { eq, isNull } from 'drizzle-orm';
import { apiHandler, apiSuccess, parseBody, validateRequired, generateId } from '@/app/lib/api-helpers';

/**
 * GET /api/tag-teams
 * List all tag teams
 * Query params:
 * - brandId: filter by brand
 * - isActive: filter by active status (true/false)
 * - includeMembers: include current members (true/false)
 */
export const GET = apiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const brandId = searchParams.get('brandId');
  const isActive = searchParams.get('isActive');
  const includeMembers = searchParams.get('includeMembers') === 'true';

  let query = db.select().from(tagTeams);

  if (brandId) {
    query = query.where(eq(tagTeams.brandId, brandId)) as typeof query;
  }

  if (isActive !== null) {
    const activeStatus = isActive === 'true';
    query = query.where(eq(tagTeams.isActive, activeStatus)) as typeof query;
  }

  const allTagTeams = await query;

  if (includeMembers) {
    // Get current members for each tag team
    const teamsWithMembers = await Promise.all(
      allTagTeams.map(async (team) => {
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
          .where(eq(tagTeamMembers.tagTeamId, team.id));

        return { ...team, members };
      })
    );

    return apiSuccess(teamsWithMembers);
  }

  return apiSuccess(allTagTeams);
});

/**
 * POST /api/tag-teams
 * Create a new tag team
 */
export const POST = apiHandler(async (req: NextRequest) => {
  const body = await parseBody<{
    name: string;
    brandId: string;
    isActive?: boolean;
    memberIds?: string[]; // Initial members
  }>(req);

  validateRequired(body, ['name', 'brandId']);

  const id = generateId('tagteam');
  const now = new Date();

  // Create tag team
  const [newTagTeam] = await db
    .insert(tagTeams)
    .values({
      id,
      name: body.name,
      brandId: body.brandId,
      isActive: body.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  // Add initial members if provided
  if (body.memberIds && body.memberIds.length > 0) {
    await db.insert(tagTeamMembers).values(
      body.memberIds.map((wrestlerId) => ({
        id: generateId('tagteammember'),
        tagTeamId: id,
        wrestlerId,
        joinedAt: now,
        leftAt: null,
        createdAt: now,
      }))
    );
  }

  return apiSuccess(newTagTeam, 201);
}, { requireAdmin: true });
