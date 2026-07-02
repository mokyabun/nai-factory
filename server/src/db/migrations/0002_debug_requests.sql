CREATE TABLE `debug_requests` (
    `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    `created_at` text NOT NULL DEFAULT (datetime('now')),
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
CREATE INDEX `debug_requests_created_at_idx` ON `debug_requests` (`created_at`);
