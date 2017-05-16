'use strict'

let test = require('blue-tape')
let lambdaRouter = require('../src/index')

test('Assert that GET adds a route to the routes list.', t => {
  let router = lambdaRouter()
  router.get('/get', () => {})
  let route = router.getRoutes()[0]
  t.ok(route.method === 'GET', 'Route method is GET')
  t.ok(route.path === '/get', 'Route path is /get')
  t.end()
})

test('Assert that POST adds a route to the routes list.', t => {
  let router = lambdaRouter()
  router.post('/post', () => {})
  let route = router.getRoutes()[0]
  t.ok(route.method === 'POST', 'Route method is POST')
  t.ok(route.path === '/post', 'Route path is /post')
  t.end()
})

test('Assert that PUT adds a route to the routes list.', t => {
  let router = lambdaRouter()
  router.put('/put', () => {})
  let route = router.getRoutes()[0]
  t.ok(route.method === 'PUT', 'Route method is PUT')
  t.ok(route.path === '/put', 'Route path is /put')
  t.end()
})

test('Assert that DELETE adds a route to the routes list.', t => {
  let router = lambdaRouter()
  router.delete('/delete', () => {})
  let route = router.getRoutes()[0]
  t.ok(route.method === 'DELETE', 'Route method is DELETE')
  t.ok(route.path === '/delete', 'Route path is /delete')
  t.end()
})

test('Assert that unknown set the unknown route.', t => {
  let router = lambdaRouter()
  router.unknown(() => {})
  t.ok(router.unknownRoute, 'Unknown route is set')
  t.end()
})

test('Assert that route matches on the GET handler', t => {
  let router = lambdaRouter()
  const getHandler = () => t.pass('Handler called')
  const postHandler = () => t.fail('Wrong handler called')

  router.post('/post', postHandler)
  router.get('/get', getHandler)

  router.route({ resourcePath: '/get', method: 'GET' }, {}).then(() => {
    t.end()
  })
})

test('Assert that route matches on the method if the path are the same', t => {
  let router = lambdaRouter()
  const getHandler = () => t.pass('Handler called')
  const postHandler = () => t.fail('Wrong handler called')

  router.get('/get', getHandler)
  router.post('/get', postHandler)

  router.route({ resourcePath: '/get', method: 'GET' }, {}).then(() => {
    t.end()
  })
})

test('Assert that route matches on the proper url if the path are the same', t => {
  let router = lambdaRouter()
  const getHandler = () => t.pass('Handler called')
  const failHandler = () => t.fail('Wrong handler called')

  router.get('/get/something/here', failHandler)
  router.get('/get/something/there', getHandler)

  router.route({ resourcePath: '/get/something/there', method: 'GET' }, {}).then(() => {
    t.end()
  })
})

test('Assert that route matches on the method if the Regex matches', t => {
  let router = lambdaRouter()
  const getHandler = () => t.pass('Handler called')
  const failHandler = () => t.fail('Wrong handler called')

  router.get('/get', failHandler)
  router.get('/get/{id}', getHandler)

  router.route({ resourcePath: '/get/123jkhl1khj23123', method: 'GET' }, {}).then(() => {
    t.end()
  })
})

test('Assert that if the handler throws an error, the router rejects', t => {
  let router = lambdaRouter()
  router.debug = true
  router.log()

  const getHandler = () => {
    throw new Error('testing an error')
  }

  router.get('/get', getHandler)

  router.route({ resourcePath: '/get', method: 'GET' }, {}).then(() => {
    t.fail('An error should have been thrown.')
  }).catch(err => {
    t.ok(err.message.indexOf('testing an error') !== -1, 'The proper error bubbled up.')
    t.end()
  })
})

test('Assert that if no route is defined the default router throws an exception.', t => {
  let router = lambdaRouter()
  router.route({ resourcePath: '/none', method: 'GET' }, {}).then(() => {
    t.fail('An error should have been thrown.')
  }).catch(err => {
    t.ok(err.message.indexOf('No route specified') !== -1, 'The proper error bubbled up.')
    t.end()
  })
})

test('Assert that if no route is defined the default router throws an exception.', t => {
  let router = lambdaRouter({ cors: true })
  router.get('/v1')
  t.ok(router.routes['OPTIONS_/v1'], 'An options path should have been added')
  t.end()
})
