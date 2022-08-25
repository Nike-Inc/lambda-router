import { v4 as uuid } from 'uuid'
import { wrapper } from './logger'
import type { APIGatewayProxyEventV2, APIGatewayProxyEvent } from 'aws-lambda'

const CUSTOM_RESPONSE = Symbol('lambda-router:custom-response')
const TRACE_ID: unique symbol = Symbol('trace-id')
const METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const

type Method = typeof METHODS[number]

type RequestHeaders = Record<string, string | undefined>

type ResponseHeaders = Record<string, string | boolean | number>

export type BodyResponse = object | string

export interface Response {
  statusCode: number
  headers?: ResponseHeaders
  body: string
  isBase64Encoded?: boolean
}

export interface CustomResponse extends Omit<Response, 'body'> {
  [CUSTOM_RESPONSE]: boolean
  statusCode: number
  headers?: ResponseHeaders
  isBase64Encoded?: boolean
  body?: unknown
}

export interface RouteHandler<Event, Context> {
  (event: Event, context: Context): Promise<BodyResponse | CustomResponse>
}

interface Route<Event, Context> {
  method: Method
  path: string
  handler: RouteHandler<Event, Context>
}

export type Middleware<Event, Context> = (
  event: Event,
  context: Context,
  requestPath?: string,
  httpMethod?: string
) => Promise<void>

export interface CustomResponseFn {
  (options: {
    statusCode?: number
    body?: unknown
    headers?: ResponseHeaders
    isBase64Encoded?: boolean
  }): CustomResponse
  setHeader: (header: string, value: string) => void
}

export interface HttpError extends Error {
  statusCode: number
  headers: ResponseHeaders
}

type ProxyEvent = APIGatewayProxyEvent | APIGatewayProxyEventV2

export type AddRoute<Event extends ProxyEvent, Context> = (
  path: string,
  handler: RouteHandler<RouterEvent<Event>, RouterContext<Context>>
) => void

export type RouterEvent<Event extends ProxyEvent> = Omit<Event, 'body'> & {
  body?: string | null | Record<string, unknown>
  rawBody?: string | null
  rawHeaders: RequestHeaders
}
export type RouterContext<Context> = Context & {
  includeTraceId?: boolean
  traceId?: string
  response: CustomResponseFn
}
export interface LambdaRouter<Event extends ProxyEvent, Context> {
  get: AddRoute<Event, Context>
  post: AddRoute<Event, Context>
  delete: AddRoute<Event, Context>
  put: AddRoute<Event, Context>
  patch: AddRoute<Event, Context>
  formatError: (handler: ErrorFormatter) => void
  unknown: (
    handler: (
      event: RouterEvent<Event>,
      context: RouterContext<Context>,
      path: string | undefined,
      httpMethod: string | undefined,
      routes: Array<{ path: string; method: string }>
    ) => Promise<BodyResponse | CustomResponse> | BodyResponse | CustomResponse
  ) => void
  route: (
    event: Event,
    context: Context,
    requestPath?: string,
    httpMethod?: string
  ) => Promise<RouterResponse>
  /** add middleware that receives the event & context before they are sent to route handler. Modifications are passed through */
  beforeRoute: (handler: Middleware<RouterEvent<Event>, RouterContext<Context>>) => void
}

export interface RouterResponse {
  endpoint?: string
  uri: string
  isOk: boolean
  response: Response
}

export interface RouterProps {
  logger?: any
  extractPathParameters?: boolean
  trimTrailingSlash?: boolean
  includeTraceId?: boolean
  includeErrorStack?: boolean
  cors?: boolean | string
  parseBody?: boolean
  assumeJson?: boolean
  decodeEvent?: boolean
  normalizeHeaders?: boolean
}

export interface ErrorFormatter {
  (statusCode: number, body: unknown): void
}

