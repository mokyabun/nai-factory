import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { z } from 'zod'

const CONFIG_SCHEMA_VERSION = 1
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
]

const NodeEnvSchema = z.enum(['development', 'test', 'production'])
const LogLevelSchema = z.enum(LOG_LEVELS)

type NodeEnv = z.infer<typeof NodeEnvSchema>
type LogLevel = z.infer<typeof LogLevelSchema>

const JsonConfigSchema = z
    .object({
        schemaVersion: z.literal(CONFIG_SCHEMA_VERSION).default(CONFIG_SCHEMA_VERSION),
        nodeEnv: NodeEnvSchema.default('development'),
        port: z.number().int().positive().default(3000),
        webDistDir: z.string().min(1).optional(),
        paths: z
            .object({
                dataDir: z.string().min(1).optional(),
                imagesDir: z.string().min(1).optional(),
                thumbnailsDir: z.string().min(1).optional(),
                vibesDir: z.string().min(1).optional(),
                characterReferencesDir: z.string().min(1).optional(),
            })
            .strict()
            .default({}),
        database: z
            .object({
                url: z.string().min(1).optional(),
                wal: z.boolean().optional(),
                cacheSize: z.number().int().optional(),
            })
            .strict()
            .default({}),
        logging: z
            .object({
                level: LogLevelSchema.optional(),
                pretty: z.boolean().optional(),
                colorize: z.boolean().optional(),
                redactPaths: z.array(z.string().min(1)).optional(),
            })
            .strict()
            .optional(),
        assets: z
            .object({
                tagDbPath: z.string().min(1).optional(),
            })
            .strict()
            .default({}),
    })
    .strict()

export type JsonConfig = z.input<typeof JsonConfigSchema>
export type AppConfig = {
    schemaVersion: typeof CONFIG_SCHEMA_VERSION
    configPath: string
    nodeEnv: NodeEnv
    isProduction: boolean
    port: number
    webDistDir: string
    paths: {
        dataDir: string
        imagesDir: string
        thumbnailsDir: string
        vibesDir: string
        characterReferencesDir: string
    }
    database: {
        url: string
        wal: boolean
        cacheSize: number
    }
    logging: {
        level: LogLevel
        pretty: boolean
        colorize: boolean
        redactPaths: string[]
    }
    assets: {
        tagDbPath: string
    }
}

type JsonConfigData = z.infer<typeof JsonConfigSchema>

function parseNumber(name: string, value: string | undefined) {
    if (!value) return undefined

    const parsed = Number(value)
    if (!Number.isFinite(parsed)) throw new Error(`Invalid number for ${name}: ${value}`)
    return parsed
}

function parseBoolean(name: string, value: string | undefined) {
    if (!value) return undefined

    const normalized = value.toLowerCase()
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false

    throw new Error(`Invalid boolean for ${name}: ${value}`)
}

function parseList(value: string | undefined) {
    if (!value) return undefined

    const values = value
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)
    return values.length > 0 ? values : undefined
}

function definedObject(values: Record<string, unknown>) {
    const entries = Object.entries(values).filter(([, value]) => value !== undefined)
    return entries.length > 0 ? Object.fromEntries(entries) : undefined
}

function object(value: unknown): Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {}
}

