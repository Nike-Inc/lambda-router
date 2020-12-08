/* eslint no-unused-vars:0 no-empty-function:0 */
'use strict'

const test = require('ava')
const qs = require('querystring')
const sinon = require('sinon')
const batch = require('../src/batch')
const httpError = require('../src/httpError')
const {
  batchHandler,
  validateBatchRequest,
  validateDependencyChain,
  executeRequest,
  composeQueryStringParametersFromUrl
} = batch
const { HttpError } = require('../src/httpError')

//validateBatchRequest
test('should throw HttpError if body is undefined', async t => {
  t.plan(3)
  const error = t.throws(() => validateBatchRequest(undefined, 1), { instanceOf: HttpError })
  t.is(error.message, `invalid body; expected object`)
  t.is(error.statusCode, 400)
})
test('should throw HttpError if body is not an object', async t => {
  t.plan(3)
  const error = t.throws(() => validateBatchRequest('body', 1), { instanceOf: HttpError })
  t.is(error.message, `invalid body; expected object`)
  t.is(error.statusCode, 400)
})
test('should throw HttpError if body is null', async t => {
  t.plan(3)
  const error = t.throws(() => validateBatchRequest(null, 1), { instanceOf: HttpError })
  t.is(error.message, `invalid body; expected object`)
  t.is(error.statusCode, 400)
})
test('should throw HttpError if body.requests is undefined', async t => {
  t.plan(3)
  const error = t.throws(() => validateBatchRequest({}, 1), { instanceOf: HttpError })
  t.is(error.message, `invalid body; expected requests to be an array`)
  t.is(error.statusCode, 400)
})
test('should throw HttpError if body.requests is not an array', async t => {
  t.plan(3)
  const error = t.throws(() => validateBatchRequest({ requests: 'reqs' }, 1), {
    instanceOf: HttpError
  })
  t.is(error.message, `invalid body; expected requests to be an array`)
  t.is(error.statusCode, 400)
})
test('should throw HttpError if body.requests is empty', async t => {
  t.plan(3)
  const error = t.throws(() => validateBatchRequest({ requests: [] }, 1), { instanceOf: HttpError })
  t.is(error.message, `invalid body; requests must contain at least one element`)
  t.is(error.statusCode, 400)
})
test('should throw HttpError if body.requests count exceeds maxBatchSize', async t => {
  t.plan(3)
  const error = t.throws(() => validateBatchRequest({ requests: ['1', '2'] }, 1), {
    instanceOf: HttpError
  })
  t.is(error.message, `invalid body; max number of requests exceeded (1)`)
  t.is(error.statusCode, 400)
})
test('should throw HttpError if body.requests[].id is undefined', async t => {
  t.plan(3)
  const error = t.throws(() => validateBatchRequest({ requests: [{}] }, 1), {
    instanceOf: HttpError
  })
  t.is(error.message, `invalid body; requests[0].id required`)
  t.is(error.statusCode, 400)
})
test('should throw HttpError if body.requests[].id is not a string', async t => {
  t.plan(3)
  const error = t.throws(() => validateBatchRequest({ requests: [{ id: {} }] }, 1), {
    instanceOf: HttpError
  })
  t.is(error.message, `invalid body; requests[0].id must be a string`)
  t.is(error.statusCode, 400)
})
test('should throw HttpError if body.requests[].method is not a string', async t => {
  t.plan(3)
  const error = t.throws(() => validateBatchRequest({ requests: [{ id: 'id', method: 2 }] }, 1), {
    instanceOf: HttpError
  })
  t.is(
    error.message,
    `invalid body; requests[0].method must be one of ( GET | POST | PUT | PATCH | DELETE )`
  )
  t.is(error.statusCode, 400)
})
test('should throw HttpError if body.requests[].method is not a valid value', async t => {
  t.plan(3)
  const error = t.throws(
    () => validateBatchRequest({ requests: [{ id: 'id', method: 'RESET' }] }, 1),
    { instanceOf: HttpError }
  )
  t.is(
    error.message,
    `invalid body; requests[0].method must be one of ( GET | POST | PUT | PATCH | DELETE )`
  )
  t.is(error.statusCode, 400)
})
test('should throw HttpError if body.requests[].url is undefined', async t => {
  t.plan(3)
  const error = t.throws(
    () => validateBatchRequest({ requests: [{ id: 'id', method: 'POST' }] }, 1),
    { instanceOf: HttpError }
  )
  t.is(error.message, `invalid body; requests[0].url required`)
  t.is(error.statusCode, 400)
})
test('should throw HttpError if body.requests[].headers contains authorization', async t => {
  t.plan(3)
  const error = t.throws(
    () =>
      validateBatchRequest(
        { requests: [{ id: 'id', method: 'POST', url: '/url', headers: { authorization: true } }] },
        1
      ),
    { instanceOf: HttpError }
  )
  t.is(error.message, `invalid body; requests[0].headers.authorization can not be supplied`)
  t.is(error.statusCode, 400)
})
test('should throw HttpError if body.requests[].headers contains any casing of authorization', async t => {
  t.plan(3)
  const error = t.throws(
    () =>
      validateBatchRequest(
        { requests: [{ id: 'id', method: 'POST', url: '/url', headers: { AuThOrizaTION: true } }] },
        1
      ),
    { instanceOf: HttpError }
  )
  t.is(error.message, `invalid body; requests[0].headers.authorization can not be supplied`)
  t.is(error.statusCode, 400)
})
test('should throw HttpError if body.requests[].dependsOn is not an array', async t => {
  t.plan(3)
  const error = t.throws(
    () =>
      validateBatchRequest(
        {
          requests: [
            { id: 'id', method: 'POST', url: '/url', headers: { ect: true }, dependsOn: 'A' }
          ]
        },
        1
      ),
    { instanceOf: HttpError }
  )
  t.is(error.message, `invalid body; requests[0].dependsOn must be an array`)
  t.is(error.statusCode, 400)
})
test('should throw HttpError if body.requests[].dependsOn references a nonexistent id', async t => {
  t.plan(3)
  const error = t.throws(
    () =>
      validateBatchRequest(
        {
          requests: [
            { id: 'id', method: 'POST', url: '/url', headers: { ect: true }, dependsOn: ['A'] }
          ]
        },
        1
      ),
    { instanceOf: HttpError }
  )
  t.is(error.message, `invalid body; requests[0].dependsOn references invalid id(s): A`)
  t.is(error.statusCode, 400)
})
test('should throw HttpError with message indicating specific requests array failure index', async t => {
  t.plan(3)
  const error = t.throws(
    () =>
      validateBatchRequest(
        {
          requests: [
            { id: 'id', method: 'POST', url: '/url', headers: { ect: true }, dependsOn: ['id2'] },
            { id: 'id2', method: 'POST', headers: { ect: true }, dependsOn: ['id'] }
          ]
        },
        2
      ),
    { instanceOf: HttpError }
  )
  t.is(error.message, `invalid body; requests[1].url required`)
  t.is(error.statusCode, 400)
})
test.serial('should call validateDependencyChain', async t => {
  const sandbox = sinon.createSandbox()
  const validateDependencyChainStub = sandbox.stub(batch, 'validateDependencyChain')
  validateDependencyChainStub.returns()
  t.plan(1)
  validateBatchRequest(
    {
      requests: [
        { id: 'id', method: 'POST', url: '/url', headers: { ect: true }, dependsOn: ['id2'] },
        { id: 'id2', method: 'POST', url: '/url', headers: { ect: true }, dependsOn: ['id'] }
      ]
    },
    2
  )
  t.true(validateDependencyChainStub.calledOnce)
  sandbox.restore()
})

