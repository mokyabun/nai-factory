import { join } from 'node:path'
import { z } from 'zod'

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
]

const NodeEnvSchema = z.enum(['development', 'test', 'production'])
const LogLevelSchema = z.enum(LOG_LEVELS)
const EnvBooleanSchema = z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.enum(['1', 'true', 'yes', 'on', '0', 'false', 'no', 'off']))
    .transform((value) => ['1', 'true', 'yes', 'on'].includes(value))
const EnvIntegerSchema = z.coerce.number().int()
const EnvPositiveIntegerSchema = EnvIntegerSchema.positive()
const EnvListSchema = z.string().transform((value) =>
    value
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean),
)

const RawEnvConfigSchema = z
    .object({
        NODE_ENV: NodeEnvSchema.default('development'),
        PORT: EnvPositiveIntegerSchema.default(3000),
        WEB_DIST_DIR: z.string().min(1).optional(),
        NAI_FACTORY_DATA_DIR: z.string().min(1).default('./data'),
        NAI_FACTORY_IMAGES_DIR: z.string().min(1).optional(),
        NAI_FACTORY_THUMBNAILS_DIR: z.string().min(1).optional(),
        NAI_FACTORY_VIBES_DIR: z.string().min(1).optional(),
        NAI_FACTORY_CHARACTER_REFERENCES_DIR: z.string().min(1).optional(),
        DATABASE_URL: z.string().min(1).optional(),
        DATABASE_WAL: EnvBooleanSchema.default(true),
        DATABASE_CACHE_SIZE: EnvIntegerSchema.default(10000),
        LOG_LEVEL: LogLevelSchema.optional(),
        LOG_PRETTY: EnvBooleanSchema.optional(),
        LOG_COLORIZE: EnvBooleanSchema.optional(),
        LOG_REDACT_PATHS: EnvListSchema.optional(),
        TAG_DB_PATH: z.string().min(1).optional(),
        NAI_FACTORY_DATA_ENCRYPTION_ENABLED: EnvBooleanSchema.default(false),
        NAI_FACTORY_DATA_ENCRYPTION_KEY: z.string().min(1).optional(),
    })
    .passthrough()

const EnvConfigSchema = z.object({
    NODE_ENV: NodeEnvSchema,
    PORT: z.number().int().positive(),
    WEB_DIST_DIR: z.string().min(1),
    NAI_FACTORY_DATA_DIR: z.string().min(1),
    NAI_FACTORY_IMAGES_DIR: z.string().min(1),
    NAI_FACTORY_THUMBNAILS_DIR: z.string().min(1),
    NAI_FACTORY_VIBES_DIR: z.string().min(1),
    NAI_FACTORY_CHARACTER_REFERENCES_DIR: z.string().min(1),
    DATABASE_URL: z.string().min(1),
    DATABASE_WAL: z.boolean(),
    DATABASE_CACHE_SIZE: z.number().int(),
    LOG_LEVEL: LogLevelSchema,
    LOG_PRETTY: z.boolean(),
    LOG_COLORIZE: z.boolean(),
    LOG_REDACT_PATHS: z.array(z.string().min(1)),
    TAG_DB_PATH: z.string().min(1),
    NAI_FACTORY_DATA_ENCRYPTION_ENABLED: z.boolean(),
    NAI_FACTORY_DATA_ENCRYPTION_KEY: z.string().min(1).nullable(),
})

export type EnvConfig = z.infer<typeof EnvConfigSchema>

function formatZodError(error: z.ZodError) {
    return error.issues
        .map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`)
        .join('; ')
}

function normalizeEncryptionKey(value: string | undefined) {
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

export function loadEnvConfig(env: Record<string, string | undefined> = process.env): EnvConfig {
    const parsed = RawEnvConfigSchema.safeParse(env)
    if (!parsed.success) {
        throw new Error(`Invalid environment config: ${formatZodError(parsed.error)}`)
    }

    const raw = parsed.data
    const isProduction = raw.NODE_ENV === 'production'
    const hasExplicitLogging =
        env.LOG_LEVEL !== undefined ||
        env.LOG_PRETTY !== undefined ||
        env.LOG_COLORIZE !== undefined ||
        env.LOG_REDACT_PATHS !== undefined
    const NAI_FACTORY_DATA_ENCRYPTION_KEY = normalizeEncryptionKey(
        raw.NAI_FACTORY_DATA_ENCRYPTION_KEY,
    )

    if (raw.NAI_FACTORY_DATA_ENCRYPTION_ENABLED && !NAI_FACTORY_DATA_ENCRYPTION_KEY) {
        throw new Error(
            'NAI_FACTORY_DATA_ENCRYPTION_KEY is required when data encryption is enabled',
        )
    }

    const resolved = {
        NODE_ENV: raw.NODE_ENV,
        PORT: raw.PORT,
        WEB_DIST_DIR:
            raw.WEB_DIST_DIR ?? (isProduction ? join(import.meta.dir, 'public') : '../web/dist'),
        NAI_FACTORY_DATA_DIR: raw.NAI_FACTORY_DATA_DIR,
        NAI_FACTORY_IMAGES_DIR:
            raw.NAI_FACTORY_IMAGES_DIR ?? join(raw.NAI_FACTORY_DATA_DIR, 'images'),
        NAI_FACTORY_THUMBNAILS_DIR:
            raw.NAI_FACTORY_THUMBNAILS_DIR ?? join(raw.NAI_FACTORY_DATA_DIR, 'thumbnails'),
        NAI_FACTORY_VIBES_DIR: raw.NAI_FACTORY_VIBES_DIR ?? join(raw.NAI_FACTORY_DATA_DIR, 'vibes'),
        NAI_FACTORY_CHARACTER_REFERENCES_DIR:
            raw.NAI_FACTORY_CHARACTER_REFERENCES_DIR ??
            join(raw.NAI_FACTORY_DATA_DIR, 'character-references'),
        DATABASE_URL: raw.DATABASE_URL ?? join(raw.NAI_FACTORY_DATA_DIR, 'database.db'),
        DATABASE_WAL: raw.DATABASE_WAL,
        DATABASE_CACHE_SIZE: raw.DATABASE_CACHE_SIZE,
        LOG_LEVEL: raw.LOG_LEVEL ?? (isProduction ? 'info' : 'debug'),
        LOG_PRETTY: raw.LOG_PRETTY ?? (hasExplicitLogging ? false : !isProduction),
        LOG_COLORIZE: raw.LOG_COLORIZE ?? (hasExplicitLogging ? false : !isProduction),
        LOG_REDACT_PATHS: raw.LOG_REDACT_PATHS ?? DEFAULT_REDACT_PATHS,
        TAG_DB_PATH:
            raw.TAG_DB_PATH ??
            (isProduction
                ? join(import.meta.dir, 'assets/db.csv')
                : join(import.meta.dir, '../../assets/db.csv')),
        NAI_FACTORY_DATA_ENCRYPTION_ENABLED: raw.NAI_FACTORY_DATA_ENCRYPTION_ENABLED,
        NAI_FACTORY_DATA_ENCRYPTION_KEY,
    }

    const envConfig = EnvConfigSchema.safeParse(resolved)
    if (!envConfig.success) {
        throw new Error(`Invalid resolved environment config: ${formatZodError(envConfig.error)}`)
    }
    return envConfig.data
}

export const envConfig = loadEnvConfig()
