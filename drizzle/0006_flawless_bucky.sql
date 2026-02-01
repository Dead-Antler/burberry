ALTER TABLE `tagTeamMembers` RENAME TO `groupMembers`;--> statement-breakpoint
ALTER TABLE `tagTeams` RENAME TO `groups`;--> statement-breakpoint
ALTER TABLE `groupMembers` RENAME COLUMN "tagTeamId" TO "groupId";--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_groupMembers` (
	`id` text PRIMARY KEY NOT NULL,
	`groupId` text NOT NULL,
	`wrestlerId` text NOT NULL,
	`joinedAt` integer NOT NULL,
	`leftAt` integer,
	`createdAt` integer,
	FOREIGN KEY (`groupId`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`wrestlerId`) REFERENCES `wrestlers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_groupMembers`("id", "groupId", "wrestlerId", "joinedAt", "leftAt", "createdAt") SELECT "id", "groupId", "wrestlerId", "joinedAt", "leftAt", "createdAt" FROM `groupMembers`;--> statement-breakpoint
DROP TABLE `groupMembers`;--> statement-breakpoint
ALTER TABLE `__new_groupMembers` RENAME TO `groupMembers`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `groupMembers_groupId_idx` ON `groupMembers` (`groupId`);--> statement-breakpoint
CREATE INDEX `groupMembers_wrestlerId_idx` ON `groupMembers` (`wrestlerId`);--> statement-breakpoint
CREATE TABLE `__new_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`brandId` text NOT NULL,
	`isActive` integer DEFAULT true NOT NULL,
	`createdAt` integer,
	`updatedAt` integer,
	FOREIGN KEY (`brandId`) REFERENCES `brands`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_groups`("id", "name", "brandId", "isActive", "createdAt", "updatedAt") SELECT "id", "name", "brandId", "isActive", "createdAt", "updatedAt" FROM `groups`;--> statement-breakpoint
DROP TABLE `groups`;--> statement-breakpoint
ALTER TABLE `__new_groups` RENAME TO `groups`;--> statement-breakpoint
CREATE INDEX `groups_brandId_idx` ON `groups` (`brandId`);