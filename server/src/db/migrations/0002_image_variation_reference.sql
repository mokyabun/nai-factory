PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_images` (
	`id` integer PRIMARY KEY NOT NULL,
	`scene_id` integer NOT NULL,
	`variation_id` integer,
	`position` text NOT NULL,
	`asset_id` integer NOT NULL,
	`thumb_asset_id` integer NOT NULL,
	`seed` integer,
	`metadata` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`scene_id`) REFERENCES `scenes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`variation_id`) REFERENCES `scene_variations`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`thumb_asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
INSERT INTO `__new_images`("id", "scene_id", "variation_id", "position", "asset_id", "thumb_asset_id", "seed", "metadata", "created_at") SELECT "id", "scene_id", "variation_id", "position", "asset_id", "thumb_asset_id", "seed", "metadata", "created_at" FROM `images`;--> statement-breakpoint
DROP TABLE `images`;--> statement-breakpoint
ALTER TABLE `__new_images` RENAME TO `images`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `images_scene_id_position_id_idx` ON `images` (`scene_id`,`position`,`id`);--> statement-breakpoint
CREATE INDEX `images_scene_id_variation_id_idx` ON `images` (`scene_id`,`variation_id`);--> statement-breakpoint
CREATE INDEX `images_asset_id_idx` ON `images` (`asset_id`);--> statement-breakpoint
CREATE INDEX `images_thumb_asset_id_idx` ON `images` (`thumb_asset_id`);