//validateDependencyChain
test('single request should not throw exception', async t => {
  t.plan(1)
  validateDependencyChain([{ id: 'id' }])
  t.pass()
})
test('multiple requests should not throw exeption', async t => {
  t.plan(1)
  validateDependencyChain([{ id: '1' }, { id: '2' }])
  t.pass()
})

test('valid dependencies should pass, single', async t => {
  t.plan(1)
  validateDependencyChain([{ id: '1', dependsOn: ['2'] }, { id: '2' }])
  t.pass()
})
test('valid dependencies should pass, multi', async t => {
  t.plan(1)
  validateDependencyChain([
    { id: '1', dependsOn: ['2'] },
    { id: '2' },
    { id: '3', dependsOn: ['2'] }
  ])
  t.pass()
})
test('valid dependencies should pass, multi chain', async t => {
  t.plan(1)
  validateDependencyChain([
    { id: '1', dependsOn: ['2'] },
    { id: '2' },
    { id: '3', dependsOn: ['2'] },
    { id: '4', dependsOn: ['1'] }
  ])
  t.pass()
})
test('valid dependencies should pass, multi complex', async t => {
  t.plan(1)
  validateDependencyChain([
    { id: '1', dependsOn: ['2'] },
    { id: '2' },
    { id: '3', dependsOn: ['2'] },
    { id: '4', dependsOn: ['2'] },
    { id: '5', dependsOn: ['2', '1', '4'] }
  ])
  t.pass()
})
test('valid dependencies should pass, multi complex, long chain', async t => {
  t.plan(1)
  validateDependencyChain([
    { id: '1', dependsOn: ['2'] },
    { id: '2' },
    { id: '3', dependsOn: ['2'] },
    { id: '4', dependsOn: ['2'] },
    { id: '5', dependsOn: ['2', '1', '4'] },
    { id: '6', dependsOn: ['5'] },
    { id: '7', dependsOn: ['6'] },
    { id: '8', dependsOn: ['7'] },
    { id: '9', dependsOn: ['8'] },
    { id: '10', dependsOn: ['2', '1', '4'] }
  ])
  t.pass()
})
test('valid dependencies should pass, multi complex, long chain, additional lacking dependencies', async t => {
  t.plan(1)
  validateDependencyChain([
    { id: '1', dependsOn: ['2'] },
    { id: '2' },
    { id: '3', dependsOn: ['2'] },
    { id: '4', dependsOn: ['2'] },
    { id: '5', dependsOn: ['2', '1', '4'] },
    { id: '6', dependsOn: ['5'] },
    { id: '7', dependsOn: ['6'] },
    { id: '8', dependsOn: ['7'] },
    { id: '9', dependsOn: ['8'] },
    { id: '10', dependsOn: ['2', '1', '4'] },
    { id: '11' },
    { id: '12' }
  ])
  t.pass()
})
test('invalid dependency chain should throw error, simple', async t => {
  t.plan(3)
  const error = t.throws(
    () =>
      validateDependencyChain([
        { id: '1', dependsOn: ['2'] },
        { id: '2' },
        { id: '3', dependsOn: ['2'] },
        { id: '4', dependsOn: ['2'] },
        { id: '5', dependsOn: ['2', '1', '4'] },
        { id: '6', dependsOn: ['5'] },
        { id: '7', dependsOn: ['6'] },
        { id: '8', dependsOn: ['7'] },
        { id: '9', dependsOn: ['8'] },
        { id: '10', dependsOn: ['2', '1', '4'] },
        { id: '11', dependsOn: ['12'] },
        { id: '12', dependsOn: ['11'] }
      ]),
    { instanceOf: HttpError }
  )
  t.is(
    error.message,
    'invalid body; unable to resolve execution order due to circular dependency chain(s) involving: (11, 12)'
  )
  t.is(error.statusCode, 400)
})
test('invalid dependency chain should throw error, complex', async t => {
  t.plan(3)
  const error = t.throws(
    () =>
      validateDependencyChain([
        { id: '1', dependsOn: ['2'] },
        { id: '2', dependsOn: ['11'] },
        { id: '3', dependsOn: ['2'] },
        { id: '4', dependsOn: ['2'] },
        { id: '5', dependsOn: ['2', '1', '4'] },
        { id: '6', dependsOn: ['5'] },
        { id: '7', dependsOn: ['6'] },
        { id: '8', dependsOn: ['7'] },
        { id: '9', dependsOn: ['8'] },
        { id: '10', dependsOn: ['2', '1', '4'] },
        { id: '11', dependsOn: ['12'] },
        { id: '12', dependsOn: ['10'] }
      ]),
    { instanceOf: HttpError }
  )
  t.is(
    error.message,
    'invalid body; unable to resolve execution order due to circular dependency chain(s) involving: (1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12)'
  )
  t.is(error.statusCode, 400)
})
test('invalid dependency chain should throw error, long chain', async t => {
  t.plan(3)
  const error = t.throws(
    () =>
      validateDependencyChain([
        { id: '1', dependsOn: ['2'] },
        { id: '2', dependsOn: ['3'] },
        { id: '3', dependsOn: ['4'] },
        { id: '4', dependsOn: ['5'] },
        { id: '5', dependsOn: ['6'] },
        { id: '6', dependsOn: ['6'] },
        { id: '7', dependsOn: ['7'] },
        { id: '8', dependsOn: ['8'] },
        { id: '9', dependsOn: ['10'] },
        { id: '10', dependsOn: ['11'] },
        { id: '11', dependsOn: ['12', '1'] },
        { id: '12' }
      ]),
    { instanceOf: HttpError }
  )
  t.is(
    error.message,
    'invalid body; unable to resolve execution order due to circular dependency chain(s) involving: (1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11)'
  )
  t.is(error.statusCode, 400)
})

