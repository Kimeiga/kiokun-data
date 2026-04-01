CREATE TABLE `artifact_images` (
	`id` text PRIMARY KEY NOT NULL,
	`artifactId` text NOT NULL,
	`imageUrl` text NOT NULL,
	`sortOrder` integer DEFAULT 0 NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`artifactId`) REFERENCES `artifacts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `artifact_sentences` (
	`id` text PRIMARY KEY NOT NULL,
	`artifactId` text NOT NULL,
	`originalText` text NOT NULL,
	`translation` text,
	`sortOrder` integer DEFAULT 0 NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`artifactId`) REFERENCES `artifacts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `artifacts` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`language` text NOT NULL,
	`type` text DEFAULT 'other' NOT NULL,
	`isPublic` integer DEFAULT true NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `sentence_words` (
	`id` text PRIMARY KEY NOT NULL,
	`sentenceId` text NOT NULL,
	`wordSlug` text NOT NULL,
	`surfaceForm` text NOT NULL,
	`position` integer NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`sentenceId`) REFERENCES `artifact_sentences`(`id`) ON UPDATE no action ON DELETE cascade
);
