CREATE TABLE `openclaw_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text DEFAULT 'openclaw' NOT NULL,
	`name` text NOT NULL,
	`root_path` text NOT NULL,
	`gateway_url` text,
	`status` text DEFAULT 'disconnected' NOT NULL,
	`sync_mode` text DEFAULT 'manual' NOT NULL,
	`has_gateway_token` integer DEFAULT false NOT NULL,
	`meta` text,
	`last_synced_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `openclaw_connections_root_path_unique` ON `openclaw_connections` (`root_path`);