CREATE TABLE `study_card_contexts` (
	`id` text PRIMARY KEY NOT NULL,
	`cardId` text NOT NULL,
	`sentence` text NOT NULL,
	`translation` text,
	`language` text NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`cardId`) REFERENCES `study_cards`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `study_card_contexts_cardId_sentence_unique` ON `study_card_contexts` (`cardId`,`sentence`);--> statement-breakpoint
ALTER TABLE `notes` ADD `isPublic` integer DEFAULT false NOT NULL;