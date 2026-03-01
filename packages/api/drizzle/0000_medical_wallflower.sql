CREATE TABLE `agents` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'offline' NOT NULL,
	`last_seen` text NOT NULL,
	`metadata` text
);
--> statement-breakpoint
CREATE TABLE `runs` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_id` text NOT NULL,
	`task` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`started_at` text NOT NULL,
	`finished_at` text,
	`output` text,
	`error` text,
	FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE no action
);
