import { NextRequest } from 'next/server';
import { apiHandler, apiSuccess, apiError, parseBodyWithSchema } from '@/app/lib/api-helpers';
import { addPredictionGroupMemberSchema } from '@/app/lib/validation-schemas';
import { predictionGroupService } from '@/app/lib/services/prediction-group.service';

/**
 * POST /api/prediction-groups/:id/members
 * Add a template to a prediction group
 */
export const POST = apiHandler(async (req: NextRequest, { params }) => {
  if (!params?.id) {
    throw apiError('Group ID is required');
  }

  const body = await parseBodyWithSchema(req, addPredictionGroupMemberSchema);

  const member = await predictionGroupService.addMember(params.id, body.templateId);

  return apiSuccess(member, 201);
}, { requireAdmin: true });
