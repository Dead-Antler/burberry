-- Add scoringMode and cooldownDays columns to customPredictionTemplates
ALTER TABLE `customPredictionTemplates` ADD COLUMN `scoringMode` text NOT NULL DEFAULT 'exact';--> statement-breakpoint
ALTER TABLE `customPredictionTemplates` ADD COLUMN `cooldownDays` integer;
