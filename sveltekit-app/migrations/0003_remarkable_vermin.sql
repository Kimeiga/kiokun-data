CREATE TABLE `custom_words` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`word` text NOT NULL,
	`language` text NOT NULL,
	`simplified` text,
	`traditional` text,
	`pinyin` text,
	`jyutping` text,
	`kanji` text,
	`kana` text,
	`hangul` text,
	`hanja` text,
	`partOfSpeech` text,
	`definitions` text NOT NULL,
	`notes` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `custom_words_word_unique` ON `custom_words` (`word`);