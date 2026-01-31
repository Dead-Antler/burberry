import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { rateLimit } from './rate-limit';
import type { Session } from 'next-auth';

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

// Use Session directly from next-auth instead of deriving from auth() return type
// auth() has multiple overloads and TypeScript gets confused
export type AuthSession = Session;

export interface ApiHandlerContext {
  session: AuthSession;
  params?: Record<string, string>;
}

/**
 * Helper to extract user ID from session with proper typing
 */
export function getUserId(session: AuthSession): string {
  return session.user.id;
}

/**
 * Authentication middleware for API routes
 * Returns user session if authenticated, throws error response if not
 */
export async function requireAuth(_req: NextRequest): Promise<AuthSession> {
  // Call auth() with no args to get Session | null (not middleware)
  const getSession = auth as () => Promise<Session | null>;
  const session = await getSession();

  if (!session || !session.user?.id) {
    throw apiError('Unauthorized', 401);
  }

  return session;
}

/**
 * Admin authorization middleware for API routes
 * Returns user session if user is admin, throws error response if not
 */
export async function requireAdmin(req: NextRequest): Promise<AuthSession> {
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
  handler: (
    req: NextRequest,
    context: {
      session: AuthSession;
      params?: Record<string, string>;
    }
  ) => Promise<NextResponse>,
  options?: {
    requireAuth?: boolean;
    requireAdmin?: boolean;
    rateLimit?: { limit: number; windowMs: number; prefix?: string };
  }
) {
  return async (req: NextRequest, context?: { params?: Promise<Record<string, string>> }) => {
    try {
      // Apply rate limiting if configured
      if (options?.rateLimit) {
        requireRateLimit(req, options.rateLimit);
      }

      // Apply authentication if required (default: true)
      let session: AuthSession | null = null;
      if (options?.requireAuth !== false) {
        session = await requireAuth(req);
      }

      // Apply admin check if required
      if (options?.requireAdmin) {
        session = await requireAdmin(req);
      }

      // Await params if they exist
      const params = context?.params ? await context.params : undefined;

      // Call the handler
      // Type assertion needed because handler expects non-null session
      // but we know it's non-null when requireAuth !== false (default behavior)
      return await handler(req, { session: session as AuthSession, params });
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
 * Uses crypto.randomUUID() for cryptographically secure IDs
 */
export function generateId(prefix: string): string {
  const { randomUUID } = require('crypto');
  return `${prefix}_${randomUUID()}`;
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

/**
 * Parse and validate request body with Zod schema
 */
export async function parseBodyWithSchema<T>(
  req: NextRequest,
  schema: { parse: (data: unknown) => T }
): Promise<T> {
  try {
    const body = await req.json();
    return schema.parse(body);
  } catch (error: unknown) {
    // Check if it's a Zod error
    if (error && typeof error === 'object' && 'issues' in error) {
      const zodError = error as { issues: Array<{ path: Array<string | number>; message: string }> };
      const messages = zodError.issues
        .map((err) => `${err.path.join('.')}: ${err.message}`)
        .join(', ');
      throw apiError(`Validation failed: ${messages}`, 400);
    }
    throw apiError('Invalid JSON body', 400);
  }
}

/**
 * Parse and validate query parameters with Zod schema
 */
export function parseQueryWithSchema<T>(
  searchParams: URLSearchParams,
  schema: { parse: (data: unknown) => T }
): T {
  try {
    const queryObj = Object.fromEntries(searchParams.entries());
    return schema.parse(queryObj);
  } catch (error: unknown) {
    // Check if it's a Zod error
    if (error && typeof error === 'object' && 'issues' in error) {
      const zodError = error as { issues: Array<{ path: Array<string | number>; message: string }> };
      const messages = zodError.issues
        .map((err) => `${err.path.join('.')}: ${err.message}`)
        .join(', ');
      throw apiError(`Invalid query parameters: ${messages}`, 400);
    }
    throw apiError('Invalid query parameters', 400);
  }
}
