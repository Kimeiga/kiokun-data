CREATE TABLE IF NOT EXISTS `sync_tombstones` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`entity` text NOT NULL,
	`entityId` text NOT NULL,
	`deletedAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `sync_tombstones_user_entity_unique`
ON `sync_tombstones` (`userId`, `entity`, `entityId`);
