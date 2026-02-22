/**
 * Better Auth Configuration
 *
 * This is the main server-side auth configuration using Better Auth.
 * It replaces the previous Auth.js (NextAuth) setup with:
 * - Database-backed sessions (not JWT)
 * - Built-in rate limiting
 * - Scrypt password hashing
 * - Admin plugin for user management
 */

import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { admin } from 'better-auth/plugins';
import { nextCookies } from 'better-auth/next-js';
import { APIError } from 'better-auth/api';
import { db } from './db';
import * as schema from './schema';
import { isSignupEnabled } from './settings-utils';

export const auth = betterAuth({
  // Use AUTH_URL to avoid needing separate BETTER_AUTH_URL
  baseURL: process.env.AUTH_URL || 'http://localhost:3000',

  database: drizzleAdapter(db, {
    provider: 'sqlite',
    schema: {
      // Map our table names to Better Auth's expected names
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),

  // Email/password authentication
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },

  // Session configuration
  session: {
    expiresIn: 60 * 60 * 24, // 24 hours
    updateAge: 60 * 60, // Update session every hour
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutes
    },
  },

  // Plugins - nextCookies must be last for proper cookie handling in server actions
  plugins: [
    admin({
      defaultRole: 'user',
      adminRoles: ['admin'],
    }),
    nextCookies(), // Must be last
  ],

  // Rate limiting (built-in)
  rateLimit: {
    enabled: true,
    window: 60, // 60 seconds
    max: 100, // 100 requests per minute
    customRules: {
      // Stricter rate limiting for sign-in: 5 attempts per 15 minutes
      '/sign-in/email': {
        window: 15 * 60, // 15 minutes
        max: 5,
      },
      // Rate limiting for sign-up: 5 attempts per hour
      '/sign-up/email': {
        window: 60 * 60, // 1 hour
        max: 5,
      },
    },
  },

  // Advanced options
  advanced: {
    cookiePrefix: 'burberry',
    generateId: () => {
      // Use crypto.randomUUID for secure ID generation
      return crypto.randomUUID();
    },
  },

  // Origins trusted for CSRF validation (AUTH_URL is also trusted via baseURL)
  trustedOrigins: [
    process.env.AUTH_URL || 'http://localhost:3000',
    ...(process.env.TRUSTED_ORIGINS
      ? process.env.TRUSTED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean)
      : []),
  ],

  // Database hooks for custom logic
  databaseHooks: {
    user: {
      create: {
        before: async () => {
          const signupEnabled = await isSignupEnabled();
          if (!signupEnabled) {
            throw new APIError('FORBIDDEN', {
              message: 'Sign up is currently disabled',
            });
          }
        },
      },
    },
  },
});

// Export types for use in other files
export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
