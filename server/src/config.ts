import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { NovelAIMode } from '@nai-factory/shared'
import { z } from 'zod'

import packageJson from '../package.json'

export const APP_VERSION = packageJson.version

const LOG_LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'] as const
const DEFAULT_REDACT_PATHS = [
    'apiKey',
    '*.apiKey',
    '*.authorization',
    'headers.authorization',
    'req.headers.authorization',
    'request.headers.authorization',
    'token',
    '*.token',
    'secret',
    '*.secret',
    'NAI_FACTORY_DATA_ENCRYPTION_KEY',
    'NAI_FACTORY_ACCESS_TOKEN',
]

const EnvBoolean = z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.enum(['1', 'true', 'yes', 'on', '0', 'false', 'no', 'off']))
    .transform((value) => ['1', 'true', 'yes', 'on'].includes(value))
const EnvInteger = z.coerce.number().int()
const EnvPositiveInteger = EnvInteger.positive()
const EnvList = z.string().transform((value) =>
    value
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean),
)
const EnvString = z.string().trim().min(1)

const EnvSchema = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    HOST: EnvString.optional(),
    PORT: EnvPositiveInteger.default(3000),
    WEB_DIST_DIR: EnvString.optional(),
    /** Development only: the Vite dev server origin allowed by CORS. */
    DEV_WEB_ORIGIN: EnvString.default('http://localhost:5173'),
    NAI_FACTORY_DATA_DIR: EnvString.optional(),
    DATABASE_URL: EnvString.optional(),
    DATABASE_CACHE_SIZE: EnvInteger.default(10000),
    NAI_FACTORY_MIGRATIONS_DIR: EnvString.optional(),
    LOG_LEVEL: z.enum(LOG_LEVELS).optional(),
    LOG_PRETTY: EnvBoolean.optional(),
    LOG_COLORIZE: EnvBoolean.optional(),
    LOG_REDACT_PATHS: EnvList.optional(),
    NAI_FACTORY_DATA_ENCRYPTION_ENABLED: EnvBoolean.default(false),
    NAI_FACTORY_DATA_ENCRYPTION_KEY: EnvString.optional(),
    NAI_FACTORY_MAX_UPLOAD_MB: EnvPositiveInteger.default(512),
    NAI_FACTORY_ARCHIVE_MAX_UNCOMPRESSED_MB: EnvPositiveInteger.default(4096),
    NAI_FACTORY_ALLOWED_HOSTS: EnvList.optional(),
    NAI_FACTORY_ACCESS_TOKEN: EnvString.optional(),
    NAI_FACTORY_EXPORT_DIR: EnvString.optional(),
    NAI_FACTORY_SSE_HEARTBEAT_MS: EnvPositiveInteger.default(15_000),
    /** Initial NovelAI mode for a new data folder (e.g. `mock` for smoke tests). */
    NAI_FACTORY_NOVELAI_MODE: NovelAIMode.optional(),
})

export type Env = Record<string, string | undefined>

export type AppConfig = {
    env: 'development' | 'test' | 'production'
    host: string
    port: number
    webDistDir: string
    devWebOrigin: string
    dataDir: string
    databasePath: string
    databaseCacheSize: number
    /** Overrides the bundled drizzle migrations folder. */
    migrationsDir: string | null
    log: {
        level: (typeof LOG_LEVELS)[number]
        pretty: boolean
        colorize: boolean
        redactPaths: string[]
    }
    /** Base64 32-byte key, or null when new writes are not encrypted. */
    encryptionKey: string | null
    maxUploadBytes: number
    archiveMaxUncompressedBytes: number
    allowedHosts: string[]
    accessToken: string | null
    exportDir: string | null
    initialNovelAIMode: NovelAIMode
    sseHeartbeatMs: number
}

