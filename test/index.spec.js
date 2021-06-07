/* eslint no-unused-vars:0 no-empty-function:0 */
'use strict'

const test = require('ava')
const qs = require('querystring')
const sinon = require('sinon')
const { Router } = require('../src/index')

test('GET adds a route to the routes list.', async t => {
  t.plan(1)
  let router = Router()
  router.get('/route', () => {
    t.pass('called get')
  })
  await router.route({}, {}, '/route', 'GET')
})

test('GET matches with querystring.', async t => {
  t.plan(1)
  let router = Router()
  router.get('/route', ({ queryStringParameters: { name } }) => {
    t.is(name, 'tim', 'got qeury')
  })
  await router.route(
    {
      path: '/route',
      httpMethod: 'GET',
      queryStringParameters: { name: 'tim' }
    },
    {}
  )
})

test('POST adds a route to the routes list.', async t => {
  t.plan(1)
  let router = Router()
  router.post('/route', () => {
    t.pass('called post')
  })
  await router.route({}, {}, '/route', 'POST')
})

test('PUT adds a route to the routes list.', async t => {
  t.plan(1)
  let router = Router()
  router.put('/route', () => {
    t.pass('called put')
  })
  await router.route({}, {}, '/route', 'PUT')
})

test('DELETE adds a route to the routes list.', async t => {
  t.plan(1)
  let router = Router()
  router.delete('/route', () => {
    t.pass('called delete')
  })
  await router.route({}, {}, '/route', 'DELETE')
})

test('PATCH adds a route to the routes list.', async t => {
  t.plan(1)
  let router = Router()
  router.patch('/route', () => {
    t.pass('called patch')
  })
  await router.route({}, {}, '/route', 'PATCH')
})

test('Unknown route returns error.', async t => {
  t.plan(4)
  let router = Router()
  let result = await router.route({ method: 'DELETE', path: '/route' }, {})
  t.is(result.endpoint, undefined, 'no endpoint')
  t.is(result.uri, '/route', 'has uri')
  t.is(result.response.statusCode, 404, 'has uri')
  t.truthy(result.response.body.includes('No route specified for path: /route'), 'has error')
})

test('unknown set the unknown route.', async t => {
  t.plan(1)
  let router = Router()
  router.unknown(() => {
    t.pass('called unknown')
  })
  await router.route({}, {}, '/route', 'POST')
})

test('unknown handler can use custom responses.', async t => {
  t.plan(2)
  let router = Router()
  router.unknown((event, { response }, path, method) => {
    return response(404, {
      message: `You dun screwed up, now. ${path} doesn't exist!`
    })
  })
  let result = await router.route({}, {}, '/route', 'POST')
  t.is(result.response.statusCode, 404, 'status code')
  t.is(
    JSON.parse(result.response.body).message,
    `You dun screwed up, now. ${'/route'} doesn't exist!`,
    'got message'
  )
})

test('GET routes with trialing slash', async t => {
  t.plan(1)
  let router = Router({ trimTrailingSlash: true })
  router.get('/route', () => {
    t.pass('called get')
  })
  await router.route({}, {}, '/route/', 'GET')
})

test('trialing slash causes unknown route', async t => {
  t.plan(1)
  let router = Router({ trimTrailingSlash: false })
  router.get('/route', () => {
    t.fail('called get')
  })
  router.unknown(() => {
    t.pass('called unknown')
  })
  await router.route({}, {}, '/route/', 'GET')
})

test('GET result has uri and endpoint.', async t => {
  t.plan(2)
  let router = Router()
  router.get('/route/{id}', () => {})
  let result = await router.route({}, {}, '/route/1234', 'GET')
  t.is(result.endpoint, '/route/{id}', 'has endpoint')
  t.is(result.uri, '/route/1234', 'has uri')
})

test('route matches on the GET handler', t => {
  let router = Router()
  const getHandler = () => t.pass('Handler called')
  const postHandler = () => t.fail('Wrong handler called')

  router.post('/post', postHandler)
  router.get('/get', getHandler)

  return router.route({ resourcePath: '/get', method: 'GET' }, {})
})

test('route matches on the method if the path are the same', t => {
  let router = Router()
  const getHandler = () => t.pass('Handler called')
  const postHandler = () => t.fail('Wrong handler called')

  router.get('/get', getHandler)
  router.post('/get', postHandler)

  return router.route({ resourcePath: '/get', method: 'GET' }, {})
})

test('route matches on the proper url if the path are the same', t => {
  let router = Router()
  const getHandler = () => t.pass('Handler called')
  const failHandler = () => t.fail('Wrong handler called')

  router.get('/get/something/here', failHandler)
  router.get('/get/something/there', getHandler)

  return router.route({ resourcePath: '/get/something/there', method: 'GET' }, {})
})

