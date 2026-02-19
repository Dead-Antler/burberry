/**
 * Test Fixtures
 * Factory functions for creating test data
 *
 * Works with Better Auth schema:
 * - User data in `users` table (no password)
 * - Passwords in `accounts` table with providerId='credential'
 */

import { getTestDb, schema } from './db';
import { randomUUID } from 'crypto';

const db = () => getTestDb();

// ID generators
export const createId = (prefix: string) => `${prefix}_${randomUUID()}`;

// Timestamps
const now = () => new Date();

// Placeholder password hash (scrypt format for Better Auth)
const PLACEHOLDER_PASSWORD_HASH = '$scrypt$n=16384,r=8,p=1$placeholder$hash';

/**
 * Create a test user
 * Note: Creates both user and account records for Better Auth compatibility
 */
export async function createUser(
  overrides: Partial<typeof schema.users.$inferInsert> & { isAdmin?: boolean } = {}
) {
  const id = overrides.id ?? createId('user');
  const isAdmin = overrides.isAdmin ?? (overrides.role === 'admin');

  const userData = {
    id,
    name: overrides.name ?? 'Test User',
    email: overrides.email ?? `test-${id}@example.com`,
    emailVerified: overrides.emailVerified ?? false,
    image: overrides.image ?? null,
    role: isAdmin ? 'admin' : 'user',
    banned: overrides.banned ?? false,
    banReason: overrides.banReason ?? null,
    banExpires: overrides.banExpires ?? null,
    createdAt: now(),
    updatedAt: now(),
  };

  await db().insert(schema.users).values(userData);

  // Create credential account for password
  const accountData = {
    id: `acc_${id}`,
    userId: id,
    accountId: id,
    providerId: 'credential',
    password: PLACEHOLDER_PASSWORD_HASH,
    createdAt: now(),
    updatedAt: now(),
  };

  await db().insert(schema.accounts).values(accountData);

  // Return data with isAdmin convenience field
  return { ...userData, isAdmin };
}

/**
 * Create a test brand
 */
export async function createBrand(overrides: Partial<typeof schema.brands.$inferInsert> = {}) {
  const id = overrides.id ?? createId('brand');
  const data = {
    id,
    name: overrides.name ?? `Test Brand ${id.slice(-6)}`,
    createdAt: now(),
    updatedAt: now(),
  };

  await db().insert(schema.brands).values(data);
  return data;
}

/**
 * Create a test wrestler
 */
export async function createWrestler(
  brandId: string,
  overrides: Partial<typeof schema.wrestlers.$inferInsert> = {}
) {
  const id = overrides.id ?? createId('wrestler');
  const data = {
    id,
    currentName: overrides.currentName ?? `Wrestler ${id.slice(-6)}`,
    brandId,
    isActive: overrides.isActive ?? true,
    createdAt: now(),
    updatedAt: now(),
  };

  await db().insert(schema.wrestlers).values(data);
  return data;
}

/**
 * Create a test event
 */
export async function createEvent(
  brandId: string,
  overrides: Partial<typeof schema.events.$inferInsert> = {}
) {
  const id = overrides.id ?? createId('event');
  const data = {
    id,
    name: overrides.name ?? `Test Event ${id.slice(-6)}`,
    brandId,
    eventDate: overrides.eventDate ?? now(),
    status: overrides.status ?? 'open',
    createdAt: now(),
    updatedAt: now(),
  };

  await db().insert(schema.events).values(data);
  return data;
}

/**
 * Create a test match
 */
export async function createMatch(
  eventId: string,
  overrides: Partial<typeof schema.matches.$inferInsert> = {}
) {
  const id = overrides.id ?? createId('match');
  const data = {
    id,
    eventId,
    matchType: overrides.matchType ?? 'Singles',
    matchOrder: overrides.matchOrder ?? 1,
    unknownParticipants: overrides.unknownParticipants ?? false,
    isLocked: overrides.isLocked ?? false,
    outcome: overrides.outcome ?? null,
    winningSide: overrides.winningSide ?? null,
    winnerParticipantId: overrides.winnerParticipantId ?? null,
    createdAt: now(),
    updatedAt: now(),
  };

  await db().insert(schema.matches).values(data);
  return data;
}

/**
 * Create a match participant
 */
export async function createMatchParticipant(
  matchId: string,
  participantId: string,
  participantType: 'wrestler' | 'group',
  overrides: Partial<typeof schema.matchParticipants.$inferInsert> = {}
) {
  const id = overrides.id ?? createId('participant');
  const data = {
    id,
    matchId,
    side: overrides.side ?? 1,
    participantType,
    participantId,
    entryOrder: overrides.entryOrder ?? null,
    createdAt: now(),
  };

  await db().insert(schema.matchParticipants).values(data);
  return data;
}