//executeRequest
test.serial('should call composeQueryStringParametersFromUrlStub with request.url', async t => {
  const sandbox = sinon.createSandbox()
  const composeQueryStringParametersFromUrlStub = sandbox.stub(
    batch,
    'composeQueryStringParametersFromUrl'
  )
  composeQueryStringParametersFromUrlStub.returns('composedQSP')
  const routeStub = sandbox.stub()
  routeStub.resolves()

  t.plan(2)
  executeRequest(
    routeStub,
    { e: true, headers: { AuThOrizaTION: 'auth' } },
    { context: true },
    {
      method: 'GET',
      headers: { AuThOrizaTION: 'wrong' },
      other: true,
      url: '/url',
      body: { b: true }
    }
  )
  t.true(composeQueryStringParametersFromUrlStub.calledOnce)
  t.deepEqual(composeQueryStringParametersFromUrlStub.getCall(0).args, ['/url'])

  sandbox.restore()
})
test.serial(
  'should call composeQueryStringParametersFromUrlStub with request.url with querystring',
  async t => {
    const sandbox = sinon.createSandbox()
    const composeQueryStringParametersFromUrlStub = sandbox.stub(
      batch,
      'composeQueryStringParametersFromUrl'
    )
    composeQueryStringParametersFromUrlStub.returns('composedQSP')
    const routeStub = sandbox.stub()
    routeStub.resolves()

    t.plan(2)
    await executeRequest(
      routeStub,
      { e: true, headers: { AuThOrizaTION: 'auth' } },
      { context: true },
      {
        method: 'GET',
        headers: { AuThOrizaTION: 'wrong' },
        other: true,
        url: '/url?filter=true',
        body: { b: true }
      }
    )
    t.true(composeQueryStringParametersFromUrlStub.calledOnce)
    t.deepEqual(composeQueryStringParametersFromUrlStub.getCall(0).args, ['/url?filter=true'])

    sandbox.restore()
  }
)
test.serial('should call route with composed parameters', async t => {
  const sandbox = sinon.createSandbox()
  const composeQueryStringParametersFromUrlStub = sandbox.stub(
    batch,
    'composeQueryStringParametersFromUrl'
  )
  composeQueryStringParametersFromUrlStub.returns('composedQSP')
  const routeStub = sandbox.stub()
  routeStub.resolves()

  t.plan(2)
  await executeRequest(
    routeStub,
    { e: true, headers: { AuThOrizaTION: 'auth' } },
    { context: true, response: 'asdf' },
    {
      id: 'id',
      method: 'GET',
      headers: { AuThOrizaTION: 'wrong' },
      other: true,
      url: '/url?filter=true',
      body: { b: true }
    }
  )
  t.true(routeStub.calledOnce)
  t.deepEqual(routeStub.getCall(0).args, [
    {
      batchRequestId: 'id',
      body: { b: true },
      e: true,
      headers: { AuThOrizaTION: 'auth' },
      httpMethod: 'GET',
      multiValueQueryStringParameters: 'composedQSP',
      path: '/url',
      pathParameters: {
        proxy: 'url'
      }
    },
    { context: true, response: undefined }
  ])

  sandbox.restore()
})

