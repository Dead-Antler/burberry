/**
 * Prediction Service - Business logic for all prediction operations
 * Handles match predictions, custom predictions, and contrarian mode
 */

import { db } from '../db';
import {
  matchPredictions,
  matches,
  events,
  userCustomPredictions,
  eventCustomPredictions,
  customPredictionTemplates,
  userEventJoin,
  wrestlers,
} from '../schema';
import { eq, and, inArray, gte, ne } from 'drizzle-orm';
import { generateId, apiError } from '../api-helpers';
import {
  ensureExists,
  ensureOwnership,
  ensureForeignKey,
  ensureEventStatus,
  ensureEventStatusForMatch,
  withTransaction,
  timestamps,
  updatedTimestamp,
} from '../entities';

// ============================================================================
// Common Helpers
// ============================================================================

/**
 * Ensure event is open for predictions
 * @throws 404 if event not found
 * @throws 400 if event is not open
 */
async function requireEventOpen(eventId: string): Promise<typeof events.$inferSelect> {
  return ensureEventStatus(eventId, 'open', 'modify predictions for a locked or completed event');
}

/**
 * Get event for a match and ensure it's open
 * @throws 404 if match or event not found
 * @throws 400 if event is not open
 */
async function requireMatchEventOpen(
  matchId: string
): Promise<{ match: typeof matches.$inferSelect; event: typeof events.$inferSelect }> {
  return ensureEventStatusForMatch(matchId, 'open', 'modify predictions for a locked or completed event');
}

// ============================================================================
// Match Prediction Input Types
// ============================================================================

export interface CreateMatchPredictionInput {
  matchId: string;
  predictedSide?: number | null;
  predictedParticipantId?: string | null;
}

export interface UpdateMatchPredictionInput {
  predictedSide?: number | null;
  predictedParticipantId?: string | null;
}

export interface ListMatchPredictionsParams {
  eventId?: string;
  matchId?: string;
}

// ============================================================================
// Custom Prediction Input Types
// ============================================================================

export interface CreateCustomPredictionInput {
  eventCustomPredictionId: string;
  predictionTime?: string | Date | null;
  predictionCount?: number | null;
  predictionWrestlerId?: string | null;
  predictionBoolean?: boolean | null;
  predictionText?: string | null;
}

export interface UpdateCustomPredictionInput {
  predictionTime?: string | Date | null;
  predictionCount?: number | null;
  predictionWrestlerId?: string | null;
  predictionBoolean?: boolean | null;
  predictionText?: string | null;
}

export interface ListCustomPredictionsParams {
  eventId?: string;
  eventCustomPredictionId?: string;
}

// ============================================================================
// Contrarian Input Types
// ============================================================================

export interface SetContrarianInput {
  eventId: string;
  isContrarian: boolean;
}

// ============================================================================
// Match Prediction Service
// ============================================================================

