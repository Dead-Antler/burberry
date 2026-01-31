/**
 * Championship Service - Business logic for championship operations
 */

import { db } from '../db';
import { championships, brands } from '../schema';
import { eq, and, asc, desc, SQL } from 'drizzle-orm';
import { generateId } from '../api-helpers';
import type { PaginationParams } from '../api-helpers';
import {
  ensureExists,
  ensureForeignKey,
  buildPaginatedList,
  timestamps,
  updatedTimestamp,
} from '../entities';

// Input types
export interface CreateChampionshipInput {
  name: string;
  brandId: string;
  isActive?: boolean;
}

export interface UpdateChampionshipInput {
  name?: string;
  brandId?: string;
  isActive?: boolean;
}

export interface ListChampionshipsParams extends PaginationParams {
  brandId?: string;
  isActive?: boolean;
}

/**
 * Championship Service
 */
export const championshipService = {
  /**
   * List all championships with pagination and filters
   */
  async list(params: ListChampionshipsParams) {
    // Build where conditions
    const conditions: SQL[] = [];

    if (params.brandId) {
      conditions.push(eq(championships.brandId, params.brandId));
    }

    if (params.isActive !== undefined) {
      conditions.push(eq(championships.isActive, params.isActive));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    // Build order by clause
    const orderBy: SQL =
      params.sortBy === 'name'
        ? params.sortOrder === 'desc'
          ? desc(championships.name)
          : asc(championships.name)
        : params.sortOrder === 'desc'
          ? desc(championships.createdAt)
          : asc(championships.createdAt);

    const { data, total } = await buildPaginatedList(championships, {
      where,
      orderBy,
      pagination: params,
    });

    return { data, total };
  },

  /**
   * Get a single championship by ID
   * @throws 404 if not found
   */
  async getById(id: string) {
    return ensureExists(championships, id, 'Championship');
  },

  /**
   * Create a new championship
   * @throws 400 if brandId is invalid
   */
  async create(input: CreateChampionshipInput) {
    // Validate foreign key
    await ensureForeignKey(brands, input.brandId, 'Brand');

    const id = generateId('championship');

    const [newChampionship] = await db
      .insert(championships)
      .values({
        id,
        name: input.name,
        brandId: input.brandId,
        isActive: input.isActive ?? true,
        ...timestamps(),
      })
      .returning();

    return newChampionship;
  },

  /**
   * Update an existing championship
   * @throws 404 if not found
   * @throws 400 if brandId is invalid
   */
  async update(id: string, input: UpdateChampionshipInput) {
    // Ensure championship exists
    await ensureExists(championships, id, 'Championship');

    // Validate brand FK if provided
    if (input.brandId) {
      await ensureForeignKey(brands, input.brandId, 'Brand');
    }

    const [updated] = await db
      .update(championships)
      .set({
        ...(input.name && { name: input.name }),
        ...(input.brandId && { brandId: input.brandId }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
        ...updatedTimestamp(),
      })
      .where(eq(championships.id, id))
      .returning();

    return updated;
  },

  /**
   * Soft delete a championship (sets isActive to false)
   * @throws 404 if not found
   */
  async delete(id: string) {
    // Ensure championship exists
    await ensureExists(championships, id, 'Championship');

    const [updated] = await db
      .update(championships)
      .set({
        isActive: false,
        ...updatedTimestamp(),
      })
      .where(eq(championships.id, id))
      .returning();

    return updated;
  },
};
