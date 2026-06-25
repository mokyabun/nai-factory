import pino from 'pino'
import { envConfig } from './config'

const baseOptions: pino.LoggerOptions = {
    level: envConfig.LOG_LEVEL,
    base: {
        service: 'nai-factory-server',
        env: envConfig.NODE_ENV,
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
        level(label) {
            return { level: label }
        },
    },
    redact: {
        paths: envConfig.LOG_REDACT_PATHS,
        censor: '[redacted]',
    },
    serializers: {
        err: pino.stdSerializers.err,
        error: pino.stdSerializers.err,
    },
}

const logger = (() => {
    if (!envConfig.LOG_PRETTY) {
        return pino(baseOptions)
    }

    return pino({
        ...baseOptions,
        transport: {
            target: 'pino-pretty',
            options: {
                colorize: envConfig.LOG_COLORIZE,
                ignore: 'service,env',
                messageFormat: '[{module}] {msg}',
                singleLine: true,
                translateTime: 'SYS:standard',
            },
        },
    })
})()

export default logger
