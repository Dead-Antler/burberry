import { apiHandler, apiSuccess, apiError } from '@/app/lib/api-helpers';
import { predictionGroupService } from '@/app/lib/services/prediction-group.service';

/**
 * DELETE /api/prediction-groups/:id/members/:memberId
 * Remove a template from a prediction group
 */
export const DELETE = apiHandler(async (_req, { params }) => {
  if (!params?.memberId) {
    throw apiError('Member ID is required');
  }

  await predictionGroupService.removeMember(params.memberId);

  return apiSuccess({ message: 'Member removed successfully', id: params.memberId });
}, { requireAdmin: true });
