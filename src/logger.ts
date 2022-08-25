export const severities = ['debug', 'info', 'warn', 'error'] as const
export const logLevels = [...severities, 'silent'].map((s) => s.toUpperCase())

export type LogLevel = Uppercase<typeof severities[number]> | 'SILENT'
export type Severity = typeof severities[number]

export type LogFn = (...args: unknown[]) => ReturnType<typeof console.log>
export interface ILogger {
  debug: LogFn
  info: LogFn
  error: LogFn
  warn: LogFn
  minimumLogLevel?: typeof logLevels[number]
}

// eslint-disable-next-line @typescript-eslint/no-empty-function
const noop = () => {}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function wrapper(baseLogger: any): ILogger {
  const logger = baseLogger || {}
  if (logger.minimumLogLevel !== undefined && !logLevels.includes(logger.minimumLogLevel)) {
    throw new Error(`"minimumLogLevel" must be one of: ${logLevels.join(', ')} or "undefined"`)
  }

  return {
    debug: wrapLogFn(logger, 'debug'),
    info: wrapLogFn(logger, 'info'),
    warn: wrapLogFn(logger, 'warn'),
    error: wrapLogFn(logger, 'error'),
  }
}

function wrapLogFn(logger: Partial<ILogger>, prop: Severity): LogFn {
  let func: LogFn
  const logFn = logger[prop]
  if (logFn && typeof logFn === 'function') {
    func = logFn
  } else {
    func =
      logger.minimumLogLevel !== undefined
        ? // eslint-disable-next-line no-console
          (console[prop] || console.log).bind(console)
        : noop
  }
  return (...args: unknown[]) => {
    // Level is an alias for INFO to support console.log drop-in
    if (
      logger.minimumLogLevel !== undefined &&
      logLevels.indexOf(logger.minimumLogLevel) > logLevels.indexOf(prop.toUpperCase())
    ) {
      return
    }
    return func(...args)
  }
}
