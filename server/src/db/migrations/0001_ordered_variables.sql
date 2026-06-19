UPDATE projects
SET variables = COALESCE(
    (
        SELECT json_group_array(json_object('key', key, 'value', value))
        FROM json_each(projects.variables)
    ),
    '[]'
)
WHERE json_valid(variables) AND json_type(variables) = 'object';
--> statement-breakpoint
UPDATE scene_variations
SET variables = COALESCE(
    (
        SELECT json_group_array(json_object('key', key, 'value', value))
        FROM json_each(scene_variations.variables)
    ),
    '[]'
)
WHERE json_valid(variables) AND json_type(variables) = 'object';
--> statement-breakpoint
UPDATE settings
SET global_variables = COALESCE(
    (
        SELECT json_group_array(json_object('key', key, 'value', value))
        FROM json_each(settings.global_variables)
    ),
    '[]'
)
WHERE json_valid(global_variables) AND json_type(global_variables) = 'object';
--> statement-breakpoint
UPDATE projects SET prompt = replace(replace(prompt, '[[', '<<'), ']]', '>>');
--> statement-breakpoint
UPDATE projects SET negative_prompt = replace(replace(negative_prompt, '[[', '<<'), ']]', '>>');
--> statement-breakpoint
UPDATE projects
SET character_prompts = replace(replace(character_prompts, '[[', '<<'), ']]', '>>');
