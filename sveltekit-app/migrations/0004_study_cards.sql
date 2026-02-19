-- Create study_cards table for spaced repetition system
CREATE TABLE IF NOT EXISTS `study_cards` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`word` text NOT NULL,
	`language` text NOT NULL,
	`easeFactor` real DEFAULT 2.5 NOT NULL,
	`interval` integer DEFAULT 0 NOT NULL,
	`repetitions` integer DEFAULT 0 NOT NULL,
	`nextReview` integer NOT NULL,
	`lastReviewed` integer,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `study_cards_user_word_unique` ON `study_cards` (`userId`, `word`);
--> statement-breakpoint
CREATE INDEX `study_cards_next_review_idx` ON `study_cards` (`userId`, `nextReview`);
--> statement-breakpoint
CREATE INDEX `study_cards_language_idx` ON `study_cards` (`userId`, `language`);

