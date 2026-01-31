import { NextRequest } from 'next/server';
import { apiHandler, apiSuccess, apiError, parseBodyWithSchema } from '@/app/lib/api-helpers';
import { updateMatchPredictionSchema } from '@/app/lib/validation-schemas';
import { matchPredictionService } from '@/app/lib/services/prediction.service';

/**
 * GET /api/predictions/matches/:id
 * Get a specific match prediction by ID
 */
export const GET = apiHandler(async (_req, { params, session }) => {
  if (!params?.id) {
    throw apiError('Prediction ID is required');
  }

  const prediction = await matchPredictionService.getById(params.id, session.user.id);

  return apiSuccess(prediction);
});

/**
 * PATCH /api/predictions/matches/:id
 * Update a match prediction
 */
export const PATCH = apiHandler(async (req: NextRequest, { params, session }) => {
  if (!params?.id) {
    throw apiError('Prediction ID is required');
  }

  const body = await parseBodyWithSchema(req, updateMatchPredictionSchema);

  const prediction = await matchPredictionService.update(params.id, session.user.id, body);

  return apiSuccess(prediction);
});

/**
 * DELETE /api/predictions/matches/:id
 * Delete a match prediction
 */
export const DELETE = apiHandler(async (_req, { params, session }) => {
  if (!params?.id) {
    throw apiError('Prediction ID is required');
  }

  await matchPredictionService.delete(params.id, session.user.id);

  return apiSuccess({ message: 'Prediction deleted successfully', id: params.id });
});
