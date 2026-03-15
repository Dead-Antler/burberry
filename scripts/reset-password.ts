import { db } from '../app/lib/db';
import { users, accounts } from '../app/lib/schema';
import { eq, and } from 'drizzle-orm';
import { hashPassword } from 'better-auth/crypto';

async function resetPassword() {
  const email = process.argv[2];
  const newPassword = process.argv[3] || 'password';

  if (!email) {
    console.error('Usage: bun db:reset-password <email> [new-password]');
    console.error('  If no password is provided, defaults to "password"');
    process.exit(1);
  }

  // Find user
  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user) {
    console.error(`User not found: ${email}`);
    process.exit(1);
  }

  const hashed = await hashPassword(newPassword);

  const result = await db
    .update(accounts)
    .set({ password: hashed, updatedAt: new Date() })
    .where(and(eq(accounts.userId, user.id), eq(accounts.providerId, 'credential')))
    .returning({ id: accounts.id });

  if (result.length === 0) {
    console.error(`No credential account found for ${email}`);
    process.exit(1);
  }

  console.log(`Password reset for ${email}`);
}

resetPassword().catch(console.error);
