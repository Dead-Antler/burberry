/**
 * Custom Prediction Template Service - Business logic for prediction template operations
 */

import { db } from '../db';
import { customPredictionTemplates, eventCustomPredictions } from '../schema';
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
export interface CreateCustomPredictionTemplateInput {
  name: string;
  description?: string | null;
  predictionType: string;
  scoringMode?: string;
  cooldownDays?: number | null;
}

export interface UpdateCustomPredictionTemplateInput {
  name?: string;
  description?: string | null;
  predictionType?: string;
  scoringMode?: string;
  cooldownDays?: number | null;
}

export interface ListCustomPredictionTemplatesParams extends PaginationParams {}

/**
 * Custom Prediction Template Service
 */
export const customPredictionTemplateService = {
  /**
   * List all templates with pagination
   */
  async list(params: ListCustomPredictionTemplatesParams) {
    const orderBy: SQL =
      params.sortBy === 'name'
        ? params.sortOrder === 'desc'
          ? desc(customPredictionTemplates.name)
          : asc(customPredictionTemplates.name)
        : params.sortOrder === 'desc'
          ? desc(customPredictionTemplates.createdAt)
          : asc(customPredictionTemplates.createdAt);

    const { data, total } = await buildPaginatedList(customPredictionTemplates, {
      orderBy,
      pagination: params,
    });

    return { data, total };
  },

  /**
   * Get a single template by ID
   * @throws 404 if not found
   */
  async getById(id: string) {
    return ensureExists(customPredictionTemplates, id, 'Custom prediction template');
  },

  /**
   * Create a new template
   * @throws 409 if name already exists
   */
  async create(input: CreateCustomPredictionTemplateInput) {
    await ensureUnique(customPredictionTemplates, 'name', input.name, 'Custom prediction template');

    const id = generateId('customtpl');

    const [newTemplate] = await db
      .insert(customPredictionTemplates)
      .values({
        id,
        name: input.name,
        description: input.description ?? null,
        predictionType: input.predictionType,
        ...(input.scoringMode && { scoringMode: input.scoringMode }),
        ...(input.cooldownDays !== undefined && { cooldownDays: input.cooldownDays }),
        ...timestamps(),
      })
      .returning();

    return newTemplate;
  },

  /**
   * Update an existing template
   * @throws 404 if not found
   * @throws 409 if new name already exists
   */
  async update(id: string, input: UpdateCustomPredictionTemplateInput) {
    await ensureExists(customPredictionTemplates, id, 'Custom prediction template');

    if (input.name) {
      await ensureUnique(customPredictionTemplates, 'name', input.name, 'Custom prediction template', id);
    }

    const [updated] = await db
      .update(customPredictionTemplates)
      .set({
        ...(input.name && { name: input.name }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.predictionType && { predictionType: input.predictionType }),
        ...(input.scoringMode && { scoringMode: input.scoringMode }),
        ...(input.cooldownDays !== undefined && { cooldownDays: input.cooldownDays }),
        ...updatedTimestamp(),
      })
      .where(eq(customPredictionTemplates.id, id))
      .returning();

    return updated;
  },

  /**
   * Delete a template
   * @throws 404 if not found
   * @throws 400 if template is in use by event custom predictions
   */
  async delete(id: string) {
    await ensureExists(customPredictionTemplates, id, 'Custom prediction template');

    // Check if template is in use
    const [usage] = await db
      .select({ id: eventCustomPredictions.id })
      .from(eventCustomPredictions)
      .where(eq(eventCustomPredictions.templateId, id))
      .limit(1);

    if (usage) {
      throw apiError('Cannot delete template that is in use by event predictions', 400);
    }

    await db.delete(customPredictionTemplates).where(eq(customPredictionTemplates.id, id));
  },
};
