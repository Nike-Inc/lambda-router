'use strict'

const { HttpError } = require('./httpError')

const batchDefaultConfig = {
  maxBatchSize: 20
}

module.exports = {
  batchHandler
}

async function batchHandler({ route, config }, event, context) {
  config = { ...batchDefaultConfig, ...config }
  const body = event.body

  // Validate
  validateBatchRequest(body, config.maxBatchSize)

  //Traverse dependency tree and execute requests
  let requests = [...body.requests]
  const complete = []
  const responses = []
  do {
    let toExecute
    ;[toExecute, requests] = requests.reduce(
      (arr, req) => {
        if (!req.dependsOn || req.dependsOn.every(dependency => complete.includes(dependency))) {
          arr[0].push(req)
        } else {
          arr[1].push(req)
        }
        return arr
      },
      [[], []]
    )

    const results = await Promise.all(
      // eslint-disable-next-line no-loop-func
      toExecute.map(req => {
        return executeRequest(config, route, event, context, req).catch(err => {
          return {
            statusCode: 500,
            body: JSON.stringify({ statusCode: 500, message: err.message, stack: err.stack })
          }
        })
      })
    )

    responses.push(
      ...results.map((result, index) => {
        complete.push(toExecute[index].id)
        return {
          id: toExecute[index].id,
          status: result.response.statusCode,
          body: result.response.body ? JSON.parse(result.response.body) : undefined,
          headers: result.response.headers
        }
      })
    )

    //Saftey Check; Shouldn't happen, but if it were to we'd be stuck in an infinite loop
    if (toExecute.length === 0) {
      throw new HttpError(400, `Invalid dependency chain`)
    }
  } while (requests.length > 0)

  return {
    statusCode: 200,
    body: responses,
    headers: {}
  }
}

function composeQueryStringParametersFromUrl(url) {
  const urlAndQuerystring = url.split('?')
  let queryStringParameters = {}
  if (urlAndQuerystring.length > 1) {
    const queryStringParams = urlAndQuerystring[1]
    const keys = queryStringParams.split('&')
    const queryStrings = keys.map(k => k.split('='))

    for (let queryString of queryStrings) {
      if (queryStringParameters[queryString[0]]) {
        queryStringParameters[queryString[0]].push(queryString[1])
      } else {
        queryStringParameters[queryString[0]] = [queryString[1]]
      }
    }
  }
  return queryStringParameters
}

async function executeRequest(config, route, event, context, request) {
  const urlAndQueryString = request.url.split('?')

  const authorizationHeader = Object.keys(event.headers).find(
    header => header.toLowerCase() === 'authorization'
  )

  //Compose event to appear as native AWS event
  let childEvent = {
    ...event,
    httpMethod: request.method,
    headers: { ...request.headers, [authorizationHeader]: event.headers[authorizationHeader] },
    body: request.body,
    path: urlAndQueryString[0],
    pathParameters: {
      proxy: urlAndQueryString[0].substring(1)
    },
    multiValueQueryStringParameters: composeQueryStringParametersFromUrl(request.url)
  }

  context._batch = true
  context.response = undefined
  
  return await route(childEvent, context)
}

function validateDependencyChain(requests) {
  const dependencies = requests.reduce((obj, req) => {
    obj[req.id] = { dependsOn: [], ...req }
    return obj
  }, {})
  let keys = Object.keys(dependencies)
  let length
  let items

  const sorted = new Set()
  const result = []
  do {
    length = keys.length
    items = []
    // eslint-disable-next-line no-loop-func
    keys = keys.filter(k => {
      if (!dependencies[k].dependsOn.every(dependency => sorted.has(dependency))) {
        return true
      }
      items.push(k)
      return false
    })
    result.push(...items)
    items.forEach(i => sorted.add(i))
  } while (keys.length && keys.length !== length)

  HttpError.assert(
    keys.length === 0,
    400,
    `invalid body; unable to resolve execution order ` +
      `due to circular dependency chain(s) involving: (${keys.join(', ')})`
  )
}

function validateBatchRequest(body, maxBatchSize) {
  // validate json body has been parsed
  HttpError.assert(typeof body === 'object' && body !== null, 400, `invalid body; expected object`)
  // validate body.requests has array of requests
  HttpError.assert(
    body.requests && Array.isArray(body.requests),
    400,
    `invalid body; expected requests to be an array`
  )
  HttpError.assert(
    body.requests.length !== 0,
    400,
    `invalid body; requests must contain at least one element`
  )
  HttpError.assert(
    body.requests.length <= maxBatchSize,
    400,
    `invalid body; max number of requests exceeded (${maxBatchSize})`
  )

  // validate each body.requests[]
  const ids = body.requests.map(req => req.id)
  for (let i = 0; i < body.requests.length; i++) {
    const request = body.requests[i]
    HttpError.assert(request.id, 400, `invalid body; requests[${i}].id required`)
    HttpError.assert(
      typeof request.id === 'string' || request.id instanceof String,
      400,
      `invalid body; requests[${i}].id must be a string`
    )
    HttpError.assert(request.method, 400, `invalid body; requests[${i}].method required`)
    HttpError.assert(
      ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method),
      400,
      `invalid body; requests[${i}].method must be one of ( GET | POST | PUT | PATCH | DELETE )`
    )
    HttpError.assert(request.url, 400, `invalid body; requests[${i}].url required`)
    HttpError.assert(
      typeof request.url === 'string' || request.url instanceof String,
      400,
      `invalid body; requests[${i}].url must be a string`
    )
    HttpError.assert(
      !request.headers ||
        !Object.keys(request.headers).some(header => header.toLowerCase() === 'authorization'),
      400,
      `invalid body; requests[${i}].headers.authorization can not be supplied`
    )
    if (request.dependsOn) {
      HttpError.assert(
        Array.isArray(request.dependsOn),
        400,
        `invalid body; requests[${i}].dependsOn must be an array`
      )
      const invalidDependsOn = request.dependsOn.filter(depend => !ids.includes(depend))
      HttpError.assert(
        invalidDependsOn.length === 0,
        400,
        `invalid body; requests[${i}].dependsOn references invalid id(s): ${invalidDependsOn.join(
          ', '
        )}`
      )
    }
  }

  validateDependencyChain(body.requests)
}