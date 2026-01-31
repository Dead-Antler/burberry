import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { db } from './app/lib/db';
import { users } from './app/lib/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

// Dummy hash for constant-time authentication (prevents timing attacks)
const DUMMY_HASH = '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNO';

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/login',
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await db
          .select()
          .from(users)
          .where(eq(users.email, credentials.email as string))
          .limit(1);

        // Always perform bcrypt comparison (constant time) to prevent timing attacks
        const hashedPassword = user && user.length > 0 ? user[0].password : DUMMY_HASH;
        const passwordMatch = await bcrypt.compare(credentials.password as string, hashedPassword);

        // Only succeed if user exists AND password matches
        if (!user || user.length === 0 || !passwordMatch) {
          return null;
        }

        return {
          id: user[0].id,
          email: user[0].email,
          name: user[0].name,
          isAdmin: user[0].isAdmin,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.isAdmin = user.isAdmin;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.isAdmin = token.isAdmin as boolean;
      }
      return session;
    },
  },
});
