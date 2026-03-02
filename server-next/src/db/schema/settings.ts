import { sql } from 'drizzle-orm'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import type { GlobalSettings, PromptVariable } from '@/types'

export const settings = sqliteTable('settings', {
    id: integer('id').primaryKey().default(1),

    globalVariables: text('global_variables', { mode: 'json' })
        .notNull()
        .$type<PromptVariable>()
        .default({}),

    novelaiSettings: text('novelai_settings', { mode: 'json' })
        .notNull()
        .$type<GlobalSettings>()
        .default({
            novelaiApiKey: '',
            model: 'nai-diffusion-4-5-full',
            qualityToggle: false,
        }),

    updatedAt: text('updated_at')
        .notNull()
        .default(sql`(datetime('now'))`),
})
