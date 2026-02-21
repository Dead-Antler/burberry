import { NextRequest } from 'next/server';
import { apiHandler, apiSuccess, apiError, parseBodyWithSchema, getUserId } from '@/app/lib/api-helpers';
import { changePasswordSchema } from '@/app/lib/validation-schemas';
import { userService } from '@/app/lib/services/user.service';
import { db } from '@/app/lib/db';
import { accounts } from '@/app/lib/schema';
import { eq, and } from 'drizzle-orm';
import { hashPassword } from 'better-auth/crypto';
import { updatedTimestamp } from '@/app/lib/entities';

/**
 * PATCH /api/profile/password
 * Change the current user's password (requires current password)
 */
export const PATCH = apiHandler(async (req: NextRequest, { session }) => {
  const userId = getUserId(session);
  const body = await parseBodyWithSchema(req, changePasswordSchema);

  // Verify current password
  const isValid = await userService.verifyPassword(userId, body.currentPassword);
  if (!isValid) {
    throw apiError('Current password is incorrect', 403);
  }

  // Hash and update password
  const hashedPassword = await hashPassword(body.newPassword);
  await db
    .update(accounts)
    .set({
      password: hashedPassword,
      ...updatedTimestamp(),
    })
    .where(
      and(
        eq(accounts.userId, userId),
        eq(accounts.providerId, 'credential')
      )
    );

  return apiSuccess({ message: 'Password updated successfully' });
});
