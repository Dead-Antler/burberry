import type { Session } from 'next-auth'

export interface AppUser {
  name: string
  email: string
  isAdmin: boolean
}

export function getUserFromSession(session: Session | null): AppUser | null {
  if (!session?.user) {
    return null
  }

  return {
    name: session.user.name ?? '',
    email: session.user.email ?? '',
    isAdmin: session.user.isAdmin ?? false,
  }
}