export const matchPredictionService = {
  /**
   * Get user's match predictions with optional filtering
   */
  async list(userId: string, params: ListMatchPredictionsParams = {}) {
    const conditions = [eq(matchPredictions.userId, userId)];

    if (params.matchId) {
      conditions.push(eq(matchPredictions.matchId, params.matchId));
    } else if (params.eventId) {
      // Get all matches for the event
      const eventMatches = await db
        .select({ id: matches.id })
        .from(matches)
        .where(eq(matches.eventId, params.eventId));

      const matchIds = eventMatches.map((m) => m.id);

      if (matchIds.length === 0) {
        return [];
      }

      conditions.push(inArray(matchPredictions.matchId, matchIds));
    }

    return db.select().from(matchPredictions).where(and(...conditions));
  },

  /**
   * Get a single match prediction by ID with ownership check
   * @throws 404 if not found or not owned by user
   */
  async getById(id: string, userId: string) {
    return ensureOwnership(matchPredictions, id, userId, 'userId', 'Match prediction');
  },

  /**
   * Create or update a match prediction (upsert)
   * Uses transaction to prevent TOCTOU race condition where event could be
   * locked between status check and prediction write
   * @throws 404 if match or event not found
   * @throws 400 if event is not open
   */
  async createOrUpdate(
    userId: string,
    input: CreateMatchPredictionInput
  ): Promise<typeof matchPredictions.$inferSelect> {
    return withTransaction<typeof matchPredictions.$inferSelect>(async (tx) => {
      // Validate match exists within transaction
      const [match] = await tx.select().from(matches).where(eq(matches.id, input.matchId));
      if (!match) {
        throw apiError('Match not found', 404);
      }

      // Check event and match status WITHIN transaction to prevent TOCTOU
      const [event] = await tx.select().from(events).where(eq(events.id, match.eventId));
      if (!event || event.status === 'completed') {
        throw apiError('Cannot modify predictions for a completed event', 400);
      }

      // Allow predictions on unlocked matches even during locked events (surprise matches)
      if (match.isLocked) {
        throw apiError('Cannot modify predictions for a locked match', 400);
      }

      const { createdAt, updatedAt } = timestamps();

      // Upsert in same transaction
      const [prediction] = await tx
        .insert(matchPredictions)
        .values({
          id: generateId('matchpred'),
          userId,
          matchId: input.matchId,
          predictedSide: input.predictedSide ?? null,
          predictedParticipantId: input.predictedParticipantId ?? null,
          isCorrect: null,
          createdAt,
          updatedAt,
        })
        .onConflictDoUpdate({
          target: [matchPredictions.userId, matchPredictions.matchId],
          set: {
            predictedSide: input.predictedSide ?? null,
            predictedParticipantId: input.predictedParticipantId ?? null,
            ...updatedTimestamp(),
          },
        })
        .returning();

      return prediction;
    });
  },

  /**
   * Update an existing match prediction
   * @throws 404 if not found or not owned
   * @throws 400 if event is not open or no fields to update
   */
  async update(id: string, userId: string, input: UpdateMatchPredictionInput) {
    if (input.predictedSide === undefined && input.predictedParticipantId === undefined) {
      throw apiError('No fields to update', 400);
    }

    // Verify ownership
    const prediction = await ensureOwnership(matchPredictions, id, userId, 'userId', 'Match prediction');

    // Verify event is still open and match is not locked
    const { match } = await requireMatchEventOpen(prediction.matchId);
    if (match.isLocked) {
      throw apiError('Cannot modify predictions for a locked match', 400);
    }

    const [updated] = await db
      .update(matchPredictions)
      .set({
        ...(input.predictedSide !== undefined && { predictedSide: input.predictedSide }),
        ...(input.predictedParticipantId !== undefined && {
          predictedParticipantId: input.predictedParticipantId,
        }),
        ...updatedTimestamp(),
      })
      .where(eq(matchPredictions.id, id))
      .returning();

    return updated;
  },

  /**
   * Delete a match prediction
   * @throws 404 if not found or not owned
   * @throws 400 if event is not open
   */
  async delete(id: string, userId: string) {
    // Verify ownership
    const prediction = await ensureOwnership(matchPredictions, id, userId, 'userId', 'Match prediction');

    // Verify event is still open and match is not locked
    const { match } = await requireMatchEventOpen(prediction.matchId);
    if (match.isLocked) {
      throw apiError('Cannot modify predictions for a locked match', 400);
    }

    await db.delete(matchPredictions).where(eq(matchPredictions.id, id));
  },
};

// ============================================================================
// Custom Prediction Service
// ============================================================================

const PREDICTION_TYPE_FIELD_MAP = {
  time: 'predictionTime',
  count: 'predictionCount',
  wrestler: 'predictionWrestlerId',
  boolean: 'predictionBoolean',
  text: 'predictionText',
} as const satisfies Record<string, keyof CreateCustomPredictionInput>;

type PredictionType = keyof typeof PREDICTION_TYPE_FIELD_MAP;

function isPredictionType(value: string): value is PredictionType {
  return value in PREDICTION_TYPE_FIELD_MAP;
}

const ALL_PREDICTION_FIELDS = [
  'predictionTime',
  'predictionCount',
  'predictionWrestlerId',
  'predictionBoolean',
  'predictionText',
] as const;

type PredictionFieldKey = (typeof ALL_PREDICTION_FIELDS)[number];

