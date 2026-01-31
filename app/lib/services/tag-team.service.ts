/**
 * Tag Team Service - Business logic for tag team operations
 */

import { db } from '../db';
import { tagTeams, tagTeamMembers, wrestlers, brands } from '../schema';
import { eq, and, isNull, asc, desc, inArray, SQL } from 'drizzle-orm';
import { generateId } from '../api-helpers';
import type { PaginationParams } from '../api-helpers';
import {
  ensureExists,
  ensureForeignKey,
  ensureAllExist,
  buildPaginatedList,
  withTransaction,
  timestamps,
  updatedTimestamp,
} from '../entities';

// Input types
export interface CreateTagTeamInput {
  name: string;
  brandId: string;
  isActive?: boolean;
  memberIds?: string[];
}

export interface UpdateTagTeamInput {
  name?: string;
  brandId?: string;
  isActive?: boolean;
}

export interface AddMemberInput {
  wrestlerId: string;
  joinedAt?: string | Date;
}

export interface ListTagTeamsParams extends PaginationParams {
  brandId?: string;
  isActive?: boolean;
  includeMembers?: boolean;
}

// Member with wrestler info
interface MemberWithWrestler {
  id: string;
  tagTeamId: string;
  wrestlerId: string;
  wrestlerName: string | null;
  joinedAt: Date | null;
  leftAt: Date | null;
}

/**
 * Tag Team Service
 */
