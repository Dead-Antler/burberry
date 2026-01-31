/**
 * Wrestler Service - Business logic for wrestler operations
 */

import { db } from '../db';
import { wrestlers, wrestlerNames, brands } from '../schema';
import { eq, and, isNull, asc, desc, SQL } from 'drizzle-orm';
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
