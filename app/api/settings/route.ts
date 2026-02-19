import { NextRequest } from 'next/server';
import { apiHandler, apiSuccess, parseBodyWithSchema } from '@/app/lib/api-helpers';
import { settingsService } from '@/app/lib/services/settings.service';
import { SettingType } from '@/app/lib/settings-schemas';
import { setSettingSchema } from '@/app/lib/validation-schemas';

/**
 * GET /api/settings
 * List all settings, optionally filtered by namespace
 * Query params:
 * - namespace: filter by namespace prefix (e.g., 'predictions')
 * [ADMIN ONLY]
 */
export const GET = apiHandler(
  async (req: NextRequest) => {
    const { searchParams } = new URL(req.url);
    const namespace = searchParams.get('namespace') || undefined;

    const settings = await settingsService.list(namespace);

    // Parse values for the response
    const parsed = settings.map((s) => ({
      key: s.key,
      scope: s.scope,
      type: s.type,
      value: parseValueForResponse(s.value, s.type as SettingType),
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }));

    return apiSuccess(parsed);
  },
  { requireAdmin: true }
);

/**
 * POST /api/settings
 * Create or update a setting
 * [ADMIN ONLY]
 */
export const POST = apiHandler(
  async (req: NextRequest) => {
    const body = await parseBodyWithSchema(req, setSettingSchema);

    await settingsService.set(body.key, body.value, body.type);

    // Return the saved setting
    const saved = await settingsService.get(body.key);

    return apiSuccess({
      key: body.key,
      type: body.type,
      value: saved,
    }, 201);
  },
  { requireAdmin: true }
);

/**
 * Parse stored value for API response
 */
function parseValueForResponse(value: string, type: SettingType): unknown {
  switch (type) {
    case 'string':
      return value;
    case 'boolean':
      return value === 'true';
    case 'number':
      return Number(value);
    case 'json':
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    default:
      return value;
  }
}
