import { NextRequest } from 'next/server';
import {
  apiHandler,
  apiSuccess,
  parseBodyWithSchema,
  parseQueryWithSchema,
  createPaginatedResponse,
} from '@/app/lib/api-helpers';
import { createCustomPredictionTemplateSchema, paginationSchema } from '@/app/lib/validation-schemas';
import { customPredictionTemplateService } from '@/app/lib/services/custom-prediction-template.service';

/**
 * GET /api/custom-prediction-templates
 * List all custom prediction templates with pagination
 */
export const GET = apiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const params = parseQueryWithSchema(searchParams, paginationSchema);

  const { data, total } = await customPredictionTemplateService.list(params);

  return apiSuccess(createPaginatedResponse(data, total, params));
}, { requireAdmin: true });

/**
 * POST /api/custom-prediction-templates
 * Create a new custom prediction template
 */
export const POST = apiHandler(async (req: NextRequest) => {
  const body = await parseBodyWithSchema(req, createCustomPredictionTemplateSchema);

  const template = await customPredictionTemplateService.create(body);

  return apiSuccess(template, 201);
}, { requireAdmin: true });