test('route matches on the method if the Regex matches', t => {
  let router = Router()
  const getHandler = () => t.pass('Handler called')
  const failHandler = () => t.fail('Wrong handler called')

  router.get('/get', failHandler)
  router.get('/get/{id}', getHandler)

  return router.route({ resourcePath: '/get/123jkhl1khj23123', method: 'GET' }, {})
})

test('route tokenizes path parts', t => {
  let router = Router()
  const getHandler = ({ pathParameters: { id } }) => {
    t.is(id, '123jkhl1khj23123', 'got tokenized id')
  }
  const failHandler = () => t.fail('Wrong handler called')

  router.get('/get', failHandler)
  router.get('/get/{id}', getHandler)

  return router.route({ resourcePath: '/get/123jkhl1khj23123', method: 'GET' }, {})
})

test('route does not tokenize without option', async t => {
  let router = Router({ extractPathParameters: false })
  const getHandler = ({ pathParameters }) => {
    t.deepEqual(pathParameters, {}, 'no id')
  }
  const failHandler = () => t.fail('Wrong handler called')

  router.get('/get', failHandler)
  router.get('/get/{id}', getHandler)
  router.unknown(failHandler)

  return router.route(
    {
      pathParameters: {},
      resourcePath: '/get/123jkhl1khj23123',
      method: 'GET'
    },
    {}
  )
})

test('if the handler throws an error, the router returns it', async t => {
  let router = Router()
  router.debug = true

  const getHandler = () => {
    throw new Error('testing an error')
  }

  router.get('/get', getHandler)

  let result = await router.route({ resourcePath: '/get', method: 'GET' }, {})

  t.falsy(result.isOk, 'resposne is error')
  t.is(result.response.statusCode, 500, 'status code')
  t.truthy(
    JSON.parse(result.response.body).message.indexOf('testing an error') !== -1,
    'The proper error bubbled up.'
  )
})

test('if the handler throws an error, the router formats it', async t => {
  let router = Router()
  router.debug = true

  router.get('/get', () => {
    throw new Error('testing an error')
  })

  router.formatError((statusCode, error) => {
    error.customProp = 'formatted'
    return error
  })

  let result = await router.route({ resourcePath: '/get', method: 'GET' }, {})

  t.falsy(result.isOk, 'resposne is error')
  t.is(result.response.statusCode, 500, 'status code')
  t.is(JSON.parse(result.response.body).customProp, 'formatted', 'custom formatting applied')
})

test('if no route is defined the default router returns an error', async t => {
  let router = Router()
  let result = await router.route({ resourcePath: '/none', method: 'GET' }, {})
  t.truthy(
    JSON.parse(result.response.body).message.includes('No route specified'),
    'The proper error bubbled up.'
  )
})

test('route throws if context.response has already been set', async t => {
  t.plan(1)
  let router = Router()
  router.post('/route', () => {})
  await router.route({}, { response: true }, '/route', 'POST').catch(err => {
    t.truthy(err.message.includes('context.response'), 'already set')
  })
})

test('route allows custom response status codes', async t => {
  t.plan(1)
  let router = Router()
  router.post('/route', (_, { response }) => response(201, 'nothing'))
  let result = await router.route({}, {}, '/route', 'POST')
  t.is(result.response.statusCode, 201, 'custom code')
})

test('route allows custom response headers', async t => {
  t.plan(3)
  let router = Router()
  router.post('/route', (_, { response }) => {
    response.setHeader('Location', 'something')
    return { message: 'success' }
  })
  let result = await router.route({}, {}, '/route', 'POST')
  t.is(result.response.statusCode, 200, 'status code')
  t.is(result.response.body, JSON.stringify({ message: 'success' }), 'body')
  t.is(result.response.headers.Location, 'something', 'custom header')
})

test('route errors still format when using custom response headers', async t => {
  let router = Router()
  router.debug = true

  router.get('/get', (_, { response }) => {
    response.setHeader('Location', 'something')
    throw new Error('testing an error')
  })

  router.formatError((statusCode, error) => {
    error.customProp = 'formatted'
    return error
  })

  let result = await router.route({ resourcePath: '/get', method: 'GET' }, {})
  t.is(result.response.headers.Location, 'something', 'custom header')
})

test('route parses json body with default option', async t => {
  t.plan(1)
  let router = Router()
  router.post('/route', ({ body }) => {
    t.is(body.name, 'tim', 'parsed')
  })
  await router.route(
    {
      body: JSON.stringify({ name: 'tim' }),
      headers: { 'Content-Type': 'application/json' }
    },
    {},
    '/route',
    'POST'
  )
})

