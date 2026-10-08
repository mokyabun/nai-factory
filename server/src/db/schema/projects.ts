import type {
    CharacterPrompt,
    Parameters,
    ProjectSettings,
    PromptVariable,
} from '@nai-factory/shared'
import { type AnySQLiteColumn, index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

import { createdAt, position, updatedAt } from '../columns'

export const groups = sqliteTable(
    'groups',
    {
        id: integer('id').primaryKey(),
        parentId: integer('parent_id').references((): AnySQLiteColumn => groups.id, {
            onDelete: 'cascade',
        }),
        name: text('name').notNull(),
        createdAt: createdAt(),
        updatedAt: updatedAt(),
    },
    (t) => [index('groups_parent_id_name_id_idx').on(t.parentId, t.name, t.id)],
)

export const projects = sqliteTable(
    'projects',
    {
        id: integer('id').primaryKey(),
        groupId: integer('group_id').references(() => groups.id, { onDelete: 'cascade' }),
        name: text('name').notNull(),
        prompt: text('prompt').notNull(),
        negativePrompt: text('negative_prompt').notNull(),
        characterPrompts: text('character_prompts', { mode: 'json' })
            .notNull()
            .$type<CharacterPrompt[]>(),
        variables: text('variables', { mode: 'json' }).notNull().$type<PromptVariable>(),
        parameters: text('parameters', { mode: 'json' }).notNull().$type<Parameters>(),
        settings: text('settings', { mode: 'json' }).notNull().$type<ProjectSettings>(),
        createdAt: createdAt(),
        updatedAt: updatedAt(),
    },
    (t) => [index('projects_group_id_name_id_idx').on(t.groupId, t.name, t.id)],
)

export const scenes = sqliteTable(
    'scenes',
    {
        id: integer('id').primaryKey(),
        projectId: integer('project_id')
            .notNull()
            .references(() => projects.id, { onDelete: 'cascade' }),
        name: text('name').notNull(),
        position: position(),
        createdAt: createdAt(),
        updatedAt: updatedAt(),
    },
    (t) => [index('scenes_project_id_position_id_idx').on(t.projectId, t.position, t.id)],
)

export const sceneVariations = sqliteTable(
    'scene_variations',
    {
        id: integer('id').primaryKey(),
        sceneId: integer('scene_id')
            .notNull()
            .references(() => scenes.id, { onDelete: 'cascade' }),
        position: position(),
        variables: text('variables', { mode: 'json' }).notNull().$type<PromptVariable>(),
        createdAt: createdAt(),
        updatedAt: updatedAt(),
    },
    (t) => [index('scene_variations_scene_id_position_id_idx').on(t.sceneId, t.position, t.id)],
)
