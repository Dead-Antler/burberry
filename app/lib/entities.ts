/**
 * Entity Helpers - Centralized database operations for all entities
 *
 * This module provides reusable, type-safe operations for common database patterns:
 * - findById / ensureExists (with 404 handling)
 * - ensureUnique (with 409 handling)
 * - ensureForeignKey / ensureAllExist (with 400 handling)
 * - buildPaginatedList (standardized pagination)
 * - withTransaction (atomic operations)
 */

import { db } from './db';
import { eq, sql, and, ne, inArray, SQL } from 'drizzle-orm';
import type { SQLiteTableWithColumns, SQLiteColumn } from 'drizzle-orm/sqlite-core';
import { apiError } from './api-helpers';
import type { PaginationParams } from './api-helpers';

// Generic table type for operations
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTable = SQLiteTableWithColumns<any>;

// Helper type for accessing id column
type TableWithIdColumn = {
  id: SQLiteColumn<{
    name: 'id';
    tableName: string;
    dataType: 'string';
    columnType: 'SQLiteText';
    data: string;
    driverParam: string;
    notNull: true;
    hasDefault: false;
    enumValues: [string, ...string[]];
    baseColumn: never;
    isPrimaryKey: true;
    isAutoincrement: false;
    hasRuntimeDefault: false;
    generated: undefined;
  }>;
};

/**
 * Find an entity by ID
 * @returns The entity or null if not found
 */
export async function findById<T extends AnyTable>(
  table: T,
  id: string
): Promise<T['$inferSelect'] | null> {
  const [result] = await db
    .select()
    .from(table)
    .where(eq((table as unknown as TableWithIdColumn).id, id))
    .limit(1);

  return result ?? null;
}

/**
 * Find multiple entities by IDs
 * @returns Array of found entities (may be fewer than requested if some don't exist)
 */
export async function findByIds<T extends AnyTable>(
  table: T,
  ids: string[]
): Promise<T['$inferSelect'][]> {
  if (ids.length === 0) return [];

  return db
    .select()
    .from(table)
    .where(inArray((table as unknown as TableWithIdColumn).id, ids));
}

/**
 * Ensure an entity exists, throwing 404 if not found
 * @returns The entity if found
 * @throws 404 error if not found
 */
export async function ensureExists<T extends AnyTable>(
  table: T,
  id: string,
  entityName: string
): Promise<T['$inferSelect']> {
  const result = await findById(table, id);

  if (!result) {
    throw apiError(`${entityName} not found`, 404);
  }

  return result;
}

/**
 * Ensure a foreign key reference is valid
 * @throws 400 error if the referenced entity doesn't exist
 */
export async function ensureForeignKey<T extends AnyTable>(
  table: T,
  id: string,
  entityName: string
): Promise<void> {
  const result = await findById(table, id);

  if (!result) {
    throw apiError(`Invalid ${entityName} ID: ${id}`, 400);
  }
}

/**
 * Ensure all IDs in an array reference valid entities
 * @throws 400 error if any referenced entity doesn't exist
 */
export async function ensureAllExist<T extends AnyTable>(
  table: T,
  ids: string[],
  entityName: string
): Promise<void> {
  if (ids.length === 0) return;

  // Remove duplicates
  const uniqueIds = [...new Set(ids)];

  const results = await findByIds(table, uniqueIds);

  if (results.length !== uniqueIds.length) {
    const foundIds = new Set(results.map((r) => (r as { id: string }).id));
    const missingIds = uniqueIds.filter((id) => !foundIds.has(id));
    throw apiError(
      `Invalid ${entityName} ID${missingIds.length > 1 ? 's' : ''}: ${missingIds.join(', ')}`,
      400
    );
  }
}

/**
 * Ensure a value is unique for a given field
 * @param excludeId - Optional ID to exclude from uniqueness check (for updates)
 * @throws 409 error if a duplicate exists
 */
export async function ensureUnique<T extends AnyTable>(
  table: T,
  field: keyof T['$inferSelect'],
  value: unknown,
  entityName: string,
  excludeId?: string
): Promise<void> {
  const conditions: SQL[] = [eq(table[field as keyof T] as SQL, value as SQL)];

  if (excludeId) {
    conditions.push(ne((table as unknown as TableWithIdColumn).id, excludeId));
  }

  const [existing] = await db
    .select({ id: (table as unknown as TableWithIdColumn).id })
    .from(table)
    .where(and(...conditions))
    .limit(1);

  if (existing) {
    throw apiError(`A ${entityName} with this ${String(field)} already exists`, 409);
  }
}

