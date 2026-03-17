CREATE TABLE IF NOT EXISTS `sync_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`connection_id` text,
	`sync_type` text DEFAULT 'manual' NOT NULL,
	`status` text DEFAULT 'running' NOT NULL,
	`started_at` integer DEFAULT (unixepoch()) NOT NULL,
	`completed_at` integer,
	`agent_count` integer DEFAULT 0 NOT NULL,
	`cron_job_count` integer DEFAULT 0 NOT NULL,
	`workspace_count` integer DEFAULT 0 NOT NULL,
	`added_count` integer DEFAULT 0 NOT NULL,
	`updated_count` integer DEFAULT 0 NOT NULL,
	`removed_count` integer DEFAULT 0 NOT NULL,
	`error` text,
	`meta` text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `sync_run_items` (
	`id` text PRIMARY KEY NOT NULL,
	`sync_run_id` text NOT NULL,
	`item_type` text NOT NULL,
	`item_external_id` text NOT NULL,
	`change_type` text NOT NULL,
	`summary` text,
	`meta` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`sync_run_id`) REFERENCES `sync_runs`(`id`) ON UPDATE no action ON DELETE no action
);
