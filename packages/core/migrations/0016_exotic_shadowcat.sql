CREATE TABLE `task_relations` (
	`id` text PRIMARY KEY NOT NULL,
	`from_task_id` text NOT NULL,
	`to_task_id` text NOT NULL,
	`type` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`from_task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`to_task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `task_relations_from_to_type_unique` ON `task_relations` (`from_task_id`,`to_task_id`,`type`);--> statement-breakpoint
CREATE INDEX `idx_task_relations_from` ON `task_relations` (`from_task_id`);--> statement-breakpoint
CREATE INDEX `idx_task_relations_to` ON `task_relations` (`to_task_id`);