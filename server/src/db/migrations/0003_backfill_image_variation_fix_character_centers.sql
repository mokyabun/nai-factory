-- Images record the variation that produced them in their metadata; keep it where that variation still exists.
UPDATE `images` SET `variation_id` = json_extract(`metadata`, '$.variationId')
WHERE `variation_id` IS NULL
	AND EXISTS (
		SELECT 1 FROM `scene_variations` AS `v`
		WHERE `v`.`id` = json_extract(`images`.`metadata`, '$.variationId')
			AND `v`.`scene_id` = `images`.`scene_id`
	);
--> statement-breakpoint
-- 0.3.0 created characters at { x: 0, y: 0 }; NovelAI's grid spans 0.1–0.9, so move such coordinates to the center.
UPDATE `projects` SET `character_prompts` = (
	SELECT json_group_array(json_set(`c`.`value`,
		'$.center.x', CASE WHEN json_extract(`c`.`value`, '$.center.x') BETWEEN 0.1 AND 0.9 THEN json_extract(`c`.`value`, '$.center.x') ELSE 0.5 END,
		'$.center.y', CASE WHEN json_extract(`c`.`value`, '$.center.y') BETWEEN 0.1 AND 0.9 THEN json_extract(`c`.`value`, '$.center.y') ELSE 0.5 END))
	FROM json_each(`projects`.`character_prompts`) AS `c`
)
WHERE EXISTS (
	SELECT 1 FROM json_each(`projects`.`character_prompts`) AS `c`
	WHERE NOT (json_extract(`c`.`value`, '$.center.x') BETWEEN 0.1 AND 0.9)
		OR NOT (json_extract(`c`.`value`, '$.center.y') BETWEEN 0.1 AND 0.9)
);
--> statement-breakpoint
UPDATE `stash_items` SET `payload` = json_set(`payload`, '$.characterPrompts', json((
	SELECT json_group_array(json_set(`c`.`value`,
		'$.center.x', CASE WHEN json_extract(`c`.`value`, '$.center.x') BETWEEN 0.1 AND 0.9 THEN json_extract(`c`.`value`, '$.center.x') ELSE 0.5 END,
		'$.center.y', CASE WHEN json_extract(`c`.`value`, '$.center.y') BETWEEN 0.1 AND 0.9 THEN json_extract(`c`.`value`, '$.center.y') ELSE 0.5 END))
	FROM json_each(`stash_items`.`payload`, '$.characterPrompts') AS `c`
)))
WHERE `type` = 'prompt'
	AND EXISTS (
		SELECT 1 FROM json_each(`stash_items`.`payload`, '$.characterPrompts') AS `c`
		WHERE NOT (json_extract(`c`.`value`, '$.center.x') BETWEEN 0.1 AND 0.9)
			OR NOT (json_extract(`c`.`value`, '$.center.y') BETWEEN 0.1 AND 0.9)
	);
