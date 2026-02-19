import { NextRequest } from 'next/server';
import { apiHandler, apiSuccess, apiError, parseBodyWithSchema } from '@/app/lib/api-helpers';
import { customPredictionService } from '@/app/lib/services/prediction.service';
import { updateUserCustomPredictionSchema } from '@/app/lib/validation-schemas';

/**
 * GET /api/predictions/custom/:id
 * Get a specific custom prediction by ID
 */
export const GET = apiHandler(async (_req, { params, session }) => {
  if (!params?.id) {
    throw apiError('Prediction ID is required');
  }

  const prediction = await customPredictionService.getById(params.id, session.user.id);

  return apiSuccess(prediction);
});

/**
 * PATCH /api/predictions/custom/:id
 * Update a custom prediction
 */
export const PATCH = apiHandler(async (req: NextRequest, { params, session }) => {
  if (!params?.id) {
    throw apiError('Prediction ID is required');
  }

  const body = await parseBodyWithSchema(req, updateUserCustomPredictionSchema);

  const prediction = await customPredictionService.update(params.id, session.user.id, body);

  return apiSuccess(prediction);
});

/**
 * DELETE /api/predictions/custom/:id
 * Delete a custom prediction
 */
export const DELETE = apiHandler(async (_req, { params, session }) => {
  if (!params?.id) {
    throw apiError('Prediction ID is required');
  }

  await customPredictionService.delete(params.id, session.user.id);

  return apiSuccess({ message: 'Prediction deleted successfully', id: params.id });
});
