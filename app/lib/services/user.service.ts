/**
 * User Service - Business logic for user operations
 *
 * Works with Better Auth schema where:
 * - User data is in `users` table (no password)
 * - Passwords are in `accounts` table with providerId='credential'
 * - Admin status is `role` field ('admin' or 'user')
 */

import { db } from '../db';
import { users, accounts } from '../schema';
import { eq, asc, desc, or, like, SQL, and, isNull } from 'drizzle-orm';
import { generateId, apiError, sanitizeText } from '../api-helpers';
import type { PaginationParams } from '../api-helpers';
import {
  ensureExists,
  ensureUnique,
  buildPaginatedList,
  timestamps,
  updatedTimestamp,
} from '../entities';

// Use Better Auth's password hashing (scrypt via better-auth/crypto)
// This ensures consistency with Better Auth's own password handling
import { hashPassword, verifyPassword } from 'better-auth/crypto';

// Input types - expose isAdmin for API simplicity, map to role internally
export interface CreateUserInput {
  email: string;
  password: string;
  name?: string | null;
  isAdmin?: boolean;
}

export interface UpdateUserInput {
  email?: string;
  password?: string;
  name?: string | null;
  isAdmin?: boolean;
}

export interface ListUsersParams extends PaginationParams {
  search?: string;
  isAdmin?: boolean;
}

// Output type that includes isAdmin for backward compatibility
export interface UserOutput {
  id: string;
  name: string | null;
  email: string;
  emailVerified: boolean;
  image: string | null;
  role: string | null;
  isAdmin: boolean;
  banned: boolean | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

/**
 * Transform DB user to output format with isAdmin convenience field
 */
function toUserOutput(user: typeof users.$inferSelect): UserOutput {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerified: user.emailVerified,
    image: user.image,
    role: user.role,
    isAdmin: user.role === 'admin',
    banned: user.banned,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

/**
 * User Service
 */
export const userService = {
  /**
   * List all users with pagination
   */
  async list(params: ListUsersParams) {
    // Build where clause
    let where: SQL | undefined;

    const conditions: SQL[] = [];

    if (params.search) {
      const searchPattern = `%${params.search}%`;
      conditions.push(
        or(
          like(users.email, searchPattern),
          like(users.name, searchPattern)
        ) as SQL
      );
    }

    if (params.isAdmin !== undefined) {
      // Map isAdmin boolean to role check
      if (params.isAdmin) {
        conditions.push(eq(users.role, 'admin'));
      } else {
        conditions.push(or(eq(users.role, 'user'), isNull(users.role)) as SQL);
      }
    }

    if (conditions.length > 0) {
      where = conditions.length === 1
        ? conditions[0]
        : and(...conditions);
    }

    // Build order by clause
    const orderBy: SQL =
      params.sortBy === 'email'
        ? params.sortOrder === 'desc'
          ? desc(users.email)
          : asc(users.email)
        : params.sortBy === 'name'
          ? params.sortOrder === 'desc'
            ? desc(users.name)
            : asc(users.name)
          : params.sortOrder === 'desc'
            ? desc(users.createdAt)
            : asc(users.createdAt);

    const { data, total } = await buildPaginatedList(users, {
      where,
      orderBy,
      pagination: params,
    });

    // Transform to output format
    return { data: data.map(toUserOutput), total };
  },

  /**
   * Get a single user by ID
   * @throws 404 if not found
   */
  async getById(id: string) {
    const user = await ensureExists(users, id, 'User');
    return toUserOutput(user);
  },

  /**
   * Create a new user
   * Creates both user record and credential account for password
   * @throws 409 if email already exists
   */
  async create(input: CreateUserInput) {
    // Normalize email and sanitize name
    const normalizedEmail = input.email.toLowerCase().trim();
    const sanitizedName = input.name ? sanitizeText(input.name, 100) : null;

    // Validate email uniqueness
    await ensureUnique(users, 'email', normalizedEmail, 'User');

    const userId = generateId('user');
    const accountId = `acc_${userId}`;
    const hashedPassword = await hashPassword(input.password);
    const now = timestamps();

    // Create user record (no password - that goes in accounts)
    const [newUser] = await db
      .insert(users)
      .values({
        id: userId,
        email: normalizedEmail,
        name: sanitizedName,
        emailVerified: false,
        role: input.isAdmin ? 'admin' : 'user',
        banned: false,
        ...now,
      })
      .returning();

    // Create credential account for password
    await db.insert(accounts).values({
      id: accountId,
      userId: userId,
      accountId: userId, // For credentials, accountId = userId
      providerId: 'credential',
      password: hashedPassword,
      ...now,
    });

    return toUserOutput(newUser);
  },

  /**
   * Update an existing user
   * @throws 404 if not found
   * @throws 409 if new email already exists
   * @throws 403 if trying to remove own admin privileges
   */
  async update(id: string, input: UpdateUserInput, currentUserId?: string) {
    // Ensure user exists
    await ensureExists(users, id, 'User');

    // Prevent self-demotion (removing own admin privileges)
    if (currentUserId && id === currentUserId && input.isAdmin === false) {
      throw apiError('Cannot remove your own admin privileges', 403);
    }

    // Normalize email and sanitize name if provided
    const normalizedEmail = input.email ? input.email.toLowerCase().trim() : undefined;
    const sanitizedName = input.name !== undefined
      ? (input.name ? sanitizeText(input.name, 100) : null)
      : undefined;

    // If updating email, check uniqueness (excluding current record)
    if (normalizedEmail) {
      await ensureUnique(users, 'email', normalizedEmail, 'User', id);
    }

    // Update password in accounts table if provided
    if (input.password) {
      const hashedPassword = await hashPassword(input.password);
      await db
        .update(accounts)
        .set({
          password: hashedPassword,
          ...updatedTimestamp(),
        })
        .where(
          and(
            eq(accounts.userId, id),
            eq(accounts.providerId, 'credential')
          )
        );
    }

    // Update user record
    const [updated] = await db
      .update(users)
      .set({
        ...(normalizedEmail !== undefined && { email: normalizedEmail }),
        ...(sanitizedName !== undefined && { name: sanitizedName }),
        ...(input.isAdmin !== undefined && { role: input.isAdmin ? 'admin' : 'user' }),
        ...updatedTimestamp(),
      })
      .where(eq(users.id, id))
      .returning();

    return toUserOutput(updated);
  },

  /**
   * Delete a user
   * Accounts and sessions are automatically deleted via cascade
   * @throws 404 if not found
   * @throws 403 if trying to delete self
   */
  async delete(id: string, currentUserId: string) {
    // Ensure user exists
    await ensureExists(users, id, 'User');

    // Prevent self-deletion
    if (id === currentUserId) {
      throw apiError('Cannot delete your own account', 403);
    }

    await db.delete(users).where(eq(users.id, id));
  },

  /**
   * Verify a user's password
   * Used for authentication checks
   */
  async verifyPassword(userId: string, password: string): Promise<boolean> {
    const [account] = await db
      .select({ password: accounts.password })
      .from(accounts)
      .where(
        and(
          eq(accounts.userId, userId),
          eq(accounts.providerId, 'credential')
        )
      )
      .limit(1);

    if (!account?.password) {
      return false;
    }

    return verifyPassword({ hash: account.password, password });
  },
};
