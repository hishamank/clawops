CREATE TABLE `activity_events` (
	`id` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`severity` text DEFAULT 'info' NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`body` text,
	`agent_id` text,
	`entity_type` text,
	`entity_id` text,
	`project_id` text,
	`task_id` text,
	`metadata` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE no action
);
