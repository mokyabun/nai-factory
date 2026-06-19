import { afterEach, describe, expect, it } from 'bun:test'
import { rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { loadConfig } from '../src/config'

const configPath = join(import.meta.dir, `runtime-config-${Date.now()}.json`)

afterEach(async () => {
    await rm(configPath, { force: true })
})

describe('runtime config', () => {
    it('derives default logging from NODE_ENV when logging is not configured', () => {
        expect(loadConfig({ NODE_ENV: 'production' }).logging).toMatchObject({
            level: 'info',
            pretty: false,
            colorize: false,
        })

        expect(loadConfig({ NODE_ENV: 'development' }).logging).toMatchObject({
            level: 'debug',
            pretty: true,
            colorize: true,
        })
    })

    it('uses explicit logging config instead of NODE_ENV defaults', async () => {
        await writeFile(
            configPath,
            JSON.stringify({
                schemaVersion: 1,
                logging: {
                    level: 'warn',
                },
            }),
        )

        expect(
            loadConfig({
                NAI_FACTORY_CONFIG: configPath,
                NODE_ENV: 'development',
            }).logging,
        ).toMatchObject({
            level: 'warn',
            pretty: false,
            colorize: false,
        })
    })

    it('lets env values override JSON config values', async () => {
        await writeFile(
            configPath,
            JSON.stringify({
                schemaVersion: 1,
                port: 4000,
                database: {
                    url: './data/from-json.db',
                },
                logging: {
                    level: 'warn',
                },
            }),
        )

        const config = loadConfig({
            NAI_FACTORY_CONFIG: configPath,
            PORT: '5000',
            DATABASE_URL: './data/from-env.db',
            LOG_LEVEL: 'error',
        })

        expect(config.port).toBe(5000)
        expect(config.database.url).toBe('./data/from-env.db')
        expect(config.logging.level).toBe('error')
    })
})
