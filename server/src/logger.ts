import pino from 'pino'

const logger =
    Bun.env.NODE_ENV === 'production'
        ? pino()
        : pino({
              transport: {
                  target: 'pino-pretty',
                  options: {
                      colorize: true,
                  },
              },
          })

export default logger
