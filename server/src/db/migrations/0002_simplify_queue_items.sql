ALTER TABLE `queue_items` DROP COLUMN `status`;
--> statement-breakpoint
ALTER TABLE `queue_items` DROP COLUMN `error_message`;
--> statement-breakpoint
ALTER TABLE `queue_items` DROP COLUMN `started_at`;
--> statement-breakpoint
ALTER TABLE `queue_items` DROP COLUMN `finished_at`;
--> statement-breakpoint
ALTER TABLE `queue_items` DROP COLUMN `updated_at`;
--> statement-breakpoint
DROP INDEX IF EXISTS `queue_items_status_priority_created_at_idx`;
--> statement-breakpoint
CREATE INDEX `queue_items_priority_created_at_idx` ON `queue_items` (`priority`, `created_at`);
