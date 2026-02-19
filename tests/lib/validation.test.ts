/**
 * Tests for validation schemas and helpers
 */

import { describe, test, expect } from 'bun:test';
import {
  createMatchPredictionSchema,
  createBrandSchema,
  createEventSchema,
  createWrestlerSchema,
  matchParticipantSchema,
  createUserCustomPredictionSchema,
  eventStatusSchema,
  predictionTypeSchema,
} from '../../app/lib/validation-schemas';

describe('Validation Schemas', () => {
  describe('Brand Schema', () => {
    test('should validate a valid brand', () => {
      const result = createBrandSchema.safeParse({ name: 'WWE' });
      expect(result.success).toBe(true);
    });

    test('should reject empty brand name', () => {
      const result = createBrandSchema.safeParse({ name: '' });
      expect(result.success).toBe(false);
    });

    test('should sanitize brand name', () => {
      const result = createBrandSchema.safeParse({ name: '  WWE  ' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('WWE');
      }
    });

    test('should reject name longer than 100 characters', () => {
      const result = createBrandSchema.safeParse({ name: 'a'.repeat(101) });
      expect(result.success).toBe(false);
    });
  });

  describe('Event Status Schema', () => {
    test('should accept valid statuses', () => {
      expect(eventStatusSchema.safeParse('open').success).toBe(true);
      expect(eventStatusSchema.safeParse('locked').success).toBe(true);
      expect(eventStatusSchema.safeParse('completed').success).toBe(true);
    });

    test('should reject invalid statuses', () => {
      expect(eventStatusSchema.safeParse('cancelled').success).toBe(false);
      expect(eventStatusSchema.safeParse('active').success).toBe(false);
      expect(eventStatusSchema.safeParse('').success).toBe(false);
    });
  });

  describe('Prediction Type Schema', () => {
    test('should accept valid prediction types', () => {
      expect(predictionTypeSchema.safeParse('time').success).toBe(true);
      expect(predictionTypeSchema.safeParse('count').success).toBe(true);
      expect(predictionTypeSchema.safeParse('wrestler').success).toBe(true);
      expect(predictionTypeSchema.safeParse('boolean').success).toBe(true);
      expect(predictionTypeSchema.safeParse('text').success).toBe(true);
    });

    test('should reject invalid prediction types', () => {
      expect(predictionTypeSchema.safeParse('number').success).toBe(false);
      expect(predictionTypeSchema.safeParse('date').success).toBe(false);
    });
  });

  describe('Event Schema', () => {
    test('should validate a valid event', () => {
      const result = createEventSchema.safeParse({
        name: 'WrestleMania',
        brandId: 'brand_123',
        eventDate: '2024-04-06T00:00:00.000Z',
      });
      expect(result.success).toBe(true);
    });

    test('should reject event without name', () => {
      const result = createEventSchema.safeParse({
        brandId: 'brand_123',
        eventDate: '2024-04-06T00:00:00.000Z',
      });
      expect(result.success).toBe(false);
    });

    test('should accept optional status', () => {
      const result = createEventSchema.safeParse({
        name: 'WrestleMania',
        brandId: 'brand_123',
        eventDate: '2024-04-06T00:00:00.000Z',
        status: 'locked',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('locked');
      }
    });
  });

  describe('Wrestler Schema', () => {
    test('should validate a valid wrestler', () => {
      const result = createWrestlerSchema.safeParse({
        currentName: 'John Cena',
        brandId: 'brand_123',
      });
      expect(result.success).toBe(true);
    });

    test('should accept optional isActive', () => {
      const result = createWrestlerSchema.safeParse({
        currentName: 'John Cena',
        brandId: 'brand_123',
        isActive: false,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isActive).toBe(false);
      }
    });
  });

  describe('Match Prediction Schema', () => {
    test('should accept prediction with predictedSide', () => {
      const result = createMatchPredictionSchema.safeParse({
        matchId: 'match_123',
        predictedSide: 1,
      });
      expect(result.success).toBe(true);
    });

    test('should accept prediction with predictedParticipantId', () => {
      const result = createMatchPredictionSchema.safeParse({
        matchId: 'match_123',
        predictedParticipantId: 'participant_456',
      });
      expect(result.success).toBe(true);
    });

    test('should reject prediction without matchId', () => {
      const result = createMatchPredictionSchema.safeParse({
        predictedSide: 1,
      });
      expect(result.success).toBe(false);
    });

    test('should reject prediction without side or participant', () => {
      const result = createMatchPredictionSchema.safeParse({
        matchId: 'match_123',
      });
      expect(result.success).toBe(false);
    });

    test('should reject prediction with both side and participant', () => {
      const result = createMatchPredictionSchema.safeParse({
        matchId: 'match_123',
        predictedSide: 1,
        predictedParticipantId: 'participant_456',
      });
      expect(result.success).toBe(false);
    });

    test('should accept prediction with null side when participant provided', () => {
      const result = createMatchPredictionSchema.safeParse({
        matchId: 'match_123',
        predictedSide: null,
        predictedParticipantId: 'participant_456',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('Match Participant Schema', () => {
    test('should validate wrestler participant', () => {
      const result = matchParticipantSchema.safeParse({
        side: 1,
        participantType: 'wrestler',
        participantId: 'wrestler_123',
      });
      expect(result.success).toBe(true);
    });

    test('should validate group participant', () => {
      const result = matchParticipantSchema.safeParse({
        side: 2,
        participantType: 'group',
        participantId: 'group_456',
      });
      expect(result.success).toBe(true);
    });

    test('should accept null side for free-for-all matches', () => {
      const result = matchParticipantSchema.safeParse({
        side: null,
        participantType: 'wrestler',
        participantId: 'wrestler_123',
      });
      expect(result.success).toBe(true);
    });

    test('should accept optional entryOrder', () => {
      const result = matchParticipantSchema.safeParse({
        side: null,
        participantType: 'wrestler',
        participantId: 'wrestler_123',
        entryOrder: 15,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.entryOrder).toBe(15);
      }
    });

    test('should reject invalid participant type', () => {
      const result = matchParticipantSchema.safeParse({
        side: 1,
        participantType: 'stable',
        participantId: 'stable_123',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('User Custom Prediction Schema', () => {
    test('should validate time prediction', () => {
      const result = createUserCustomPredictionSchema.safeParse({
        eventCustomPredictionId: 'eventcustompred_123',
        predictionTime: '2024-04-06T20:30:00.000Z',
      });
      expect(result.success).toBe(true);
    });

    test('should validate count prediction', () => {
      const result = createUserCustomPredictionSchema.safeParse({
        eventCustomPredictionId: 'eventcustompred_123',
        predictionCount: 5,
      });
      expect(result.success).toBe(true);
    });

    test('should validate wrestler prediction', () => {
      const result = createUserCustomPredictionSchema.safeParse({
        eventCustomPredictionId: 'eventcustompred_123',
        predictionWrestlerId: 'wrestler_456',
      });
      expect(result.success).toBe(true);
    });

    test('should validate boolean prediction', () => {
      const result = createUserCustomPredictionSchema.safeParse({
        eventCustomPredictionId: 'eventcustompred_123',
        predictionBoolean: true,
      });
      expect(result.success).toBe(true);
    });

    test('should validate text prediction', () => {
      const result = createUserCustomPredictionSchema.safeParse({
        eventCustomPredictionId: 'eventcustompred_123',
        predictionText: 'John Cena',
      });
      expect(result.success).toBe(true);
    });

    test('should reject missing eventCustomPredictionId', () => {
      const result = createUserCustomPredictionSchema.safeParse({
        predictionCount: 5,
      });
      expect(result.success).toBe(false);
    });

    test('should accept multiple prediction fields', () => {
      // Note: The schema allows this, but the service validates that only one is set
      const result = createUserCustomPredictionSchema.safeParse({
        eventCustomPredictionId: 'eventcustompred_123',
        predictionCount: 5,
        predictionBoolean: true,
      });
      expect(result.success).toBe(true);
    });
  });
});
