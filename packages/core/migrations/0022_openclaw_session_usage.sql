CREATE TABLE IF NOT EXISTS `openclaw_session_usage_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`connection_id` text NOT NULL,
	`openclaw_agent_id` text,
	`linked_agent_id` text,
	`session_id` text,
	`external_agent_id` text,
	`external_agent_name` text,
	`session_key` text NOT NULL,
	`session_file_path` text NOT NULL,
	`event_fingerprint` text NOT NULL,
	`event_timestamp` integer NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`model_alias` text,
	`tokens_in` integer DEFAULT 0 NOT NULL,
	`tokens_out` integer DEFAULT 0 NOT NULL,
	`cache_read` integer DEFAULT 0 NOT NULL,
	`cache_write` integer DEFAULT 0 NOT NULL,
	`total_tokens` integer DEFAULT 0 NOT NULL,
	`cost` real DEFAULT 0 NOT NULL,
	`message_type` text,
	`raw_usage` text,
	`raw_message` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`connection_id`) REFERENCES `openclaw_connections`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`openclaw_agent_id`) REFERENCES `openclaw_agents`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`linked_agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`session_id`) REFERENCES `openclaw_sessions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `openclaw_session_usage_entries_connection_fingerprint_unique` ON `openclaw_session_usage_entries` (`connection_id`,`event_fingerprint`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_openclaw_session_usage_entries_connection_timestamp` ON `openclaw_session_usage_entries` (`connection_id`,`event_timestamp`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_openclaw_session_usage_entries_agent_timestamp` ON `openclaw_session_usage_entries` (`linked_agent_id`,`event_timestamp`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_openclaw_session_usage_entries_model_timestamp` ON `openclaw_session_usage_entries` (`model`,`event_timestamp`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `openclaw_session_usage_cursors` (
	`id` text PRIMARY KEY NOT NULL,
	`connection_id` text NOT NULL,
	`external_agent_id` text,
	`session_file_path` text NOT NULL,
	`file_size_bytes` integer DEFAULT 0 NOT NULL,
	`file_mtime_ms` integer DEFAULT 0 NOT NULL,
	`last_byte_offset` integer DEFAULT 0 NOT NULL,
	`last_line_number` integer DEFAULT 0 NOT NULL,
	`last_synced_at` integer DEFAULT (unixepoch()) NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`connection_id`) REFERENCES `openclaw_connections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `openclaw_session_usage_cursors_connection_session_file_unique` ON `openclaw_session_usage_cursors` (`connection_id`,`session_file_path`);
