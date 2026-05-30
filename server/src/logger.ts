import pino from 'pino'

const level = Bun.env.LOG_LEVEL ?? (Bun.env.NODE_ENV === 'production' ? 'info' : 'debug')

const baseOptions: pino.LoggerOptions = {
    level,
    redact: {
        paths: [
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
        ],
        censor: '[redacted]',
    },
    serializers: {
        err: pino.stdSerializers.err,
        error: pino.stdSerializers.err,
    },
}

const logger =
    Bun.env.NODE_ENV === 'production'
        ? pino(baseOptions)
        : pino({
              ...baseOptions,
              transport: {
                  target: 'pino-pretty',
                  options: {
                      colorize: true,
                      ignore: 'pid,hostname',
                      translateTime: 'SYS:standard',
                  },
              },
          })

export default logger
