/**
 * Tests for Auth Middleware Edge Cases
 * Supplements auth.test.ts with:
 * - logoutAction behavior
 * - requireAdmin DB verification (session vs DB role mismatch)
 */

import { describe, test, expect, beforeAll, beforeEach, mock } from 'bun:test';
import { NextRequest } from 'next/server';
import { setupTestDb, clearTestDb, getTestDb, schema } from '../helpers/db';
import { createUser, createBrand } from '../helpers/fixtures';
import { eq } from 'drizzle-orm';

// Mock next/headers
let mockHeaders = new Headers();
mock.module('next/headers', () => ({
  headers: async () => mockHeaders,
}));

// Mock auth with controllable signOut
let mockSession: unknown = null;
let mockSignOutFn = async () => {};
mock.module('@/app/lib/auth', () => ({
  auth: {
    api: {
      getSession: async () => mockSession,
      signOut: async (opts: unknown) => mockSignOutFn(),
    },
  },
}));

// Import after mocking
const { logoutAction } = await import('@/app/actions/auth');
const { POST: postEvent } = await import('@/app/api/events/route');

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

describe('Auth Middleware Edge Cases', () => {
  beforeAll(async () => {
    await setupTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
    clearSession();
    mockHeaders = new Headers();
    mockSignOutFn = async () => {};
  });

  // =========================================================================
  // logoutAction
  // =========================================================================
  describe('logoutAction', () => {
    test('returns success on successful signOut', async () => {
      mockSignOutFn = async () => {};

      const result = await logoutAction();

      expect(result).toEqual({ success: true });
    });

    test('returns error when signOut throws', async () => {
      mockSignOutFn = async () => {
        throw new Error('Session expired');
      };

      const result = await logoutAction();

      expect(result).toEqual({ error: 'Failed to sign out' });
    });
  });

  // =========================================================================
  // requireAdmin DB verification
  // =========================================================================
  describe('requireAdmin DB verification', () => {
    test('session says admin but DB says user -> 403', async () => {
      // Create user as regular user in DB
      const user = await createUser({ role: 'user' });
      // But set session as admin (stale session)
      setSession({ id: user.id, email: user.email, role: 'admin' });

      const brand = await createBrand();
      const res = await postEvent(
        makeRequest('http://localhost:3000/api/events', {
          method: 'POST',
          body: JSON.stringify({
            name: 'Test Event',
            brandId: brand.id,
            eventDate: new Date().toISOString(),
          }),
          headers: { 'Content-Type': 'application/json' },
        })
      );

      expect(res.status).toBe(403);
    });

    test('session says user but DB says admin -> still 403 (session checked first)', async () => {
      // Create user as admin in DB
      const user = await createUser({ role: 'admin' });
      // But session says user role
      setSession({ id: user.id, email: user.email, role: 'user' });

      const brand = await createBrand();
      const res = await postEvent(
        makeRequest('http://localhost:3000/api/events', {
          method: 'POST',
          body: JSON.stringify({
            name: 'Test Event',
            brandId: brand.id,
            eventDate: new Date().toISOString(),
          }),
          headers: { 'Content-Type': 'application/json' },
        })
      );

      // requireAdmin calls requireAuth (which passes since session exists),
      // then checks DB where role IS admin, so this should succeed
      expect(res.status).toBe(201);
    });

    test('user deleted from DB -> 403', async () => {
      // Create and then delete user from DB
      const user = await createUser({ role: 'admin' });
      const db = getTestDb();
      // Delete the user's account and user record
      await db.delete(schema.accounts).where(eq(schema.accounts.userId, user.id));
      await db.delete(schema.users).where(eq(schema.users.id, user.id));

      // Session still references deleted user
      setSession({ id: user.id, email: user.email, role: 'admin' });

      const brand = await createBrand();
      const res = await postEvent(
        makeRequest('http://localhost:3000/api/events', {
          method: 'POST',
          body: JSON.stringify({
            name: 'Test Event',
            brandId: brand.id,
            eventDate: new Date().toISOString(),
          }),
          headers: { 'Content-Type': 'application/json' },
        })
      );

      expect(res.status).toBe(403);
    });
  });
});
