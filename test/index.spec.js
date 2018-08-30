'use strict'

let test = require('blue-tape')
let { Router } = require('../src/index')

test('GET adds a route to the routes list.', async t => {
  t.plan(1)
  let router = Router()
  router.get('/route', () => {
    t.pass('called get')
  })
  await router.route({}, {}, '/route', 'GET')
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

test('Unknown route returns error.', async t => {
  t.plan(4)
  let router = Router()
  let result = await router.route({ method: 'DELETE', path: '/route' }, {})
  t.equal(result.endpoint, undefined, 'no endpoint')
  t.equal(result.uri, '/route', 'has uri')
  t.equal(result.response.statusCode, 404, 'has uri')
  t.ok(result.response.body.includes('No route specified for path: /route'), 'has error')
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
    return response(404, { message: `You dun screwed up, now. ${path} doesn't exist!` })
  })
  let result = await router.route({}, {}, '/route', 'POST')
  t.equal(result.response.statusCode, 404, 'status code')
  t.equal(JSON.parse(result.response.body).message, `You dun screwed up, now. ${'/route'} doesn't exist!`, 'got message')
})

test('GET result has uri and endpoint.', async t => {
  t.plan(2)
  let router = Router()
  router.get('/route/{id}', () => {})
  let result = await router.route({}, {}, '/route/1234', 'GET')
  t.equal(result.endpoint, '/route/{id}', 'has endpoint')
  t.equal(result.uri, '/route/1234', 'has uri')
})

test('route matches on the GET handler', t => {
  let router = Router()
  const getHandler = () => t.pass('Handler called')
  const postHandler = () => t.fail('Wrong handler called')

  router.post('/post', postHandler)
  router.get('/get', getHandler)

  router.route({ resourcePath: '/get', method: 'GET' }, {}).then(() => {
    t.end()
  })
})

test('route matches on the method if the path are the same', t => {
  let router = Router()
  const getHandler = () => t.pass('Handler called')
  const postHandler = () => t.fail('Wrong handler called')

  router.get('/get', getHandler)
  router.post('/get', postHandler)

  router.route({ resourcePath: '/get', method: 'GET' }, {}).then(() => {
    t.end()
  })
})

test('route matches on the proper url if the path are the same', t => {
  let router = Router()
  const getHandler = () => t.pass('Handler called')
  const failHandler = () => t.fail('Wrong handler called')

  router.get('/get/something/here', failHandler)
  router.get('/get/something/there', getHandler)

  router.route({ resourcePath: '/get/something/there', method: 'GET' }, {}).then(() => {
    t.end()
  })
})

test('route matches on the method if the Regex matches', t => {
  let router = Router()
  const getHandler = () => t.pass('Handler called')
  const failHandler = () => t.fail('Wrong handler called')

  router.get('/get', failHandler)
  router.get('/get/{id}', getHandler)

  router.route({ resourcePath: '/get/123jkhl1khj23123', method: 'GET' }, {}).then(() => {
    t.end()
  })
})

test('route tokenizes path parts', t => {
  let router = Router()
  const getHandler = ({ pathParameters: { id } }) => {
    t.equal(id, '123jkhl1khj23123', 'got tokenized id')
  }
  const failHandler = () => t.fail('Wrong handler called')

  router.get('/get', failHandler)
  router.get('/get/{id}', getHandler)

  router.route({ resourcePath: '/get/123jkhl1khj23123', method: 'GET' }, {}).then(() => {
    t.end()
  })
})

test('route does not tokenize without option', t => {
  let router = Router({ extractPathParameters: false })
  const getHandler = ({ pathParameters }) => {
    t.same(pathParameters, {}, 'no id')
  }
  const failHandler = () => t.fail('Wrong handler called')

  router.get('/get', failHandler)
  router.get('/get/{id}', getHandler)

  router.route({ pathParameters: {}, resourcePath: '/get/123jkhl1khj23123', method: 'GET' }, {}).then(() => {
    t.end()
  })
})

test('if the handler throws an error, the router returns it', async t => {
  let router = Router()
  router.debug = true

  const getHandler = () => {
    throw new Error('testing an error')
  }

  router.get('/get', getHandler)

  let result = await router.route({ resourcePath: '/get', method: 'GET' }, {})

  t.notOk(result.isOk, 'resposne is error')
  t.equal(result.response.statusCode, 500, 'status code')
  t.ok(JSON.parse(result.response.body).message.indexOf('testing an error') !== -1, 'The proper error bubbled up.')
})

test('if no route is defined the default router returns an error', async t => {
  let router = Router()
  let result = await router.route({ resourcePath: '/none', method: 'GET' }, {})
  t.ok(JSON.parse(result.response.body).message.includes('No route specified'), 'The proper error bubbled up.')
})

