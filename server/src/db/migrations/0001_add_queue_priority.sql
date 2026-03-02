ALTER TABLE `queue_items` ADD COLUMN `priority` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
DROP INDEX IF EXISTS `queue_items_status_created_at_idx`;
--> statement-breakpoint
CREATE INDEX `queue_items_status_priority_created_at_idx` ON `queue_items` (`status`, `priority`, `created_at`);
