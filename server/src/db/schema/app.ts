import type {
    DebugRequestStatus,
    DebugSettings,
    ImageSettings,
    NovelAIMode,
    Parameters,
    PromptVariable,
    StashItem,
    StashType,
} from '@nai-factory/shared'
import { sql } from 'drizzle-orm'
import { check, index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

import { createdAt, updatedAt } from '../columns'

export const playgroundState = sqliteTable(
    'playground_state',
    {
        id: integer('id').primaryKey(),
        prompt: text('prompt').notNull(),
        negativePrompt: text('negative_prompt').notNull(),
        parameters: text('parameters', { mode: 'json' }).notNull().$type<Parameters>(),
        updatedAt: updatedAt(),
    },
    (t) => [check('playground_state_singleton', sql`${t.id} = 1`)],
)

export const settings = sqliteTable(
    'settings',
    {
        id: integer('id').primaryKey(),
        globalVariables: text('global_variables', { mode: 'json' })
            .notNull()
            .$type<PromptVariable>(),
        image: text('image', { mode: 'json' }).notNull().$type<ImageSettings>(),
        debug: text('debug', { mode: 'json' }).notNull().$type<DebugSettings>(),
        novelaiMode: text('novelai_mode').notNull().$type<NovelAIMode>(),
        updatedAt: updatedAt(),
    },
    (t) => [check('settings_singleton', sql`${t.id} = 1`)],
)

/** Secret values; never included in API responses. */
export const secrets = sqliteTable('secrets', {
    key: text('key').primaryKey(),
    value: text('value').notNull(),
    updatedAt: updatedAt(),
})

export const stashItems = sqliteTable(
    'stash_items',
    {
        id: integer('id').primaryKey(),
        type: text('type').notNull().$type<StashType>(),
        name: text('name').notNull(),
        payload: text('payload', { mode: 'json' }).notNull().$type<StashItem['payload']>(),
        createdAt: createdAt(),
        updatedAt: updatedAt(),
    },
    (t) => [index('stash_items_type_name_id_idx').on(t.type, t.name, t.id)],
)

export const debugRequests = sqliteTable(
    'debug_requests',
    {
        id: integer('id').primaryKey(),
        status: text('status').notNull().$type<DebugRequestStatus>(),
        method: text('method').notNull(),
        url: text('url').notNull(),
        context: text('context', { mode: 'json' }).notNull().$type<Record<string, unknown>>(),
        request: text('request', { mode: 'json' }).$type<unknown>(),
        response: text('response', { mode: 'json' }).$type<unknown>(),
        error: text('error'),
        durationMs: integer('duration_ms'),
        createdAt: createdAt(),
        completedAt: integer('completed_at', { mode: 'timestamp_ms' }),
    },
    (t) => [index('debug_requests_created_at_idx').on(t.createdAt)],
)