//composeQueryStringParametersFromUrl
test('should return empty object if url without querystring', async t => {
  t.plan(1)
  const result = await composeQueryStringParametersFromUrl('/url')
  t.deepEqual(result, {})
})
test('should return empty object if multi-path url without querystring', async t => {
  t.plan(1)
  const result = await composeQueryStringParametersFromUrl('/url/path/more/ect')
  t.deepEqual(result, {})
})
test('should return querystring value to parameter object', async t => {
  t.plan(1)
  const result = await composeQueryStringParametersFromUrl('/url?test=true')
  t.deepEqual(result, { test: ['true'] })
})
test('should compose multi-querystring value to parameter object', async t => {
  t.plan(1)
  const result = await composeQueryStringParametersFromUrl('/url?test=true&otherTest=1234')
  t.deepEqual(result, { test: ['true'], otherTest: ['1234'] })
})
test('should add to array for duplicate keys', async t => {
  t.plan(1)
  const result = await composeQueryStringParametersFromUrl(
    '/url?test=true&otherTest=1234&test=false&otherTest=4321'
  )
  t.deepEqual(result, { test: ['true', 'false'], otherTest: ['1234', '4321'] })
})

//batchHandler
test.serial('should return results from async requests in order executed', async t => {
  const sandbox = sinon.createSandbox()
  const validateBatchRequestStub = sandbox.stub(batch, 'validateBatchRequest')
  validateBatchRequestStub.returns()
  const executeRequestStub = sandbox.stub(batch, 'executeRequest')
  executeRequestStub.onFirstCall().resolves({ response: { statusCode: 204 } })
  executeRequestStub.onSecondCall().resolves({ response: { statusCode: 200, body: '{"ok":true}' } })

  t.plan(2)
  const result = await batchHandler(
    { route: 'route', config: { maxBatchSize: 5 } },
    { e: true, body: { requests: [{ id: '1' }, { id: '2' }] } },
    {
      response: (statusCode, body, headers) => {
        return { statusCode, body, headers }
      }
    }
  )
  t.like(result.body.responses[0], {
    id: '1',
    status: 204,
    headers: undefined,
    body: undefined
  })
  t.like(result.body.responses[1], {
    id: '2',
    status: 200,
    headers: undefined,
    body: { ok: true }
  })

  sandbox.restore()
})
test.serial('should return results from sync requests according to dependency chain', async t => {
  const sandbox = sinon.createSandbox()
  const validateBatchRequestStub = sandbox.stub(batch, 'validateBatchRequest')
  validateBatchRequestStub.returns()
  const executeRequestStub = sandbox.stub(batch, 'executeRequest')
  executeRequestStub.onCall(0).resolves({ response: { statusCode: 200, body: '{"ok":1}' } })
  executeRequestStub.onCall(1).resolves({ response: { statusCode: 200, body: '{"ok":2}' } })
  executeRequestStub.onCall(2).resolves({ response: { statusCode: 200, body: '{"ok":3}' } })
  executeRequestStub.onCall(3).resolves({ response: { statusCode: 200, body: '{"ok":4}' } })
  executeRequestStub.onCall(4).resolves({ response: { statusCode: 200, body: '{"ok":5}' } })

  t.plan(5)
  const result = await batchHandler(
    { route: 'route', config: { maxBatchSize: 5 } },
    {
      e: true,
      body: {
        requests: [
          { id: 'A' },
          { id: 'B', dependsOn: ['A'] },
          { id: 'C' },
          { id: 'D', dependsOn: ['C', 'B'] },
          { id: 'E', dependsOn: ['C'] }
        ]
      }
    },
    {
      response: (statusCode, body, headers) => {
        return { statusCode, body, headers }
      }
    }
  )
  t.like(result.body.responses[0], {
    id: 'A',
    status: 200,
    headers: undefined,
    body: { ok: 1 }
  })
  t.like(result.body.responses[1], {
    id: 'C',
    status: 200,
    headers: undefined,
    body: { ok: 2 }
  })
  t.like(result.body.responses[2], {
    id: 'B',
    status: 200,
    headers: undefined,
    body: { ok: 3 }
  })
  t.like(result.body.responses[3], {
    id: 'E',
    status: 200,
    headers: undefined,
    body: { ok: 4 }
  })
  t.like(result.body.responses[4], {
    id: 'D',
    status: 200,
    headers: undefined,
    body: { ok: 5 }
  })

  sandbox.restore()
})

test.serial('should throw HttpError if infinite loop detected', async t => {
  const sandbox = sinon.createSandbox()
  const validateBatchRequestStub = sandbox.stub(batch, 'validateBatchRequest')
  validateBatchRequestStub.returns()
  const executeRequestStub = sandbox.stub(batch, 'executeRequest')
  executeRequestStub.resolves({ response: { statusCode: 200, body: '{"ok":true}' } })

  t.plan(3)
  const error = await t.throwsAsync(
    () =>
      batchHandler(
        { route: 'route', config: { maxBatchSize: 5 } },
        {
          e: true,
          body: {
            requests: [
              { id: 'A' },
              { id: 'B', dependsOn: ['A'] },
              { id: 'C', dependsOn: ['E'] },
              { id: 'D', dependsOn: ['C', 'B'] },
              { id: 'E', dependsOn: ['C'] }
            ]
          }
        },
        { c: true }
      ),
    { instanceOf: HttpError }
  )

  t.is(error.message, `Invalid dependency chain`)
  t.is(error.statusCode, 400)

  sandbox.restore()
})
