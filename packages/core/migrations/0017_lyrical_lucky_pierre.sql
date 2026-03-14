CREATE TABLE `resource_links` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`provider` text NOT NULL,
	`resource_type` text NOT NULL,
	`label` text,
	`url` text NOT NULL,
	`external_id` text,
	`meta` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_resource_links_entity` ON `resource_links` (`entity_type`,`entity_id`);