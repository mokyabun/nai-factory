import pino from 'pino'

import { type AppConfig, loadConfig } from './config'

export type Logger = pino.Logger

export function createLogger(config: AppConfig['log'], env: AppConfig['env']): Logger {
    const options: pino.LoggerOptions = {
        level: config.level,
        base: { service: 'nai-factory-server', env },
        timestamp: pino.stdTimeFunctions.isoTime,
        formatters: {
            level(label) {
                return { level: label }
            },
        },
        redact: { paths: config.redactPaths, censor: '[redacted]' },
        serializers: { err: pino.stdSerializers.err, error: pino.stdSerializers.err },
    }

    if (!config.pretty) return pino(options)

    return pino({
        ...options,
        transport: {
            target: 'pino-pretty',
            options: {
                colorize: config.colorize,
                ignore: 'service,env',
                messageFormat: '[{module}] {msg}',
                singleLine: true,
                translateTime: 'SYS:standard',
            },
        },
    })
}

const bootConfig = loadConfig()

const logger = createLogger(bootConfig.log, bootConfig.env)

export default logger
