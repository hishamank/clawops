CREATE TABLE `workflow_definitions` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`version` text NOT NULL DEFAULT '1',
	`status` text DEFAULT 'draft' NOT NULL,
	`project_id` text REFERENCES `projects`(`id`) ON DELETE SET NULL,
	`trigger_type` text NOT NULL DEFAULT 'manual',
	`trigger_config` text,
	`steps` text NOT NULL,
	`created_at` integer NOT NULL DEFAULT (unixepoch()),
	`updated_at` integer NOT NULL DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE INDEX `idx_workflow_definitions_project_status` ON `workflow_definitions` (`project_id`,`status`);
--> statement-breakpoint
CREATE INDEX `idx_workflow_definitions_status` ON `workflow_definitions` (`status`);
--> statement-breakpoint
CREATE TABLE `workflow_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`workflow_id` text NOT NULL REFERENCES `workflow_definitions`(`id`) ON DELETE CASCADE,
	`triggered_by` text NOT NULL,
	`triggered_by_id` text,
	`status` text NOT NULL DEFAULT 'pending',
	`started_at` integer,
	`completed_at` integer,
	`result` text,
	`error` text,
	`metadata` text,
	`created_at` integer NOT NULL DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE INDEX `idx_workflow_runs_workflow_started` ON `workflow_runs` (`workflow_id`,`started_at`);
--> statement-breakpoint
CREATE INDEX `idx_workflow_runs_status` ON `workflow_runs` (`status`);
--> statement-breakpoint
CREATE TABLE `workflow_run_steps` (
	`id` text PRIMARY KEY NOT NULL,
	`workflow_run_id` text NOT NULL REFERENCES `workflow_runs`(`id`) ON DELETE CASCADE,
	`step_index` integer NOT NULL,
	`step_key` text NOT NULL,
	`step_name` text NOT NULL,
	`step_type` text NOT NULL,
	`status` text NOT NULL DEFAULT 'pending',
	`input` text,
	`result` text,
	`error` text,
	`started_at` integer,
	`completed_at` integer,
	`created_at` integer NOT NULL DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workflow_run_steps_run_step_index_unique` ON `workflow_run_steps` (`workflow_run_id`,`step_index`);
--> statement-breakpoint
CREATE INDEX `idx_workflow_run_steps_run_status` ON `workflow_run_steps` (`workflow_run_id`,`status`);
