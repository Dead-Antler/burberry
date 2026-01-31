/**
 * Brand Service - Business logic for brand operations
 */

import { db } from '../db';
import { brands } from '../schema';
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

// Input types
export interface CreateBrandInput {
  name: string;
}

export interface UpdateBrandInput {
  name?: string;
}

export interface ListBrandsParams extends PaginationParams {
  // Brands have no additional filters currently
}

/**
 * Brand Service
 */
export const brandService = {
  /**
   * List all brands with pagination
   */
  async list(params: ListBrandsParams) {
    // Build order by clause
    const orderBy: SQL =
      params.sortBy === 'name'
        ? params.sortOrder === 'desc'
          ? desc(brands.name)
          : asc(brands.name)
        : params.sortOrder === 'desc'
          ? desc(brands.createdAt)
          : asc(brands.createdAt);

    const { data, total } = await buildPaginatedList(brands, {
      orderBy,
      pagination: params,
    });

    return { data, total };
  },

  /**
   * Get a single brand by ID
   * @throws 404 if not found
   */
  async getById(id: string) {
    return ensureExists(brands, id, 'Brand');
  },

  /**
   * Create a new brand
   * @throws 409 if name already exists
   */
  async create(input: CreateBrandInput) {
    // Validate uniqueness
    await ensureUnique(brands, 'name', input.name, 'Brand');

    const id = generateId('brand');

    const [newBrand] = await db
      .insert(brands)
      .values({
        id,
        name: input.name,
        ...timestamps(),
      })
      .returning();

    return newBrand;
  },

  /**
   * Update an existing brand
   * @throws 404 if not found
   * @throws 409 if new name already exists
   */
  async update(id: string, input: UpdateBrandInput) {
    // Ensure brand exists
    await ensureExists(brands, id, 'Brand');

    // If updating name, check uniqueness (excluding current record)
    if (input.name) {
      await ensureUnique(brands, 'name', input.name, 'Brand', id);
    }

    const [updated] = await db
      .update(brands)
      .set({
        ...(input.name && { name: input.name }),
        ...updatedTimestamp(),
      })
      .where(eq(brands.id, id))
      .returning();

    return updated;
  },

  /**
   * Delete a brand
   * @throws 404 if not found
   */
  async delete(id: string) {
    // Ensure brand exists
    await ensureExists(brands, id, 'Brand');

    // Note: Could add check for wrestlers/championships/etc referencing this brand
    // For now, DB foreign key constraints will handle this

    await db.delete(brands).where(eq(brands.id, id));
  },
};
