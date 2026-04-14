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
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`scene_id`) REFERENCES `scenes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `images_scene_id_display_order_idx` ON `images` (`scene_id`,`display_order`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` integer PRIMARY KEY NOT NULL,
	`group_id` integer,
	`name` text NOT NULL,
	`prompt` text DEFAULT '' NOT NULL,
	`negative_prompt` text DEFAULT '' NOT NULL,
	`variables` text DEFAULT '{}' NOT NULL,
	`parameters` text DEFAULT '{"model":"nai-diffusion-4-5-full","qualityToggle":false,"width":512,"height":512,"steps":28,"promptGuidance":6,"varietyPlus":false,"seed":0,"sampler":"k_euler_ancestral","promptGuidanceRescale":0.7,"noiseSchedule":"karras","normalizeReferenceStrengthValues":false,"useCharacterPositions":false}' NOT NULL,
	`character_prompts` text DEFAULT '[]' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `projects_group_id_name_idx` ON `projects` (`group_id`,`name`);--> statement-breakpoint
CREATE TABLE `queue_items` (
	`id` integer PRIMARY KEY NOT NULL,
	`project_id` integer NOT NULL,
	`scene_id` integer NOT NULL,
	`variation_count` integer NOT NULL,
	`sort_index` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`scene_id`) REFERENCES `scenes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `queue_items_sort_index_idx` ON `queue_items` (`sort_index`);--> statement-breakpoint
CREATE TABLE `scenes` (
	`id` integer PRIMARY KEY NOT NULL,
	`project_id` integer NOT NULL,
	`display_order` text NOT NULL,
	`thumbnail_image_id` integer,
	`name` text NOT NULL,
	`variations` text DEFAULT '[]' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `scenes_display_order_idx` ON `scenes` (`project_id`,`display_order`);--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`global_variables` text DEFAULT '{}' NOT NULL,
	`novelai` text DEFAULT '{"apiKey":""}' NOT NULL,
	`image` text DEFAULT '{"sourceType":{"type":"png"},"thumbnailType":{"type":"webp","quality":60},"thumbnailSize":512}' NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `vibe_transfers` (
	`id` integer PRIMARY KEY NOT NULL,
	`project_id` integer NOT NULL,
	`display_order` text DEFAULT '' NOT NULL,
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