ALTER TABLE `vibe_transfers` ADD `cache_secret_key` text;
--> statement-breakpoint
ALTER TABLE `vibe_transfers` ADD `cache_created_at` text;
--> statement-breakpoint
CREATE TABLE `character_references` (
    `id` integer PRIMARY KEY NOT NULL,
    `project_id` integer NOT NULL,
    `display_order` text DEFAULT '' NOT NULL,
    `source_image_path` text NOT NULL,
    `thumbnail_path` text,
    `processed_image_path` text,
    `strength` real DEFAULT 0.6 NOT NULL,
    `fidelity` real DEFAULT 0.5 NOT NULL,
    `reference_mode` text DEFAULT 'character&style' NOT NULL,
    `enabled` integer DEFAULT 1 NOT NULL,
    `cache_secret_key` text,
    `cache_created_at` text,
    `created_at` text DEFAULT (datetime('now')) NOT NULL,
    `updated_at` text DEFAULT (datetime('now')) NOT NULL,
    FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `character_references_project_id_display_order_idx` ON `character_references` (`project_id`, `display_order`);
