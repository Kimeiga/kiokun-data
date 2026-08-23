CREATE TABLE `saved_sentence_words` (
	`id` text PRIMARY KEY NOT NULL,
	`sentenceId` text NOT NULL,
	`cardId` text NOT NULL,
	`surfaceForm` text NOT NULL,
	`position` integer NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`sentenceId`) REFERENCES `saved_sentences`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`cardId`) REFERENCES `study_cards`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `saved_sentence_words_sentenceId_position_unique` ON `saved_sentence_words` (`sentenceId`,`position`);--> statement-breakpoint
CREATE TABLE `saved_sentences` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`text` text NOT NULL,
	`language` text NOT NULL,
	`translation` text,
	`pinyin` text,
	`saveMode` text DEFAULT 'manual' NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `saved_sentences_userId_language_text_unique` ON `saved_sentences` (`userId`,`language`,`text`);--> statement-breakpoint
CREATE TABLE `study_card_deck_memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`cardId` text NOT NULL,
	`deck` text NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`cardId`) REFERENCES `study_cards`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `study_card_deck_memberships_cardId_deck_unique` ON `study_card_deck_memberships` (`cardId`,`deck`);--> statement-breakpoint
CREATE TABLE `sync_tombstones` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`entity` text NOT NULL,
	`entityId` text NOT NULL,
	`deletedAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sync_tombstones_userId_entity_entityId_unique` ON `sync_tombstones` (`userId`,`entity`,`entityId`);--> statement-breakpoint
CREATE TABLE `user_learning_settings` (
	`userId` text PRIMARY KEY NOT NULL,
	`autoSaveSentences` integer DEFAULT false NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `sentence_words` ADD `dictionaryForm` text;--> statement-breakpoint
ALTER TABLE `sentence_words` ADD `reading` text;--> statement-breakpoint
ALTER TABLE `sentence_words` ADD `gloss` text;--> statement-breakpoint
ALTER TABLE `sentence_words` ADD `conjugation` text;