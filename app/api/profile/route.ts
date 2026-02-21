import { NextRequest } from 'next/server';
import { apiHandler, apiSuccess, apiError, parseBodyWithSchema, getUserId, sanitizeText } from '@/app/lib/api-helpers';
import { updateProfileSchema } from '@/app/lib/validation-schemas';
import { db } from '@/app/lib/db';
import { users } from '@/app/lib/schema';
import { eq } from 'drizzle-orm';
import { ensureUnique, updatedTimestamp } from '@/app/lib/entities';

/**
 * GET /api/profile
 * Get the current user's profile
 */
export const GET = apiHandler(async (_req: NextRequest, { session }) => {
  const userId = getUserId(session);

  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      image: users.image,
      theme: users.theme,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    throw apiError('User not found', 404);
  }

  return apiSuccess(user);
});

/**
 * PATCH /api/profile
 * Update the current user's name, email, and/or theme
 */
export const PATCH = apiHandler(async (req: NextRequest, { session }) => {
  const userId = getUserId(session);
  const body = await parseBodyWithSchema(req, updateProfileSchema);

  if (body.name === undefined && body.email === undefined && body.theme === undefined) {
    throw apiError('No fields to update');
  }

  // If updating email, check uniqueness (excluding self)
  if (body.email) {
    await ensureUnique(users, 'email', body.email, 'User', userId);
  }

  const sanitizedName = body.name !== undefined
    ? (body.name ? sanitizeText(body.name, 100) : null)
    : undefined;

  const [updated] = await db
    .update(users)
    .set({
      ...(body.email !== undefined && { email: body.email }),
      ...(sanitizedName !== undefined && { name: sanitizedName }),
      ...(body.theme !== undefined && { theme: body.theme }),
      ...updatedTimestamp(),
    })
    .where(eq(users.id, userId))
    .returning({
      id: users.id,
      name: users.name,
      email: users.email,
      image: users.image,
      theme: users.theme,
    });

  return apiSuccess(updated);
});