/**
 * Create a match prediction
 */
export async function createMatchPrediction(
  userId: string,
  matchId: string,
  overrides: Partial<typeof schema.matchPredictions.$inferInsert> = {}
) {
  const id = overrides.id ?? createId('matchpred');
  const data = {
    id,
    userId,
    matchId,
    predictedSide: overrides.predictedSide ?? null,
    predictedParticipantId: overrides.predictedParticipantId ?? null,
    isCorrect: overrides.isCorrect ?? null,
    createdAt: now(),
    updatedAt: now(),
  };

  await db().insert(schema.matchPredictions).values(data);
  return data;
}

/**
 * Create a custom prediction template
 */
export async function createCustomPredictionTemplate(
  overrides: Partial<typeof schema.customPredictionTemplates.$inferInsert> = {}
) {
  const id = overrides.id ?? createId('template');
  const data = {
    id,
    name: overrides.name ?? `Template ${id.slice(-6)}`,
    description: overrides.description ?? null,
    predictionType: overrides.predictionType ?? 'count',
    createdAt: now(),
    updatedAt: now(),
  };

  await db().insert(schema.customPredictionTemplates).values(data);
  return data;
}

/**
 * Create an event custom prediction
 */
export async function createEventCustomPrediction(
  eventId: string,
  templateId: string,
  overrides: Partial<typeof schema.eventCustomPredictions.$inferInsert> = {}
) {
  const id = overrides.id ?? createId('eventcustompred');
  const data = {
    id,
    eventId,
    templateId,
    question: overrides.question ?? 'Test question?',
    answerTime: overrides.answerTime ?? null,
    answerCount: overrides.answerCount ?? null,
    answerWrestlerId: overrides.answerWrestlerId ?? null,
    answerBoolean: overrides.answerBoolean ?? null,
    answerText: overrides.answerText ?? null,
    isScored: overrides.isScored ?? false,
    createdAt: now(),
    updatedAt: now(),
  };

  await db().insert(schema.eventCustomPredictions).values(data);
  return data;
}

/**
 * Create a user custom prediction
 */
export async function createUserCustomPrediction(
  userId: string,
  eventCustomPredictionId: string,
  overrides: Partial<typeof schema.userCustomPredictions.$inferInsert> = {}
) {
  const id = overrides.id ?? createId('custompred');
  const data = {
    id,
    userId,
    eventCustomPredictionId,
    predictionTime: overrides.predictionTime ?? null,
    predictionCount: overrides.predictionCount ?? null,
    predictionWrestlerId: overrides.predictionWrestlerId ?? null,
    predictionBoolean: overrides.predictionBoolean ?? null,
    predictionText: overrides.predictionText ?? null,
    isCorrect: overrides.isCorrect ?? null,
    createdAt: now(),
    updatedAt: now(),
  };

  await db().insert(schema.userCustomPredictions).values(data);
  return data;
}

/**
 * Create a user event join record
 */
export async function createContrarian(
  userId: string,
  eventId: string,
  overrides: { mode?: 'normal' | 'contrarian'; didWinContrarian?: boolean | null } = {}
) {
  const id = createId('usereventjoin');
  const data = {
    id,
    userId,
    eventId,
    mode: overrides.mode ?? 'normal',
    didWinContrarian: overrides.didWinContrarian ?? null,
    createdAt: now(),
    updatedAt: now(),
  };

  await db().insert(schema.userEventJoin).values(data);
  return data;
}

/**
 * Join an event (convenience wrapper for createContrarian)
 */
export async function joinEvent(
  userId: string,
  eventId: string,
  mode: 'normal' | 'contrarian' = 'normal'
) {
  return createContrarian(userId, eventId, { mode });
}

/**
 * Create a complete test scenario with brand, event, matches, and wrestlers
 */
export async function createTestScenario() {
  const brand = await createBrand({ name: 'Test Brand' });
  const wrestler1 = await createWrestler(brand.id, { currentName: 'Wrestler One' });
  const wrestler2 = await createWrestler(brand.id, { currentName: 'Wrestler Two' });
  const event = await createEvent(brand.id, { name: 'Test Event', status: 'open' });
  const match = await createMatch(event.id, { matchType: 'Singles', matchOrder: 1 });

  const participant1 = await createMatchParticipant(match.id, wrestler1.id, 'wrestler', { side: 1 });
  const participant2 = await createMatchParticipant(match.id, wrestler2.id, 'wrestler', { side: 2 });

  const user = await createUser({ name: 'Test User' });

  return {
    brand,
    wrestler1,
    wrestler2,
    event,
    match,
    participant1,
    participant2,
    user,
  };
}
