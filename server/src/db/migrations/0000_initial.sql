CREATE TABLE `assets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text NOT NULL,
	`path` text NOT NULL,
	`content_type` text DEFAULT 'application/octet-stream' NOT NULL,
	`size_bytes` integer,
	`width` integer,
	`height` integer,
	`sha256` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `assets_path_unique` ON `assets` (`path`);--> statement-breakpoint
CREATE INDEX `assets_kind_idx` ON `assets` (`kind`);--> statement-breakpoint
CREATE TABLE `character_references` (
	`id` integer PRIMARY KEY NOT NULL,
	`project_id` integer NOT NULL,
	`display_order` text DEFAULT '' NOT NULL,
	`source_asset_id` integer,
	`thumbnail_asset_id` integer,
	`processed_asset_id` integer,
	`source_image_path` text NOT NULL,
	`thumbnail_path` text,
	`processed_image_path` text,
	`strength` real DEFAULT 0.6 NOT NULL,
	`fidelity` real DEFAULT 0.5 NOT NULL,
	`reference_mode` text DEFAULT 'character&style' NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`cache_secret_key` text,
	`cache_created_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`thumbnail_asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`processed_asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `character_references_project_id_display_order_unique` ON `character_references` (`project_id`,`display_order`);--> statement-breakpoint
CREATE INDEX `character_references_project_id_display_order_idx` ON `character_references` (`project_id`,`display_order`);--> statement-breakpoint
CREATE INDEX `character_references_source_asset_id_idx` ON `character_references` (`source_asset_id`);--> statement-breakpoint
CREATE INDEX `character_references_thumbnail_asset_id_idx` ON `character_references` (`thumbnail_asset_id`);--> statement-breakpoint
CREATE INDEX `character_references_processed_asset_id_idx` ON `character_references` (`processed_asset_id`);--> statement-breakpoint
CREATE TABLE `debug_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`completed_at` text,
	`duration_ms` integer,
	`status` text NOT NULL,
	`method` text NOT NULL,
	`url` text NOT NULL,
	`context` text NOT NULL,
	`request` text NOT NULL,
	`response` text,
	`error` text
);
--> statement-breakpoint
CREATE INDEX `debug_requests_created_at_idx` ON `debug_requests` (`created_at`);--> statement-breakpoint
CREATE TABLE `groups` (
	`id` integer PRIMARY KEY NOT NULL,
	`parent_group_id` integer,
	`name` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`parent_group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `groups_parent_group_id_name_id_idx` ON `groups` (`parent_group_id`,`name`,`id`);--> statement-breakpoint
CREATE INDEX `groups_name_idx` ON `groups` (`name`);--> statement-breakpoint
CREATE TABLE `images` (
	`id` integer PRIMARY KEY NOT NULL,
	`scene_id` integer NOT NULL,
	`display_order` text NOT NULL,
	`asset_id` integer,
	`thumbnail_asset_id` integer,
	`file_path` text NOT NULL,
	`thumbnail_path` text,
	`metadata` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`scene_id`) REFERENCES `scenes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`thumbnail_asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `images_scene_id_display_order_unique` ON `images` (`scene_id`,`display_order`);--> statement-breakpoint