function configError(error: z.ZodError) {
    return error.issues
        .map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`)
        .join('; ')
}

function migrateConfig(input: unknown) {
    if (typeof input !== 'object' || input === null || Array.isArray(input)) return input

    const record = input as Record<string, unknown>
    const version = record.schemaVersion ?? CONFIG_SCHEMA_VERSION
    if (version !== CONFIG_SCHEMA_VERSION) {
        throw new Error(`Unsupported config schemaVersion: ${String(version)}`)
    }

    return { ...record, schemaVersion: CONFIG_SCHEMA_VERSION }
}

function readJsonConfig(configPath: string) {
    if (!existsSync(configPath)) return {}

    try {
        return migrateConfig(JSON.parse(readFileSync(configPath, 'utf8')))
    } catch (error) {
        if (error instanceof SyntaxError) {
            throw new Error(`Invalid JSON config at ${configPath}: ${error.message}`)
        }
        throw error
    }
}

function envConfig(env: Record<string, string | undefined>) {
    return definedObject({
        nodeEnv: env.NODE_ENV,
        port: parseNumber('PORT', env.PORT),
        webDistDir: env.WEB_DIST_DIR,
        paths: definedObject({
            dataDir: env.NAI_FACTORY_DATA_DIR,
            imagesDir: env.NAI_FACTORY_IMAGES_DIR,
            thumbnailsDir: env.NAI_FACTORY_THUMBNAILS_DIR,
            vibesDir: env.NAI_FACTORY_VIBES_DIR,
            characterReferencesDir: env.NAI_FACTORY_CHARACTER_REFERENCES_DIR,
        }),
        database: definedObject({
            url: env.DATABASE_URL,
            wal: parseBoolean('DATABASE_WAL', env.DATABASE_WAL),
            cacheSize: parseNumber('DATABASE_CACHE_SIZE', env.DATABASE_CACHE_SIZE),
        }),
        logging: definedObject({
            level: env.LOG_LEVEL,
            pretty: parseBoolean('LOG_PRETTY', env.LOG_PRETTY),
            colorize: parseBoolean('LOG_COLORIZE', env.LOG_COLORIZE),
            redactPaths: parseList(env.LOG_REDACT_PATHS),
        }),
        assets: definedObject({
            tagDbPath: env.TAG_DB_PATH,
        }),
    })
}

function mergeConfig(fileConfig: unknown, envConfig: unknown) {
    const file = object(fileConfig)
    const env = object(envConfig)

    return {
        ...file,
        ...env,
        paths: { ...object(file.paths), ...object(env.paths) },
        database: {
            ...object(file.database),
            ...object(env.database),
        },
        logging:
            file.logging || env.logging
                ? {
                      ...object(file.logging),
                      ...object(env.logging),
                  }
                : undefined,
        assets: {
            ...object(file.assets),
            ...object(env.assets),
        },
    }
}

function resolveConfig(configPath: string, config: JsonConfigData): AppConfig {
    const isProduction = config.nodeEnv === 'production'
    const dataDir = config.paths.dataDir ?? './data'
    const logging: AppConfig['logging'] = config.logging
        ? {
              level: config.logging.level ?? 'info',
              pretty: config.logging.pretty ?? false,
              colorize: config.logging.colorize ?? false,
              redactPaths: config.logging.redactPaths ?? DEFAULT_REDACT_PATHS,
          }
        : {
              level: isProduction ? 'info' : 'debug',
              pretty: !isProduction,
              colorize: !isProduction,
              redactPaths: DEFAULT_REDACT_PATHS,
          }

    return {
        schemaVersion: config.schemaVersion,
        configPath,
        nodeEnv: config.nodeEnv,
        isProduction,
        port: config.port,
        webDistDir:
            config.webDistDir ?? (isProduction ? join(import.meta.dir, 'public') : '../web/dist'),
        paths: {
            dataDir,
            imagesDir: config.paths.imagesDir ?? join(dataDir, 'images'),
            thumbnailsDir: config.paths.thumbnailsDir ?? join(dataDir, 'thumbnails'),
            vibesDir: config.paths.vibesDir ?? join(dataDir, 'vibes'),
            characterReferencesDir:
                config.paths.characterReferencesDir ?? join(dataDir, 'character-references'),
        },
        database: {
            url: config.database.url ?? join(dataDir, 'database.db'),
            wal: config.database.wal ?? true,
            cacheSize: config.database.cacheSize ?? 10000,
        },
        logging,
        assets: {
            tagDbPath:
                config.assets.tagDbPath ??
                (isProduction
                    ? join(import.meta.dir, 'assets/db.csv')
                    : join(import.meta.dir, '../../assets/db.csv')),
        },
    }
}

export function loadConfig(env: Record<string, string | undefined> = process.env): AppConfig {
    const configPath = env.NAI_FACTORY_CONFIG ?? './config.json'
    const parsed = JsonConfigSchema.safeParse(
        mergeConfig(readJsonConfig(configPath), envConfig(env)),
    )

    if (!parsed.success) {
        throw new Error(`Invalid runtime config: ${configError(parsed.error)}`)
    }

    return resolveConfig(configPath, parsed.data)
}

export function saveJsonConfig(config: JsonConfig, configPath = appConfig.configPath) {
    const parsed = JsonConfigSchema.safeParse(migrateConfig(config))
    if (!parsed.success) {
        throw new Error(`Invalid runtime config: ${configError(parsed.error)}`)
    }

    mkdirSync(dirname(configPath), { recursive: true })
    writeFileSync(configPath, `${JSON.stringify(parsed.data, null, 2)}\n`)
}

export const appConfig = loadConfig()
