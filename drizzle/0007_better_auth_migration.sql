-- Better Auth Migration
-- This migration:
-- 1. Creates sessions, accounts, verifications tables
-- 2. Modifies users table (adds role, removes password, adds Better Auth fields)
-- 3. Migrates existing passwords to accounts table

-- ============================================================================
-- Step 1: Create new Better Auth tables
-- ============================================================================

-- Sessions table (database-backed sessions)
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`token` text NOT NULL,
	`expiresAt` integer NOT NULL,
	`ipAddress` text,
	`userAgent` text,
	`impersonatedBy` text,
	`createdAt` integer,
	`updatedAt` integer,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_userId_idx` ON `sessions` (`userId`);
--> statement-breakpoint
CREATE INDEX `sessions_token_idx` ON `sessions` (`token`);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_unique` ON `sessions` (`token`);
--> statement-breakpoint

-- Accounts table (stores credentials and OAuth tokens)
CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`accountId` text NOT NULL,
	`providerId` text NOT NULL,
	`accessToken` text,
	`refreshToken` text,
	`accessTokenExpiresAt` integer,
	`refreshTokenExpiresAt` integer,
	`scope` text,
	`idToken` text,
	`password` text,
	`createdAt` integer,
	`updatedAt` integer,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `accounts_userId_idx` ON `accounts` (`userId`);
--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_providerId_accountId` ON `accounts` (`providerId`, `accountId`);
--> statement-breakpoint

-- Verifications table (email verification, password reset tokens)
CREATE TABLE `verifications` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expiresAt` integer NOT NULL,
	`createdAt` integer,
	`updatedAt` integer
);
--> statement-breakpoint
CREATE INDEX `verifications_identifier_idx` ON `verifications` (`identifier`);
--> statement-breakpoint

-- ============================================================================
-- Step 2: Migrate users table structure
-- ============================================================================

-- Disable foreign keys temporarily for the table swap
PRAGMA foreign_keys=OFF;
--> statement-breakpoint

-- Create new users table with Better Auth schema
CREATE TABLE `__new_users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`email` text NOT NULL,
	`emailVerified` integer DEFAULT false NOT NULL,
	`image` text,
	`role` text DEFAULT 'user',
	`banned` integer DEFAULT false,
	`banReason` text,
	`banExpires` integer,
	`createdAt` integer,
	`updatedAt` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `__new_users_email_unique` ON `__new_users` (`email`);
--> statement-breakpoint

-- Migrate user data, converting isAdmin to role
INSERT INTO `__new_users`(
	`id`, `name`, `email`, `emailVerified`, `image`, `role`, `banned`, `banReason`, `banExpires`, `createdAt`, `updatedAt`
)
SELECT
	`id`,
	`name`,
	`email`,
	false, -- emailVerified
	NULL, -- image
	CASE WHEN `isAdmin` = 1 THEN 'admin' ELSE 'user' END, -- Convert isAdmin to role
	false, -- banned
	NULL, -- banReason
	NULL, -- banExpires
	`createdAt`,
	`updatedAt`
FROM `users`;
--> statement-breakpoint

-- Migrate passwords to accounts table (credential provider)
INSERT INTO `accounts`(
	`id`, `userId`, `accountId`, `providerId`, `password`, `createdAt`, `updatedAt`
)
SELECT
	'acc_' || `id`, -- Generate account ID from user ID
	`id`, -- userId
	`id`, -- accountId (same as userId for credentials)
	'credential', -- providerId
	`password`, -- password hash
	`createdAt`,
	`updatedAt`
FROM `users`;
--> statement-breakpoint

-- Drop old users table
DROP TABLE `users`;
--> statement-breakpoint

-- Rename new table to users
ALTER TABLE `__new_users` RENAME TO `users`;
--> statement-breakpoint

-- Re-enable foreign keys
PRAGMA foreign_keys=ON;
