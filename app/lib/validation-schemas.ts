import { z } from 'zod';

// ============================================================================
// Common Schemas
// ============================================================================

export const timestampSchema = z.union([z.string().datetime(), z.date(), z.coerce.date()]);

export const eventStatusSchema = z.enum(['open', 'locked', 'completed']);
export const matchOutcomeSchema = z.enum(['winner', 'draw', 'no_contest']);
export const participantTypeSchema = z.enum(['wrestler', 'tag_team']);
export const predictionTypeSchema = z.enum(['time', 'count', 'wrestler', 'boolean', 'text']);

// ============================================================================
// Brand Schemas
// ============================================================================

export const createBrandSchema = z.object({
  name: z.string().min(1, 'Brand name is required').max(100, 'Brand name too long'),
});

export const updateBrandSchema = z.object({
  name: z.string().min(1).max(100).optional(),
});

export const brandQuerySchema = z.object({});

// ============================================================================
// Wrestler Schemas
// ============================================================================

export const createWrestlerSchema = z.object({
  currentName: z.string().min(1, 'Wrestler name is required').max(100),
  brandId: z.string().min(1, 'Brand ID is required'),
  isActive: z.boolean().optional(),
});

export const updateWrestlerSchema = z.object({
  currentName: z.string().min(1).max(100).optional(),
  brandId: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});

export const wrestlerQuerySchema = z.object({
  brandId: z.string().optional(),
  isActive: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
});

// ============================================================================
// Tag Team Schemas
// ============================================================================

export const createTagTeamSchema = z.object({
  name: z.string().min(1, 'Tag team name is required').max(100),
  brandId: z.string().min(1, 'Brand ID is required'),
  isActive: z.boolean().optional(),
  memberIds: z.array(z.string().min(1)).optional(),
});

export const updateTagTeamSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  brandId: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});

export const tagTeamQuerySchema = z.object({
  brandId: z.string().optional(),
  isActive: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  includeMembers: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
});

export const addTagTeamMemberSchema = z.object({
  wrestlerId: z.string().min(1, 'Wrestler ID is required'),
  joinedAt: timestampSchema.optional(),
});

export const updateTagTeamMemberSchema = z.object({
  leftAt: timestampSchema.nullable().optional(),
});

// ============================================================================
// Championship Schemas
// ============================================================================

export const createChampionshipSchema = z.object({
  name: z.string().min(1, 'Championship name is required').max(100),
  brandId: z.string().min(1, 'Brand ID is required'),
  isActive: z.boolean().optional(),
});

export const updateChampionshipSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  brandId: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});

export const championshipQuerySchema = z.object({
  brandId: z.string().optional(),
  isActive: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
});

// ============================================================================
// Event Schemas
// ============================================================================

export const createEventSchema = z.object({
  name: z.string().min(1, 'Event name is required').max(200),
  brandId: z.string().min(1, 'Brand ID is required'),
  eventDate: timestampSchema,
  status: eventStatusSchema.optional(),
});

export const updateEventSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  brandId: z.string().min(1).optional(),
  eventDate: timestampSchema.optional(),
  status: eventStatusSchema.optional(),
});

export const eventQuerySchema = z.object({
  brandId: z.string().optional(),
  status: eventStatusSchema.optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  includeMatches: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
});

export const eventDetailQuerySchema = z.object({
  includeMatches: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  includeCustomPredictions: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
});

// ============================================================================
// Match Schemas
// ============================================================================

export const matchParticipantSchema = z.object({
  side: z.number().int().positive().nullable(),
  participantType: participantTypeSchema,
  participantId: z.string().min(1),
  entryOrder: z.number().int().positive().nullable().optional(),
});

export const matchChampionshipSchema = z.object({
  championshipId: z.string().min(1),
  participantType: participantTypeSchema,
  participantId: z.string().min(1),
});

export const createMatchSchema = z.object({
  eventId: z.string().min(1, 'Event ID is required'),
  matchType: z.string().min(1).max(100),
  matchOrder: z.number().int().positive(),
  participants: z.array(matchParticipantSchema).min(2, 'At least 2 participants required'),
  championships: z.array(matchChampionshipSchema).optional(),
});

export const updateMatchSchema = z.object({
  matchType: z.string().min(1).max(100).optional(),
  matchOrder: z.number().int().positive().optional(),
  outcome: matchOutcomeSchema.nullable().optional(),
  winningSide: z.number().int().positive().nullable().optional(),
  winnerParticipantId: z.string().min(1).nullable().optional(),
});

export const addMatchParticipantSchema = z.object({
  side: z.number().int().positive().nullable(),
  participantType: participantTypeSchema,
  participantId: z.string().min(1),
  entryOrder: z.number().int().positive().nullable().optional(),
});

