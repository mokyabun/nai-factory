CREATE TABLE `character_prompts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`display_order` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`center_x` real DEFAULT 0.5 NOT NULL,
	`center_y` real DEFAULT 0.5 NOT NULL,
	`prompt` text DEFAULT '' NOT NULL,
	`uc` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `character_prompts_project_id_idx` ON `character_prompts` (`project_id`);--> statement-breakpoint
CREATE TABLE `groups` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `groups_name_idx` ON `groups` (`name`);--> statement-breakpoint
CREATE TABLE `images` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`scene_id` integer NOT NULL,
	`display_order` text NOT NULL,
	`file_path` text NOT NULL,
	`thumbnail_path` text,
	`metadata` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`scene_id`) REFERENCES `scenes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `images_scene_id_idx` ON `images` (`scene_id`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`group_id` integer NOT NULL,
	`thumbnail_image_id` integer,
	`display_order` text NOT NULL,
	`name` text NOT NULL,
	`prompt` text DEFAULT '' NOT NULL,
	`negative_prompt` text DEFAULT '' NOT NULL,
	`variables` text DEFAULT '{}' NOT NULL,
	`parameters` text DEFAULT '{"width":832,"height":1216,"steps":28,"promptGuidance":6,"varietyPlus":false,"seed":0,"sampler":"k_euler_ancestral","promptGuidanceRescale":0.7,"noiseSchedule":"karras","normalizeReferenceStrengthValues":false,"useCharacterPositions":false}' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `projects_group_id_idx` ON `projects` (`group_id`);--> statement-breakpoint
CREATE INDEX `projects_name_idx` ON `projects` (`name`);--> statement-breakpoint
CREATE TABLE `queue_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`scene_id` integer NOT NULL,
	`variation_id` integer,
	`priority` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`scene_id`) REFERENCES `scenes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`variation_id`) REFERENCES `variations`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `queue_items_priority_created_at_idx` ON `queue_items` (`priority`,`created_at`);--> statement-breakpoint
CREATE TABLE `scenes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`display_order` text NOT NULL,
	`name` text NOT NULL,
	`image_count` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `scenes_project_id_idx` ON `scenes` (`project_id`);--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`global_variables` text DEFAULT '{}' NOT NULL,
	`novelai_settings` text DEFAULT '{"novelaiApiKey":"","model":"nai-diffusion-4-5-full","qualityToggle":false}' NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `variations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`scene_id` integer NOT NULL,
	`display_order` text NOT NULL,
	`variables` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`scene_id`) REFERENCES `scenes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `variations_scene_id_idx` ON `variations` (`scene_id`);--> statement-breakpoint
CREATE TABLE `vibe_transfers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`display_order` text NOT NULL,
	`source_image_path` text NOT NULL,
	`reference_strength` real DEFAULT 0.6 NOT NULL,
	`information_extracted` real DEFAULT 1 NOT NULL,
	`encoded_data` text,
	`encoded_information_extracted` real,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `vibe_transfers_project_id_idx` ON `vibe_transfers` (`project_id`);