export const tagTeamService = {
  /**
   * List all tag teams with pagination and filters
   */
  async list(params: ListTagTeamsParams) {
    // Build where conditions
    const conditions: SQL[] = [];

    if (params.brandId) {
      conditions.push(eq(tagTeams.brandId, params.brandId));
    }

    if (params.isActive !== undefined) {
      conditions.push(eq(tagTeams.isActive, params.isActive));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    // Build order by clause
    const orderBy: SQL =
      params.sortBy === 'name'
        ? params.sortOrder === 'desc'
          ? desc(tagTeams.name)
          : asc(tagTeams.name)
        : params.sortOrder === 'desc'
          ? desc(tagTeams.createdAt)
          : asc(tagTeams.createdAt);

    const { data, total } = await buildPaginatedList(tagTeams, {
      where,
      orderBy,
      pagination: params,
    });

    // Optionally include members (batch loaded to avoid N+1)
    if (params.includeMembers && data.length > 0) {
      const teamIds = data.map((t) => t.id);
      const allMembers = await db
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
        .where(inArray(tagTeamMembers.tagTeamId, teamIds));

      // Group members by tagTeamId
      const membersByTeam = new Map<string, MemberWithWrestler[]>();
      for (const member of allMembers) {
        if (!membersByTeam.has(member.tagTeamId)) {
          membersByTeam.set(member.tagTeamId, []);
        }
        membersByTeam.get(member.tagTeamId)!.push(member);
      }

      const teamsWithMembers = data.map((team) => ({
        ...team,
        members: membersByTeam.get(team.id) || [],
      }));

      return { data: teamsWithMembers, total };
    }

    return { data, total };
  },

  /**
   * Get a single tag team by ID
   * @throws 404 if not found
   */
  async getById(id: string, options?: { includeMembers?: boolean }) {
    const tagTeam = await ensureExists(tagTeams, id, 'Tag team');

    if (options?.includeMembers) {
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
        .where(eq(tagTeamMembers.tagTeamId, id))
        .orderBy(tagTeamMembers.joinedAt);

      return { ...tagTeam, members };
    }

    return tagTeam;
  },

  /**
   * Create a new tag team with optional initial members
   * @throws 400 if brandId or any memberIds are invalid
   */
  async create(input: CreateTagTeamInput) {
    // Validate foreign keys
    await ensureForeignKey(brands, input.brandId, 'Brand');

    if (input.memberIds && input.memberIds.length > 0) {
      await ensureAllExist(wrestlers, input.memberIds, 'Wrestler');
    }

    const id = generateId('tagteam');
    const { createdAt, updatedAt } = timestamps();

    // Use transaction to ensure team and members are created together
    return withTransaction(async (tx) => {
      const [newTagTeam] = await tx
        .insert(tagTeams)
        .values({
          id,
          name: input.name,
          brandId: input.brandId,
          isActive: input.isActive ?? true,
          createdAt,
          updatedAt,
        })
        .returning();

      // Add initial members if provided
      if (input.memberIds && input.memberIds.length > 0) {
        await tx.insert(tagTeamMembers).values(
          input.memberIds.map((wrestlerId) => ({
            id: generateId('tagteammember'),
            tagTeamId: id,
            wrestlerId,
            joinedAt: createdAt,
            leftAt: null,
            createdAt,
          }))
        );
      }

      return newTagTeam;
    });
  },

  /**
   * Update an existing tag team
   * @throws 404 if not found
   * @throws 400 if brandId is invalid
   */
  async update(id: string, input: UpdateTagTeamInput) {
    // Ensure tag team exists
    await ensureExists(tagTeams, id, 'Tag team');

    // Validate brand FK if provided
    if (input.brandId) {
      await ensureForeignKey(brands, input.brandId, 'Brand');
    }

    const [updated] = await db
      .update(tagTeams)
      .set({
        ...(input.name && { name: input.name }),
        ...(input.brandId && { brandId: input.brandId }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
        ...updatedTimestamp(),
      })
      .where(eq(tagTeams.id, id))
      .returning();

    return updated;
  },

  /**
   * Soft delete a tag team (sets isActive to false)
   * @throws 404 if not found
   */
  async delete(id: string) {
    // Ensure tag team exists
    await ensureExists(tagTeams, id, 'Tag team');

    const [updated] = await db
      .update(tagTeams)
      .set({
        isActive: false,
        ...updatedTimestamp(),
      })
      .where(eq(tagTeams.id, id))
      .returning();

    return updated;
  },

  /**
   * Get members for a tag team
   * @throws 404 if tag team not found
   */
  async getMembers(tagTeamId: string, options?: { currentOnly?: boolean }) {
    // Ensure tag team exists
    await ensureExists(tagTeams, tagTeamId, 'Tag team');

    const conditions: SQL[] = [eq(tagTeamMembers.tagTeamId, tagTeamId)];

    if (options?.currentOnly) {
      conditions.push(isNull(tagTeamMembers.leftAt));
    }

    return db
      .select({
        id: tagTeamMembers.id,
        wrestlerId: tagTeamMembers.wrestlerId,
        wrestlerName: wrestlers.currentName,
        joinedAt: tagTeamMembers.joinedAt,
        leftAt: tagTeamMembers.leftAt,
      })
      .from(tagTeamMembers)
      .leftJoin(wrestlers, eq(tagTeamMembers.wrestlerId, wrestlers.id))
      .where(and(...conditions))
      .orderBy(tagTeamMembers.joinedAt);
  },

  /**
   * Add a member to a tag team
   * @throws 404 if tag team not found
   * @throws 400 if wrestler not found
   */
  async addMember(tagTeamId: string, input: AddMemberInput) {
    // Ensure tag team exists
    await ensureExists(tagTeams, tagTeamId, 'Tag team');

    // Ensure wrestler exists
    await ensureForeignKey(wrestlers, input.wrestlerId, 'Wrestler');

    const joinedAt = input.joinedAt ? new Date(input.joinedAt) : new Date();

    const [newMember] = await db
      .insert(tagTeamMembers)
      .values({
        id: generateId('tagteammember'),
        tagTeamId,
        wrestlerId: input.wrestlerId,
        joinedAt,
        leftAt: null,
        createdAt: new Date(),
      })
      .returning();

    return newMember;
  },

  /**
   * Remove a member from a tag team (sets leftAt timestamp)
   * @throws 404 if member not found
   */
  async removeMember(memberId: string, leftAt?: Date) {
    const [updated] = await db
      .update(tagTeamMembers)
      .set({
        leftAt: leftAt || new Date(),
      })
      .where(eq(tagTeamMembers.id, memberId))
      .returning();

    if (!updated) {
      throw new Error('Member not found');
    }

    return updated;
  },
};
