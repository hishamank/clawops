CREATE TABLE `workspace_files` (
	`id` text PRIMARY KEY NOT NULL,
	`connection_id` text NOT NULL,
	`workspace_path` text NOT NULL,
	`relative_path` text NOT NULL,
	`file_hash` text,
	`size_bytes` integer,
	`last_seen_at` integer DEFAULT (unixepoch()) NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`connection_id`) REFERENCES `openclaw_connections`(`id`) ON UPDATE no action ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workspace_files_connection_relative_path_unique`
  ON `workspace_files` (`connection_id`, `relative_path`);
