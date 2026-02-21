import type { AuthSession } from './api-helpers';
import type { ColorTheme } from './api-types';

export interface AppUser {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
  image: string | null;
  theme: ColorTheme;
}

/**
 * Extract user data from Better Auth session
 */
export function getUserFromSession(session: AuthSession | null): AppUser | null {
  if (!session?.user) {
    return null;
  }

  return {
    id: session.user.id,
    name: session.user.name ?? '',
    email: session.user.email ?? '',
    isAdmin: session.user.role === 'admin',
    image: session.user.image ?? null,
    theme: (session.user.theme as ColorTheme) ?? 'neutral',
  };
}
