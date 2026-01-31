import { handlers } from '@/auth';
import { rateLimit } from '@/app/lib/rate-limit';
import { NextRequest, NextResponse } from 'next/server';

const { GET: authGET, POST: authPOST } = handlers;

export const GET = authGET;

export async function POST(req: NextRequest) {
  // Apply rate limiting to auth POST requests (login attempts)
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  const identifier = `auth-api:${ip}`;

  const rateLimitResult = rateLimit(identifier, {
    limit: 10,
    windowMs: 15 * 60 * 1000, // 10 attempts per 15 minutes
  });

  if (!rateLimitResult.success) {
    const minutesRemaining = Math.ceil((rateLimitResult.reset - Date.now()) / 1000 / 60);
    return NextResponse.json(
      {
        error: `Too many requests. Please try again in ${minutesRemaining} minute${minutesRemaining !== 1 ? 's' : ''}.`,
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil((rateLimitResult.reset - Date.now()) / 1000)),
          'X-RateLimit-Limit': String(rateLimitResult.limit),
          'X-RateLimit-Remaining': String(rateLimitResult.remaining),
          'X-RateLimit-Reset': String(rateLimitResult.reset),
        },
      }
    );
  }

  return authPOST(req);
}
