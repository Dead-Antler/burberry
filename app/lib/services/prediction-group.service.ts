/**
 * Prediction Group Service - Business logic for prediction group operations
 */

import { db } from '../db';
import { customPredictionGroups, customPredictionGroupMembers, customPredictionTemplates } from '../schema';
import { eq, asc, desc, SQL } from 'drizzle-orm';
import { generateId } from '../api-helpers';
import type { PaginationParams } from '../api-helpers';
import {
  ensureExists,
  ensureUnique,
  buildPaginatedList,
  timestamps,
  updatedTimestamp,
} from '../entities';
import { apiError } from '../api-helpers';

// Input types
export interface CreatePredictionGroupInput {
  name: string;
}

export interface UpdatePredictionGroupInput {
  name?: string;
}

export interface ListPredictionGroupsParams extends PaginationParams {}

/**
 * Prediction Group Service
 */
export const predictionGroupService = {
  /**
   * List all groups with pagination
   */
  async list(params: ListPredictionGroupsParams) {
    const orderBy: SQL =
      params.sortBy === 'name'
        ? params.sortOrder === 'desc'
          ? desc(customPredictionGroups.name)
          : asc(customPredictionGroups.name)
        : params.sortOrder === 'desc'
          ? desc(customPredictionGroups.createdAt)
          : asc(customPredictionGroups.createdAt);

    const { data, total } = await buildPaginatedList(customPredictionGroups, {
      orderBy,
      pagination: params,
    });

    return { data, total };
  },

  /**
   * Get a single group by ID
   * @throws 404 if not found
   */
  async getById(id: string) {
    return ensureExists(customPredictionGroups, id, 'Prediction group');
  },

  /**
   * Get a group with its member templates
   * @throws 404 if not found
   */
  async getWithMembers(id: string) {
    const group = await ensureExists(customPredictionGroups, id, 'Prediction group');

    const members = await db
      .select({
        member: customPredictionGroupMembers,
        template: customPredictionTemplates,
      })
      .from(customPredictionGroupMembers)
      .innerJoin(customPredictionTemplates, eq(customPredictionGroupMembers.templateId, customPredictionTemplates.id))
      .where(eq(customPredictionGroupMembers.groupId, id));

    return {
      ...group,
      templates: members.map((m) => m.template),
      members: members.map((m) => m.member),
    };
  },

  /**
   * Create a new group
   * @throws 409 if name already exists
   */
  async create(input: CreatePredictionGroupInput) {
    await ensureUnique(customPredictionGroups, 'name', input.name, 'Prediction group');

    const id = generateId('predgroup');

    const [newGroup] = await db
      .insert(customPredictionGroups)
      .values({
        id,
        name: input.name,
        ...timestamps(),
      })
      .returning();

    return newGroup;
  },

  /**
   * Update an existing group
   * @throws 404 if not found
   * @throws 409 if new name already exists
   */
  async update(id: string, input: UpdatePredictionGroupInput) {
    await ensureExists(customPredictionGroups, id, 'Prediction group');

    if (input.name) {
      await ensureUnique(customPredictionGroups, 'name', input.name, 'Prediction group', id);
    }

    const [updated] = await db
      .update(customPredictionGroups)
      .set({
        ...(input.name && { name: input.name }),
        ...updatedTimestamp(),
      })
      .where(eq(customPredictionGroups.id, id))
      .returning();

    return updated;
  },

  /**
   * Delete a group and its members
   * @throws 404 if not found
   */
  async delete(id: string) {
    await ensureExists(customPredictionGroups, id, 'Prediction group');

    // Delete members first, then the group
    await db.delete(customPredictionGroupMembers).where(eq(customPredictionGroupMembers.groupId, id));
    await db.delete(customPredictionGroups).where(eq(customPredictionGroups.id, id));
  },

  /**
   * Add a template to a group
   * @throws 404 if group or template not found
   * @throws 409 if template already in group
   */
  async addMember(groupId: string, templateId: string) {
    await ensureExists(customPredictionGroups, groupId, 'Prediction group');
    await ensureExists(customPredictionTemplates, templateId, 'Custom prediction template');

    // Check if already a member
    const [existing] = await db
      .select()
      .from(customPredictionGroupMembers)
      .where(
        eq(customPredictionGroupMembers.groupId, groupId)
      )
      .then((rows) => rows.filter((r) => r.templateId === templateId));

    if (existing) {
      throw apiError('Template is already in this group', 409);
    }

    const id = generateId('predgroupmem');

    const [member] = await db
      .insert(customPredictionGroupMembers)
      .values({
        id,
        groupId,
        templateId,
        createdAt: new Date(),
      })
      .returning();

    return member;
  },

  /**
   * Remove a template from a group
   * @throws 404 if member not found
   */
  async removeMember(memberId: string) {
    const [member] = await db
      .select()
      .from(customPredictionGroupMembers)
      .where(eq(customPredictionGroupMembers.id, memberId))
      .limit(1);

    if (!member) {
      throw apiError('Group member not found', 404);
    }

    await db.delete(customPredictionGroupMembers).where(eq(customPredictionGroupMembers.id, memberId));
  },
};
