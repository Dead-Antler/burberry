/**
 * Tests for Match Admin CRUD endpoints
 * PATCH /api/matches/:id (update, results entry)
 * DELETE /api/matches/:id (cascade delete, status constraints)
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
const { PATCH, DELETE } = await import('@/app/api/matches/[id]/route');

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

function patchMatch(id: string, body: unknown) {
  return PATCH(
    makeRequest(`http://localhost:3000/api/matches/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    }),
    { params: Promise.resolve({ id }) }
  );
}

function deleteMatch(id: string) {
  return DELETE(
    makeRequest(`http://localhost:3000/api/matches/${id}`, { method: 'DELETE' }),
    { params: Promise.resolve({ id }) }
  );
}

describe('Match Admin CRUD', () => {
  beforeAll(async () => {
    await setupTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
    clearSession();
    mockHeaders = new Headers();
  });

  // =========================================================================
  // PATCH /api/matches/:id - Basic Updates
  // =========================================================================
  describe('PATCH /api/matches/:id - updates', () => {
    test('updates match type (200)', async () => {
      const admin = await createUser({ role: 'admin' });
      setSession({ id: admin.id, email: admin.email, role: 'admin' });

      const brand = await createBrand();
      const event = await createEvent(brand.id, { status: 'open' });
      const match = await createMatch(event.id, { matchType: 'Singles' });

      const res = await patchMatch(match.id, { matchType: 'Tag Team' });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.matchType).toBe('Tag Team');
    });

    test('updates match order (200)', async () => {
      const admin = await createUser({ role: 'admin' });
      setSession({ id: admin.id, email: admin.email, role: 'admin' });

      const brand = await createBrand();
      const event = await createEvent(brand.id, { status: 'open' });
      const match = await createMatch(event.id, { matchOrder: 1 });

      const res = await patchMatch(match.id, { matchOrder: 5 });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.matchOrder).toBe(5);
    });

    test('locks a match (200)', async () => {
      const admin = await createUser({ role: 'admin' });
      setSession({ id: admin.id, email: admin.email, role: 'admin' });

      const brand = await createBrand();
      const event = await createEvent(brand.id, { status: 'open' });
      const match = await createMatch(event.id, { isLocked: false });

      const res = await patchMatch(match.id, { isLocked: true });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.isLocked).toBe(true);
    });

    test('returns 401 when unauthenticated', async () => {
      const brand = await createBrand();
      const event = await createEvent(brand.id);
      const match = await createMatch(event.id);

      const res = await patchMatch(match.id, { matchType: 'Tag Team' });

      expect(res.status).toBe(401);
    });

    test('returns 403 for non-admin', async () => {
      const user = await createUser({ role: 'user' });
      setSession({ id: user.id, email: user.email, role: 'user' });

      const brand = await createBrand();
      const event = await createEvent(brand.id);
      const match = await createMatch(event.id);

      const res = await patchMatch(match.id, { matchType: 'Tag Team' });

      expect(res.status).toBe(403);
    });

    test('returns 404 for non-existent match', async () => {
      const admin = await createUser({ role: 'admin' });
      setSession({ id: admin.id, email: admin.email, role: 'admin' });

      const res = await patchMatch('match_nonexistent', { matchType: 'Tag Team' });

      expect(res.status).toBe(404);
    });

    test('returns 400 for empty body', async () => {
      const admin = await createUser({ role: 'admin' });
      setSession({ id: admin.id, email: admin.email, role: 'admin' });

      const brand = await createBrand();
      const event = await createEvent(brand.id);
      const match = await createMatch(event.id);

      const res = await patchMatch(match.id, {});

      expect(res.status).toBe(400);
    });
  });

  // =========================================================================
  // PATCH /api/matches/:id - Result Entry
  // =========================================================================
  describe('PATCH /api/matches/:id - results', () => {
    test('sets winningSide on locked event (200)', async () => {
      const admin = await createUser({ role: 'admin' });
      setSession({ id: admin.id, email: admin.email, role: 'admin' });

      const brand = await createBrand();
      const event = await createEvent(brand.id, { status: 'locked' });
      const match = await createMatch(event.id);

      const res = await patchMatch(match.id, {
        outcome: 'winner',
        winningSide: 1,
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.outcome).toBe('winner');
      expect(body.winningSide).toBe(1);
    });

    test('sets winnerParticipantId for free-for-all (200)', async () => {
      const admin = await createUser({ role: 'admin' });
      setSession({ id: admin.id, email: admin.email, role: 'admin' });

      const brand = await createBrand();
      const wrestler = await createWrestler(brand.id);
      const event = await createEvent(brand.id, { status: 'locked' });
      const match = await createMatch(event.id);
      const participant = await createMatchParticipant(match.id, wrestler.id, 'wrestler', { side: null });

      const res = await patchMatch(match.id, {
        outcome: 'winner',
        winnerParticipantId: participant.id,
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.winnerParticipantId).toBe(participant.id);
    });

    test('sets draw outcome (200)', async () => {
      const admin = await createUser({ role: 'admin' });
      setSession({ id: admin.id, email: admin.email, role: 'admin' });

      const brand = await createBrand();
      const event = await createEvent(brand.id, { status: 'locked' });
      const match = await createMatch(event.id);

      const res = await patchMatch(match.id, { outcome: 'draw' });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.outcome).toBe('draw');
    });

    test('rejects results on open event (400)', async () => {
      const admin = await createUser({ role: 'admin' });
      setSession({ id: admin.id, email: admin.email, role: 'admin' });

      const brand = await createBrand();
      const event = await createEvent(brand.id, { status: 'open' });
      const match = await createMatch(event.id);

      const res = await patchMatch(match.id, {
        outcome: 'winner',
        winningSide: 1,
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('open');
    });

    test('rejects results on completed event (400)', async () => {
      const admin = await createUser({ role: 'admin' });
      setSession({ id: admin.id, email: admin.email, role: 'admin' });

      const brand = await createBrand();
      const event = await createEvent(brand.id, { status: 'completed' });
      const match = await createMatch(event.id);

      const res = await patchMatch(match.id, {
        outcome: 'winner',
        winningSide: 1,
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('completed');
    });
  });

  // =========================================================================
  // DELETE /api/matches/:id
  // =========================================================================
  describe('DELETE /api/matches/:id', () => {
    test('deletes from open event (200)', async () => {
      const admin = await createUser({ role: 'admin' });
      setSession({ id: admin.id, email: admin.email, role: 'admin' });

      const brand = await createBrand();
      const event = await createEvent(brand.id, { status: 'open' });
      const match = await createMatch(event.id);

      const res = await deleteMatch(match.id);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.message).toContain('deleted');
    });

    test('deletes from pending event (200)', async () => {
      const admin = await createUser({ role: 'admin' });
      setSession({ id: admin.id, email: admin.email, role: 'admin' });

      const brand = await createBrand();
      const event = await createEvent(brand.id, { status: 'pending' });
      const match = await createMatch(event.id);

      const res = await deleteMatch(match.id);

      expect(res.status).toBe(200);
    });

    test('rejects delete from locked event (400)', async () => {
      const admin = await createUser({ role: 'admin' });
      setSession({ id: admin.id, email: admin.email, role: 'admin' });

      const brand = await createBrand();
      const event = await createEvent(brand.id, { status: 'locked' });
      const match = await createMatch(event.id);

      const res = await deleteMatch(match.id);

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('locked or completed');
    });

    test('rejects delete from completed event (400)', async () => {
      const admin = await createUser({ role: 'admin' });
      setSession({ id: admin.id, email: admin.email, role: 'admin' });

      const brand = await createBrand();
      const event = await createEvent(brand.id, { status: 'completed' });
      const match = await createMatch(event.id);

      const res = await deleteMatch(match.id);

      expect(res.status).toBe(400);
    });

    test('cascade deletes participants and predictions', async () => {
      const admin = await createUser({ role: 'admin' });
      setSession({ id: admin.id, email: admin.email, role: 'admin' });

      const brand = await createBrand();
      const wrestler1 = await createWrestler(brand.id);
      const wrestler2 = await createWrestler(brand.id);
      const event = await createEvent(brand.id, { status: 'open' });
      const match = await createMatch(event.id);
      await createMatchParticipant(match.id, wrestler1.id, 'wrestler', { side: 1 });
      await createMatchParticipant(match.id, wrestler2.id, 'wrestler', { side: 2 });
      const user = await createUser();
      await createMatchPrediction(user.id, match.id, { predictedSide: 1 });

      const res = await deleteMatch(match.id);
      expect(res.status).toBe(200);

      // Verify cascade
      const db = getTestDb();
      const remainingParticipants = await db
        .select()
        .from(schema.matchParticipants)
        .where(eq(schema.matchParticipants.matchId, match.id));
      const remainingPredictions = await db
        .select()
        .from(schema.matchPredictions)
        .where(eq(schema.matchPredictions.matchId, match.id));

      expect(remainingParticipants).toHaveLength(0);
      expect(remainingPredictions).toHaveLength(0);
    });

    test('returns 401 when unauthenticated', async () => {
      const brand = await createBrand();
      const event = await createEvent(brand.id);
      const match = await createMatch(event.id);

      const res = await deleteMatch(match.id);

      expect(res.status).toBe(401);
    });

    test('returns 403 for non-admin', async () => {
      const user = await createUser({ role: 'user' });
      setSession({ id: user.id, email: user.email, role: 'user' });

      const brand = await createBrand();
      const event = await createEvent(brand.id);
      const match = await createMatch(event.id);

      const res = await deleteMatch(match.id);

      expect(res.status).toBe(403);
    });

    test('returns 404 for non-existent match', async () => {
      const admin = await createUser({ role: 'admin' });
      setSession({ id: admin.id, email: admin.email, role: 'admin' });

      const res = await deleteMatch('match_nonexistent');

      expect(res.status).toBe(404);
    });
  });
});
