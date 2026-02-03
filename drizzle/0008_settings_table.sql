-- Settings Table Migration
-- Creates application settings table for storing global configuration

CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`scope` text DEFAULT 'global' NOT NULL,
	`type` text NOT NULL,
	`value` text NOT NULL,
	`createdAt` integer,
	`updatedAt` integer
);
