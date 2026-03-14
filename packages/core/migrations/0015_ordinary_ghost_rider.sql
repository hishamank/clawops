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
CREATE INDEX `idx_agent_messages_to_agent` ON `agent_messages` (`to_agent_id`);--> statement-breakpoint
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
CREATE UNIQUE INDEX `openclaw_agents_connection_external_identity_unique` ON `openclaw_agents` (`connection_id`,`external_agent_id`);--> statement-breakpoint
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
	FOREIGN KEY (`connection_id`) REFERENCES `openclaw_connections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `openclaw_sessions_connection_session_key_unique` ON `openclaw_sessions` (`connection_id`,`session_key`);--> statement-breakpoint
CREATE TABLE `workflow_definitions` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`version` text DEFAULT '1' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`project_id` text,
	`trigger_type` text DEFAULT 'manual' NOT NULL,
	`trigger_config` text,
	`steps` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_workflow_definitions_project_status` ON `workflow_definitions` (`project_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_workflow_definitions_status` ON `workflow_definitions` (`status`);--> statement-breakpoint
CREATE TABLE `workflow_run_steps` (
	`id` text PRIMARY KEY NOT NULL,
	`workflow_run_id` text NOT NULL,
	`step_index` integer NOT NULL,
	`step_key` text NOT NULL,
	`step_name` text NOT NULL,
	`step_type` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`input` text,
	`result` text,
	`error` text,
	`started_at` integer,
	`completed_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`workflow_run_id`) REFERENCES `workflow_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workflow_run_steps_run_step_index_unique` ON `workflow_run_steps` (`workflow_run_id`,`step_index`);--> statement-breakpoint
CREATE INDEX `idx_workflow_run_steps_run_status` ON `workflow_run_steps` (`workflow_run_id`,`status`);--> statement-breakpoint
CREATE TABLE `workflow_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`workflow_id` text NOT NULL,
	`triggered_by` text NOT NULL,
	`triggered_by_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`started_at` integer,
	`completed_at` integer,
	`result` text,
	`error` text,
	`metadata` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`workflow_id`) REFERENCES `workflow_definitions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_workflow_runs_workflow_started` ON `workflow_runs` (`workflow_id`,`started_at`);--> statement-breakpoint
CREATE INDEX `idx_workflow_runs_status` ON `workflow_runs` (`status`);--> statement-breakpoint
CREATE TABLE `workspace_file_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_file_id` text NOT NULL,
	`hash` text,
	`size_bytes` integer,
	`git_commit_sha` text,
	`git_branch` text,
	`content` text,
	`source` text DEFAULT 'sync' NOT NULL,
	`captured_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`workspace_file_id`) REFERENCES `workspace_files`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_workspace_file_revisions_file_captured` ON `workspace_file_revisions` (`workspace_file_id`,`captured_at`);--> statement-breakpoint
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
	FOREIGN KEY (`connection_id`) REFERENCES `openclaw_connections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workspace_files_connection_relative_path_unique` ON `workspace_files` (`connection_id`,`relative_path`);--> statement-breakpoint
ALTER TABLE `habits` ADD `connection_id` text REFERENCES openclaw_connections(id);--> statement-breakpoint
ALTER TABLE `habits` ADD `external_id` text;--> statement-breakpoint
ALTER TABLE `habits` ADD `schedule_kind` text;--> statement-breakpoint
ALTER TABLE `habits` ADD `schedule_expr` text;--> statement-breakpoint
ALTER TABLE `habits` ADD `session_target` text;--> statement-breakpoint
ALTER TABLE `habits` ADD `enabled` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `habits` ADD `last_synced_at` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `habits_connection_external_id_unique` ON `habits` (`connection_id`,`external_id`);--> statement-breakpoint
ALTER TABLE `ideas` ADD `sections` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `template_id` text REFERENCES task_templates(id);--> statement-breakpoint
ALTER TABLE `tasks` ADD `stage_id` text REFERENCES task_template_stages(id);--> statement-breakpoint
ALTER TABLE `tasks` ADD `properties` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `idea_id` text REFERENCES ideas(id);