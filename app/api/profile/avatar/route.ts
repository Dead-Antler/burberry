import { NextRequest } from 'next/server';
import { apiHandler, apiSuccess, apiError, getUserId } from '@/app/lib/api-helpers';
import { db } from '@/app/lib/db';
import { users } from '@/app/lib/schema';
import { eq } from 'drizzle-orm';
import { updatedTimestamp } from '@/app/lib/entities';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { AVATAR_UPLOAD_DIR } from '@/app/lib/paths';

const UPLOAD_DIR = AVATAR_UPLOAD_DIR;
const MAX_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

const EXTENSION_MAP: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

/**
 * POST /api/profile/avatar
 * Upload a profile picture
 */
export const POST = apiHandler(async (req: NextRequest, { session }) => {
  const userId = getUserId(session);

  const formData = await req.formData();
  const file = formData.get('avatar') as File | null;

  if (!file) {
    throw apiError('No file provided');
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    throw apiError('Invalid file type. Allowed: JPEG, PNG, GIF, WebP');
  }

  if (file.size > MAX_SIZE) {
    throw apiError('File too large. Maximum size is 2MB');
  }

  // Ensure upload directory exists
  if (!existsSync(UPLOAD_DIR)) {
    await mkdir(UPLOAD_DIR, { recursive: true });
  }

  // Delete existing avatar if present
  const [currentUser] = await db
    .select({ image: users.image })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (currentUser?.image) {
    const existingFile = join(UPLOAD_DIR, currentUser.image.split('/').pop()!);
    try { await unlink(existingFile); } catch { /* file may not exist */ }
  }

  // Save file
  const ext = EXTENSION_MAP[file.type] || 'jpg';
  const filename = `${userId}.${ext}`;
  const filepath = join(UPLOAD_DIR, filename);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filepath, buffer);

  // Update user record
  const imageUrl = `/api/profile/avatar/${filename}`;
  await db
    .update(users)
    .set({
      image: imageUrl,
      ...updatedTimestamp(),
    })
    .where(eq(users.id, userId));

  return apiSuccess({ image: imageUrl });
});

/**
 * DELETE /api/profile/avatar
 * Remove profile picture
 */
export const DELETE = apiHandler(async (_req: NextRequest, { session }) => {
  const userId = getUserId(session);

  const [currentUser] = await db
    .select({ image: users.image })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (currentUser?.image) {
    const filename = currentUser.image.split('/').pop()!;
    const filepath = join(UPLOAD_DIR, filename);
    try { await unlink(filepath); } catch { /* file may not exist */ }
  }

  await db
    .update(users)
    .set({
      image: null,
      ...updatedTimestamp(),
    })
    .where(eq(users.id, userId));

  return apiSuccess({ message: 'Avatar removed' });
});
