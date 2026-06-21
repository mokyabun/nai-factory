import { describe, expect, it } from 'bun:test'
import { loadEnvConfig } from '../src/config'

describe('runtime config', () => {
    it('derives default logging from NODE_ENV when logging is not configured', () => {
        expect(loadEnvConfig({ NODE_ENV: 'production' })).toMatchObject({
            LOG_LEVEL: 'info',
            LOG_PRETTY: false,
            LOG_COLORIZE: false,
        })

        expect(loadEnvConfig({ NODE_ENV: 'development' })).toMatchObject({
            LOG_LEVEL: 'debug',
            LOG_PRETTY: true,
            LOG_COLORIZE: true,
        })
    })

    it('uses explicit logging env values instead of NODE_ENV defaults', () => {
        expect(
            loadEnvConfig({
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
        const config = loadEnvConfig({
            PORT: '5000',
            DATABASE_URL: './data/database.db',
            LOG_LEVEL: 'error',
        })

        expect(config.PORT).toBe(5000)
        expect(config.DATABASE_URL).toBe('./data/database.db')
        expect(config.LOG_LEVEL).toBe('error')
    })

    it('parses data encryption settings from env', () => {
        const key = Buffer.alloc(32, 1).toString('base64')
        const config = loadEnvConfig({
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
            loadEnvConfig({
                NAI_FACTORY_DATA_ENCRYPTION_ENABLED: 'true',
            }),
        ).toThrow('NAI_FACTORY_DATA_ENCRYPTION_KEY is required')

        expect(() =>
            loadEnvConfig({
                NAI_FACTORY_DATA_ENCRYPTION_ENABLED: 'true',
                NAI_FACTORY_DATA_ENCRYPTION_KEY: 'too-short',
            }),
        ).toThrow('Invalid NAI_FACTORY_DATA_ENCRYPTION_KEY')
    })
})
