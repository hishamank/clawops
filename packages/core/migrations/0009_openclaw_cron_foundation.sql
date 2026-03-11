ALTER TABLE `habits` ADD `connection_id` text REFERENCES `openclaw_connections`(`id`);
--> statement-breakpoint
ALTER TABLE `habits` ADD `external_id` text;
--> statement-breakpoint
ALTER TABLE `habits` ADD `schedule_kind` text;
--> statement-breakpoint
ALTER TABLE `habits` ADD `schedule_expr` text;
--> statement-breakpoint
ALTER TABLE `habits` ADD `session_target` text;
--> statement-breakpoint
ALTER TABLE `habits` ADD `enabled` integer DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE `habits` ADD `last_synced_at` integer;
--> statement-breakpoint
CREATE UNIQUE INDEX `habits_connection_external_id_unique`
  ON `habits` (`connection_id`, `external_id`);
