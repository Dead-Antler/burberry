DROP TABLE `championships`;--> statement-breakpoint
DROP TABLE `matchCombatantChampionships`;--> statement-breakpoint
ALTER TABLE `matchParticipants` ADD `isChampion` integer DEFAULT false NOT NULL;