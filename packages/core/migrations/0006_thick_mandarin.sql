CREATE TABLE `task_template_stages` (
	`id` text PRIMARY KEY NOT NULL,
	`template_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`template_id`) REFERENCES `task_templates`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `task_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`is_built_in` integer DEFAULT false NOT NULL,
	`is_custom` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `task_templates_name_unique` ON `task_templates` (`name`);
--> statement-breakpoint
INSERT INTO `task_templates` (`id`, `name`, `description`, `is_built_in`, `is_custom`) VALUES
	('0c4d4328-e438-4aa9-a785-f6f230035f31', 'coding', 'Standard software development workflow', true, false),
	('521d73e7-8fc6-49f5-bb09-69b7234b4f4c', 'research', 'Research and investigation workflow', true, false),
	('c68dc388-c4bb-4be6-acd3-2cf1fc8f851f', 'content', 'Content creation workflow', true, false),
	('f7da90a1-0255-4e82-a5fe-c9c3498b6477', 'ops', 'Operations and deployment workflow', true, false),
	('ab628b94-a593-4b43-ad28-0aef8ab76ee4', 'review', 'Review and approval workflow', true, false);
--> statement-breakpoint
INSERT INTO `task_template_stages` (`id`, `template_id`, `name`, `description`, `order`) VALUES
	('342f5c9c-b1c8-4a06-a8b4-c3ee678337ab', '0c4d4328-e438-4aa9-a785-f6f230035f31', 'Analysis', 'Understand requirements and constraints', 0),
	('dbe10952-cae8-48af-9e09-c30f2b448d28', '0c4d4328-e438-4aa9-a785-f6f230035f31', 'Design', 'Plan the implementation approach', 1),
	('8f77e644-4635-4260-ad7f-f4bf654af9d6', '0c4d4328-e438-4aa9-a785-f6f230035f31', 'Implementation', 'Write the code', 2),
	('8e3590e8-6999-47cb-ba7c-b35111efda8f', '0c4d4328-e438-4aa9-a785-f6f230035f31', 'Testing', 'Verify functionality with tests', 3),
	('9e1f31d2-c15b-4630-a30c-4c1ea102860b', '0c4d4328-e438-4aa9-a785-f6f230035f31', 'Review', 'Code review and refinements', 4),
	('b5df1257-7d6a-4ca1-a15a-11a301b2cefa', '521d73e7-8fc6-49f5-bb09-69b7234b4f4c', 'Question Definition', 'Define the research question', 0),
	('4355c53f-c991-4756-bec9-d64e261f3c27', '521d73e7-8fc6-49f5-bb09-69b7234b4f4c', 'Data Collection', 'Gather relevant information', 1),
	('ea6b2626-e677-490d-8416-b7da0f715af7', '521d73e7-8fc6-49f5-bb09-69b7234b4f4c', 'Analysis', 'Analyze findings', 2),
	('969e762d-e807-4815-91bb-35c8b8f88b5d', '521d73e7-8fc6-49f5-bb09-69b7234b4f4c', 'Synthesis', 'Draw conclusions', 3),
	('d4682217-33eb-4459-8c7f-5d103296a04c', '521d73e7-8fc6-49f5-bb09-69b7234b4f4c', 'Documentation', 'Document results', 4),
	('345ebd7e-5449-4542-bdd2-2346b7552857', 'c68dc388-c4bb-4be6-acd3-2cf1fc8f851f', 'Brief', 'Define content requirements', 0),
	('1160775e-cd71-4ad3-9e34-c9958ae8a934', 'c68dc388-c4bb-4be6-acd3-2cf1fc8f851f', 'Outline', 'Create content structure', 1),
	('8cd5b10f-3989-4fe1-a36e-3dc81973d2b7', 'c68dc388-c4bb-4be6-acd3-2cf1fc8f851f', 'Draft', 'Write initial content', 2),
	('03e60be2-227a-4a96-a533-67990aee46d3', 'c68dc388-c4bb-4be6-acd3-2cf1fc8f851f', 'Edit', 'Review and refine', 3),
	('907512be-f406-4a0e-8df1-a46947ba4626', 'c68dc388-c4bb-4be6-acd3-2cf1fc8f851f', 'Publish', 'Finalize and publish', 4),
	('fd89e55f-2cb1-4fdd-9d1a-13131d307c20', 'f7da90a1-0255-4e82-a5fe-c9c3498b6477', 'Planning', 'Plan the operation', 0),
	('42b35cba-f5f8-44c6-bc43-43470df66257', 'f7da90a1-0255-4e82-a5fe-c9c3498b6477', 'Preparation', 'Set up prerequisites', 1),
	('2da90a55-fc3d-4b74-a152-bc69e8e93e88', 'f7da90a1-0255-4e82-a5fe-c9c3498b6477', 'Execution', 'Execute the operation', 2),
	('9483c1e7-f172-4d7f-8ebd-a16e4821f546', 'f7da90a1-0255-4e82-a5fe-c9c3498b6477', 'Verification', 'Verify success', 3),
	('eebd670b-d250-4a73-9827-c704e7f8cc2b', 'f7da90a1-0255-4e82-a5fe-c9c3498b6477', 'Documentation', 'Document changes', 4),
	('ea6ad1d0-668f-487a-a834-ac5d69f8692e', 'ab628b94-a593-4b43-ad28-0aef8ab76ee4', 'Intake', 'Receive item for review', 0),
	('37add6a1-a5a3-4a1a-a0da-0e265ec434ab', 'ab628b94-a593-4b43-ad28-0aef8ab76ee4', 'Initial Review', 'First pass evaluation', 1),
	('af5d13f0-a4dc-4fb7-8b2d-9b3e8e34c648', 'ab628b94-a593-4b43-ad28-0aef8ab76ee4', 'Detailed Review', 'In-depth analysis', 2),
	('68861d00-fd1e-4999-81b0-e821dfe44ae3', 'ab628b94-a593-4b43-ad28-0aef8ab76ee4', 'Feedback', 'Provide feedback', 3),
	('61ac22f6-10d1-4050-ab6e-f6c969b76b68', 'ab628b94-a593-4b43-ad28-0aef8ab76ee4', 'Follow-up', 'Verify changes', 4);
