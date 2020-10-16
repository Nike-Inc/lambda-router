'use strict'

const qs = require('querystring')
const uuid = require('uuid/v4')
const { loggerWrapper } = require('./logger')
const { batchHandler } = require('./batch')

const CUSTOM_RESPONSE = Symbol('lambda-router:custom-response')
const TRACE_ID = Symbol('trace-id')

module.exports = {
  Router,
  getTraceId,
  createProxyResponse
}

function Router({
  logger,
  extractPathParameters = true,
  // default to false, otherwise adding this would be a breaking change
  // TODO: v3, default true
  trimTrailingSlash = false,
  includeTraceId = true,
  includeErrorStack = false,
  cors = true,
  parseBody = true,
  assumeJson = false,
  decodeEvent = true,
  // default to false, otherwise adding this would be a breaking change
  // TODO: v3, default true
  normalizeHeaders = false
} = {}) {
  const originalLogger = logger

  if (originalLogger && originalLogger.events && originalLogger.setKey) {
    originalLogger.events.on('beforeHandler', (event, context) => {
      originalLogger.setKey('traceId', getTraceId(event, context))
    })
  }

  logger = loggerWrapper(logger)
  const routes = []
  const addRoute = (method, path, handler) => {
    routes.push({ method, path, handler })
  }

  const middleware = []
  const addMiddleware = handler => {
    if (typeof handler === 'function') middleware.push(handler)
  }

  let unknownRouteHandler = defaultUnknownRoute
  let defaultHeaders = {
    'Content-Type': 'application/json'
  }
  if (cors) {
    defaultHeaders['Access-Control-Allow-Origin'] = typeof cors === 'boolean' ? '*' : cors
  }

  // External hooks
  let onErrorFormat

  const route = async (event, context, requestPath, httpMethod) => {
    let statusCode, body
    let requestHeaders = normalizeRequestHeaders(event.headers)
    let headers = { ...defaultHeaders }
    // Safety Checks
    if (context.response) {
      let message =
        'context.response has already been assigned. Lambda-router reserves this property for custom responses.'
      logger.error(message)
      return Promise.reject(new Error(message))
    }
    // Custom Response
    context.response = customResponse.bind(null, context)
    // Allow setting custom header without full-custom response
    context.response.setHeader = (header, value) => {
      headers[header] = value
    }

    // Allow method and path overrides
    httpMethod = httpMethod || event.method || event.httpMethod
    requestPath = requestPath || event.path || event.resourcePath || event.resource

    if (trimTrailingSlash) {
      requestPath = requestPath.replace(/\/$/, '')
    }

    // HTTP/2 says headers all always lowercase
    if (normalizeHeaders) {
      event.rawHeaders = event.headers
      event.headers = requestHeaders
    }

    let route = getRoute(routes, event, requestPath, httpMethod, extractPathParameters)
    let hasBody = event.body && typeof event.body === 'string'
    let contentType = requestHeaders && requestHeaders['content-type']
    let jsonBody =
      hasBody && (hasHeaderValue(contentType, 'application/json') || (!contentType && assumeJson))
    let urlEncodedBody = hasBody && hasHeaderValue(contentType, 'application/x-www-form-urlencoded')

    // Parse and decode
    try {
      if (parseBody) {
        event.rawBody = event.body
        if (jsonBody) event.body = JSON.parse(event.body)
        else if (urlEncodedBody) event.body = qs.parse(event.body)
      }
      if (decodeEvent) {
        logger.debug('decoding parameters')
        event.pathParameters = decodeProperties(event.pathParameters || {})
        event.queryStringParameters = decodeProperties(event.queryStringParameters || {})
      }
    } catch (error) {
      logger.error('route error', error.toString(), error.stack)
      return createResponse(
        400,
        { message: 'Malformed request' },
        defaultHeaders,
        route.path,
        requestPath
      )
    }

    // Route
    if (includeTraceId) context.traceId = headers['X-Correlation-Id'] = getTraceId(event, context)
    try {
      for (let fn of middleware) {
        await fn(event, context, requestPath, httpMethod)
      }

      let result = await (route
        ? route.handler(event, context)
        : unknownRouteHandler(event, context, requestPath, httpMethod))
      if (result && result._isCustomResponse === CUSTOM_RESPONSE) {
        statusCode = result.statusCode
        body = result.body
        headers = { ...defaultHeaders, ...result.headers }
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
        stack: includeErrorStack && error.stack
      }
      if (onErrorFormat && typeof onErrorFormat === 'function') {
        body = onErrorFormat(statusCode, body)
      }
    }

    return createResponse(statusCode, body, headers, route && route.path, requestPath)
  }

  const addBatchRoute = (path, config) => {
    routes.push({
      method: 'POST',
      path,
      handler: batchHandler.bind(null, { route, config })
    })
  }
  
  // Bound router functions
  return {
    beforeRoute: addMiddleware,
    get: addRoute.bind(null, 'GET'),
    post: addRoute.bind(null, 'POST'),
    put: addRoute.bind(null, 'PUT'),
    delete: addRoute.bind(null, 'DELETE'),
    patch: addRoute.bind(null, 'PATCH'),
    batch: addBatchRoute,
    unknown: handler => {
      unknownRouteHandler = handler
    },
    formatError: handler => {
      onErrorFormat = handler
    },
    route
  }
}