CREATE INDEX `images_scene_id_display_order_idx` ON `images` (`scene_id`,`display_order`);--> statement-breakpoint
CREATE INDEX `images_asset_id_idx` ON `images` (`asset_id`);--> statement-breakpoint
CREATE INDEX `images_thumbnail_asset_id_idx` ON `images` (`thumbnail_asset_id`);--> statement-breakpoint
CREATE TABLE `playground_images` (
	`id` integer PRIMARY KEY NOT NULL,
	`prompt` text NOT NULL,
	`negative_prompt` text DEFAULT '' NOT NULL,
	`parameters` text NOT NULL,
	`asset_id` integer,
	`thumbnail_asset_id` integer,
	`file_path` text NOT NULL,
	`thumbnail_path` text,
	`metadata` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`thumbnail_asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `playground_images_created_at_id_idx` ON `playground_images` (`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `playground_images_asset_id_idx` ON `playground_images` (`asset_id`);--> statement-breakpoint
CREATE INDEX `playground_images_thumbnail_asset_id_idx` ON `playground_images` (`thumbnail_asset_id`);--> statement-breakpoint
CREATE TABLE `playground_queue_items` (
	`id` integer PRIMARY KEY NOT NULL,
	`prompt` text NOT NULL,
	`negative_prompt` text DEFAULT '' NOT NULL,
	`parameters` text NOT NULL,
	`sort_index` integer NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `playground_queue_items_sort_index_idx` ON `playground_queue_items` (`sort_index`);--> statement-breakpoint
CREATE TABLE `playground_settings` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`prompt` text DEFAULT '' NOT NULL,
	`negative_prompt` text DEFAULT '' NOT NULL,
	`parameters` text DEFAULT '{"model":"nai-diffusion-4-5-full","qualityToggle":false,"width":1024,"height":1024,"steps":28,"promptGuidance":6,"varietyPlus":false,"seed":0,"sampler":"k_euler_ancestral","promptGuidanceRescale":0.7,"noiseSchedule":"karras","normalizeReferenceStrengthValues":false,"useCharacterPositions":false}' NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` integer PRIMARY KEY NOT NULL,
	`group_id` integer,
	`name` text NOT NULL,
	`prompt` text DEFAULT '' NOT NULL,
	`negative_prompt` text DEFAULT '' NOT NULL,
	`variables` text DEFAULT '[]' NOT NULL,
	`parameters` text DEFAULT '{"model":"nai-diffusion-4-5-full","qualityToggle":false,"width":512,"height":512,"steps":28,"promptGuidance":6,"varietyPlus":false,"seed":0,"sampler":"k_euler_ancestral","promptGuidanceRescale":0.7,"noiseSchedule":"karras","normalizeReferenceStrengthValues":false,"useCharacterPositions":false}' NOT NULL,
	`character_prompts` text DEFAULT '[]' NOT NULL,
	`settings` text DEFAULT '{"slideshowImageCount":4,"sceneCardSize":"md","outputTemplate":"{character}-{scene}-{number}.{extension}"}' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `projects_group_id_name_id_idx` ON `projects` (`group_id`,`name`,`id`);--> statement-breakpoint
CREATE TABLE `queue_items` (
	`id` integer PRIMARY KEY NOT NULL,
	`project_id` integer NOT NULL,
	`scene_id` integer NOT NULL,
	`scene_variation_id` integer NOT NULL,
	`sort_index` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`scene_id`) REFERENCES `scenes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`scene_variation_id`) REFERENCES `scene_variations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `queue_items_sort_index_idx` ON `queue_items` (`sort_index`);--> statement-breakpoint
CREATE INDEX `queue_items_scene_id_idx` ON `queue_items` (`scene_id`);--> statement-breakpoint
CREATE INDEX `queue_items_scene_variation_id_idx` ON `queue_items` (`scene_variation_id`);--> statement-breakpoint
CREATE TABLE `scene_variations` (
	`id` integer PRIMARY KEY NOT NULL,
	`scene_id` integer NOT NULL,
	`display_order` text NOT NULL,
	`variables` text DEFAULT '[]' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`scene_id`) REFERENCES `scenes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `scene_variations_scene_id_display_order_unique` ON `scene_variations` (`scene_id`,`display_order`);--> statement-breakpoint
CREATE INDEX `scene_variations_scene_id_display_order_idx` ON `scene_variations` (`scene_id`,`display_order`);--> statement-breakpoint
CREATE TABLE `scenes` (
	`id` integer PRIMARY KEY NOT NULL,
	`project_id` integer NOT NULL,
	`display_order` text NOT NULL,
	`name` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `scenes_project_id_display_order_unique` ON `scenes` (`project_id`,`display_order`);--> statement-breakpoint
CREATE INDEX `scenes_display_order_idx` ON `scenes` (`project_id`,`display_order`);--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`global_variables` text DEFAULT '[]' NOT NULL,
	`novelai` text DEFAULT '{"apiKey":"","mode":"live"}' NOT NULL,
	`image` text DEFAULT '{"sourceType":{"type":"png"},"thumbnailType":{"type":"webp","quality":60},"thumbnailSize":512}' NOT NULL,
	`debug` text DEFAULT '{"enabled":false,"recentRequestLimit":20}' NOT NULL,
	`export_settings` text DEFAULT '{"serverPath":""}' NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `stash_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `stash_items_type_name_id_idx` ON `stash_items` (`type`,`name`,`id`);--> statement-breakpoint
CREATE INDEX `stash_items_name_id_idx` ON `stash_items` (`name`,`id`);--> statement-breakpoint
CREATE TABLE `vibe_transfers` (
	`id` integer PRIMARY KEY NOT NULL,
	`project_id` integer NOT NULL,
	`display_order` text DEFAULT '' NOT NULL,
	`source_asset_id` integer,
	`source_image_path` text NOT NULL,
	`reference_strength` real DEFAULT 0.6 NOT NULL,
	`information_extracted` real DEFAULT 1 NOT NULL,
	`encoded_data` text,
	`encoded_information_extracted` real,
	`cache_secret_key` text,
	`cache_created_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vibe_transfers_project_id_display_order_unique` ON `vibe_transfers` (`project_id`,`display_order`);--> statement-breakpoint
CREATE INDEX `vibe_transfers_project_id_display_order_idx` ON `vibe_transfers` (`project_id`,`display_order`);--> statement-breakpoint
CREATE INDEX `vibe_transfers_source_asset_id_idx` ON `vibe_transfers` (`source_asset_id`);