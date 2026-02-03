/**
 * Application Initialization
 *
 * Handles first-run setup including initial admin user creation.
 * Called from instrumentation.ts after migrations complete.
 */

import { db } from './db';
import { users, accounts } from './schema';
import { count } from 'drizzle-orm';
import { hashPassword } from 'better-auth/crypto';
import { randomBytes } from 'crypto';

/**
 * Generate a cryptographically secure random password
 */
function generateRandomPassword(length = 24): string {
  // Use base64 encoding for readable characters, trim to desired length
  return randomBytes(Math.ceil(length * 0.75))
    .toString('base64')
    .slice(0, length)
    .replace(/[+/]/g, 'x'); // Replace URL-unsafe chars
}

/**
 * Initialize the application on first run
 * - Creates initial admin user if no users exist
 */
export async function initializeApp(): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL;

  if (!adminEmail) {
    // No admin email configured - skip auto-creation
    // Users must be created via API after first admin exists
    return;
  }

  // Check if any users exist
  const [{ userCount }] = await db
    .select({ userCount: count() })
    .from(users);

  if (userCount > 0) {
    // Users already exist - skip initialization
    return;
  }

  // First run - create initial admin user
  const password = process.env.ADMIN_PASSWORD || generateRandomPassword();
  const hashedPassword = await hashPassword(password);
  const userId = crypto.randomUUID();
  const now = new Date();

  // Create user record
  await db.insert(users).values({
    id: userId,
    email: adminEmail,
    name: 'Admin',
    emailVerified: false,
    role: 'admin',
    banned: false,
    createdAt: now,
    updatedAt: now,
  });

  // Create credential account
  await db.insert(accounts).values({
    id: `acc_${userId}`,
    userId: userId,
    accountId: userId,
    providerId: 'credential',
    password: hashedPassword,
    createdAt: now,
    updatedAt: now,
  });

  // Log credentials (only on first run)
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  INITIAL ADMIN USER CREATED');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Email:    ${adminEmail}`);
  console.log(`  Password: ${password}`);
  if (!process.env.ADMIN_PASSWORD) {
    console.log('');
    console.log('  ⚠️  This password was randomly generated.');
    console.log('  ⚠️  Please change it after first login.');
  }
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
}
