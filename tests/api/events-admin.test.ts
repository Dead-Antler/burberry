/**
 * Tests for Event Admin CRUD endpoints
 * PATCH /api/events/:id (status transitions, updates)
 * DELETE /api/events/:id (cascade delete)
 * POST /api/events/:id/score (scoring)
 */

import { describe, test, expect, beforeAll, beforeEach, mock } from 'bun:test';
import { NextRequest } from 'next/server';
import { setupTestDb, clearTestDb, getTestDb, schema } from '../helpers/db';
import {
  createUser,
  createBrand,
  createEvent,
  createMatch,
  createMatchParticipant,
  createMatchPrediction,
  createWrestler,
  joinEvent,
} from '../helpers/fixtures';
import { eq } from 'drizzle-orm';

// Mock next/headers
let mockHeaders = new Headers();
mock.module('next/headers', () => ({
  headers: async () => mockHeaders,
}));

// Mock auth
let mockSession: unknown = null;
mock.module('@/app/lib/auth', () => ({
  auth: {
    api: {
      getSession: async () => mockSession,
    },
  },
}));

// Import route handlers after mocking
const { PATCH, DELETE } = await import('@/app/api/events/[id]/route');
const { POST: scoreEvent } = await import('@/app/api/events/[id]/score/route');

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

