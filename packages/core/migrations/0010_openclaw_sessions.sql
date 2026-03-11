CREATE TABLE `openclaw_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`connection_id` text NOT NULL,
	`session_key` text NOT NULL,
	`agent_id` text,
	`model` text,
	`status` text DEFAULT 'active' NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`metadata` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`connection_id`) REFERENCES `openclaw_connections`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `openclaw_sessions_connection_session_key_unique`
  ON `openclaw_sessions` (`connection_id`, `session_key`);
