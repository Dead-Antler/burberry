/**
 * Tests for API route auth enforcement
 * Verifies that requireAuth and requireAdmin middleware work correctly
 */

import { describe, test, expect, beforeAll, beforeEach, mock } from 'bun:test';
import { NextRequest } from 'next/server';
import { setupTestDb, clearTestDb } from '../helpers/db';
import { createUser, createBrand } from '../helpers/fixtures';

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
const { GET: getEvents, POST: postEvent } = await import(
  '@/app/api/events/route'
);

function makeRequest(url: string, options?: ConstructorParameters<typeof NextRequest>[1]): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'), options);
}

function setSession(user: { id: string; email: string; role?: string; name?: string }) {
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
      name: user.name ?? 'Test User',
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

describe('API Auth Enforcement', () => {
  beforeAll(async () => {
    await setupTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
    clearSession();
    mockHeaders = new Headers();
  });

  describe('Protected endpoints (requireAuth)', () => {
    test('returns 401 when no session exists', async () => {
      const req = makeRequest('http://localhost:3000/api/events');
      const res = await getEvents(req);

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe('Unauthorized');
    });

    test('returns 200 when authenticated', async () => {
      const user = await createUser();
      setSession({ id: user.id, email: user.email });

      const req = makeRequest('http://localhost:3000/api/events');
      const res = await getEvents(req);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toBeDefined();
    });
  });

  describe('Admin endpoints (requireAdmin)', () => {
    test('returns 401 when no session exists', async () => {
      const brand = await createBrand();
      const req = makeRequest('http://localhost:3000/api/events', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Event',
          brandId: brand.id,
          eventDate: new Date().toISOString(),
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const res = await postEvent(req);

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe('Unauthorized');
    });

    test('returns 403 when non-admin user accesses admin endpoint', async () => {
      const user = await createUser({ role: 'user' });
      setSession({ id: user.id, email: user.email, role: 'user' });

      const brand = await createBrand();
      const req = makeRequest('http://localhost:3000/api/events', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Event',
          brandId: brand.id,
          eventDate: new Date().toISOString(),
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const res = await postEvent(req);

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toContain('Admin');
    });

    test('returns 201 when admin user creates event', async () => {
      const admin = await createUser({ role: 'admin' });
      setSession({ id: admin.id, email: admin.email, role: 'admin' });

      const brand = await createBrand();
      const req = makeRequest('http://localhost:3000/api/events', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Event',
          brandId: brand.id,
          eventDate: new Date().toISOString(),
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const res = await postEvent(req);

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.name).toBe('Test Event');
    });
  });

  describe('Request ID tracking', () => {
    test('returns x-request-id header on success', async () => {
      const user = await createUser();
      setSession({ id: user.id, email: user.email });

      const req = makeRequest('http://localhost:3000/api/events');
      const res = await getEvents(req);

      expect(res.headers.get('x-request-id')).toBeTruthy();
    });

    test('returns x-request-id header on auth error', async () => {
      const req = makeRequest('http://localhost:3000/api/events');
      const res = await getEvents(req);

      expect(res.status).toBe(401);
      expect(res.headers.get('x-request-id')).toBeTruthy();
    });

    test('echoes back provided x-request-id', async () => {
      const user = await createUser();
      setSession({ id: user.id, email: user.email });

      const req = makeRequest('http://localhost:3000/api/events', {
        headers: { 'x-request-id': 'custom-req-123' },
      });
      const res = await getEvents(req);

      expect(res.headers.get('x-request-id')).toBe('custom-req-123');
    });
  });
});