function formatZodError(error: z.ZodError) {
    return error.issues
        .map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`)
        .join('; ')
}

export function normalizeEncryptionKey(value: string | undefined) {
    if (!value) return null

    const trimmed = value.trim()
    const prefixedHex = trimmed.match(/^hex:(.+)$/i)?.[1]
    const prefixedBase64 = trimmed.match(/^base64:(.+)$/i)?.[1]
    const candidates = prefixedHex
        ? [Buffer.from(prefixedHex, 'hex')]
        : prefixedBase64
          ? [Buffer.from(prefixedBase64, 'base64')]
          : [
                /^[a-f0-9]{64}$/i.test(trimmed) ? Buffer.from(trimmed, 'hex') : null,
                Buffer.from(trimmed, 'base64'),
            ]

    for (const candidate of candidates) {
        if (candidate?.byteLength === 32) return candidate.toString('base64')
    }

    throw new Error(
        'Invalid NAI_FACTORY_DATA_ENCRYPTION_KEY: expected a 32-byte key encoded as base64 or 64 hex characters',
    )
}

export function loadConfig(env: Env = process.env): AppConfig {
    const parsed = EnvSchema.safeParse(env)
    if (!parsed.success) {
        throw new Error(`Invalid environment config: ${formatZodError(parsed.error)}`)
    }

    const raw = parsed.data
    const isProduction = raw.NODE_ENV === 'production'
    const isTest = raw.NODE_ENV === 'test'
    const hasExplicitLogging =
        raw.LOG_LEVEL !== undefined ||
        raw.LOG_PRETTY !== undefined ||
        raw.LOG_COLORIZE !== undefined ||
        raw.LOG_REDACT_PATHS !== undefined
    const encryptionKey = normalizeEncryptionKey(raw.NAI_FACTORY_DATA_ENCRYPTION_KEY)

    if (raw.NAI_FACTORY_DATA_ENCRYPTION_ENABLED && !encryptionKey) {
        throw new Error(
            'NAI_FACTORY_DATA_ENCRYPTION_KEY is required when data encryption is enabled',
        )
    }

    const dataDir =
        raw.NAI_FACTORY_DATA_DIR ??
        (isTest ? join(tmpdir(), `nai-factory-test-${process.pid}`) : './data')

    return {
        env: raw.NODE_ENV,
        host: raw.HOST ?? '127.0.0.1',
        port: raw.PORT,
        webDistDir:
            raw.WEB_DIST_DIR ?? (isProduction ? join(import.meta.dir, 'public') : '../web/dist'),
        devWebOrigin: raw.DEV_WEB_ORIGIN,
        dataDir,
        databasePath: raw.DATABASE_URL ?? join(dataDir, 'database.db'),
        databaseCacheSize: raw.DATABASE_CACHE_SIZE,
        migrationsDir: raw.NAI_FACTORY_MIGRATIONS_DIR ?? null,
        log: {
            level: raw.LOG_LEVEL ?? (isTest ? 'silent' : 'info'),
            pretty: raw.LOG_PRETTY ?? (hasExplicitLogging || isTest ? false : !isProduction),
            colorize: raw.LOG_COLORIZE ?? (hasExplicitLogging || isTest ? false : !isProduction),
            redactPaths: raw.LOG_REDACT_PATHS ?? DEFAULT_REDACT_PATHS,
        },
        encryptionKey: raw.NAI_FACTORY_DATA_ENCRYPTION_ENABLED ? encryptionKey : null,
        maxUploadBytes: raw.NAI_FACTORY_MAX_UPLOAD_MB * 1024 * 1024,
        archiveMaxUncompressedBytes: raw.NAI_FACTORY_ARCHIVE_MAX_UNCOMPRESSED_MB * 1024 * 1024,
        allowedHosts: raw.NAI_FACTORY_ALLOWED_HOSTS ?? [],
        accessToken: raw.NAI_FACTORY_ACCESS_TOKEN ?? null,
        exportDir: raw.NAI_FACTORY_EXPORT_DIR ?? null,
        initialNovelAIMode: raw.NAI_FACTORY_NOVELAI_MODE ?? 'live',
        sseHeartbeatMs: raw.NAI_FACTORY_SSE_HEARTBEAT_MS,
    }
}
