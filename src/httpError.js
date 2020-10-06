'use strict'

class HttpError extends Error {
  constructor(statusCode, message, extra) {
    super()
    Error.captureStackTrace(this, this.constructor)
    this.message =
      typeof message === 'object' && message instanceof Error ? message.message : message || ''
    this.statusCode = statusCode || 500

    // Extend with custom data
    if (extra) {
      Object.assign(this, extra)
    }
  }

  static assert(predicate, statusCode, message, extra) {
    if (predicate) return
    throw new HttpError(statusCode, message, extra)
  }
}

module.exports = {
  HttpError
}