function customResponse(context, statusCode, body, headers) {
  let response = {
    statusCode,
    body,
    headers
  }
  if (context.includeTraceId && context.traceId) {
    headers['X-Correlation-Id'] = context.traceId
  }
  Object.defineProperty(response, '_isCustomResponse', {
    enumerable: false,
    configurable: false,
    value: CUSTOM_RESPONSE
  })
  return response
}

function getRoute(routes, event, eventPath, method, tokenizePathParts) {
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
      if (!event.pathParameters) event.pathParameters = {}
      Object.assign(event.pathParameters, tokens)
    }
  }

  return route
}

function doPathPartsMatch(eventPath, route) {
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

function defaultUnknownRoute(event, context, path) {
  let error = new Error(`No route specified for path: ${path}`)
  error.statusCode = 404
  throw error
}

function createResponse(statusCode, body, headers, endpoint, uri) {
  return {
    endpoint,
    uri,
    isOk: statusCode.toString()[0] === '2',
    response: createProxyResponse(statusCode, body, headers)
  }
}

function createProxyResponse(statusCode, body, headers = {}) {
  if (headers['Content-Type'] === undefined) headers['Content-Type'] = 'application/json'
  // output follows the format described here
  // http://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-set-up-simple-proxy.html?shortFooter=true#api-gateway-simple-proxy-for-lambda-output-format
  return {
    statusCode,
    body: typeof body === 'object' ? JSON.stringify(body) : body,
    headers: { ...headers }
  }
}

function getTraceId(event, context) {
  const traceId =
    (event.headers &&
      (event.headers['X-Trace-Id'] ||
        event.headers['X-TRACE-ID'] ||
        event.headers['x-trace-id'] ||
        event.headers['X-Correlation-Id'] ||
        event.headers['X-CORRELATION-ID'] ||
        event.headers['x-correlation-id'])) ||
    context.awsRequestId ||
    uuid()
  context[TRACE_ID] = traceId
  return traceId
}

function decodeProperties(obj) {
  return (
    obj &&
    Object.keys(obj).reduce((r, key) => {
      r[key] = decodeURIComponent(obj[key])
      return r
    }, {})
  )
}

function hasHeaderValue(header, value) {
  if (!header || !value) return false
  header = header.toLowerCase()
  value = value.toLowerCase()
  if (header === value) return true
  let headerParts = header.split(';')
  return headerParts.includes(value)
}

function normalizeRequestHeaders(reqHeaders = {}) {
  return Object.keys(reqHeaders).reduce((headers, name) => {
    headers[name.toLowerCase()] = reqHeaders[name]
    return headers
  }, {})
}