/**
 * Ensure an entity is owned by a specific user
 * @throws 404 error if not found or not owned by the user
 */
export async function ensureOwnership<T extends AnyTable>(
  table: T,
  id: string,
  userId: string,
  userIdField: keyof T['$inferSelect'],
  entityName: string
): Promise<T['$inferSelect']> {
  const [result] = await db
    .select()
    .from(table)
    .where(
      and(
        eq((table as unknown as TableWithIdColumn).id, id),
        eq(table[userIdField as keyof T] as SQL, userId as unknown as SQL)
      )
    )
    .limit(1);

  if (!result) {
    // Use generic "not found" to avoid leaking whether the resource exists
    throw apiError(`${entityName} not found`, 404);
  }

  return result;
}

/**
 * Options for building a paginated list query
 */
export interface PaginatedListOptions<T extends AnyTable> {
  where?: SQL;
  orderBy: SQL;
  pagination: PaginationParams;
  // Optional: include related data after fetching
  transform?: (data: T['$inferSelect'][]) => Promise<unknown[]>;
}

/**
 * Build and execute a paginated list query
 * @returns Object with data array and total count
 */
export async function buildPaginatedList<T extends AnyTable>(
  table: T,
  options: PaginatedListOptions<T>
): Promise<{ data: T['$inferSelect'][]; total: number }> {
  const { where, orderBy, pagination } = options;
  const offset = (pagination.page - 1) * pagination.limit;

  // Get total count
  const countQuery = db.select({ count: sql<number>`count(*)` }).from(table);
  if (where) {
    countQuery.where(where);
  }
  const [{ count }] = await countQuery;

  // Get paginated data
  const dataQuery = db.select().from(table);
  if (where) {
    dataQuery.where(where);
  }
  const data = await dataQuery.orderBy(orderBy).limit(pagination.limit).offset(offset);

  return { data, total: count };
}

/**
 * Execute operations within a database transaction
 * Automatically rolls back on error
 */
export async function withTransaction<T>(
  callback: Parameters<typeof db.transaction>[0]
): Promise<T> {
  return db.transaction(callback) as Promise<T>;
}

/**
 * Common timestamp helpers
 */
export function timestamps() {
  const now = new Date();
  return {
    createdAt: now,
    updatedAt: now,
  };
}

export function updatedTimestamp() {
  return {
    updatedAt: new Date(),
  };
}

// ============================================================================
// Event Status Helpers
// ============================================================================

import { events, matches } from './schema';

export type EventStatus = 'open' | 'locked' | 'completed';

/**
 * Ensure an event has the required status
 * @param eventId - The event ID to check
 * @param requiredStatus - Single status or array of allowed statuses
 * @param operation - Description of the operation for error message
 * @throws 404 if event not found
 * @throws 400 if event status doesn't match
 */
export async function ensureEventStatus(
  eventId: string,
  requiredStatus: EventStatus | EventStatus[],
  operation: string
): Promise<typeof events.$inferSelect> {
  const event = await ensureExists(events, eventId, 'Event');
  const allowedStatuses = Array.isArray(requiredStatus) ? requiredStatus : [requiredStatus];

  if (!allowedStatuses.includes(event.status as EventStatus)) {
    const statusList = allowedStatuses.join(' or ');
    throw apiError(`Cannot ${operation} - event must be ${statusList}`, 400);
  }

  return event;
}

/**
 * Get match and ensure its event has the required status
 * @param matchId - The match ID to check
 * @param requiredStatus - Single status or array of allowed statuses
 * @param operation - Description of the operation for error message
 * @throws 404 if match or event not found
 * @throws 400 if event status doesn't match
 */
export async function ensureEventStatusForMatch(
  matchId: string,
  requiredStatus: EventStatus | EventStatus[],
  operation: string
): Promise<{ match: typeof matches.$inferSelect; event: typeof events.$inferSelect }> {
  const match = await ensureExists(matches, matchId, 'Match');
  const event = await ensureEventStatus(match.eventId, requiredStatus, operation);

  return { match, event };
}