// Type that represents input with a specific required field defined
type ValidatedInput<T extends PredictionFieldKey> = CreateCustomPredictionInput &
  Required<Pick<CreateCustomPredictionInput, T>>;

/**
 * Validate that ONLY the correct prediction field is set for the given type
 * Uses TypeScript assertion to provide compile-time guarantee that the required field is set
 * @throws 400 if required field is missing or extra fields are provided
 */
function validatePredictionTypeField<T extends PredictionType>(
  predictionType: T,
  input: CreateCustomPredictionInput
): asserts input is ValidatedInput<(typeof PREDICTION_TYPE_FIELD_MAP)[T]> {
  const requiredField = PREDICTION_TYPE_FIELD_MAP[predictionType];

  // Type-safe access to the input field
  const inputRecord = input as unknown as Record<string, unknown>;

  // Check required field is present (for create operations)
  if (inputRecord[requiredField] === undefined) {
    throw apiError(`${requiredField} is required for ${predictionType} predictions`, 400);
  }

  // Check no OTHER prediction fields are set
  const extraFields = ALL_PREDICTION_FIELDS.filter(
    (f) => f !== requiredField && inputRecord[f] != null
  );

  if (extraFields.length > 0) {
    throw apiError(
      `Invalid fields for ${predictionType} prediction: ${extraFields.join(', ')}`,
      400
    );
  }
}

