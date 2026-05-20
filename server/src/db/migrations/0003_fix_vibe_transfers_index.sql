DROP INDEX IF EXISTS `vibe_transfers_project_id_idx`;
CREATE INDEX `vibe_transfers_project_id_display_order_idx` ON `vibe_transfers` (`project_id`, `display_order`);
