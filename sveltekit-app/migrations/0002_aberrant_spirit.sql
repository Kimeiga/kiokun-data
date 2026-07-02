CREATE TABLE `extracted_words` (
	`id` text PRIMARY KEY NOT NULL,
	`videoPostId` text NOT NULL,
	`word` text NOT NULL,
	`wordSlug` text NOT NULL,
	`reading` text,
	`translation` text NOT NULL,
	`context` text,
	`timestamp` integer,
	`sortOrder` integer DEFAULT 0 NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`videoPostId`) REFERENCES `video_posts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `language_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`languageCode` text NOT NULL,
	`createdAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `language_categories_slug_unique` ON `language_categories` (`slug`);--> statement-breakpoint
CREATE TABLE `resource_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`languageCategoryId` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`sourceType` text NOT NULL,
	`sourceUrl` text NOT NULL,
	`sourceIdentifier` text,
	`description` text,
	`thumbnailUrl` text,
	`isActive` integer DEFAULT true NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`languageCategoryId`) REFERENCES `language_categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `resource_sources_languageCategoryId_slug_unique` ON `resource_sources` (`languageCategoryId`,`slug`);--> statement-breakpoint
CREATE TABLE `study_cards` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`word` text NOT NULL,
	`language` text NOT NULL,
	`easeFactor` integer DEFAULT 250 NOT NULL,
	`interval` integer DEFAULT 0 NOT NULL,
	`repetitions` integer DEFAULT 0 NOT NULL,
	`nextReview` integer NOT NULL,
	`lastReviewed` integer,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `study_cards_userId_word_unique` ON `study_cards` (`userId`,`word`);--> statement-breakpoint
CREATE TABLE `video_posts` (
	`id` text PRIMARY KEY NOT NULL,
	`resourceSourceId` text NOT NULL,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`videoUrl` text NOT NULL,
	`videoId` text NOT NULL,
	`thumbnailUrl` text,
	`duration` integer,
	`publishedAt` integer,
	`transcript` text,
	`summary` text,
	`viewCount` integer,
	`isProcessed` integer DEFAULT false NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`resourceSourceId`) REFERENCES `resource_sources`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `video_posts_resourceSourceId_slug_unique` ON `video_posts` (`resourceSourceId`,`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `video_posts_videoId_unique` ON `video_posts` (`videoId`);