export const customPredictionService = {
  /**
   * Get user's custom predictions with optional filtering
   */
  async list(userId: string, params: ListCustomPredictionsParams = {}) {
    const conditions = [eq(userCustomPredictions.userId, userId)];

    if (params.eventCustomPredictionId) {
      conditions.push(
        eq(userCustomPredictions.eventCustomPredictionId, params.eventCustomPredictionId)
      );
    } else if (params.eventId) {
      // Get all custom predictions for the event
      const eventPredictions = await db
        .select({ id: eventCustomPredictions.id })
        .from(eventCustomPredictions)
        .where(eq(eventCustomPredictions.eventId, params.eventId));

      const predictionIds = eventPredictions.map((p) => p.id);

      if (predictionIds.length === 0) {
        return [];
      }

      conditions.push(inArray(userCustomPredictions.eventCustomPredictionId, predictionIds));
    }

    return db.select().from(userCustomPredictions).where(and(...conditions));
  },

  /**
   * Get a single custom prediction by ID with ownership check
   * @throws 404 if not found or not owned by user
   */
  async getById(id: string, userId: string) {
    return ensureOwnership(userCustomPredictions, id, userId, 'userId', 'Custom prediction');
  },

  /**
   * Create or update a custom prediction (upsert)
   * Uses transaction to prevent TOCTOU race condition
   * @throws 404 if event custom prediction or event not found
   * @throws 400 if event is not open, wrong field provided, or invalid wrestler ID
   */
  async createOrUpdate(
    userId: string,
    input: CreateCustomPredictionInput
  ): Promise<{ prediction: typeof userCustomPredictions.$inferSelect; isNew: boolean }> {
    // Get event custom prediction with template (outside transaction for validation)
    const [eventPrediction] = await db
      .select({
        eventCustomPrediction: eventCustomPredictions,
        template: customPredictionTemplates,
      })
      .from(eventCustomPredictions)
      .leftJoin(
        customPredictionTemplates,
        eq(eventCustomPredictions.templateId, customPredictionTemplates.id)
      )
      .where(eq(eventCustomPredictions.id, input.eventCustomPredictionId));

    if (!eventPrediction || !eventPrediction.template) {
      throw apiError('Custom prediction not found', 404);
    }

    const predictionType = eventPrediction.template.predictionType;

    // Validate prediction type is known
    if (!isPredictionType(predictionType)) {
      throw apiError(`Unknown prediction type: ${predictionType}`, 400);
    }

    // Validate correct field is provided and no extra fields
    validatePredictionTypeField(predictionType, input);

    // Validate wrestler foreign keys if applicable (multi-select: JSON array of IDs)
    let parsedWrestlerIds: string[] | null = null;
    if (predictionType === 'wrestler' && input.predictionWrestlerId) {
      try {
        parsedWrestlerIds = JSON.parse(input.predictionWrestlerId);
      } catch {
        throw apiError('predictionWrestlerId must be a JSON array of wrestler IDs', 400);
      }
      if (!Array.isArray(parsedWrestlerIds) || parsedWrestlerIds.length === 0) {
        throw apiError('At least one wrestler must be selected', 400);
      }
      for (const wrestlerId of parsedWrestlerIds) {
        await ensureForeignKey(wrestlers, wrestlerId, 'Wrestler');
      }
    }

    // Check wrestler cooldown if template has cooldownDays set
    const cooldownDays = eventPrediction.template.cooldownDays;
    if (predictionType === 'wrestler' && cooldownDays && parsedWrestlerIds) {
      // Get the current event to know its brand and date
      const [currentEvent] = await db
        .select()
        .from(events)
        .where(eq(events.id, eventPrediction.eventCustomPrediction.eventId));

      if (currentEvent) {
        const cutoffMs = currentEvent.eventDate.getTime() - cooldownDays * 24 * 60 * 60 * 1000;
        const cutoffDate = new Date(cutoffMs);

        // Find recent wrestler predictions by this user for the same brand
        const recentPreds = await db
          .select({
            predictionWrestlerId: userCustomPredictions.predictionWrestlerId,
          })
          .from(userCustomPredictions)
          .innerJoin(
            eventCustomPredictions,
            eq(userCustomPredictions.eventCustomPredictionId, eventCustomPredictions.id)
          )
          .innerJoin(events, eq(eventCustomPredictions.eventId, events.id))
          .innerJoin(
            customPredictionTemplates,
            eq(eventCustomPredictions.templateId, customPredictionTemplates.id)
          )
          .where(
            and(
              eq(userCustomPredictions.userId, userId),
              eq(events.brandId, currentEvent.brandId),
              eq(customPredictionTemplates.predictionType, 'wrestler'),
              gte(events.eventDate, cutoffDate),
              // Exclude the current question (allow updating own picks)
              ne(userCustomPredictions.eventCustomPredictionId, input.eventCustomPredictionId)
            )
          );

        // Collect all wrestler IDs from recent predictions
        const recentWrestlerIds = new Set<string>();
        for (const pred of recentPreds) {
          if (pred.predictionWrestlerId) {
            try {
              const ids = JSON.parse(pred.predictionWrestlerId);
              if (Array.isArray(ids)) {
                for (const id of ids) recentWrestlerIds.add(id);
              } else {
                recentWrestlerIds.add(pred.predictionWrestlerId);
              }
            } catch {
              recentWrestlerIds.add(pred.predictionWrestlerId);
            }
          }
        }

        // Check for cooldown violations
        const violations = parsedWrestlerIds.filter((id) => recentWrestlerIds.has(id));
        if (violations.length > 0) {
          // Resolve wrestler names for a clear error message
          const violationRecords = await db
            .select({ id: wrestlers.id, currentName: wrestlers.currentName })
            .from(wrestlers)
            .where(inArray(wrestlers.id, violations));
          const names = violationRecords.map((w) => w.currentName).join(', ');
          throw apiError(
            `Wrestler cooldown: ${names} ${violations.length === 1 ? 'was' : 'were'} already picked within the last ${cooldownDays} days for this brand`,
            400
          );
        }
      }
    }

    // Use transaction to prevent TOCTOU race condition
    return withTransaction<{ prediction: typeof userCustomPredictions.$inferSelect; isNew: boolean }>(async (tx) => {
      // Check event status WITHIN transaction
      const [event] = await tx
        .select()
        .from(events)
        .where(eq(events.id, eventPrediction.eventCustomPrediction.eventId));

      if (!event || event.status === 'completed') {
        throw apiError('Cannot modify predictions for a completed event', 400);
      }

      // Check if prediction already exists
      const [existingPrediction] = await tx
        .select()
        .from(userCustomPredictions)
        .where(
          and(
            eq(userCustomPredictions.userId, userId),
            eq(userCustomPredictions.eventCustomPredictionId, input.eventCustomPredictionId)
          )
        );

      const { createdAt, updatedAt } = timestamps();

      if (existingPrediction) {
        // Update existing prediction
        const [updated] = await tx
          .update(userCustomPredictions)
          .set({
            ...(input.predictionTime !== undefined && {
              predictionTime: input.predictionTime ? new Date(input.predictionTime) : null,
            }),
            ...(input.predictionCount !== undefined && { predictionCount: input.predictionCount }),
            ...(input.predictionWrestlerId !== undefined && {
              predictionWrestlerId: input.predictionWrestlerId,
            }),
            ...(input.predictionBoolean !== undefined && {
              predictionBoolean: input.predictionBoolean,
            }),
            ...(input.predictionText !== undefined && { predictionText: input.predictionText }),
            ...updatedTimestamp(),
          })
          .where(eq(userCustomPredictions.id, existingPrediction.id))
          .returning();

        return { prediction: updated, isNew: false };
      } else {
        // Create new prediction
        const [created] = await tx
          .insert(userCustomPredictions)
          .values({
            id: generateId('custompred'),
            userId,
            eventCustomPredictionId: input.eventCustomPredictionId,
            predictionTime: input.predictionTime ? new Date(input.predictionTime) : null,
            predictionCount: input.predictionCount ?? null,
            predictionWrestlerId: input.predictionWrestlerId ?? null,
            predictionBoolean: input.predictionBoolean ?? null,
            predictionText: input.predictionText ?? null,
            isCorrect: null,
            createdAt,
            updatedAt,
          })
          .returning();

        return { prediction: created, isNew: true };
      }
    });
  },

  /**
   * Update an existing custom prediction
   * @throws 404 if not found or not owned
   * @throws 400 if event is not open, no fields to update, or invalid wrestler ID
   */
  async update(id: string, userId: string, input: UpdateCustomPredictionInput) {
    if (
      input.predictionTime === undefined &&
      input.predictionCount === undefined &&
      input.predictionWrestlerId === undefined &&
      input.predictionBoolean === undefined &&
      input.predictionText === undefined
    ) {
      throw apiError('No fields to update', 400);
    }

    // Validate wrestler foreign keys if provided (multi-select: JSON array of IDs)
    if (input.predictionWrestlerId) {
      let wrestlerIds: string[];
      try {
        wrestlerIds = JSON.parse(input.predictionWrestlerId);
      } catch {
        throw apiError('predictionWrestlerId must be a JSON array of wrestler IDs', 400);
      }
      if (!Array.isArray(wrestlerIds) || wrestlerIds.length === 0) {
        throw apiError('At least one wrestler must be selected', 400);
      }
      for (const wrestlerId of wrestlerIds) {
        await ensureForeignKey(wrestlers, wrestlerId, 'Wrestler');
      }
    }

    // Verify ownership
    const prediction = await ensureOwnership(userCustomPredictions, id, userId, 'userId', 'Custom prediction');

    // Verify event is still open (via event custom prediction)
    const [eventPrediction] = await db
      .select()
      .from(eventCustomPredictions)
      .where(eq(eventCustomPredictions.id, prediction.eventCustomPredictionId));

    if (!eventPrediction) {
      throw apiError('Event custom prediction not found', 404);
    }

    await requireEventOpen(eventPrediction.eventId);

    const [updated] = await db
      .update(userCustomPredictions)
      .set({
        ...(input.predictionTime !== undefined && {
          predictionTime: input.predictionTime ? new Date(input.predictionTime) : null,
        }),
        ...(input.predictionCount !== undefined && { predictionCount: input.predictionCount }),
        ...(input.predictionWrestlerId !== undefined && {
          predictionWrestlerId: input.predictionWrestlerId,
        }),
        ...(input.predictionBoolean !== undefined && { predictionBoolean: input.predictionBoolean }),
        ...(input.predictionText !== undefined && { predictionText: input.predictionText }),
        ...updatedTimestamp(),
      })
      .where(eq(userCustomPredictions.id, id))
      .returning();

    return updated;
  },

  /**
   * Delete a custom prediction
   * @throws 404 if not found or not owned
   * @throws 400 if event is not open
   */
  async delete(id: string, userId: string) {
    // Verify ownership
    const prediction = await ensureOwnership(userCustomPredictions, id, userId, 'userId', 'Custom prediction');

    // Verify event is still open (via event custom prediction)
    const [eventPrediction] = await db
      .select()
      .from(eventCustomPredictions)
      .where(eq(eventCustomPredictions.id, prediction.eventCustomPredictionId));

    if (!eventPrediction) {
      throw apiError('Event custom prediction not found', 404);
    }

    await requireEventOpen(eventPrediction.eventId);

    await db.delete(userCustomPredictions).where(eq(userCustomPredictions.id, id));
  },
};

