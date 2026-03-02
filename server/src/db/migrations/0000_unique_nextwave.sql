CREATE TABLE `character_prompts` (
	`id` integer PRIMARY KEY NOT NULL,
	`project_id` integer NOT NULL,
	`display_order` text NOT NULL,
	`name` text NOT NULL,
	`prompt` text DEFAULT '' NOT NULL,
	`negative_prompt` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `character_prompts_project_display_order_uniq` ON `character_prompts` (`project_id`,`display_order`);--> statement-breakpoint
CREATE TABLE `global_variables` (
	`id` integer PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`value` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `global_variables_key_unique` ON `global_variables` (`key`);--> statement-breakpoint
CREATE INDEX `global_variables_key_idx` ON `global_variables` (`key`);--> statement-breakpoint
CREATE TABLE `groups` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `groups_name_idx` ON `groups` (`name`);--> statement-breakpoint
CREATE TABLE `images` (
	`id` integer PRIMARY KEY NOT NULL,
	`scene_id` integer NOT NULL,
	`display_order` text NOT NULL,
	`file_path` text NOT NULL,
	`thumbnail_path` text,
	`metadata` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `images_scene_id_idx` ON `images` (`scene_id`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` integer PRIMARY KEY NOT NULL,
	`group_id` integer NOT NULL,
	`display_order` text NOT NULL,
	`name` text NOT NULL,
	`general_prompt` text DEFAULT '' NOT NULL,
	`negative_prompt` text DEFAULT '' NOT NULL,
	`parameters` text DEFAULT '{}' NOT NULL,
	`variables` text DEFAULT '{}' NOT NULL,
	`thumbnail_image_id` integer,
	`ai_settings` text DEFAULT '{}' NOT NULL,
	`size` text DEFAULT '{"width":832,"height":1216}' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `projects_group_id_idx` ON `projects` (`group_id`);--> statement-breakpoint
CREATE INDEX `projects_name_idx` ON `projects` (`name`);--> statement-breakpoint
CREATE TABLE `queue_items` (
	`id` integer PRIMARY KEY NOT NULL,
	`project_id` integer NOT NULL,
	`scene_id` integer NOT NULL,
	`variation_id` integer,
	`status` text DEFAULT 'pending' NOT NULL,
	`error_message` text,
	`started_at` text,
	`finished_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `queue_items_status_created_at_idx` ON `queue_items` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `scenes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`display_order` text NOT NULL,
	`name` text NOT NULL,
	`variables` text DEFAULT '{}' NOT NULL,
	`prompts` text DEFAULT '' NOT NULL,
	`negative_prompts` text DEFAULT '' NOT NULL,
	`image_count` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `scenes_project_id_idx` ON `scenes` (`project_id`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `variations` (
	`id` integer PRIMARY KEY NOT NULL,
	`scene_id` integer NOT NULL,
	`display_order` text NOT NULL,
	`name` text NOT NULL,
	`variables` text DEFAULT '{}' NOT NULL,
	`prompts` text DEFAULT '' NOT NULL,
	`negative_prompts` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `variations_scene_id_idx` ON `variations` (`scene_id`);--> statement-breakpoint
CREATE TABLE `vibe_transfers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`display_order` text NOT NULL,
	`reference_strength` real DEFAULT 0.6 NOT NULL,
	`information_extracted` real DEFAULT 1 NOT NULL,
	`encoded` text,
	`encoded_information_extracted` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `vibe_transfers_project_id_idx` ON `vibe_transfers` (`project_id`);