test('route parses json body with assumeJson', async t => {
  t.plan(1)
  let router = Router({ assumeJson: true })
  router.post('/route', ({ body }) => {
    t.is(body.name, 'tim', 'parsed')
  })
  await router.route(
    {
      body: JSON.stringify({ name: 'tim' })
    },
    {},
    '/route',
    'POST'
  )
})

test('route parses url-encoded body with default option', async t => {
  t.plan(1)
  let router = Router()
  router.post('/route', ({ body }) => {
    t.is(body.name, 'tim', 'parsed')
  })
  await router.route(
    {
      body: qs.stringify({ name: 'tim' }),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    },
    {},
    '/route',
    'POST'
  )
})

test('route parses url-encoded body with multi-typed content header', async t => {
  t.plan(1)
  let router = Router()
  router.post('/route', ({ body }) => {
    t.is(body.name, 'tim', 'parsed')
  })
  await router.route(
    {
      body: qs.stringify({ name: 'tim' }),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' }
    },
    {},
    '/route',
    'POST'
  )
})

test('route returns 400 for parse errors', async t => {
  t.plan(1)
  let router = Router()
  router.post('/route', ({ body }) => {})
  let result = await router.route(
    { body: 'name', headers: { 'Content-Type': 'application/json' } },
    {},
    '/route',
    'POST'
  )
  t.is(result.response.statusCode, 400)
})

test('route does not parse body with option', async t => {
  t.plan(1)
  let router = Router({ parseBody: false })
  router.post('/route', ({ body }) => {
    t.is(body, JSON.stringify({ name: 'tim' }), 'parsed')
  })
  await router.route(
    {
      body: JSON.stringify({ name: 'tim' }),
      headers: { 'Content-Type': 'application/json' }
    },
    {},
    '/route',
    'POST'
  )
})

test('route decodes parameters with default option', async t => {
  t.plan(2)
  let router = Router()
  router.post('/route', ({ pathParameters, queryStringParameters }) => {
    t.is(pathParameters.name, 'tim kye', 'parsed')
    t.is(queryStringParameters.name, 'tim kye', 'parsed')
  })
  await router.route(
    {
      pathParameters: { name: 'tim%20kye' },
      queryStringParameters: { name: 'tim%20kye' }
    },
    {},
    '/route',
    'POST'
  )
})

test('route does not decode parameters with option', async t => {
  t.plan(2)
  let router = Router({ decodeEvent: false })
  router.post('/route', ({ pathParameters, queryStringParameters }) => {
    t.is(pathParameters.name, 'tim%20kye', 'parsed')
    t.is(queryStringParameters.name, 'tim%20kye', 'parsed')
  })
  await router.route(
    {
      pathParameters: { name: 'tim%20kye' },
      queryStringParameters: { name: 'tim%20kye' }
    },
    {},
    '/route',
    'POST'
  )
})

test('traceId is created', async t => {
  t.plan(1)
  let router = Router()
  router.post('/route', () => {})
  let result = await router.route({}, {}, '/route', 'POST')
  t.truthy(
    result.response.headers['X-Correlation-Id'],
    'trace id ' + result.response.headers['X-Correlation-Id']
  )
})

test('traceId is skipped if disabled', async t => {
  t.plan(1)
  let router = Router({ includeTraceId: false })
  router.post('/route', () => {})
  let result = await router.route({}, {}, '/route', 'POST')
  t.falsy(result.response.headers['X-Correlation-Id'], 'no trace id')
})

test('traceId is reused from event', async t => {
  t.plan(6)
  let router = Router()
  router.post('/route', () => {})
  let traceId = '1234'
  let result = await router.route({ headers: { 'X-Trace-Id': traceId } }, {}, '/route', 'POST')
  t.is(result.response.headers['X-Correlation-Id'], traceId, 'trace id ')

  result = await router.route({ headers: { 'X-TRACE-ID': traceId } }, {}, '/route', 'POST')
  t.is(result.response.headers['X-Correlation-Id'], traceId, 'trace id ')

  result = await router.route({ headers: { 'x-trace-id': traceId } }, {}, '/route', 'POST')
  t.is(result.response.headers['X-Correlation-Id'], traceId, 'trace id ')

  result = await router.route({ headers: { 'X-Correlation-Id': traceId } }, {}, '/route', 'POST')
  t.is(result.response.headers['X-Correlation-Id'], traceId, 'trace id ')

  result = await router.route({ headers: { 'X-CORRELATION-ID': traceId } }, {}, '/route', 'POST')
  t.is(result.response.headers['X-Correlation-Id'], traceId, 'trace id ')

  result = await router.route({ headers: { 'x-correlation-id': traceId } }, {}, '/route', 'POST')
  t.is(result.response.headers['X-Correlation-Id'], traceId, 'trace id ')
})