test('route throws if context.response has already been set', async t => {
  t.plan(1)
  let router = Router()
  router.post('/route', () => { })
  await router.route({}, { response: true }, '/route', 'POST')
    .catch(err => {
      t.ok(err.message.includes('context.response'), 'already set')
    })
})

test('route allows custom response status codes', async t => {
  t.plan(1)
  let router = Router()
  router.post('/route', (_, { response }) => response(201, 'nothing'))
  let result = await router.route({}, {}, '/route', 'POST')
  t.equal(result.response.statusCode, 201, 'custom code')
})

test('route parses body with default option', async t => {
  t.plan(1)
  let router = Router()
  router.post('/route', ({ body }) => {
    t.equal(body.name, 'tim', 'parsed')
  })
  await router.route({ body: JSON.stringify({ name: 'tim' }) }, {}, '/route', 'POST')
})

test('route returns 400 for parse errors', async t => {
  t.plan(1)
  let router = Router()
  router.post('/route', ({ body }) => { })
  let result = await router.route({ body: 'name' }, {}, '/route', 'POST')
  t.equal(result.response.statusCode, 400)
})

test('route does not parse body with option', async t => {
  t.plan(1)
  let router = Router({ parseBody: false })
  router.post('/route', ({ body }) => {
    t.equal(body, JSON.stringify({ name: 'tim' }), 'parsed')
  })
  await router.route({ body: JSON.stringify({ name: 'tim' }) }, {}, '/route', 'POST')
})

test('route decodes parameters with default option', async t => {
  t.plan(2)
  let router = Router()
  router.post('/route', ({ pathParameters, queryStringParameters }) => {
    t.equal(pathParameters.name, 'tim kye', 'parsed')
    t.equal(queryStringParameters.name, 'tim kye', 'parsed')
  })
  await router.route({
    pathParameters: { name: 'tim%20kye' },
    queryStringParameters: { name: 'tim%20kye' }
  }, {}, '/route', 'POST')
})

test('route does not decode parameters with option', async t => {
  t.plan(2)
  let router = Router({ decodeEvent: false })
  router.post('/route', ({ pathParameters, queryStringParameters }) => {
    t.equal(pathParameters.name, 'tim%20kye', 'parsed')
    t.equal(queryStringParameters.name, 'tim%20kye', 'parsed')
  })
  await router.route({
    pathParameters: { name: 'tim%20kye' },
    queryStringParameters: { name: 'tim%20kye' }
  }, {}, '/route', 'POST')
})

test('traceId is created', async t => {
  t.plan(1)
  let router = Router()
  router.post('/route', () => { })
  let result = await router.route({}, {}, '/route', 'POST')
  t.ok(result.response.headers['X-Correlation-Id'], 'trace id ' + result.response.headers['X-Correlation-Id'])
})

test('traceId is skipped if disabled', async t => {
  t.plan(1)
  let router = Router({ includeTraceId: false })
  router.post('/route', () => { })
  let result = await router.route({}, {}, '/route', 'POST')
  t.notOk(result.response.headers['X-Correlation-Id'], 'no trace id')
})

test('traceId is reused from event', async t => {
  t.plan(6)
  let router = Router()
  router.post('/route', () => { })
  let traceId = '1234'
  let result = await router.route({ headers: { 'X-Trace-Id': traceId } }, {}, '/route', 'POST')
  t.equal(result.response.headers['X-Correlation-Id'], traceId, 'trace id ')

  result = await router.route({ headers: { 'X-TRACE-ID': traceId } }, {}, '/route', 'POST')
  t.equal(result.response.headers['X-Correlation-Id'], traceId, 'trace id ')

  result = await router.route({ headers: { 'x-trace-id': traceId } }, {}, '/route', 'POST')
  t.equal(result.response.headers['X-Correlation-Id'], traceId, 'trace id ')

  result = await router.route({ headers: { 'X-Correlation-Id': traceId } }, {}, '/route', 'POST')
  t.equal(result.response.headers['X-Correlation-Id'], traceId, 'trace id ')

  result = await router.route({ headers: { 'X-CORRELATION-ID': traceId } }, {}, '/route', 'POST')
  t.equal(result.response.headers['X-Correlation-Id'], traceId, 'trace id ')

  result = await router.route({ headers: { 'x-correlation-id': traceId } }, {}, '/route', 'POST')
  t.equal(result.response.headers['X-Correlation-Id'], traceId, 'trace id ')
})

test('context getters work inside routes', async t => {
  t.plan(1)
  let router = Router()
  router.post('/route', (event, { name }) => {
    t.equal(name, 'tim', 'context prop passed in')
  })
  let context = {}
  Object.defineProperty(context, 'name', {
    enumerable: false,
    configurable: false,
    get: () => 'tim'
  })
  await router.route({}, context, '/route', 'POST')
})
