/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable jest/no-conditional-expect */
/* eslint-disable @typescript-eslint/no-explicit-any */
import qs from 'querystring'
import { Router } from '../src/router'
import './util'

describe('Router', () => {
  test('All methods adds a route to the routes list.', async () => {
    const router = Router()

    const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']

    for (const method of methods) {
      const handler = jest.fn()
      router[method.toLowerCase()]('/route', handler)
      await router.route({} as any as any, {}, '/route', method)
      expect(handler).toHaveBeenCalled()
    }
  })

  test('GET matches with querystring.', async () => {
    expect.assertions(1)
    const router = Router()
    router.get('/route', (({ queryStringParameters: { name } }) => {
      expect(name).toBe('tim')
    }) as any)
    await router.route(
      {
        path: '/route',
        httpMethod: 'GET',
        queryStringParameters: { name: 'tim' },
      } as any,
      {}
    )
  })

  test('Unknown route returns error.', async () => {
    expect.assertions(4)
    const router = Router()
    const result = await router.route({ method: 'DELETE', path: '/route' } as any, {})
    expect(result.endpoint).toBe(undefined)
    expect(result.uri).toBe('/route')
    expect(result.response.statusCode).toBe(404)
    expect(result.response.body).toContain('Endpoint not supported: DELETE/route')
  })

  test('Unknown route returns error 405 when methods are available', async () => {
    const router = Router()
    const failHandler = jest.fn()
    router.put('/route', failHandler)
    router.post('/route', failHandler)
    const result = await router.route({ method: 'DELETE', path: '/route' } as any, {})
    expect(failHandler).not.toHaveBeenCalled()
    expect(result.endpoint).toBe(undefined)
    expect(result.uri).toBe('/route')
    expect(result.response.statusCode).toBe(405)
    expect(result.response.headers.Allow.split(',')).toEqual(
      expect.arrayContaining(['PUT', 'POST'])
    )
    expect(result.response.body).toContain('Endpoint not supported: DELETE/route')
  })

  test('unknown set the unknown route.', async () => {
    expect.assertions(1)
    const router = Router()
    const handler = jest.fn()
    router.unknown(handler)
    await router.route({} as any, {}, '/route', 'POST')
    expect(handler).toHaveBeenCalled()
  })

  test('unknown handler can use custom responses.', async () => {
    const router = Router()
    router.unknown(async (event, { response }, path, method) => {
      return response({
        statusCode: 404,
        body: {
          message: `You dun screwed up, now. ${path} doesn't exist!`,
        },
      })
    })
    const result = await router.route({} as any, {}, '/route', 'POST')
    expect(result.response.statusCode).toBe(404)
    expect(JSON.parse(result.response.body).message).toBe(
      `You dun screwed up, now. ${'/route'} doesn't exist!`
    )
  })

  test('GET routes with trialing slash by default', async () => {
    expect.assertions(1)
    const router = Router()
    const handler = jest.fn()
    router.get('/route', handler)
    await router.route({} as any, {}, '/route/', 'GET')
    expect(handler).toHaveBeenCalled()
  })

  test('trailing slash does not remove "/" route', async () => {
    expect.assertions(1)
    const router = Router()
    const handler = jest.fn()
    router.get('/', handler)
    await router.route({} as any, {}, '/', 'GET')
    expect(handler).toHaveBeenCalled()
  })

  test('trialing slash causes unknown route', async () => {
    const router = Router({ trimTrailingSlash: false })
    const handler = jest.fn()
    const unknown = jest.fn()
    router.get('/route', handler)
    router.unknown(unknown)
    await router.route({} as any, {}, '/route/', 'GET')
    expect(handler).not.toHaveBeenCalled()
    expect(unknown).toHaveBeenCalled()
  })

  test('GET result has uri and endpoint.', async () => {
    expect.assertions(2)
    const router = Router()
    router.get('/route/{id}', jest.fn())
    const result = await router.route({} as any, {}, '/route/1234', 'GET')
    expect(result.endpoint).toBe('/route/{id}')
    expect(result.uri).toBe('/route/1234')
  })

  test('route matches on the GET handler', async () => {
    const router = Router()
    const handler = jest.fn()
    const wrong = jest.fn()

    router.get('/get', handler)
    router.post('/post', wrong)

    await router.route({ rawPath: '/get', method: 'GET' } as any, {})
    expect(handler).toHaveBeenCalled()
    expect(wrong).not.toHaveBeenCalled()
  })

  test('route matches on the GET handler for all path types', async () => {
    const router = Router()
    const handler = jest.fn()

    router.get('/get', handler)

    await router.route({ rawPath: '/get', method: 'GET' } as any, {})
    await router.route({ requestContext: { path: '/get' }, method: 'GET' } as any, {})
    await router.route({ path: '/get', method: 'GET' } as any, {})
    await router.route({ resourcePath: '/get', method: 'GET' } as any, {})
    await router.route({ method: 'GET' } as any, {}, '/get')
    expect(handler).toHaveBeenCalledTimes(5)
  })

  test('route matches on the GET handler for all method types', async () => {
    const router = Router()
    const handler = jest.fn()

    router.get('/get', handler)

    await router.route({ rawPath: '/get', method: 'GET' } as any, {})
    await router.route({ rawPath: '/get', httpMethod: 'GET' } as any, {})
    await router.route({ rawPath: '/get', requestContext: { http: { method: 'GET' } } } as any, {})
    await router.route({ rawPath: '/get' } as any, {}, undefined, 'GET')
    expect(handler).toHaveBeenCalledTimes(4)
  })

  test('route matches on the method if the path are the same', async () => {
    const router = Router()
    const handler = jest.fn()
    const wrong = jest.fn()

    router.get('/get', handler)
    router.post('/post', wrong)

    await router.route({ rawPath: '/get', method: 'GET' } as any, {})
    expect(handler).toHaveBeenCalled()
    expect(wrong).not.toHaveBeenCalled()
  })

  test('route matches on the proper url if the path are the same', async () => {
    const router = Router()
    const handler = jest.fn()
    const wrong = jest.fn()

    router.get('/get/something/here', wrong)
    router.get('/get/something/there', handler)

    await router.route({ rawPath: '/get/something/there', method: 'GET' } as any, {})
    expect(handler).toHaveBeenCalled()
    expect(wrong).not.toHaveBeenCalled()
  })

  test('route matches on the method if the path part matches', async () => {
    const router = Router()
    const handler = jest.fn()
    const wrong = jest.fn()

    router.get('/get', wrong)
    router.get('/get/{id}', handler)

    await router.route({ rawPath: '/get/123jkhl1khj23123', method: 'GET' } as any, {})
    expect(handler).toHaveBeenCalled()
    expect(wrong).not.toHaveBeenCalled()
  })

  test('route tokenizes path parts', async () => {
    const router = Router()
    const handler = jest.fn()

    router.get('/get/{id}', handler)

    await router.route({ rawPath: '/get/123jkhl1khj23123', method: 'GET' } as any, {})
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ pathParameters: { id: '123jkhl1khj23123' } }),
      expect.any(Object)
    )
  })

  test('route does not tokenize without option', async () => {
    const router = Router({ extractPathParameters: false })
    const handler = jest.fn()

    router.get('/get/{id}', handler)

    await router.route(
      {
        pathParameters: {},
        rawPath: '/get/123jkhl1khj23123',
        method: 'GET',
      } as any,
      {}
    )
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ pathParameters: {} }),
      expect.any(Object)
    )
  })

  test('if the handler throws an error, the router returns it', async () => {
    const router = Router()
    router.get('/get', () => {
      throw new Error('testing an error')
    })

    const result = await router.route({ rawPath: '/get', method: 'GET' } as any, {})

    expect(result.isOk).toBeFalsy()
    expect(result.response.statusCode).toBe(500)
    expect(JSON.parse(result.response.body).message.indexOf('testing an error') !== -1).toBeTruthy()
  })

  test('if the handler throws an error, the router formats it', async () => {
    const router = Router()

    router.get('/get', () => {
      throw new Error('testing an error')
    })

    router.formatError((statusCode, error: any) => {
      error.customProp = 'formatted'
      return error
    })

    const result = await router.route({ rawPath: '/get', method: 'GET' } as any, {})

    expect(result.isOk).toBeFalsy()
    expect(result.response.statusCode).toBe(500)
    expect(JSON.parse(result.response.body).customProp).toBe('formatted')
  })

  test('if no route is defined the default router returns an error', async () => {
    const router = Router()
    const result = await router.route({ rawPath: '/none', method: 'GET' } as any, {})
    expect(JSON.parse(result.response.body).message.includes('Endpoint not supported')).toBeTruthy()
  })

  test('route throws if context.response has already been set', async () => {
    expect.assertions(1)
    const router = Router()
    router.post('/route', (() => {}) as any)
    await router.route({} as any, { response: true }, '/route', 'POST').catch((err) => {
      expect(err.message.includes('context.response')).toBeTruthy()
    })
  })

  test('route allows custom response status codes', async () => {
    const router = Router()
    router.post('/route', async (_, { response }) => response({ statusCode: 201, body: 'nothing' }))
    const result = await router.route({} as any, {}, '/route', 'POST')
    expect(result.response.statusCode).toBe(201)
  })

  test('route allows custom response headers', async () => {
    expect.assertions(3)
    const router = Router()
    router.post('/route', async (_, { response }) => {
      response.setHeader('Location', 'something')
      return { message: 'success' }
    })
    const result = await router.route({} as any, {}, '/route', 'POST')
    expect(result.response.statusCode).toBe(200)
    expect(result.response.body).toBe(JSON.stringify({ message: 'success' }))
    expect(result.response.headers.Location).toBe('something')
  })

  test('route errors still format when using custom response headers', async () => {
    const router = Router()

    router.get('/get', async (_, { response }) => {
      response.setHeader('Location', 'something')
      throw new Error('testing an error')
    })

    router.formatError((statusCode, error: any) => {
      error.customProp = 'formatted'
      return error
    })

    const result = await router.route({ rawPath: '/get', method: 'GET' } as any, {})
    expect(result.response.headers.Location).toBe('something')
  })

  test('route parses json body with default option', async () => {
    expect.assertions(1)
    const router = Router()
    router.post('/route', (async ({ body }: any) => {
      expect(body.name).toBe('tim')
    }) as any)
    await router.route(
      {
        body: JSON.stringify({ name: 'tim' }),
        headers: { 'Content-Type': 'application/json' },
      } as any,
      {},
      '/route',
      'POST'
    )
  })

  test('route parses json body with merge-patch', async () => {
    expect.assertions(1)
    const router = Router()
    router.post('/route', (async ({ body }: any) => {
      console.log('body', typeof body, body.name)
      expect(body.name).toEqual('tim')
    }) as any)
    await router.route(
      {
        body: JSON.stringify({ name: 'tim' }),
        headers: { 'Content-Type': 'application/merge-patch+json' },
      } as any,
      {},
      '/route',
      'POST'
    )
  })

  test('route parses json body with assumeJson', async () => {
    expect.assertions(1)
    const router = Router({ assumeJson: true })
    router.post('/route', (({ body }: any) => {
      expect(body.name).toBe('tim')
    }) as any)
    await router.route(
      {
        body: JSON.stringify({ name: 'tim' }),
      } as any,
      {},
      '/route',
      'POST'
    )
  })

  test('route parses url-encoded body with default option', async () => {
    expect.assertions(1)
    const router = Router()
    router.post('/route', (async ({ body }) => {
      expect(body.name).toBe('tim')
    }) as any)
    await router.route(
      {
        body: qs.stringify({ name: 'tim' }),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      } as any,
      {},
      '/route',
      'POST'
    )
  })

  test('route parses url-encoded body with multi-typed content header', async () => {
    expect.assertions(1)
    const router = Router()
    router.post('/route', (({ body }) => {
      expect(body.name).toBe('tim')
    }) as any)
    await router.route(
      {
        body: qs.stringify({ name: 'tim' }),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        },
      } as any,
      {},
      '/route',
      'POST'
    )
  })

  test('route returns 400 for parse errors', async () => {
    expect.assertions(1)
    const router = Router()
    router.post('/route', jest.fn())
    const result = await router.route(
      { body: 'name', headers: { 'Content-Type': 'application/json' } } as any,
      {},
      '/route',
      'POST'
    )
    expect(result.response.statusCode).toBe(400)
  })

  test('route does not parse body with option', async () => {
    expect.assertions(1)
    const router = Router({ parseBody: false })
    router.post('/route', (async ({ body }) => {
      expect(body).toBe(JSON.stringify({ name: 'tim' }))
    }) as any)
    await router.route(
      {
        body: JSON.stringify({ name: 'tim' }),
        headers: { 'Content-Type': 'application/json' },
      } as any,
      {},
      '/route',
      'POST'
    )
  })

  test('route decodes parameters with default option', async () => {
    expect.assertions(2)
    const router = Router()
    router.post('/route', (async ({ pathParameters, queryStringParameters }) => {
      expect(pathParameters.name).toBe('tim kye')
      expect(queryStringParameters.name).toBe('tim kye')
    }) as any)
    await router.route(
      {
        pathParameters: { name: 'tim%20kye' },
        queryStringParameters: { name: 'tim%20kye' },
      } as any,
      {},
      '/route',
      'POST'
    )
  })

  test('route does not decode parameters with option', async () => {
    expect.assertions(2)
    const router = Router({ decodeEvent: false })
    router.post('/route', (async ({ pathParameters, queryStringParameters }) => {
      expect(pathParameters.name).toBe('tim%20kye')
      expect(queryStringParameters.name).toBe('tim%20kye')
    }) as any)
    await router.route(
      {
        pathParameters: { name: 'tim%20kye' },
        queryStringParameters: { name: 'tim%20kye' },
      } as any,
      {},
      '/route',
      'POST'
    )
  })

  test('traceId is created', async () => {
    expect.assertions(1)
    const router = Router()
    router.post('/route', jest.fn())
    const result = await router.route({} as any, {}, '/route', 'POST')
    expect(result.response.headers['X-Correlation-Id']).toBeTruthy()
  })

  test('traceId is skipped if disabled', async () => {
    expect.assertions(1)
    const router = Router({ includeTraceId: false })
    router.post('/route', jest.fn())
    const result = await router.route({} as any, {}, '/route', 'POST')
    expect(result.response.headers['X-Correlation-Id']).toBeFalsy()
  })

  test('traceId is reused from event', async () => {
    expect.assertions(6)
    const router = Router()
    router.post('/route', jest.fn())
    const traceId = '1234'
    let result = await router.route(
      { headers: { 'X-Trace-Id': traceId } } as any,
      {},
      '/route',
      'POST'
    )
    expect(result.response.headers['X-Correlation-Id']).toBe(traceId)

    result = await router.route({ headers: { 'X-TRACE-ID': traceId } } as any, {}, '/route', 'POST')
    expect(result.response.headers['X-Correlation-Id']).toBe(traceId)

    result = await router.route({ headers: { 'x-trace-id': traceId } } as any, {}, '/route', 'POST')
    expect(result.response.headers['X-Correlation-Id']).toBe(traceId)

    result = await router.route(
      { headers: { 'X-Correlation-Id': traceId } } as any,
      {},
      '/route',
      'POST'
    )
    expect(result.response.headers['X-Correlation-Id']).toBe(traceId)

    result = await router.route(
      { headers: { 'X-CORRELATION-ID': traceId } } as any,
      {},
      '/route',
      'POST'
    )
    expect(result.response.headers['X-Correlation-Id']).toBe(traceId)

    result = await router.route(
      { headers: { 'x-correlation-id': traceId } } as any,
      {},
      '/route',
      'POST'
    )
    expect(result.response.headers['X-Correlation-Id']).toBe(traceId)
  })

  test('traceId is reused from context', async () => {
    expect.assertions(1)
    const router = Router()
    router.post('/route', jest.fn())
    const traceId = '1234'
    const result = await router.route(
      { headers: {} } as any,
      { awsRequestId: traceId },
      '/route',
      'POST'
    )
    expect(result.response.headers['X-Correlation-Id']).toBe(traceId)
  })

  test('context getters work inside routes', async () => {
    expect.assertions(1)
    const router = Router()
    router.post('/route', (async (event, { name }) => {
      expect(name).toBe('tim')
    }) as any)
    const context = {}
    Object.defineProperty(context, 'name', {
      enumerable: false,
      configurable: false,
      get: () => 'tim',
    })
    await router.route({} as any, context, '/route', 'POST')
  })

  test('middleware is called', async () => {
    expect.assertions(1)

    const beforeRouteStub = jest.fn()
    const lambdaEvent: any = {
      fancyToken: '123abc',
    }
    const context = {
      otherToken: 'abc123',
    }
    const path = '/route'
    const method = 'GET'
    const router = Router()

    router.beforeRoute(beforeRouteStub)
    router.get(path, jest.fn())

    await router.route(lambdaEvent, context, path, method)

    expect(beforeRouteStub).toHaveBeenCalledWith(
      expect.objectContaining(lambdaEvent),
      expect.objectContaining(context),
      path,
      method
    )
  })

  test('throwing an error in middleware creates error response', async () => {
    expect.assertions(2)

    const beforeRouteStub = () => {
      const error: any = new Error()
      error.statusCode = 400
      throw error
    }
    const path = '/route'
    const router = Router()
    const routeHandler = jest.fn()

    router.beforeRoute(beforeRouteStub)
    router.get(path, routeHandler)

    const result = await router.route({} as any, {}, path, 'GET')

    expect(result.response.statusCode).toBe(400)

    expect(routeHandler).not.toHaveBeenCalled()
  })

  test('multiple middleware functions are accepted', async () => {
    expect.assertions(2)

    const middlewareA = jest.fn()
    const middlewareB = jest.fn()
    const path = '/route'
    const router = Router()

    router.beforeRoute(middlewareA)
    router.beforeRoute(middlewareB)
    router.get(path, jest.fn())

    await router.route({} as any, {}, path, 'GET')

    expect(middlewareA).toHaveBeenCalled()
    expect(middlewareB).toHaveBeenCalled()
  })

  test('middleware can be asynchronous', async () => {
    expect.assertions(1)

    const error: any = new Error('hello')
    error.statusCode = 400

    const router = Router()
    const path = '/route'

    router.beforeRoute(jest.fn().mockRejectedValue(error))
    router.get(path, jest.fn())

    const result = await router.route({} as any, {}, path, 'GET')

    expect(result.response.statusCode).toBe(400)
  })

  test('route does not normalize headers with option', async () => {
    expect.assertions(2)
    const router = Router({ normalizeHeaders: false })
    router.post('/route', (({ headers: { 'Content-Type': unnormal, 'content-type': normal } }) => {
      expect(unnormal).toBe('application/json')
      expect(normal).toBe(undefined)
    }) as any)
    await router.route(
      {
        body: JSON.stringify({ name: 'tim' }),
        headers: { 'Content-Type': 'application/json' },
      } as any,
      {},
      '/route',
      'POST'
    )
  })

  test('route normalizes headers with by default', async () => {
    expect.assertions(2)
    const router = Router()
    router.post('/route', (({ headers: { 'Content-Type': unnormal, 'content-type': normal } }) => {
      expect(normal).toBe('application/json')
      expect(unnormal).toBe(undefined)
    }) as any)
    await router.route(
      {
        body: JSON.stringify({ name: 'tim' }),
        headers: { 'Content-Type': 'application/json' },
      } as any,
      {},
      '/route',
      'POST'
    )
  })

  test('pass original error props on formatError', async () => {
    expect.assertions(3)
    const router = Router()
    const errorName = 'ValidationError'
    const errorMessage = 'Ops, validation error'

    router.post('/route', async (event, { name }: any) => {
      const error = new Error(errorMessage)
      error.name = errorName
      throw error
    })

    router.formatError((statusCode: number, error: any) => {
      expect(statusCode).toBe(500)
      expect(error.message).toBe(errorMessage)
      expect(error.name).toBe(errorName)
    })

    await router.route({} as any, {}, '/route', 'POST')
  })
})
