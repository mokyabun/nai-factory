import {
    DEFAULT_GLOBAL_SETTINGS,
    GlobalSettings,
    type SettingsPatch,
    type SettingsSection,
    type SettingsView,
} from '@nai-factory/shared'

import type { AppConfig } from '@/config'
import type { Db } from '@/db'
import { deepMerge } from '@/lib/merge'
import { decrypt, encrypt } from '@/lib/storage'
import { toIso } from '@/lib/time'
import type { RealtimeHub } from '@/modules/realtime/hub'

import * as repo from './repo'

const NOVELAI_KEY = 'novelai_api_key'
const ENCRYPTED_PREFIX = 'enc:'

function toStored(value: GlobalSettings) {
    return {
        globalVariables: value.globalVariables,
        image: value.image,
        debug: value.debug,
        novelaiMode: value.novelai.mode,
    }
}

function fromRow(row: repo.SettingsRow): GlobalSettings {
    return GlobalSettings.parse({
        globalVariables: row.globalVariables,
        image: row.image,
        debug: row.debug,
        novelai: { mode: row.novelaiMode },
    })
}

export function maskApiKey(apiKey: string) {
    return `****${apiKey.slice(-4)}`
}

export type SettingsStore = ReturnType<typeof createSettingsStore>

/** The API key leaves this store only through {@link SettingsStore.apiKey}. */
export function createSettingsStore(
    db: Db,
    config: Pick<AppConfig, 'encryptionKey' | 'exportDir' | 'initialNovelAIMode'>,
    events: RealtimeHub,
) {
    let row =
        repo.get(db) ??
        repo.upsert(
            db,
            toStored({
                ...DEFAULT_GLOBAL_SETTINGS,
                novelai: { mode: config.initialNovelAIMode },
            }),
        )
    let cache = fromRow(row)

    function readSecret() {
        const stored = repo.getSecret(db, NOVELAI_KEY)
        if (stored === null) return null
        if (!stored.startsWith(ENCRYPTED_PREFIX)) return stored
        const bytes = Buffer.from(stored.slice(ENCRYPTED_PREFIX.length), 'base64')
        return decrypt(bytes, config.encryptionKey).toString('utf8')
    }

    let apiKey = readSecret()

    function save(next: GlobalSettings, sections: SettingsSection[]) {
        row = repo.upsert(db, toStored(next))
        cache = fromRow(row)
        events.publish({ type: 'settings.changed', sections })
        return cache
    }

    return {
        get(): Readonly<GlobalSettings> {
            return cache
        },

        apiKey(): string | null {
            return apiKey
        },

        view(): SettingsView {
            return {
                ...cache,
                novelai: {
                    mode: cache.novelai.mode,
                    hasApiKey: apiKey !== null,
                    keyHint: apiKey === null ? null : maskApiKey(apiKey),
                },
                export: { serverExportEnabled: config.exportDir !== null },
                updatedAt: toIso(row.updatedAt),
            }
        },

        update(patch: SettingsPatch) {
            const merged = GlobalSettings.parse(deepMerge(cache, patch))
            const sections = Object.keys(patch).filter(
                (key) => patch[key as keyof SettingsPatch] !== undefined,
            ) as SettingsSection[]
            return save(merged, sections)
        },

        reset() {
            return save(DEFAULT_GLOBAL_SETTINGS, ['globalVariables', 'image', 'debug', 'novelai'])
        },

        setApiKey(value: string) {
            const stored = config.encryptionKey
                ? ENCRYPTED_PREFIX +
                  encrypt(Buffer.from(value, 'utf8'), config.encryptionKey).toString('base64')
                : value
            repo.setSecret(db, NOVELAI_KEY, stored)
            apiKey = value
            events.publish({ type: 'settings.changed', sections: ['novelai'] })
        },

        deleteApiKey() {
            repo.deleteSecret(db, NOVELAI_KEY)
            apiKey = null
            events.publish({ type: 'settings.changed', sections: ['novelai'] })
        },
    }
}
