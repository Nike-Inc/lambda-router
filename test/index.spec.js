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

test('unknown set the unknown route.', async t => {
  t.plan(1)
  let router = Router()
  router.unknown(() => {
    t.pass('called unknown')
  })
  await router.route({}, {}, '/route', 'POST')
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
  console.log(result.response)
  t.ok(JSON.parse(result.response.body).message.includes('No route specified'), 'The proper error bubbled up.')
})
