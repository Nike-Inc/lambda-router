'use strict'

const uuid = require('uuid/v4')
const CUSTOM_RESPONSE = Symbol('lambda-router:custom-response')
const loggerWrapper = require('@nike/logger-wrapper')

module.exports = {
  Router,
  createProxyResponse
}

function Router ({
  logger,
  extractPathParameters = true,
  includeTraceId = true,
  inluceErrorStack = false,
  cors = true,
  parseBody = true,
  decodeEvent = true
} = {}) {
  logger = loggerWrapper(logger)
  const routes = []
  const add = (method, path, handler) => {
    routes.push({ method, path, handler })
  }

  let unknownRouteHandler = { handler: defaultUnknownRoute }
  let defaultHeaders = {
    'Content-Type': 'application/json'
  }
  if (cors) {
    defaultHeaders['Access-Control-Allow-Origin'] = typeof cors === 'boolean' ? '*' : cors
  }

  // External hooks
  let onErrorFormat

  const route = async (event, lambdaContext, requestPath, httpMethod) => {
    // Safety Checks
    if (lambdaContext.response) {
      let message = 'context.response has already been assigned. Lambda-router reserves this property for custom responses.'
      logger.error(message)
      return Promise.reject(new Error(message))
    }
    // Clone context
    let context = {...lambdaContext, response: customResponse}

    // Allow method and path overrides
    httpMethod = httpMethod || event.method || event.httpMethod
    requestPath = requestPath || event.path || event.resourcePath || event.resource

    let route = getRoute(routes, event, requestPath, httpMethod) || unknownRouteHandler

    // Parse and decode
    try {
      if (parseBody && event.body && typeof event.body === 'string') {
        logger.debug('parsing body')
        event.body = JSON.parse(event.body)
      }
      if (decodeEvent) {
        logger.debug('decoding parameters')
        event.pathParameters = decodeProperties(event.pathParameters || {})
        event.queryStringParameters = decodeProperties(event.queryStringParameters || {})
      }
    } catch (error) {
      logger.error('error', error.toString(), error.stack)
      return createResponse(400, { message: 'Malformed request' }, defaultHeaders, route.path, requestPath)
    }

    // Route
    let statusCode, body
    let headers = { ...defaultHeaders }
    if (includeTraceId) headers['X-Correlation-Id'] = getTraceId(event)
    try {
      // It is possible for the handler to be a synchronous method
      // So wrap it in a promise to get consistent behavior from "await"
      // And if it throws synchronously, then() will reject/throw
      let result = await Promise.resolve().then(() => route.handler(event, context))
      if (result && result._isCustomResponse === CUSTOM_RESPONSE) {
        statusCode = result.statusCode
        body = result.body
        headers = {...defaultHeaders, ...result.headers}
      } else {
        statusCode = 200
        body = result
      }
    } catch (error) {
      statusCode = error.statusCode || 500
      body = {
        ...error,
        // The spread doesn't get the non-enumerable message
        message: error.message,
        stack: inluceErrorStack && error.stack
      }
      if (onErrorFormat && typeof onErrorFormat === 'function') {
        body = onErrorFormat(statusCode, body)
      }
    }

    return createResponse(statusCode, body, headers, route.path, requestPath)
  }

  // Bound router functions
  return {
    get: add.bind(null, 'GET'),
    post: add.bind(null, 'POST'),
    put: add.bind(null, 'PUT'),
    'delete': add.bind(null, 'DELETE'),
    unknown: (handler) => { unknownRouteHandler = { handler } },
    formatError: (handler) => { onErrorFormat = handler },
    route
  }
}

function customResponse (statusCode, body, headers) {
  let response = {
    statusCode,
    body,
    headers
  }
  Object.defineProperty(response, '_isCustomResponse', {
    enumerable: false,
    configurable: false,
    value: CUSTOM_RESPONSE
  })
  return response
}

function getRoute (routes, event, eventPath, method, tokenizePathParts) {
  let route = routes.find(r => {
    return eventPath === r.path && method === r.method
  })

  if (!route) {
    let tokens
    route = routes.find(r => {
      if (method !== r.method) return false
      tokens = doPathPartsMatch(eventPath, r)
      return !!tokens
    })
    if (tokenizePathParts && tokens) {
      Object.assign(event.pathParameters, tokens)
    }
  }

  return route
}

function doPathPartsMatch (eventPath, route) {
  const eventPathParts = eventPath.split('/')
  const routePathParts = route.path.split('/')

  // Fail fast if they're not the same length
  if (eventPathParts.length !== routePathParts.length) return false
  let tokens = {}

  // Start with 1 because the url should always start with the first back slash
  for (let i = 1; i < eventPathParts.length; ++i) {
    const pathPart = eventPathParts[i]
    const routePart = routePathParts[i]

    // If the part is a curly braces value
    let pathPartMatch = /\{(\w+)}/g.exec(routePart)
    if (pathPartMatch) {
      tokens[pathPartMatch[1]] = pathPart
      continue
    }

    // Fail fast if a part doesn't match
    if (routePart !== pathPart) {
      return false
    }
  }

  return tokens
}

function defaultUnknownRoute (event) {
  throw new Error('No route specified.')
}

function createResponse (statusCode, body, headers, endpoint, uri) {
  return {
    endpoint,
    uri,
    isOk: statusCode.toString()[0] === '2',
    response: createProxyResponse(statusCode, body, headers)
  }
}

function createProxyResponse (statusCode, body, headers = {}) {
  if (headers['Content-Type'] === undefined) headers['Content-Type'] = 'application/json'
  // output follows the format described here
  // http://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-set-up-simple-proxy.html?shortFooter=true#api-gateway-simple-proxy-for-lambda-output-format
  return {
    statusCode: statusCode,
    body: JSON.stringify(body),
    headers: { ...headers }
  }
}

function getTraceId (event) {
  return event.headers &&
    (event.headers['X-Trace-Id'] ||
      event.headers['X-TRACE-ID'] ||
      event.headers['x-trace-id'] ||
      event.headers['X-Correlation-Id'] ||
      event.headers['X-CORRELATION-ID'] ||
      event.headers['x-correlation-id']) ||
    uuid()
}

function decodeProperties (obj) {
  return obj && Object.keys(obj).reduce((r, key) => {
    r[key] = decodeURIComponent(obj[key])
    return r
  }, {})
}
