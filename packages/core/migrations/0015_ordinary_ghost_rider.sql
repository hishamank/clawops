CREATE TABLE `agent_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`connection_id` text NOT NULL,
	`from_agent_id` text,
	`to_agent_id` text,
	`session_id` text,
	`channel` text,
	`message_type` text,
	`summary` text,
	`content` text,
	`meta` text,
	`sent_at` integer DEFAULT (unixepoch()) NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`connection_id`) REFERENCES `openclaw_connections`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`session_id`) REFERENCES `openclaw_sessions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_agent_messages_connection_sent` ON `agent_messages` (`connection_id`,`sent_at`);--> statement-breakpoint
CREATE INDEX `idx_agent_messages_from_agent` ON `agent_messages` (`from_agent_id`);--> statement-breakpoint
CREATE INDEX `idx_agent_messages_to_agent` ON `agent_messages` (`to_agent_id`);
