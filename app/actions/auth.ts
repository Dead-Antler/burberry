'use server';

import { signIn } from '@/auth';
import { rateLimit } from '@/app/lib/rate-limit';
import { headers } from 'next/headers';
import { AuthError } from 'next-auth';

export async function loginAction(email: string, password: string) {
  // Get IP address for rate limiting
  const headersList = await headers();
  const ip = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || 'unknown';
  const identifier = `login:${ip}`;

  // Rate limit: 5 attempts per 15 minutes per IP
  const rateLimitResult = rateLimit(identifier, {
    limit: 5,
    windowMs: 15 * 60 * 1000,
  });

  if (!rateLimitResult.success) {
    const resetDate = new Date(rateLimitResult.reset);
    const minutesRemaining = Math.ceil((rateLimitResult.reset - Date.now()) / 1000 / 60);
    return {
      error: `Too many login attempts. Please try again in ${minutesRemaining} minute${minutesRemaining !== 1 ? 's' : ''}.`,
    };
  }

  try {
    await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    return { success: true };
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: 'Invalid email or password' };
    }
    return { error: 'An error occurred. Please try again.' };
  }
}
