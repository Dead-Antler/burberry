import { sqliteTable, text, integer, unique, index } from 'drizzle-orm/sqlite-core';

// ============================================================================
// Better Auth Tables
// ============================================================================

/**
 * Users table - Core user data
 * Note: Password is stored in the accounts table (for credential provider)
 */
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  name: text('name'),
  email: text('email').notNull().unique(),
  emailVerified: integer('emailVerified', { mode: 'boolean' }).notNull().default(false),
  image: text('image'),
  // Role-based access control (admin plugin)
  role: text('role').default('user'),
  banned: integer('banned', { mode: 'boolean' }).default(false),
  banReason: text('banReason'),
  banExpires: integer('banExpires', { mode: 'timestamp_ms' }),
  createdAt: integer('createdAt', { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
  updatedAt: integer('updatedAt', { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
});

/**
 * Sessions table - Database-backed sessions (replaces JWT)
 */
export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: integer('expiresAt', { mode: 'timestamp_ms' }).notNull(),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  // Admin plugin: tracks if session is impersonated
  impersonatedBy: text('impersonatedBy'),
  createdAt: integer('createdAt', { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
  updatedAt: integer('updatedAt', { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
}, (table) => ({
  userIdx: index('sessions_userId_idx').on(table.userId),
  tokenIdx: index('sessions_token_idx').on(table.token),
}));

/**
 * Accounts table - Auth provider accounts (credential, OAuth, etc.)
 * For email/password auth, password is stored here with providerId="credential"
 */
export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  accountId: text('accountId').notNull(), // For credentials, this equals oduserId
  providerId: text('providerId').notNull(), // "credential" for email/password
  // OAuth fields (not used for credentials)
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  accessTokenExpiresAt: integer('accessTokenExpiresAt', { mode: 'timestamp_ms' }),
  refreshTokenExpiresAt: integer('refreshTokenExpiresAt', { mode: 'timestamp_ms' }),
  scope: text('scope'),
  idToken: text('idToken'),
  // Password for credential provider
  password: text('password'),
  createdAt: integer('createdAt', { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
  updatedAt: integer('updatedAt', { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
}, (table) => ({
  userIdx: index('accounts_userId_idx').on(table.userId),
  providerAccountIdx: unique('accounts_providerId_accountId').on(table.providerId, table.accountId),
}));

/**
 * Verifications table - Email verification tokens, password reset, etc.
 */
export const verifications = sqliteTable('verifications', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(), // Usually email address
  value: text('value').notNull(), // The token
  expiresAt: integer('expiresAt', { mode: 'timestamp_ms' }).notNull(),
  createdAt: integer('createdAt', { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
  updatedAt: integer('updatedAt', { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
}, (table) => ({
  identifierIdx: index('verifications_identifier_idx').on(table.identifier),
}));

// ============================================================================
// Core Wrestling Data
// ============================================================================

export const brands = sqliteTable('brands', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  createdAt: integer('createdAt', { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
  updatedAt: integer('updatedAt', { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
});

export const wrestlers = sqliteTable('wrestlers', {
  id: text('id').primaryKey(),
  currentName: text('currentName').notNull(),
  brandId: text('brandId').notNull().references(() => brands.id),
  isActive: integer('isActive', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('createdAt', { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
  updatedAt: integer('updatedAt', { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
}, (table) => ({
  brandIdx: index('wrestlers_brandId_idx').on(table.brandId),
}));

export const wrestlerNames = sqliteTable('wrestlerNames', {
  id: text('id').primaryKey(),
  wrestlerId: text('wrestlerId').notNull().references(() => wrestlers.id),
  name: text('name').notNull(),
  validFrom: integer('validFrom', { mode: 'timestamp_ms' }).notNull(),
  validTo: integer('validTo', { mode: 'timestamp_ms' }),
  createdAt: integer('createdAt', { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
}, (table) => ({
  wrestlerIdx: index('wrestlerNames_wrestlerId_idx').on(table.wrestlerId),
}));

export const groups = sqliteTable('groups', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  brandId: text('brandId').notNull().references(() => brands.id),
  isActive: integer('isActive', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('createdAt', { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
  updatedAt: integer('updatedAt', { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
}, (table) => ({
  brandIdx: index('groups_brandId_idx').on(table.brandId),
}));

export const groupMembers = sqliteTable('groupMembers', {
  id: text('id').primaryKey(),
  groupId: text('groupId').notNull().references(() => groups.id),
  wrestlerId: text('wrestlerId').notNull().references(() => wrestlers.id),
  joinedAt: integer('joinedAt', { mode: 'timestamp_ms' }).notNull(),
  leftAt: integer('leftAt', { mode: 'timestamp_ms' }),
  createdAt: integer('createdAt', { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
}, (table) => ({
  groupIdx: index('groupMembers_groupId_idx').on(table.groupId),
  wrestlerIdx: index('groupMembers_wrestlerId_idx').on(table.wrestlerId),
}));

// ============================================================================
// Events & Matches
// ============================================================================

export const events = sqliteTable('events', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  brandId: text('brandId').notNull().references(() => brands.id),
  eventDate: integer('eventDate', { mode: 'timestamp_ms' }).notNull(),
  status: text('status').notNull().default('open'),
  hidePredictors: integer('hidePredictors', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('createdAt', { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
  updatedAt: integer('updatedAt', { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
}, (table) => ({
  brandIdx: index('events_brandId_idx').on(table.brandId),
  statusIdx: index('events_status_idx').on(table.status),
  statusEventDateIdx: index('events_status_eventDate_idx').on(table.status, table.eventDate),
}));

export const matches = sqliteTable('matches', {
  id: text('id').primaryKey(),
  eventId: text('eventId').notNull().references(() => events.id),
  matchType: text('matchType').notNull(),
  matchOrder: integer('matchOrder').notNull(),
  unknownParticipants: integer('unknownParticipants', { mode: 'boolean' }).notNull().default(false),
  isLocked: integer('isLocked', { mode: 'boolean' }).notNull().default(false),
  predictionDeadline: integer('predictionDeadline', { mode: 'timestamp_ms' }),
  outcome: text('outcome'),
  winningSide: integer('winningSide'),
  winnerParticipantId: text('winnerParticipantId'),
  createdAt: integer('createdAt', { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
  updatedAt: integer('updatedAt', { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
}, (table) => ({
  eventIdx: index('matches_eventId_idx').on(table.eventId),
  orderIdx: index('matches_matchOrder_idx').on(table.matchOrder),
}));

export const matchParticipants = sqliteTable('matchParticipants', {
  id: text('id').primaryKey(),
  matchId: text('matchId').notNull().references(() => matches.id),
  side: integer('side'),
  participantType: text('participantType').notNull(),
  participantId: text('participantId').notNull(),
  entryOrder: integer('entryOrder'),
  isChampion: integer('isChampion', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('createdAt', { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
}, (table) => ({
  matchIdx: index('matchParticipants_matchId_idx').on(table.matchId),
  participantIdx: index('matchParticipants_participantId_idx').on(table.participantId),
}));

// ============================================================================
// Prediction System
// ============================================================================

export const matchPredictions = sqliteTable('matchPredictions', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull().references(() => users.id),
  matchId: text('matchId').notNull().references(() => matches.id),
  predictedSide: integer('predictedSide'),
  predictedParticipantId: text('predictedParticipantId'),
  isCorrect: integer('isCorrect', { mode: 'boolean' }),
  createdAt: integer('createdAt', { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
  updatedAt: integer('updatedAt', { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
}, (table) => ({
  userIdx: index('matchPredictions_userId_idx').on(table.userId),
  matchIdx: index('matchPredictions_matchId_idx').on(table.matchId),
  userMatchUnique: unique('matchPredictions_userId_matchId').on(table.userId, table.matchId),
}));

export const customPredictionTemplates = sqliteTable('customPredictionTemplates', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  predictionType: text('predictionType').notNull(),
  createdAt: integer('createdAt', { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
  updatedAt: integer('updatedAt', { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
});

export const eventCustomPredictions = sqliteTable('eventCustomPredictions', {
  id: text('id').primaryKey(),
  eventId: text('eventId').notNull().references(() => events.id),
  templateId: text('templateId').notNull().references(() => customPredictionTemplates.id),
  question: text('question').notNull(),
  answerTime: integer('answerTime', { mode: 'timestamp_ms' }),
  answerCount: integer('answerCount'),
  answerWrestlerId: text('answerWrestlerId'),
  answerBoolean: integer('answerBoolean', { mode: 'boolean' }),
  answerText: text('answerText'),
  isScored: integer('isScored', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('createdAt', { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
  updatedAt: integer('updatedAt', { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
}, (table) => ({
  eventIdx: index('eventCustomPredictions_eventId_idx').on(table.eventId),
}));

export const userCustomPredictions = sqliteTable('userCustomPredictions', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull().references(() => users.id),
  eventCustomPredictionId: text('eventCustomPredictionId').notNull().references(() => eventCustomPredictions.id),
  predictionTime: integer('predictionTime', { mode: 'timestamp_ms' }),
  predictionCount: integer('predictionCount'),
  predictionWrestlerId: text('predictionWrestlerId'),
  predictionBoolean: integer('predictionBoolean', { mode: 'boolean' }),
  predictionText: text('predictionText'),
  isCorrect: integer('isCorrect', { mode: 'boolean' }),
  createdAt: integer('createdAt', { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
  updatedAt: integer('updatedAt', { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
}, (table) => ({
  userIdx: index('userCustomPredictions_userId_idx').on(table.userId),
  eventPredictionIdx: index('userCustomPredictions_eventCustomPredictionId_idx').on(table.eventCustomPredictionId),
}));

export const userEventJoin = sqliteTable('userEventJoin', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull().references(() => users.id),
  eventId: text('eventId').notNull().references(() => events.id),
  mode: text('mode').notNull().default('normal'), // 'normal' | 'contrarian'
  didWinContrarian: integer('didWinContrarian', { mode: 'boolean' }),
  createdAt: integer('createdAt', { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
  updatedAt: integer('updatedAt', { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
}, (table) => ({
  userIdx: index('userEventJoin_userId_idx').on(table.userId),
  eventIdx: index('userEventJoin_eventId_idx').on(table.eventId),
  // UNIQUE constraint automatically creates composite index for (userId, eventId) queries
  userEventUnique: unique('userEventJoin_userId_eventId').on(table.userId, table.eventId),
}));

export const wrestlerPredictionCooldowns = sqliteTable('wrestlerPredictionCooldowns', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull().references(() => users.id),
  wrestlerId: text('wrestlerId').notNull().references(() => wrestlers.id),
  brandId: text('brandId').notNull().references(() => brands.id),
  eventCustomPredictionId: text('eventCustomPredictionId').notNull().references(() => eventCustomPredictions.id),
  lastPredictedAt: integer('lastPredictedAt', { mode: 'timestamp_ms' }).notNull(),
  createdAt: integer('createdAt', { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
}, (table) => ({
  userIdx: index('wrestlerPredictionCooldowns_userId_idx').on(table.userId),
  wrestlerIdx: index('wrestlerPredictionCooldowns_wrestlerId_idx').on(table.wrestlerId),
  brandIdx: index('wrestlerPredictionCooldowns_brandId_idx').on(table.brandId),
  userWrestlerBrandUnique: unique('wrestlerPredictionCooldowns_userId_wrestlerId_brandId')
    .on(table.userId, table.wrestlerId, table.brandId),
}));

// ============================================================================
// Application Settings
// ============================================================================

/**
 * Global application settings
 * Keys are namespaced (e.g., 'predictions.reusable', 'ui.theme')
 * JSON values are validated against schemas defined in settings-schemas.ts
 */
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(), // Namespaced key, e.g., 'predictions.reusable'
  scope: text('scope').notNull().default('global'), // 'global' for now, future: 'user'
  type: text('type').notNull(), // 'string' | 'boolean' | 'number' | 'json'
  value: text('value').notNull(), // Stored as text, parsed based on type
  createdAt: integer('createdAt', { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
  updatedAt: integer('updatedAt', { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
});
