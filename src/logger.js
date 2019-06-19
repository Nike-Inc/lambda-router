'use strict'
const assert = require('assert')

const logLevels = ['DEBUG', 'INFO', 'WARN', 'ERROR']
// eslint-disable-next-line no-empty-function
const noop = () => {}

const makeLogWrapper = (logger, prop) => {
  let func
  if (logger[prop] && typeof logger[prop] === 'function') {
    func = logger[prop]
  } else {
    func =
      logger.minimumLogLevel !== undefined
        ? // eslint-disable-next-line no-console
          (console[prop] || console.log).bind(console)
        : noop
  }
  return (...args) => {
    if (
      logger.minimumLogLevel !== undefined &&
      logLevels.indexOf(logger.minimumLogLevel) > logLevels.indexOf(prop.toUpperCase())
    )
      return
    return func(...args)
  }
}

function loggerWrapper(loggerArg) {
  const logger = loggerArg || {}
  if (logger.minimumLogLevel !== undefined) {
    assert(
      logLevels.indexOf(logger.minimumLogLevel) !== -1,
      `"minimumLogLevel" must be one of: ${logLevels.join(', ')} or "undefined"`
    )
  }

  return {
    error: makeLogWrapper(logger, 'error'),
    warn: makeLogWrapper(logger, 'warn'),
    info: makeLogWrapper(logger, 'info'),
    debug: makeLogWrapper(logger, 'debug')
  }
}

module.exports = {
  loggerWrapper
}
