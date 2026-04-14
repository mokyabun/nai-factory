import { eq } from 'drizzle-orm'
import type { GlobalSettings } from '@/types'
import { db, settings } from '@/db'

let cache: GlobalSettings = load()

function load(): GlobalSettings {
    // check existence of settings row, if not create it with defaults
    const setting = db.select().from(settings).where(eq(settings.id, 1)).get()

    if (!setting) {
        const created = db.insert(settings).values({ id: 1 }).returning().get()

        if (!created) {
            throw new Error('Failed to create default settings')
        }

        return created
    }

    return setting
}

export function get(): Readonly<GlobalSettings> {
    return cache
}

export function update(patch: Partial<GlobalSettings>) {
    const updated = { ...cache, ...patch }

    const result = db.update(settings).set(updated).where(eq(settings.id, 1)).returning().get()

    if (!result) {
        throw new Error('Failed to update settings')
    }

    cache = result

    return cache
}

export function reset() {
    // Just delete and recreate the settings row to reset to defaults
    const created = db.transaction(() => {
        db.delete(settings).where(eq(settings.id, 1)).run()
        const created = db.insert(settings).values({ id: 1 }).returning().get()

        if (!created) {
            throw new Error('Failed to reset settings')
        }

        return created
    })

    cache = created
}
