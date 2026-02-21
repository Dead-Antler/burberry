/**
 * Tests for Brand Admin CRUD endpoints
 * POST /api/brands, PATCH /api/brands/:id, DELETE /api/brands/:id
 */

import { describe, test, expect, beforeAll, beforeEach, mock } from 'bun:test';
import { NextRequest } from 'next/server';
import { setupTestDb, clearTestDb } from '../helpers/db';
import { createUser, createBrand } from '../helpers/fixtures';

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
const { POST } = await import('@/app/api/brands/route');
const { PATCH, DELETE } = await import('@/app/api/brands/[id]/route');

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

function postBrand(body: unknown) {
  return POST(
    makeRequest('http://localhost:3000/api/brands', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    })
  );
}

function patchBrand(id: string, body: unknown) {
  return PATCH(
    makeRequest(`http://localhost:3000/api/brands/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    }),
    { params: Promise.resolve({ id }) }
  );
}

function deleteBrand(id: string) {
  return DELETE(
    makeRequest(`http://localhost:3000/api/brands/${id}`, { method: 'DELETE' }),
    { params: Promise.resolve({ id }) }
  );
}

describe('Brand Admin CRUD', () => {
  beforeAll(async () => {
    await setupTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
    clearSession();
    mockHeaders = new Headers();
  });

  // =========================================================================
  // POST /api/brands
  // =========================================================================
  describe('POST /api/brands', () => {
    test('creates a brand (201)', async () => {
      const admin = await createUser({ role: 'admin' });
      setSession({ id: admin.id, email: admin.email, role: 'admin' });

      const res = await postBrand({ name: 'WWE' });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.name).toBe('WWE');
      expect(body.id).toMatch(/^brand_/);
    });

    test('returns 401 when unauthenticated', async () => {
      const res = await postBrand({ name: 'WWE' });

      expect(res.status).toBe(401);
    });

    test('returns 403 for non-admin', async () => {
      const user = await createUser({ role: 'user' });
      setSession({ id: user.id, email: user.email, role: 'user' });

      const res = await postBrand({ name: 'WWE' });

      expect(res.status).toBe(403);
    });

    test('returns 400 for invalid body', async () => {
      const admin = await createUser({ role: 'admin' });
      setSession({ id: admin.id, email: admin.email, role: 'admin' });

      const res = await POST(
        makeRequest('http://localhost:3000/api/brands', {
          method: 'POST',
          body: 'not json',
          headers: { 'Content-Type': 'application/json' },
        })
      );

      expect(res.status).toBe(400);
    });

    test('returns 400 for empty name', async () => {
      const admin = await createUser({ role: 'admin' });
      setSession({ id: admin.id, email: admin.email, role: 'admin' });

      const res = await postBrand({ name: '' });

      expect(res.status).toBe(400);
    });

    test('returns 409 for duplicate name', async () => {
      const admin = await createUser({ role: 'admin' });
      setSession({ id: admin.id, email: admin.email, role: 'admin' });

      await createBrand({ name: 'WWE' });

      const res = await postBrand({ name: 'WWE' });

      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error).toContain('already exists');
    });

    test('normalizes whitespace in name (sanitizeText)', async () => {
      const admin = await createUser({ role: 'admin' });
      setSession({ id: admin.id, email: admin.email, role: 'admin' });

      const res = await postBrand({ name: '  WWE   Raw  ' });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.name).toBe('WWE Raw');
    });
  });

  // =========================================================================
  // PATCH /api/brands/:id
  // =========================================================================
  describe('PATCH /api/brands/:id', () => {
    test('updates a brand (200)', async () => {
      const admin = await createUser({ role: 'admin' });
      setSession({ id: admin.id, email: admin.email, role: 'admin' });

      const brand = await createBrand({ name: 'Old Name' });

      const res = await patchBrand(brand.id, { name: 'New Name' });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.name).toBe('New Name');
    });

    test('returns 401 when unauthenticated', async () => {
      const brand = await createBrand();

      const res = await patchBrand(brand.id, { name: 'New Name' });

      expect(res.status).toBe(401);
    });

    test('returns 403 for non-admin', async () => {
      const user = await createUser({ role: 'user' });
      setSession({ id: user.id, email: user.email, role: 'user' });

      const brand = await createBrand();

      const res = await patchBrand(brand.id, { name: 'New Name' });

      expect(res.status).toBe(403);
    });

    test('returns 404 for non-existent brand', async () => {
      const admin = await createUser({ role: 'admin' });
      setSession({ id: admin.id, email: admin.email, role: 'admin' });

      const res = await patchBrand('brand_nonexistent', { name: 'Test' });

      expect(res.status).toBe(404);
    });

    test('returns 409 for duplicate name', async () => {
      const admin = await createUser({ role: 'admin' });
      setSession({ id: admin.id, email: admin.email, role: 'admin' });

      await createBrand({ name: 'Existing' });
      const brand2 = await createBrand({ name: 'Other' });

      const res = await patchBrand(brand2.id, { name: 'Existing' });

      expect(res.status).toBe(409);
    });

    test('returns 400 for empty body', async () => {
      const admin = await createUser({ role: 'admin' });
      setSession({ id: admin.id, email: admin.email, role: 'admin' });

      const brand = await createBrand();

      const res = await patchBrand(brand.id, {});

      expect(res.status).toBe(400);
    });
  });

  // =========================================================================
  // DELETE /api/brands/:id
  // =========================================================================
  describe('DELETE /api/brands/:id', () => {
    test('deletes a brand (200)', async () => {
      const admin = await createUser({ role: 'admin' });
      setSession({ id: admin.id, email: admin.email, role: 'admin' });

      const brand = await createBrand();

      const res = await deleteBrand(brand.id);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.message).toContain('deleted');
    });

    test('returns 401 when unauthenticated', async () => {
      const brand = await createBrand();

      const res = await deleteBrand(brand.id);

      expect(res.status).toBe(401);
    });

    test('returns 403 for non-admin', async () => {
      const user = await createUser({ role: 'user' });
      setSession({ id: user.id, email: user.email, role: 'user' });

      const brand = await createBrand();

      const res = await deleteBrand(brand.id);

      expect(res.status).toBe(403);
    });

    test('returns 404 for non-existent brand', async () => {
      const admin = await createUser({ role: 'admin' });
      setSession({ id: admin.id, email: admin.email, role: 'admin' });

      const res = await deleteBrand('brand_nonexistent');

      expect(res.status).toBe(404);
    });
  });
});
