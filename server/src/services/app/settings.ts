import { DEFAULT_GLOBAL_SETTINGS, type GlobalSettings } from '@nai-factory/shared'
import { eq } from 'drizzle-orm'
import { db, settings } from '@/db'
import { withNormalizedGlobalVariables } from '@/utils'

let cache: GlobalSettings = load()

function normalize(setting: GlobalSettings): GlobalSettings {
    const normalized = withNormalizedGlobalVariables(setting)
    return {
        ...DEFAULT_GLOBAL_SETTINGS,
        ...normalized,
        novelai: {
            ...DEFAULT_GLOBAL_SETTINGS.novelai,
            ...(normalized.novelai ?? {}),
        },
        image: {
            ...DEFAULT_GLOBAL_SETTINGS.image,
            ...(normalized.image ?? {}),
        },
        debug: {
            ...DEFAULT_GLOBAL_SETTINGS.debug,
            ...(normalized.debug ?? {}),
        },
        export: {
            ...DEFAULT_GLOBAL_SETTINGS.export,
            ...(normalized.export ?? {}),
        },
        globalVariables: normalized.globalVariables ?? DEFAULT_GLOBAL_SETTINGS.globalVariables,
    }
}

function load(): GlobalSettings {
    // check existence of settings row, if not create it with defaults
    const setting = db.select().from(settings).where(eq(settings.id, 1)).get()

    if (!setting) {
        const created = db.insert(settings).values({ id: 1 }).returning().get()

        if (!created) {
            throw new Error('Failed to create default settings')
        }

        return normalize(created)
    }

    return normalize(setting)
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

    cache = normalize(result)

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

    cache = normalize(created)
}
