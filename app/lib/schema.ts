import { sqliteTable, text, integer, unique, index } from 'drizzle-orm/sqlite-core';

// ============================================================================
// User Management
// ============================================================================

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  name: text('name'),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  createdAt: integer('createdAt', { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
  updatedAt: integer('updatedAt', { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
});

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

export const tagTeams = sqliteTable('tagTeams', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  brandId: text('brandId').notNull().references(() => brands.id),
  isActive: integer('isActive', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('createdAt', { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
  updatedAt: integer('updatedAt', { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
}, (table) => ({
  brandIdx: index('tagTeams_brandId_idx').on(table.brandId),
}));

export const tagTeamMembers = sqliteTable('tagTeamMembers', {
  id: text('id').primaryKey(),
  tagTeamId: text('tagTeamId').notNull().references(() => tagTeams.id),
  wrestlerId: text('wrestlerId').notNull().references(() => wrestlers.id),
  joinedAt: integer('joinedAt', { mode: 'timestamp_ms' }).notNull(),
  leftAt: integer('leftAt', { mode: 'timestamp_ms' }),
  createdAt: integer('createdAt', { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
}, (table) => ({
  tagTeamIdx: index('tagTeamMembers_tagTeamId_idx').on(table.tagTeamId),
  wrestlerIdx: index('tagTeamMembers_wrestlerId_idx').on(table.wrestlerId),
}));

export const championships = sqliteTable('championships', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  brandId: text('brandId').notNull().references(() => brands.id),
  isActive: integer('isActive', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('createdAt', { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
  updatedAt: integer('updatedAt', { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
}, (table) => ({
  brandIdx: index('championships_brandId_idx').on(table.brandId),
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
  createdAt: integer('createdAt', { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
  updatedAt: integer('updatedAt', { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
}, (table) => ({
  brandIdx: index('events_brandId_idx').on(table.brandId),
  statusIdx: index('events_status_idx').on(table.status),
}));

export const matches = sqliteTable('matches', {
  id: text('id').primaryKey(),
  eventId: text('eventId').notNull().references(() => events.id),
  matchType: text('matchType').notNull(),
  matchOrder: integer('matchOrder').notNull(),
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
  createdAt: integer('createdAt', { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
}, (table) => ({
  matchIdx: index('matchParticipants_matchId_idx').on(table.matchId),
  participantIdx: index('matchParticipants_participantId_idx').on(table.participantId),
}));

export const matchCombatantChampionships = sqliteTable('matchCombatantChampionships', {
  id: text('id').primaryKey(),
  matchId: text('matchId').notNull().references(() => matches.id),
  championshipId: text('championshipId').notNull().references(() => championships.id),
  participantType: text('participantType').notNull(),
  participantId: text('participantId').notNull(),
  createdAt: integer('createdAt', { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
}, (table) => ({
  matchIdx: index('matchCombatantChampionships_matchId_idx').on(table.matchId),
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
  userEventPredictionUnique: unique('userCustomPredictions_userId_eventCustomPredictionId')
    .on(table.userId, table.eventCustomPredictionId),
}));

export const userEventContrarian = sqliteTable('userEventContrarian', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull().references(() => users.id),
  eventId: text('eventId').notNull().references(() => events.id),
  isContrarian: integer('isContrarian', { mode: 'boolean' }).notNull().default(false),
  didWinContrarian: integer('didWinContrarian', { mode: 'boolean' }),
  createdAt: integer('createdAt', { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
  updatedAt: integer('updatedAt', { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
}, (table) => ({
  userIdx: index('userEventContrarian_userId_idx').on(table.userId),
  eventIdx: index('userEventContrarian_eventId_idx').on(table.eventId),
  userEventUnique: unique('userEventContrarian_userId_eventId').on(table.userId, table.eventId),
}));
