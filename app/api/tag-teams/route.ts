import { NextRequest } from 'next/server';
import { db } from '@/app/lib/db';
import { tagTeams, tagTeamMembers, wrestlers } from '@/app/lib/schema';
import { eq, isNull, and, inArray } from 'drizzle-orm';
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

  const conditions = [];

  if (brandId) {
    conditions.push(eq(tagTeams.brandId, brandId));
  }

  if (isActive !== null) {
    const activeStatus = isActive === 'true';
    conditions.push(eq(tagTeams.isActive, activeStatus));
  }

  const allTagTeams = conditions.length > 0
    ? await db.select().from(tagTeams).where(and(...conditions))
    : await db.select().from(tagTeams);

  if (includeMembers) {
    const teamIds = allTagTeams.map((t) => t.id);
    const allMembers =
      teamIds.length > 0
        ? await db
            .select({
              id: tagTeamMembers.id,
              tagTeamId: tagTeamMembers.tagTeamId,
              wrestlerId: tagTeamMembers.wrestlerId,
              wrestlerName: wrestlers.currentName,
              joinedAt: tagTeamMembers.joinedAt,
              leftAt: tagTeamMembers.leftAt,
            })
            .from(tagTeamMembers)
            .leftJoin(wrestlers, eq(tagTeamMembers.wrestlerId, wrestlers.id))
            .where(inArray(tagTeamMembers.tagTeamId, teamIds))
        : [];

    // Group members by tagTeamId
    const membersByTeam = new Map<string, typeof allMembers>();
    for (const member of allMembers) {
      if (!membersByTeam.has(member.tagTeamId)) {
        membersByTeam.set(member.tagTeamId, []);
      }
      membersByTeam.get(member.tagTeamId)!.push(member);
    }

    const teamsWithMembers = allTagTeams.map((team) => ({
      ...team,
      members: membersByTeam.get(team.id) || [],
    }));

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
