import { NextRequest } from 'next/server';
import {
  apiHandler,
  apiSuccess,
  parseBodyWithSchema,
  parseQueryWithSchema,
  createPaginatedResponse,
} from '@/app/lib/api-helpers';
import { createUserSchema, userQuerySchema, paginationSchema } from '@/app/lib/validation-schemas';
import { userService } from '@/app/lib/services/user.service';

/**
 * GET /api/users
 * List all users with pagination (admin-only)
 * Query params:
 * - search: filter by email or name
 * - isAdmin: filter by admin status (true/false)
 * - page, limit, sortBy, sortOrder: pagination
 */
export const GET = apiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const query = parseQueryWithSchema(searchParams, userQuerySchema);
  const pagination = parseQueryWithSchema(searchParams, paginationSchema);

  const { data, total } = await userService.list({
    ...pagination,
    search: query.search,
    isAdmin: query.isAdmin,
  });

  return apiSuccess(createPaginatedResponse(data, total, pagination));
}, { requireAdmin: true });

/**
 * POST /api/users
 * Create a new user (admin-only)
 */
export const POST = apiHandler(async (req: NextRequest) => {
  const body = await parseBodyWithSchema(req, createUserSchema);

  const user = await userService.create(body);

  return apiSuccess(user, 201);
}, { requireAdmin: true });
