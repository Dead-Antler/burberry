/**
 * Better Auth Client
 *
 * Client-side auth utilities for React components.
 * Use this for sign in, sign out, and session management in the browser.
 */

import { createAuthClient } from 'better-auth/react';
import { adminClient } from 'better-auth/client/plugins';

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  plugins: [
    adminClient(),
  ],
});

// Export commonly used functions and hooks
export const {
  signIn,
  signOut,
  signUp,
  useSession,
  getSession,
} = authClient;
