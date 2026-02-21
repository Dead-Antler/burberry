import { NextRequest } from 'next/server';
import { apiHandler, apiSuccess, apiError, parseBodyWithSchema } from '@/app/lib/api-helpers';
import { updatePredictionGroupSchema } from '@/app/lib/validation-schemas';
import { predictionGroupService } from '@/app/lib/services/prediction-group.service';

/**
 * GET /api/prediction-groups/:id
 * Get a prediction group with its member templates
 */
export const GET = apiHandler(async (_req, { params }) => {
  if (!params?.id) {
    throw apiError('Group ID is required');
  }

  const group = await predictionGroupService.getWithMembers(params.id);

  return apiSuccess(group);
}, { requireAdmin: true });

/**
 * PATCH /api/prediction-groups/:id
 * Update a prediction group
 */
export const PATCH = apiHandler(async (req: NextRequest, { params }) => {
  if (!params?.id) {
    throw apiError('Group ID is required');
  }

  const body = await parseBodyWithSchema(req, updatePredictionGroupSchema);

  if (!body.name) {
    throw apiError('No fields to update');
  }

  const group = await predictionGroupService.update(params.id, body);

  return apiSuccess(group);
}, { requireAdmin: true });

/**
 * DELETE /api/prediction-groups/:id
 * Delete a prediction group and its members
 */
export const DELETE = apiHandler(async (_req, { params }) => {
  if (!params?.id) {
    throw apiError('Group ID is required');
  }

  await predictionGroupService.delete(params.id);

  return apiSuccess({ message: 'Prediction group deleted successfully', id: params.id });
}, { requireAdmin: true });
