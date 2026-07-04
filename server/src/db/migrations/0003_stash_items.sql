CREATE TABLE `stash_items` (
    `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    `type` text NOT NULL,
    `name` text NOT NULL,
    `payload` text NOT NULL,
    `created_at` text NOT NULL DEFAULT (datetime('now')),
    `updated_at` text NOT NULL DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE INDEX `stash_items_type_updated_at_idx` ON `stash_items` (`type`, `updated_at`);