export function Router<Event extends ProxyEvent, Context>({
  logger: originalLogger,
  extractPathParameters = true,
  trimTrailingSlash = true,
  includeTraceId = true,
  includeErrorStack = false,
  cors = true,
  parseBody = true,
  assumeJson = false,
  decodeEvent = true,
  normalizeHeaders = true,
}: RouterProps = {}): LambdaRouter<Event, Context> {
  if (originalLogger && originalLogger.events && originalLogger.setKey) {
    originalLogger.events.on('beforeHandler', (event: Event, context: Context) => {
      originalLogger.setKey('traceId', getTraceId(event, context))
    })
  }

  const logger = wrapper(originalLogger)
  const routes: Route<RouterEvent<Event>, RouterContext<Context>>[] = []
  const addRoute = (
    method: Method,
    path: string,
    handler: RouteHandler<RouterEvent<Event>, RouterContext<Context>>
  ) => {
    routes.push({ method, path, handler })
  }

  const middleware: Middleware<RouterEvent<Event>, RouterContext<Context>>[] = []
  const addMiddleware = (handler: Middleware<RouterEvent<Event>, RouterContext<Context>>) => {
    if (typeof handler === 'function') middleware.push(handler)
  }

  let unknownRouteHandler = defaultUnknownRoute
  const defaultHeaders: ResponseHeaders = {
    'content-type': 'application/json',
  }
  if (cors) {
    defaultHeaders['access-control-allow-origin'] = typeof cors === 'string' ? cors : '*'
  }

  // External hooks
  let onErrorFormat: ErrorFormatter

  const route = async (
    lambdaEvent: Event,
    lambdaContext: Context,
    requestPath?: string,
    httpMethod?: string
  ): Promise<RouterResponse> => {
    const event: RouterEvent<Event> = {
      ...lambdaEvent,
      rawBody: lambdaEvent.body,
      rawHeaders: lambdaEvent.headers,
    }
    let statusCode, body
    const requestHeaders = normalizeRequestHeaders(event.headers)
    let headers = { ...defaultHeaders }
    // Safety Checks
    if ((lambdaContext as any).response) {
      const message =
        'context.response has already been assigned. Lambda-router reserves this property for custom responses.'
      logger.error(message)
      return Promise.reject(new Error(message))
    }
    const context = lambdaContext as RouterContext<Context>
    context.includeTraceId = includeErrorStack
    // Custom Response
    const response: any = customResponse.bind(null, context)
    response.setHeader = (header: string, value: string) => {
      headers[header] = value
    }
    context.response = response as CustomResponseFn

    // Allow method and path overrides
    httpMethod =
      httpMethod ||
      (event as unknown as APIGatewayProxyEventV2)?.requestContext?.http?.method ||
      (event as unknown as APIGatewayProxyEvent).httpMethod ||
      (event as any)?.method
    requestPath =
      requestPath ||
      (event as unknown as APIGatewayProxyEventV2)?.rawPath ||
      (event as unknown as APIGatewayProxyEvent)?.path ||
      (event as unknown as APIGatewayProxyEvent)?.requestContext?.path ||
      (event as unknown as any)?.resourcePath

    if (!httpMethod) {
      throw new Error('Unable to determine httpMethod')
    }
    if (!requestPath) {
      throw new Error('Unable to requestPath')
    }

    if (trimTrailingSlash && requestPath) {
      requestPath = requestPath.replace(/(?<=.)\/$/, '')
    }

    if (normalizeHeaders) {
      event.headers = requestHeaders
    }

    const route = getRoute(routes, event, requestPath, httpMethod, extractPathParameters)
    const hasBody = event.body && typeof event.body === 'string'
    const contentType = requestHeaders && requestHeaders['content-type']
    const jsonBody =
      hasBody &&
      (hasHeaderValue(contentType, 'application/json') ||
        hasHeaderValue(contentType, 'application/merge-patch+json') ||
        (!contentType && assumeJson))
    const urlEncodedBody =
      hasBody && hasHeaderValue(contentType, 'application/x-www-form-urlencoded')

    // Parse and decode
    try {
      if (parseBody && event.body) {
        if (jsonBody) event.body = JSON.parse(event.body as string)
        else if (urlEncodedBody)
          event.body = Object.fromEntries(new URLSearchParams(event.body as string).entries())
      }
      if (decodeEvent) {
        logger.debug('decoding parameters')
        event.pathParameters = decodeProperties(event.pathParameters || {})
        event.queryStringParameters = decodeProperties(event.queryStringParameters || {})
      }
    } catch (error: any) {
      logger.error('route error', error?.toString(), error?.stack)

      return createResponse(
        400,
        { message: 'Malformed request' },
        defaultHeaders,
        requestPath,
        requestPath
      )
    }

    // Route
    if (includeTraceId) context.traceId = headers['X-Correlation-Id'] = getTraceId(event, context)
    try {
      for (const fn of middleware) {
        await fn(event, context, requestPath, httpMethod)
      }

      const result = await (route
        ? route.handler(event, context)
        : unknownRouteHandler(event, context, requestPath, httpMethod, routes))
      if (result && (result as CustomResponse)[CUSTOM_RESPONSE] === true) {
        statusCode = (result as CustomResponse).statusCode
        body = (result as CustomResponse).body
        headers = { ...defaultHeaders, ...(result as CustomResponse).headers }
      } else {
        statusCode = 200
        body = result
      }
    } catch (error: any) {
      statusCode = error.statusCode || 500
      body = {
        ...error,
        // The spread doesn't get the non-enumerable message
        message: error.message,
        name: error.name,
        stack: includeErrorStack && error.stack,
      }
      if (error.headers) {
        headers = { ...headers, ...error.headers }
      }
      if (onErrorFormat && typeof onErrorFormat === 'function') {
        body = onErrorFormat(statusCode, body)
      }
    }

    return createResponse(statusCode, body, headers, route && route.path, requestPath)
  }

  // Bound router functions
  return {
    beforeRoute: addMiddleware,
    get: addRoute.bind(null, 'GET'),
    post: addRoute.bind(null, 'POST'),
    put: addRoute.bind(null, 'PUT'),
    delete: addRoute.bind(null, 'DELETE'),
    patch: addRoute.bind(null, 'PATCH'),
    unknown: (
      handler: (
        event: RouterEvent<Event>,
        context: RouterContext<Context>,
        path: string | undefined,
        httpMethod: string | undefined,
        routes: Array<{ path: string; method: string }>
      ) => Promise<BodyResponse | CustomResponse> | BodyResponse | CustomResponse
    ) => {
      unknownRouteHandler = handler
    },
    formatError: (handler: ErrorFormatter) => {
      onErrorFormat = handler
    },
    route,
  }
}

