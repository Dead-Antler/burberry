/**
 * Tests for prediction mutation API routes
 * Verifies create/update prediction business rules
 */

import { describe, test, expect, beforeAll, beforeEach, mock } from 'bun:test';
import { NextRequest } from 'next/server';
import { setupTestDb, clearTestDb } from '../helpers/db';
import {
  createUser,
  createBrand,
  createEvent,
  createMatch,
  createWrestler,
  createMatchParticipant,
} from '../helpers/fixtures';

// Mock next/headers to return controllable headers
let mockHeaders = new Headers();
mock.module('next/headers', () => ({
  headers: async () => mockHeaders,
}));

// Mock auth.api.getSession to return controllable session data
let mockSession: unknown = null;
mock.module('@/app/lib/auth', () => ({
  auth: {
    api: {
      getSession: async () => mockSession,
    },
  },
}));

// Import route handlers after mocking
const { POST: postPrediction, GET: getPredictions } = await import(
  '@/app/api/predictions/matches/route'
);

function makeRequest(url: string, options?: ConstructorParameters<typeof NextRequest>[1]): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'), options);
}

function setSession(user: { id: string; email: string; role?: string }) {
  mockSession = {
    session: {
      id: 'sess_test',
      userId: user.id,
      token: 'test-token',
      expiresAt: new Date(Date.now() + 86400000),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    user: {
      id: user.id,
      name: 'Test User',
      email: user.email,
      emailVerified: false,
      image: null,
      role: user.role ?? 'user',
      banned: false,
      banReason: null,
      banExpires: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };
}

function clearSession() {
  mockSession = null;
}

describe('Prediction Mutations API', () => {
  beforeAll(async () => {
    await setupTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
    clearSession();
    mockHeaders = new Headers();
  });

  describe('POST /api/predictions/matches', () => {
    test('creates a match prediction (happy path)', async () => {
      const brand = await createBrand();
      const user = await createUser();
      const event = await createEvent(brand.id, { status: 'open' });
      const match = await createMatch(event.id);
      const w1 = await createWrestler(brand.id);
      const w2 = await createWrestler(brand.id);
      await createMatchParticipant(match.id, w1.id, 'wrestler', { side: 1 });
      await createMatchParticipant(match.id, w2.id, 'wrestler', { side: 2 });

      setSession({ id: user.id, email: user.email });

      const req = makeRequest('http://localhost:3000/api/predictions/matches', {
        method: 'POST',
        body: JSON.stringify({
          matchId: match.id,
          predictedSide: 1,
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const res = await postPrediction(req);

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.matchId).toBe(match.id);
      expect(body.predictedSide).toBe(1);
      expect(body.userId).toBe(user.id);
    });

    test('rejects prediction when event is completed', async () => {
      const brand = await createBrand();
      const user = await createUser();
      const event = await createEvent(brand.id, { status: 'completed' });
      const match = await createMatch(event.id);

      setSession({ id: user.id, email: user.email });

      const req = makeRequest('http://localhost:3000/api/predictions/matches', {
        method: 'POST',
        body: JSON.stringify({
          matchId: match.id,
          predictedSide: 1,
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const res = await postPrediction(req);

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('completed');
    });

    test('rejects prediction when match is locked', async () => {
      const brand = await createBrand();
      const user = await createUser();
      const event = await createEvent(brand.id, { status: 'open' });
      const match = await createMatch(event.id, { isLocked: true });

      setSession({ id: user.id, email: user.email });

      const req = makeRequest('http://localhost:3000/api/predictions/matches', {
        method: 'POST',
        body: JSON.stringify({
          matchId: match.id,
          predictedSide: 1,
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const res = await postPrediction(req);

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('locked');
    });

    test('rejects prediction for non-existent match', async () => {
      const user = await createUser();
      setSession({ id: user.id, email: user.email });

      const req = makeRequest('http://localhost:3000/api/predictions/matches', {
        method: 'POST',
        body: JSON.stringify({
          matchId: 'nonexistent_match_id',
          predictedSide: 1,
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const res = await postPrediction(req);

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toContain('not found');
    });

    test('rejects prediction with invalid body (missing required fields)', async () => {
      const user = await createUser();
      setSession({ id: user.id, email: user.email });

      const req = makeRequest('http://localhost:3000/api/predictions/matches', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      });

      const res = await postPrediction(req);

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('Validation failed');
    });

    test('updates existing prediction (upsert behavior)', async () => {
      const brand = await createBrand();
      const user = await createUser();
      const event = await createEvent(brand.id, { status: 'open' });
      const match = await createMatch(event.id);
      const w1 = await createWrestler(brand.id);
      const w2 = await createWrestler(brand.id);
      await createMatchParticipant(match.id, w1.id, 'wrestler', { side: 1 });
      await createMatchParticipant(match.id, w2.id, 'wrestler', { side: 2 });

      setSession({ id: user.id, email: user.email });

      // First prediction
      const req1 = makeRequest('http://localhost:3000/api/predictions/matches', {
        method: 'POST',
        body: JSON.stringify({ matchId: match.id, predictedSide: 1 }),
        headers: { 'Content-Type': 'application/json' },
      });
      const res1 = await postPrediction(req1);
      expect(res1.status).toBe(201);

      // Update prediction
      const req2 = makeRequest('http://localhost:3000/api/predictions/matches', {
        method: 'POST',
        body: JSON.stringify({ matchId: match.id, predictedSide: 2 }),
        headers: { 'Content-Type': 'application/json' },
      });
      const res2 = await postPrediction(req2);
      expect(res2.status).toBe(201);
      const body2 = await res2.json();
      expect(body2.predictedSide).toBe(2);
    });
  });

  describe('GET /api/predictions/matches', () => {
    test('returns user predictions filtered by eventId', async () => {
      const brand = await createBrand();
      const user = await createUser();
      const event = await createEvent(brand.id, { status: 'open' });
      const match = await createMatch(event.id);

      // Create prediction via the service (bypassing route)
      setSession({ id: user.id, email: user.email });

      const createReq = makeRequest('http://localhost:3000/api/predictions/matches', {
        method: 'POST',
        body: JSON.stringify({ matchId: match.id, predictedSide: 1 }),
        headers: { 'Content-Type': 'application/json' },
      });
      await postPrediction(createReq);

      // Fetch predictions for the event
      const getReq = makeRequest(
        `http://localhost:3000/api/predictions/matches?eventId=${event.id}`
      );
      const res = await getPredictions(getReq);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(1);
      expect(body[0].matchId).toBe(match.id);
    });

    test('returns empty array when no predictions exist', async () => {
      const user = await createUser();
      setSession({ id: user.id, email: user.email });

      const req = makeRequest(
        'http://localhost:3000/api/predictions/matches?eventId=nonexistent'
      );
      const res = await getPredictions(req);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(0);
    });
  });
});
