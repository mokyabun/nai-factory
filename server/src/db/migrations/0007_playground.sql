CREATE TABLE IF NOT EXISTS `playground_queue_items` (
    `id` integer PRIMARY KEY,
    `prompt` text NOT NULL,
    `negative_prompt` text NOT NULL DEFAULT '',
    `parameters` text NOT NULL,
    `sort_index` integer NOT NULL,
    `created_at` text NOT NULL DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `playground_queue_items_sort_index_idx` ON `playground_queue_items` (`sort_index`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `playground_images` (
    `id` integer PRIMARY KEY,
    `prompt` text NOT NULL,
    `negative_prompt` text NOT NULL DEFAULT '',
    `parameters` text NOT NULL,
    `file_path` text NOT NULL,
    `thumbnail_path` text,
    `metadata` text NOT NULL DEFAULT '{}',
    `created_at` text NOT NULL DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `playground_images_created_at_idx` ON `playground_images` (`created_at`);
