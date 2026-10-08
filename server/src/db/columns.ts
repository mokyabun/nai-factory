import { integer, text } from 'drizzle-orm/sqlite-core'

/** Creation time as Unix milliseconds (UTC). */
export const createdAt = () =>
    integer('created_at', { mode: 'timestamp_ms' })
        .notNull()
        .$defaultFn(() => new Date())

/** Last update time; drizzle refreshes it on every `update()`. */
export const updatedAt = () =>
    integer('updated_at', { mode: 'timestamp_ms' })
        .notNull()
        .$defaultFn(() => new Date())
        .$onUpdateFn(() => new Date())

/** Fractional index key. Not unique: equal keys are ordered by id. */
export const position = () => text('position').notNull()
