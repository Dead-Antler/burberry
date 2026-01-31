import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { rateLimit } from './rate-limit';

/**
 * Standard API error response
 */
export function apiError(message: string, status: number = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Standard API success response
 */
export function apiSuccess<T>(data: T, status: number = 200) {
  return NextResponse.json(data, { status });
}

/**
 * Authentication middleware for API routes
 * Returns user session if authenticated, throws error response if not
 */
export async function requireAuth(req: NextRequest) {
  const session = await auth();

  if (!session || !session.user?.id) {
    throw apiError('Unauthorized', 401);
  }

  return session;
}

/**
 * Admin authorization middleware for API routes
 * Returns user session if user is admin, throws error response if not
 */
export async function requireAdmin(req: NextRequest) {
  const session = await requireAuth(req);

  if (!session.user?.isAdmin) {
    throw apiError('Forbidden - Admin access required', 403);
  }

  return session;
}

/**
 * Rate limiting middleware for API routes
 */
export function requireRateLimit(
  req: NextRequest,
  options: { limit: number; windowMs: number; prefix?: string } = {
    limit: 100,
    windowMs: 60 * 1000, // 100 requests per minute by default
    prefix: 'api',
  }
) {
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  const identifier = `${options.prefix}:${ip}`;

  const rateLimitResult = rateLimit(identifier, {
    limit: options.limit,
    windowMs: options.windowMs,
  });

  if (!rateLimitResult.success) {
    const secondsRemaining = Math.ceil((rateLimitResult.reset - Date.now()) / 1000);
    throw NextResponse.json(
      {
        error: `Too many requests. Please try again in ${secondsRemaining} second${secondsRemaining !== 1 ? 's' : ''}.`,
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(secondsRemaining),
          'X-RateLimit-Limit': String(rateLimitResult.limit),
          'X-RateLimit-Remaining': String(rateLimitResult.remaining),
          'X-RateLimit-Reset': String(rateLimitResult.reset),
        },
      }
    );
  }

  return rateLimitResult;
}

/**
 * Wrapper for API route handlers that provides error handling, auth, and rate limiting
 */
export function apiHandler(
  handler: (req: NextRequest, context: { session: Awaited<ReturnType<typeof auth>>; params?: Record<string, string> }) => Promise<NextResponse>,
  options: {
    requireAuth?: boolean;
    requireAdmin?: boolean;
    rateLimit?: { limit: number; windowMs: number; prefix?: string };
  } = { requireAuth: true }
) {
  return async (req: NextRequest, context?: { params?: Promise<Record<string, string>> }) => {
    try {
      // Apply rate limiting if configured
      if (options.rateLimit) {
        requireRateLimit(req, options.rateLimit);
      }

      // Apply authentication if required
      let session = null;
      if (options.requireAuth) {
        session = await requireAuth(req);
      }

      // Apply admin check if required
      if (options.requireAdmin) {
        session = await requireAdmin(req);
      }

      // Await params if they exist
      const params = context?.params ? await context.params : undefined;

      // Call the handler
      return await handler(req, { session, params });
    } catch (error) {
      // If error is already a NextResponse (from our helper functions), return it
      if (error instanceof NextResponse) {
        return error;
      }

      // Otherwise, log and return generic error
      console.error('API Error:', error);
      return apiError('Internal server error', 500);
    }
  };
}

/**
 * Generate a unique ID for database records
 */
export function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Validate required fields in request body
 */
export function validateRequired<T extends Record<string, unknown>>(
  data: T,
  fields: (keyof T)[]
): void {
  const missing = fields.filter(field => !data[field]);
  if (missing.length > 0) {
    throw apiError(`Missing required fields: ${missing.join(', ')}`);
  }
}

/**
 * Parse JSON body with error handling
 */
export async function parseBody<T = unknown>(req: NextRequest): Promise<T> {
  try {
    return await req.json();
  } catch {
    throw apiError('Invalid JSON body');
  }
}