// ============================================================================
// Contrarian Service
// ============================================================================

export const contrarianService = {
  /**
   * Get user's contrarian records with optional filtering
   */
  async list(userId: string, eventId?: string) {
    const conditions = [eq(userEventJoin.userId, userId)];

    if (eventId) {
      conditions.push(eq(userEventJoin.eventId, eventId));
    }

    return db.select().from(userEventJoin).where(and(...conditions));
  },

  /**
   * Get contrarian status for a specific event
   */
  async getForEvent(userId: string, eventId: string) {
    const [record] = await db
      .select()
      .from(userEventJoin)
      .where(and(eq(userEventJoin.userId, userId), eq(userEventJoin.eventId, eventId)));

    if (!record) {
      return { isContrarian: false, didWinContrarian: null };
    }

    return record;
  },

  /**
   * Enable or update contrarian mode for an event
   * @throws 404 if event not found
   * @throws 400 if event is not open or user has already made predictions
   */
  async setStatus(
    userId: string,
    input: SetContrarianInput
  ): Promise<{ record: typeof userEventJoin.$inferSelect; isNew: boolean }> {
    return withTransaction(async (tx) => {
      // Verify event exists and is open (INSIDE transaction to prevent TOCTOU)
      const [event] = await tx
        .select()
        .from(events)
        .where(eq(events.id, input.eventId))
        .limit(1);

      if (!event) {
        throw apiError('Event not found', 404);
      }

      if (event.status !== 'open') {
        throw apiError('Event is not open', 400);
      }

      // If enabling contrarian mode, verify user hasn't made any predictions yet
      if (input.isContrarian) {
        const eventMatches = await tx
          .select({ id: matches.id })
          .from(matches)
          .where(eq(matches.eventId, input.eventId));

        const matchIds = eventMatches.map((m) => m.id);

        if (matchIds.length > 0) {
          const existingPredictions = await tx
            .select({ id: matchPredictions.id })
            .from(matchPredictions)
            .where(
              and(eq(matchPredictions.userId, userId), inArray(matchPredictions.matchId, matchIds))
            );

          if (existingPredictions.length > 0) {
            throw apiError('Cannot enable contrarian mode after making predictions', 400);
          }
        }
      }

      // Check if contrarian record already exists
      const [existingRecord] = await tx
        .select()
        .from(userEventJoin)
        .where(
          and(eq(userEventJoin.userId, userId), eq(userEventJoin.eventId, input.eventId))
        );

      const { createdAt, updatedAt } = timestamps();

      if (existingRecord) {
        // Update existing record
        const [updated] = await tx
          .update(userEventJoin)
          .set({
            mode: input.isContrarian ? 'contrarian' : 'normal',
            ...updatedTimestamp(),
          })
          .where(eq(userEventJoin.id, existingRecord.id))
          .returning();

        return { record: updated, isNew: false };
      } else {
        // Create new record
        const [created] = await tx
          .insert(userEventJoin)
          .values({
            id: generateId('usereventjoin'),
            userId,
            eventId: input.eventId,
            mode: input.isContrarian ? 'contrarian' : 'normal',
            didWinContrarian: null,
            createdAt,
            updatedAt,
          })
          .returning();

        return { record: created, isNew: true };
      }
    });
  },

  /**
   * Delete contrarian record for an event
   * @throws 404 if record not found
   */
  async delete(userId: string, eventId: string) {
    const [deletedRecord] = await db
      .delete(userEventJoin)
      .where(
        and(eq(userEventJoin.userId, userId), eq(userEventJoin.eventId, eventId))
      )
      .returning();

    if (!deletedRecord) {
      throw apiError('Contrarian record not found', 404);
    }

    return deletedRecord;
  },
};