export const updateMatchParticipantSchema = z.object({
  side: z.number().int().positive().nullable().optional(),
  participantType: participantTypeSchema.optional(),
  participantId: z.string().min(1).optional(),
  entryOrder: z.number().int().positive().nullable().optional(),
});

// ============================================================================
// Custom Prediction Template Schemas
// ============================================================================

export const createCustomPredictionTemplateSchema = z.object({
  name: z.string().min(1, 'Template name is required').max(100),
  description: z.string().max(500).nullable().optional(),
  predictionType: predictionTypeSchema,
});

export const updateCustomPredictionTemplateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  predictionType: predictionTypeSchema.optional(),
});

// ============================================================================
// Event Custom Prediction Schemas
// ============================================================================

export const createEventCustomPredictionSchema = z.object({
  templateId: z.string().min(1, 'Template ID is required'),
  question: z.string().min(1, 'Question is required').max(500),
  answerTime: timestampSchema.nullable().optional(),
  answerCount: z.number().int().nullable().optional(),
  answerWrestlerId: z.string().min(1).nullable().optional(),
  answerBoolean: z.boolean().nullable().optional(),
  answerText: z.string().max(200).nullable().optional(),
  isScored: z.boolean().optional(),
});

export const updateEventCustomPredictionSchema = z.object({
  question: z.string().min(1).max(500).optional(),
  answerTime: timestampSchema.nullable().optional(),
  answerCount: z.number().int().nullable().optional(),
  answerWrestlerId: z.string().min(1).nullable().optional(),
  answerBoolean: z.boolean().nullable().optional(),
  answerText: z.string().max(200).nullable().optional(),
  isScored: z.boolean().optional(),
});

// ============================================================================
// Match Prediction Schemas
// ============================================================================

export const createMatchPredictionSchema = z
  .object({
    matchId: z.string().min(1, 'Match ID is required'),
    predictedSide: z.number().int().positive().nullable().optional(),
    predictedParticipantId: z.string().min(1).nullable().optional(),
  })
  .refine(
    (data) =>
      (data.predictedSide !== null && data.predictedSide !== undefined) ||
      (data.predictedParticipantId !== null && data.predictedParticipantId !== undefined),
    { message: 'Either predictedSide or predictedParticipantId must be provided' }
  )
  .refine(
    (data) =>
      !(
        data.predictedSide !== null &&
        data.predictedSide !== undefined &&
        data.predictedParticipantId
      ),
    { message: 'Cannot provide both predictedSide and predictedParticipantId' }
  );

export const updateMatchPredictionSchema = z
  .object({
    predictedSide: z.number().int().positive().nullable().optional(),
    predictedParticipantId: z.string().min(1).nullable().optional(),
  })
  .refine(
    (data) =>
      !(
        data.predictedSide !== null &&
        data.predictedSide !== undefined &&
        data.predictedParticipantId
      ),
    { message: 'Cannot provide both predictedSide and predictedParticipantId' }
  );

export const matchPredictionQuerySchema = z.object({
  matchIds: z.string().optional(), // Comma-separated list
  userId: z.string().optional(),
});

// ============================================================================
// Custom Prediction Schemas
// ============================================================================

export const createUserCustomPredictionSchema = z.object({
  eventCustomPredictionId: z.string().min(1, 'Event custom prediction ID is required'),
  predictionTime: timestampSchema.nullable().optional(),
  predictionCount: z.number().int().nullable().optional(),
  predictionWrestlerId: z.string().min(1).nullable().optional(),
  predictionBoolean: z.boolean().nullable().optional(),
  predictionText: z.string().max(200).nullable().optional(),
});

export const updateUserCustomPredictionSchema = z.object({
  predictionTime: timestampSchema.nullable().optional(),
  predictionCount: z.number().int().nullable().optional(),
  predictionWrestlerId: z.string().min(1).nullable().optional(),
  predictionBoolean: z.boolean().nullable().optional(),
  predictionText: z.string().max(200).nullable().optional(),
});

export const userCustomPredictionQuerySchema = z.object({
  eventId: z.string().optional(),
  predictionIds: z.string().optional(), // Comma-separated list
});

// ============================================================================
// Contrarian Mode Schemas
// ============================================================================

export const createContrarianSchema = z.object({
  eventId: z.string().min(1, 'Event ID is required'),
  isContrarian: z.boolean(),
});

export const updateContrarianSchema = z.object({
  isContrarian: z.boolean(),
});

// ============================================================================
// Score Query Schemas
// ============================================================================

export const scoreQuerySchema = z.object({
  userId: z.string().optional(),
});
