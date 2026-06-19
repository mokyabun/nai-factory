import pino from 'pino'
import { appConfig } from './config'

const baseOptions: pino.LoggerOptions = {
    level: appConfig.logging.level,
    redact: {
        paths: appConfig.logging.redactPaths,
        censor: '[redacted]',
    },
    serializers: {
        err: pino.stdSerializers.err,
        error: pino.stdSerializers.err,
    },
}

const logger = (() => {
    if (!appConfig.logging.pretty) {
        return pino(baseOptions)
    }

    return pino({
        ...baseOptions,
        transport: {
            target: 'pino-pretty',
            options: {
                colorize: appConfig.logging.colorize,
                ignore: 'pid,hostname',
                translateTime: 'SYS:standard',
            },
        },
    })
})()

export default logger
