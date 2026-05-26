CREATE TABLE IF NOT EXISTS `playground_settings` (
    `id` integer PRIMARY KEY DEFAULT 1,
    `prompt` text NOT NULL DEFAULT '',
    `negative_prompt` text NOT NULL DEFAULT '',
    `parameters` text NOT NULL,
    `updated_at` text NOT NULL DEFAULT (datetime('now'))
);
