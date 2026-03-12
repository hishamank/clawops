CREATE TABLE `workspace_file_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_file_id` text NOT NULL REFERENCES `workspace_files`(`id`) ON DELETE CASCADE,
	`hash` text,
	`size_bytes` integer,
	`git_commit_sha` text,
	`git_branch` text,
	`source` text NOT NULL DEFAULT 'sync',
	`captured_at` integer NOT NULL DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE INDEX `idx_workspace_file_revisions_file_captured` ON `workspace_file_revisions` (`workspace_file_id`, `captured_at`);
