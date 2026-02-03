/**
 * Better Auth API Handler
 *
 * This catch-all route handles all Better Auth endpoints:
 * - POST /api/auth/sign-in/email - Sign in with email/password
 * - POST /api/auth/sign-up/email - Sign up with email/password
 * - POST /api/auth/sign-out - Sign out
 * - GET /api/auth/session - Get current session
 * - Admin endpoints: /api/auth/admin/*
 * - And more...
 */

import { auth } from '@/app/lib/auth';
import { toNextJsHandler } from 'better-auth/next-js';

export const { GET, POST } = toNextJsHandler(auth);
