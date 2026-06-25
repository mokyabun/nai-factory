import { describe, expect, it } from 'bun:test'
import { EnvConfigSchema } from '../src/config'

function parseEnvConfig(env: Record<string, string | undefined>) {
    const parsed = EnvConfigSchema.safeParse(env)
    if (!parsed.success) throw parsed.error
    return parsed.data
}

describe('runtime config', () => {
    it('derives quiet default logging when logging is not configured', () => {
        expect(parseEnvConfig({ NODE_ENV: 'production' })).toMatchObject({
            LOG_LEVEL: 'info',
            LOG_PRETTY: false,
            LOG_COLORIZE: false,
        })

        expect(parseEnvConfig({ NODE_ENV: 'development' })).toMatchObject({
            LOG_LEVEL: 'info',
            LOG_PRETTY: true,
            LOG_COLORIZE: true,
        })

        expect(parseEnvConfig({ NODE_ENV: 'test' })).toMatchObject({
            LOG_LEVEL: 'silent',
            LOG_PRETTY: false,
            LOG_COLORIZE: false,
        })
    })

    it('uses explicit logging env values instead of NODE_ENV defaults', () => {
        expect(
            parseEnvConfig({
                NODE_ENV: 'development',
                LOG_LEVEL: 'warn',
            }),
        ).toMatchObject({
            LOG_LEVEL: 'warn',
            LOG_PRETTY: false,
            LOG_COLORIZE: false,
        })
    })

    it('parses scalar env values', () => {
        const config = parseEnvConfig({
            HOST: '127.0.0.1',
            PORT: '5000',
            DATABASE_URL: './data/database.db',
            LOG_LEVEL: 'error',
        })

        expect(config.HOST).toBe('127.0.0.1')
        expect(config.PORT).toBe(5000)
        expect(config.DATABASE_URL).toBe('./data/database.db')
        expect(config.LOG_LEVEL).toBe('error')
    })

    it('parses data encryption settings from env', () => {
        const key = Buffer.alloc(32, 1).toString('base64')
        const config = parseEnvConfig({
            NAI_FACTORY_DATA_ENCRYPTION_ENABLED: 'true',
            NAI_FACTORY_DATA_ENCRYPTION_KEY: key,
        })

        expect(config).toMatchObject({
            NAI_FACTORY_DATA_ENCRYPTION_ENABLED: true,
            NAI_FACTORY_DATA_ENCRYPTION_KEY: key,
        })
    })

    it('requires a valid key when data encryption is enabled', () => {
        expect(() =>
            parseEnvConfig({
                NAI_FACTORY_DATA_ENCRYPTION_ENABLED: 'true',
            }),
        ).toThrow('NAI_FACTORY_DATA_ENCRYPTION_KEY is required')

        expect(() =>
            parseEnvConfig({
                NAI_FACTORY_DATA_ENCRYPTION_ENABLED: 'true',
                NAI_FACTORY_DATA_ENCRYPTION_KEY: 'too-short',
            }),
        ).toThrow('Invalid NAI_FACTORY_DATA_ENCRYPTION_KEY')
    })
})
