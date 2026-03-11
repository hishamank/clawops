CREATE TABLE `openclaw_agents` (
	`id` text PRIMARY KEY NOT NULL,
	`connection_id` text NOT NULL,
	`linked_agent_id` text NOT NULL,
	`external_agent_id` text NOT NULL,
	`external_agent_name` text NOT NULL,
	`workspace_path` text,
	`memory_path` text,
	`default_model` text,
	`role` text,
	`avatar` text,
	`last_seen_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`connection_id`) REFERENCES `openclaw_connections`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`linked_agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `openclaw_agents_connection_external_identity_unique`
  ON `openclaw_agents` (`connection_id`, `external_agent_id`);
