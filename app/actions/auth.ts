'use server';

import { auth } from '@/app/lib/auth';
import { headers } from 'next/headers';

export async function logoutAction() {
  try {
    const headersList = await headers();
    // The nextCookies plugin handles cookie clearing automatically
    await auth.api.signOut({
      headers: headersList,
    });

    return { success: true };
  } catch (error) {
    console.error('Logout error:', error);
    return { error: 'Failed to sign out' };
  }
}
