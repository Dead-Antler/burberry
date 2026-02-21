CREATE TABLE `customPredictionGroups` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`createdAt` integer,
	`updatedAt` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `customPredictionGroups_name_unique` ON `customPredictionGroups` (`name`);
--> statement-breakpoint
CREATE TABLE `customPredictionGroupMembers` (
	`id` text PRIMARY KEY NOT NULL,
	`groupId` text NOT NULL REFERENCES `customPredictionGroups`(`id`),
	`templateId` text NOT NULL REFERENCES `customPredictionTemplates`(`id`),
	`createdAt` integer
);
--> statement-breakpoint
CREATE INDEX `customPredictionGroupMembers_groupId_idx` ON `customPredictionGroupMembers` (`groupId`);
--> statement-breakpoint
CREATE UNIQUE INDEX `customPredictionGroupMembers_groupId_templateId` ON `customPredictionGroupMembers` (`groupId`, `templateId`);
