CREATE TABLE `brands` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`createdAt` integer,
	`updatedAt` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `brands_name_unique` ON `brands` (`name`);--> statement-breakpoint
CREATE TABLE `championships` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`brandId` text NOT NULL,
	`isActive` integer DEFAULT true NOT NULL,
	`createdAt` integer,
	`updatedAt` integer,
	FOREIGN KEY (`brandId`) REFERENCES `brands`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `championships_brandId_idx` ON `championships` (`brandId`);--> statement-breakpoint
CREATE TABLE `customPredictionTemplates` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`predictionType` text NOT NULL,
	`createdAt` integer,
	`updatedAt` integer
);
--> statement-breakpoint
CREATE TABLE `eventCustomPredictions` (
	`id` text PRIMARY KEY NOT NULL,
	`eventId` text NOT NULL,
	`templateId` text NOT NULL,
	`question` text NOT NULL,
	`answerTime` integer,
	`answerCount` integer,
	`answerWrestlerId` text,
	`answerBoolean` integer,
	`answerText` text,
	`isScored` integer DEFAULT false NOT NULL,
	`createdAt` integer,
	`updatedAt` integer,
	FOREIGN KEY (`eventId`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`templateId`) REFERENCES `customPredictionTemplates`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `eventCustomPredictions_eventId_idx` ON `eventCustomPredictions` (`eventId`);--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`brandId` text NOT NULL,
	`eventDate` integer NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`createdAt` integer,
	`updatedAt` integer,
	FOREIGN KEY (`brandId`) REFERENCES `brands`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `events_brandId_idx` ON `events` (`brandId`);--> statement-breakpoint
CREATE INDEX `events_status_idx` ON `events` (`status`);--> statement-breakpoint
CREATE TABLE `matchCombatantChampionships` (
	`id` text PRIMARY KEY NOT NULL,
	`matchId` text NOT NULL,
	`championshipId` text NOT NULL,
	`participantType` text NOT NULL,
	`participantId` text NOT NULL,
	`createdAt` integer,
	FOREIGN KEY (`matchId`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`championshipId`) REFERENCES `championships`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `matchCombatantChampionships_matchId_idx` ON `matchCombatantChampionships` (`matchId`);--> statement-breakpoint
CREATE TABLE `matchParticipants` (
	`id` text PRIMARY KEY NOT NULL,
	`matchId` text NOT NULL,
	`side` integer,
	`participantType` text NOT NULL,
	`participantId` text NOT NULL,
	`entryOrder` integer,
	`createdAt` integer,
	FOREIGN KEY (`matchId`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `matchParticipants_matchId_idx` ON `matchParticipants` (`matchId`);--> statement-breakpoint
CREATE INDEX `matchParticipants_participantId_idx` ON `matchParticipants` (`participantId`);--> statement-breakpoint
CREATE TABLE `matchPredictions` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`matchId` text NOT NULL,
	`predictedSide` integer,
	`predictedParticipantId` text,
	`isCorrect` integer,
	`createdAt` integer,
	`updatedAt` integer,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`matchId`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `matchPredictions_userId_idx` ON `matchPredictions` (`userId`);--> statement-breakpoint
CREATE INDEX `matchPredictions_matchId_idx` ON `matchPredictions` (`matchId`);--> statement-breakpoint
CREATE UNIQUE INDEX `matchPredictions_userId_matchId` ON `matchPredictions` (`userId`,`matchId`);--> statement-breakpoint
CREATE TABLE `matches` (
	`id` text PRIMARY KEY NOT NULL,
	`eventId` text NOT NULL,
	`matchType` text NOT NULL,
	`matchOrder` integer NOT NULL,
	`outcome` text,
	`winningSide` integer,
	`winnerParticipantId` text,
	`createdAt` integer,
	`updatedAt` integer,
	FOREIGN KEY (`eventId`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `matches_eventId_idx` ON `matches` (`eventId`);--> statement-breakpoint
CREATE INDEX `matches_matchOrder_idx` ON `matches` (`matchOrder`);--> statement-breakpoint
CREATE TABLE `tagTeamMembers` (
	`id` text PRIMARY KEY NOT NULL,
	`tagTeamId` text NOT NULL,
	`wrestlerId` text NOT NULL,
	`joinedAt` integer NOT NULL,
	`leftAt` integer,
	`createdAt` integer,
	FOREIGN KEY (`tagTeamId`) REFERENCES `tagTeams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`wrestlerId`) REFERENCES `wrestlers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `tagTeamMembers_tagTeamId_idx` ON `tagTeamMembers` (`tagTeamId`);--> statement-breakpoint
CREATE INDEX `tagTeamMembers_wrestlerId_idx` ON `tagTeamMembers` (`wrestlerId`);--> statement-breakpoint
CREATE TABLE `tagTeams` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`brandId` text NOT NULL,
	`isActive` integer DEFAULT true NOT NULL,
	`createdAt` integer,
	`updatedAt` integer,
	FOREIGN KEY (`brandId`) REFERENCES `brands`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `tagTeams_brandId_idx` ON `tagTeams` (`brandId`);--> statement-breakpoint
CREATE TABLE `userCustomPredictions` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`eventCustomPredictionId` text NOT NULL,
	`predictionTime` integer,
	`predictionCount` integer,
	`predictionWrestlerId` text,
	`predictionBoolean` integer,
	`predictionText` text,
	`isCorrect` integer,
	`createdAt` integer,
	`updatedAt` integer,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`eventCustomPredictionId`) REFERENCES `eventCustomPredictions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `userCustomPredictions_userId_idx` ON `userCustomPredictions` (`userId`);--> statement-breakpoint
CREATE INDEX `userCustomPredictions_eventCustomPredictionId_idx` ON `userCustomPredictions` (`eventCustomPredictionId`);--> statement-breakpoint
CREATE UNIQUE INDEX `userCustomPredictions_userId_eventCustomPredictionId` ON `userCustomPredictions` (`userId`,`eventCustomPredictionId`);--> statement-breakpoint
CREATE TABLE `userEventContrarian` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`eventId` text NOT NULL,
	`isContrarian` integer DEFAULT false NOT NULL,
	`didWinContrarian` integer,
	`createdAt` integer,
	`updatedAt` integer,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`eventId`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `userEventContrarian_userId_idx` ON `userEventContrarian` (`userId`);--> statement-breakpoint
CREATE INDEX `userEventContrarian_eventId_idx` ON `userEventContrarian` (`eventId`);--> statement-breakpoint
CREATE UNIQUE INDEX `userEventContrarian_userId_eventId` ON `userEventContrarian` (`userId`,`eventId`);--> statement-breakpoint
CREATE TABLE `wrestlerNames` (
	`id` text PRIMARY KEY NOT NULL,
	`wrestlerId` text NOT NULL,
	`name` text NOT NULL,
	`validFrom` integer NOT NULL,
	`validTo` integer,
	`createdAt` integer,
	FOREIGN KEY (`wrestlerId`) REFERENCES `wrestlers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `wrestlerNames_wrestlerId_idx` ON `wrestlerNames` (`wrestlerId`);--> statement-breakpoint
CREATE TABLE `wrestlers` (
	`id` text PRIMARY KEY NOT NULL,
	`currentName` text NOT NULL,
	`brandId` text NOT NULL,
	`isActive` integer DEFAULT true NOT NULL,
	`createdAt` integer,
	`updatedAt` integer,
	FOREIGN KEY (`brandId`) REFERENCES `brands`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `wrestlers_brandId_idx` ON `wrestlers` (`brandId`);