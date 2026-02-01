/**
 * Group Service - Business logic for group operations
 */

import { db } from '../db';
import { groups, groupMembers, wrestlers, brands } from '../schema';
import { eq, and, isNull, asc, desc, inArray, SQL, like } from 'drizzle-orm';
import { generateId, apiError } from '../api-helpers';
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
export interface CreateGroupInput {
  name: string;
  brandId: string;
  isActive?: boolean;
  memberIds?: string[];
}

export interface UpdateGroupInput {
  name?: string;
  brandId?: string;
  isActive?: boolean;
}

export interface AddMemberInput {
  wrestlerId: string;
  joinedAt?: string | Date;
}

export interface ListGroupsParams extends PaginationParams {
  brandId?: string;
  isActive?: boolean;
  includeMembers?: boolean;
  search?: string;
}

// Member with wrestler info
interface MemberWithWrestler {
  id: string;
  groupId: string;
  wrestlerId: string;
  wrestlerName: string | null;
  joinedAt: Date | null;
  leftAt: Date | null;
}

/**
 * Group Service
 */
export const groupService = {
  /**
   * List all groups with pagination and filters
   */
  async list(params: ListGroupsParams) {
    // Build where conditions
    const conditions: SQL[] = [];

    if (params.brandId) {
      conditions.push(eq(groups.brandId, params.brandId));
    }

    if (params.isActive !== undefined) {
      conditions.push(eq(groups.isActive, params.isActive));
    }

    if (params.search) {
      conditions.push(like(groups.name, `%${params.search}%`));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    // Build order by clause
    const orderBy: SQL =
      params.sortBy === 'name'
        ? params.sortOrder === 'desc'
          ? desc(groups.name)
          : asc(groups.name)
        : params.sortOrder === 'desc'
          ? desc(groups.createdAt)
          : asc(groups.createdAt);

    const { data, total } = await buildPaginatedList(groups, {
      where,
      orderBy,
      pagination: params,
    });

    // Optionally include members (batch loaded to avoid N+1)
    if (params.includeMembers && data.length > 0) {
      const groupIds = data.map((t) => t.id);
      const allMembers = await db
        .select({
          id: groupMembers.id,
          groupId: groupMembers.groupId,
          wrestlerId: groupMembers.wrestlerId,
          wrestlerName: wrestlers.currentName,
          joinedAt: groupMembers.joinedAt,
          leftAt: groupMembers.leftAt,
        })
        .from(groupMembers)
        .leftJoin(wrestlers, eq(groupMembers.wrestlerId, wrestlers.id))
        .where(inArray(groupMembers.groupId, groupIds));

      // Group members by groupId
      const membersByGroup = new Map<string, MemberWithWrestler[]>();
      for (const member of allMembers) {
        if (!membersByGroup.has(member.groupId)) {
          membersByGroup.set(member.groupId, []);
        }
        membersByGroup.get(member.groupId)!.push(member);
      }

      const groupsWithMembers = data.map((group) => ({
        ...group,
        members: membersByGroup.get(group.id) || [],
      }));

      return { data: groupsWithMembers, total };
    }

    return { data, total };
  },

  /**
   * Get a single group by ID
   * @throws 404 if not found
   */
  async getById(id: string, options?: { includeMembers?: boolean }) {
    const group = await ensureExists(groups, id, 'Group');

    if (options?.includeMembers) {
      const members = await db
        .select({
          id: groupMembers.id,
          wrestlerId: groupMembers.wrestlerId,
          wrestlerName: wrestlers.currentName,
          joinedAt: groupMembers.joinedAt,
          leftAt: groupMembers.leftAt,
        })
        .from(groupMembers)
        .leftJoin(wrestlers, eq(groupMembers.wrestlerId, wrestlers.id))
        .where(eq(groupMembers.groupId, id))
        .orderBy(groupMembers.joinedAt);

      return { ...group, members };
    }

    return group;
  },

  /**
   * Create a new group with optional initial members
   * @throws 400 if brandId or any memberIds are invalid
   */
  async create(input: CreateGroupInput) {
    // Validate foreign keys
    await ensureForeignKey(brands, input.brandId, 'Brand');

    // Deduplicate memberIds to prevent duplicate entries
    const uniqueMemberIds = input.memberIds ? [...new Set(input.memberIds)] : [];

    if (uniqueMemberIds.length > 0) {
      await ensureAllExist(wrestlers, uniqueMemberIds, 'Wrestler');
    }

    const id = generateId('group');
    const { createdAt, updatedAt } = timestamps();

    // Use transaction to ensure group and members are created together
    return withTransaction(async (tx) => {
      const [newGroup] = await tx
        .insert(groups)
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
      if (uniqueMemberIds.length > 0) {
        await tx.insert(groupMembers).values(
          uniqueMemberIds.map((wrestlerId) => ({
            id: generateId('groupmember'),
            groupId: id,
            wrestlerId,
            joinedAt: createdAt,
            leftAt: null,
            createdAt,
          }))
        );
      }

      return newGroup;
    });
  },

  /**
   * Update an existing group
   * @throws 404 if not found
   * @throws 400 if brandId is invalid
   */
  async update(id: string, input: UpdateGroupInput) {
    // Ensure group exists
    await ensureExists(groups, id, 'Group');

    // Validate brand FK if provided
    if (input.brandId) {
      await ensureForeignKey(brands, input.brandId, 'Brand');
    }

    const [updated] = await db
      .update(groups)
      .set({
        ...(input.name && { name: input.name }),
        ...(input.brandId && { brandId: input.brandId }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
        ...updatedTimestamp(),
      })
      .where(eq(groups.id, id))
      .returning();

    return updated;
  },

  /**
   * Soft delete a group (sets isActive to false)
   * @throws 404 if not found
   */
  async delete(id: string) {
    // Ensure group exists
    await ensureExists(groups, id, 'Group');

    const [updated] = await db
      .update(groups)
      .set({
        isActive: false,
        ...updatedTimestamp(),
      })
      .where(eq(groups.id, id))
      .returning();

    return updated;
  },

  /**
   * Get members for a group
   * @throws 404 if group not found
   */
  async getMembers(groupId: string, options?: { currentOnly?: boolean }) {
    // Ensure group exists
    await ensureExists(groups, groupId, 'Group');

    const conditions: SQL[] = [eq(groupMembers.groupId, groupId)];

    if (options?.currentOnly) {
      conditions.push(isNull(groupMembers.leftAt));
    }

    return db
      .select({
        id: groupMembers.id,
        wrestlerId: groupMembers.wrestlerId,
        wrestlerName: wrestlers.currentName,
        joinedAt: groupMembers.joinedAt,
        leftAt: groupMembers.leftAt,
      })
      .from(groupMembers)
      .leftJoin(wrestlers, eq(groupMembers.wrestlerId, wrestlers.id))
      .where(and(...conditions))
      .orderBy(groupMembers.joinedAt);
  },

  /**
   * Add a member to a group
   * @throws 404 if group not found
   * @throws 400 if wrestler not found
   */
  async addMember(groupId: string, input: AddMemberInput) {
    // Ensure group exists
    await ensureExists(groups, groupId, 'Group');

    // Ensure wrestler exists
    await ensureForeignKey(wrestlers, input.wrestlerId, 'Wrestler');

    // Check for existing active membership
    const existingMember = await db
      .select()
      .from(groupMembers)
      .where(
        and(
          eq(groupMembers.groupId, groupId),
          eq(groupMembers.wrestlerId, input.wrestlerId),
          isNull(groupMembers.leftAt)
        )
      )
      .limit(1);

    if (existingMember.length > 0) {
      throw apiError('Wrestler is already an active member of this group', 409);
    }

    const joinedAt = input.joinedAt ? new Date(input.joinedAt) : new Date();

    const [newMember] = await db
      .insert(groupMembers)
      .values({
        id: generateId('groupmember'),
        groupId,
        wrestlerId: input.wrestlerId,
        joinedAt,
        leftAt: null,
        createdAt: new Date(),
      })
      .returning();

    return newMember;
  },

  /**
   * Remove a member from a group (sets leftAt timestamp)
   * @throws 404 if member not found
   */
  async removeMember(memberId: string, leftAt?: Date) {
    const [updated] = await db
      .update(groupMembers)
      .set({
        leftAt: leftAt || new Date(),
      })
      .where(eq(groupMembers.id, memberId))
      .returning();

    if (!updated) {
      throw new Error('Member not found');
    }

    return updated;
  },
};