function patchEvent(id: string, body: unknown) {
  return PATCH(
    makeRequest(`http://localhost:3000/api/events/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    }),
    { params: Promise.resolve({ id }) }
  );
}

function deleteEvent(id: string) {
  return DELETE(
    makeRequest(`http://localhost:3000/api/events/${id}`, { method: 'DELETE' }),
    { params: Promise.resolve({ id }) }
  );
}

function postScore(id: string) {
  return scoreEvent(
    makeRequest(`http://localhost:3000/api/events/${id}/score`, { method: 'POST' }),
    { params: Promise.resolve({ id }) }
  );
}

describe('Event Admin CRUD', () => {
  beforeAll(async () => {
    await setupTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
    clearSession();
    mockHeaders = new Headers();
  });

  // =========================================================================
  // PATCH /api/events/:id - Status Transitions
  // =========================================================================
  describe('PATCH /api/events/:id - status transitions', () => {
    test('pending -> open (200)', async () => {
      const admin = await createUser({ role: 'admin' });
      setSession({ id: admin.id, email: admin.email, role: 'admin' });

      const brand = await createBrand();
      const event = await createEvent(brand.id, { status: 'pending' });

      const res = await patchEvent(event.id, { status: 'open' });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe('open');
    });

    test('open -> locked (200)', async () => {
      const admin = await createUser({ role: 'admin' });
      setSession({ id: admin.id, email: admin.email, role: 'admin' });

      const brand = await createBrand();
      const event = await createEvent(brand.id, { status: 'open' });

      const res = await patchEvent(event.id, { status: 'locked' });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe('locked');
    });

    test('locked -> completed (200)', async () => {
      const admin = await createUser({ role: 'admin' });
      setSession({ id: admin.id, email: admin.email, role: 'admin' });

      const brand = await createBrand();
      const event = await createEvent(brand.id, { status: 'locked' });

      const res = await patchEvent(event.id, { status: 'completed' });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe('completed');
    });

    test('open -> completed is invalid (400)', async () => {
      const admin = await createUser({ role: 'admin' });
      setSession({ id: admin.id, email: admin.email, role: 'admin' });

      const brand = await createBrand();
      const event = await createEvent(brand.id, { status: 'open' });

      const res = await patchEvent(event.id, { status: 'completed' });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('Cannot transition');
    });

    test('locked -> open is invalid (400)', async () => {
      const admin = await createUser({ role: 'admin' });
      setSession({ id: admin.id, email: admin.email, role: 'admin' });

      const brand = await createBrand();
      const event = await createEvent(brand.id, { status: 'locked' });

      const res = await patchEvent(event.id, { status: 'open' });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('Cannot transition');
    });

    test('completed -> any is invalid (400)', async () => {
      const admin = await createUser({ role: 'admin' });
      setSession({ id: admin.id, email: admin.email, role: 'admin' });

      const brand = await createBrand();
      const event = await createEvent(brand.id, { status: 'completed' });

      const res = await patchEvent(event.id, { status: 'open' });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('Cannot transition');
    });

    test('locking event sets all matches to isLocked=true', async () => {
      const admin = await createUser({ role: 'admin' });
      setSession({ id: admin.id, email: admin.email, role: 'admin' });

      const brand = await createBrand();
      const event = await createEvent(brand.id, { status: 'open' });
      const match1 = await createMatch(event.id, { isLocked: false, matchOrder: 1 });
      const match2 = await createMatch(event.id, { isLocked: false, matchOrder: 2 });

      const res = await patchEvent(event.id, { status: 'locked' });
      expect(res.status).toBe(200);

      // Verify matches are now locked
      const db = getTestDb();
      const [m1] = await db.select().from(schema.matches).where(eq(schema.matches.id, match1.id));
      const [m2] = await db.select().from(schema.matches).where(eq(schema.matches.id, match2.id));

      expect(m1.isLocked).toBe(true);
      expect(m2.isLocked).toBe(true);
    });
  });

  // =========================================================================
  // PATCH /api/events/:id - Updates
  // =========================================================================
  describe('PATCH /api/events/:id - field updates', () => {
    test('updates name (200)', async () => {
      const admin = await createUser({ role: 'admin' });
      setSession({ id: admin.id, email: admin.email, role: 'admin' });

      const brand = await createBrand();
      const event = await createEvent(brand.id, { name: 'Old Name' });

      const res = await patchEvent(event.id, { name: 'New Name' });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.name).toBe('New Name');
    });

    test('returns 401 when unauthenticated', async () => {
      const brand = await createBrand();
      const event = await createEvent(brand.id);

      const res = await patchEvent(event.id, { name: 'Updated' });

      expect(res.status).toBe(401);
    });

    test('returns 403 for non-admin', async () => {
      const user = await createUser({ role: 'user' });
      setSession({ id: user.id, email: user.email, role: 'user' });

      const brand = await createBrand();
      const event = await createEvent(brand.id);

      const res = await patchEvent(event.id, { name: 'Updated' });

      expect(res.status).toBe(403);
    });

    test('returns 404 for non-existent event', async () => {
      const admin = await createUser({ role: 'admin' });
      setSession({ id: admin.id, email: admin.email, role: 'admin' });

      const res = await patchEvent('event_nonexistent', { name: 'Updated' });

      expect(res.status).toBe(404);
    });

    test('returns 400 for empty body', async () => {
      const admin = await createUser({ role: 'admin' });
      setSession({ id: admin.id, email: admin.email, role: 'admin' });

      const brand = await createBrand();
      const event = await createEvent(brand.id);

      const res = await patchEvent(event.id, {});

      expect(res.status).toBe(400);
    });

    test('returns 400 for invalid brandId', async () => {
      const admin = await createUser({ role: 'admin' });
      setSession({ id: admin.id, email: admin.email, role: 'admin' });

      const brand = await createBrand();
      const event = await createEvent(brand.id);

      const res = await patchEvent(event.id, { brandId: 'brand_nonexistent' });

      expect(res.status).toBe(400);
    });
  });

  // =========================================================================
  // DELETE /api/events/:id
  // =========================================================================
  describe('DELETE /api/events/:id', () => {
    test('deletes an event (200)', async () => {
      const admin = await createUser({ role: 'admin' });
      setSession({ id: admin.id, email: admin.email, role: 'admin' });

      const brand = await createBrand();
      const event = await createEvent(brand.id);

      const res = await deleteEvent(event.id);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.message).toContain('deleted');
    });

    test('cascade deletes matches and predictions', async () => {
      const admin = await createUser({ role: 'admin' });
      setSession({ id: admin.id, email: admin.email, role: 'admin' });

      const brand = await createBrand();
      const wrestler1 = await createWrestler(brand.id);
      const wrestler2 = await createWrestler(brand.id);
      const event = await createEvent(brand.id);
      const match = await createMatch(event.id);
      await createMatchParticipant(match.id, wrestler1.id, 'wrestler', { side: 1 });
      await createMatchParticipant(match.id, wrestler2.id, 'wrestler', { side: 2 });
      const user = await createUser();
      await createMatchPrediction(user.id, match.id, { predictedSide: 1 });

      const res = await deleteEvent(event.id);
      expect(res.status).toBe(200);

      // Verify cascade: matches, participants, predictions are gone
      const db = getTestDb();
      const remainingMatches = await db.select().from(schema.matches).where(eq(schema.matches.eventId, event.id));
      const remainingPredictions = await db.select().from(schema.matchPredictions).where(eq(schema.matchPredictions.matchId, match.id));
      const remainingParticipants = await db.select().from(schema.matchParticipants).where(eq(schema.matchParticipants.matchId, match.id));

      expect(remainingMatches).toHaveLength(0);
      expect(remainingPredictions).toHaveLength(0);
      expect(remainingParticipants).toHaveLength(0);
    });

    test('returns 401 when unauthenticated', async () => {
      const brand = await createBrand();
      const event = await createEvent(brand.id);

      const res = await deleteEvent(event.id);

      expect(res.status).toBe(401);
    });

    test('returns 403 for non-admin', async () => {
      const user = await createUser({ role: 'user' });
      setSession({ id: user.id, email: user.email, role: 'user' });

      const brand = await createBrand();
      const event = await createEvent(brand.id);

      const res = await deleteEvent(event.id);

      expect(res.status).toBe(403);
    });

    test('returns 404 for non-existent event', async () => {
      const admin = await createUser({ role: 'admin' });
      setSession({ id: admin.id, email: admin.email, role: 'admin' });

      const res = await deleteEvent('event_nonexistent');

      expect(res.status).toBe(404);
    });
  });

  // =========================================================================
  // POST /api/events/:id/score
  // =========================================================================
  describe('POST /api/events/:id/score', () => {
    test('scores a completed event (200)', async () => {
      const admin = await createUser({ role: 'admin' });
      setSession({ id: admin.id, email: admin.email, role: 'admin' });

      const brand = await createBrand();
      const wrestler1 = await createWrestler(brand.id);
      const wrestler2 = await createWrestler(brand.id);
      const event = await createEvent(brand.id, { status: 'completed' });
      const match = await createMatch(event.id, {
        outcome: 'winner',
        winningSide: 1,
      });
      await createMatchParticipant(match.id, wrestler1.id, 'wrestler', { side: 1 });
      await createMatchParticipant(match.id, wrestler2.id, 'wrestler', { side: 2 });

      const user = await createUser();
      await joinEvent(user.id, event.id);
      await createMatchPrediction(user.id, match.id, { predictedSide: 1 });

      const res = await postScore(event.id);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.message).toContain('scored');
      expect(body.matchPredictionsScored).toBeGreaterThanOrEqual(1);
    });

    test('rejects scoring on open event (400)', async () => {
      const admin = await createUser({ role: 'admin' });
      setSession({ id: admin.id, email: admin.email, role: 'admin' });

      const brand = await createBrand();
      const event = await createEvent(brand.id, { status: 'open' });

      const res = await postScore(event.id);

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('completed');
    });

    test('rejects scoring on locked event (400)', async () => {
      const admin = await createUser({ role: 'admin' });
      setSession({ id: admin.id, email: admin.email, role: 'admin' });

      const brand = await createBrand();
      const event = await createEvent(brand.id, { status: 'locked' });

      const res = await postScore(event.id);

      expect(res.status).toBe(400);
    });

    test('returns 401 when unauthenticated', async () => {
      const brand = await createBrand();
      const event = await createEvent(brand.id, { status: 'completed' });

      const res = await postScore(event.id);

      expect(res.status).toBe(401);
    });

    test('returns 403 for non-admin', async () => {
      const user = await createUser({ role: 'user' });
      setSession({ id: user.id, email: user.email, role: 'user' });

      const brand = await createBrand();
      const event = await createEvent(brand.id, { status: 'completed' });

      const res = await postScore(event.id);

      expect(res.status).toBe(403);
    });

    test('returns 404 for non-existent event', async () => {
      const admin = await createUser({ role: 'admin' });
      setSession({ id: admin.id, email: admin.email, role: 'admin' });

      const res = await postScore('event_nonexistent');

      expect(res.status).toBe(404);
    });

    test('correctly scores team-based match predictions', async () => {
      const admin = await createUser({ role: 'admin' });
      setSession({ id: admin.id, email: admin.email, role: 'admin' });

      const brand = await createBrand();
      const wrestler1 = await createWrestler(brand.id);
      const wrestler2 = await createWrestler(brand.id);
      const event = await createEvent(brand.id, { status: 'completed' });
      const match = await createMatch(event.id, {
        outcome: 'winner',
        winningSide: 1,
      });
      await createMatchParticipant(match.id, wrestler1.id, 'wrestler', { side: 1 });
      await createMatchParticipant(match.id, wrestler2.id, 'wrestler', { side: 2 });

      const user1 = await createUser({ name: 'Correct Guesser' });
      const user2 = await createUser({ name: 'Wrong Guesser' });
      await joinEvent(user1.id, event.id);
      await joinEvent(user2.id, event.id);
      await createMatchPrediction(user1.id, match.id, { predictedSide: 1 }); // correct
      await createMatchPrediction(user2.id, match.id, { predictedSide: 2 }); // incorrect

      const res = await postScore(event.id);
      expect(res.status).toBe(200);

      // Verify predictions were scored correctly
      const db = getTestDb();
      const predictions = await db.select().from(schema.matchPredictions).where(eq(schema.matchPredictions.matchId, match.id));

      const user1Pred = predictions.find(p => p.userId === user1.id);
      const user2Pred = predictions.find(p => p.userId === user2.id);

      expect(user1Pred?.isCorrect).toBe(true);
      expect(user2Pred?.isCorrect).toBe(false);
    });

    test('correctly scores contrarian mode', async () => {
      const admin = await createUser({ role: 'admin' });
      setSession({ id: admin.id, email: admin.email, role: 'admin' });

      const brand = await createBrand();
      const wrestler1 = await createWrestler(brand.id);
      const wrestler2 = await createWrestler(brand.id);
      const event = await createEvent(brand.id, { status: 'completed' });
      const match = await createMatch(event.id, {
        outcome: 'winner',
        winningSide: 1,
      });
      await createMatchParticipant(match.id, wrestler1.id, 'wrestler', { side: 1 });
      await createMatchParticipant(match.id, wrestler2.id, 'wrestler', { side: 2 });

      // Contrarian user predicts wrong side (side 2, winner is side 1)
      const contrarianUser = await createUser({ name: 'Contrarian' });
      await joinEvent(contrarianUser.id, event.id, 'contrarian');
      await createMatchPrediction(contrarianUser.id, match.id, { predictedSide: 2 }); // wrong = good for contrarian

      const res = await postScore(event.id);
      expect(res.status).toBe(200);

      // Verify contrarian was scored
      const db = getTestDb();
      const [joinRecord] = await db
        .select()
        .from(schema.userEventJoin)
        .where(eq(schema.userEventJoin.userId, contrarianUser.id));

      expect(joinRecord.didWinContrarian).toBe(true);
    });
  });
});