test('traceId is reused from context', async t => {
  t.plan(1)
  let router = Router()
  router.post('/route', () => {})
  let traceId = '1234'
  let result = await router.route({ headers: {} }, { awsRequestId: traceId }, '/route', 'POST')
  t.is(result.response.headers['X-Correlation-Id'], traceId, 'trace id ')
})

test('context getters work inside routes', async t => {
  t.plan(1)
  let router = Router()
  router.post('/route', (event, { name }) => {
    t.is(name, 'tim', 'context prop passed in')
  })
  let context = {}
  Object.defineProperty(context, 'name', {
    enumerable: false,
    configurable: false,
    get: () => 'tim'
  })
  await router.route({}, context, '/route', 'POST')
})

test('middleware is called', async t => {
  t.plan(1)

  let beforeRouteStub = sinon.stub()
  let lambdaEvent = {}
  let context = {}
  let path = '/route'
  let method = 'GET'
  let router = Router()

  router.beforeRoute(beforeRouteStub)
  router.get(path, sinon.stub())

  await router.route(lambdaEvent, context, path, method)

  t.truthy(
    beforeRouteStub.calledWith(lambdaEvent, context, path, method),
    'function was called with event, context, path, method'
  )
})

test('throwing an error in middleware creates error response', async t => {
  t.plan(2)

  let beforeRouteStub = () => {
    const error = new Error()
    error.statusCode = 400
    throw error
  }
  let path = '/route'
  let router = Router()
  let routeHandler = sinon.stub()

  router.beforeRoute(beforeRouteStub)
  router.get(path, routeHandler)

  const result = await router.route({}, {}, path, 'GET')

  t.is(result.response.statusCode, 400, 'includes 400 statusCode')

  t.truthy(routeHandler.notCalled, 'route handler was not called')
})

test('multiple middleware functions are accepted', async t => {
  t.plan(2)

  let middlewareA = sinon.stub()
  let middlewareB = sinon.stub()
  let path = '/route'
  let router = Router()

  router.beforeRoute(middlewareA)
  router.beforeRoute(middlewareB)
  router.get(path, sinon.stub())

  await router.route({}, {}, path, 'GET')

  t.truthy(middlewareA.called, 'first middleware was called')
  t.truthy(middlewareB.called, 'second middleware was called')
})

test('middleware can be asynchronous', async t => {
  t.plan(1)

  let error = new Error('hello')
  error.statusCode = 400

  let beforeRouteStub = sinon.stub().rejects(error)
  let router = Router()
  let path = '/route'

  router.beforeRoute(beforeRouteStub)
  router.get(path, sinon.stub())

  const result = await router.route({}, {}, path, 'GET')

  t.is(result.response.statusCode, 400, 'includes 400 statusCode')
})

test('route does not normalize headers by default', async t => {
  t.plan(2)
  let router = Router({})
  router.post('/route', ({ headers: { 'Content-Type': unnormal, 'content-type': normal } }) => {
    t.is(unnormal, 'application/json', 'unnormalized')
    t.is(normal, undefined, 'normalized')
  })
  await router.route(
    {
      body: JSON.stringify({ name: 'tim' }),
      headers: { 'Content-Type': 'application/json' }
    },
    {},
    '/route',
    'POST'
  )
})

test('route normalizes headers with an option', async t => {
  t.plan(2)
  let router = Router({ normalizeHeaders: true })
  router.post('/route', ({ headers: { 'Content-Type': unnormal, 'content-type': normal } }) => {
    t.is(normal, 'application/json', 'normalized')
    t.is(unnormal, undefined, 'unnormalized')
  })
  await router.route(
    {
      body: JSON.stringify({ name: 'tim' }),
      headers: { 'Content-Type': 'application/json' }
    },
    {},
    '/route',
    'POST'
  )
})

test('pass original error props on formatError', async t => {
  t.plan(3)
  const router = Router()
  const errorName = 'ValidationError'
  const errorMessage = 'Ops, validation error'

  router.post('/route', (event, { name }) => {
    const error = new Error(errorMessage)
    error.name = errorName
    throw error
  })

  router.formatError((statusCode, error) => {
    t.is(statusCode, 500)
    t.is(error.message, errorMessage)
    t.is(error.name, errorName)
  })

  await router.route({}, {}, '/route', 'POST')
})
