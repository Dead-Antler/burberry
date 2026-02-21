import { NextRequest } from 'next/server';
import { apiHandler, apiSuccess, apiError, parseBodyWithSchema } from '@/app/lib/api-helpers';
import { updateCustomPredictionTemplateSchema } from '@/app/lib/validation-schemas';
import { customPredictionTemplateService } from '@/app/lib/services/custom-prediction-template.service';

/**
 * GET /api/custom-prediction-templates/:id
 * Get a specific custom prediction template by ID
 */
export const GET = apiHandler(async (_req, { params }) => {
  if (!params?.id) {
    throw apiError('Template ID is required');
  }

  const template = await customPredictionTemplateService.getById(params.id);

  return apiSuccess(template);
}, { requireAdmin: true });

/**
 * PATCH /api/custom-prediction-templates/:id
 * Update a custom prediction template
 */
export const PATCH = apiHandler(async (req: NextRequest, { params }) => {
  if (!params?.id) {
    throw apiError('Template ID is required');
  }

  const body = await parseBodyWithSchema(req, updateCustomPredictionTemplateSchema);

  if (!body.name && body.description === undefined && !body.predictionType) {
    throw apiError('No fields to update');
  }

  const template = await customPredictionTemplateService.update(params.id, body);

  return apiSuccess(template);
}, { requireAdmin: true });

/**
 * DELETE /api/custom-prediction-templates/:id
 * Delete a custom prediction template
 */
export const DELETE = apiHandler(async (_req, { params }) => {
  if (!params?.id) {
    throw apiError('Template ID is required');
  }

  await customPredictionTemplateService.delete(params.id);

  return apiSuccess({ message: 'Custom prediction template deleted successfully', id: params.id });
}, { requireAdmin: true });
