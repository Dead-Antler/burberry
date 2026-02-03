import { NextRequest } from 'next/server';
import { apiHandler, apiSuccess, apiError } from '@/app/lib/api-helpers';
import { settingsService } from '@/app/lib/services/settings.service';

/**
 * GET /api/settings/[key]
 * Get a single setting by key
 * [ADMIN ONLY]
 */
export const GET = apiHandler(
  async (_req: NextRequest, { params }) => {
    const key = params?.key;

    if (!key) {
      throw apiError('Setting key is required', 400);
    }

    const value = await settingsService.get(key);

    if (value === undefined) {
      throw apiError('Setting not found', 404);
    }

    return apiSuccess({ key, value });
  },
  { requireAdmin: true }
);

/**
 * DELETE /api/settings/[key]
 * Delete a setting
 * [ADMIN ONLY]
 */
export const DELETE = apiHandler(
  async (_req: NextRequest, { params }) => {
    const key = params?.key;

    if (!key) {
      throw apiError('Setting key is required', 400);
    }

    const deleted = await settingsService.delete(key);

    if (!deleted) {
      throw apiError('Setting not found', 404);
    }

    return apiSuccess({ deleted: true });
  },
  { requireAdmin: true }
);
