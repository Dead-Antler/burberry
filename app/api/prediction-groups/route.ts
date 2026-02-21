import { NextRequest } from 'next/server';
import {
  apiHandler,
  apiSuccess,
  parseBodyWithSchema,
  parseQueryWithSchema,
  createPaginatedResponse,
} from '@/app/lib/api-helpers';
import { createPredictionGroupSchema, paginationSchema } from '@/app/lib/validation-schemas';
import { predictionGroupService } from '@/app/lib/services/prediction-group.service';

/**
 * GET /api/prediction-groups
 * List all prediction groups with pagination
 */
export const GET = apiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const params = parseQueryWithSchema(searchParams, paginationSchema);

  const { data, total } = await predictionGroupService.list(params);

  return apiSuccess(createPaginatedResponse(data, total, params));
}, { requireAdmin: true });

/**
 * POST /api/prediction-groups
 * Create a new prediction group
 */
export const POST = apiHandler(async (req: NextRequest) => {
  const body = await parseBodyWithSchema(req, createPredictionGroupSchema);

  const group = await predictionGroupService.create(body);

  return apiSuccess(group, 201);
}, { requireAdmin: true });
