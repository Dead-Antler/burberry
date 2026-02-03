/**
 * Settings Utility Functions
 *
 * Direct database access for settings to avoid circular dependencies.
 * These functions are safe to import from anywhere in the codebase.
 */

import { db } from './db';
import { settings } from './schema';
import { eq } from 'drizzle-orm';

/**
 * Check if user signup is enabled
 */
export async function isSignupEnabled(): Promise<boolean> {
  const [setting] = await db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, 'auth.signupEnabled'))
    .limit(1);

  return setting?.value === 'true';
}
