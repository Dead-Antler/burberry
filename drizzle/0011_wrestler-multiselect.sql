-- Add pointsEarned column to userCustomPredictions for variable-point scoring (e.g., wrestler multi-select)
ALTER TABLE `userCustomPredictions` ADD COLUMN `pointsEarned` integer;
