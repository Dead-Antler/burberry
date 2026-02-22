/**
 * Wrestler Service - Business logic for wrestler operations
 */

import { db } from '../db';
import { wrestlers, wrestlerNames, brands, groupMembers, groups, matchParticipants, matchPredictions, matches, wrestlerPredictionCooldowns, eventCustomPredictions, userCustomPredictions } from '../schema';
import { eq, and, isNull, asc, desc, SQL, inArray, like } from 'drizzle-orm';
import { generateId } from '../api-helpers';
import type { PaginationParams } from '../api-helpers';
import {
  ensureExists,
  ensureForeignKey,
  buildPaginatedList,
  withTransaction,
  timestamps,
  updatedTimestamp,
} from '../entities';

// Input types
export interface CreateWrestlerInput {
  currentName: string;
  brandId: string;
  isActive?: boolean;
}

export interface UpdateWrestlerInput {
  currentName?: string;
  brandId?: string;
  isActive?: boolean;
}

export interface ListWrestlersParams extends PaginationParams {
  brandId?: string;
  isActive?: boolean;
  search?: string;
}

/**
 * Wrestler Service
 */
export const wrestlerService = {
  /**
   * List all wrestlers with pagination and filters
   */
  async list(params: ListWrestlersParams) {
    // Build where conditions
    const conditions: SQL[] = [];

    if (params.brandId) {
      conditions.push(eq(wrestlers.brandId, params.brandId));
    }

    if (params.isActive !== undefined) {
      conditions.push(eq(wrestlers.isActive, params.isActive));
    }

    if (params.search) {
      conditions.push(like(wrestlers.currentName, `%${params.search}%`));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    // Build order by clause
    const orderBy: SQL =
      params.sortBy === 'currentName'
        ? params.sortOrder === 'desc'
          ? desc(wrestlers.currentName)
          : asc(wrestlers.currentName)
        : params.sortOrder === 'desc'
          ? desc(wrestlers.createdAt)
          : asc(wrestlers.createdAt);

    const { data, total } = await buildPaginatedList(wrestlers, {
      where,
      orderBy,
      pagination: params,
    });

    return { data, total };
  },

  /**
   * List wrestlers with their current group memberships
   * Uses batch loading to avoid N+1 queries
   */
  async listWithGroups(params: ListWrestlersParams) {
    // First, get wrestlers using existing list method
    const { data: wrestlerData, total } = await this.list(params);

    if (wrestlerData.length === 0) {
      return { data: [], total: 0 };
    }

    // Batch query current group memberships for all wrestlers
    const wrestlerIds = wrestlerData.map((w) => w.id);

    const memberships = await db
      .select({
        wrestlerId: groupMembers.wrestlerId,
        groupId: groups.id,
        groupName: groups.name,
      })
      .from(groupMembers)
      .innerJoin(groups, eq(groupMembers.groupId, groups.id))
      .where(
        and(inArray(groupMembers.wrestlerId, wrestlerIds), isNull(groupMembers.leftAt))
      );

    // Map memberships to wrestlers
    const groupsByWrestler = new Map<string, Array<{ id: string; name: string }>>();
    for (const m of memberships) {
      if (!groupsByWrestler.has(m.wrestlerId)) {
        groupsByWrestler.set(m.wrestlerId, []);
      }
      groupsByWrestler.get(m.wrestlerId)!.push({
        id: m.groupId,
        name: m.groupName,
      });
    }

    // Combine wrestlers with their groups
    const data = wrestlerData.map((wrestler) => ({
      ...wrestler,
      groups: groupsByWrestler.get(wrestler.id) || [],
    }));

    return { data, total };
  },

  /**
   * Get a single wrestler by ID
   * @throws 404 if not found
   */
  async getById(id: string, options?: { includeHistory?: boolean }) {
    const wrestler = await ensureExists(wrestlers, id, 'Wrestler');

    if (options?.includeHistory) {
      const nameHistory = await db
        .select()
        .from(wrestlerNames)
        .where(eq(wrestlerNames.wrestlerId, id))
        .orderBy(wrestlerNames.validFrom);

      return { ...wrestler, nameHistory };
    }

    return wrestler;
  },

  /**
   * Create a new wrestler with initial name history
   * @throws 400 if brandId is invalid
   */
  async create(input: CreateWrestlerInput) {
    // Validate foreign key
    await ensureForeignKey(brands, input.brandId, 'Brand');

    const id = generateId('wrestler');
    const { createdAt, updatedAt } = timestamps();

    // Use transaction to ensure wrestler and name history are created together
    return withTransaction(async (tx) => {
      const [newWrestler] = await tx
        .insert(wrestlers)
        .values({
          id,
          currentName: input.currentName,
          brandId: input.brandId,
          isActive: input.isActive ?? true,
          createdAt,
          updatedAt,
        })
        .returning();

      // Create initial name history entry
      await tx.insert(wrestlerNames).values({
        id: generateId('wrestlername'),
        wrestlerId: id,
        name: input.currentName,
        validFrom: createdAt,
        validTo: null,
        createdAt,
      });

      return newWrestler;
    });
  },

  /**
   * Update an existing wrestler
   * If name is updated, creates new name history entry
   * @throws 404 if not found
   * @throws 400 if brandId is invalid
   */
  async update(id: string, input: UpdateWrestlerInput) {
    // Ensure wrestler exists
    await ensureExists(wrestlers, id, 'Wrestler');

    // Validate brand FK if provided
    if (input.brandId) {
      await ensureForeignKey(brands, input.brandId, 'Brand');
    }

    const now = new Date();

    // Use transaction if updating name (involves multiple tables)
    if (input.currentName) {
      const newName = input.currentName; // Capture for closure
      return withTransaction(async (tx) => {
        // Close out the current name
        await tx
          .update(wrestlerNames)
          .set({ validTo: now })
          .where(and(eq(wrestlerNames.wrestlerId, id), isNull(wrestlerNames.validTo)));

        // Create new name history entry
        await tx.insert(wrestlerNames).values({
          id: generateId('wrestlername'),
          wrestlerId: id,
          name: newName,
          validFrom: now,
          validTo: null,
          createdAt: now,
        });

        // Update wrestler record
        const [updated] = await tx
          .update(wrestlers)
          .set({
            currentName: newName,
            ...(input.brandId && { brandId: input.brandId }),
            ...(input.isActive !== undefined && { isActive: input.isActive }),
            updatedAt: now,
          })
          .where(eq(wrestlers.id, id))
          .returning();

        return updated;
      });
    }

    // Simple update without name change
    const [updated] = await db
      .update(wrestlers)
      .set({
        ...(input.brandId && { brandId: input.brandId }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
        ...updatedTimestamp(),
      })
      .where(eq(wrestlers.id, id))
      .returning();

    return updated;
  },

  /**
   * Soft delete a wrestler (sets isActive to false)
   * @throws 404 if not found
   */
  async delete(id: string) {
    // Ensure wrestler exists
    await ensureExists(wrestlers, id, 'Wrestler');

    const [updated] = await db
      .update(wrestlers)
      .set({
        isActive: false,
        ...updatedTimestamp(),
      })
      .where(eq(wrestlers.id, id))
      .returning();

    return updated;
  },

  /**
   * Force delete a wrestler (hard delete with cascade to all dependent records)
   * WARNING: This is irreversible and removes all associated data.
   * @throws 404 if not found
   */
  async forceDelete(id: string) {
    await ensureExists(wrestlers, id, 'Wrestler');

    await withTransaction(async (tx) => {
      // Find match participants referencing this wrestler
      const participantRows = await tx
        .select({ id: matchParticipants.id })
        .from(matchParticipants)
        .where(
          and(
            eq(matchParticipants.participantType, 'wrestler'),
            eq(matchParticipants.participantId, id)
          )
        );
      const participantIds = participantRows.map((p) => p.id);

      if (participantIds.length > 0) {
        // Null out winnerParticipantId on matches that reference these participants
        await tx
          .update(matches)
          .set({ winnerParticipantId: null })
          .where(inArray(matches.winnerParticipantId, participantIds));

        // Delete predictions that picked this wrestler as winner
        await tx
          .delete(matchPredictions)
          .where(inArray(matchPredictions.predictedParticipantId, participantIds));

        // Delete the match participant entries
        await tx
          .delete(matchParticipants)
          .where(inArray(matchParticipants.id, participantIds));
      }

      // Null out wrestler references in custom predictions
      await tx
        .update(eventCustomPredictions)
        .set({ answerWrestlerId: null })
        .where(eq(eventCustomPredictions.answerWrestlerId, id));
      await tx
        .update(userCustomPredictions)
        .set({ predictionWrestlerId: null })
        .where(eq(userCustomPredictions.predictionWrestlerId, id));

      // Delete wrestler name history
      await tx.delete(wrestlerNames).where(eq(wrestlerNames.wrestlerId, id));

      // Delete group memberships
      await tx.delete(groupMembers).where(eq(groupMembers.wrestlerId, id));

      // Delete wrestler prediction cooldowns
      await tx.delete(wrestlerPredictionCooldowns).where(eq(wrestlerPredictionCooldowns.wrestlerId, id));

      // Delete the wrestler
      await tx.delete(wrestlers).where(eq(wrestlers.id, id));
    });
  },

  /**
   * Get name history for a wrestler
   * @throws 404 if wrestler not found
   */
  async getNameHistory(wrestlerId: string) {
    // Ensure wrestler exists
    await ensureExists(wrestlers, wrestlerId, 'Wrestler');

    return db
      .select()
      .from(wrestlerNames)
      .where(eq(wrestlerNames.wrestlerId, wrestlerId))
      .orderBy(wrestlerNames.validFrom);
  },
};
