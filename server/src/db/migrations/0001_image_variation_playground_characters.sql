ALTER TABLE `playground_state` ADD `character_prompts` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `images` ADD `variation_id` integer;--> statement-breakpoint
CREATE INDEX `images_scene_id_variation_id_idx` ON `images` (`scene_id`,`variation_id`);--> statement-breakpoint
ALTER TABLE `playground_images` ADD `character_prompts` text DEFAULT '[]' NOT NULL;