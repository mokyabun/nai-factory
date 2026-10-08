CREATE TABLE `debug_requests` (
	`id` integer PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`method` text NOT NULL,
	`url` text NOT NULL,
	`context` text NOT NULL,
	`request` text,
	`response` text,
	`error` text,
	`duration_ms` integer,
	`created_at` integer NOT NULL,
	`completed_at` integer
);
--> statement-breakpoint
CREATE INDEX `debug_requests_created_at_idx` ON `debug_requests` (`created_at`);--> statement-breakpoint
CREATE TABLE `playground_state` (
	`id` integer PRIMARY KEY NOT NULL,
	`prompt` text NOT NULL,
	`negative_prompt` text NOT NULL,
	`parameters` text NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "playground_state_singleton" CHECK("playground_state"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE `secrets` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`global_variables` text NOT NULL,
	`image` text NOT NULL,
	`debug` text NOT NULL,
	`novelai_mode` text NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "settings_singleton" CHECK("settings"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE `stash_items` (
	`id` integer PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `stash_items_type_name_id_idx` ON `stash_items` (`type`,`name`,`id`);--> statement-breakpoint
CREATE TABLE `assets` (
	`id` integer PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`rel_path` text NOT NULL,
	`content_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`width` integer,
	`height` integer,
	`sha256` text NOT NULL,
	`encrypted` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `assets_rel_path_unique` ON `assets` (`rel_path`);--> statement-breakpoint
CREATE TABLE `images` (
	`id` integer PRIMARY KEY NOT NULL,
	`scene_id` integer NOT NULL,
	`position` text NOT NULL,
	`asset_id` integer NOT NULL,
	`thumb_asset_id` integer NOT NULL,
	`seed` integer,
	`metadata` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`scene_id`) REFERENCES `scenes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`thumb_asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `images_scene_id_position_id_idx` ON `images` (`scene_id`,`position`,`id`);--> statement-breakpoint
CREATE INDEX `images_asset_id_idx` ON `images` (`asset_id`);--> statement-breakpoint
CREATE INDEX `images_thumb_asset_id_idx` ON `images` (`thumb_asset_id`);--> statement-breakpoint
CREATE TABLE `playground_images` (
	`id` integer PRIMARY KEY NOT NULL,
	`asset_id` integer NOT NULL,
	`thumb_asset_id` integer NOT NULL,
	`prompt` text NOT NULL,
	`negative_prompt` text NOT NULL,
	`parameters` text NOT NULL,
	`seed` integer,
	`metadata` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`thumb_asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `playground_images_created_at_id_idx` ON `playground_images` (`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `playground_images_asset_id_idx` ON `playground_images` (`asset_id`);--> statement-breakpoint
CREATE INDEX `playground_images_thumb_asset_id_idx` ON `playground_images` (`thumb_asset_id`);--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` integer PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`priority_key` text NOT NULL,
	`project_id` integer,
	`scene_id` integer,
	`variation_id` integer,
	`payload` text,
	`repeat_count` integer DEFAULT 1 NOT NULL,
	`total_images` integer,
	`done_images` integer DEFAULT 0 NOT NULL,
	`error` text,
	`error_kind` text,
	`created_at` integer NOT NULL,
	`started_at` integer,
	`finished_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`scene_id`) REFERENCES `scenes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`variation_id`) REFERENCES `scene_variations`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "jobs_kind_check" CHECK(("jobs"."kind" = 'scene' AND "jobs"."scene_id" IS NOT NULL AND "jobs"."variation_id" IS NOT NULL) OR ("jobs"."kind" = 'playground' AND "jobs"."payload" IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX `jobs_status_priority_key_id_idx` ON `jobs` (`status`,`priority_key`,`id`);--> statement-breakpoint
CREATE INDEX `jobs_project_id_idx` ON `jobs` (`project_id`);--> statement-breakpoint
CREATE INDEX `jobs_scene_id_idx` ON `jobs` (`scene_id`);--> statement-breakpoint
CREATE INDEX `jobs_variation_id_idx` ON `jobs` (`variation_id`);--> statement-breakpoint
CREATE TABLE `groups` (
	`id` integer PRIMARY KEY NOT NULL,
	`parent_id` integer,
	`name` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`parent_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `groups_parent_id_name_id_idx` ON `groups` (`parent_id`,`name`,`id`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` integer PRIMARY KEY NOT NULL,
	`group_id` integer,
	`name` text NOT NULL,
	`prompt` text NOT NULL,
	`negative_prompt` text NOT NULL,
	`character_prompts` text NOT NULL,
	`variables` text NOT NULL,
	`parameters` text NOT NULL,
	`settings` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `projects_group_id_name_id_idx` ON `projects` (`group_id`,`name`,`id`);--> statement-breakpoint
CREATE TABLE `scene_variations` (
	`id` integer PRIMARY KEY NOT NULL,
	`scene_id` integer NOT NULL,
	`position` text NOT NULL,
	`variables` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`scene_id`) REFERENCES `scenes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `scene_variations_scene_id_position_id_idx` ON `scene_variations` (`scene_id`,`position`,`id`);--> statement-breakpoint
CREATE TABLE `scenes` (
	`id` integer PRIMARY KEY NOT NULL,
	`project_id` integer NOT NULL,
	`name` text NOT NULL,
	`position` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `scenes_project_id_position_id_idx` ON `scenes` (`project_id`,`position`,`id`);--> statement-breakpoint
CREATE TABLE `character_references` (
	`id` integer PRIMARY KEY NOT NULL,
	`project_id` integer NOT NULL,
	`position` text NOT NULL,
	`source_asset_id` integer NOT NULL,
	`thumb_asset_id` integer,
	`processed_asset_id` integer,
	`strength` real NOT NULL,
	`fidelity` real NOT NULL,
	`mode` text NOT NULL,
	`enabled` integer NOT NULL,
	`cache_key` text,
	`cache_created_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`thumb_asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`processed_asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `character_references_project_id_position_id_idx` ON `character_references` (`project_id`,`position`,`id`);--> statement-breakpoint
CREATE INDEX `character_references_source_asset_id_idx` ON `character_references` (`source_asset_id`);--> statement-breakpoint
CREATE INDEX `character_references_thumb_asset_id_idx` ON `character_references` (`thumb_asset_id`);--> statement-breakpoint
CREATE INDEX `character_references_processed_asset_id_idx` ON `character_references` (`processed_asset_id`);--> statement-breakpoint
CREATE TABLE `vibe_transfers` (
	`id` integer PRIMARY KEY NOT NULL,
	`project_id` integer NOT NULL,
	`position` text NOT NULL,
	`source_asset_id` integer NOT NULL,
	`encoded_asset_id` integer,
	`encoded_for_model` text,
	`encoded_information_extracted` real,
	`reference_strength` real NOT NULL,
	`information_extracted` real NOT NULL,
	`enabled` integer NOT NULL,
	`cache_key` text,
	`cache_created_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`encoded_asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `vibe_transfers_project_id_position_id_idx` ON `vibe_transfers` (`project_id`,`position`,`id`);--> statement-breakpoint
CREATE INDEX `vibe_transfers_source_asset_id_idx` ON `vibe_transfers` (`source_asset_id`);--> statement-breakpoint
CREATE INDEX `vibe_transfers_encoded_asset_id_idx` ON `vibe_transfers` (`encoded_asset_id`);