function customResponse<Context>(
  context: RouterContext<Context>,
  {
    statusCode = 200,
    body,
    headers = {},
    isBase64Encoded = false,
  }: {
    statusCode?: number
    body?: BodyResponse | string
    headers?: ResponseHeaders
    isBase64Encoded?: boolean
  }
): CustomResponse {
  const response = {
    [CUSTOM_RESPONSE]: true,
    statusCode,
    body,
    headers,
    isBase64Encoded,
  }
  if (context.includeTraceId && context.traceId) {
    response.headers['x-correlation-id'] = context.traceId
  }
  return response
}

function getRoute<Event extends ProxyEvent, Context>(
  routes: Route<RouterEvent<Event>, RouterContext<Context>>[] = [],
  event: RouterEvent<Event>,
  eventPath: string | undefined,
  method: string | undefined,
  tokenizePathParts: boolean
): Route<RouterEvent<Event>, RouterContext<Context>> | undefined {
  if (!eventPath || !method) return
  let route = routes.find((r) => {
    return eventPath === r.path && method === r.method
  })

  if (!route) {
    let tokens
    route = routes.find((r) => {
      if (method !== r.method) return false
      tokens = matchPathParts(eventPath, r.path)
      return !!tokens
    })
    if (tokenizePathParts && tokens) {
      if (!event.pathParameters) event.pathParameters = {}
      Object.assign(event.pathParameters, tokens)
    }
  }

  return route
}

function matchPathParts(eventPath: string, path: string): Record<string, string> | false {
  const eventPathParts = eventPath.split('/')
  const routePathParts = path.split('/')

  // Fail fast if they're not the same length
  if (eventPathParts.length !== routePathParts.length) return false
  const tokens: Record<string, string> = {}

  // Start with 1 because the url should always start with the first back slash
  for (let i = 1; i < eventPathParts.length; ++i) {
    const pathPart = eventPathParts[i]
    const routePart = routePathParts[i]

    // If the part is a curly braces value
    const pathPartMatch = /\{(\w+)}/g.exec(routePart)
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

function defaultUnknownRoute(
  _event: any,
  _context: any,
  path: string | undefined,
  httpMethod: string | undefined,
  routes: Array<{ path: string; method: string }>
): Promise<BodyResponse | CustomResponse> | BodyResponse | CustomResponse {
  const methodMatches = routes
    .filter((r) => {
      return path === r.path
    })
    .map((r) => r.method)

  const error = new Error(`Endpoint not supported: ${httpMethod}${path}`) as HttpError
  error.statusCode = 404

  if (methodMatches.length) {
    error.statusCode = 405
    error.headers = {
      Allow: methodMatches.join(','),
    }
  }

  throw error
}

function createResponse(
  statusCode: number,
  body: BodyResponse | string,
  headers: ResponseHeaders,
  endpoint: string | undefined,
  uri: string
): RouterResponse {
  return {
    endpoint,
    uri,
    isOk: statusCode.toString()[0] === '2',
    response: createProxyResponse(statusCode, body, headers),
  }
}

export function createProxyResponse(
  statusCode: number,
  body: BodyResponse | string,
  headers: ResponseHeaders = {}
): Response {
  if (headers['content-type'] === undefined) headers['content-type'] = 'application/json'
  // output follows the format described here
  // http://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-set-up-simple-proxy.html?shortFooter=true#api-gateway-simple-proxy-for-lambda-output-format
  return {
    statusCode,
    body: typeof body === 'object' ? JSON.stringify(body) : body,
    headers: { ...headers },
  }
}

export function getTraceId(event: ProxyEvent | RouterEvent<ProxyEvent>, context: any) {
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

function decodeProperties(obj: Record<string, string | undefined>): Record<string, string> {
  return (
    obj &&
    Object.keys(obj).reduce((r, key) => {
      r[key] = obj[key] ? decodeURIComponent(obj[key] as string) : ''
      return r
    }, {} as Record<string, string>)
  )
}

function hasHeaderValue(header: string | undefined, value?: string): boolean {
  if (!header || !value) return false
  header = header.toLowerCase()
  value = value.toLowerCase()
  if (header === value) return true
  const headerParts = header.split(';')
  return headerParts.includes(value)
}

function normalizeRequestHeaders(reqHeaders: RequestHeaders = {}): RequestHeaders {
  return Object.keys(reqHeaders).reduce((headers, name) => {
    const reqHeader = reqHeaders[name]
    if (reqHeader) {
      headers[name.toLowerCase()] = reqHeader
    }
    return headers
  }, {} as RequestHeaders)
}
