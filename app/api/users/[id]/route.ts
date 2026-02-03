import { NextRequest } from 'next/server';
import { apiHandler, apiSuccess, apiError, parseBodyWithSchema, getUserId } from '@/app/lib/api-helpers';
import { updateUserSchema } from '@/app/lib/validation-schemas';
import { userService } from '@/app/lib/services/user.service';

/**
 * GET /api/users/:id
 * Get a specific user by ID (admin-only)
 */
export const GET = apiHandler(async (_req: NextRequest, { params }) => {
  if (!params?.id) {
    throw apiError('User ID is required');
  }

  const user = await userService.getById(params.id);

  return apiSuccess(user);
}, { requireAdmin: true });

/**
 * PATCH /api/users/:id
 * Update a user (admin-only)
 * Cannot remove own admin privileges
 */
export const PATCH = apiHandler(async (req: NextRequest, { params, session }) => {
  if (!params?.id) {
    throw apiError('User ID is required');
  }

  const body = await parseBodyWithSchema(req, updateUserSchema);

  if (
    body.email === undefined &&
    body.password === undefined &&
    body.name === undefined &&
    body.isAdmin === undefined
  ) {
    throw apiError('No fields to update');
  }

  const currentUserId = getUserId(session);
  const user = await userService.update(params.id, body, currentUserId);

  return apiSuccess(user);
}, { requireAdmin: true });

/**
 * DELETE /api/users/:id
 * Delete a user (admin-only)
 * Cannot delete own account
 */
export const DELETE = apiHandler(async (_req, { params, session }) => {
  if (!params?.id) {
    throw apiError('User ID is required');
  }

  const currentUserId = getUserId(session);
  await userService.delete(params.id, currentUserId);

  return apiSuccess({ message: 'User deleted successfully', id: params.id });
}, { requireAdmin: true });
